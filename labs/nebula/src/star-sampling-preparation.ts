/** Local native-pixel analysis. This endpoint never replaces a source or prepares a cloud. */
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, readFile, readdir, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';
import sharp from 'sharp';
import { overlayVariantsPath, parseOverlayVariants, variantsForImage } from './overlay-variants.js';
import { createStarRemovalJobs, starRemovalJobsHandler } from './star-removal-job-server.js';

type Point = { x: number; y: number };
export interface SamplingRequest {
  imageId: string; action: 'overview' | 'survey' | 'inspect' | 'preview' | 'apply'; point?: Point; points?: Point[]; calibrationToken?: string;
  controls?: { widthScale?: number; amplitudeScale?: number; betaOverride?: number | null };
  options?: { sampleCount?: number; maximumRadius?: number };
}
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const numeric = (value: unknown, low: number, high: number) => typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high;
const keys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key));
const point = (value: unknown): value is Point => record(value) && keys(value, ['x', 'y']) && numeric(value.x, 0, 100000) && numeric(value.y, 0, 100000);
const hash = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const planPath = 'labs/nebula/models/lmc-star-separation/plan.json';
const scriptPath = 'labs/nebula/src/star-sampling.py';
const cachePath = '.local/nebula-lab/star-sampling';
const resultToken = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(value);
interface AppliedLayers { sourceSha256: string; nativeDimensions: number[]; layers: { id: 'diffuse' | 'stars'; texturePath: string; sha256: string; widthPx: number; heightPx: number }[] }
const resolvedApplications = new Map<string, { stamps: [string, string][]; value: AppliedLayers }>();
async function fileStamp(path: string) { const value = await stat(path); return [value.dev, value.ino, value.size, value.mtimeMs, value.ctimeMs].join(':'); }
export async function resolveAppliedSamplingLayers(root: string, resultId: string, imageId: string, originalPreviewSha256: string): Promise<AppliedLayers> {
  const key = JSON.stringify([await realpath(root), resultId, imageId, originalPreviewSha256]), cached = resolvedApplications.get(key);
  if (cached && (await Promise.all(cached.stamps.map(async ([path, stamp]) => (await fileStamp(path).catch(() => '')) === stamp))).every(Boolean)) return cached.value;
  const resolved = await createStarSampler(root).resolveApplied(resultId, imageId, originalPreviewSha256);
  const stamps = await Promise.all(resolved.files.map(async path => [path, await fileStamp(path)] as [string, string]));
  resolvedApplications.set(key, { stamps, value: resolved.value });
  if (resolvedApplications.size > 16) resolvedApplications.delete(resolvedApplications.keys().next().value!);
  return resolved.value;
}
export async function restoreAppliedSamplingResult(root: string, input: unknown) {
  if (!record(input) || !keys(input, ['imageId', 'resultId', 'sourcePreviewSha256']) || typeof input.imageId !== 'string' ||
      !/^[a-z0-9-]+$/.test(input.imageId) || !resultToken(input.resultId) || typeof input.sourcePreviewSha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(input.sourcePreviewSha256)) throw new TypeError('Invalid saved applied image identity.');
  const resolved = await resolveAppliedSamplingLayers(root, input.resultId, input.imageId, input.sourcePreviewSha256);
  const layers = await Promise.all(resolved.layers.map(async layer => ({ ...layer, url: `/@fs${await realpath(resolve(root, layer.texturePath))}` })));
  return { imageId: input.imageId, sourceSha256: resolved.sourceSha256, sourcePreviewSha256: input.sourcePreviewSha256,
    nativeDimensions: resolved.nativeDimensions, applied: { resultId: input.resultId, layers } };
}

export function parseSamplingRequest(input: unknown): SamplingRequest {
  if (!record(input) || !keys(input, ['imageId', 'action', 'point', 'points', 'controls', 'options', 'calibrationToken']) ||
      typeof input.imageId !== 'string' || !/^[a-z0-9-]+$/.test(input.imageId) ||
      !['overview', 'survey', 'inspect', 'preview', 'apply'].includes(input.action as string) ||
      (input.action === 'apply' ? !resultToken(input.calibrationToken) : input.calibrationToken !== undefined) ||
      (input.action === 'inspect' ? !point(input.point) : input.point !== undefined) ||
      (['preview', 'apply'].includes(input.action as string) ? !Array.isArray(input.points) || input.points.length < 1 || input.points.length > 50 || !input.points.every(point) : input.points !== undefined))
    throw new TypeError('Invalid star sampling request.');
  if (input.controls !== undefined && (!record(input.controls) || !keys(input.controls, ['widthScale', 'amplitudeScale', 'betaOverride']) ||
      (input.controls.widthScale !== undefined && !numeric(input.controls.widthScale, .5, 3)) ||
      (input.controls.amplitudeScale !== undefined && !numeric(input.controls.amplitudeScale, 0, 1.5)) ||
      (input.controls.betaOverride !== undefined && input.controls.betaOverride !== null && !numeric(input.controls.betaOverride, 1.1, 8))))
    throw new TypeError('Invalid star profile controls.');
  if (input.options !== undefined && (!record(input.options) || !keys(input.options, ['sampleCount', 'maximumRadius']) ||
      (input.options.sampleCount !== undefined && (!numeric(input.options.sampleCount, 20, 50) || !Number.isInteger(input.options.sampleCount))) ||
      (input.options.maximumRadius !== undefined && (!numeric(input.options.maximumRadius, 16, 128) || !Number.isInteger(input.options.maximumRadius)))))
    throw new TypeError('Invalid star sampling bounds.');
  return input as unknown as SamplingRequest;
}

export interface SamplingProgress { stage: string; current: number; total: number; message: string }
type ProgressListener = (progress: SamplingProgress) => void;
export type SamplerRunner = (request: Record<string, unknown>, directory: string, signal: AbortSignal, onProgress: ProgressListener) => Promise<void>;
interface SamplingJob { controller: AbortController; callers: Map<symbol, ProgressListener | undefined>; promise: Promise<unknown>; settled: boolean; progress?: SamplingProgress }
const cancelled = () => new DOMException('Star sampling cancelled.', 'AbortError');
const notify = (listener: ProgressListener | undefined, progress: SamplingProgress) => { try { listener?.(progress); } catch { /* A disconnected progress consumer cannot fail another caller. */ } };
export function createStarSampler(repositoryRoot: string, options: { runner?: SamplerRunner; pythonPath?: string; timeoutMs?: number; applyTimeoutMs?: number; maximumCacheBytes?: number; maximumApplyCacheBytes?: number } = {}) {
  const root = resolve(repositoryRoot), cache = resolve(root, cachePath), appliedCache = resolve(root, `${cachePath}-applied`);
  const verifiedInputs = new Set<string>();
  const inflight = new Map<string, SamplingJob>();
  let queue = Promise.resolve(), waiting = 0;
  async function safePath(path: string) {
    if (typeof path !== 'string' || isAbsolute(path) || path.split(/[\\/]/).includes('..')) throw new TypeError('Invalid local sampling path.');
    const full = await realpath(resolve(root, path)), fromRoot = relative(await realpath(root), full);
    if (fromRoot.startsWith(`..${sep}`) || fromRoot === '..' || isAbsolute(fromRoot)) throw new TypeError('Sampling path escapes the repository.');
    return full;
  }
  async function pinned(path: string, expected?: string) {
    const full = await safePath(path), bytes = await readFile(full);
    if (expected !== undefined && hash(bytes) !== expected) throw new TypeError(`Sampling input hash differs: ${path}`);
    verifiedInputs.add(full); verifiedInputs.add(resolve(root, path)); return bytes;
  }
  const json = async (path: string, expected?: string) => JSON.parse((await pinned(path, expected)).toString());
  async function sourceFor(request: SamplingRequest) {
    const planBytes = await pinned(planPath), plan = JSON.parse(planBytes.toString());
    const selection = plan.selections?.find((value: { id: string }) => value.id === request.imageId);
    if (plan.schema !== 'cssearth-image-processing-plan@1' || !selection) throw new TypeError('This image has not been selected for star-removal trials.');
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
      throw new TypeError('Sampling source differs from its verified native image registration.');
    await pinned(proof.gate.path, proof.gate.sha256);
    const dimensions = recipe.source.nativeDimensions;
    if (!Array.isArray(dimensions) || dimensions.length !== 2 || !dimensions.every(value => Number.isInteger(value) && value > 0 && value <= 40000)) throw new TypeError('Invalid native image dimensions.');
    if ([...(request.points ?? []), ...(request.point ? [request.point] : [])].some(value => value.x > dimensions[0] - 1 || value.y > dimensions[1] - 1))
      throw new TypeError('Star sample lies outside the native image.');
    await pinned(recipe.source.path, recipe.source.sha256);
    // The original detections are suggestions, not the old width-filtered acceptance list.
    const receiptPath = `${recipe.outputDirectory}/receipt.json`, receiptBytes = await pinned(receiptPath), receipt = JSON.parse(receiptBytes.toString());
    if (receipt.sourceSha256 !== recipe.source.sha256 || receipt.recipeSha256 !== selection.recipeSha256 || receipt.detectionsWrittenBeforeSeparation !== true)
      throw new TypeError('Original star detections are not bound to this source.');
    const detectionPath = `${recipe.outputDirectory}/star-detections.json`, detectionSha = receipt.outputs?.['star-detections.json']?.sha256;
    if (typeof detectionSha !== 'string') throw new TypeError('Original star detections are missing.');
    await pinned(detectionPath, detectionSha);
    return { source: recipe.source, detections: { path: detectionPath, sha256: detectionSha }, planSha256: hash(planBytes), directory: target.directory,
      baseline: { receiptPath, receiptSha256: hash(receiptBytes), outputDirectory: recipe.outputDirectory } };
  }
  async function verifyBaseline(proof: Awaited<ReturnType<typeof sourceFor>>) {
    const baseline = proof.baseline, receipt = await json(baseline.receiptPath, baseline.receiptSha256), checks = receipt.verification;
    if (receipt.schema !== 'cssearth-star-separation-receipt@1' || receipt.sourceSha256 !== proof.source.sha256 ||
        receipt.source?.path !== proof.source.path || JSON.stringify(receipt.source?.nativeDimensions) !== JSON.stringify(proof.source.nativeDimensions) ||
        checks?.maximumReconstructionErrorCodeValues !== 0 || checks?.changedPixelsOutsideMask !== 0 || checks?.encodedRoundTripExact !== true)
      throw new TypeError('Approved baseline is not bound to this native source and exact accounting.');
    for (const name of ['diffuse.png', 'stars.png', 'star-mask.png']) {
      const expected = receipt.outputs?.[name]?.sha256;
      if (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected)) throw new TypeError('Approved baseline artifact pin is missing.');
      const bytes = await pinned(`${baseline.outputDirectory}/${name}`, expected), metadata = await sharp(bytes, { unlimited: true }).metadata();
      if (metadata.width !== proof.source.nativeDimensions[0] || metadata.height !== proof.source.nativeDimensions[1])
        throw new TypeError('Approved baseline changed the native pixel grid.');
    }
    return baseline;
  }
  async function overview(request: SamplingRequest, proof: Awaited<ReturnType<typeof sourceFor>>) {
    const manifestPath = `${proof.directory}/overlays.json`, manifest = await json(manifestPath);
    const image = manifest.overlays?.find((value: { id: string }) => value.id === request.imageId);
    const variants = parseOverlayVariants(await json(overlayVariantsPath));
    if (!image || variants.find(row => row.imageId === request.imageId)?.sourceSha256 !== proof.source.sha256 || !variantsForImage(variants, image).length)
      throw new TypeError('Original preview is not bound to this native sampling source.');
    const path = relative(root, resolve(root, dirname(manifestPath), image.texturePath));
    const bytes = await pinned(path, image.sha256), metadata = await sharp(bytes).metadata();
    if (metadata.width !== image.widthPx || metadata.height !== image.heightPx) throw new TypeError('Original preview pixel grid differs.');
    return { schema: 'cssearth-star-sampling-result@1', imageId: request.imageId, operation: 'overview', sourceSha256: proof.source.sha256,
      nativeDimensions: proof.source.nativeDimensions, sourcePreviewSha256: image.sha256,
      overview: { url: `/@fs${await safePath(path)}`, dimensions: [image.widthPx, image.heightPx] }, samples: [], calibration: null,
      limitations: ['Original prepared preview on the full native image extent. No stars have been measured; sample widths use native pixels.'] };
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
      throw new Error('Star sampling cache is full. Clear unused local sample results before starting more analyses; existing previews were preserved.');
  }
  const run: SamplerRunner = options.runner ?? (async (request, directory, signal, onProgress) => {
    const python = options.pythonPath ?? resolve(root, '.local/nebula-lab/registration/venv/bin/python');
    await stat(python).catch(() => { throw new Error('Star sampling needs the local analysis environment. Follow the lab star-sampling setup.'); });
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
            if (event.stage === 'complete') completed = true;
            else if (typeof event.stage === 'string' && typeof event.message === 'string' && numeric(event.current, 0, 100000) &&
              numeric(event.total, event.current, 100000)) onProgress({ stage: event.stage, current: event.current, total: event.total, message: event.message });
          } catch { /* Non-progress diagnostic output is not completion evidence. */ }
        }
      });
      child.stderr.on('data', bytes => { errors = (errors + bytes.toString()).slice(-4096); });
      const cleanup = () => { clearTimeout(timeout); signal.removeEventListener('abort', abort); };
      child.on('error', error => { cleanup(); reject(error); });
      child.on('close', code => {
        cleanup();
        if (signal.aborted) reject(cancelled());
        else if (code !== 0 || !completed) reject(new Error(timedOut ? 'Star sampling timed out; use fewer samples.' : `Star sampling failed: ${errors || 'no completion evidence'}`));
        else done();
      });
      child.stdin.on('error', () => {});
      child.stdin.end(JSON.stringify({ ...request, outputDirectory: relative(root, directory).split(sep).join('/') }));
    });
  });
  async function resultAt(directory: string, request: SamplingRequest, source: { sha256: string; nativeDimensions: number[] }, previewSha?: string, calibrationSha?: string, baselineSha?: string) {
    const canonicalDirectory = await realpath(directory);
    const resultBytes = await readFile(resolve(directory, 'result.json')), result = JSON.parse(resultBytes.toString());
    const token = `${basename(directory).replace(/\.pending$/, '')}.${hash(resultBytes)}`;
    if (result.schema !== 'cssearth-star-sampling-result@1' || result.operation !== request.action || result.sourceSha256 !== source.sha256 ||
        JSON.stringify(result.nativeDimensions) !== JSON.stringify(source.nativeDimensions) || !Array.isArray(result.samples) || result.samples.length > 50 ||
        (result.validationSamples !== undefined && (!Array.isArray(result.validationSamples) || result.validationSamples.length > 20)))
      throw new TypeError('Star sampling result does not match its request.');
    async function artifact(path: unknown, dimensions?: number[], requireHash = false) {
      if (typeof path !== 'string' || isAbsolute(path) || path.split(/[\\/]/).includes('..') || !path.endsWith('.png')) throw new TypeError('Invalid sample preview path.');
      const full = await realpath(resolve(directory, path));
      if (!full.startsWith(`${canonicalDirectory}${sep}`) || (await stat(full)).size === 0) throw new TypeError('Sample preview is missing or outside its output directory.');
      verifiedInputs.add(full); verifiedInputs.add(resolve(directory, path));
      const bytes = await readFile(full), expected = result.artifactSha256?.[path];
      if ((requireHash || result.artifactSha256 !== undefined) &&
          (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected) || hash(bytes) !== expected))
        throw new TypeError('Sample preview hash differs from its sampling result.');
      try {
        const metadata = await sharp(bytes).metadata();
        if (metadata.format !== 'png' || !metadata.width || !metadata.height ||
            (dimensions && (metadata.width !== dimensions[0] || metadata.height !== dimensions[1]))) throw new Error('Invalid preview pixel grid.');
        await sharp(bytes).raw().toBuffer();
      } catch { throw new TypeError('Sample preview is not a decodable PNG on its declared pixel grid.'); }
      return `/@fs${full}`;
    }
    result.overview = { url: await artifact(result.overview.path, result.overview.dimensions), dimensions: result.overview.dimensions };
    async function sampleArtifacts(sample: unknown, validation = false) {
      if (!record(sample) || !point(sample.point) || sample.point.x > source.nativeDimensions[0] - 1 || sample.point.y > source.nativeDimensions[1] - 1 ||
          !record(sample.images) || !record(sample.cutout)) throw new TypeError('Invalid measured sample.');
      const cutout = sample.cutout, [x, y, width, height] = ['x', 'y', 'width', 'height'].map(key => cutout[key] as number);
      if (![x, y, width, height].every(Number.isInteger) || x < 0 || y < 0 || width < 1 || height < 1 ||
          x + width > source.nativeDimensions[0] || y + height > source.nativeDimensions[1]) throw new TypeError('Invalid native sample cutout.');
      if (validation && (typeof sample.accepted !== 'boolean' || sample.modelKind !== 'shared-profile-bank' ||
          (sample.profileId !== null && typeof sample.profileId !== 'string') || !Array.isArray(sample.reasons) || !sample.reasons.every(reason => typeof reason === 'string')))
        throw new TypeError('Invalid shared-profile validation sample.');
      for (const name of ['source', 'model', 'residual', 'comparison', ...(sample.images.mask !== undefined ? ['mask'] : [])])
        sample.images[name] = await artifact(sample.images[name], name === 'comparison' ? undefined : [width, height], validation);
    }
    for (const sample of result.samples) await sampleArtifacts(sample);
    for (const sample of result.validationSamples ?? []) await sampleArtifacts(sample, true);
    if (request.action === 'preview' && result.recipe?.schema === 'cssearth-star-profile-bank@1' && result.calibration?.profileBank?.length)
      result.calibrationToken = token;
    if (request.action === 'apply') {
      const applied = result.appliedImage, verification = applied?.verification;
      if (!applied || JSON.stringify(applied.nativeDimensions) !== JSON.stringify(source.nativeDimensions) || !calibrationSha ||
          applied.calibrationRecipeSha256 !== calibrationSha || !baselineSha || applied.baselineReceiptSha256 !== baselineSha ||
          verification?.baselineRestoredPixels !== 0 || verification?.maximumReconstructionErrorCodeValues !== 0 ||
          verification?.changedPixelsOutsideMask !== 0 || verification?.encodedRoundTripExact !== true)
        throw new TypeError('Whole-image output does not match its calibrated native source or accounting.');
      const native: Record<string, string> = {};
      for (const name of ['diffuse', 'stars', 'mask']) native[name] = await artifact(applied.images?.[name], source.nativeDimensions, true);
      const comparisonUrl = await artifact(applied.previews?.comparison, undefined, true);
      const layers = [];
      for (const id of ['diffuse', 'stars'] as const) {
        const url = await artifact(applied.previews?.[id], undefined, true), path = url.slice(4), metadata = await sharp(path).metadata();
        const width = metadata.width!, height = metadata.height!;
        if (width > 4096 || height > 4096 || Math.abs(width / height / (source.nativeDimensions[0] / source.nativeDimensions[1]) - 1) > .001)
          throw new TypeError('Whole-image preview changed the native image extent.');
        layers.push({ id, url, texturePath: relative(await realpath(root), path).split(sep).join('/'),
          sha256: result.artifactSha256[applied.previews[id]], widthPx: width, heightPx: height });
      }
      result.applied = { resultId: token, sourceSha256: source.sha256, sourcePreviewSha256: previewSha,
        nativeDimensions: source.nativeDimensions, native, comparisonUrl, layers, counts: applied.counts, verification };
    }
    delete result.artifactsRelativeTo;
    return { ...result, imageId: request.imageId, ...(previewSha ? { sourcePreviewSha256: previewSha } : {}) };
  }
  function joinJob(key: string, job: SamplingJob, signal?: AbortSignal, onProgress?: ProgressListener) {
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
    const request = parseSamplingRequest(input);
    signal?.throwIfAborted();
    if (waiting >= 4) throw new Error('Star sampling is busy; try again shortly.');
    waiting++;
    try {
      notify(onProgress, { stage: 'validating', current: 0, total: 1, message: 'Verifying native source and alignment evidence.' });
      const proof = await sourceFor(request);
      signal?.throwIfAborted();
      notify(onProgress, { stage: 'validating', current: 1, total: 1, message: 'Native source and alignment verified.' });
      if (request.action === 'overview') {
        const result = await overview(request, proof); signal?.throwIfAborted();
        notify(onProgress, { stage: 'preparing', current: 1, total: 1, message: 'Original preview ready. No fitting started.' });
        return result;
      }
      const scriptSha = hash(await pinned(scriptPath));
      const baseWork = { schema: 'cssearth-star-sampling@1', operation: request.action, source: proof.source, detections: proof.detections,
        ...(request.point ? { point: request.point } : {}), ...(request.points ? { points: request.points } : {}),
        options: { sampleCount: 30, maximumCandidates: 240, maximumRadius: 128, ...request.options },
        controls: { widthScale: 1, amplitudeScale: 1, betaOverride: null, ...request.controls } };
      const previewSha = ['preview', 'apply'].includes(request.action) ? (await overview(request, proof)).sourcePreviewSha256 : undefined;
      let calibration: { recipePath: string; recipeSha256: string } | undefined;
      if (request.action === 'apply') {
        const [calibrationKey, resultSha] = request.calibrationToken!.split('.');
        if (calibrationKey !== hash(JSON.stringify([scriptSha, proof.planSha256, { ...baseWork, operation: 'preview' }])))
          throw new TypeError('Calibration is stale; calibrate these exact source points and controls before applying.');
        const result = await json(`${cachePath}/${calibrationKey}/result.json`, resultSha);
        await resultAt(resolve(cache, calibrationKey), { ...request, action: 'preview' }, proof.source);
        if (result.recipe?.schema !== 'cssearth-star-profile-bank@1' || !result.recipe.profileBank?.length ||
            result.recipe.scriptSha256 !== scriptSha || JSON.stringify(result.recipe.source) !== JSON.stringify(proof.source))
          throw new TypeError('Calibration has no current qualified profile bank.');
        calibration = { recipePath: `${cachePath}/${calibrationKey}/bank-recipe.json`, recipeSha256: hash(JSON.stringify(result.recipe, null, 2) + '\n') };
        await pinned(calibration.recipePath, calibration.recipeSha256);
      }
      const baseline = request.action === 'apply' ? await verifyBaseline(proof) : undefined;
      const work = { ...baseWork, ...(calibration ? { calibration, baseline } : {}) };
      const key = hash(JSON.stringify([scriptSha, proof.planSha256, work])), directory = resolve(request.action === 'apply' ? appliedCache : cache, key);
      const complete = await stat(resolve(directory, 'result.json')).catch(() => null);
      signal?.throwIfAborted();
      if (complete) {
        const result = await resultAt(directory, request, proof.source, previewSha, calibration?.recipeSha256, baseline?.receiptSha256); signal?.throwIfAborted();
        notify(onProgress, { stage: 'cached', current: 1, total: 1, message: 'Verified saved sample result loaded.' });
        return result;
      }
      let job = inflight.get(key);
      if (!job) {
        const controller = new AbortController(), callers = new Map<symbol, ProgressListener | undefined>();
        const progress = (value: SamplingProgress) => { created.progress = value; for (const listener of callers.values()) notify(listener, value); };
        const pending = queue.then(async () => {
          controller.signal.throwIfAborted();
          await checkCacheSpace(request.action === 'apply'); controller.signal.throwIfAborted();
          const temporary = `${directory}.pending`;
          await rm(temporary, { recursive: true, force: true }); await mkdir(temporary, { recursive: true });
          try {
            controller.signal.throwIfAborted();
            progress({ stage: 'preparing', current: 0, total: 1, message: 'Preparing native sample analysis.' });
            await run(work, temporary, controller.signal, progress); controller.signal.throwIfAborted();
            progress({ stage: 'previews', current: 0, total: 1, message: 'Verifying measured sample images.' });
            const checked = await resultAt(temporary, request, proof.source, previewSha, calibration?.recipeSha256, baseline?.receiptSha256);
            controller.signal.throwIfAborted();
            if (checked.calibrationToken) await writeFile(resolve(temporary, 'bank-recipe.json'), JSON.stringify(checked.recipe, null, 2) + '\n');
            await writeFile(resolve(temporary, 'request.json'), JSON.stringify({ ...work, scriptSha256: scriptSha, planSha256: proof.planSha256 }, null, 2) + '\n');
            await checkCacheSpace(request.action === 'apply'); controller.signal.throwIfAborted();
            await rename(temporary, directory);
            const result = await resultAt(directory, request, proof.source, previewSha, calibration?.recipeSha256, baseline?.receiptSha256);
            progress({ stage: 'previews', current: 1, total: 1, message: 'Verified sample previews ready.' });
            return result;
          } catch (error) { await rm(temporary, { recursive: true, force: true }); throw error; }
        });
        const created: SamplingJob = { controller, callers, promise: pending, settled: false,
          progress: { stage: 'preparing', current: 0, total: 1, message: 'Waiting for the native analysis worker.' } };
        job = created; inflight.set(key, job); queue = pending.then(() => {}, () => {});
        void pending.finally(() => { created.settled = true; if (inflight.get(key) === created) inflight.delete(key); }).catch(() => {});
      }
      return await joinJob(key, job, signal, onProgress);
    } finally { waiting--; }
  };
  async function resolveApplied(resultId: string, imageId: string, originalPreviewSha256: string) {
    if (!resultToken(resultId)) throw new TypeError('Invalid applied sampling result identity.');
    const [key, resultSha] = resultId.split('.'), directory = `${cachePath}-applied/${key}`;
    const request: SamplingRequest = { imageId, action: 'apply' }, proof = await sourceFor(request);
    const preview = await overview(request, proof);
    if (preview.sourcePreviewSha256 !== originalPreviewSha256) throw new TypeError('Applied sampling original preview differs.');
    const saved = await json(`${directory}/request.json`), { scriptSha256, planSha256, ...work } = saved;
    const scriptSha = hash(await pinned(scriptPath));
    if (scriptSha !== scriptSha256 || proof.planSha256 !== planSha256 || work.operation !== 'apply' ||
        JSON.stringify(work.source) !== JSON.stringify(proof.source) || JSON.stringify(work.baseline) !== JSON.stringify(proof.baseline) ||
        hash(JSON.stringify([scriptSha, planSha256, work])) !== key)
      throw new TypeError('Applied sampling source or implementation is stale.');
    await verifyBaseline(proof);
    await pinned(work.calibration.recipePath, work.calibration.recipeSha256);
    await pinned(`${directory}/result.json`, resultSha);
    const result = await resultAt(resolve(root, directory), request, proof.source, originalPreviewSha256, work.calibration.recipeSha256, proof.baseline.receiptSha256);
    return { value: { sourceSha256: proof.source.sha256, nativeDimensions: proof.source.nativeDimensions, layers: result.applied.layers } as AppliedLayers, files: [...verifiedInputs] };
  }
  return Object.assign(sample, { resolveApplied });
}

export function starSamplingPlugin(repositoryRoot: string): Plugin {
  const sample = createStarSampler(repositoryRoot);
  const jobs = createStarRemovalJobs(repositoryRoot, { sample, parseRequest: parseSamplingRequest, validateResult: async result => {
    if (!record(result) || !record(result.applied)) throw new TypeError('Apply did not publish verified image layers.');
    await restoreAppliedSamplingResult(repositoryRoot, { imageId: result.imageId, resultId: result.applied.resultId, sourcePreviewSha256: result.sourcePreviewSha256 });
  } });
  return { name: 'nebula-local-star-sampling', configureServer(server) {
    server.middlewares.use('/__nebula/star-removal-jobs', starRemovalJobsHandler(jobs));
    server.httpServer?.once('close', () => { void jobs.shutdown().catch(() => {}); });
    server.middlewares.use('/__nebula/star-samples', async (request, response) => {
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
      if (request.method !== 'POST') { reply(405, { error: 'Use POST for star sampling.' }); return; }
      try {
        if (!request.headers['content-type']?.startsWith('application/json') ||
            (request.headers.origin && new URL(request.headers.origin).host !== request.headers.host)) throw new TypeError('Expected a local JSON request.');
        let body = ''; for await (const chunk of request) { body += chunk.toString(); if (body.length > 16384) throw new TypeError('Sampling request is too large.'); }
        const input = JSON.parse(body), path = (request.url ?? '').split('?')[0];
        if (path === '/restore' || path === '/__nebula/star-samples/restore') {
          const result = await restoreAppliedSamplingResult(repositoryRoot, input); controller.signal.throwIfAborted(); reply(200, result); return;
        }
        const result = await sample(input, controller.signal, streaming ? progress => event({ type: 'progress', ...progress }) : undefined);
        if (streaming) { event({ type: 'result', result }); response.end(); } else reply(200, result);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Star sampling failed.';
        if (streaming && !controller.signal.aborted) { event({ type: 'error', message }); response.end(); }
        else reply(error instanceof TypeError || error instanceof SyntaxError ? 400 : 500, { error: message });
      } finally { response.removeListener('close', close); }
    });
  } };
}
