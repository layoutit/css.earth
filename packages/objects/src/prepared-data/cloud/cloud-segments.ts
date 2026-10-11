import { preparedBankColumn, type PreparedBank } from '../../prepared-bank.js';
import { parseDensityVolumeFrame, type DensityVolumeFrame } from '../../density-volume.js';
import { occluderAxesSpanSpace, type CloudPointEllipsoid } from './cloud-points.js';

/**
 * Cloud segments (`cssearth-cloud-segments@1`): straight lines in an object's frame, drawn a fixed number of pixels wide
 * (a model's wireframe, or a measured motion as an arrow from where something is to where it is going). A line is dimmed
 * where the object's body (its occluder, as in cloud-points.ts) stands between it and the eye. A bank at
 * `prepared/<id>.bin` beside an image-layer bank, named by one of its datasets (`properties.overlays`).
 */
export const PREPARED_CLOUD_SEGMENTS_SCHEMA = 'cssearth-cloud-segments@1';
export interface PreparedCloudSegments {
  readonly id: string;
  readonly frame: DensityVolumeFrame;
  readonly count: number;
  /** Each line's start and end x, y and z, in the bank's units. */
  readonly from: Float64Array;
  readonly to: Float64Array;
  /** Each line's red, green, blue and opacity, 0 to 255. */
  readonly rgba: Uint8Array;
  /** 1 where a line ends in an arrowhead at its end, 0 where it does not. */
  readonly heads: Uint8Array;
  /** Every line's width on screen, in CSS pixels. */
  readonly widthPixels: number;
  readonly occluder: readonly CloudPointEllipsoid[];
  /** A caption drawn at a place in the bank's units: what the lines are (a model's name). */
  readonly label?: { readonly text: string; readonly atUnits: readonly [number, number, number] };
}

export function encodeCloudSegments(lines: PreparedCloudSegments): PreparedBank {
  return { schema: PREPARED_CLOUD_SEGMENTS_SCHEMA, fields: { id: lines.id, frame: lines.frame, count: lines.count, widthPixels: lines.widthPixels, occluder: lines.occluder, ...(lines.label ? { label: lines.label } : {}) },
    columns: { from: lines.from, to: lines.to, rgba: lines.rgba, head: lines.heads } };
}

const vector = (value: unknown): value is [number, number, number] => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);

/** A fetched bank, checked: its frame, finite ends for every line, a positive width and well-formed ellipsoids. */
export function readCloudSegments(bank: PreparedBank, at = 'cloud segments'): PreparedCloudSegments {
  if (bank.schema !== PREPARED_CLOUD_SEGMENTS_SCHEMA) throw new TypeError(`${at}: expected ${PREPARED_CLOUD_SEGMENTS_SCHEMA}, got ${bank.schema}.`);
  const { id, frame, count, widthPixels, occluder, label } = bank.fields as { id?: unknown; frame?: unknown; count?: unknown; widthPixels?: unknown; occluder?: unknown; label?: unknown };
  if (typeof id !== 'string' || !/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError(`${at}: its id is a bank id, got ${JSON.stringify(id ?? null)}.`);
  if (!Number.isSafeInteger(count) || (count as number) < 0) throw new TypeError(`${at}: count is a count, got ${JSON.stringify(count ?? null)}.`);
  if (typeof widthPixels !== 'number' || !(widthPixels > 0) || !Number.isFinite(widthPixels)) throw new TypeError(`${at}: widthPixels is a positive width, got ${JSON.stringify(widthPixels ?? null)}.`);
  const n = count as number, from = preparedBankColumn(bank, 'from', 'f64', n * 3, at) as Float64Array, to = preparedBankColumn(bank, 'to', 'f64', n * 3, at) as Float64Array;
  const rgba = preparedBankColumn(bank, 'rgba', 'u8', n * 4, at) as Uint8Array, heads = preparedBankColumn(bank, 'head', 'u8', n, at) as Uint8Array;
  if (from.some(value => !Number.isFinite(value)) || to.some(value => !Number.isFinite(value))) throw new TypeError(`${at}: every line has finite ends.`);
  if (heads.some(value => value > 1)) throw new TypeError(`${at}: head is 0 or 1.`);
  if (!Array.isArray(occluder) || !occluder.every(e => e && typeof e === 'object' && vector((e as CloudPointEllipsoid).centreUnits) &&
    Array.isArray((e as CloudPointEllipsoid).axesUnits) && (e as CloudPointEllipsoid).axesUnits.length === 3 && (e as CloudPointEllipsoid).axesUnits.every(vector) && occluderAxesSpanSpace((e as CloudPointEllipsoid).axesUnits)))
    throw new TypeError(`${at}: occluder is a list of ellipsoids, each a centre and three axes that span space.`);
  if (label !== undefined && !(label && typeof label === 'object' && typeof (label as { text?: unknown }).text === 'string' && (label as { text: string }).text.length > 0 && vector((label as { atUnits?: unknown }).atUnits)))
    throw new TypeError(`${at}: label is a text and a place.`);
  return { id, frame: parseDensityVolumeFrame(frame), count: n, from, to, rgba, heads, widthPixels, occluder: occluder as CloudPointEllipsoid[],
    ...(label ? { label: label as { text: string; atUnits: [number, number, number] } } : {}) };
}
