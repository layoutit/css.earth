import type { Affine, SkyFrame, SkyRaster } from '@cssearth/nebula-reconstruction/registration/stellar';
import type { NativeRemoval } from '../../server/workflows/emission-inference/native-source.ts';
import { validateImageWcs, type ImageWcs } from '@cssearth/volume-core/coordinates/overlay-wcs';
import { skyBandCompositeFile } from '../../adapters/sources/sky-bands.ts';
export interface ObservationSource extends SkyRaster {
  id: string; label: string; url: string; page: string; credit: string; bands: string; termsUrl: string;
  registrationMode?: 'field-stars' | 'compact-stars' | 'publisher-wcs';
  registrationDetection?: { sourceMaximum: number; referenceMaximum: number; maximumStars: number };
  compactStarChannel?: 'minimum-rgb' | 'maximum-rgb';
  processingRole?: 'registration-reference';
  stellarTreatment?: 'preserve';
  coordinateOrigin?: 'authored-bright-star-seed';
  matchedStarCatalogue?: { path: string };
  astrometricCalibration?: { path: string };
  registrationTransfer?: { referenceId: string; pixelToReference: Affine; evidence: { path: string } };
  /** Working raster composed from pinned calibrated survey bands; `url` then names the survey page. */
  skyBands?: { path: string };
}
export interface ObservationRecipe { schema: 'cssearth-nebula-observation-recipe@1'; id: string; referenceId: string; frame: SkyFrame; images: ObservationSource[]; nativeRemoval: Omit<NativeRemoval, 'directory'>;
  nativeSeparationCache?: { recipe: { path: string } } }
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Expected observation record.');
  return value as Record<string, unknown>;
};
const string = (value: unknown): string => { if (typeof value !== 'string' || !value) throw new TypeError('Expected non-empty text.'); return value; };
const finite = (value: unknown): number => { if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Expected finite coordinate.'); return value; };
const dimension = (value: unknown): number => { const n = finite(value); if (!Number.isInteger(n) || n < 1 || n > 50000) throw new TypeError('Invalid raster dimensions.'); return n; };
const pair = (value: unknown): [number, number] => { if (!Array.isArray(value) || value.length !== 2) throw new TypeError('Expected coordinate pair.'); return [finite(value[0]), finite(value[1])]; };
const id = (value: unknown) => { const s = string(value); if (!/^[a-z0-9-]+$/.test(s)) throw new TypeError('Invalid observation id.'); return s; };
const https = (value: unknown) => { const s = string(value); if (new URL(s).protocol !== 'https:') throw new TypeError('HTTPS source required.'); return s; };
function transfer(value: unknown): NonNullable<ObservationSource['registrationTransfer']> {
  const row = record(value), evidence = record(row.evidence), m = row.pixelToReference;
  if (!Array.isArray(m) || m.length !== 6) throw new TypeError('Expected transfer affine.');
  const matrix: Affine = [finite(m[0]), finite(m[1]), finite(m[2]), finite(m[3]), finite(m[4]), finite(m[5])];
  if (Math.abs(matrix[0] * matrix[3] - matrix[1] * matrix[2]) < 1e-12) throw new TypeError('Singular registration transfer.');
  const path = string(evidence.path);
  if (path.startsWith('/') || path.split('/').includes('..')) throw new TypeError('Transfer evidence requires a repository-relative path.');
  return { referenceId: id(row.referenceId), pixelToReference: matrix, evidence: { path } };
}
/** Cached working raster name: publisher downloads keep `<id>.tif`; composed sky band rasters get their own name, so an
 * existing checkout's retired publisher file is never read as, or overwritten by, the composite. */
export const observationSourceFile = (source: Pick<ObservationSource, 'id' | 'skyBands'>) =>
  source.skyBands ? skyBandCompositeFile(source.id) : `${source.id}.tif`;
export const scienceObservationSources = (recipe: ObservationRecipe): ObservationSource[] => recipe.images.filter(image => image.processingRole !== 'registration-reference');
function sky(value: Record<string, unknown>) {
  const result = { width: dimension(value.width), height: dimension(value.height), fieldArcminutes: pair(value.fieldArcminutes), centerIcrsDegrees: pair(value.centerIcrsDegrees) };
  // Wide official context mosaics reach several degrees. Independent star residuals
  // still determine whether the affine registration is adequate on that footprint.
  if (result.fieldArcminutes.some(n => n <= 0 || n > 600) || result.centerIcrsDegrees[0] < 0 || result.centerIcrsDegrees[0] >= 360 || Math.abs(result.centerIcrsDegrees[1]) > 90) throw new TypeError('Unsupported small-field sky frame.');
  return result;
}
export function readObservationRecipe(value: unknown): ObservationRecipe {
  const row = record(value), frame = record(row.frame), removal = record(row.nativeRemoval), model = record(removal.model);
  let nativeSeparationCache: ObservationRecipe['nativeSeparationCache'];
  if (row.nativeSeparationCache !== undefined) {
    const cache = record(row.nativeSeparationCache), recipe = record(cache.recipe), path = string(recipe.path);
    if (path.startsWith('/') || path.split('/').includes('..')) throw new TypeError('Native separation cache requires a repository-relative recipe.');
    nativeSeparationCache = { recipe: { path } };
  }
  if (row.schema !== 'cssearth-nebula-observation-recipe@1' || frame.northUp !== true || !Array.isArray(row.images) || row.images.length < 2) throw new TypeError('Unsupported observation recipe.');
  const images = row.images.map((value): ObservationSource => {
    const image = record(value);
    const w = record(image.wcs);
    if ((w.projection !== 'TAN' && w.projection !== 'SIN') || w.coordinateFrame !== 'ICRS') throw new TypeError('ICRS TAN or ordinary SIN metadata required.');
    if (image.registrationMode !== undefined && image.registrationMode !== 'field-stars' && image.registrationMode !== 'compact-stars' && image.registrationMode !== 'publisher-wcs') throw new TypeError('Unknown registration mode.');
    if (image.compactStarChannel !== undefined && image.compactStarChannel !== 'minimum-rgb' && image.compactStarChannel !== 'maximum-rgb') throw new TypeError('Unknown compact-star channel.');
    if (image.processingRole !== undefined && image.processingRole !== 'registration-reference') throw new TypeError('Unknown observation processing role.');
    if (image.stellarTreatment !== undefined && image.stellarTreatment !== 'preserve') throw new TypeError('Unknown stellar treatment.');
    if (image.coordinateOrigin !== undefined && image.coordinateOrigin !== 'authored-bright-star-seed') throw new TypeError('Unknown coordinate origin.');
    let registrationDetection: ObservationSource['registrationDetection'];
    if (image.registrationDetection !== undefined) {
      const settings = record(image.registrationDetection);
      const bounded = (value: unknown, maximum: number) => {
        const n = finite(value);
        if (!Number.isInteger(n) || n < 64 || n > maximum) throw new TypeError('Registration detection setting outside its bounded range.');
        return n;
      };
      if (image.registrationMode && image.registrationMode !== 'field-stars' || image.matchedStarCatalogue || image.registrationTransfer) throw new TypeError('Registration detection settings require direct field-star discovery.');
      registrationDetection = { sourceMaximum: bounded(settings.sourceMaximum, 16384), referenceMaximum: bounded(settings.referenceMaximum, 16384), maximumStars: bounded(settings.maximumStars, 20000) };
    }
    let matchedStarCatalogue: ObservationSource['matchedStarCatalogue'];
    if (image.matchedStarCatalogue !== undefined) {
      const catalogue = record(image.matchedStarCatalogue), path = string(catalogue.path);
      if (path.startsWith('/') || path.split('/').includes('..')) throw new TypeError('Star catalogue requires a repository-relative path.');
      matchedStarCatalogue = { path };
    }
    let astrometricCalibration: ObservationSource['astrometricCalibration'];
    if (image.astrometricCalibration !== undefined) {
      const calibration = record(image.astrometricCalibration), path = string(calibration.path);
      if (path.startsWith('/') || path.split('/').includes('..') || !matchedStarCatalogue) throw new TypeError('Astrometric calibration requires pinned explicit stars and a relative evidence path.');
      astrometricCalibration = { path };
    }
    let skyBands: ObservationSource['skyBands'];
    if (image.skyBands !== undefined) {
      const bands = record(image.skyBands), path = string(bands.path);
      if (path.startsWith('/') || path.split('/').includes('..') || !path.endsWith('.json') || image.matchedStarCatalogue || image.registrationTransfer)
        throw new TypeError('Sky band sources need a repository-relative recipe and direct registration.');
      skyBands = { path };
    }
    const wcs: ImageWcs = { projection: w.projection, coordinateFrame: w.coordinateFrame, referenceDimension: pair(w.referenceDimension),
      referencePixel: pair(w.referencePixel), referenceValueDeg: pair(w.referenceValueDeg), scaleDeg: pair(w.scaleDeg), rotationDeg: finite(w.rotationDeg) };
    validateImageWcs(wcs);
    return { ...sky(image), wcs, id: id(image.id), label: string(image.label), url: https(image.url), page: https(image.page),
      credit: string(image.credit), bands: string(image.bands), termsUrl: https(image.termsUrl), northRightDegrees: finite(image.northRightDegrees),
      ...(image.registrationMode === undefined ? {} : { registrationMode: image.registrationMode }),
      ...(registrationDetection === undefined ? {} : { registrationDetection }),
      ...(image.compactStarChannel === undefined ? {} : { compactStarChannel: image.compactStarChannel }),
      ...(image.processingRole === undefined ? {} : { processingRole: image.processingRole }),
      ...(image.stellarTreatment === undefined ? {} : { stellarTreatment: image.stellarTreatment }),
      ...(image.coordinateOrigin === undefined ? {} : { coordinateOrigin: image.coordinateOrigin }),
      ...(matchedStarCatalogue === undefined ? {} : { matchedStarCatalogue }),
      ...(astrometricCalibration === undefined ? {} : { astrometricCalibration }),
      ...(image.registrationTransfer === undefined ? {} : { registrationTransfer: transfer(image.registrationTransfer) }),
      ...(skyBands === undefined ? {} : { skyBands }) };
  });
  const referenceId = id(row.referenceId);
  if (new Set(images.map(image => image.id)).size !== images.length || !images.some(image => image.id === referenceId)) throw new TypeError('Observation ids/reference must be unique and present.');
  if (images.filter(image => !image.processingRole).length < 2) throw new TypeError('At least two science observations required.');
  for (const image of images) if (image.registrationTransfer) {
    const bridge = images.find(candidate => candidate.id === image.registrationTransfer!.referenceId);
    if (!bridge || bridge === image || bridge.registrationTransfer || image.id === referenceId) throw new TypeError('Transfer requires a distinct directly registered reference.');
  }
  return { schema: row.schema, id: id(row.id), referenceId, frame: { ...sky(frame), northUp: true }, images,
    ...(nativeSeparationCache === undefined ? {} : { nativeSeparationCache }),
    nativeRemoval: { model: { path: string(model.path) } } };
}
