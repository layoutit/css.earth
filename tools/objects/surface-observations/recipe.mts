/**
 * The surface-observation recipe: one lens shape for every format.
 *
 * Every lens declares its id, format, consumer group, metadata, frames, transfer limits, photometry and display. A mosaic
 * adds its selection and level matching. A format adds only its own frame inputs and lens blocks. A key the format does not
 * declare is refused, so a misspelt field fails validation instead of being silently ignored.
 */
import { requireRecord } from '../../source-values.mts';
import { array, number, optional, shape } from '../terrestrial-layers/source-records.mts';
import { MAXIMUM_SEPARATION_FOOTPRINTS } from './limits.mts';

/** Keys every lens has, and the two a mosaic adds. */
export const LENS_KEYS = ['id', 'format', 'consumer', 'metadata', 'frames', 'transfer', 'photometry', 'display'] as const;
export const MOSAIC_KEYS = ['selection', 'levelMatching'] as const;

export const safePath = (path: unknown): path is string => typeof path === 'string' && path.length > 0 && !path.startsWith('/') && !path.includes('\\') && !path.split('/').includes('..');
export const positive = (value: number | undefined): value is number => value !== undefined && Number.isFinite(value) && value > 0;
const identifier = /^[a-z][a-z0-9-]*$/;

/** Refuse keys a format does not declare, and require the ones it must have. */
export function checkKeys(value: unknown, required: readonly string[], allowed: readonly string[], context: string) {
  const record = requireRecord(value), keys = Object.keys(record);
  const unknown = keys.filter(key => !required.includes(key) && !allowed.includes(key)), missing = required.filter(key => record[key] === undefined);
  if (unknown.length || missing.length) throw new TypeError(`Invalid source-bound ${context}: ${[...unknown.map(key => `unknown ${key}`), ...missing.map(key => `missing ${key}`)].join(', ')}.`);
}

/** A display maps either a percentile range of the qualified values or one authored linear range to grey levels. */
export const parseDisplay = shape({ percentiles: optional(array(number)), linear: optional(array(number)) });
export type LensDisplay = ReturnType<typeof parseDisplay>;

export interface LensEnvelope {
  id: string; consumer: string; metadata: { label?: string; coverage?: string }; frames: readonly { id: string }[]; selection?: string;
  levelMatching?: { maximumAngleDegrees?: number; minimumPairs: number; maximumLogMad: number; maximumGain: number; samplesPerTriangle?: number };
  display: LensDisplay;
}

/** What a format decides within the shared envelope. */
export interface EnvelopeRules {
  selections: readonly string[];
  displays: readonly ('percentiles' | 'linear')[];
  maximumFrames: number;
  maximumLevelGain: number;
  samplesPerTriangle: 'required' | 'optional';
}

/** The rules every format shares: identifiers, frames, a selection and level matching exactly when a lens has several frames,
 * distinct safe input paths and one valid display. */
export function validateEnvelope(recipe: LensEnvelope, paths: readonly string[], rules: EnvelopeRules, context: string) {
  const { frames, levelMatching: levels, display } = recipe, mosaic = frames.length > 1;
  checkKeys(display, [], ['percentiles', 'linear'], `${context} display`);
  if (levels) checkKeys(levels, ['minimumPairs', 'maximumLogMad', 'maximumGain'], ['maximumAngleDegrees', 'samplesPerTriangle'], `${context} level matching`);
  const range = display.percentiles ?? display.linear, kind = display.percentiles ? 'percentiles' : 'linear';
  if (!identifier.test(recipe.id) || !identifier.test(recipe.consumer) || !recipe.metadata?.label || !recipe.metadata?.coverage ||
      frames.length < 1 || frames.length > rules.maximumFrames || frames.some(frame => !identifier.test(frame.id)) || new Set(frames.map(frame => frame.id)).size !== frames.length ||
      !paths.every(safePath) || new Set(paths).size !== paths.length ||
      mosaic !== (recipe.selection !== undefined) || mosaic !== (levels !== undefined) || (recipe.selection !== undefined && !rules.selections.includes(recipe.selection)) ||
      (levels !== undefined && (!Number.isInteger(levels.minimumPairs) || levels.minimumPairs < 64 || levels.minimumPairs > 10000 ||
        !positive(levels.maximumLogMad) || levels.maximumLogMad > .3 || !(levels.maximumGain >= 1 && levels.maximumGain <= rules.maximumLevelGain) ||
        (levels.samplesPerTriangle === undefined ? rules.samplesPerTriangle === 'required'
          : !Number.isInteger(levels.samplesPerTriangle) || levels.samplesPerTriangle < 4 || levels.samplesPerTriangle > 64) ||
        (levels.maximumAngleDegrees !== undefined && (!positive(levels.maximumAngleDegrees) || levels.maximumAngleDegrees >= 90)))) ||
      (display.percentiles === undefined) === (display.linear === undefined) || !rules.displays.includes(kind) ||
      !Array.isArray(range) || range.length !== 2 || !range.every(Number.isFinite) || !(range[0] < range[1]) ||
      (kind === 'percentiles' && (range[0] < 0 || range[1] > 100))) throw new TypeError(`Invalid source-bound ${context}.`);
}

/** Transfer limits for a camera lens: source distance within the mesh error, one form of contributor separation, visibility within a metre
 * and emission below the horizon. */
export function validateTransfer(transfer: { maximumSourceDistanceMeters: number; maximumSeparationMeters?: number; maximumSeparationFootprints?: number; visibilityToleranceMeters: number; maximumEmissionDegrees: number },
  geometry: { simplification?: { method?: string; maximumErrorMeters: number } } | undefined, context: string) {
  checkKeys(transfer, ['maximumSourceDistanceMeters', 'visibilityToleranceMeters', 'maximumEmissionDegrees'], ['maximumSeparationMeters', 'maximumSeparationFootprints', 'interpretation'], `${context} transfer`);
  if (geometry?.simplification?.method !== 'source-meshoptimizer' ||
      !positive(transfer.maximumSourceDistanceMeters) || transfer.maximumSourceDistanceMeters > geometry.simplification.maximumErrorMeters ||
      !(transfer.maximumSeparationFootprints === undefined ? positive(transfer.maximumSeparationMeters)
        : transfer.maximumSeparationMeters === undefined && positive(transfer.maximumSeparationFootprints) && transfer.maximumSeparationFootprints <= MAXIMUM_SEPARATION_FOOTPRINTS) ||
      !positive(transfer.visibilityToleranceMeters) || transfer.visibilityToleranceMeters > 1 ||
      !positive(transfer.maximumEmissionDegrees) || transfer.maximumEmissionDegrees >= 90) throw new TypeError(`Invalid source-bound ${context}.`);
}
