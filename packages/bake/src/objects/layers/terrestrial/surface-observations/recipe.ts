/**
 * The surface-observation recipe: one dataset shape for every format.
 *
 * Every dataset declares its id, format, consumer group, metadata, frames, transfer limits, photometry and display. A mosaic
 * adds its selection and level matching. A format adds only its own frame inputs and dataset blocks. A key the format does not
 * declare is refused, so a misspelt field fails validation instead of being silently ignored.
 */
import { array, number, optional, shape, text } from '@cssearth/core';
import { MAXIMUM_OVERLAP_SAMPLES } from './levels.ts';
import { MAXIMUM_SEPARATION_FOOTPRINTS } from './limits.ts';
import { checkKeys } from '../../../raster/index.ts';

/** Keys every dataset has, and the two a mosaic adds. */
export const DATASET_KEYS = ['id', 'format', 'consumer', 'metadata', 'frames', 'transfer', 'photometry', 'display'] as const;
export const MOSAIC_KEYS = ['selection', 'levelMatching'] as const;
/** A dataset may name where the camera looks when the dataset opens. */
/** `reference` names the observation of the same body the registration stage measures the dataset against; without it the dataset's own frames are the reference. `refinement` names which of the stage's references may turn the cameras, and by how many degrees the others must agree. */
export const OPTIONAL_DATASET_KEYS = ['focus', 'reference', 'refinement'] as const;

export const safePath = (path: unknown): path is string => typeof path === 'string' && path.length > 0 && !path.startsWith('/') && !path.includes('\\') && !path.split('/').includes('..');
export const positive = (value: number | undefined): value is number => value !== undefined && Number.isFinite(value) && value > 0;
const identifier = /^[a-z][a-z0-9-]*$/;
/** A frame keeps its archive product id, such as Cassini n1506184171_1 or a Galileo SSI image number. */
const frameIdentifier = /^[a-z0-9][a-z0-9_-]*$/;


/** A display maps either a percentile range of the qualified values or one stated display range to display levels; a color product's bands share that range.
 * A monochrome dataset may present those levels through a palette of at least two hex colors instead of grey. `basis` says where the stretch comes from:
 * `authored` when a contributor chose it, `source` when a pinned input the dataset consumes states it, named by `sourceId`. */
export const parseDisplay = shape({ percentiles: optional(array(number)), displayRange: optional(array(number)), palette: optional(array(text)), basis: text, sourceId: optional(text) });
/** The stretch's basis as the policy and report carry it. */
export function displayBasis(display: DatasetDisplay): { basis: 'authored' | 'source'; sourceId?: string } {
  if (display.basis !== 'authored' && display.basis !== 'source') throw new TypeError('A display states its basis, authored or source.');
  return { basis: display.basis, ...(display.sourceId === undefined ? {} : { sourceId: display.sourceId }) };
}
const hexColor = /^#[0-9a-f]{6}$/;
export type DatasetDisplay = ReturnType<typeof parseDisplay>;

export interface DatasetEnvelope {
  id: string; consumer: string; metadata: { label?: string; coverage?: string }; frames: readonly { id: string }[]; selection?: string;
  levelMatching?: { maximumAngleDegrees?: number; minimumPairs: number; maximumGain: number; samplesPerTriangle?: number };
  display: DatasetDisplay;
}

/** What a format decides within the shared envelope. */
export interface EnvelopeRules {
  selections: readonly string[];
  displays: readonly ('percentiles' | 'displayRange')[];
  /** Whether the format's monochrome levels may carry an authored palette. */
  palette?: boolean;
  maximumFrames: number;
  maximumLevelGain: number;
  samplesPerTriangle: 'required' | 'optional';
}

/** The rules every format shares: identifiers, frames, a selection and level matching exactly when a dataset has several frames,
 * distinct safe input paths and one valid display. */
export function validateEnvelope(recipe: DatasetEnvelope, paths: readonly string[], rules: EnvelopeRules, context: string) {
  const { frames, levelMatching: levels, display } = recipe, mosaic = frames.length > 1;
  checkKeys(display, ['basis'], ['percentiles', 'displayRange', 'palette', 'sourceId'], `${context} display`);
  if (!(display.basis === 'authored' ? display.sourceId === undefined : display.basis === 'source' && typeof display.sourceId === 'string' && identifier.test(display.sourceId)))
    throw new TypeError(`Invalid source-bound ${context}: a display states its basis, authored or source, and only a source basis names its sourceId.`);
  if (display.palette !== undefined && (!rules.palette || !Array.isArray(display.palette) || display.palette.length < 2 || display.palette.some(color => !hexColor.test(color))))
    throw new TypeError(`Invalid source-bound ${context}: a display palette needs at least two #rrggbb colors on a monochrome dataset.`);
  if (levels) checkKeys(levels, ['minimumPairs', 'maximumGain'], ['maximumAngleDegrees', 'samplesPerTriangle'], `${context} level matching`);
  const range = display.percentiles ?? display.displayRange, kind = display.percentiles ? 'percentiles' : 'displayRange';
  if (!identifier.test(recipe.id) || !identifier.test(recipe.consumer) || !recipe.metadata?.label || !recipe.metadata?.coverage ||
      frames.length < 1 || frames.length > rules.maximumFrames || frames.some(frame => !frameIdentifier.test(frame.id)) || new Set(frames.map(frame => frame.id)).size !== frames.length ||
      !paths.every(safePath) || new Set(paths).size !== paths.length ||
      mosaic !== (recipe.selection !== undefined) || mosaic !== (levels !== undefined) || (recipe.selection !== undefined && !rules.selections.includes(recipe.selection)) ||
      (levels !== undefined && (!Number.isInteger(levels.minimumPairs) || levels.minimumPairs < 64 || levels.minimumPairs > 10000 ||
        !(levels.maximumGain >= 1 && levels.maximumGain <= rules.maximumLevelGain) ||
        (levels.samplesPerTriangle === undefined ? rules.samplesPerTriangle === 'required'
          : !Number.isInteger(levels.samplesPerTriangle) || levels.samplesPerTriangle < 4 || levels.samplesPerTriangle > MAXIMUM_OVERLAP_SAMPLES) ||
        (levels.maximumAngleDegrees !== undefined && (!positive(levels.maximumAngleDegrees) || levels.maximumAngleDegrees >= 90)))) ||
      (display.percentiles === undefined) === (display.displayRange === undefined) || !rules.displays.includes(kind) ||
      !Array.isArray(range) || range.length !== 2 || !range.every(Number.isFinite) || !(range[0] < range[1]) ||
      (kind === 'percentiles' && (range[0] < 0 || range[1] > 100))) throw new TypeError(`Invalid source-bound ${context}.`);
}

/** Transfer limits for a camera dataset on source-preserving terrain: one form of contributor separation, visibility within a metre and
 * emission below the horizon. */
export function validateTransfer(transfer: { maximumSeparationMeters?: number; maximumSeparationFootprints?: number; visibilityToleranceMeters: number; maximumEmissionDegrees: number },
  geometry: { simplification?: { method?: string; maximumErrorMeters: number } } | undefined, context: string) {
  checkKeys(transfer, ['visibilityToleranceMeters', 'maximumEmissionDegrees'], ['maximumSeparationMeters', 'maximumSeparationFootprints', 'interpretation'], `${context} transfer`);
  // The display mesh is the source mesh or a source-preserving simplification of it, so every closest source point lies on the displayed surface.
  if (!['source-meshoptimizer', 'source-mesh'].includes(geometry?.simplification?.method ?? '') ||
      !(transfer.maximumSeparationFootprints === undefined ? positive(transfer.maximumSeparationMeters)
        : transfer.maximumSeparationMeters === undefined && positive(transfer.maximumSeparationFootprints) && transfer.maximumSeparationFootprints <= MAXIMUM_SEPARATION_FOOTPRINTS) ||
      !positive(transfer.visibilityToleranceMeters) || transfer.visibilityToleranceMeters > 1 ||
      !positive(transfer.maximumEmissionDegrees) || transfer.maximumEmissionDegrees >= 90) throw new TypeError(`Invalid source-bound ${context}.`);
}
