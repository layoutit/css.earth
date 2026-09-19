/**
 * Authored display levels for the image-to-target normalization of a simulation-guided fit.
 *
 * The black quantile is the lowest footprint luma the fit paints at all: the background sits just above it
 * and everything below becomes zero. With the long-standing 0.25 no other recipe value can reach a halo
 * that lives below the footprint's lower luma quartile, which truncates the outer halo of a body whose
 * light spans a wide dynamic range. The white quantile is the upper anchor and the gamma is the transfer
 * applied between them. Omitting the block keeps the long-standing 0.25 / 0.995 / 0.85 exactly.
 *
 * These are display levels on a relative image, not photometric calibration.
 */
export interface SimulationGuidedLevels {
  blackQuantile: number;
  whiteQuantile: number;
  gamma: number;
}

export const DEFAULT_SIMULATION_GUIDED_LEVELS: SimulationGuidedLevels =
  { blackQuantile: .25, whiteQuantile: .995, gamma: .85 };

export function parseSimulationGuidedLevels(value: unknown): SimulationGuidedLevels {
  if (value === undefined) return { ...DEFAULT_SIMULATION_GUIDED_LEVELS };
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('normalization must be an object of authored display levels.');
  const authored = value as Record<string, unknown>, levels = { ...DEFAULT_SIMULATION_GUIDED_LEVELS };
  for (const key of Object.keys(authored))
    if (!['blackQuantile', 'whiteQuantile', 'gamma'].includes(key))
      throw new TypeError(`Unknown authored normalization level: ${key}.`);
  for (const key of ['blackQuantile', 'whiteQuantile'] as const) {
    const quantile = authored[key];
    if (quantile === undefined) continue;
    if (typeof quantile !== 'number' || !Number.isFinite(quantile) || quantile < 0 || quantile > 1)
      throw new TypeError(`normalization ${key} must be a quantile in [0,1].`);
    levels[key] = quantile;
  }
  if (!(levels.blackQuantile < levels.whiteQuantile))
    throw new TypeError('normalization blackQuantile must be below whiteQuantile.');
  const gamma = authored.gamma;
  if (gamma !== undefined) {
    if (typeof gamma !== 'number' || !Number.isFinite(gamma) || gamma <= 0 || gamma > 4)
      throw new TypeError('normalization gamma must be in (0,4].');
    levels.gamma = gamma;
  }
  return levels;
}
