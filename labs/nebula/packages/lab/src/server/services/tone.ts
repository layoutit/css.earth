import { createConcurrencyLimit } from './concurrency.ts';
import { resolveLabModelPath } from '../../resources/model-paths.ts';
import { parseLabModelJson } from '../../resources/model-paths.ts';
/** Local Node-only texture preparation. Browser receives finished URLs and retains its geometry. */
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, realpath, rename, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import sharp from 'sharp';
import { overlayVariantsPath, parseOverlayVariants, variantsForImage, type ImageLayer } from '../../features/legacy-viewer/overlay-variants.ts';
import { availableOverlayVariants } from '../../features/legacy-viewer/available-overlay-variants.ts';
import { resolveAppliedRemovalLayers } from './star-removal.ts';
import { resolveReconstructionSubject } from './density-reconstruction.ts';
import type { Plugin } from 'vite';
import { defaultOverlayTone, isNeutralOverlayTone, overlayToneSample, updateOverlayTone, type OverlayTone } from '../../features/legacy-viewer/overlay-tone.ts';

export interface TonePreparationRequest { subjectId: string; target: 'image' | 'density'; imageId?: string; imageLayer?: ImageLayer; removalResultId?: string; removalStrength?: number; tone: OverlayTone }
export interface ToneResource { sourcePath: string; url: string; width: number; height: number }
interface SourceResource { path: string; sha256: string; width: number; height: number; layer?: Exclude<ImageLayer, 'original'>; original?: SourceResource }
interface Subject { id: string; density?: { directory: string; overlays?: string } }
const digest = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
export function parseTonePreparationRequest(input: unknown): TonePreparationRequest {
  if (!record(input) ||
      (input.removalResultId !== undefined && (input.target !== 'image' || typeof input.removalResultId !== 'string' || !/^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(input.removalResultId))) ||
      (input.imageLayer !== undefined && (input.target !== 'image' || !['original', 'diffuse', 'stars'].includes(input.imageLayer as string))) ||
      (input.removalStrength !== undefined && (input.target !== 'image' || typeof input.removalStrength !== 'number' ||
        !Number.isFinite(input.removalStrength) || input.removalStrength < 0 || input.removalStrength > 100)) ||
      Object.keys(input).some(key => !['subjectId', 'target', 'imageId', 'imageLayer', 'removalResultId', 'removalStrength', 'tone'].includes(key)) ||
      typeof input.subjectId !== 'string' || !/^[a-z0-9-]+$/.test(input.subjectId) ||
      !['image', 'density'].includes(input.target as string) || !record(input.tone) ||
      Object.keys(defaultOverlayTone()).some(key => !Object.hasOwn(input.tone as object, key)) ||
      (input.target === 'image' ? typeof input.imageId !== 'string' || !/^[a-z0-9-]+$/.test(input.imageId) : input.imageId !== undefined)) {
    throw new TypeError('Invalid local tone preparation request.');
  }
  return { subjectId: input.subjectId, target: input.target as 'image' | 'density',
    ...(input.target === 'image' ? { imageId: input.imageId as string, ...(input.imageLayer ? { imageLayer: input.imageLayer as ImageLayer } : {}),
      ...(input.removalResultId ? { removalResultId: input.removalResultId as string } : {}),
      ...(input.removalStrength !== undefined ? { removalStrength: input.removalStrength as number } : {}) } : {}),
    tone: updateOverlayTone(defaultOverlayTone(), input.tone) };
}
/** Copy RGBA bytes. Density affects alpha only and preserves empty support exactly. */
export function toneRgba(input: Uint8Array, target: 'image' | 'density', tone: OverlayTone): Uint8Array {
  if (input.length % 4) throw new TypeError('Tone preparation requires RGBA pixels.');
  const valid = updateOverlayTone(defaultOverlayTone(), tone), output = new Uint8Array(input);
  const lut = Uint8Array.from({ length: 256 }, (_, value) => Math.round(255 * overlayToneSample(value / 255, valid)));
  for (let i = 0; i < output.length; i += 4) {
    if (target === 'density') output[i + 3] = input[i + 3] === 0 ? 0 : lut[input[i + 3]];
    else for (let c = 0; c < 3; c++) output[i + c] = lut[input[i + c]];
  }
  return output;
}
/** Display-code interpolation only. Endpoints can differ through preview resizing/WebP quantization. */
export function removalRgba(endpoint: Uint8Array, layer: Exclude<ImageLayer, 'original'>, strength: number, original?: Uint8Array): Uint8Array {
  if (endpoint.length % 4 || !Number.isFinite(strength) || strength < 0 || strength > 100 ||
      !['diffuse', 'stars'].includes(layer) || (layer === 'diffuse' && original?.length !== endpoint.length))
    throw new TypeError('Removal strength requires matching RGBA endpoints and a value from 0 to 100.');
  const result = new Uint8Array(endpoint.length), fraction = strength / 100;
  for (let i = 0; i < endpoint.length; i++) {
    // Residual opacity is retained even at zero RGB strength. Diffuse preserves both RGBA endpoints;
    // matching alpha planes remain exactly unchanged, and tone never modifies photograph alpha.
    result[i] = layer === 'stars' ? (i % 4 === 3 ? endpoint[i] : Math.round(endpoint[i] * fraction))
      : Math.round(original![i] * (1 - fraction) + endpoint[i] * fraction);
  }
  return result;
}
export function createTonePreparer(repositoryRoot: string, options: { maximumCacheBytes?: number; maximumCacheFiles?: number; maximumDecodedCacheBytes?: number } = {}) {
  const root = resolve(repositoryRoot), cache = resolve(root, '.local/nebula-lab/tone-cache');
  const textureLimit = createConcurrencyLimit(4), requestLimit = createConcurrencyLimit(2), cacheLimit = createConcurrencyLimit(1);
  const inflight = new Map<string, Promise<ToneResource>>(), protectedFiles = new Map<string, number>();
  const decodedCache = new Map<string, Buffer>(), decoding = new Map<string, Promise<Buffer>>();
  let decodedBytes = 0;
  let requests = 0;
  const protect = (path: string) => protectedFiles.set(path, (protectedFiles.get(path) ?? 0) + 1);
  const unprotect = (path: string) => { const n = (protectedFiles.get(path) ?? 1) - 1; if (n) protectedFiles.set(path, n); else protectedFiles.delete(path); };
  async function safePath(path: string) {
    const candidate = resolve(root, resolveLabModelPath(path)), rel = relative(root, candidate);
    if (isAbsolute(path) || rel.startsWith(`..${sep}`) || rel === '..') throw new TypeError('Prepared resource leaves the repository.');
    const actual = await realpath(candidate), realRoot = await realpath(root), actualRel = relative(realRoot, actual);
    if (actualRel.startsWith(`..${sep}`) || actualRel === '..') throw new TypeError('Prepared resource resolves outside the repository.');
    return candidate;
  }
  async function json(path: string) { return parseLabModelJson(await readFile(await safePath(path), 'utf8')); }
  async function resources(request: TonePreparationRequest): Promise<SourceResource[]> {
    const subjects = await json('labs/nebula/packages/lab/src/state/subjects.json') as Subject[];
    const subject = subjects.find(item => item.id === request.subjectId) ?? await resolveReconstructionSubject(root, request.subjectId);
    if (!subject?.density) throw new TypeError('Subject has no prepared neutral density.');
    if (request.target === 'image') {
      if (!subject.density.overlays) throw new TypeError('Subject has no image overlays.');
      const catalogue = await json(subject.density.overlays);
      const image = catalogue.overlays?.find((item: { id: string }) => item.id === request.imageId);
      if (!image) throw new TypeError('Unknown prepared image overlay.');
      const originalPath = relative(root, resolve(root, dirname(subject.density.overlays), image.texturePath));
      const original = { path: originalPath, sha256: digest(await readFile(await safePath(originalPath))), width: image.widthPx, height: image.heightPx };
      if (request.imageLayer && request.imageLayer !== 'original') {
        const layers = request.removalResultId
          ? (await resolveAppliedRemovalLayers(root, request.removalResultId, request.imageId!, original.sha256)).layers
          : variantsForImage(parseOverlayVariants(await json(overlayVariantsPath)), image);
        const layer = layers.find(item => item.id === request.imageLayer);
        if (!layer) throw new TypeError('Unknown prepared image layer.');
        return [{ path: layer.texturePath, sha256: digest(await readFile(await safePath(layer.texturePath))), width: layer.widthPx, height: layer.heightPx,
          layer: layer.id, ...(layer.id === 'diffuse' && (request.removalStrength ?? 100) !== 100 ? { original } : {}) }];
      }
      return [original];
    }
    const descriptor = await json(`${subject.density.directory}/object.json`);
    if (descriptor.prepared?.format !== 'cssearth-density-volume@1') throw new TypeError('Density has no prepared resources.');
    const manifestPath = relative(root, resolve(root, subject.density.directory, descriptor.prepared.url));
    const bytes = await readFile(await safePath(manifestPath));
    const manifest = parseLabModelJson(bytes.toString('utf8'));
    if (!Array.isArray(manifest.data?.resources) || !manifest.data.resources.length) throw new TypeError('Density resource bank is empty.');
    return manifest.data.resources.map((item: { path: string; sha256: string; width: number; height: number }) => ({
      ...item, path: relative(root, resolve(root, dirname(manifestPath), item.path)),
    }));
  }
  async function prune() {
    await cacheLimit(async () => {
      const entries = await Promise.all((await readdir(cache)).filter(name => /^[a-f0-9]{64}\.png$/.test(name)).map(async name => {
        const path = resolve(cache, name), info = await stat(path); return { path, bytes: info.size, accessed: info.mtimeMs };
      }));
      let bytes = entries.reduce((sum, entry) => sum + entry.bytes, 0), files = entries.length;
      for (const entry of entries.sort((a, b) => a.accessed - b.accessed)) {
        if (bytes <= (options.maximumCacheBytes ?? 512 * 1024 * 1024) && files <= (options.maximumCacheFiles ?? 2048)) break;
        if (protectedFiles.has(entry.path)) continue;
        await rm(entry.path, { force: true }); bytes -= entry.bytes; files--;
      }
    });
  }
  async function decode(source: SourceResource, bytes: Buffer, width = source.width, height = source.height) {
    const key = digest(JSON.stringify(['rgba8-lanczos3-full-extent-v1', source.sha256, source.width, source.height, width, height]));
    const cached = decodedCache.get(key);
    if (cached) { decodedCache.delete(key); decodedCache.set(key, cached); return cached; }
    let pending = decoding.get(key);
    if (!pending) {
      pending = (async () => {
        const metadata = await sharp(bytes).metadata();
        if (metadata.width !== source.width || metadata.height !== source.height) throw new TypeError('Prepared texture dimensions differ.');
        const decoded = await sharp(bytes).ensureAlpha().resize(width, height, { fit: 'fill', kernel: 'lanczos3' })
          .raw().toBuffer({ resolveWithObject: true });
        if (decoded.info.channels !== 4 || decoded.info.width !== width || decoded.info.height !== height)
          throw new TypeError('Prepared texture dimensions differ.');
        const maximum = options.maximumDecodedCacheBytes ?? 192 * 1024 * 1024;
        if (decoded.data.length <= maximum) {
          while (decodedBytes + decoded.data.length > maximum || decodedCache.size >= 16) {
            const oldest = decodedCache.keys().next().value!;
            decodedBytes -= decodedCache.get(oldest)!.length; decodedCache.delete(oldest);
          }
          decodedCache.set(key, decoded.data); decodedBytes += decoded.data.length;
        }
        return decoded.data;
      })();
      decoding.set(key, pending); void pending.finally(() => decoding.delete(key)).catch(() => {});
    }
    return pending;
  }
  async function prepareOne(source: SourceResource, request: TonePreparationRequest, held: string[]): Promise<ToneResource> {
    const path = await safePath(source.path), bytes = await readFile(path);
    if (!Number.isInteger(source.width) || !Number.isInteger(source.height) || source.width < 1 || source.height < 1) throw new TypeError('Invalid prepared texture dimensions.');
    const sourcePath = relative(root, path).split(sep).join('/');
    const strength = source.layer ? request.removalStrength ?? 100 : 100, removal = Boolean(source.layer && strength !== 100);
    let originalBytes: Buffer | undefined;
    if (source.original) {
      originalBytes = await readFile(await safePath(source.original.path));
      if (digest(originalBytes) !== source.original.sha256) throw new TypeError('Original prepared texture hash differs.');
    }
    if (isNeutralOverlayTone(request.tone) && !removal) return { sourcePath, url: `/@fs${path}`, width: source.width, height: source.height };
    const key = digest(JSON.stringify(['nebula-tone-v2-removal-png', request.target, request.tone, source.layer, strength,
      source.sha256, source.width, source.height, source.original?.sha256, source.original?.width, source.original?.height]));
    const outputPath = resolve(cache, `${key}.png`); protect(outputPath); held.push(outputPath);
    let pending = inflight.get(key);
    if (!pending) {
      pending = textureLimit(async () => {
        await mkdir(cache, { recursive: true });
        const exists = await stat(outputPath).catch(() => null);
        if (!exists) {
          const { width, height } = source;
          const [endpoint, original] = await Promise.all([decode(source, bytes), source.original && originalBytes
            ? decode(source.original, originalBytes, width, height) : undefined]);
          const adjusted = removal ? removalRgba(endpoint, source.layer!, strength, original) : endpoint;
          const transformed = isNeutralOverlayTone(request.tone) ? adjusted : toneRgba(adjusted, request.target, request.tone);
          const output = await sharp(transformed, { raw: { width, height, channels: 4 } }).png({ compressionLevel: removal ? 1 : 6 }).toBuffer();
          const temp = `${outputPath}.${randomUUID()}.tmp`;
          try { await writeFile(temp, output); await rename(temp, outputPath); } finally { await rm(temp, { force: true }); }
        } else { const now = new Date(); await utimes(outputPath, now, now); }
        return { sourcePath, url: `/@fs${outputPath}`, width: source.width, height: source.height };
      });
      inflight.set(key, pending); void pending.finally(() => inflight.delete(key)).catch(() => {});
    }
    // Identical texture bytes may belong to multiple leaves; preserve each caller's original path.
    return { ...await pending, sourcePath };
  }
  return async (input: unknown): Promise<{ resources: ToneResource[] }> => {
    const request = parseTonePreparationRequest(input);
    if (requests >= 8) throw new Error('Tone preparation queue is full; try again shortly.');
    requests++;
    try { return await requestLimit(async () => {
      const held: string[] = [];
      try {
        const sources = await resources(request);
        if (sources.length > 512) throw new TypeError('Prepared tone bank exceeds the local limit.');
        const results = await Promise.allSettled(sources.map(source => prepareOne(source, request, held)));
        const failure = results.find(result => result.status === 'rejected');
        if (failure?.status === 'rejected') throw failure.reason;
        if (held.length) await prune();
        return { resources: results.map(result => (result as PromiseFulfilledResult<ToneResource>).value) };
      } finally { held.forEach(unprotect); }
    }); } finally { requests--; }
  };
}
export function tonePreparationPlugin(repositoryRoot: string): Plugin {
  const prepare = createTonePreparer(repositoryRoot);
  return { name: 'nebula-local-tone-preparation', configureServer(server) {
    server.middlewares.use('/__nebula/image-variants', async (request, response) => {
      response.setHeader('Content-Type', 'application/json'); response.setHeader('Cache-Control', 'no-store');
      if (request.method !== 'GET') { response.statusCode = 405; response.end(JSON.stringify({error: 'Use GET.'})); return; }
      try { response.end(JSON.stringify(await availableOverlayVariants(repositoryRoot))); }
      catch (error) { response.statusCode = 500; response.end(JSON.stringify({error: error instanceof Error ? error.message : 'Image layer lookup failed.'})); }
    });
    server.middlewares.use('/__nebula/prepare-tone', async (request, response) => {
      const reply = (status: number, value: unknown) => { response.statusCode = status; response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(value)); };
      if (request.method !== 'POST') { reply(405, { error: 'Use POST for local tone preparation.' }); return; }
      try {
        if (!request.headers['content-type']?.startsWith('application/json') ||
            (request.headers.origin && new URL(request.headers.origin).host !== request.headers.host)) { reply(400, { error: 'Expected local JSON request.' }); return; }
        let body = ''; for await (const chunk of request) { body += chunk.toString(); if (body.length > 4096) throw new TypeError('Tone request is too large.'); }
        reply(200, await prepare(parseLabModelJson(body)));
      } catch (error) { reply(error instanceof TypeError || error instanceof SyntaxError ? 400 : 500, { error: error instanceof Error ? error.message : 'Tone preparation failed.' }); }
    });
  } };
}
