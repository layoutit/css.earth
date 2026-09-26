/** A prepared custom property value chosen by the published silhouette diameter.
 * Thresholds are CSS silhouette pixels, never DPR; each value is prepared text. */
export interface PreparedSilhouetteSteps {
  hysteresis: number;
  levels: readonly { minimumDiameter: number; value: string }[];
}

/** Move from `previous` to the level whose threshold the diameter has reached.
 * A level is kept until the diameter falls below its threshold by `hysteresis`. */
export function walkSilhouetteLevels(levels: readonly { minimumDiameter: number }[], hysteresis: number, diameter: number, previous = 0): number {
  let level = Math.min(Math.max(previous, 0), levels.length - 1);
  while (level + 1 < levels.length && diameter >= levels[level + 1].minimumDiameter) level++;
  while (level > 0 && diameter < levels[level].minimumDiameter * (1 - hysteresis)) level--;
  return level;
}

/** An unavailable projection keeps the published step; before the first step the prepared value stands. */
export function selectPreparedSilhouetteStep(steps: PreparedSilhouetteSteps, diameter: number | null | undefined, previous: number | undefined): number | undefined {
  if (diameter == null || !Number.isFinite(diameter)) return previous;
  return walkSilhouetteLevels(steps.levels, steps.hysteresis, diameter, previous);
}
