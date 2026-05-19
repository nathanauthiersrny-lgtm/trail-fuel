/**
 * Applique une proposition `profile_adjustment` acceptée sur le profil DB.
 *
 * Les propositions de type `race_note` et `kb_suggestion` ne modifient rien
 * (juste lues par l'user dans l'UI).
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import { updateProfile } from '../../db/repos/profile-repo';
import type { Profile } from '../../models/profile';
import type {
  PostRaceProposal,
  ProfileAdjustmentField,
} from './client';

export async function applyProposalToProfile(
  db: SQLiteDatabase,
  profile: Profile,
  proposal: PostRaceProposal,
): Promise<Profile | null> {
  if (proposal.kind !== 'profile_adjustment') return null;

  const updated: Profile = {
    ...profile,
    [proposal.field]: clampProposal(proposal.field, proposal.suggested_value),
  };
  return updateProfile(db, updated);
}

/**
 * Borne défensive : même si le LLM a ses garde-fous (≤ 20% delta), on
 * applique un clamp en sortie pour éviter qu'une réponse anormale flingue
 * le profil. Bornes physiologiques alignées avec src/engine/builder/constants.ts.
 */
function clampProposal(field: ProfileAdjustmentField, value: number): number {
  const ranges: Record<ProfileAdjustmentField, { min: number; max: number }> = {
    carbs_per_hour_g: { min: 30, max: 120 },
    fluid_per_hour_ml: { min: 300, max: 1000 },
    sodium_per_hour_mg: { min: 300, max: 1500 },
  };
  const { min, max } = ranges[field];
  return Math.round(Math.min(max, Math.max(min, value)));
}
