import { walkSilhouetteLevels } from '@cssearth/objects';
import { type PreparedSilhouetteSteps } from '@cssearth/objects';

/** An unavailable projection keeps the published step; before the first step the prepared value stands. */
export function selectPreparedSilhouetteStep(steps: PreparedSilhouetteSteps, diameter: number | null | undefined, previous: number | undefined): number | undefined {
  if (diameter == null || !Number.isFinite(diameter)) return previous;
  return walkSilhouetteLevels(steps.levels, steps.hysteresis, diameter, previous);
}
