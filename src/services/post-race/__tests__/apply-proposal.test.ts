import type { SQLiteDatabase } from 'expo-sqlite';
import type { Profile } from '../../../models/profile';
import type { PostRaceProposal } from '../../../models/post-race-analysis';
import { applyProposalToProfile } from '../apply-proposal';

// Mock minimal SQLite DB qui capture le profil mis à jour pour assertions.
type MockUpdateCall = {
  carbs: number;
  fluid: number;
  sodium: number;
};

function makeMockDb(): { db: SQLiteDatabase; calls: MockUpdateCall[] } {
  const calls: MockUpdateCall[] = [];
  const db = {
    runAsync: jest.fn(async (_sql: string, params: unknown[]) => {
      calls.push({
        carbs: params[1] as number,
        fluid: params[2] as number,
        sodium: params[3] as number,
      });
      return { changes: 1, lastInsertRowId: 0 };
    }),
  } as unknown as SQLiteDatabase;
  return { db, calls };
}

const PROFILE: Profile = {
  id: 1,
  weight_kg: 70,
  carbs_per_hour_g: 60,
  fluid_per_hour_ml: 500,
  sodium_per_hour_mg: 500,
  flat_pace_min_per_km: 6,
  pace_calibration_factor: 1.0,
  preferences: { gel_tolerance: 'medium', solid_food_tolerance: 'medium' },
  disabled_rule_ids: [],
  updated_at: 0,
};

function profileAdj(field: 'carbs_per_hour_g' | 'fluid_per_hour_ml' | 'sodium_per_hour_mg', value: number): PostRaceProposal {
  return {
    kind: 'profile_adjustment',
    field,
    current_value: 60,
    suggested_value: value,
    why: 'test',
    confidence: 0.9,
  };
}

describe('applyProposalToProfile', () => {
  test('applique un profile_adjustment dans les bornes → valeur exacte', async () => {
    const { db, calls } = makeMockDb();
    const updated = await applyProposalToProfile(db, PROFILE, profileAdj('carbs_per_hour_g', 70));
    expect(updated?.carbs_per_hour_g).toBe(70);
    expect(calls[0]?.carbs).toBe(70);
  });

  test('clamp défensif : carbs > 120 → 120', async () => {
    const { db } = makeMockDb();
    const updated = await applyProposalToProfile(db, PROFILE, profileAdj('carbs_per_hour_g', 200));
    expect(updated?.carbs_per_hour_g).toBe(120);
  });

  test('clamp défensif : carbs < 30 → 30', async () => {
    const { db } = makeMockDb();
    const updated = await applyProposalToProfile(db, PROFILE, profileAdj('carbs_per_hour_g', 10));
    expect(updated?.carbs_per_hour_g).toBe(30);
  });

  test('clamp fluid : > 1000 → 1000', async () => {
    const { db } = makeMockDb();
    const updated = await applyProposalToProfile(db, PROFILE, profileAdj('fluid_per_hour_ml', 1500));
    expect(updated?.fluid_per_hour_ml).toBe(1000);
  });

  test('clamp sodium : > 1500 → 1500', async () => {
    const { db } = makeMockDb();
    const updated = await applyProposalToProfile(db, PROFILE, profileAdj('sodium_per_hour_mg', 2500));
    expect(updated?.sodium_per_hour_mg).toBe(1500);
  });

  test('arrondi à l\'entier', async () => {
    const { db } = makeMockDb();
    const updated = await applyProposalToProfile(db, PROFILE, profileAdj('carbs_per_hour_g', 67.4));
    expect(updated?.carbs_per_hour_g).toBe(67);
  });

  test('race_note retourne null sans modifier le profil', async () => {
    const { db, calls } = makeMockDb();
    const result = await applyProposalToProfile(db, PROFILE, {
      kind: 'race_note',
      severity: 'info',
      observation: 'test',
      why: 'test',
      confidence: 0.8,
    });
    expect(result).toBeNull();
    expect(calls).toHaveLength(0);
  });

  test('kb_suggestion retourne null sans modifier le profil', async () => {
    const { db, calls } = makeMockDb();
    const result = await applyProposalToProfile(db, PROFILE, {
      kind: 'kb_suggestion',
      article_idea: 'test',
      why: 'test',
      confidence: 0.7,
    });
    expect(result).toBeNull();
    expect(calls).toHaveLength(0);
  });
});
