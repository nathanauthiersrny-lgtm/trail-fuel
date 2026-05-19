/**
 * placeEvents — produit la liste de TimelineEvent (intakes, fluid_reminders,
 * check_ins, aid_stations) pour le plan brut.
 *
 * Logique déterministe, sans rules engine. Pour chaque fenêtre terrain :
 *   - descente technique → pas d'intake
 *   - montée raide      → gel uniquement
 *   - reste             → gel | bar | real_food
 *
 * Le LLM enrichment du companion peut surcharger ces choix (G2 séquences,
 * G4 lookahead) en aval.
 */

import type { FoodItemKind } from '../../models/food-item';
import type { AidStation } from '../../models/aid-station';
import type { TimelineEvent, IntakeAdvice } from '../../models/timeline-plan';
import { categorizeSlope, type SlopeCategory } from '../planning/slope-categories';
import type { PlanningWindow } from '../planning/windows';
import { resolveTargetAt } from '../../models/timeline-plan';
import type { RaceTargets } from '../../models/timeline-plan';

const DEFAULT_ALLOWED_KINDS: FoodItemKind[] = ['gel', 'bar', 'real_food'];

/**
 * Mapping terrain → préférences de kinds. Strict pour les cas dangereux,
 * permissif sinon.
 */
function allowedKindsFor(category: SlopeCategory): FoodItemKind[] | null {
  switch (category) {
    case 'descent_technical': return null; // pas d'intake
    case 'climb_steep':       return ['gel'];
    default:                  return DEFAULT_ALLOWED_KINDS;
  }
}

export type PlaceEventsInput = {
  totalDurationMin: number;
  windows: PlanningWindow[];
  aidStations: AidStation[];
  aidStationMinutes: number[];          // estimated minute of arrival, parallel to aidStations
  raceTargets: RaceTargets;
  firstIntakeAfterMin: number;
  intakeIntervalMin: number;
  checkInFrequencyMin: number;
  firstFluidReminderMin: number;
  fluidReminderIntervalMin: number;
};

export function placeEvents(input: PlaceEventsInput): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  let idCounter = 0;
  const nextId = (prefix: string): string => {
    idCounter += 1;
    return `${prefix}-${String(idCounter).padStart(3, '0')}`;
  };

  // ── Intakes
  for (const intake of generateIntakes(input)) {
    events.push({ id: nextId('evt'), ...intake });
  }

  // ── Check-ins
  for (const t of generateTicks(
    input.checkInFrequencyMin,
    input.checkInFrequencyMin,
    input.totalDurationMin,
  )) {
    events.push({
      id: nextId('evt'),
      type: 'check_in',
      at_min: t,
      why: `Check-in toutes les ${input.checkInFrequencyMin} min`,
      source: 'engine',
      confidence: 1.0,
    });
  }

  // ── Fluid reminders
  for (const t of generateTicks(
    input.firstFluidReminderMin,
    input.fluidReminderIntervalMin,
    input.totalDurationMin,
  )) {
    const fluidPerHour = resolveTargetAt(input.raceTargets.fluid_per_hour_ml, t);
    const targetMl = Math.round((fluidPerHour * input.fluidReminderIntervalMin) / 60);
    events.push({
      id: nextId('evt'),
      type: 'fluid_reminder',
      at_min: t,
      why: `Rappel hydratation (≈${targetMl} ml depuis le dernier)`,
      source: 'engine',
      confidence: 1.0,
      advice: { fluid_target_ml: targetMl },
    });
  }

  // ── Aid stations
  for (let i = 0; i < input.aidStations.length; i += 1) {
    const station = input.aidStations[i];
    const t = input.aidStationMinutes[i];
    if (t === undefined || t > input.totalDurationMin) continue;
    events.push({
      id: nextId('evt'),
      type: 'aid_station',
      at_min: t,
      why: `Passage ravito : ${station.name ?? `#${i + 1}`}`,
      source: 'engine',
      confidence: 1.0,
      aid_station_id: station.id,
    });
  }

  events.sort((a, b) => a.at_min - b.at_min);
  return mergeNearbyIntakes(events);
}

// ─── Intake generation ──────────────────────────────────────────────────────

function* generateIntakes(input: PlaceEventsInput): Generator<Omit<TimelineEvent, 'id'>> {
  let t = input.firstIntakeAfterMin;
  while (t < input.totalDurationMin) {
    const window = findWindow(input.windows, t);
    const allowed = window ? allowedKindsFor(categorizeSlope(window.medianSlope)) : DEFAULT_ALLOWED_KINDS;

    if (allowed !== null) {
      const carbsPerHour = resolveTargetAt(input.raceTargets.carbs_per_hour_g, t);
      const carbsTarget = Math.round((carbsPerHour * input.intakeIntervalMin) / 60);
      const advice: IntakeAdvice = { preferred_kinds: allowed, carbs_target_g: carbsTarget };
      const slopeNote = window ? slopeLabel(categorizeSlope(window.medianSlope)) : '';
      yield {
        type: 'intake',
        at_min: t,
        why: `Apport ${carbsTarget}g carbs (${input.intakeIntervalMin} min, ${carbsPerHour}g/h)${slopeNote}`,
        source: 'engine',
        confidence: 1.0,
        advice,
      };
    }
    // Sur descente technique on saute, mais on avance le curseur du même
    // intervalle pour éviter d'accumuler tous les intakes au sortir de la
    // section. L'enrichment LLM peut décider de re-placer en aval.

    t += input.intakeIntervalMin;
  }
}

function findWindow(windows: PlanningWindow[], at: number): PlanningWindow | null {
  for (const w of windows) {
    if (at >= w.startMin && at < w.endMin) return w;
  }
  return null;
}

function slopeLabel(category: SlopeCategory): string {
  switch (category) {
    case 'climb_steep':       return ' [montée raide → gel]';
    case 'descent_technical': return ' [descente technique]';
    case 'climb':             return ' [montée]';
    case 'descent':           return ' [descente]';
    case 'flat':              return '';
  }
}

// ─── Tick generators ────────────────────────────────────────────────────────

function* generateTicks(start: number, interval: number, end: number): Generator<number> {
  if (interval <= 0) return;
  let t = start;
  while (t < end) {
    yield t;
    t += interval;
  }
}

// ─── Post-processing ────────────────────────────────────────────────────────

/**
 * Si 2 intakes sont placés < 3 min l'un de l'autre, on décale le 2nd. Évite
 * que le LLM enrichment se retrouve avec des collisions hostiles à fusionner.
 */
const MIN_INTAKE_GAP_MIN = 3;

function mergeNearbyIntakes(events: TimelineEvent[]): TimelineEvent[] {
  const out: TimelineEvent[] = [];
  let lastIntakeAt: number | null = null;

  for (const e of events) {
    if (e.type === 'intake') {
      if (lastIntakeAt !== null && e.at_min - lastIntakeAt < MIN_INTAKE_GAP_MIN) {
        const shifted = { ...e, at_min: lastIntakeAt + MIN_INTAKE_GAP_MIN };
        out.push(shifted);
        lastIntakeAt = shifted.at_min;
      } else {
        out.push(e);
        lastIntakeAt = e.at_min;
      }
    } else {
      out.push(e);
    }
  }
  return out;
}
