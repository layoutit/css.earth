import { implementationPins } from '@cssearth/nebula-lab/server/implementation';
/** Prepare immutable 2D fits for the automatic draft/refinement loop. */
import { readFile, readdir, writeFile, mkdir, link, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import sharp from 'sharp';
import { readGeometryMap } from '../../../features/observations/models/geometry-model.ts';
import { detectShapes } from '@cssearth/nebula-reconstruction/evidence/geometry/detect-shapes';
import { readDetectionRequest, readDetectionResult, geometryRecord, type DetectionResult } from '../../../features/geometry/jobs-model.ts';
import { geometrySha, readGeometryPin, readRegisteredGeometrySource } from './registered-source.ts';

export interface DetectionProgress { stage: string; current: number; total: number; message: string }
async function immutable(root: string, path: string, bytes: Buffer) {
  const destination = resolve(root, path), pending = `${destination}.${crypto.randomUUID()}.pending`;
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(pending, bytes);
  try { await link(pending, destination); }
  catch (error) {
    if (!geometryRecord(error) || error.code !== 'EEXIST') throw error;
    if (!(await readFile(destination)).equals(bytes)) throw new Error('Repeated detector identity produced different bytes.');
  } finally { await rm(pending, { force: true }); }
}
export async function validateDetectionResult(root: string, value: unknown): Promise<DetectionResult> {
  const result = readDetectionResult(value), { image } = await readRegisteredGeometrySource(root, result.cataloguePath, result.imageId);
  if (image.sourceSha256 !== result.sourceSha256 || image.mapSha256 !== result.mapSha256 || image.width !== result.width || image.height !== result.height)
    throw new TypeError('Detector proposal belongs to changed source evidence.');
  readGeometryMap(JSON.parse((await readGeometryPin(root, { path: `${image.directory}/${result.geometry.file}` })).toString()), image);
  return result;
}
export async function prepareDetection(root: string, value: unknown, progress: (value: DetectionProgress) => void): Promise<DetectionResult> {
  const request = readDetectionRequest(value);
  progress({ stage: 'source', current: 0, total: 1, message: 'Checking registered starless source' });
  const { image, source, bytes } = await readRegisteredGeometrySource(root, request.cataloguePath, request.imageId);
  if (image.sourceSha256 !== request.sourceSha256 || image.mapSha256 !== request.mapSha256) throw new TypeError('Source evidence changed; reload before detecting.');
  const implementation = await implementationPins(root, ['labs/nebula/packages/lab/src/server/workflows/geometry/preparation.ts', 'pnpm-lock.yaml']);
  const identity = { request, source, width: image.width, height: image.height, imageToFrame: image.imageToFrame, implementation };
  const id = geometrySha(JSON.stringify(identity)), resultPath = `.local/nebula-lab/geometry-detections/${id}/result.json`;
  try { return await validateDetectionResult(root, JSON.parse(await readFile(resolve(root, resultPath), 'utf8'))); }
  catch (error) { if (!(geometryRecord(error) && error.code === 'ENOENT')) throw error; }
  const rgb = await sharp(bytes).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  if (rgb.info.width !== image.width || rgb.info.height !== image.height || rgb.info.channels !== 3 || rgb.data.length !== image.width * image.height * 3)
    throw new TypeError('Detector raster does not match the complete registered source.');
  progress({ stage: 'detecting', current: 0, total: 1, message: 'Finding connected contours' });
  const samplingSettings = request.quality === 'draft' ? { ...request.settings, iterations: Math.min(request.settings.iterations, 3000) } : request.settings;
  const detected = detectShapes(rgb.data, image.width, image.height, samplingSettings, { onProgress(current, total) {
    progress({ stage: 'detecting', current, total: Math.max(1, total), message: `Fitting contours ${Math.floor(current)}/${total}` });
  } });
  const geometry = { schema: 'cssearth-observation-geometry@1', imageId: image.id, sourceSha256: image.sourceSha256,
    mapSha256: image.mapSha256, width: image.width, height: image.height, imageToFrame: image.imageToFrame, ...detected,
    provenance: { identity, identitySha256: id, nativeRemovalPerformed: false, structureExtractionPerformed: false, depthInferencePerformed: false,
      interpretation: 'Projected fits for live inspection. Higher sensitivity may include noise and residual stellar halos. No inferred physical depth.' } };
  readGeometryMap(geometry, image);
  const geometryBytes = Buffer.from(JSON.stringify(geometry, null, 2) + '\n'), file = `geometry-${id}.json`;
  // A changed catalogue/source must not attach a just-finished proposal to replacement evidence.
  const current = await readRegisteredGeometrySource(root, request.cataloguePath, request.imageId);
  if (JSON.stringify(current.image) !== JSON.stringify(image) || current.source.sha256 !== source.sha256) throw new Error('Registered source changed during detection.');
  await immutable(root, `${image.directory}/${file}`, geometryBytes);
  const result: DetectionResult = { schema: 'cssearth-geometry-detection-result@1', id, cataloguePath: request.cataloguePath, imageId: image.id,
    sourceSha256: image.sourceSha256, mapSha256: image.mapSha256, width: image.width, height: image.height,
    settings: request.settings, quality: request.quality ?? 'detailed', geometry: { file, sha256: geometrySha(geometryBytes) } };
  await immutable(root, resultPath, Buffer.from(JSON.stringify(result, null, 2) + '\n'));
  progress({ stage: 'ready', current: 1, total: 1, message: `${detected.candidates.length} proposals ready to inspect` });
  return validateDetectionResult(root, result);
}
