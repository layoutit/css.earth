import { evidenceGrid, samplingArcseconds } from '@cssearth/nebula-reconstruction/evidence/grid';
export {evidenceGrid} from '@cssearth/nebula-reconstruction/evidence/grid';
/** Server/offline only: reads the NOX-derived working rasters, never native processing. */
import { readFile, mkdir, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { serialize, deserialize } from 'node:v8';
import sharp from 'sharp';
import { readStructureCatalogue } from '../../../features/observations/models/structures-model.ts';
import { type Matrix } from '../../../features/observations/models/model.ts';
import { readRegisteredGeometrySource, readGeometryLocal } from '../geometry/registered-source.ts';
import { variantFor } from '../../services/saved-variants.ts';
import { extractEvidenceFields, registerEvidenceRaster, validateMatrix } from '@cssearth/nebula-reconstruction/evidence/fields';
import type { EvidenceInputs, EvidenceGrid, EvidenceSource } from '@cssearth/nebula-reconstruction/evidence/model';

export const evidenceMethodVersion = 'registered-multiscale-evidence@1';
export interface PrepareEvidenceOptions { imageToFrame?: Record<string, Matrix> }
const limitation = 'Uses the ~768px NOX-derived working rasters. Common angular smoothing accounts for working-pixel sampling using a 0.7-pixel blur proxy; instrumental PSFs are unknown. Small native knots and calibrated flux cannot be recovered.';

function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function cachedInputs(value: unknown, expected: string, grid: EvidenceGrid, count: number): value is EvidenceInputs {
  if (!isRecord(value) || value.identity !== expected || !isRecord(value.grid) || JSON.stringify(value.grid) !== JSON.stringify(grid) ||
      !Array.isArray(value.sources) || value.sources.length !== count || !isRecord(value.method) || value.method.version !== evidenceMethodVersion) return false;
  const pixels = grid.width * grid.height;
  const mask = (v: unknown): v is Uint8Array => v instanceof Uint8Array && v.length === pixels && v.every(n => n <= 1);
  const field = (v: unknown): v is Float32Array => v instanceof Float32Array && v.length === pixels && v.every(Number.isFinite);
  return value.sources.every(source => isRecord(source) && typeof source.id === 'string' && typeof source.label === 'string' &&
    typeof source.mapDirectory === 'string' && typeof source.sourcePanel === 'string' &&
    Array.isArray(source.imageToFrame) && source.imageToFrame.length === 6 && source.imageToFrame.every(Number.isFinite) &&
    Number.isInteger(source.workingWidth) && Number.isInteger(source.workingHeight) && typeof source.samplingArcseconds === 'number' && Number.isFinite(source.samplingArcseconds) &&
    source.registeredRgba instanceof Uint8Array && source.registeredRgba.length === pixels * 4 && mask(source.footprint) &&
    field(source.ridgeDirectionX) && field(source.ridgeDirectionY) && isRecord(source.channels) && ['broad', 'ridges', 'compact'].every(id => {
      const plane: unknown = isRecord(source.channels) ? source.channels[id] : undefined;
      return isRecord(plane) && field(plane.signal) && plane.signal.every(n => n >= 0) && mask(plane.coverage) && typeof plane.noiseSigma === 'number' && Number.isFinite(plane.noiseSigma) && plane.noiseSigma >= 0;
    }));
}

/** Inputs are re-read on every call. A slider changes combination only, reusing disk-cached prepared fields. */
export async function prepareEvidenceInputs(root: string, cataloguePath: string, options: PrepareEvidenceOptions = {}): Promise<EvidenceInputs> {
  const catalogue = readStructureCatalogue(JSON.parse((await readGeometryLocal(root, cataloguePath)).toString()));
  if (catalogue.images.length > 8) throw new TypeError('Evidence prototype supports at most eight registered sources.');
  const registered = await Promise.all(catalogue.images.map(image => readRegisteredGeometrySource(root, cataloguePath, image.id)));
  if (options.imageToFrame && Object.keys(options.imageToFrame).some(id => !catalogue.images.some(image => image.id === id))) throw new TypeError('Unknown adjusted evidence source.');
  const images = registered.map(({ image }) => {
    const imageToFrame = options.imageToFrame?.[image.id] ?? image.imageToFrame; validateMatrix(imageToFrame);
    return { ...image, imageToFrame };
  });
  const grid = evidenceGrid(catalogue.frame, images);
  const request = { version: evidenceMethodVersion, cataloguePath, grid,
    inputs: images.map((image, i) => ({ id: image.id, map: image.directory, source: registered[i].source.path, matrix: image.imageToFrame, width: image.width, height: image.height })) };
  // The input set is named once and found again by its request; its name is the identity later stages record.
  const cache = resolve(root, '.local/nebula-lab/evidence-fusion/inputs'), variant = await variantFor(cache, request);
  const identity = variant.name, directory = resolve(cache, identity), path = resolve(directory, 'inputs.bin');
  if (variant.existing) {
    try { const value: unknown = deserialize(await readFile(path)); if (cachedInputs(value, identity, grid, images.length)) return value; } catch { /* Missing/incomplete cache is rebuilt from its inputs. */ }
  }
  const samplings = images.map(image => samplingArcseconds(image, grid));
  const firstScale = Math.max(grid.arcsecondsPerPixel * 1.25, ...samplings.map(value => value * 1.05));
  const scaleArcseconds = [1, 2, 4, 8, 16].map(factor => factor * firstScale);
  const targetSigmas = scaleArcseconds.map(value => value / grid.arcsecondsPerPixel);
  const sources: EvidenceSource[] = [];
  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const { data, info } = await sharp(registered[i].bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width !== image.width || info.height !== image.height || info.channels !== 4) throw new TypeError('Pinned evidence source working dimensions changed.');
    const { registeredRgba, footprint, luminance } = registerEvidenceRaster(data, image.width, image.height, image.nativeWidth, image.nativeHeight, image.imageToFrame, grid);
    const fields = extractEvidenceFields(luminance, footprint, grid.width, grid.height, targetSigmas, .7 * samplings[i] / grid.arcsecondsPerPixel);
    sources.push({ id: image.id, label: image.label, mapDirectory: image.directory,
      sourcePanel: registered[i].source.path, imageToFrame: image.imageToFrame, workingWidth: image.width, workingHeight: image.height,
      registeredRgba, footprint, ...fields, samplingArcseconds: samplings[i] });
  }
  const inputs: EvidenceInputs = { identity, grid, sources, method: { version: evidenceMethodVersion, scaleArcseconds, samplingLimitation: limitation,
    normalization: 'Per-source, per-scale negative-half/MAD display-noise proxy with a 0.5% robust dynamic-range floor. Scores are not flux, probabilities, membership or depth.',
    boundary: 'Full registered source footprints are retained. Scale supports touching no-data are unavailable; uncovered pixels never count as negative evidence.' } };
  await mkdir(directory, { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`; await writeFile(temporary, serialize(inputs)); await rename(temporary, path);
  await writeFile(resolve(directory, 'request.json'), JSON.stringify(request));
  return inputs;
}
