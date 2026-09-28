import { sha256 } from '@cssearth/core/node';
import { readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { writeArrayBuffer } from 'geotiff';

type RecordValue = Record<string, unknown>;
type Grid = number[][];
type Selection = { id: string; kind: 'posterior'; field: string; statistic: 'median' | 'interval-width' }
  | { id: string; kind: 'ratio'; numeratorMicrons: number; denominatorMicrons: number };
export interface MappedCompositionRecipe {
  schema: 'cssearth-mapped-composition@1';
  target: string;
  referenceRadiusMeters: number;
  input: string;
  observationName: string;
  selections: Selection[];
}
const record = (value: unknown): RecordValue => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Expected mapped composition record.');
  return value as RecordValue;
};
function text(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new TypeError('Expected mapped composition text.');
  return value;
}
function positive(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new TypeError('Expected positive mapped composition number.');
  return value;
}
function contained(root: string, path: string): string {
  const result = resolve(root, path), offset = relative(root, result);
  if (offset === '..' || offset.startsWith('../') || path.startsWith('/')) throw new TypeError('Mapped composition path escapes source root.');
  return result;
}
export function parseMappedCompositionRecipe(value: unknown): MappedCompositionRecipe {
  const r = record(value);
  if (r.schema !== 'cssearth-mapped-composition@1' || !Array.isArray(r.selections) || !r.selections.length)
    throw new TypeError('Invalid mapped composition recipe.');
  const selections = r.selections.map((raw): Selection => {
    const s = record(raw), id = text(s.id);
    if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new TypeError('Invalid mapped composition product ID.');
    if (s.kind === 'posterior' && (s.statistic === 'median' || s.statistic === 'interval-width'))
      return { id, kind: s.kind, field: text(s.field), statistic: s.statistic };
    if (s.kind === 'ratio') return { id, kind: s.kind, numeratorMicrons: positive(s.numeratorMicrons), denominatorMicrons: positive(s.denominatorMicrons) };
    throw new TypeError('Unknown mapped composition selection.');
  });
  if (new Set(selections.map(s => s.id)).size !== selections.length) throw new TypeError('Duplicate mapped composition product.');
  const input = text(r.input);
  contained('.', input);
  return { schema: r.schema, target: text(r.target), referenceRadiusMeters: positive(r.referenceRadiusMeters),
    input, observationName: text(r.observationName), selections };
}
function nodes(value: unknown, first: number, length: number): void {
  if (!Array.isArray(value) || value.length !== length || value.some((v, i) => v !== first + i))
    throw new TypeError('Native one-degree coordinate nodes changed.');
}
function grid(value: unknown): Grid {
  if (!Array.isArray(value) || value.length !== 180) throw new TypeError('Expected 180 latitude rows.');
  return value.map(row => {
    if (!Array.isArray(row) || row.length !== 360) throw new TypeError('Expected 360 longitude columns.');
    return row.map(v => {
      if (typeof v !== 'number' || !Number.isFinite(v)) throw new TypeError('Non-numeric native sample.');
      return v;
    });
  });
}

/** Preserve the author's angular nodes. The repeated 180-E column is a periodic
 * boundary sample, not interpolation or additional coverage. North stays up;
 * source zero and missing (-99) remain different values. */
export function encodeCompositionGrid(source: Grid, radius: number): Uint8Array {
  const values = new Float32Array(361 * 180);
  for (let y = 0; y < 180; y++) for (let x = 0; x < 361; x++)
    values[y * 361 + x] = source[179 - y][(x + 180) % 360];
  return new Uint8Array(writeArrayBuffer(values, {
    width: 361, height: 180, SamplesPerPixel: 1, PhotometricInterpretation: 1,
    GTModelTypeGeoKey: 2, GeographicTypeGeoKey: 32767,
    BitsPerSample: [32], SampleFormat: [3], GDAL_NODATA: '-99',
    ModelPixelScale: [1, 1, 0], ModelTiepoint: [0, 0, 0, -180.5, 89.5, 0],
    GeoDoubleParams: [radius],
    GeoKeyDirectory: [1, 1, 0, 6, 1024, 0, 1, 2, 1025, 0, 1, 1, 2054, 0, 1, 9102,
      2057, 34736, 1, 0, 2058, 34736, 1, 0, 2061, 0, 1, 0],
  }));
}
export function convertMappedComposition(bytes: Uint8Array, recipe: MappedCompositionRecipe) {
  const document = record(JSON.parse(gunzipSync(bytes).toString('utf8'))), metadata = record(document.metadata);
  if (metadata.target !== recipe.target || metadata.observation_name !== recipe.observationName || metadata.nan_value !== -99)
    throw new TypeError('Mapped composition source identity changed.');
  nodes(metadata.latitudes, -90, 180); nodes(metadata.longitudes, 0, 360);
  const products: Record<string, Uint8Array> = {}, reports: Record<string, unknown> = {};
  for (const selection of recipe.selections) {
    let values: Grid;
    if (selection.kind === 'posterior') {
      const median = grid(record(document.best_estimate_abundance)[selection.field]);
      const lower = grid(record(document.lower_bound_abundance)[selection.field]);
      const upper = grid(record(document.upper_bound_abundance)[selection.field]);
      values = median.map((row, y) => row.map((m, x) => {
        const l = lower[y][x], u = upper[y][x];
        if (m === -99 && l === -99 && u === -99) return -99;
        if (!(0 <= l && l <= m && m <= u && u <= 1)) throw new TypeError('Posterior masks, fractions or interval ordering disagree.');
        return selection.statistic === 'median' ? m : u - l;
      }));
    } else {
      if (!Array.isArray(metadata.wavelengths) || !Array.isArray(document.cube)) throw new TypeError('Missing reflectance wavelength axis.');
      const wavelengthIndex = (w: number) => {
        const indices = metadata.wavelengths;
        if (!Array.isArray(indices)) throw new TypeError('Missing wavelength axis.');
        const found = indices.indexOf(w);
        if (found < 0 || indices.lastIndexOf(w) !== found) throw new TypeError('Exact selected wavelength is absent or duplicated.');
        return found;
      };
      const numerator = grid(document.cube[wavelengthIndex(selection.numeratorMicrons)]);
      const denominator = grid(document.cube[wavelengthIndex(selection.denominatorMicrons)]);
      values = numerator.map((row, y) => row.map((n, x) => {
        const d = denominator[y][x];
        if (n === -99 || d === -99 || d === 0) return -99;
        if (n < 0 || d < 0) throw new TypeError('Unexpected negative reflectance.');
        return n / d;
      }));
    }
    const retained = values.flat().filter(v => v !== -99);
    if (!retained.length) throw new TypeError('Selected map has no valid samples.');
    const encoded = encodeCompositionGrid(values, recipe.referenceRadiusMeters);
    products[selection.id] = encoded;
    reports[selection.id] = { selection, validNativeNodes: retained.length, missingNativeNodes: 180 * 360 - retained.length,
      minimum: Math.min(...retained), maximum: Math.max(...retained), outputBytes: encoded.byteLength, outputSha256: sha256(encoded) };
  }
  const { latitudes, longitudes, ...sourceMetadata } = metadata;
  return { products, report: { schema: 'cssearth-mapped-composition-conversion@1', target: recipe.target,
    source: { path: recipe.input, sha256: sha256(bytes), bytes: bytes.byteLength, metadata: sourceMetadata },
    grid: { width: 361, height: 180, coordinates: 'degrees', centerLongitude: 0, referenceRadiusMeters: recipe.referenceRadiusMeters,
      origin: [-180.5, 89.5], resolution: [1, -1], wrapLongitude: true, noData: -99 },
    processing: 'Reverse latitude rows, reorder east-positive longitude nodes, repeat the periodic seam column, round values to float32. No spatial smoothing, gap fill or fitted abundance aggregation.',
    products: reports } };
}
export async function prepareMappedComposition(sourceRoot: string, recipePath: string) {
  const recipe = parseMappedCompositionRecipe(JSON.parse(await readFile(contained(sourceRoot, recipePath), 'utf8')));
  return convertMappedComposition(await readFile(contained(sourceRoot, recipe.input)), recipe);
}
