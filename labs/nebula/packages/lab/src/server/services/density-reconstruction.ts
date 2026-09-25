import { reconstructionProcessingCapability } from '../../features/reconstruction/reconstruction-capabilities.ts';
import { runProcessingWorker } from '../workers/run.ts';
import { implementationPins } from './implementation.ts';
import { resolveLabModelPath } from '../../resources/model-paths.ts';
import { parseLabModelJson } from '../../resources/model-paths.ts';
/** Local, explicit reconstruction jobs consume saved NOX pixels; they never run star removal. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';
import { defaultOverlayPlacement, updateOverlayPlacement, parseCloudAppearance } from '@cssearth/bake/volume';
import { createStarRemover, resolveAppliedRemovalLayers } from './star-removal.ts';
import { createStarRemovalJobs, starRemovalJobsHandler } from '../jobs/operation-jobs.ts';
import type { RemovalProgress } from '../../features/star-removal/star-removal-types.ts';
import type { LabSubjectRecord } from '../../features/legacy-viewer/controller';
import type { ReconstructionRequest, ReconstructionCatalogue, PreparedReconstruction, ReconstructionWork } from '../../features/reconstruction/reconstruction-types.ts';
import { lensSettingsHandler } from '../routes/lens-settings.ts';
import { discoverFiniteLensBundle, finiteModelStarsPath } from './finite-lens-bundles.ts';
import { lensLevels } from './lens-levels.ts';
import { lensDifferenceHandler } from './lens-difference.ts';
import { lensRadialHandler } from './lens-radial.ts';

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
  if (descriptor.id !== result.subject.id || descriptor.type !== 'density-volume' || typeof descriptor.prepared?.url !== 'string')
    throw new TypeError('Saved reconstruction descriptor differs.');
  await pinned(root, `${directory}/${descriptor.prepared.url}`);
  const provenancePin = descriptor.properties?.preparation;
  if (typeof provenancePin?.source !== 'string')
    return { ...result, processing: reconstructionProcessingCapability(undefined) }; // Historical read-only results cannot gain a repaint capability.
  const provenance = await json(root, `${directory}/${provenancePin.source}`);
  const processing = reconstructionProcessingCapability(provenance.method);
  if (result.finiteMaterial === undefined) return { ...result, processing };
  const finite = result.finiteMaterial;
  if (!record(finite) || !token(finite.modelResultId) || !token(finite.sourceResultId) ||
      !record(provenance.finiteMaterial) || provenance.finiteMaterial.modelResultId !== finite.modelResultId || provenance.finiteMaterial.sourceResultId !== finite.sourceResultId)
    throw new TypeError('Saved finite material differs from its pinned provenance.');
  // A model's catalogue layer belongs to the model, so a lens opened by its own result id carries it too.
  const sourceSubjectId = result.subject.sourceSubjectId;
  const stars = typeof sourceSubjectId === 'string'
    ? await finiteModelStarsPath(root, sourceSubjectId, finite.modelResultId) : undefined;
  // Every lens of one finite model shares its geometry; the viewer still verifies each retained leaf before swapping.
  return { ...result, processing, finiteMaterial: { modelResultId: finite.modelResultId, sourceResultId: finite.sourceResultId },
    subject: { ...result.subject, materialGeometry: finite.modelResultId, ...(stars ? { stars } : {}) } };
}
export async function resolveReconstructionSubject(root: string, id: string): Promise<LabSubjectRecord | undefined> {
  const match = /^reconstruction-([a-f0-9]{64})$/.exec(id);
  return match ? (await readPreparedReconstruction(root, match[1])).subject : undefined;
}

async function context(root: string, subjectId: string) {
  const subjects = await json(root, 'labs/nebula/packages/lab/src/state/subjects.json') as LabSubjectRecord[];
  const subject = subjects.find(item => item.id === subjectId);
  if (!subject?.density?.overlays) throw new TypeError('This object has no aligned image catalogue.');
  if (!subject.density.processingPlan) throw new TypeError('This object has no configured density processing plan.');
  const plan = await json(root, subject.density.processingPlan);
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
  const finite = await discoverFiniteLensBundle(root, subjectId, readPreparedReconstruction);
  const candidates = [], remover = createStarRemover(root);
  for (const image of target.images) {
    if (subject.density?.candidateImageIds && !subject.density.candidateImageIds.includes(image.id)) continue;
    const overlay = overlays.overlays.find((item: { id: string }) => item.id === image.id);
    if (!overlay) continue;
    let reason: string | undefined;
    try { await alignmentProof(root, image, alignment); } catch (error) { reason = (error as Error).message; }
    let removal = removals.find(item => item.sourceSha256 === image.sha256);
    if (!reason && !removal) {
      const resultId = await remover.discoverApplied(image.id, overlay.sha256).catch(() => null);
      if (resultId) removal = { sourceSha256: image.sha256, resultId, modified: 0 };
    }
    if (!removal) reason ??= 'Remove stars in Alignment first.';
    // A finite model owns the Model view: only its baked lenses are displayable, never an older density repaint.
    const prepared = finite ? finite.lenses.find(lens => lens.imageId === image.id)?.result :
      completed.find(({ result }) => result.imageId === image.id && result.removalResultId === removal?.resultId)?.result;
    candidates.push({ imageId: image.id, label: image.label, sourcePageUrl: image.sourcePageUrl, credit: image.credit,
      sourcePreviewSha256: overlay.sha256, removalResultId: removal?.resultId,
      placement: overlay.initialPlacement ?? defaultOverlayPlacement(), placementBasis: overlay.style.transform,
      ready: !reason, ...(reason ? { reason } : {}), ...(prepared ? { prepared } : {}),
      ...(finite && !prepared ? { unavailable: 'No finite lens is baked for this image on the current model.' } : {}) });
  }
  return { subjectId, overlayCatalogue: subject.density!.overlays!, candidates,
    ...(finite ? { finiteModel: { modelResultId: finite.modelResultId, bundle: finite.bundle, ...(finite.skipped.length ? { skipped: finite.skipped } : {}) } } : {}) };
}

type Runner = (work: ReconstructionWork, signal: AbortSignal, progress: (value: RemovalProgress) => void) => Promise<{
  cloudParts?: { descriptor: string; catalogue: string }; framingRadiusUnits?: number; stars?: string; reconstructionOverlay?:string;
}>;
export function createReconstructor(root: string, options: { runner?: Runner } = {}) {
  let queue = Promise.resolve();
  const run: Runner = options.runner ?? ((work, signal, progress) => runProcessingWorker({
    root, signal, request: work, name: 'reconstruction', completionPayload: 'event',
    entry: 'labs/nebula/packages/lab/src/server/workers/density-reconstruction.ts',
    readResult(value): Awaited<ReturnType<Runner>> {
      if (!value || typeof value !== 'object' || !('cloudParts' in value) || !value.cloudParts ||
          typeof value.cloudParts !== 'object' || !('descriptor' in value.cloudParts) || !('catalogue' in value.cloudParts) ||
          typeof value.cloudParts.descriptor !== 'string' || typeof value.cloudParts.catalogue !== 'string')
        throw new TypeError('Missing density reconstruction outputs.');
      const result: Awaited<ReturnType<Runner>> = { cloudParts: {
        descriptor: value.cloudParts.descriptor, catalogue: value.cloudParts.catalogue,
      } };
      for (const key of ['stars', 'reconstructionOverlay'] as const) if (key in value) {
        const path = Reflect.get(value, key);
        if (path !== undefined && typeof path !== 'string') throw new TypeError('Invalid density output path.');
        if (path !== undefined) result[key] = path;
      }
      if ('framingRadiusUnits' in value && value.framingRadiusUnits !== undefined) {
        if (typeof value.framingRadiusUnits !== 'number' || !Number.isFinite(value.framingRadiusUnits) || value.framingRadiusUnits <= 0)
          throw new TypeError('Invalid density framing radius.');
        result.framingRadiusUnits = value.framingRadiusUnits;
      }
      return result;
    },
    onProgress(event) {
      if (typeof event.stage === 'string' && typeof event.message === 'string' &&
          typeof event.current === 'number' && Number.isFinite(event.current) &&
          typeof event.total === 'number' && Number.isFinite(event.total))
        progress({ stage: event.stage, message: event.message, current: event.current, total: event.total });
    },
  }));
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
      await pinned(root,cloudPath);const cloudDescriptor={path:cloudPath};
      const densityRecipe={path:`${cloudDirectory}/${cloudObject.properties.preparation.source}`};
      await pinned(root,densityRecipe.path);
      const stars = subject.stars ? { path: subject.stars } : undefined;
      const referenceId=subject.density!.reconstructionReferenceImageId;
      const referencePin=subject.density!.starAlignmentReference;
      const coordinateReference=referencePin ? await json(root,referencePin.path) : undefined;
      if(coordinateReference && coordinateReference.schema!=='cssearth-nebula-star-alignment@1')
        throw new TypeError('Invalid catalogue star alignment reference.');
      const referenceImage=coordinateReference??target.images.find((item:{id:string})=>item.id===referenceId);
      const referenceOverlay=coordinateReference?.overlay??overlays.overlays.find((item:{id:string})=>item.id===referenceId);
      if(stars&&(!referenceImage?.wcs||!referenceOverlay))throw new TypeError('The Alignment cloud requires a configured sky-to-density star reference.');
      const slicesPath=`${cloudDirectory}/prepared/volume-slices.json`;
      const cloud={descriptor:cloudDescriptor,slices:{path:slicesPath,sha256:hash(await pinned(root,slicesPath))},
        provenance:densityRecipe,
        ...(subject.density!.modelPlacement ? {modelPlacement:subject.density!.modelPlacement} : {}),
        ...(stars?{starAlignment:{wcs:referenceImage.wcs,
          alignment:{style:referenceOverlay.style,pivotCssPx:referenceOverlay.pivotCssPx,
            placement:referenceOverlay.initialPlacement??defaultOverlayPlacement()},
          provenancePin:referencePin??{path:subject.density!.overlays!,sha256:hash(await pinned(root,subject.density!.overlays!))}}}:{})};
      const pins = Object.fromEntries((await implementationPins(root, ['labs/nebula/packages/lab/src/server/workers/density-reconstruction.ts'])).map(pin => [pin.path, pin.sha256]));
      const identity = { version: 5, subject, imagePresentation: { label: image.label, sourcePageUrl: image.sourcePageUrl, credit: image.credit }, request, stars, cloud, sourceSha256: image.sha256, frame, stellarPrior: densityRecipe,
        overlay: { widthPx: overlay.widthPx, heightPx: overlay.heightPx, transform: overlay.style.transform, pivotCssPx: overlay.pivotCssPx }, pins };
      const resultId = hash(JSON.stringify(identity)), directory = `${cache}/${resultId}`, temporary = resolve(root, `${directory}.pending`);
      if (await stat(resolve(root, directory, 'result.json')).catch(() => null)) {
        progress({ stage: 'cached', current: 1, total: 1, message: 'Loading saved reconstruction.' }); return readPreparedReconstruction(root, resultId);
      }
      await rm(temporary, { recursive: true, force: true }); await mkdir(temporary, { recursive: true });
      try {
        const work: ReconstructionWork = { schema: 'cssearth-nebula-reconstruction-work@1', id: `reconstruction-${resultId}`,
          imageId: image.id, name: image.label, outputDirectory: temporary, appearance: parseCloudAppearance(request.appearance),
          source: { path: nativePath, width: removal.nativeDimensions[0], height: removal.nativeDimensions[1] },
          original: { path: image.path, removalResultId: request.removalResultId },
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
            reconstructionImage: { group: subject.id, label: image.label, note: 'Projection-only comparison on the unchanged simulated stellar density; not qualified 3D material. Saved placement is preserved.' } } };
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
  return { name: 'nebula-reconstruction', configureServer(server) {
  const sample = createReconstructor(root);
  const jobs = createStarRemovalJobs(root, { namespace: 'reconstruction', label: 'Reconstruction', sample,
    parseRequest: parseReconstructionRequest, validateResult: async value => {
      if (!record(value) || !token(value.resultId)) throw new TypeError('Missing reconstruction result.');
      await readPreparedReconstruction(root, value.resultId);
    } });

    server.middlewares.use('/__nebula/lens-settings', lensSettingsHandler(root));
    server.middlewares.use('/__nebula/reconstruction-jobs', starRemovalJobsHandler(jobs, '/__nebula/reconstruction-jobs'));
    server.httpServer?.once('close', () => { void jobs.shutdown().catch(() => {}); });
    // Read-only per-channel levels for one saved lens, measured from that lens's own pinned rasters.
    server.middlewares.use('/__nebula/reconstruction-levels', async (request, response) => {
      try {
        if (request.method !== 'GET') throw new TypeError('Lens levels are read-only.');
        const url = new URL(request.url ?? '/', 'http://localhost'), id = url.searchParams.get('resultId') ?? '';
        if (!token(id)) throw new TypeError('Invalid reconstruction identity.');
        const value = await lensLevels(root, await readPreparedReconstruction(root, id));
        response.setHeader('Content-Type', 'application/json'); response.setHeader('Cache-Control', 'no-store'); response.end(JSON.stringify(value));
      } catch (error) { response.statusCode = 400; response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ error: (error as Error).message })); }
    });
    // Read-only difference map for one saved lens: `format=png` is the overlay image, otherwise its legend JSON.
    server.middlewares.use('/__nebula/reconstruction-difference', lensDifferenceHandler(root, id => readPreparedReconstruction(root, id)));
    // Read-only azimuthal radial profile for one saved lens: does brightness fall off with radius like the source?
    server.middlewares.use('/__nebula/reconstruction-radial', lensRadialHandler(root, id => readPreparedReconstruction(root, id)));
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
