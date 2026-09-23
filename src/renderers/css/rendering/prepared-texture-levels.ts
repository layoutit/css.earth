import { walkSilhouetteLevels } from './prepared-silhouette-steps.js';

/** Prepared addresses for one dataset; all levels share its retained geometry
 * and atlas coordinate system. Thresholds are CSS silhouette pixels, never DPR. */
export interface PreparedTextureLevels {
  hysteresis: number;
  fixedLevel?: number;
  levels: readonly { minimumDiameter: number; resources: Readonly<Record<string, string>> }[];
}

export function selectPreparedTextureLevel(levels: PreparedTextureLevels, diameter: number | null | undefined,
  previous: number | undefined, initial = false): number {
  // The first pass matches the prepared bank the page already shows, so readiness never waits for refinement.
  if (initial) return 0;
  if (levels.fixedLevel !== undefined) return levels.fixedLevel;
  // An unavailable projection cannot justify substituting lower detail.
  if (diameter == null || !Number.isFinite(diameter)) return levels.levels.length - 1;
  return walkSilhouetteLevels(levels.levels, levels.hysteresis, diameter, previous);
}
