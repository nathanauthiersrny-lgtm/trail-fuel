import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AidStation } from '../models/aid-station';
import type { GPXTrack } from '../models/gpx-track';
import type {
  Exposure,
  Intensity,
  InventoryItem,
  RaceOverrides,
  SessionType,
  TerrainType,
} from '../models/race';

// ─── Draft shape ─────────────────────────────────────────────────────────────

export type RaceCreationDraft = {
  // Step 1 — identification
  name: string;
  scheduled_start_at: number; // epoch ms UTC

  // Step 2 — parcours
  gpx_track: GPXTrack | null;
  distance_km: number | null;
  elevation_gain_m: number | null;
  elevation_loss_m: number | null;
  estimated_duration_min: number | null;
  terrain_type: TerrainType | null;

  // Step 3 — conditions
  temperature_c: number;
  humidity_high: boolean;
  exposure: Exposure;

  // Step 4 — type de sortie
  session_type: SessionType | null;
  // Derived from session_type, set together when user picks a type.
  intensity: Intensity | null;
  overrides: RaceOverrides | null;
  show_advanced: boolean; // advanced panel visibility, persisted

  // Step 5 — ravitaillements
  aid_stations: AidStation[];
  refill_in_nature: boolean;

  // Step 6 — inventaire embarqué
  inventory: InventoryItem[];
};

export type CreationStep = 1 | 2 | 3 | 4 | 5 | 6;

// ─── Store ───────────────────────────────────────────────────────────────────

type RaceCreationState = {
  currentStep: CreationStep;
  draft: RaceCreationDraft;
  setStep: (step: CreationStep) => void;
  updateDraft: (patch: Partial<RaceCreationDraft>) => void;
  reset: () => void;
};

function defaultDraft(): RaceCreationDraft {
  return {
    name: '',
    scheduled_start_at: Date.now() + 60 * 60 * 1000,
    gpx_track: null,
    distance_km: null,
    elevation_gain_m: null,
    elevation_loss_m: null,
    estimated_duration_min: null,
    terrain_type: null,
    temperature_c: 15,
    humidity_high: false,
    exposure: 'variable',
    session_type: null,
    intensity: null,
    overrides: null,
    show_advanced: false,
    aid_stations: [],
    refill_in_nature: false,
    inventory: [],
  };
}

export const useRaceCreationStore = create<RaceCreationState>()(
  persist(
    (set) => ({
      currentStep: 1,
      draft: defaultDraft(),
      setStep: (step) => set({ currentStep: step }),
      updateDraft: (patch) =>
        set((s) => ({ draft: { ...s.draft, ...patch } })),
      reset: () => set({ currentStep: 1, draft: defaultDraft() }),
    }),
    {
      name: 'race-creation-draft',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
