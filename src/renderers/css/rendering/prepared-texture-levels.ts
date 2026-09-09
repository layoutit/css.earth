/** Prepared addresses for one dataset; all levels share its retained geometry
 * and atlas coordinate system. Thresholds are CSS silhouette pixels, never DPR. */
export interface PreparedTextureLevels {
  hysteresis: number;
  levels: readonly { minimumDiameter: number; resources: Readonly<Record<string, string>> }[];
}

export function selectPreparedTextureLevel(levels: PreparedTextureLevels, diameter: number | null | undefined,
  previous: number | undefined, initial = false): number {
  if (initial) return 0;
  // An unavailable projection cannot justify substituting lower detail.
  if (diameter == null || !Number.isFinite(diameter)) return levels.levels.length - 1;
  let level = previous ?? 0;
  while (level + 1 < levels.levels.length && diameter >= levels.levels[level + 1].minimumDiameter) level++;
  while (level > 0 && diameter < levels.levels[level].minimumDiameter * (1 - levels.hysteresis)) level--;
  return level;
}
