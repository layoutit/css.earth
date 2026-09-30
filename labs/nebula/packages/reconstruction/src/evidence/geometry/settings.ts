/** Shared bounded settings for explicit offline geometric detection. */
export interface DetectionSettings {
  iterations: number; seed: number; minRadiusFraction: number; maxCandidates: number; sensitivity: number;
}
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
function bounded(value: unknown, fallback: number, name: string, min: number, max: number, integer = false): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)))
    throw new TypeError(`Detection ${name} must be ${integer ? 'an integer ' : ''}between ${min} and ${max}.`);
  return value;
}
export function readDetectionSettings(value: unknown = {}): DetectionSettings {
  if (!record(value) || Object.keys(value).some(key => !['iterations', 'seed', 'minRadiusFraction', 'maxCandidates', 'sensitivity'].includes(key)))
    throw new TypeError('Invalid or unknown geometry detection settings.');
  return { iterations: bounded(value.iterations, 24000, 'iterations', 100, 200_000, true),
    seed: bounded(value.seed, 7293, 'seed', 0, 0xffffffff, true),
    minRadiusFraction: bounded(value.minRadiusFraction, .07, 'minimum radius fraction', .02, .4),
    maxCandidates: bounded(value.maxCandidates, 12, 'maximum shapes', 1, 32, true),
    sensitivity: bounded(value.sensitivity, 1, 'sensitivity', .25, 4) };
}
