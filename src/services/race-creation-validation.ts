import type { CreationStep, RaceCreationDraft } from './race-creation-store';

export function isStepValid(step: CreationStep, draft: RaceCreationDraft): boolean {
  switch (step) {
    case 1:
      return true;
    case 2:
      if (draft.gpx_track !== null) return true;
      return (
        draft.distance_km !== null &&
        draft.distance_km > 0 &&
        draft.estimated_duration_min !== null &&
        draft.estimated_duration_min > 0 &&
        draft.terrain_type !== null
      );
    case 3:
      return true;
    case 4:
      return draft.session_type !== null;
    case 5:
      return true;
    case 6:
      return true;
  }
}
