/**
 * PostRaceAnalysis — résultat d'analyse Claude post-course (persisté avec la race).
 *
 * Stocké dans `races.post_race_analysis_json` via la migration 008. Mutable :
 * quand l'user accept/dismiss une proposition, on retire de la liste et on
 * persiste l'état restant pour éviter de re-payer un call sonnet à la
 * prochaine ouverture du summary.
 */

export type ProfileAdjustmentField =
  | 'carbs_per_hour_g'
  | 'fluid_per_hour_ml'
  | 'sodium_per_hour_mg';

export type PostRaceProposal =
  | {
      kind: 'profile_adjustment';
      why: string;
      confidence: number;
      field: ProfileAdjustmentField;
      current_value: number;
      suggested_value: number;
    }
  | {
      kind: 'race_note';
      why: string;
      confidence: number;
      severity: 'info' | 'warning';
      observation: string;
    }
  | {
      kind: 'kb_suggestion';
      why: string;
      confidence: number;
      article_idea: string;
    };

export type PostRaceAnalysis = {
  summary_fr: string;
  proposals: PostRaceProposal[];
  analyzed_at: number; // epoch ms
};
