import { validateCompilerResult } from './bank-validation.ts';
import { implementationPins } from '@cssearth/nebula-lab/server/implementation';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { geometrySha } from '../geometry/registered-source.ts';
import { prepareEvidenceInputs } from '../evidence-fusion/provider.ts';
import { prepareJointInput, tangentOffsetWestNorth } from '../joint-fit/input.ts';
import { fitJointModels } from '@cssearth/nebula-reconstruction/methods/joint/fitter';
import { defaultJointControls, readJointRecipe } from '../../../features/joint-fit/model.ts';
import { readObservations } from '../../../features/observations/models/model.ts';
import { readObservationRecipe } from '../../../features/observations/recipe.ts';
import { COMPILER_VERSION, readCompilerRecipe, compilerSourceWeights, type CompilerRequest } from '../../../features/compiler/model.ts';
import { restoreCompilerInputs, type CompilerProgress } from './prerequisites.ts';
import { compilerTarget, loadCompilerImages, compilerImagePanel } from './images.ts';
import { fitEmissionField } from './fit.ts';
import { createPhotometricEmission, createEmissionMaterial, type CompilerPin, readEmissionWindow } from '@cssearth/bake/volume';
import { loadDepthModel } from './depth-model.ts';
import { bakeCompiler } from './bake.ts';
import { compilerStars } from '@cssearth/nebula-reconstruction/stars/compiler';
import { prepareCatalogueStars } from './catalogue-stars.ts';
import { COMPILER_STAR_PROFILE_PATH } from '../../../adapters/application/star-sprites.ts';
import { compilerUnionStars } from '@cssearth/nebula-reconstruction/stars/union';
import { readCompilerResult, type CompilerResult } from '../../../features/compiler/result.ts';
import { compileSampledNebula } from '../sampled-prior/compile.ts';
import { loadPhotometricPrior, fitPhotometricEmission, photometricEnvelopeColors } from './photometric-prior.ts';
/** Explicit automatic full pipeline. Source owners retain native registration/separation and their caches. */
export async function compileNebula(root: string, request: CompilerRequest, signal: AbortSignal, progress: CompilerProgress): Promise<CompilerResult> {
  const recipeBytes = await readFile(resolve(root, request.recipePath)), recipe = readCompilerRecipe(JSON.parse(recipeBytes.toString()));
  if (request.cataloguePath !== recipe.structureCatalogue) throw new TypeError('Compiler recipe and source catalogue differ.');
  const plannedObservations = readObservationRecipe(JSON.parse(await readFile(resolve(root, recipe.observationRecipe), 'utf8')));
  compilerSourceWeights(recipe, plannedObservations.images.map(source => source.id), request.evidence.weights);
  if (recipe.starCatalogue?.sourceIds.some(id => !plannedObservations.images.some(source => source.id === id)))
    throw new TypeError('Compiler star catalogue references an unavailable image.');
  if (recipe.emissionWindow && !plannedObservations.images.some(source => source.id === recipe.emissionWindow!.sourceId))
    throw new TypeError('Compiler emission window references an unavailable image.');
  const pipeline = await restoreCompilerInputs(root, recipe, signal, progress);
  if (recipe.sampledRecipe) return compileSampledNebula(root, request, recipe, pipeline, signal, progress);
  const observations = readObservations(JSON.parse(await readFile(resolve(root, recipe.observationCatalogue), 'utf8')));
  const evidenceStarted = performance.now();
  if (recipe.depthRecipe) progress('Verifying physical evidence and depth assumptions…', .19);
  const depthModel = recipe.depthRecipe ? await loadDepthModel(root, recipe.depthRecipe, recipe.id) : undefined;
  const photometricModel = recipe.photometricPriorRecipe ? await loadPhotometricPrior(root, recipe.photometricPriorRecipe, recipe.id) : undefined;
  if (photometricModel) {
    if (photometricModel.recipe.centerIcrsDegrees.some((value, index) => Math.abs(value - observations.frame.centerIcrsDegrees[index]!) > 1e-8))
      throw new TypeError('Photometric model and registered images use different sky origins.');
    pipeline.push({ id: 'photometric-model', label: 'Verify published light distribution', state: 'complete', seconds: (performance.now() - evidenceStarted) / 1000 });
  }
  if (depthModel) {
    if (depthModel.recipe.centerIcrsDegrees.some((value, index) => Math.abs(value - observations.frame.centerIcrsDegrees[index]!) > 1e-8))
      throw new TypeError('Depth model and registered images use different sky origins.');
    pipeline.push({ id: 'evidence-intake', label: 'Verify physical evidence', state: 'complete', seconds: (performance.now() - evidenceStarted) / 1000 });
  }
  const inputs = await prepareEvidenceInputs(root, recipe.structureCatalogue, { imageToFrame: request.imageToFrame });
  const weights = compilerSourceWeights(recipe, inputs.sources.map(source => source.id), request.evidence.weights);
  let center = observations.frame.centerIcrsDegrees, joint: Awaited<ReturnType<typeof prepareJointInput>> | undefined;
  if (recipe.jointRecipe) {
    const jointRecipe = readJointRecipe(JSON.parse(await readFile(resolve(root, recipe.jointRecipe), 'utf8'))); center = jointRecipe.centerIcrsDegrees;
    joint = await prepareJointInput(root, { action: 'apply', imageId: 'joint-fit', recipePath: recipe.jointRecipe, cataloguePath: recipe.structureCatalogue,
      imageToFrame: request.imageToFrame, evidence: { ...request.evidence, weights }, controls: defaultJointControls });
  }
  const observedStarsBytes = recipe.observedStars ? await readFile(resolve(root, recipe.observedStars.path)) : undefined;
  const sourceData = await loadCompilerImages(root, recipe.observationCatalogue, request, center);
  const source = sourceData.images.find(s => s.id === recipe.defaultSourceId); if (!source) throw new TypeError('Default compiler lens is unavailable.');
  const windowSource = recipe.emissionWindow && sourceData.images.find(image => image.id === recipe.emissionWindow!.sourceId);
  const emissionWindow = windowSource ? readEmissionWindow({ ...recipe.emissionWindow,
    polygonArcsec: [[0, 0], [windowSource.nativeWidth, 0], [windowSource.nativeWidth, windowSource.nativeHeight], [0, windowSource.nativeHeight]]
      .map(([x, y]) => windowSource.pixelToSky(x!, y!)),
    interpretation: 'User-selected display extent from a registered image footprint, feathered inward through all model depths. Source observations remain complete; this is not a measured nebular boundary.' }) : undefined;
  const target = compilerTarget(inputs, weights, tangentOffsetWestNorth(observations.frame.centerIcrsDegrees, center), recipe.targetControls, emissionWindow);
  const implementation = await implementationPins(root, ['labs/nebula/packages/lab/src/server/workflows/compiler/compile.ts']);
  const id = geometrySha(JSON.stringify({ version: COMPILER_VERSION, implementation, recipe: geometrySha(recipeBytes), input: inputs.identity,
    observedStars: recipe.observedStars, starProfile: geometrySha(await readFile(resolve(root, COMPILER_STAR_PROFILE_PATH))),
    sourceLayers: sourceData.images.map(image => [image.id, image.original.sha256, image.diffuse.sha256, image.stars.sha256]),
    molecular: joint && { recipe: joint.recipeSha256, evidence: joint.evidence },
    physicalDepth: depthModel && { recipe: depthModel.recipeSha256, evidence: geometrySha(depthModel.evidenceBytes) },
    photometricPrior: photometricModel && { recipe: photometricModel.recipeSha256, evidence: geometrySha(photometricModel.evidenceBytes) },
    request: { controls: request.controls, evidence: { sensitivity: request.evidence.sensitivity, weights } } }));
  const directory = `.local/nebula-lab/compiler/${id}`, receipt = resolve(root, directory, 'result.json');
  try { const cached = await validateCompilerResult(root, JSON.parse(await readFile(receipt, 'utf8'))); progress('Prepared nebula restored', 1); return cached; }
  catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
  signal.throwIfAborted(); await mkdir(resolve(root, directory), { recursive: true });
  async function save(name: string, bytes: Uint8Array): Promise<CompilerPin> {
    signal.throwIfAborted(); const path = `${directory}/${name}`, target = resolve(root, path); await writeFile(`${target}.pending`, bytes); await rename(`${target}.pending`, target); return { path };
  }
  let started = performance.now();
  if (joint) progress('Fitting the velocity scaffold…', .22);
  const scaffoldFit = joint ? fitJointModels(joint.evidence, defaultJointControls, joint.recipe, message => progress(message, .24), signal) : undefined;
  if (!depthModel && !photometricModel) pipeline.push({ id: 'scaffold', label: joint ? 'Fit velocity scaffold' : 'Explicit image-only depth prior', state: 'complete', seconds: (performance.now() - started) / 1000 });
  started = performance.now(); progress('Fitting the complete emission structure…', .3);
  const photometricFit = photometricModel ? fitPhotometricEmission(target, request.controls, photometricModel, signal, message => progress(message, .36)) : undefined;
  const fitted = photometricFit ?? fitEmissionField({ ...target, scaffold: scaffoldFit?.fits[0]?.parameters,
    velocityCoverage: joint?.evidence.velocities.map(p => ({ x: p.x, y: p.y, radiusArcsec: joint!.evidence.beamFwhmArcsec / 2 })) }, request.controls,
    { signal, depthRecipe: depthModel?.recipe, onProgress: message => progress(message, .36) });
  if (fitted.field.components.length === 0) throw new Error('No usable nebular emission survived. Inspect source alignment and star removal.');
  const field = createPhotometricEmission(fitted.field), model = await save('field.json', Buffer.from(JSON.stringify(fitted.field)));
  pipeline.push({ id: depthModel ? 'depth-model' : 'field', label: photometricModel ? 'Fit finite light inside the published model' : depthModel ? 'Fit emission on evidence-guided surfaces' : 'Fit 3D emission components', state: 'complete', seconds: (performance.now() - started) / 1000 });
  progress('Placing observed compact lights in the inferred field…', .42); started = performance.now();
  const union = recipe.starCatalogue ? await compilerUnionStars(source, fitted.field, recipe.maximumStars, sourceData.images, recipe.starCatalogue) : undefined;
  const catalogue = observedStarsBytes ? prepareCatalogueStars(JSON.parse(observedStarsBytes.toString()), fitted.field, center, recipe.maximumStars, sourceData.images.map(image => image.id)) : undefined;
  const stars = catalogue?.stars ?? union?.stars ?? await compilerStars(source, fitted.field, recipe.maximumStars, sourceData.images);
  pipeline.push({ id: 'stars', label: 'Prepare compact lights', state: 'complete', seconds: (performance.now() - started) / 1000 });
  // Framing is independent of the full registered source grid and never truncates field support.
  const centerX = (field.bounds.min[0] + field.bounds.max[0]) / 2, centerY = (field.bounds.min[1] + field.bounds.max[1]) / 2;
  const span = Math.max(field.bounds.max[0] - field.bounds.min[0], field.bounds.max[1] - field.bounds.min[1]) * 1.04;
  const skyBounds = { min: [centerX - span / 2, centerY - span / 2] as [number, number], max: [centerX + span / 2, centerY + span / 2] as [number, number] };
  started = performance.now();
  const materials = sourceData.images.map(image => {
    const material = createEmissionMaterial(fitted.field, image, field.finite), envelopeColors = photometricEnvelopeColors(fitted.field, image);
    return { image, receipt: { ...material.receipt, ...(envelopeColors ? { envelopeColors } : {}) },
      sampleMaterial: field.createMaterialSampler(material.receipt.components, envelopeColors) };
  });
  const scene = await bakeCompiler({ root, outputDirectory: `${directory}/scene`, id, fieldIdentity: fitted.field.identity,
    boundsArcsec: field.bounds, skyBoundsArcsec: skyBounds, sampleEmission: field.sampleEmission, stars,
    minimumFeatureScaleArcsec: depthModel || photometricModel ? Math.min(...fitted.field.components.flatMap(component => component.sigma)) : undefined,
    lenses: materials.map(material => ({ id: material.image.id, label: material.image.label, sampleMaterial: material.sampleMaterial })), signal,
    progress: value => progress(value.message, value.phase === 'volume' ? .45 + .2 * value.completed / value.total : value.phase === 'texture' ? .65 + .25 * value.completed / value.total : .92) });
  pipeline.push({ id: 'bake', label: 'Bake shared geometry + image lenses', state: 'complete', seconds: (performance.now() - started) / 1000 });
  const sources: CompilerResult['sources'] = [];
  for (const image of sourceData.images) {
    const original = await compilerImagePanel(image, skyBounds, true, 512), starless = await compilerImagePanel(image, skyBounds, false, 512);
    sources.push({ id: image.id, label: image.label, credit: image.credit, page: image.page, width: original.width, height: original.height, boundsArcsec: skyBounds,
      original: await save(`source-${image.id}.png`, original.bytes), starless: await save(`starless-${image.id}.png`, starless.bytes) });
  }
  const panel = async (name: string, data: Float32Array, signed = false) => {
    const rgba = Buffer.alloc(data.length * 4);
    for (let p = 0; p < data.length; p++) { const value = Math.round(255 * (1 - Math.exp(-Math.abs(data[p]!))));
      rgba[p * 4] = signed && data[p]! < 0 ? 0 : value; rgba[p * 4 + 1] = signed ? 0 : value; rgba[p * 4 + 2] = signed && data[p]! > 0 ? 0 : value; rgba[p * 4 + 3] = target.coverage[p] ? 255 : 0; }
    return save(name, await sharp(rgba, { raw: { width: target.width, height: target.height, channels: 4 } }).png().toBuffer());
  };
  const [targetPin, projection, residual] = await Promise.all([panel('target.png', target.target), panel('projection.png', fitted.projection), panel('residual.png', fitted.residual, true)]);
  const physicalDepth = depthModel ? {
    recipe: await save('depth-recipe.json', depthModel.recipeBytes), evidence: await save('physical-evidence.json', depthModel.evidenceBytes),
    methods: depthModel.methods, interpretation: depthModel.recipe.interpretation, assignments: fitted.field.depthConstraints,
  } : undefined;
  const photometricPrior = photometricModel && photometricFit ? {
    recipe: await save('photometric-model.json', photometricModel.recipeBytes), evidence: await save('photometric-evidence.json', photometricModel.evidenceBytes),
    interpretation: photometricModel.recipe.interpretation,
    assignments: photometricFit.depthAssignments, settings: photometricFit.settings,
    ...('envelopeMetrics' in photometricFit ? { envelopeMetrics: photometricFit.envelopeMetrics } : {}),
  } : undefined;
  const method = await save('method.json', Buffer.from(JSON.stringify({ version: COMPILER_VERSION, implementation, recipe, recipeSha256: geometrySha(recipeBytes), request,
    physicalDepth, photometricPrior, ...(catalogue ? { observedStars: { source: recipe.observedStars, ...catalogue.receipt } } : {}), ...(union ? { starCatalogue: union.selection } : {}),
    inputIdentity: inputs.identity, target: { ...target, target: undefined, coverage: undefined }, scaffoldFit, fieldMetrics: fitted.metrics,
    assumptions: fitted.field.assumptions, stars: catalogue ? 'Measured optical catalogue overlay, apparent V ranked, independent of image lens. See observedStars receipt for color and authored depth limits.' : union ? union.selection.interpretation : 'Compact points detected once from the reference stellar residual. Each lens preserves its own local background-subtracted residual aperture display energy and angular footprint at the same registered xy; absent coverage or residual emits zero light. Only columns with fitted emission are included. Depth is a deterministic conditional field sample, unchanged across lenses, not a measured stellar distance or confirmed membership. Encoded RGB display accounting is not calibrated stellar flux, and stars visible only outside the reference catalogue are not added.',
    materials: materials.map(material => material.receipt),
    pipeline }, null, 2)));
  const m = fitted.metrics;
  const result: CompilerResult = { schema: 'cssearth-nebula-compiler-result@1', id, label: recipe.label, defaultSourceId: recipe.defaultSourceId, controls: request.controls, scene, sources, pipeline,
    inspectionBoundsArcsec: sourceData.inspectionBoundsArcsec,
    metrics: { components: m.componentCount, unconstrainedComponents: fitted.field.assumptions.velocityUncoveredComponents, stars: stars.length,
      fitRmse: m.afterRmse, baselineRmse: m.beforeRmse, missingSignalFraction: m.unassignedSum / Math.max(1e-12, m.targetSum), excessSignalFraction: m.excessSum / Math.max(1e-12, m.targetSum) },
    model, method, target: targetPin, projection, residual, interpretation: recipe.interpretation };
  readCompilerResult(result); await save('result.json', Buffer.from(JSON.stringify(result))); progress('Nebula ready', 1); return result;
}
