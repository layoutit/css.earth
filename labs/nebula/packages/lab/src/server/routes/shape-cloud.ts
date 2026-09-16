import { implementationPins } from '@cssearth/nebula-lab/server/implementation';
/** Explicit local jobs: validate the registered evidence, then bake and atomically publish one cloud. */
import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { resolve, relative, dirname, isAbsolute } from 'node:path';
import type { Plugin } from 'vite';
import sharp from 'sharp';
import { createStarRemovalJobs, starRemovalJobsHandler } from '../jobs/operation-jobs.ts';
import { readGeometryMap } from '../../features/observations/models/geometry-model.ts';
import { readRegisteredGeometrySource } from '../workflows/geometry/registered-source.ts';
import { geometryFile } from '../../features/geometry/jobs-model.ts';
import { validatePreparedCssVolume } from '../../adapters/renderer/volume-validation.ts';
import { initializeShapeCloud, readShapeCloudSettings } from '../../features/shape-cloud/model.ts';
import { bakeShapeCloud } from '../workflows/shape-cloud/bake.ts';
import { readShapeCloudResult } from '../../features/shape-cloud/result.ts';
import { readShapeCloudQuality } from '../../features/shape-cloud/quality.ts';
import { comparisonChannels, mapComparisonPins } from '../../features/shape-cloud/comparison-result.ts';
import type { ShapeCloudRequest, ShapeCloudPin, ShapeCloudResult } from '../../features/shape-cloud/types.ts';

const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const path = (value: unknown): value is string => typeof value === 'string' && value.startsWith('.local/nebula-lab/') &&
  !/[\\?#\u0000]/.test(value) && value.split('/').every(part => part !== '..' && part !== '.' && part.length > 0);
const hash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const cache = '.local/nebula-lab/shape-clouds';
export function parseShapeCloudRequest(value: unknown): ShapeCloudRequest {
  if (!object(value) || Object.keys(value).some(key => !['action', 'imageId', 'cataloguePath', 'geometrySha256', 'geometryFile', 'width', 'height', 'settings', 'quality'].includes(key)) || value.action !== 'apply' ||
      typeof value.imageId !== 'string' || !/^[a-z0-9-]+$/.test(value.imageId) || !path(value.cataloguePath) || !hash(value.geometrySha256) ||
      typeof value.width !== 'number' || typeof value.height !== 'number' || !Number.isInteger(value.width) || !Number.isInteger(value.height) ||
      value.width < 32 || value.height < 32 || value.width * value.height > 1_000_000 ||
      (value.geometryFile !== undefined && !geometryFile(value.geometryFile)))
    throw new TypeError('Choose prepared shapes and explicit preview settings.');
  return { action: 'apply', imageId: value.imageId, cataloguePath: value.cataloguePath, geometrySha256: value.geometrySha256,
    ...(value.geometryFile === undefined ? {} : { geometryFile: value.geometryFile }),
    width: value.width, height: value.height, quality: readShapeCloudQuality(value.quality), settings: readShapeCloudSettings(value.settings, value.width, value.height) };
}
async function pinned(root: string, pin: ShapeCloudPin): Promise<Buffer> {
  if (!path(pin.path) || !hash(pin.sha256)) throw new TypeError('Invalid local shape-cloud resource.');
  const actual = await realpath(resolve(root, pin.path)), offset = relative(await realpath(root), actual);
  if (offset.startsWith('../') || offset === '..' || isAbsolute(offset)) throw new TypeError('Shape-cloud resource leaves the repository.');
  const bytes = await readFile(actual);
  if (sha(bytes) !== pin.sha256) throw new TypeError(`Shape-cloud resource changed: ${pin.path}`);
  return bytes;
}
export async function validateShapeCloudResult(root: string, value: unknown): Promise<ShapeCloudResult> {
  const result = readShapeCloudResult(value);
  await pinned(root, result.source);
  if (result.projection) await pinned(root, result.projection);
  if (result.comparison) for (const level of result.comparison.levels) for (const channel of comparisonChannels) {
    const metadata = await sharp(await pinned(root, level[channel])).metadata();
    if (metadata.width !== result.width || metadata.height !== result.height) throw new TypeError('Structure comparison changed its source footprint.');
  }
  for (const pin of [result.neutral, result.textured]) if (pin) {
    const volume = validatePreparedCssVolume(JSON.parse((await pinned(root, pin)).toString()));
    for (const resource of volume.resources) {
      const bytes = await pinned(root, { path: relative(root, resolve(root, dirname(pin.path), resource.path)), sha256: resource.sha256 });
      if (bytes.byteLength !== resource.bytes) throw new TypeError('Prepared cloud texture byte count changed.');
    }
  }
  return result;
}
export function createShapeCloudJobs(root: string) {
  let queue = Promise.resolve();
  const sample = async (request: ShapeCloudRequest, signal: AbortSignal, progress: (p: { type: 'progress'; stage: string; current: number; total: number; message: string }) => void) => {
    signal.throwIfAborted();
    const { image, source } = await readRegisteredGeometrySource(root, request.cataloguePath, request.imageId);
    if ((!request.geometryFile && image.geometry?.sha256 !== request.geometrySha256) || image.width !== request.width || image.height !== request.height)
      throw new TypeError('Detected geometry changed; reload this source before preparing.');
    const selectedFile = request.geometryFile ?? image.geometry?.file;
    if (!selectedFile) throw new TypeError('Choose detected shapes before preparing.');
    const geometry = readGeometryMap(JSON.parse((await pinned(root, { path: `${image.directory}/${selectedFile}`, sha256: request.geometrySha256 })).toString()), image);
    const settings = readShapeCloudSettings(request.settings, image.width, image.height), detected = initializeShapeCloud(geometry);
    if (settings.components.length !== detected.components.length || settings.components.some(component => {
      const original = detected.components.find(candidate => candidate.id === component.id);
      return !original || original.groupId !== component.groupId || JSON.stringify(original.memberIds) !== JSON.stringify(component.memberIds);
    })) throw new TypeError('Cloud components do not match the current automatic initialization. Reset to detected shapes.');
    const implementation = await implementationPins(root, ['labs/nebula/packages/lab/src/server/routes/shape-cloud.ts']);
    const identity = { request: { ...request, settings }, source, mapSha256: image.mapSha256, implementation };
    const id = sha(JSON.stringify(identity)), directory = `${cache}/${id}`, resultPath = resolve(root, directory, 'result.json');
    try { return await validateShapeCloudResult(root, JSON.parse(await readFile(resultPath, 'utf8'))); }
    catch (error) { if (!(object(error) && error.code === 'ENOENT')) throw error; }
    const staging = `${cache}/.staging-${id}-${crypto.randomUUID()}`;
    await mkdir(resolve(root, staging), { recursive: true });
    try {
      const baked = await bakeShapeCloud({ root, outputDirectory: staging, id, image, geometry, geometrySha256: request.geometrySha256, settings, source, quality: request.quality }, {
        signal, onProgress(p) { signal.throwIfAborted(); progress({ type: 'progress', stage: p.phase, current: p.completed, total: p.total, message: `Preparing ${p.phase} ${p.completed}/${p.total}` }); },
      });
      signal.throwIfAborted();
      await validateShapeCloudResult(root, baked);
      signal.throwIfAborted();
      // Pins published to the immutable final directory, never to the staging path.
      const move = (pin: ShapeCloudPin | undefined) => pin ? { ...pin, path: pin.path.startsWith(`${staging}/`) ? `${directory}/${pin.path.slice(staging.length + 1)}` : pin.path } : undefined;
      const result = readShapeCloudResult({ ...baked, source: move(baked.source), neutral: move(baked.neutral), textured: move(baked.textured), projection: move(baked.projection),
        ...(baked.comparison ? { comparison: mapComparisonPins(baked.comparison, pin => move(pin)!) } : {}) });
      await writeFile(resolve(root, staging, 'result.json'), JSON.stringify(result, null, 2) + '\n');
      await writeFile(resolve(root, staging, 'recipe.json'), JSON.stringify(identity, null, 2) + '\n');
      await rename(resolve(root, staging), resolve(root, directory));
      return await validateShapeCloudResult(root, result);
    } catch (error) { await rm(resolve(root, staging), { recursive: true, force: true }); throw error; }
  };
  return createStarRemovalJobs<ShapeCloudRequest>(root, { namespace: 'shape-cloud', label: 'Shape cloud', parseRequest: parseShapeCloudRequest,
    history: { maxRecords: 128, retainPerImage: 4, preferred: request => request.quality === 'detailed' },
    sample(request, signal, progress) {
      const next = queue.then(() => sample(request, signal, progress)); queue = next.then(() => {}, () => {}); return next;
    }, validateResult: async result => { await validateShapeCloudResult(root, result); } });
}
export function shapeCloudPlugin(root: string): Plugin {
  return { name: 'nebula-shape-cloud', configureServer(server) {
    const jobs = createShapeCloudJobs(root), handler = starRemovalJobsHandler(jobs, '/__nebula/shape-cloud-jobs');
    server.middlewares.use('/__nebula/shape-cloud-jobs', (request, response) => { void handler(request, response); });
    server.httpServer?.once('close', () => { void jobs.shutdown(); });
  } };
}
