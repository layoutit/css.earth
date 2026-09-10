import { resolveLabModelPath } from '../utils/model-paths.js';
import { parseLabModelJson } from '../utils/model-paths.js';
/** Local, explicit reconstruction jobs consume saved NOX pixels; they never run star removal. */
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdir, readFile, readdir, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';
import { defaultOverlayPlacement, updateOverlayPlacement } from '../alignment/overlay-placement.js';
import { resolveAppliedRemovalLayers } from '../star-removal/star-removal-preparation.js';
import { createStarRemovalJobs, starRemovalJobsHandler } from '../utils/processing-jobs.js';
import type { RemovalProgress } from '../star-removal/star-removal-types.js';
import type { LabSubjectRecord } from '../viewer/viewer.js';
import type { ReconstructionRequest, ReconstructionCatalogue, PreparedReconstruction, ReconstructionWork } from './reconstruction-types.js';
import { parseCloudAppearance } from './cloud-appearance.js';
import { lensSettingsHandler } from './lens-settings-server.js';

const hash = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const cache = '.local/nebula-lab/reconstructions';
const removalCache = '.local/nebula-lab/star-removal-nox-applied';
const record = (value: unknown): value is Record<string, any> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const token = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
async function safe(root: string, path: string) {
  if (typeof path !== 'string' || isAbsolute(path) || path.split(/[\\/]/).includes('..')) throw new TypeError('Invalid local reconstruction path.');
  const full = await realpath(resolve(root, resolveLabModelPath(path))), offset = relative(await realpath(root), full);
  if (offset === '..' || offset.startsWith(`..${sep}`) || isAbsolute(offset)) throw new TypeError('Reconstruction input leaves the repository.');
  return full;
}
async function pinned(root: string, path: string, expected?: string) {
  const bytes = await readFile(await safe(root, path));
  if (expected && hash(bytes) !== expected) throw new TypeError(`Reconstruction input changed: ${path}`);
  return bytes;
}
const json = async (root: string, path: string, expected?: string) => parseLabModelJson((await pinned(root, path, expected)).toString());
export function parseReconstructionRequest(input: unknown): ReconstructionRequest {
  if (!record(input) || Object.keys(input).some(key => !['action', 'subjectId', 'imageId', 'removalResultId', 'placement', 'appearance'].includes(key)) ||
      input.action !== 'apply' || typeof input.subjectId !== 'string' || !/^[a-z0-9-]+$/.test(input.subjectId) ||
      typeof input.imageId !== 'string' || !/^[a-z0-9-]+$/.test(input.imageId) ||
      typeof input.removalResultId !== 'string' || !/^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(input.removalResultId) || !record(input.placement))
    throw new TypeError('Choose an image with completed star removal before processing.');
  const placement = updateOverlayPlacement(defaultOverlayPlacement(), input.placement);
  return { action: 'apply', subjectId: input.subjectId, imageId: input.imageId, removalResultId: input.removalResultId, placement,
    ...(input.appearance !== undefined ? { appearance: parseCloudAppearance(input.appearance) } : {}) };
}

export async function readPreparedReconstruction(root: string, resultId: string): Promise<PreparedReconstruction> {
  if (!token(resultId)) throw new TypeError('Invalid reconstruction identity.');
  const directory = `${cache}/${resultId}`, result = await json(root, `${directory}/result.json`);
  if (result.schema !== 'cssearth-nebula-reconstruction@1' || result.resultId !== resultId ||
      result.subject?.id !== `reconstruction-${resultId}` || result.subject.directory !== directory)
    throw new TypeError('Saved reconstruction identity differs.');
  const descriptor = await json(root, `${directory}/object.json`);
  if (descriptor.id !== result.subject.id || descriptor.type !== 'density-volume' || !token(descriptor.prepared?.sha256))
    throw new TypeError('Saved reconstruction descriptor differs.');
  await pinned(root, `${directory}/${descriptor.prepared.url}`, descriptor.prepared.sha256);
  return result;
}
export async function resolveReconstructionSubject(root: string, id: string): Promise<LabSubjectRecord | undefined> {
  const match = /^reconstruction-([a-f0-9]{64})$/.exec(id);
  return match ? (await readPreparedReconstruction(root, match[1])).subject : undefined;
}

async function context(root: string, subjectId: string) {
  const subjects = await json(root, 'labs/nebula/src/subjects.json') as LabSubjectRecord[];
  const subject = subjects.find(item => item.id === subjectId);
  if (!subject?.density?.overlays) throw new TypeError('This object has no aligned image catalogue.');
  const plan = await json(root, 'labs/nebula/models/lmc/star-separation/plan.json');
  const catalogue = await json(root, plan.catalogue);
  const target = catalogue.targets.find((item: { directory: string }) => `${item.directory}/overlays.json` === subject.density!.overlays);
  if (!target) throw new TypeError('This object has no reconstruction source catalogue.');
  const overlays = await json(root, subject.density.overlays);
  const alignment = await json(root, plan.alignmentReport.path, plan.alignmentReport.sha256);
  return { subject, target, overlays, alignment };
}
async function alignmentProof(root: string, image: any, alignment: any) {
  const proof = alignment.sources?.find((row: { id: string }) => row.id === image.id);
  const geometry = image.registration ? { kind: 'matched-star-homography', registration: image.registration } : { kind: 'fixed-publisher-wcs', wcs: image.wcs };
  if (alignment.pass !== true || proof?.pass !== true || proof.sourcePath !== image.path || proof.sourceSha256 !== image.sha256 ||
      JSON.stringify(proof.geometry) !== JSON.stringify(geometry)) throw new TypeError('Verify this image’s alignment before reconstructing it.');
  await pinned(root, proof.gate.path, proof.gate.sha256);
  return proof;
}

export async function reconstructionCatalogue(root: string, subjectId: string): Promise<ReconstructionCatalogue> {
  const { subject, target, overlays, alignment } = await context(root, subjectId);
  const removalFiles = await readdir(resolve(root, removalCache)).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
  const removals = [];
  for (const key of removalFiles.filter(token)) {
    try {
      const request = await json(root, `${removalCache}/${key}/request.json`);
      const bytes = await pinned(root, `${removalCache}/${key}/result.json`);
      const result = parseLabModelJson(bytes.toString());
      if (result.operation === 'apply') removals.push({ sourceSha256: request.source.sha256, resultId: `${key}.${hash(bytes)}`,
        modified: (await stat(resolve(root, removalCache, key, 'result.json'))).mtimeMs });
    } catch { /* Incomplete or missing cache entries are not selectable results. */ }
  }
  removals.sort((a, b) => b.modified - a.modified);
  const completed: { result: PreparedReconstruction; modified: number }[] = [];
  const directories = await readdir(resolve(root, cache)).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
  for (const id of directories.filter(token)) {
    try { completed.push({ result: await readPreparedReconstruction(root, id),
      modified: (await stat(resolve(root, cache, id, 'result.json'))).mtimeMs }); } catch { /* A failed bake is not a completed choice. */ }
  }
  completed.sort((a, b) => b.modified - a.modified);
  const candidates = [];
  for (const image of target.images) {
    if (subject.density?.candidateImageIds && !subject.density.candidateImageIds.includes(image.id)) continue;
    const overlay = overlays.overlays.find((item: { id: string }) => item.id === image.id);
    if (!overlay) continue;
    const removal = removals.find(item => item.sourceSha256 === image.sha256);
    let reason: string | undefined;
    try { await alignmentProof(root, image, alignment); } catch (error) { reason = (error as Error).message; }
    if (!removal) reason = 'Remove stars in Alignment first.';
    const prepared = completed.find(({ result }) => result.imageId === image.id && result.removalResultId === removal?.resultId)?.result;
    candidates.push({ imageId: image.id, label: image.label, sourcePageUrl: image.sourcePageUrl, credit: image.credit,
      sourcePreviewSha256: overlay.sha256, removalResultId: removal?.resultId,
      placement: overlay.initialPlacement ?? defaultOverlayPlacement(), placementBasis: overlay.style.transform,
      ready: !reason, ...(reason ? { reason } : {}), ...(prepared ? { prepared } : {}) });
  }
  return { subjectId, overlayCatalogue: subject.density!.overlays!, candidates };
}

type Runner = (work: ReconstructionWork, signal: AbortSignal, progress: (value: RemovalProgress) => void) => Promise<{
  cloudParts?: { descriptor: string; catalogue: string }; framingRadiusUnits?: number; stars?: string; reconstructionOverlay?:string;
}>;
export function createReconstructor(root: string, options: { runner?: Runner } = {}) {
  let queue = Promise.resolve();
  const run: Runner = options.runner ?? (async (work, signal, progress) => {
    const require = createRequire(resolve(root, 'packages/engine/package.json'));
    const { build } = createRequire(require.resolve('tsup'))('esbuild');
    const outfile = resolve(root, '.local/nebula-lab/compiled/reconstruction-worker.mjs');
    await build({ entryPoints: [resolve(root, 'labs/nebula/src/reconstruction/reconstruction-worker.ts')], outfile,
      bundle: true, platform: 'node', format: 'esm', target: 'node22', packages: 'external' });
    signal.throwIfAborted();
    return new Promise((done, reject) => {
      const child = spawn(process.execPath, [outfile], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] });
      let buffered = '', errors = '', completed: Awaited<ReturnType<Runner>> | undefined;
      const abort = () => child.kill('SIGKILL'); signal.addEventListener('abort', abort, { once: true });
      child.stdout.on('data', bytes => {
        buffered += bytes.toString(); const lines = buffered.split('\n'); buffered = lines.pop()!;
        for (const line of lines) {
          try {
            const event = parseLabModelJson(line);
            if (event.type === 'complete') completed = event;
            if (event.type === 'progress' && typeof event.stage === 'string' && typeof event.message === 'string' &&
                Number.isFinite(event.current) && Number.isFinite(event.total)) progress(event);
          } catch { /* Worker diagnostics are not completion evidence. */ }
        }
      });
      child.stderr.on('data', bytes => { errors = (errors + bytes.toString()).slice(-4096); });
      child.once('error', error => { signal.removeEventListener('abort', abort); reject(error); });
      child.once('close', code => {
        signal.removeEventListener('abort', abort);
        if (signal.aborted) reject(new DOMException('Reconstruction cancelled.', 'AbortError'));
        else if (code !== 0 || !completed) reject(new Error(errors || 'Reconstruction produced no completion receipt.'));
        else done(completed);
      });
      child.stdin.on('error', () => {}); child.stdin.end(JSON.stringify(work));
    });
  });
  return async (input: unknown, signal: AbortSignal, progress: (value: RemovalProgress) => void): Promise<PreparedReconstruction> => {
    const request = parseReconstructionRequest(input);
    const operation = queue.then(async () => {
      signal.throwIfAborted(); progress({ stage: 'validating', current: 0, total: 1, message: 'Checking saved starless image and alignment.' });
      const { subject, target, overlays, alignment } = await context(root, request.subjectId);
      const image = target.images.find((item: { id: string }) => item.id === request.imageId);
      const overlay = overlays.overlays.find((item: { id: string }) => item.id === request.imageId);
      if (!image || !overlay) throw new TypeError('Unknown reconstruction image.');
      await alignmentProof(root, image, alignment);
      await resolveAppliedRemovalLayers(root, request.removalResultId, request.imageId, overlay.sha256);
      const [removalKey, removalSha] = request.removalResultId.split('.');
      const removal = await json(root, `${removalCache}/${removalKey}/result.json`, removalSha);
      const nativePath = `${removalCache}/${removalKey}/${removal.applied.images.diffuse}`;
      await pinned(root, nativePath, removal.artifactSha256[removal.applied.images.diffuse]);
      const cloudDirectory=subject.density!.directory,cloudPath=`${cloudDirectory}/object.json`;
      const cloudObject=await json(root,cloudPath),frame=cloudObject.properties.volume;
      const cloudDescriptor={path:cloudPath,sha256:hash(await pinned(root,cloudPath))};
      const densityRecipe={path:`${cloudDirectory}/${cloudObject.properties.preparation.source}`,sha256:cloudObject.properties.preparation.sha256};
      await pinned(root,densityRecipe.path,densityRecipe.sha256);
      const stars = subject.stars ? { path: subject.stars, sha256: hash(await pinned(root, subject.stars)) } : undefined;
      const referenceId=subject.density!.reconstructionReferenceImageId;
      const referencePin=subject.density!.starAlignmentReference;
      const coordinateReference=referencePin ? await json(root,referencePin.path,referencePin.sha256) : undefined;
      if(coordinateReference && coordinateReference.schema!=='cssearth-nebula-star-alignment@1')
        throw new TypeError('Invalid catalogue star alignment reference.');
      const referenceImage=coordinateReference??target.images.find((item:{id:string})=>item.id===referenceId);
      const referenceOverlay=coordinateReference?.overlay??overlays.overlays.find((item:{id:string})=>item.id===referenceId);
      if(stars&&(!referenceImage?.wcs||!referenceOverlay))throw new TypeError('The Alignment cloud requires a configured sky-to-density star reference.');
      const slicesPath=`${cloudDirectory}/prepared/volume-slices.json`;
      const cloud={descriptor:cloudDescriptor,slices:{path:slicesPath,sha256:hash(await pinned(root,slicesPath))},
        provenance:densityRecipe,
        ...(stars?{starAlignment:{wcs:referenceImage.wcs,
          alignment:{style:referenceOverlay.style,pivotCssPx:referenceOverlay.pivotCssPx,
            placement:referenceOverlay.initialPlacement??defaultOverlayPlacement()},
          provenancePin:referencePin??{path:subject.density!.overlays!,sha256:hash(await pinned(root,subject.density!.overlays!))}}}:{})};
      const pins = Object.fromEntries(await Promise.all(['reconstruction/reconstruction-worker.ts', 'reconstruction/reconstruction-geometry.ts', 'reconstruction/filled-components.ts',
        'reconstruction/cloud-material.ts', 'reconstruction/cloud-appearance.ts', 'reconstruction/cloud-detail.ts', 'reconstruction/density-projection.ts', 'reconstruction/registered-image.ts', 'reconstruction/reconstruction-stars.ts', 'reconstruction/filled-products.ts', 'density/observation-prior.ts', 'alignment/overlay-wcs.ts', 'cli/prepare-lmc-stars.ts', 'stars/star-photometry.ts'].map(async name =>
        [name, hash(await pinned(root, `labs/nebula/src/${name}`))])));
      const identity = { version: 4, request, stars, cloud, sourceSha256: image.sha256, frame, stellarPrior: densityRecipe,
        overlay: { widthPx: overlay.widthPx, heightPx: overlay.heightPx, transform: overlay.style.transform, pivotCssPx: overlay.pivotCssPx }, pins };
      const resultId = hash(JSON.stringify(identity)), directory = `${cache}/${resultId}`, temporary = resolve(root, `${directory}.pending`);
      if (await stat(resolve(root, directory, 'result.json')).catch(() => null)) {
        progress({ stage: 'cached', current: 1, total: 1, message: 'Loading saved reconstruction.' }); return readPreparedReconstruction(root, resultId);
      }
      await rm(temporary, { recursive: true, force: true }); await mkdir(temporary, { recursive: true });
      try {
        const work: ReconstructionWork = { schema: 'cssearth-nebula-reconstruction-work@1', id: `reconstruction-${resultId}`,
          imageId: image.id, name: image.label, outputDirectory: temporary, appearance: parseCloudAppearance(request.appearance),
          source: { path: nativePath, sha256: removal.artifactSha256[removal.applied.images.diffuse], width: removal.nativeDimensions[0], height: removal.nativeDimensions[1] },
          original: { path: image.path, sha256: image.sha256, removalResultId: request.removalResultId },
          overlay: { ...identity.overlay, placement: request.placement }, frame, stellarPrior: densityRecipe, stars, cloud,
          sourcePageUrl: image.sourcePageUrl, credit: image.credit };
        const finished = await run(work, signal, progress); signal.throwIfAborted();
        const descriptor = await json(root, relative(root, resolve(temporary, 'object.json')));
        const manifest = await json(root, relative(root, resolve(temporary, descriptor.prepared.url)), descriptor.prepared.sha256);
        if (descriptor.id !== work.id || descriptor.type !== 'density-volume' || !manifest.data?.resources?.length)
          throw new TypeError('Reconstruction worker produced no prepared volume.');
        for (const resource of manifest.data.resources) await pinned(root, relative(root, resolve(temporary, 'prepared', resource.path)), resource.sha256);
        const result: PreparedReconstruction = { schema: 'cssearth-nebula-reconstruction@1', resultId,
          imageId: image.id, removalResultId: request.removalResultId, placement: request.placement, appearance: work.appearance,
          subject: { ...subject, id: work.id, name: `${image.label} · reconstruction`, directory,
            sourceSubjectId: subject.id, imagePath: `${directory}/source/target.png`, comparisonImages: [],
            sourcePageUrl: image.sourcePageUrl, credit: image.credit, stars: finished.stars ? `${directory}/${finished.stars}` : undefined,
            reconstructionOverlay:finished.reconstructionOverlay?`${directory}/${finished.reconstructionOverlay}`:undefined,
            cloudParts: finished.cloudParts, framingRadiusUnits: finished.framingRadiusUnits ?? subject.framingRadiusUnits,
            reconstructionImage: { group: subject.id, label: image.label, note: 'Candidate colors on the unchanged Alignment density cloud; saved placement is preserved.' } } };
        await writeFile(resolve(temporary, 'request.json'), JSON.stringify(identity, null, 2) + '\n');
        await writeFile(resolve(temporary, 'result.json'), JSON.stringify(result, null, 2) + '\n');
        signal.throwIfAborted(); await rename(temporary, resolve(root, directory));
        progress({ stage: 'complete', current: 1, total: 1, message: 'Reconstruction ready.' }); return readPreparedReconstruction(root, resultId);
      } catch (error) { await rm(temporary, { recursive: true, force: true }); throw error; }
    });
    queue = operation.then(() => {}, () => {}); return operation;
  };
}

export function reconstructionPlugin(root: string): Plugin {
  const sample = createReconstructor(root);
  const jobs = createStarRemovalJobs(root, { namespace: 'reconstruction', label: 'Reconstruction', sample,
    parseRequest: parseReconstructionRequest, validateResult: async value => {
      if (!record(value) || !token(value.resultId)) throw new TypeError('Missing reconstruction result.');
      await readPreparedReconstruction(root, value.resultId);
    } });
  return { name: 'nebula-reconstruction', configureServer(server) {
    server.middlewares.use('/__nebula/lens-settings', lensSettingsHandler(root));
    server.middlewares.use('/__nebula/reconstruction-jobs', starRemovalJobsHandler(jobs, '/__nebula/reconstruction-jobs'));
    server.httpServer?.once('close', () => { void jobs.shutdown().catch(() => {}); });
    server.middlewares.use('/__nebula/reconstruction', async (request, response) => {
      try {
        if (request.method !== 'GET') throw new TypeError('Use Preview to start a reconstruction.');
        const url = new URL(request.url ?? '/', 'http://localhost');
        const match = /\/result\/([a-f0-9]{64})$/.exec(url.pathname);
        const value = match ? await readPreparedReconstruction(root, match[1]) : await reconstructionCatalogue(root, url.searchParams.get('subjectId') ?? 'lmc-clouds');
        response.setHeader('Content-Type', 'application/json'); response.setHeader('Cache-Control', 'no-store'); response.end(JSON.stringify(value));
      } catch (error) { response.statusCode = 400; response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ error: (error as Error).message })); }
    });
  } };
}
