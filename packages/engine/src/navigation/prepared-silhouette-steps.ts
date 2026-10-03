/** A prepared custom property value chosen by the published silhouette diameter.
 * Thresholds are CSS silhouette pixels, never DPR; each value is prepared text. */

/** Move from `previous` to the level whose threshold the diameter has reached.
 * A level is kept until the diameter falls below its threshold by `hysteresis`. */
export function walkSilhouetteLevels(levels: readonly { minimumDiameter: number }[], hysteresis: number, diameter: number, previous = 0): number {
  let level = Math.min(Math.max(previous, 0), levels.length - 1);
  while (level + 1 < levels.length && diameter >= levels[level + 1].minimumDiameter) level++;
  while (level > 0 && diameter < levels[level].minimumDiameter * (1 - hysteresis)) level--;
  return level;
}
