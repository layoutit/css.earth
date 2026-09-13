import type { SkyFrame, SkyRaster } from './registration.js';
import type { NativeRemoval } from '../../reconstruction/emission-inference/native-source.js';
import { validateImageWcs, type ImageWcs } from '../overlay-wcs.js';
export interface ObservationSource extends SkyRaster { id: string; label: string; url: string; page: string; sha256: string; credit: string; bands: string; termsUrl: string; registrationMode?: 'field-stars' | 'publisher-wcs' }
export interface ObservationRecipe { schema: 'cssearth-nebula-observation-recipe@1'; id: string; referenceId: string; frame: SkyFrame; images: ObservationSource[]; nativeRemoval: Omit<NativeRemoval, 'directory'> }
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Expected observation record.');
  return value as Record<string, unknown>;
};
const string = (value: unknown): string => { if (typeof value !== 'string' || !value) throw new TypeError('Expected non-empty text.'); return value; };
const finite = (value: unknown): number => { if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Expected finite coordinate.'); return value; };
const dimension = (value: unknown): number => { const n = finite(value); if (!Number.isInteger(n) || n < 1 || n > 50000) throw new TypeError('Invalid raster dimensions.'); return n; };
const pair = (value: unknown): [number, number] => { if (!Array.isArray(value) || value.length !== 2) throw new TypeError('Expected coordinate pair.'); return [finite(value[0]), finite(value[1])]; };
const id = (value: unknown) => { const s = string(value); if (!/^[a-z0-9-]+$/.test(s)) throw new TypeError('Invalid observation id.'); return s; };
const pin = (value: unknown) => { const s = string(value); if (!/^[0-9a-f]{64}$/.test(s)) throw new TypeError('Expected SHA-256.'); return s; };
const https = (value: unknown) => { const s = string(value); if (new URL(s).protocol !== 'https:') throw new TypeError('HTTPS source required.'); return s; };
function sky(value: Record<string, unknown>) {
  const result = { width: dimension(value.width), height: dimension(value.height), fieldArcminutes: pair(value.fieldArcminutes), centerIcrsDegrees: pair(value.centerIcrsDegrees) };
  // Wide official context mosaics reach several degrees. Independent star residuals
  // still determine whether the affine registration is adequate on that footprint.
  if (result.fieldArcminutes.some(n => n <= 0 || n > 360) || result.centerIcrsDegrees[0] < 0 || result.centerIcrsDegrees[0] >= 360 || Math.abs(result.centerIcrsDegrees[1]) > 90) throw new TypeError('Unsupported small-field sky frame.');
  return result;
}
export function readObservationRecipe(value: unknown): ObservationRecipe {
  const row = record(value), frame = record(row.frame), removal = record(row.nativeRemoval), model = record(removal.model);
  if (row.schema !== 'cssearth-nebula-observation-recipe@1' || frame.northUp !== true || !Array.isArray(row.images) || row.images.length < 2) throw new TypeError('Unsupported observation recipe.');
  const images = row.images.map((value): ObservationSource => {
    const image = record(value);
    const w = record(image.wcs);
    if ((w.projection !== 'TAN' && w.projection !== 'SIN') || w.coordinateFrame !== 'ICRS') throw new TypeError('ICRS TAN or ordinary SIN metadata required.');
    if (image.registrationMode !== undefined && image.registrationMode !== 'field-stars' && image.registrationMode !== 'publisher-wcs') throw new TypeError('Unknown registration mode.');
    const wcs: ImageWcs = { projection: w.projection, coordinateFrame: w.coordinateFrame, referenceDimension: pair(w.referenceDimension),
      referencePixel: pair(w.referencePixel), referenceValueDeg: pair(w.referenceValueDeg), scaleDeg: pair(w.scaleDeg), rotationDeg: finite(w.rotationDeg) };
    validateImageWcs(wcs);
    return { ...sky(image), wcs, id: id(image.id), label: string(image.label), url: https(image.url), page: https(image.page), sha256: pin(image.sha256),
      credit: string(image.credit), bands: string(image.bands), termsUrl: https(image.termsUrl), northRightDegrees: finite(image.northRightDegrees),
      ...(image.registrationMode === undefined ? {} : { registrationMode: image.registrationMode }) };
  });
  const referenceId = id(row.referenceId);
  if (new Set(images.map(image => image.id)).size !== images.length || !images.some(image => image.id === referenceId)) throw new TypeError('Observation ids/reference must be unique and present.');
  return { schema: row.schema, id: id(row.id), referenceId, frame: { ...sky(frame), northUp: true }, images,
    nativeRemoval: { scriptSha256: pin(removal.scriptSha256), model: { path: string(model.path), sha256: pin(model.sha256) } } };
}
