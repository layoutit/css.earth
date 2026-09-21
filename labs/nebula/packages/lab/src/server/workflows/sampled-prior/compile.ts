import { implementationPins } from '@cssearth/nebula-lab/server/implementation';
import { mkdir, readFile, writeFile, rename, readdir, realpath } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { geometrySha, readGeometryPin } from '../geometry/registered-source.ts';
import { COMPILER_VERSION, type CompilerRequest, type CompilerRecipe } from '../../../features/compiler/model.ts';
import type { CompilerProgress, CompilerStep } from '../compiler/prerequisites.ts';
import { readCompilerResult, type CompilerResult } from '../../../features/compiler/result.ts';
import { validateCompilerResult } from '../compiler/compile.ts';
import { loadCompilerImages, compilerImagePanel } from '../compiler/images.ts';
import { bakeCompiler, type CompilerStarInput } from '../compiler/bake.ts';
import { COMPILER_STAR_PROFILE_PATH, prepareCompilerStarSprites } from '../../../adapters/application/star-sprites.ts';
import { readCompilerBakeResult, type CompilerBakeResult, type CompilerPin } from '@cssearth/volume-core/contracts/compiler-bake';
import type { SkyBounds } from '@cssearth/volume-core/contracts/emission';
import { decodeFits, float32LittleEndian } from '../../../adapters/application/fits.ts';
import { readSampledRecipe, verifySampledEvidence } from '../../../features/sampled-prior/model.ts';
import { prepareSampledField } from '@cssearth/volume-core/fields/sampled';
import { sampledStars } from './stars.ts';
import { sampledPanels } from './panels.ts';
import { sampledOwnerPins, sampledImplementationOwners } from '../../../features/sampled-prior/ownership.ts';
import { jointRecord } from '../../../features/joint-fit/model.ts';
import { sampledBakeProgress } from './progress.ts';
import { registerComponentBanks } from './layout.ts';
import { fitSampledEmission, type EmissionFitResult } from '@cssearth/nebula-reconstruction/methods/sampled/emission-fit';
import { prepareSampledMaterial } from '@cssearth/volume-core/materials/sampled';
import { fitSampledMaterialColors } from '@cssearth/nebula-reconstruction/methods/sampled/material-fit';
import { maximumPlanningEmission } from '@cssearth/volume-bake/compact-inputs/sampled';

/** Spectral appearances belong to the final scene, so its atlas must include their complete palette. */
export async function prepareSampledSceneStars(root: string, outputDirectory: string,
  registered: CompilerBakeResult, sourceStars: readonly CompilerStarInput[]): Promise<CompilerBakeResult> {
  const byId = new Map(sourceStars.map(star => [star.id, star]));
  if (byId.size !== sourceStars.length || byId.size !== registered.stars.length)
    throw new TypeError('Sampled spectral stars differ from the retained catalogue.');
  const stars = registered.stars.map(star => {
    const source = byId.get(star.id);
    if (!source) throw new TypeError('Sampled spectral star identity is missing.');
    return { ...star, ...(source.materials ? { materials: structuredClone(source.materials) } : {}) };
  });
  // The neutral atlas intentionally covers only neutral star colors. Keep that artifact immutable.
  const { starSprites: _neutralSprites, ...cloud } = registered;
  const scene = readCompilerBakeResult({ ...cloud, stars });
  return readCompilerBakeResult({ ...scene, ...await prepareCompilerStarSprites(root, outputDirectory, scene.stars) });
}

export async function readSourcePin(root: string, pin: CompilerPin): Promise<Buffer> {
  if (!( /^(labs\/nebula\/(models|src)\/|\.local\/nebula-lab\/)/.test(pin.path) || pin.path === 'tools/fits.mts') || /[\\?#\s]/.test(pin.path) ||
      pin.path.split('/').some(p => !p || p === '..') || !/^[a-f0-9]{64}$/.test(pin.sha256)) throw new TypeError('Invalid sampled source pin.');
  const path = await realpath(resolve(root, pin.path)), offset = relative(await realpath(root), path);
  if (offset === '..' || offset.startsWith('../') || isAbsolute(offset)) throw new TypeError('Sampled source leaves the repository.');
  const bytes = await readFile(path);
  if (geometrySha(bytes) !== pin.sha256) throw new TypeError(`Qualified sampled input changed: ${pin.path}`);
  return bytes;
}

async function validateSpatialArtifacts(root: string, result: CompilerResult) {
  const model: unknown = JSON.parse((await readGeometryPin(root, result.model)).toString());
  if (!jointRecord(model) || model.schema !== 'cssearth-sampled-emission-field@1' || !Array.isArray(model.gridSize) ||
      model.gridSize.length !== 3 || !model.gridSize.every(n => Number.isInteger(n) && Number(n) > 0)) throw new TypeError('Invalid prepared spatial field.');
  const expectedBytes = model.gridSize.reduce((a: number, b: unknown) => a * Number(b), 4);
  if (!Number.isSafeInteger(expectedBytes) || expectedBytes > 160e6) throw new TypeError('Prepared spatial field exceeds its supported grid.');
  for (const name of ['ejecta', 'wind']) {
    const pin = model[name];
    if (!jointRecord(pin) || typeof pin.path !== 'string' || !pin.path.startsWith(`.local/nebula-lab/compiler/${result.id}/`) || typeof pin.sha256 !== 'string')
      throw new TypeError('Missing prepared spatial grid pin.');
    const bytes = await readGeometryPin(root, { path: pin.path, sha256: pin.sha256 });
    if (bytes.length !== expectedBytes) throw new TypeError('Prepared spatial grid size differs.');
  }
  if (model.emissionFits !== undefined) {
    if (!Array.isArray(model.emissionFits) || model.emissionFits.length > 8) throw new TypeError('Invalid spatial emission fits.');
    for (const fit of model.emissionFits) {
      if (!jointRecord(fit) || typeof fit.sourceId !== 'string' || !result.sources.some(s => s.id === fit.sourceId)) throw new TypeError('Unknown fitted spectral source.');
      for (const name of ['grid', 'receipt']) {
        const pin = fit[name];
        if (!jointRecord(pin) || typeof pin.path !== 'string' || !pin.path.startsWith(`.local/nebula-lab/compiler/${result.id}/`) || typeof pin.sha256 !== 'string')
          throw new TypeError('Missing spatial fit artifact pin.');
        const bytes = await readGeometryPin(root, { path: pin.path, sha256: pin.sha256 });
        if (name === 'grid' && bytes.length !== expectedBytes) throw new TypeError('Fitted spatial grid size differs.');
      }
    }
  }
}

export async function compileSampledNebula(root: string, request: CompilerRequest, recipe: CompilerRecipe,
  pipeline: CompilerStep[], signal: AbortSignal, progress: CompilerProgress): Promise<CompilerResult> {
  if (!recipe.sampledRecipe) throw new TypeError('A sampled compiler requires its qualified recipe.');
  // This operator preserves qualified spatial samples. Image evidence sliders cannot reposition or rescale them.
  if (request.controls.depth !== 1) throw new TypeError('The qualified sampled model has a fixed depth scale. Keep Depth at 1.00×.');
  if (request.evidence.weights.length || request.evidence.sensitivity !== 1) throw new TypeError('Sampled models require their pinned component-specific spectral weights.');
  progress('Verifying spatial samples and independent wind geometry…', .2);
  const recipeBytes = await readFile(resolve(root, request.recipePath)), sampledBytes = await readFile(resolve(root, recipe.sampledRecipe));
  const sampled = readSampledRecipe(JSON.parse(sampledBytes.toString()));
  if (sampled.id !== recipe.id) throw new TypeError('Sampled prior belongs to another compiler object.');
  const evidenceBytes = await readSourcePin(root, sampled.evidence);
  verifySampledEvidence(sampled, JSON.parse(evidenceBytes.toString()));
  let pointBytes: Buffer;
  try { pointBytes = await readGeometryPin(root, sampled.source); }
  catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    const response = await fetch(sampled.source.url, { signal });
    if (!response.ok) throw new Error(`Qualified sample download failed: ${response.status}`);
    pointBytes = Buffer.from(await response.arrayBuffer());
    if (geometrySha(pointBytes) !== sampled.source.sha256) throw new Error('Qualified sample hash differs.');
    const path = resolve(root, sampled.source.path); await mkdir(dirname(path), { recursive: true });
    await writeFile(`${path}.pending`, pointBytes); await rename(`${path}.pending`, path);
  }
  const sourceData = await loadCompilerImages(root, recipe.observationCatalogue, request, sampled.centerIcrsDegrees);
  if (Object.entries(request.imageToFrame).some(([id, matrix]) => {
    const image = sourceData.observations.images.find(image => image.id === id);
    return !image || matrix.some((value, i) => Math.abs(value - image.imageToFrame[i]!) > 1e-10);
  })) throw new TypeError('Spatial samples require their qualified sky registration. Reset manual image adjustments before compiling.');
  request = { ...request, imageToFrame: {} };
  if (sourceData.observations.frame.centerIcrsDegrees.some((n, i) => Math.abs(n - sampled.centerIcrsDegrees[i]!) > 1e-8))
    throw new TypeError('Spatial sample origin and registered observations differ.');
  const reference = sourceData.images.find(image => image.id === recipe.defaultSourceId);
  if (!reference || Object.keys(sampled.lensComponents).length !== sourceData.images.length || sourceData.images.some(image => !sampled.lensComponents[image.id]))
    throw new TypeError('Every sampled spectral lens needs an explicit component mixture.');
  const implementation = await implementationPins(root, ['labs/nebula/packages/lab/src/server/workflows/sampled-prior/compile.ts']);
  const extraPaths = [...sampledImplementationOwners].sort();
  const extraImplementation = await Promise.all(extraPaths.map(async path => ({ path, sha256: geometrySha(await readFile(resolve(root, path))) })));
  const inputPins = [{ path: recipe.sampledRecipe, sha256: geometrySha(sampledBytes) }, sampled.evidence,
    { path: sampled.source.path, sha256: sampled.source.sha256 }];
  const id = geometrySha(JSON.stringify({ version: COMPILER_VERSION, implementation, extraImplementation, inputPins,
    starProfile: geometrySha(await readFile(resolve(root, COMPILER_STAR_PROFILE_PATH))),
    recipeSha256: geometrySha(recipeBytes), request, sourceLayers: sourceData.images.map(image => [image.id, image.matrix, image.original.sha256, image.diffuse.sha256, image.stars.sha256]) }));
  const directory = `.local/nebula-lab/compiler/${id}`;
  try {
    const cached = await validateCompilerResult(root, JSON.parse(await readFile(resolve(root, directory, 'result.json'), 'utf8')));
    const method: unknown = JSON.parse((await readGeometryPin(root, cached.method)).toString());
    await Promise.all(sampledOwnerPins(method, recipe.sampledRecipe).map(pin => readSourcePin(root, pin)));
    await validateSpatialArtifacts(root, cached);
    progress('Prepared spatial model restored', 1); return cached;
  }
  catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
  signal.throwIfAborted(); await mkdir(resolve(root, directory), { recursive: true });
  async function save(name: string, bytes: Uint8Array): Promise<CompilerPin> {
    signal.throwIfAborted(); const path = `${directory}/${name}`, target = resolve(root, path);
    await writeFile(`${target}.pending`, bytes); await rename(`${target}.pending`, target); return { path, sha256: geometrySha(bytes) };
  }
  const fits = decodeFits(pointBytes);
  if (fits.width !== sampled.source.width || fits.height !== sampled.source.height) throw new TypeError('Qualified sample FITS dimensions differ.');
  let started = performance.now();
  progress('Splatting the released 3D samples and separate analytic wind…', .24);
  const prepared = prepareSampledField(fits.values, sampled, signal), field = prepared.field({ ejecta: 1, pwn: 1 });
  const fieldIdentity = geometrySha(JSON.stringify({ inputPins, extraImplementation, evidence: prepared.evidence,
    fittingImages: sampled.emissionFit ? sourceData.images.map(image => [image.id, image.matrix, image.diffuse.sha256]) : undefined }));
  const ejecta = await save('ejecta.float32', float32LittleEndian(prepared.ejecta)), wind = await save('wind.float32', float32LittleEndian(prepared.pwn));
  pipeline.push({ id: 'sampled-field', label: 'Qualified ejecta samples + independent wind model', state: 'complete', seconds: (performance.now() - started) / 1000 });
  started = performance.now();
  const stars = await sampledStars(reference, sourceData.images, field, recipe.maximumStars, sampled.pulsar);
  pipeline.push({ id: 'stars', label: 'Observed field lights and named central source', state: 'complete', seconds: (performance.now() - started) / 1000 });
  const cx = (field.bounds.min[0] + field.bounds.max[0]) / 2, cy = (field.bounds.min[1] + field.bounds.max[1]) / 2;
  const span = Math.max(field.bounds.max[0] - field.bounds.min[0], field.bounds.max[1] - field.bounds.min[1]) * 1.04;
  const skyBounds: SkyBounds = { min: [cx - span / 2, cy - span / 2], max: [cx + span / 2, cy + span / 2] };
  const fitsBySource = new Map<string, EmissionFitResult>();
  const emissionFits: { sourceId: string; grid: CompilerPin; receipt: CompilerPin }[] = [];
  if (sampled.emissionFit) {
    started = performance.now();
    for (const sourceId of sampled.emissionFit.sourceIds) {
      const image = sourceData.images.find(image => image.id === sourceId);
      if (!image) throw new TypeError('Emission-fit source unavailable.');
      progress(`Fitting ${image.label} · measured filaments and inferred diffuse emission…`, .27);
      const fit = fitSampledEmission(prepared, image, sampled.lensComponents[sourceId]!, sampled.emissionFit, skyBounds, signal);
      fitsBySource.set(sourceId, fit);
      emissionFits.push({ sourceId, grid: await save(`diffuse-${sourceId}.float32`, float32LittleEndian(fit.diffuse)),
        receipt: await save(`emission-fit-${sourceId}.json`, Buffer.from(JSON.stringify(fit.receipt))) });
    }
    pipeline.push({ id: 'emission-fit', label: 'Fit filament brightness + separate diffuse emission', state: 'complete', seconds: (performance.now() - started) / 1000 });
  }
  const model = await save('field.json', Buffer.from(JSON.stringify({ schema: 'cssearth-sampled-emission-field@1', fieldIdentity,
    ...prepared.evidence, source: sampled.source, rawToArcsec: sampled.rawToArcsec, terms: sampled.terms, ejecta, wind, emissionFits })));
  const referenceFit = fitsBySource.get(reference.id);
  const neutralField = referenceFit ? prepared.field({ ejecta: referenceFit.receipt.ejectaGain, pwn: 1 }, 1, referenceFit.diffuse) : field;
  const mixtureFields = new Map(sourceData.images.map(image => [image.id,
    fitsBySource.get(image.id)?.field ?? prepared.field(sampled.lensComponents[image.id]!)]));
  const samplePlanningEmission = maximumPlanningEmission([neutralField.sampleEmission,
    ...sourceData.images.map(image => mixtureFields.get(image.id)!.sampleEmission)]);
  started = performance.now();
  // Independent radiative components share a frame, never an inferred photo extrusion.
  // Within one mixture the normal baker enforces exact shared alpha for its RGB materials.
  const groups = new Map<string, typeof sourceData.images>();
  for (const image of sourceData.images) {
    const weights = sampled.lensComponents[image.id]!, key = fitsBySource.has(image.id) ? image.id : `${weights.ejecta},${weights.pwn}`;
    const group = groups.get(key) ?? []; group.push(image); groups.set(key, group);
  }
  const neutral = await bakeCompiler({ root, outputDirectory: `${directory}/scene-neutral`, id, fieldIdentity, boundsArcsec: field.bounds,
    samplePlanningEmission,
    skyBoundsArcsec: skyBounds, sampleEmission: neutralField.sampleEmission, lenses: [{ id: 'neutral-material', label: 'Neutral components', sampleMaterial(_x, _y, _z, rgb) { rgb.fill(255); return true; } }],
    stars: stars.map(({ materials: _materials, ...star }) => star), signal,
    progress: p => progress(`Neutral components · ${p.message}`, .3 + .08 * sampledBakeProgress(p)) });
  const lenses: CompilerBakeResult['lenses'] = [], materialReceipts: { material: ReturnType<typeof prepareSampledMaterial>['receipt'];
    fit?: ReturnType<typeof fitSampledMaterialColors>['receipt'] }[] = []; let groupIndex = 0;
  let referenceMaterial: ReturnType<typeof prepareSampledMaterial>['sampleMaterial'] | undefined;
  for (const images of groups.values()) {
    const mixture = mixtureFields.get(images[0]!.id)!;
    const materials = images.map(image => {
      progress(`Assigning ${image.label} colors to finite 3D emitters…`, .38 + .5 * groupIndex / groups.size);
      const fit = fitsBySource.get(image.id);
      const fittedMaterial = fit ? fitSampledMaterialColors(fits.values, sampled, prepared, image, sampled.lensComponents[image.id]!,
        { ...fit.receipt, diffuse: fit.diffuse }, signal) : undefined;
      const material = prepareSampledMaterial(fits.values, sampled, prepared, image, sampled.lensComponents[image.id]!,
        fit ? { ...fit.receipt, diffuse: fit.diffuse, colors: fittedMaterial?.colors } : undefined, signal);
      materialReceipts.push({ material: material.receipt, ...(fittedMaterial ? { fit: fittedMaterial.receipt } : {}) });
      if (image.id === reference.id) referenceMaterial = material.sampleMaterial;
      return { id: image.id, label: image.label, sampleMaterial: material.sampleMaterial };
    });
    const bank = await bakeCompiler({ root, outputDirectory: `${directory}/scene-${groupIndex}`, id, fieldIdentity,
      sampling: neutral.sampling,
      boundsArcsec: field.bounds, skyBoundsArcsec: skyBounds, sampleEmission: mixture.sampleEmission,
      lenses: materials, signal,
      progress: p => progress(`${images.map(i => i.label).join(' / ')} · ${p.message}`, .4 + .5 * (groupIndex + sampledBakeProgress(p)) / groups.size) });
    lenses.push(...bank.lenses.map(lens => ({ ...lens, alphaSha256: bank.alphaSha256 }))); groupIndex++;
  }
  progress('Registering spectral pixels on the retained union geometry…', .91);
  const registered = await registerComponentBanks(root, `${directory}/registered`, neutral, lenses, signal);
  const scene = await prepareSampledSceneStars(root, `${directory}/star-materials`, {
    ...registered, lenses: sourceData.images.map(image => registered.lenses.find(lens => lens.id === image.id)!),
  }, stars);
  pipeline.push({ id: 'bake', label: 'Bake component-aware spectral volumes', state: 'complete', seconds: (performance.now() - started) / 1000 });
  const sources: CompilerResult['sources'] = [];
  for (const image of sourceData.images) {
    const original = await compilerImagePanel(image, skyBounds, true, 512), starless = await compilerImagePanel(image, skyBounds, false, 512);
    sources.push({ id: image.id, label: image.label, credit: image.credit, page: image.page, width: original.width, height: original.height,
      boundsArcsec: skyBounds, original: await save(`source-${image.id}.png`, original.bytes), starless: await save(`starless-${image.id}.png`, starless.bytes) });
  }
  if (!referenceMaterial) throw new Error('Reference 3D material was not prepared.');
  const comparison = await sampledPanels(referenceFit?.field ?? prepared.field(sampled.lensComponents[reference.id]!), reference, skyBounds, referenceMaterial);
  const sampledPrior = { recipe: await save('sampled-recipe.json', sampledBytes), evidence: await save('physical-evidence.json', evidenceBytes), source: inputPins[2],
    emissionComponents: sampled.lensComponents, coordinateEvidence: prepared.evidence, emissionFit: sampled.emissionFit, emissionFits };
  const method = await save('method.json', Buffer.from(JSON.stringify({ version: COMPILER_VERSION, implementation, extraImplementation, inputPins,
    recipe, recipeSha256: geometrySha(recipeBytes), request, sampledPrior, pipeline,
    materials: { method: 'finite-emitter-chromaticity@1', qualification: 'requires-front-and-side-visual-acceptance', receipts: materialReceipts,
      interpretation: 'Registered colors attach to source points before finite XYZ splatting, and to complete finite wind/diffuse components before emission mixing. The painter only samples this 3D material; it cannot repeat an XY image down the cloud. Physical supports, alpha and stars remain unchanged. Color attribution and diffuse depths remain conditional.' },
    stars: 'Observed reference residual positions with deterministic conditional support depths; not measured membership. The named pulsar uses a separately pinned position and authored angular display size, without simulated time variability.',
    metrics: 'Image-space display-luminance disagreement including normalized source chromaticity. Optional fit receipts retain before/after and withheld-pixel results. This is not calibrated radiance or evidence of true depth; outreach stretch, coverage and epochs remain distinct.',
    limitations: ['SITELLE depth depends on the cited expansion law and sky registration.', 'Spectral epochs differ; no false common epoch is applied.',
      'Analytic wind thickness, jets and tracer strengths remain explicit model/presentation assumptions.', 'Emission-only transport omits scattering, absorption and Doppler boosting.'] }, null, 2)));
  const result: CompilerResult = { schema: 'cssearth-nebula-compiler-result@1', id, label: recipe.label, defaultSourceId: recipe.defaultSourceId,
    controls: request.controls, scene, sources, pipeline, inspectionBoundsArcsec: sourceData.inspectionBoundsArcsec,
    metrics: { components: prepared.evidence.pointCount + sampled.terms.length + (referenceFit?.receipt.atoms.length ?? 0),
      unconstrainedComponents: sampled.terms.length + (referenceFit?.receipt.atoms.length ?? 0), stars: stars.length, ...comparison.metrics },
    model, method, target: await save('target.png', comparison.target), projection: await save('projection.png', comparison.projection),
    residual: await save('residual.png', comparison.residual), interpretation: recipe.interpretation };
  readCompilerResult(result); await validateSpatialArtifacts(root, result);
  await save('result.json', Buffer.from(JSON.stringify(result))); progress('Spatial nebula and pulsar ready', 1); return result;
}
