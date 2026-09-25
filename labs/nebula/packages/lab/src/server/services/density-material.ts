import { createConcurrencyLimit } from './concurrency.ts';
import { resolveLabModelPath } from '../../resources/model-paths.ts';
import { parseLabModelJson } from '../../resources/model-paths.ts';
/** Node-only integrated-signal gating of immutable prepared cloud textures. */
import { createHash, randomUUID } from 'node:crypto';
import { resolveReconstructionSubject } from './density-reconstruction.ts';
import { mkdir, readFile, readdir, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import sharp from 'sharp';
import type { OutputInfo } from 'sharp';
import type { Plugin } from 'vite';
import { createObservationMapping } from '../../adapters/preparation/observation-prior.ts';
import { createIntegratedSignalSampler, filterCloudDensityRgba, validateCloudDensityFilter, type CloudDensityFilter } from '@cssearth/bake/volume';

type Vec3 = [number, number, number];
interface Subject { id: string; directory: string; cloudParts?: { descriptor: string; catalogue: string } }
interface SourceResource { path: string; sha256: string; width: number; height: number;
  backgroundSize: [number, number]; backgroundPosition: [number, number]; matrix: number[] }
export interface CloudDensityPreparationRequest { subjectId: string; filter: CloudDensityFilter }
export interface CloudDensityResource { sourcePath: string; url: string; width: number; height: number }
export interface CloudDensityStats { native: boolean; resources: number; densityMaximumSourceUnits: number;
  sampledDensityMinimum: number; sampledDensityMaximum: number; sampledDensityMean: number; sampledPixels: number;
  approximation: string }

const digest = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const px = (value: unknown): number => {
  const match = typeof value === 'string' && /^(-?(?:\d+\.?\d*|\.\d+))px$/u.exec(value.trim());
  if (!match) throw new TypeError('Cloud leaf geometry requires finite pixel lengths.');
  const result = Number(match[1]); if (!Number.isFinite(result)) throw new TypeError('Cloud leaf pixel length is invalid.'); return result;
};
const pair = (value: unknown): [number, number] => {
  if (typeof value !== 'string') throw new TypeError('Cloud leaf background geometry is missing.');
  const values = value.trim().split(/\s+/u); if (values.length !== 2) throw new TypeError('Cloud leaf background geometry is invalid.');
  return [px(values[0]), px(values[1])];
};
const matrix3d = (value: unknown): number[] => {
  const match = typeof value === 'string' ? /^matrix3d\((.*)\)$/u.exec(value.trim()) : null;
  const values = match?.[1]?.split(',').map((item: string) => Number(item));
  if (!values || values.length !== 16 || values.some(item => !Number.isFinite(item))) throw new TypeError('Cloud leaf matrix is invalid.');
  return values;
};
export function cloudTextureTexelPoint(resource: Pick<SourceResource, 'width' | 'height' | 'backgroundSize' |
  'backgroundPosition' | 'matrix'>, column: number, row: number): Vec3 {
  const localX = resource.backgroundPosition[0] + (column + .5) / resource.width * resource.backgroundSize[0];
  const localY = resource.backgroundPosition[1] + (row + .5) / resource.height * resource.backgroundSize[1];
  const m = resource.matrix, w = m[3]! * localX + m[7]! * localY + m[15]!;
  if (!Number.isFinite(w) || Math.abs(w) < 1e-12) throw new TypeError('Cloud leaf matrix has invalid perspective.');
  const cssX = (m[0]! * localX + m[4]! * localY + m[12]!) / w;
  const cssY = (m[1]! * localX + m[5]! * localY + m[13]!) / w;
  const cssZ = (m[2]! * localX + m[6]! * localY + m[14]!) / w;
  return [cssY / 50, cssX / 50, cssZ / 50];
}
export function parseCloudDensityPreparationRequest(input: unknown): CloudDensityPreparationRequest {
  if (!record(input) || Object.keys(input).some(key => !['subjectId', 'filter'].includes(key)) ||
      typeof input.subjectId !== 'string' || !/^[a-z0-9-]+$/u.test(input.subjectId) || !record(input.filter) ||
      Object.keys(input.filter).some(key => !['cutoff', 'softness', 'showRemoved'].includes(key))) {
    throw new TypeError('Invalid cloud density preparation request.');
  }
  return { subjectId: input.subjectId, filter: validateCloudDensityFilter(input.filter as unknown as CloudDensityFilter) };
}

export function createCloudDensityPreparer(repositoryRoot: string, options: {
  maximumCacheBytes?: number; maximumCacheFiles?: number;
} = {}) {
  const root = resolve(repositoryRoot), cache = resolve(root, '.local/nebula-lab/cloud-density-cache');
  const textureLimit = createConcurrencyLimit(4), processingLimit = createConcurrencyLimit(4), requestLimit = createConcurrencyLimit(1), cacheLimit = createConcurrencyLimit(1);
  const mapInflight = new Map<string, Promise<{ map: Float32Array; path: string }>>(), outputInflight = new Map<string, Promise<CloudDensityResource>>();
  let queued = 0;
  async function safe(path: string): Promise<string> {
    const candidate = resolve(root, resolveLabModelPath(path)), offset = relative(root, candidate);
    if (isAbsolute(path) || offset === '..' || offset.startsWith(`..${sep}`)) throw new TypeError('Cloud resource leaves the repository.');
    const actual = await realpath(candidate), actualRoot = await realpath(root), resolved = relative(actualRoot, actual);
    if (resolved === '..' || resolved.startsWith(`..${sep}`)) throw new TypeError('Cloud resource resolves outside the repository.');
    return actual;
  }
  const json = async (path: string) => parseLabModelJson(await readFile(await safe(path), 'utf8'));
  function sameFrame(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
    return ['referenceFrame', 'epochJdTt', 'originM', 'localToReferenceXyzw', 'metersPerUnit']
      .every(key => JSON.stringify(left[key]) === JSON.stringify(right[key]));
  }
  async function context(request: CloudDensityPreparationRequest): Promise<{
    resources: SourceResource[]; sampleSignal: (x: number, y: number, z: number) => number; maximum: number; geometryHash: string;
  }> {
    const subjects = await json('labs/nebula/packages/lab/src/state/subjects.json') as Subject[];
    const subject = subjects.find(item => item.id === request.subjectId) ?? await resolveReconstructionSubject(root, request.subjectId);
    if (!subject?.cloudParts) throw new TypeError('Subject has no cloud-part density context.');
    // Cloud descriptors are relative to the subject's reconstructed-object directory, not the subjects catalogue.
    const reconstructedDirectory = subject.directory;
    const catalogue = await json(`${reconstructedDirectory}/${subject.cloudParts.catalogue}`);
    const contextId = catalogue.id;
    if (contextId !== subject.id) throw new TypeError('Cloud-parts catalogue id differs from the subject.');
    const descriptor = await json(relative(root, resolve(root, reconstructedDirectory, subject.cloudParts.descriptor)));
    const manifestPath = relative(root, resolve(root, reconstructedDirectory, descriptor.prepared?.url ?? ''));
    const manifestBytes = await readFile(await safe(manifestPath));
    if (digest(manifestBytes) !== descriptor.prepared?.sha256) throw new TypeError('Cloud inspection manifest hash differs.');
    const manifest = parseLabModelJson(manifestBytes.toString());
    if (!Array.isArray(manifest.data?.resources) || manifest.data.resources.length < 1 || manifest.data.resources.length > 4096) {
      throw new TypeError('Cloud inspection resource bank is invalid.');
    }
    let recipeBytes: Buffer, targetBytes: Buffer;
    let mapping: { boundsUnits: { min: [number, number]; max: [number, number] }; distanceUnits: number };
    let target: { data: Buffer; info: OutputInfo };
    if (subject.id.startsWith('reconstruction-')) {
      const volumeDescriptor = await json(`${reconstructedDirectory}/object.json`);
      const provenancePin = volumeDescriptor.properties?.preparation;
      recipeBytes = await readFile(await safe(`${reconstructedDirectory}/${provenancePin.source}`));
      const provenance = parseLabModelJson(recipeBytes.toString());
      if (provenance.schema !== 'cssearth-nebula-reconstruction-provenance@1' || !sameFrame(manifest.data.frame, provenance.request?.frame ?? {}))
        throw new TypeError('Reconstruction signal and volume frames differ.');
      const artifacts = await json(`${reconstructedDirectory}/manifest.json`);
      targetBytes = await readFile(await safe(`${reconstructedDirectory}/source/aligned-image.png`));
      if (digest(targetBytes) !== artifacts.artifacts?.['source/aligned-image.png']?.sha256) throw new TypeError('Reconstruction signal image differs.');
      target = await sharp(targetBytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const signalMetadata = provenance.densityProjection ?? provenance.photo;
      if (target.info.width !== signalMetadata.width || target.info.height !== signalMetadata.height || target.info.channels !== 3)
        throw new TypeError('Reconstruction signal dimensions differ.');
      const signalGeometry = provenance.densityProjection ?? provenance.geometry;
      mapping = { boundsUnits: signalGeometry.tangentBoundsKpc, distanceUnits: signalGeometry.observerDistanceKpc };
    } else {
      const evidence = manifest.data.provenance?.reference, recipePin = evidence?.recipe;
    if (typeof recipePin?.path !== 'string' || typeof recipePin.sha256 !== 'string') throw new TypeError('Cloud reconstruction recipe pin is missing.');
    recipeBytes = await readFile(await safe(recipePin.path));
    if (digest(recipeBytes) !== recipePin.sha256) throw new TypeError('Cloud reconstruction recipe differs from its provenance pin.');
    const recipe = parseLabModelJson(recipeBytes.toString());
    if (recipe.schema !== 'cssearth-filled-observation@1' || !recipe.variants?.some((item: { id: string; directory: string }) =>
      item.id === subject.id && item.directory === subject.directory) || typeof recipe.frame?.path !== 'string' || typeof recipe.frame.sha256 !== 'string') {
      throw new TypeError('Cloud reconstruction recipe does not identify this prepared subject.');
    }
    const frameBytes = await readFile(await safe(recipe.frame.path));
    if (digest(frameBytes) !== recipe.frame.sha256) throw new TypeError('Cloud frame differs from its recipe pin.');
    const frame = parseLabModelJson(frameBytes.toString()).properties?.volume;
    if (!sameFrame(manifest.data.frame, frame ?? {})) throw new TypeError('Cloud integrated signal and prepared volume frames differ.');
    mapping = createObservationMapping(recipe.wcs, frame);
    const targetPath = `${recipe.directory}/source/target.png`; targetBytes = await readFile(await safe(targetPath));
    target = await sharp(targetBytes).flop().removeAlpha().raw().toBuffer({ resolveWithObject: true });
    if (target.info.width !== evidence.observation?.width || target.info.height !== evidence.observation?.height || target.info.channels !== 3) {
      throw new TypeError('Integrated cloud target dimensions differ from reconstruction evidence.');
    }
    }
    const signal = new Float32Array(target.info.width * target.info.height); let maximum = 0;
    for (let pixel = 0; pixel < signal.length; pixel++) {
      const value = (target.data[3 * pixel]! * .2126 + target.data[3 * pixel + 1]! * .7152 + target.data[3 * pixel + 2]! * .0722) / 255;
      signal[pixel] = value; maximum = Math.max(maximum, value);
    }
    const sampleSignal = createIntegratedSignalSampler({ values: signal, width: target.info.width, height: target.info.height,
      bounds: mapping.boundsUnits, observerDistance: mapping.distanceUnits });
    const preparedDirectory = dirname(manifestPath);
    const leafByPath = new Map<string, { width: number; height: number; size: [number, number]; position: [number, number]; matrix: number[] }>();
    for (const stack of manifest.data.stacks ?? []) for (const leaf of stack.leaves ?? []) {
      const path = relative(root, resolve(root, preparedDirectory, leaf.texturePath)).split(sep).join('/');
      const geometry = { width: px(leaf.style?.width), height: px(leaf.style?.height),
        size: pair(leaf.style?.backgroundSize), position: pair(leaf.style?.backgroundPosition), matrix: matrix3d(leaf.style?.transform) };
      const prior = leafByPath.get(path);
      if (prior && JSON.stringify(prior) !== JSON.stringify(geometry)) throw new TypeError('Shared cloud texture has inconsistent leaf geometry.');
      leafByPath.set(path, geometry);
    }
    const resources: SourceResource[] = manifest.data.resources.map((item: { path: string; sha256: string; width: number; height: number }) => {
      const path = relative(root, resolve(root, preparedDirectory, item.path)).split(sep).join('/');
      const leaf = leafByPath.get(path);
      if (!leaf || !Number.isInteger(item.width) || !Number.isInteger(item.height) || item.width < 1 || item.height < 1 ||
          !(leaf.width > 0) || !(leaf.height > 0) || !(leaf.size[0] > 0) || !(leaf.size[1] > 0)) {
        throw new TypeError(`Cloud resource has no matching fixed slice geometry: ${item.path}`);
      }
      return { ...item, path, backgroundSize: leaf.size, backgroundPosition: leaf.position, matrix: leaf.matrix };
    });
    if (resources.length !== leafByPath.size) throw new TypeError('Cloud resources do not close over fixed leaf geometry.');
    return { resources, sampleSignal, maximum, geometryHash: digest(Buffer.concat([recipeBytes, targetBytes, Buffer.from(signal.buffer),
      Buffer.from(JSON.stringify(resources.map(item => [item.path, item.sha256, item.width, item.height,
        item.backgroundSize, item.backgroundPosition, item.matrix])))])) };
  }
  async function densityMap(resource: SourceResource, sampleSignal: (x: number, y: number, z: number) => number,
    geometryHash: string): Promise<{ map: Float32Array; path: string }> {
    const key = digest(JSON.stringify(['cloud-density-map-v3-integrated-ray', geometryHash, resource.path, resource.sha256]));
    let pending = mapInflight.get(key);
    if (!pending) {
      pending = textureLimit(async () => {
        await mkdir(cache, { recursive: true });
        const path = resolve(cache, `${key}.f32`), expected = resource.width * resource.height * 4;
        const cached = await readFile(path).catch(() => null);
        if (cached?.length === expected) return { map: new Float32Array(cached.buffer.slice(cached.byteOffset, cached.byteOffset + cached.byteLength)), path };
        const map = new Float32Array(resource.width * resource.height);
        for (let row = 0; row < resource.height; row++) for (let col = 0; col < resource.width; col++) {
          const point = cloudTextureTexelPoint(resource, col, row);
          map[row * resource.width + col] = sampleSignal(point[0], point[1], point[2]);
        }
        const bytes = Buffer.from(map.buffer), temporary = `${path}.${randomUUID()}.tmp`;
        try { await writeFile(temporary, bytes); await rename(temporary, path); } finally { await rm(temporary, { force: true }); }
        return { map, path };
      });
      mapInflight.set(key, pending); void pending.finally(() => mapInflight.delete(key)).catch(() => {});
    }
    return pending;
  }
  async function prepareOne(resource: SourceResource, sampleSignal: (x: number, y: number, z: number) => number, geometryHash: string,
    filter: CloudDensityFilter, totals: Float64Array, protectedMaps: Set<string>): Promise<CloudDensityResource> {
    const path = await safe(resource.path), bytes = await readFile(path);
    if (digest(bytes) !== resource.sha256) throw new TypeError('Immutable cloud texture hash differs.');
    const sourcePath = relative(root, path).split(sep).join('/');
    if (filter.cutoff === 0 && !filter.showRemoved) return { sourcePath, url: `/@fs${path}`, width: resource.width, height: resource.height };
    const mapped = await densityMap(resource, sampleSignal, geometryHash), map = mapped.map; protectedMaps.add(mapped.path);
    const key = digest(Buffer.concat([Buffer.from(JSON.stringify(['cloud-density-v1', filter])), bytes,
      Buffer.from(digest(Buffer.from(map.buffer)))]));
    let pending = outputInflight.get(key);
    if (!pending) {
      pending = textureLimit(async () => {
        await mkdir(cache, { recursive: true }); const outputPath = resolve(cache, `${key}.webp`);
        if (!await stat(outputPath).catch(() => null)) {
          const decoded = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
          if (decoded.info.width !== resource.width || decoded.info.height !== resource.height || decoded.info.channels !== 4) {
            throw new TypeError('Cloud texture dimensions differ from fixed geometry.');
          }
          const output = filterCloudDensityRgba(decoded.data, map, filter);
          const image = await sharp(output, { raw: { width: resource.width, height: resource.height, channels: 4 } }).webp({ lossless: true }).toBuffer();
          const temporary = `${outputPath}.${randomUUID()}.tmp`;
          try { await writeFile(temporary, image); await rename(temporary, outputPath); } finally { await rm(temporary, { force: true }); }
        }
        return { sourcePath, url: `/@fs${outputPath}`, width: resource.width, height: resource.height };
      });
      outputInflight.set(key, pending); void pending.finally(() => outputInflight.delete(key)).catch(() => {});
    }
    for (let pixel = 0; pixel < map.length; pixel++) {
      const density = map[pixel]!;
      totals[0]++; totals[1] += density; totals[2] = Math.min(totals[2]!, density); totals[3] = Math.max(totals[3]!, density);
    }
    return { ...await pending, sourcePath };
  }
  async function prune(protectedPaths: ReadonlySet<string>): Promise<void> {
    await cacheLimit(async () => {
      const files = await readdir(cache).catch(() => []), entries = await Promise.all(files.filter(name => /\.(?:png|webp|f32)$/u.test(name)).map(async name => {
        const path = resolve(cache, name), info = await stat(path); return { path, bytes: info.size, time: info.mtimeMs };
      }));
      let bytes = entries.reduce((sum, item) => sum + item.bytes, 0), count = entries.length;
      for (const item of entries.sort((a, b) => a.time - b.time)) {
        if (bytes <= (options.maximumCacheBytes ?? 1024 ** 3) && count <= (options.maximumCacheFiles ?? 8192)) break;
        if (protectedPaths.has(item.path)) continue;
        await rm(item.path, { force: true }); bytes -= item.bytes; count--;
      }
    });
  }
  return async (input: unknown): Promise<{ resources: CloudDensityResource[]; stats: CloudDensityStats }> => {
    const request = parseCloudDensityPreparationRequest(input);
    if (queued >= 3) throw new Error('Cloud density preparation queue is full; try again shortly.');
    queued++;
    try { return await requestLimit(async () => {
      const model = await context(request), native = request.filter.cutoff === 0 && !request.filter.showRemoved;
      const totals = new Float64Array([0, 0, Infinity, 0]), protectedMaps = new Set<string>();
      const results = await Promise.allSettled(model.resources.map(resource => processingLimit(() => prepareOne(resource, model.sampleSignal,
        model.geometryHash, request.filter, totals, protectedMaps))));
      const failure = results.find(result => result.status === 'rejected'); if (failure?.status === 'rejected') throw failure.reason;
      const resources = results.map(result => (result as PromiseFulfilledResult<CloudDensityResource>).value);
      if (!native) await prune(new Set([...protectedMaps, ...resources.map(item => item.url.startsWith('/@fs') ? item.url.slice(4) : '')]));
      return { resources, stats: {
        native, resources: results.length, densityMaximumSourceUnits: model.maximum,
        sampledDensityMinimum: totals[0] ? totals[2]! : 0, sampledDensityMaximum: totals[3]!,
        sampledDensityMean: totals[0] ? totals[1]! / totals[0]! : 0, sampledPixels: totals[0]!,
        approximation: 'The fixed Earth-facing integrated reconstruction signal is reused along each calibrated ray. Alpha gating is applied after slab integration; no lost light is renormalized.' } };
    }); } finally { queued--; }
  };
}

export function cloudDensityPreparationPlugin(repositoryRoot: string): Plugin {
  const prepare = createCloudDensityPreparer(repositoryRoot);
  return { name: 'nebula-cloud-density-preparation', configureServer(server) {
    server.middlewares.use('/__nebula/prepare-cloud-density', async (request, response) => {
      const reply = (status: number, value: unknown) => { response.statusCode = status; response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(value)); };
      if (request.method !== 'POST') { reply(405, { error: 'Use POST for local cloud density preparation.' }); return; }
      try {
        if (!request.headers['content-type']?.startsWith('application/json') ||
            (request.headers.origin && new URL(request.headers.origin).host !== request.headers.host)) throw new TypeError('Expected local JSON request.');
        let body = ''; for await (const chunk of request) { body += chunk.toString(); if (body.length > 4096) throw new TypeError('Cloud density request is too large.'); }
        reply(200, await prepare(parseLabModelJson(body)));
      } catch (error) { reply(error instanceof TypeError || error instanceof SyntaxError ? 400 : 500,
        { error: error instanceof Error ? error.message : 'Cloud density preparation failed.' }); }
    });
  } };
}
