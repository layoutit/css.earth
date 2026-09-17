import { resolveLabModelPath } from '../../resources/model-paths.ts';
/** Local native-pixel analysis. This endpoint never replaces a source or prepares a cloud. */
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, readFile, readdir, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';
import sharp from 'sharp';
import { createStarRemovalJobs, starRemovalJobsHandler } from '../jobs/operation-jobs.ts';
import { prepareNativePreservation } from '@cssearth/nebula-reconstruction/star-removal/native';

import type { RemovalRequest, RemovalProgress } from '../../features/star-removal/star-removal-types.ts';
export type { RemovalRequest, RemovalProgress } from '../../features/star-removal/star-removal-types.ts';
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const numeric = (value: unknown, low: number, high: number) => typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high;
const keys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key));
const hash = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const scriptPath = 'labs/nebula/packages/reconstruction/src/star-removal/star-removal.py';
/** Maps whose compact emission is the science keep every pixel: the identity treatment of the observation lane. */
const preserveImplementationPath = 'labs/nebula/packages/reconstruction/src/star-removal/native.ts';
const PRESERVED_SCHEMA = 'cssearth-native-preservation-output@1';
export type StellarTreatment = 'nox' | 'preserve';
const defaultModelPath = '.local/open-star-removal/noxGeneratorColor.pb';
const defaultModelSha256 = 'd54bdca728d1d6db0b3eef41d4187d327909d1ec5cd2a71485bfa9d7924ba546';
const cachePath = '.local/nebula-lab/star-removal-nox';
const resultToken = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(value);
interface AppliedLayers { sourceSha256: string; nativeDimensions: number[]; layers: { id: 'diffuse' | 'stars'; texturePath: string; sha256: string; widthPx: number; heightPx: number }[] }
const resolvedApplications = new Map<string, { stamps: [string, string][]; value: AppliedLayers }>();
async function fileStamp(path: string) { const value = await stat(path); return [value.dev, value.ino, value.size, value.mtimeMs, value.ctimeMs].join(':'); }
export async function resolveAppliedRemovalLayers(root: string, resultId: string, imageId: string, originalPreviewSha256: string): Promise<AppliedLayers> {
  const key = JSON.stringify([await realpath(root), resultId, imageId, originalPreviewSha256]), cached = resolvedApplications.get(key);
  if (cached && (await Promise.all(cached.stamps.map(async ([path, stamp]) => (await fileStamp(path).catch(() => '')) === stamp))).every(Boolean)) return cached.value;
  const resolved = await createStarRemover(root).resolveApplied(resultId, imageId, originalPreviewSha256);
  const stamps = await Promise.all(resolved.files.map(async path => [path, await fileStamp(path).catch(() => '')] as [string, string]));
  resolvedApplications.set(key, { stamps, value: resolved.value });
  if (resolvedApplications.size > 16) resolvedApplications.delete(resolvedApplications.keys().next().value!);
  return resolved.value;
}
export async function restoreAppliedRemovalResult(root: string, input: unknown) {
  if (!record(input) || !keys(input, ['imageId', 'resultId', 'sourcePreviewSha256']) || typeof input.imageId !== 'string' ||
      !/^[a-z0-9-]+$/.test(input.imageId) || (input.resultId !== undefined && !resultToken(input.resultId)) || typeof input.sourcePreviewSha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(input.sourcePreviewSha256)) throw new TypeError('Invalid saved applied image identity.');
  const resultId = input.resultId ?? await createStarRemover(root).discoverApplied(input.imageId, input.sourcePreviewSha256);
  if (!resultId) return null;
  const resolved = await resolveAppliedRemovalLayers(root, resultId, input.imageId, input.sourcePreviewSha256);
  const layers = await Promise.all(resolved.layers.map(async layer => ({ ...layer, url: `/@fs${await realpath(resolve(root, layer.texturePath))}` })));
  return { imageId: input.imageId, sourceSha256: resolved.sourceSha256, sourcePreviewSha256: input.sourcePreviewSha256,
    nativeDimensions: resolved.nativeDimensions, applied: { resultId, layers } };
}

export function parseRemovalRequest(input: unknown): RemovalRequest {
  if (!record(input) || !keys(input, ['imageId', 'action']) || typeof input.imageId !== 'string' ||
      !/^[a-z0-9-]+$/.test(input.imageId) || !['overview', 'preview', 'apply'].includes(input.action as string))
    throw new TypeError('Invalid automatic star removal request.');
  return { imageId: input.imageId, action: input.action as RemovalRequest['action'] };
}

type ProgressListener = (progress: RemovalProgress) => void;
export type RemovalRunner = (request: Record<string, unknown>, directory: string, signal: AbortSignal, onProgress: ProgressListener) => Promise<void>;
interface RemovalWork { controller: AbortController; callers: Map<symbol, ProgressListener | undefined>; promise: Promise<unknown>; settled: boolean; progress?: RemovalProgress }
const cancelled = () => new DOMException('Star removal cancelled.', 'AbortError');
const notify = (listener: ProgressListener | undefined, progress: RemovalProgress) => { try { listener?.(progress); } catch { /* A disconnected progress consumer cannot fail another caller. */ } };
export function createStarRemover(repositoryRoot: string, options: { runner?: RemovalRunner; modelPin?: { path: string; sha256: string }; pythonPath?: string; timeoutMs?: number; applyTimeoutMs?: number; maximumCacheBytes?: number; maximumApplyCacheBytes?: number } = {}) {
  const modelPath = options.modelPin?.path ?? defaultModelPath, modelSha256 = options.modelPin?.sha256 ?? defaultModelSha256;
  const root = resolve(repositoryRoot), cache = resolve(root, cachePath), appliedCache = resolve(root, `${cachePath}-applied`);
  const verifiedInputs = new Set<string>();
  const inflight = new Map<string, RemovalWork>();
  let queue = Promise.resolve(), waiting = 0;
  async function safePath(path: string) {
    if (typeof path !== 'string' || isAbsolute(path) || path.split(/[\\/]/).includes('..')) throw new TypeError('Invalid local removal path.');
    const full = await realpath(resolve(root, resolveLabModelPath(path))), fromRoot = relative(await realpath(root), full);
    if (fromRoot.startsWith(`..${sep}`) || fromRoot === '..' || isAbsolute(fromRoot)) throw new TypeError('Removal path escapes the repository.');
    return full;
  }
  async function pinned(path: string, expected?: string) {
    const full = await safePath(path), bytes = await readFile(full);
    if (expected !== undefined && hash(bytes) !== expected) throw new TypeError(`Removal input hash differs: ${path}`);
    verifiedInputs.add(full); verifiedInputs.add(resolve(root, path)); return bytes;
  }
  const json = async (path: string, expected?: string) => JSON.parse((await pinned(path, expected)).toString());
  async function catalogueSource(request: RemovalRequest, cataloguePath: string) {
    const catalogue = await json(cataloguePath);
    const matches = (catalogue.targets ?? []).flatMap((target: { directory: string; images: { id: string; path: string; sha256: string }[] }) =>
      target.images.filter(image => image.id === request.imageId).map(image => ({ image, directory: target.directory })));
    if (matches.length !== 1) throw new TypeError('This image needs a unique imported original in the image catalogue.');
    const { image, directory } = matches[0];
    if (!/^[a-f0-9]{64}$/.test(image.sha256)) throw new TypeError('Imported original is missing its source hash.');
    let bytes: Buffer;
    try { bytes = await pinned(image.path, image.sha256); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error('Download this image’s original before removing stars.'); throw error; }
    const metadata = await sharp(bytes, { unlimited: true }).metadata();
    const nativeDimensions = [metadata.width, metadata.height];
    if (!nativeDimensions.every(value => Number.isInteger(value) && value > 0 && value <= 40000) || (metadata.pages ?? 1) !== 1)
      throw new TypeError('Star removal needs a single image with dimensions up to 40,000 pixels per side.');
    let source = { path: image.path as string, sha256: image.sha256 as string, nativeDimensions };
    // NOX consumes RGB8. Convert other imported rasters at full size, never the preview or original in place.
    if (metadata.depth !== 'uchar' || metadata.channels !== 3 || metadata.space !== 'srgb' ||
        !['png', 'jpeg', 'tiff', 'webp'].includes(metadata.format ?? '')) {
      const path = `${cachePath}-inputs/${image.sha256}-rgb8-v1.png`;
      const converted = await sharp(bytes, { unlimited: true }).toColourspace('srgb').removeAlpha().png().toBuffer();
      const expected = hash(converted), existing = await readFile(resolve(root, path)).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
      if (existing && hash(existing) !== expected) throw new TypeError('Prepared RGB input differs from its imported original.');
      if (!existing) {
        await mkdir(dirname(resolve(root, path)), { recursive: true });
        await writeFile(resolve(root, path), converted, { flag: 'wx' }).catch(error => { if (error.code !== 'EEXIST') throw error; });
      }
      await pinned(path, expected); source = { path, sha256: expected, nativeDimensions };
    }
    return { source, directory, baseline: undefined, preserve: undefined,
      planSha256: hash(JSON.stringify(['catalogue-rgb8-v1', image.id, image.path, image.sha256, directory])) };
  }
  async function sourceFor(request: RemovalRequest) {
    const subjects = await json('labs/nebula/packages/lab/src/state/subjects.json').catch(error => { if (error.code === 'ENOENT') return []; throw error; });
    if (!Array.isArray(subjects)) throw new TypeError('Invalid subject catalogue.');
    const planPaths = [...new Set<string>(subjects.flatMap(subject => {
      const path = subject?.density?.processingPlan;
      if (path === undefined) return [];
      if (typeof path !== 'string') throw new TypeError('Invalid density processing plan path.');
      return [path];
    }))];
    const matchingPlans = [], treatments: { stellarTreatment: 'preserve'; reason: string; plan: string }[] = [];
    const catalogues = new Set<string>();
    for (const path of planPaths) {
      const bytes = await pinned(path).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
      if (!bytes) continue;
      const plan = JSON.parse(bytes.toString());
      if (typeof plan.catalogue !== 'string') throw new TypeError('Invalid processing catalogue path.');
      catalogues.add(plan.catalogue);
      for (const row of plan.treatments ?? []) {
        if (!record(row) || typeof row.id !== 'string' || !/^[a-z0-9-]+$/.test(row.id) || row.stellarTreatment !== 'preserve' || typeof row.reason !== 'string' || !row.reason.trim())
          throw new TypeError('A configured stellar treatment names one image, the preserve treatment and its reason.');
        if (row.id === request.imageId) treatments.push({ stellarTreatment: 'preserve' as const, reason: row.reason, plan: path });
      }
      if (plan.schema !== 'cssearth-image-processing-plan@1') throw new TypeError('Invalid saved star-removal plan.');
      if (plan.selections?.some((value: { id: string }) => value.id === request.imageId)) matchingPlans.push({ bytes, plan });
    }
    if (matchingPlans.length > 1) throw new TypeError('This image has ambiguous configured processing plans.');
    if (!matchingPlans.length) {
      if (!catalogues.size) catalogues.add('labs/nebula/models/image-candidates.json');
      if (treatments.length > 1) throw new TypeError('This image has ambiguous configured stellar treatments.');
      const matches: string[] = [];
      for (const path of catalogues) {
        const catalogue = await json(path);
        if (catalogue.targets?.some((target: { images: { id: string }[] }) => target.images.some(image => image.id === request.imageId))) matches.push(path);
      }
      if (matches.length !== 1) throw new TypeError('This image needs a unique imported original in the image catalogue.');
      return { ...await catalogueSource(request, matches[0]!), preserve: treatments[0] };
    }
    const { bytes: planBytes, plan } = matchingPlans[0]!;
    const selection = plan.selections?.find((value: { id: string }) => value.id === request.imageId);
    if (plan.schema !== 'cssearth-image-processing-plan@1') throw new TypeError('Invalid saved star-removal plan.');
    if (!selection) return catalogueSource(request, plan.catalogue);
    const recipe = await json(selection.recipe, selection.recipeSha256);
    const report = await json(plan.alignmentReport.path, plan.alignmentReport.sha256);
    const proof = report.sources?.find((value: { id: string }) => value.id === request.imageId);
    const catalogue = await json(plan.catalogue);
    const target = catalogue.targets?.find((value: { images: { id: string }[] }) => value.images.some(image => image.id === request.imageId));
    const input = target?.images.find((value: { id: string }) => value.id === request.imageId);
    const geometry = input?.registration ? { kind: 'matched-star-homography', registration: input.registration } : { kind: 'fixed-publisher-wcs', wcs: input?.wcs };
    if (recipe.schema !== 'cssearth-star-separation@1' || !proof || report.pass !== true || proof.pass !== true || report.status !== 'passed' || proof.status !== 'passed' ||
        recipe.source.sha256 !== proof.sourceSha256 || recipe.source.path !== proof.sourcePath || input?.sha256 !== recipe.source.sha256 || input?.path !== recipe.source.path ||
        JSON.stringify(recipe.source.nativeDimensions) !== JSON.stringify(proof.sourceDimensions) || JSON.stringify(geometry) !== JSON.stringify(proof.geometry))
      throw new TypeError('Removal source differs from its verified native image registration.');
    await pinned(proof.gate.path, proof.gate.sha256);
    const dimensions = recipe.source.nativeDimensions;
    if (!Array.isArray(dimensions) || dimensions.length !== 2 || !dimensions.every(value => Number.isInteger(value) && value > 0 && value <= 40000)) throw new TypeError('Invalid native image dimensions.');
    await pinned(recipe.source.path, recipe.source.sha256);
    const receiptPath = `${recipe.outputDirectory}/receipt.json`;
    verifiedInputs.add(resolve(root, receiptPath));
    let baseline: { path: string; sha256: string } | undefined;
    const receiptPresent = await stat(resolve(root, receiptPath)).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (receiptPresent) {
      const receipt = await json(receiptPath);
      if (receipt.schema !== 'cssearth-star-separation-receipt@1' || receipt.sourceSha256 !== recipe.source.sha256 ||
          receipt.recipeSha256 !== selection.recipeSha256 || receipt.verification?.maximumReconstructionErrorCodeValues !== 0 ||
          receipt.verification?.encodedRoundTripExact !== true)
        throw new TypeError('Approved baseline is not bound to this source and exact accounting.');
      const baselinePath = `${recipe.outputDirectory}/diffuse.png`, baselineSha = receipt.outputs?.['diffuse.png']?.sha256;
      if (typeof baselineSha !== 'string' || !/^[a-f0-9]{64}$/.test(baselineSha)) throw new TypeError('Approved baseline pin is missing.');
      const present = await stat(resolve(root, baselinePath)).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
      verifiedInputs.add(resolve(root, baselinePath));
      if (present) {
        const bytes = await pinned(baselinePath, baselineSha), metadata = await sharp(bytes, { unlimited: true }).metadata();
        if (metadata.width !== dimensions[0] || metadata.height !== dimensions[1]) throw new TypeError('Approved baseline changed the native pixel grid.');
        baseline = { path: baselinePath, sha256: baselineSha };
      }
    }
    if (treatments.length) throw new TypeError('A configured star-separation recipe and a preserve treatment cannot both own this image.');
    return { source: { path: recipe.source.path, sha256: recipe.source.sha256, nativeDimensions: dimensions }, planSha256: hash(planBytes), directory: target.directory, baseline, preserve: undefined };
  }
  async function overview(request: RemovalRequest, proof: Awaited<ReturnType<typeof sourceFor>>) {
    const manifestPath = `${proof.directory}/overlays.json`, manifest = await json(manifestPath);
    const image = manifest.overlays?.find((value: { id: string }) => value.id === request.imageId);
    if (!image || Math.abs(image.widthPx / image.heightPx / (proof.source.nativeDimensions[0] / proof.source.nativeDimensions[1]) - 1) > .002)
      throw new TypeError('Original preview is not bound to this native removal source.');
    const path = relative(root, resolve(root, dirname(manifestPath), image.texturePath));
    const bytes = await pinned(path, image.sha256), metadata = await sharp(bytes).metadata();
    if (metadata.width !== image.widthPx || metadata.height !== image.heightPx) throw new TypeError('Original preview pixel grid differs.');
    return { schema: 'cssearth-star-removal-result@1', method: 'nox', imageId: request.imageId, operation: 'overview', sourceSha256: proof.source.sha256,
      nativeDimensions: proof.source.nativeDimensions, sourcePreviewSha256: image.sha256,
      overview: { url: `/@fs${await safePath(path)}`, dimensions: [image.widthPx, image.heightPx] }, previews: [] };
  }
  async function cacheBytes(directory = cache): Promise<number> {
    const entries = await readdir(directory, { withFileTypes: true }).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
    let total = 0;
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) total += await cacheBytes(path);
      else if (entry.isFile()) total += (await stat(path)).size;
    }
    return total;
  }
  async function checkCacheSpace(apply = false) {
    if (await cacheBytes(apply ? appliedCache : cache) >= (apply ? options.maximumApplyCacheBytes ?? 4 * 1024 ** 3 : options.maximumCacheBytes ?? 512 * 1024 * 1024))
      throw new Error('Star removal cache is full. Clear unused local NOX results before starting more analyses; existing previews were preserved.');
  }
  const run: RemovalRunner = options.runner ?? (async (request, directory, signal, onProgress) => {
    const python = options.pythonPath ?? resolve(root, '.local/open-star-removal/venv/bin/python');
    await stat(python).catch(() => { throw new Error('Star removal needs the local analysis environment. Install the pinned NOX environment.'); });
    signal.throwIfAborted();
    await new Promise<void>((done, reject) => {
      const child = spawn(python, [resolve(root, scriptPath)], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] });
      let output = '', errors = '', timedOut = false, completed = false;
      const abort = () => child.kill('SIGKILL');
      signal.addEventListener('abort', abort, { once: true });
      const timeout = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, request.operation === 'apply' ? options.applyTimeoutMs ?? 1800000 : options.timeoutMs ?? 120000);
      child.stdout.on('data', bytes => {
        output = (output + bytes.toString()).slice(-65536);
        const lines = output.split('\n'); output = lines.pop()!;
        for (const line of lines) {
          try {
            const event = JSON.parse(line);
            if (event.type === 'complete') completed = true;
            else if (event.type === 'progress' && typeof event.stage === 'string' && typeof event.message === 'string' && numeric(event.current, 0, 1000000000) &&
              numeric(event.total, event.current, 1000000000)) onProgress({ stage: event.stage, current: event.current, total: event.total, message: event.message });
          } catch { /* Non-progress diagnostic output is not completion evidence. */ }
        }
      });
      child.stderr.on('data', bytes => { errors = (errors + bytes.toString()).slice(-4096); });
      const cleanup = () => { clearTimeout(timeout); signal.removeEventListener('abort', abort); };
      child.on('error', error => { cleanup(); reject(error); });
      child.on('close', code => {
        cleanup();
        if (signal.aborted) reject(cancelled());
        else if (code !== 0 || !completed) reject(new Error(timedOut ? 'Star removal timed out.' : `Star removal failed: ${errors || 'no completion evidence'}`));
        else done();
      });
      child.stdin.on('error', () => {});
      child.stdin.end(JSON.stringify({ ...request, outputDirectory: directory }));
    });
  });
  /** The identity treatment: the native source becomes the diffuse layer and the star layer is empty.
   * Same cache, artifacts and accounting as a NOX application, so every consumer reads it unchanged. */
  async function writePreserved(directory: string, source: { path: string; sha256: string; nativeDimensions: number[] }, reason: string, implementationSha: string) {
    const dimensions = source.nativeDimensions as [number, number];
    const { expectedDiffuse, expectedStars } = await prepareNativePreservation(await pinned(source.path, source.sha256), dimensions);
    const preview = (bytes: Buffer) => sharp(bytes, { unlimited: true }).resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true }).webp({ quality: 92 }).toBuffer({ resolveWithObject: true });
    const files: Record<string, Buffer> = { 'diffuse.png': expectedDiffuse, 'stars.png': expectedStars, 'mask.png': expectedStars };
    const diffusePreview = await preview(expectedDiffuse), starsPreview = await preview(expectedStars);
    files['diffuse.webp'] = diffusePreview.data; files['stars.webp'] = starsPreview.data;
    files['comparison.webp'] = diffusePreview.data; files['overview.webp'] = diffusePreview.data;
    for (const [name, bytes] of Object.entries(files)) await writeFile(resolve(directory, name), bytes);
    const previewDimensions = [diffusePreview.info.width, diffusePreview.info.height];
    const result = { schema: PRESERVED_SCHEMA, operation: 'apply', treatment: 'preserve', reason, sourceSha256: source.sha256,
      implementationSha256: implementationSha, nativeDimensions: source.nativeDimensions,
      artifactSha256: Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, hash(bytes)])),
      overview: { path: 'overview.webp', dimensions: previewDimensions },
      applied: { images: { diffuse: 'diffuse.png', stars: 'stars.png', mask: 'mask.png' },
        previews: { diffuse: 'diffuse.webp', stars: 'stars.webp', comparison: 'comparison.webp' }, previewDimensions,
        counts: { removedPixels: 0, preservedPixels: dimensions[0] * dimensions[1] },
        verification: { maximumReconstructionErrorCodeValues: 0, changedPixelsOutsideMask: 0, baselineRestoredPixels: 0, encodedRoundTripExact: true, coverageComplete: true,
          interpretation: 'Star removal is not applicable: compact emission is preserved. Any foreground stars remain in this map.' } } };
    await writeFile(resolve(directory, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  }
  async function resultAt(directory: string, request: RemovalRequest, source: { path: string; sha256: string; nativeDimensions: number[] },
    previewSha: string, scriptSha: string, modelSha: string, baselineSha: string | null, preserve?: { reason: string; implementationSha: string }) {
    const canonicalDirectory = await realpath(directory);
    const resultBytes = await readFile(resolve(directory, 'result.json')), result = JSON.parse(resultBytes.toString());
    const token = `${basename(directory).replace(/\.pending$/, '')}.${hash(resultBytes)}`;
    if (preserve) {
      if (result.schema !== PRESERVED_SCHEMA || result.operation !== 'apply' || request.action !== 'apply' || result.treatment !== 'preserve' ||
          result.reason !== preserve.reason || result.implementationSha256 !== preserve.implementationSha || result.sourceSha256 !== source.sha256 ||
          JSON.stringify(result.nativeDimensions) !== JSON.stringify(source.nativeDimensions))
        throw new TypeError('Preserved result does not match its pinned request.');
      // The identity claim is re-proved from the pinned source, never taken from the saved receipt.
      const identity = await prepareNativePreservation(await pinned(source.path, source.sha256), source.nativeDimensions as [number, number]);
      if (result.artifactSha256?.['diffuse.png'] !== hash(identity.expectedDiffuse) || result.artifactSha256?.['stars.png'] !== hash(identity.expectedStars) ||
          result.artifactSha256?.['mask.png'] !== hash(identity.expectedStars))
        throw new TypeError('Preserved layers are not the identity treatment of this source.');
    } else if (result.schema !== 'cssearth-nox-output@1' || result.operation !== request.action || result.sourceSha256 !== source.sha256 ||
        result.scriptSha256 !== scriptSha || result.modelSha256 !== modelSha || result.baselineSha256 !== baselineSha ||
        JSON.stringify(result.nativeDimensions) !== JSON.stringify(source.nativeDimensions) ||
        (result.previews !== undefined && (!Array.isArray(result.previews) || result.previews.length > 4)) || (request.action === 'preview' && !result.previews?.length))
      throw new TypeError('NOX result does not match its pinned request.');
    async function artifact(path: unknown, dimensions?: number[], native = false) {
      if (typeof path !== 'string' || isAbsolute(path) || path.split(/[\\/]/).includes('..') ||
          !(native ? /\.png$/ : /\.(png|webp)$/).test(path)) throw new TypeError('Invalid NOX artifact path.');
      const full = await realpath(resolve(directory, path));
      if (!full.startsWith(`${canonicalDirectory}${sep}`) || (await stat(full)).size === 0) throw new TypeError('NOX artifact is outside its output directory.');
      const bytes = await readFile(full), expected = result.artifactSha256?.[path];
      if (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected) || hash(bytes) !== expected)
        throw new TypeError('NOX artifact hash differs from its result.');
      const metadata = await sharp(bytes, { unlimited: true }).metadata();
      if (!(native ? metadata.format === 'png' : ['png', 'webp'].includes(metadata.format ?? '')) || !metadata.width || !metadata.height ||
          (dimensions && (metadata.width !== dimensions[0] || metadata.height !== dimensions[1])))
        throw new TypeError('NOX artifact changed its declared pixel grid.');
      if (!native) await sharp(bytes).raw().toBuffer();
      verifiedInputs.add(full); verifiedInputs.add(resolve(directory, path));
      return { url: `/@fs${full}`, texturePath: relative(await realpath(root), full).split(sep).join('/'),
        sha256: expected, widthPx: metadata.width, heightPx: metadata.height };
    }
    const dimensions = (value: unknown): value is [number, number] => Array.isArray(value) && value.length === 2 &&
      value.every(item => Number.isInteger(item) && item > 0 && item <= 4096);
    const fullExtent = (size: [number, number]) => Math.abs(size[0] / size[1] / (source.nativeDimensions[0] / source.nativeDimensions[1]) - 1) <= .002;
    if (!dimensions(result.overview?.dimensions) || !fullExtent(result.overview.dimensions)) throw new TypeError('NOX overview changed the source extent.');
    const overview = { url: (await artifact(result.overview.path, result.overview.dimensions)).url, dimensions: result.overview.dimensions };
    const previews = [];
    for (const preview of result.previews ?? []) {
      if (!preview || typeof preview.id !== 'string' || !Array.isArray(preview.origin) || preview.origin.length !== 2 ||
          !preview.origin.every((value: number) => Number.isInteger(value) && value >= 0) ||
          ![preview.width, preview.height].every(value => Number.isInteger(value) && value > 0 && value <= 512) ||
          preview.origin[0] + preview.width > source.nativeDimensions[0] || preview.origin[1] + preview.height > source.nativeDimensions[1])
        throw new TypeError('NOX preview is not a bounded native crop.');
      const images: Record<string, string> = {};
      for (const name of ['source', 'removed', 'mask', 'stars']) images[name] = (await artifact(preview[name], [preview.width, preview.height])).url;
      previews.push({ id: preview.id, origin: preview.origin, width: preview.width, height: preview.height, ...images });
    }
    let applied;
    if (request.action === 'apply') {
      const output = result.applied, verification = output?.verification;
      if (!output || verification?.maximumReconstructionErrorCodeValues !== 0 || verification?.changedPixelsOutsideMask !== 0 ||
          verification?.baselineRestoredPixels !== 0 || verification?.encodedRoundTripExact !== true || verification?.coverageComplete !== true ||
          !dimensions(output.previewDimensions) || !fullExtent(output.previewDimensions))
        throw new TypeError('NOX native output lacks exact accounting or full image coverage.');
      const native: Record<string, string> = {};
      for (const name of ['diffuse', 'stars', 'mask']) native[name] = (await artifact(output.images?.[name], source.nativeDimensions, true)).url;
      const layers = [];
      for (const id of ['diffuse', 'stars'] as const) layers.push({ id, ...await artifact(output.previews?.[id], output.previewDimensions) });
      const comparisonUrl = (await artifact(output.previews?.comparison)).url;
      applied = { resultId: token, layers, native, comparisonUrl, counts: output.counts, verification };
    }
    return { schema: 'cssearth-star-removal-result@1' as const, method: (preserve ? 'preserve' : 'nox') as 'nox' | 'preserve', imageId: request.imageId,
      operation: request.action, sourceSha256: source.sha256, sourcePreviewSha256: previewSha,
      nativeDimensions: source.nativeDimensions, overview, previews, ...(applied ? { applied } : {}) };
  }
  function joinJob(key: string, job: RemovalWork, signal?: AbortSignal, onProgress?: ProgressListener) {
    signal?.throwIfAborted();
    const caller = Symbol(); job.callers.set(caller, onProgress);
    if (job.progress) notify(onProgress, job.progress);
    return new Promise<unknown>((done, reject) => {
      let live = true;
      const release = () => {
        if (!live) return; live = false;
        signal?.removeEventListener('abort', abort); job.callers.delete(caller);
        if (!job.callers.size && !job.settled) {
          job.controller.abort();
          if (inflight.get(key) === job) inflight.delete(key);
        }
      };
      const abort = () => { release(); reject(cancelled()); };
      signal?.addEventListener('abort', abort, { once: true });
      job.promise.then(value => { release(); done(value); }, error => { release(); reject(error); });
      if (signal?.aborted) abort();
    });
  }
  const sample = async (input: unknown, signal?: AbortSignal, onProgress?: ProgressListener) => {
    const request = parseRemovalRequest(input);
    signal?.throwIfAborted();
    if (waiting >= 4) throw new Error('Star removal is busy; try again shortly.');
    waiting++;
    try {
      notify(onProgress, { stage: 'validating', current: 0, total: 1, message: 'Verifying imported source image.' });
      const proof = await sourceFor(request);
      signal?.throwIfAborted();
      notify(onProgress, { stage: 'validating', current: 1, total: 1, message: 'Source image verified.' });
      if (request.action === 'overview') {
        const result = await overview(request, proof); signal?.throwIfAborted();
        notify(onProgress, { stage: 'preparing', current: 1, total: 1, message: 'Original preview ready.' });
        return result;
      }
      const preserve = proof.preserve ? { reason: proof.preserve.reason, implementationSha: hash(await pinned(preserveImplementationPath)) } : undefined;
      if (preserve && request.action !== 'apply') throw new TypeError('A preserved map has no star separation to preview; apply its identity treatment.');
      const scriptSha = preserve ? preserve.implementationSha : hash(await pinned(scriptPath));
      if (!preserve) await pinned(modelPath, modelSha256);
      const work = preserve
        ? { schema: 'cssearth-star-removal@1', operation: request.action, treatment: 'preserve', reason: preserve.reason, source: proof.source,
          implementation: { path: preserveImplementationPath, sha256: preserve.implementationSha } }
        : { schema: 'cssearth-star-removal@1', operation: request.action, source: proof.source,
          model: { path: modelPath, sha256: modelSha256 }, ...(proof.baseline ? { baseline: proof.baseline } : {}) };
      const previewSha = (await overview(request, proof)).sourcePreviewSha256;
      const key = hash(JSON.stringify([scriptSha, proof.planSha256, work])), directory = resolve(request.action === 'apply' ? appliedCache : cache, key);
      const complete = await stat(resolve(directory, 'result.json')).catch(() => null);
      signal?.throwIfAborted();
      if (complete) {
        const result = await resultAt(directory, request, proof.source, previewSha, scriptSha, modelSha256, proof.baseline?.sha256 ?? null, preserve); signal?.throwIfAborted();
        notify(onProgress, { stage: 'cached', current: 1, total: 1, message: 'Verified saved NOX result loaded.' });
        return result;
      }
      let job = inflight.get(key);
      if (!job) {
        const controller = new AbortController(), callers = new Map<symbol, ProgressListener | undefined>();
        const progress = (value: RemovalProgress) => { created.progress = value; for (const listener of callers.values()) notify(listener, value); };
        const pending = queue.then(async () => {
          controller.signal.throwIfAborted();
          await checkCacheSpace(request.action === 'apply'); controller.signal.throwIfAborted();
          const temporary = `${directory}.pending`;
          await rm(temporary, { recursive: true, force: true }); await mkdir(temporary, { recursive: true });
          try {
            controller.signal.throwIfAborted();
            progress({ stage: 'preparing', current: 0, total: 1, message: preserve ? 'Preserving compact emission on the native grid.' : 'Preparing automatic NOX removal.' });
            if (preserve) await writePreserved(temporary, proof.source, preserve.reason, preserve.implementationSha);
            else await run({ ...work, source: { ...work.source, path: await safePath(work.source.path) },
              model: { path: await safePath(modelPath), sha256: modelSha256 },
              ...(proof.baseline ? { baseline: { ...proof.baseline, path: await safePath(proof.baseline.path) } } : {}) }, temporary, controller.signal, progress); controller.signal.throwIfAborted();
            progress({ stage: 'previews', current: 0, total: 1, message: preserve ? 'Verifying preserved images.' : 'Verifying NOX output images.' });
            await resultAt(temporary, request, proof.source, previewSha, scriptSha, modelSha256, proof.baseline?.sha256 ?? null, preserve);
            controller.signal.throwIfAborted();
            await writeFile(resolve(temporary, 'request.json'), JSON.stringify({ ...work, scriptSha256: scriptSha, planSha256: proof.planSha256 }, null, 2) + '\n');
            await checkCacheSpace(request.action === 'apply'); controller.signal.throwIfAborted();
            await rename(temporary, directory);
            const result = await resultAt(directory, request, proof.source, previewSha, scriptSha, modelSha256, proof.baseline?.sha256 ?? null, preserve);
            progress({ stage: 'previews', current: 1, total: 1, message: preserve ? 'Verified preserved images ready.' : 'Verified NOX images ready.' });
            return result;
          } catch (error) { await rm(temporary, { recursive: true, force: true }); throw error; }
        });
        const created: RemovalWork = { controller, callers, promise: pending, settled: false,
          progress: { stage: 'preparing', current: 0, total: 1, message: 'Waiting for the NOX worker.' } };
        job = created; inflight.set(key, job); queue = pending.then(() => {}, () => {});
        void pending.finally(() => { created.settled = true; if (inflight.get(key) === created) inflight.delete(key); }).catch(() => {});
      }
      return await joinJob(key, job, signal, onProgress);
    } finally { waiting--; }
  };
  async function resolveApplied(resultId: string, imageId: string, originalPreviewSha256: string) {
    if (!resultToken(resultId)) throw new TypeError('Invalid applied removal result identity.');
    const [key, resultSha] = resultId.split('.'), directory = `${cachePath}-applied/${key}`;
    const request: RemovalRequest = { imageId, action: 'apply' }, proof = await sourceFor(request);
    const preview = await overview(request, proof);
    if (preview.sourcePreviewSha256 !== originalPreviewSha256) throw new TypeError('Applied removal original preview differs.');
    const saved = await json(`${directory}/request.json`), { scriptSha256, planSha256, ...work } = saved;
    const preserve = work.treatment === 'preserve' ? { reason: work.reason, implementationSha: hash(await pinned(preserveImplementationPath)) } : undefined;
    if (Boolean(preserve) !== Boolean(proof.preserve) || (preserve && preserve.reason !== proof.preserve?.reason))
      throw new TypeError('Saved stellar treatment differs from this image\'s configured treatment.');
    const scriptSha = preserve ? preserve.implementationSha : hash(await pinned(scriptPath));
    if (!preserve) await pinned(modelPath, modelSha256);
    // Catalogue/proof relocation cannot change already verified native NOX pixels. Validate the saved key
    // with its original plan hash while checking current source/model/script/baseline content below.
    if (scriptSha !== scriptSha256 || work.operation !== 'apply' ||
        JSON.stringify(work.source) !== JSON.stringify(proof.source) || JSON.stringify(work.baseline) !== JSON.stringify(proof.baseline) ||
        (preserve ? work.implementation?.sha256 !== preserve.implementationSha || work.implementation?.path !== preserveImplementationPath
          : work.model?.sha256 !== modelSha256 || work.model?.path !== modelPath) ||
        hash(JSON.stringify([scriptSha, planSha256, work])) !== key)
      throw new TypeError('Applied native source or implementation is stale.');
    await pinned(`${directory}/result.json`, resultSha);
    const result = await resultAt(resolve(root, directory), request, proof.source, originalPreviewSha256, scriptSha, modelSha256, proof.baseline?.sha256 ?? null, preserve);
    return { value: { sourceSha256: proof.source.sha256, nativeDimensions: proof.source.nativeDimensions, layers: result.applied!.layers } as AppliedLayers, files: [...verifiedInputs] };
  }
  async function discoverApplied(imageId: string, previewSha256: string): Promise<string | null> {
    const request = parseRemovalRequest({ imageId, action: 'overview' });
    const proof = await sourceFor(request), preview = await overview(request, proof);
    if (preview.sourcePreviewSha256 !== previewSha256) throw new TypeError('Applied removal original preview differs.');
    const candidates: { id: string; modified: number }[] = [];
    for (const key of await readdir(appliedCache).catch(error => { if (error.code === 'ENOENT') return []; throw error; })) {
      if (!/^[a-f0-9]{64}$/.test(key)) continue;
      try {
        const directory = `${cachePath}-applied/${key}`, saved = await json(`${directory}/request.json`);
        if (saved.operation !== 'apply' || saved.source?.sha256 !== proof.source.sha256) continue;
        const bytes = await pinned(`${directory}/result.json`);
        candidates.push({ id: `${key}.${hash(bytes)}`, modified: (await stat(resolve(appliedCache, key, 'result.json'))).mtimeMs });
      } catch { /* Incomplete native runs are not available image layers. */ }
    }
    candidates.sort((a, b) => b.modified - a.modified);
    for (const candidate of candidates) {
      try { await resolveApplied(candidate.id, imageId, previewSha256); return candidate.id; }
      catch { /* Stale source/model/code pins or damaged artifacts must never be restored. */ }
    }
    return null;
  }
  return Object.assign(sample, { resolveApplied, discoverApplied });
}

export function starRemovalPlugin(repositoryRoot: string): Plugin {
  return { name: 'nebula-local-star-removal-nox', configureServer(server) {
  const sample = createStarRemover(repositoryRoot);
  const jobs = createStarRemovalJobs(repositoryRoot, { sample, parseRequest: parseRemovalRequest, validateResult: async result => {
    if (!record(result) || !record(result.applied)) throw new TypeError('Apply did not publish verified image layers.');
    await restoreAppliedRemovalResult(repositoryRoot, { imageId: result.imageId, resultId: result.applied.resultId, sourcePreviewSha256: result.sourcePreviewSha256 });
  } });

    server.middlewares.use('/__nebula/star-removal-jobs', starRemovalJobsHandler(jobs));
    server.httpServer?.once('close', () => { void jobs.shutdown().catch(() => {}); });
    server.middlewares.use('/__nebula/star-removal', async (request, response) => {
      const streaming = request.headers.accept?.includes('application/x-ndjson'), controller = new AbortController();
      const close = () => { if (!response.writableFinished) controller.abort(); };
      response.on('close', close);
      const event = (value: unknown) => {
        if (response.destroyed || controller.signal.aborted) return;
        if (!response.headersSent) { response.setHeader('Content-Type', 'application/x-ndjson'); response.setHeader('Cache-Control', 'no-store'); }
        response.write(JSON.stringify(value) + '\n');
      };
      const reply = (status: number, value: unknown) => {
        if (response.destroyed || controller.signal.aborted) return;
        response.statusCode = status; response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(value));
      };
      if (request.method !== 'POST') { reply(405, { error: 'Use POST for star removal.' }); return; }
      try {
        if (!request.headers['content-type']?.startsWith('application/json') ||
            (request.headers.origin && new URL(request.headers.origin).host !== request.headers.host)) throw new TypeError('Expected a local JSON request.');
        let body = ''; for await (const chunk of request) { body += chunk.toString(); if (body.length > 16384) throw new TypeError('Removal request is too large.'); }
        const input = JSON.parse(body), path = (request.url ?? '').split('?')[0];
        if (path === '/restore' || path === '/__nebula/star-removal/restore') {
          const result = await restoreAppliedRemovalResult(repositoryRoot, input); controller.signal.throwIfAborted(); reply(200, result); return;
        }
        const result = await sample(input, controller.signal, streaming ? progress => event({ type: 'progress', ...progress }) : undefined);
        if (streaming) { event({ type: 'result', result }); response.end(); } else reply(200, result);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Star removal failed.';
        if (streaming && !controller.signal.aborted) { event({ type: 'error', message }); response.end(); }
        else reply(error instanceof TypeError || error instanceof SyntaxError ? 400 : 500, { error: message });
      } finally { response.removeListener('close', close); }
    });
  } };
}
