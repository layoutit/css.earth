import { mkdir, readFile, writeFile, rename, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { validatePreparedCssVolume } from '../../../../../src/renderers/css/volume/validation';
import { geometrySha, readGeometryPin } from '../geometry/registered-source';
import { prepareEvidenceInputs } from '../evidence-fusion/provider';
import { prepareJointInput, tangentOffsetWestNorth } from '../joint-fit/input';
import { fitJointModels } from '../joint-fit/fitter';
import { defaultJointControls, readJointRecipe } from '../joint-fit/model';
import { readObservations } from '../../alignment/observations-ui/model';
import { COMPILER_VERSION, readCompilerRecipe, type CompilerRequest } from './model';
import { restoreCompilerInputs, type CompilerProgress } from './prerequisites';
import { compilerTarget, loadCompilerImages, compilerImagePanel } from './images';
import { fitEmissionField } from './fit';
import { createEmissionField } from './field';
import { bakeCompiler } from './bake';
import { compilerStars } from './stars';
import { readCompilerResult, type CompilerResult } from './result';
import type { CompilerPin } from './bake-types';
export async function validateCompilerResult(root: string, value: unknown) {
  const result = readCompilerResult(value);
  for (const pin of [result.model, result.method, result.target, result.projection, result.residual, ...result.sources.flatMap(s => [s.original, s.starless])]) await readGeometryPin(root, pin);
  for (const pin of [result.scene.neutral, ...result.scene.lenses.map(lens => lens.volume)]) {
    const volume = validatePreparedCssVolume(JSON.parse((await readGeometryPin(root, pin)).toString())), directory = pin.path.slice(0, pin.path.lastIndexOf('/') + 1);
    for (const resource of volume.resources) await readGeometryPin(root, { path: directory + resource.path, sha256: resource.sha256 });
  }
  return result;
}
/** Explicit automatic full pipeline. Source owners retain native registration/separation and their caches. */
export async function compileNebula(root: string, request: CompilerRequest, signal: AbortSignal, progress: CompilerProgress): Promise<CompilerResult> {
  const recipeBytes = await readFile(resolve(root, request.recipePath)), recipe = readCompilerRecipe(JSON.parse(recipeBytes.toString()));
  if (request.cataloguePath !== recipe.structureCatalogue) throw new TypeError('Compiler recipe and source catalogue differ.');
  const pipeline = await restoreCompilerInputs(root, recipe, signal, progress), observations = readObservations(JSON.parse(await readFile(resolve(root, recipe.observationCatalogue), 'utf8')));
  const inputs = await prepareEvidenceInputs(root, recipe.structureCatalogue, { imageToFrame: request.imageToFrame });
  const weights = request.evidence.weights.length ? request.evidence.weights : inputs.sources.map(() => 1);
  if (weights.length !== inputs.sources.length || !weights.some(w => w > 0)) throw new TypeError('Enable at least one source image.');
  let center = observations.frame.centerIcrsDegrees, joint: Awaited<ReturnType<typeof prepareJointInput>> | undefined;
  if (recipe.jointRecipe) {
    const jointRecipe = readJointRecipe(JSON.parse(await readFile(resolve(root, recipe.jointRecipe), 'utf8'))); center = jointRecipe.centerIcrsDegrees;
    joint = await prepareJointInput(root, { action: 'apply', imageId: 'joint-fit', recipePath: recipe.jointRecipe, cataloguePath: recipe.structureCatalogue,
      imageToFrame: request.imageToFrame, evidence: { ...request.evidence, weights }, controls: defaultJointControls });
  }
  const sourceData = await loadCompilerImages(root, recipe.observationCatalogue, request, center);
  const source = sourceData.images.find(s => s.id === recipe.defaultSourceId); if (!source) throw new TypeError('Default compiler lens is unavailable.');
  const target = compilerTarget(inputs, weights, tangentOffsetWestNorth(observations.frame.centerIcrsDegrees, center));
  const owners = (await readdir(resolve(root, 'labs/nebula/src/reconstruction/compiler'))).filter(name => name.endsWith('.ts') && !name.endsWith('.test.ts')).sort();
  const implementation = await Promise.all(owners.map(async name => ({ name, sha256: geometrySha(await readFile(resolve(root, 'labs/nebula/src/reconstruction/compiler', name))) })));
  const id = geometrySha(JSON.stringify({ version: COMPILER_VERSION, implementation, recipe: geometrySha(recipeBytes), input: inputs.identity,
    sourceLayers: sourceData.images.map(image => [image.id, image.original.sha256, image.diffuse.sha256, image.stars.sha256]),
    molecular: joint && { recipe: joint.recipeSha256, evidence: joint.evidence },
    request: { controls: request.controls, evidence: { sensitivity: request.evidence.sensitivity, weights } } }));
  const directory = `.local/nebula-lab/compiler/${id}`, receipt = resolve(root, directory, 'result.json');
  try { const cached = await validateCompilerResult(root, JSON.parse(await readFile(receipt, 'utf8'))); progress('Prepared nebula restored', 1); return cached; }
  catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
  signal.throwIfAborted(); await mkdir(resolve(root, directory), { recursive: true });
  async function save(name: string, bytes: Uint8Array): Promise<CompilerPin> {
    signal.throwIfAborted(); const path = `${directory}/${name}`, target = resolve(root, path); await writeFile(`${target}.pending`, bytes); await rename(`${target}.pending`, target); return { path, sha256: geometrySha(bytes) };
  }
  let started = performance.now(); progress('Fitting the velocity scaffold…', .22);
  const scaffoldFit = joint ? fitJointModels(joint.evidence, defaultJointControls, joint.recipe, message => progress(message, .24), signal) : undefined;
  pipeline.push({ id: 'scaffold', label: joint ? 'Fit velocity scaffold' : 'Explicit image-only depth prior', state: 'complete', seconds: (performance.now() - started) / 1000 });
  started = performance.now(); progress('Fitting the complete emission structure…', .3);
  const fitted = fitEmissionField({ ...target, scaffold: scaffoldFit?.fits[0]?.parameters,
    velocityCoverage: joint?.evidence.velocities.map(p => ({ x: p.x, y: p.y, radiusArcsec: joint!.evidence.beamFwhmArcsec / 2 })) }, request.controls,
    { signal, onProgress: message => progress(message, .36) });
  if (fitted.field.components.length === 0) throw new Error('No usable nebular emission survived. Inspect source alignment and star removal.');
  const field = createEmissionField(fitted.field), model = await save('field.json', Buffer.from(JSON.stringify(fitted.field)));
  pipeline.push({ id: 'field', label: 'Fit 3D emission components', state: 'complete', seconds: (performance.now() - started) / 1000 });
  progress('Placing observed compact lights in the inferred field…', .42); started = performance.now();
  const stars = await compilerStars(source, fitted.field, recipe.maximumStars);
  pipeline.push({ id: 'stars', label: 'Prepare compact lights', state: 'complete', seconds: (performance.now() - started) / 1000 });
  // Framing is independent of the full registered source grid and never truncates field support.
  const centerX = (field.bounds.min[0] + field.bounds.max[0]) / 2, centerY = (field.bounds.min[1] + field.bounds.max[1]) / 2;
  const span = Math.max(field.bounds.max[0] - field.bounds.min[0], field.bounds.max[1] - field.bounds.min[1]) * 1.04;
  const skyBounds = { min: [centerX - span / 2, centerY - span / 2] as [number, number], max: [centerX + span / 2, centerY + span / 2] as [number, number] };
  started = performance.now();
  const scene = await bakeCompiler({ root, outputDirectory: `${directory}/scene`, id, fieldIdentity: fitted.field.identity,
    boundsArcsec: field.bounds, skyBoundsArcsec: skyBounds, sampleEmission: field.sampleEmission, stars,
    lenses: sourceData.images.map(image => ({ id: image.id, label: image.label, sampleRgb: image.sampleRgb })), signal,
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
  const method = await save('method.json', Buffer.from(JSON.stringify({ version: COMPILER_VERSION, implementation, recipe, recipeSha256: geometrySha(recipeBytes), request,
    inputIdentity: inputs.identity, target: { ...target, target: undefined, coverage: undefined }, scaffoldFit, fieldMetrics: fitted.metrics,
    assumptions: fitted.field.assumptions, stars: 'Compact points detected from the saved stellar residual, preserving observed xy and relative display brightness. Only columns with fitted emission are included. Depth is a deterministic conditional sample of this field, not a measured stellar distance or confirmed membership.',
    materials: 'Independent RGB-only lenses. Every source uses the identical fitted field and every neutral alpha byte. No image ray normalization.',
    pipeline }, null, 2)));
  const m = fitted.metrics;
  const result: CompilerResult = { schema: 'cssearth-nebula-compiler-result@1', id, label: recipe.label, defaultSourceId: recipe.defaultSourceId, controls: request.controls, scene, sources, pipeline,
    inspectionBoundsArcsec: sourceData.inspectionBoundsArcsec,
    metrics: { components: m.componentCount, unconstrainedComponents: fitted.field.assumptions.velocityUncoveredComponents, stars: stars.length,
      fitRmse: m.afterRmse, baselineRmse: m.beforeRmse, missingSignalFraction: m.unassignedSum / Math.max(1e-12, m.targetSum), excessSignalFraction: m.excessSum / Math.max(1e-12, m.targetSum) },
    model, method, target: targetPin, projection, residual, interpretation: recipe.interpretation };
  readCompilerResult(result); await save('result.json', Buffer.from(JSON.stringify(result))); progress('Nebula ready', 1); return result;
}
