/** Explicit local jobs: validate the registered evidence, then bake and atomically publish one cloud. */
import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { resolve, relative, dirname, isAbsolute } from 'node:path';
import type { Plugin } from 'vite';
import { createStarRemovalJobs, starRemovalJobsHandler } from '../../utils/processing-jobs.js';
import { readStructureCatalogue, readReviewMap } from '../../alignment/observations-ui/structures-model.js';
import { readGeometryMap } from '../../alignment/observations-ui/geometry-model.js';
import { validatePreparedCssVolume } from '../../../../../src/renderers/css/volume/validation.js';
import { initializeShapeCloud, readShapeCloudSettings } from './model.js';
import { bakeShapeCloud } from './bake.js';
import { readShapeCloudResult } from './result.js';
import { readShapeCloudQuality } from './quality.js';
import type { ShapeCloudRequest, ShapeCloudPin, ShapeCloudResult } from './types.js';

const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const path = (value: unknown): value is string => typeof value === 'string' && value.startsWith('.local/nebula-lab/') &&
  !/[\\?#\u0000]/.test(value) && value.split('/').every(part => part !== '..' && part !== '.' && part.length > 0);
const hash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const cache = '.local/nebula-lab/shape-clouds';
export function parseShapeCloudRequest(value: unknown): ShapeCloudRequest {
  if (!object(value) || Object.keys(value).some(key => !['action', 'imageId', 'cataloguePath', 'geometrySha256', 'width', 'height', 'settings', 'quality'].includes(key)) || value.action !== 'apply' ||
      typeof value.imageId !== 'string' || !/^[a-z0-9-]+$/.test(value.imageId) || !path(value.cataloguePath) || !hash(value.geometrySha256) ||
      typeof value.width !== 'number' || typeof value.height !== 'number' || !Number.isInteger(value.width) || !Number.isInteger(value.height) ||
      value.width < 32 || value.height < 32 || value.width * value.height > 1_000_000)
    throw new TypeError('Choose prepared shapes and explicit preview settings.');
  return { action: 'apply', imageId: value.imageId, cataloguePath: value.cataloguePath, geometrySha256: value.geometrySha256,
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
    const registry: unknown = JSON.parse(await readFile(resolve(root, 'labs/nebula/src/subjects.json'), 'utf8'));
    if (!Array.isArray(registry) || !registry.some(row => object(row) && object(row.emissionExperiment) && row.emissionExperiment.observationStructures === request.cataloguePath))
      throw new TypeError('The structure catalogue is not configured for a lab object.');
    const catalogue = readStructureCatalogue(JSON.parse(await readFile(resolve(root, request.cataloguePath), 'utf8')));
    const image = catalogue.images.find(candidate => candidate.id === request.imageId);
    if (!image?.geometry || image.geometry.sha256 !== request.geometrySha256 || image.width !== request.width || image.height !== request.height)
      throw new TypeError('Detected geometry changed; reload this source before preparing.');
    const mapBytes = await pinned(root, { path: `${image.directory}/map.json`, sha256: image.mapSha256 });
    const raw: unknown = JSON.parse(mapBytes.toString()); readReviewMap(raw, image);
    if (!object(raw) || !Array.isArray(raw.panels)) throw new TypeError('Source panel is missing.');
    const panel = raw.panels.find(item => object(item) && item.id === 'source');
    if (!object(panel) || typeof panel.file !== 'string' || !hash(panel.sha256)) throw new TypeError('Source panel identity is missing.');
    const source = { path: `${image.directory}/${panel.file}`, sha256: panel.sha256 }; await pinned(root, source);
    const geometry = readGeometryMap(JSON.parse((await pinned(root, { path: `${image.directory}/${image.geometry.file}`, sha256: image.geometry.sha256 })).toString()), image);
    const settings = readShapeCloudSettings(request.settings, image.width, image.height), detected = initializeShapeCloud(geometry);
    if (settings.components.length !== detected.components.length || settings.components.some(component => {
      const original = detected.components.find(candidate => candidate.id === component.id);
      return !original || original.groupId !== component.groupId || JSON.stringify(original.memberIds) !== JSON.stringify(component.memberIds);
    })) throw new TypeError('Cloud components do not match the current automatic initialization. Reset to detected shapes.');
    const moduleDirectory = 'labs/nebula/src/reconstruction/shape-cloud';
    const dependencies = (await readdir(resolve(root, moduleDirectory))).filter(name => name.endsWith('.ts') && !name.endsWith('.test.ts')).map(name => `${moduleDirectory}/${name}`)
      .concat(['labs/nebula/src/reconstruction/master-slices.ts', 'labs/nebula/src/reconstruction/cloud-material.ts', 'labs/nebula/src/reconstruction/cloud-appearance.ts',
        'src/renderers/css/preparation/volume.ts', 'src/renderers/css/preparation/volume-order.ts', 'src/renderers/css/preparation/leaf-bounds.ts',
        'src/preparation/volume/raster.ts', 'pnpm-lock.yaml']);
    const implementation = await Promise.all(dependencies.sort().map(async file => ({ path: file, sha256: sha(await readFile(resolve(root, file))) })));
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
      const result = readShapeCloudResult({ ...baked, source: move(baked.source), neutral: move(baked.neutral), textured: move(baked.textured), projection: move(baked.projection) });
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
