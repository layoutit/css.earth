import { mkdir, readFile, writeFile, rename, readdir, realpath } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { geometrySha, readGeometryPin } from '../geometry/registered-source';
import { COMPILER_VERSION, type CompilerRequest, type CompilerRecipe } from '../compiler/model';
import type { CompilerProgress, CompilerStep } from '../compiler/prerequisites';
import { readCompilerResult, type CompilerResult } from '../compiler/result';
import { validateCompilerResult } from '../compiler/compile';
import { loadCompilerImages, compilerImagePanel } from '../compiler/images';
import { bakeCompiler } from '../compiler/bake';
import { readCompilerBakeResult, type CompilerBakeResult, type CompilerPin } from '../compiler/bake-types';
import type { SkyBounds } from '../compiler/field-types';
import { decodeFits, float32LittleEndian } from '../getsf-fits';
import { readSampledRecipe, verifySampledEvidence } from './model';
import { prepareSampledField } from './field';
import { sampledStars } from './stars';
import { sampledPanels } from './panels';
import { sampledOwnerPins } from './ownership';
import { jointRecord } from '../joint-fit/model';
import { sampledBakeProgress } from './progress';
import { registerComponentBanks } from './layout';

async function readSourcePin(root: string, pin: CompilerPin): Promise<Buffer> {
  if (!/^(labs\/nebula\/(models|src)\/|\.local\/nebula-lab\/)/.test(pin.path) || /[\\?#\s]/.test(pin.path) ||
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
  const owners = (await readdir(resolve(root, 'labs/nebula/src/reconstruction/compiler'))).filter(n => n.endsWith('.ts') && !n.endsWith('.test.ts')).sort();
  const implementation = await Promise.all(owners.map(async name => ({ name, sha256: geometrySha(await readFile(resolve(root, 'labs/nebula/src/reconstruction/compiler', name))) })));
  const extraPaths = (await readdir(resolve(root, 'labs/nebula/src/reconstruction/sampled-prior'))).filter(n => n.endsWith('.ts') && !n.endsWith('.test.ts'))
    .sort().map(n => `labs/nebula/src/reconstruction/sampled-prior/${n}`);
  extraPaths.push('labs/nebula/src/reconstruction/getsf-fits.ts');
  const extraImplementation = await Promise.all(extraPaths.map(async path => ({ path, sha256: geometrySha(await readFile(resolve(root, path))) })));
  const inputPins = [{ path: recipe.sampledRecipe, sha256: geometrySha(sampledBytes) }, sampled.evidence,
    { path: sampled.source.path, sha256: sampled.source.sha256 }];
  const id = geometrySha(JSON.stringify({ version: COMPILER_VERSION, implementation, extraImplementation, inputPins,
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
  const fieldIdentity = geometrySha(JSON.stringify({ inputPins, extraImplementation, evidence: prepared.evidence }));
  const ejecta = await save('ejecta.float32', float32LittleEndian(prepared.ejecta)), wind = await save('wind.float32', float32LittleEndian(prepared.pwn));
  const model = await save('field.json', Buffer.from(JSON.stringify({ schema: 'cssearth-sampled-emission-field@1', fieldIdentity,
    ...prepared.evidence, source: sampled.source, rawToArcsec: sampled.rawToArcsec, terms: sampled.terms, ejecta, wind })));
  pipeline.push({ id: 'sampled-field', label: 'Qualified ejecta samples + independent wind model', state: 'complete', seconds: (performance.now() - started) / 1000 });
  started = performance.now();
  const stars = await sampledStars(reference, sourceData.images, field, recipe.maximumStars, sampled.pulsar);
  pipeline.push({ id: 'stars', label: 'Observed field lights and named central source', state: 'complete', seconds: (performance.now() - started) / 1000 });
  const cx = (field.bounds.min[0] + field.bounds.max[0]) / 2, cy = (field.bounds.min[1] + field.bounds.max[1]) / 2;
  const span = Math.max(field.bounds.max[0] - field.bounds.min[0], field.bounds.max[1] - field.bounds.min[1]) * 1.04;
  const skyBounds: SkyBounds = { min: [cx - span / 2, cy - span / 2], max: [cx + span / 2, cy + span / 2] };
  started = performance.now();
  // Independent radiative components share a frame, never an inferred photo extrusion.
  // Within one mixture the normal baker enforces exact shared alpha for its RGB materials.
  const groups = new Map<string, typeof sourceData.images>();
  for (const image of sourceData.images) {
    const weights = sampled.lensComponents[image.id]!, key = `${weights.ejecta},${weights.pwn}`;
    const group = groups.get(key) ?? []; group.push(image); groups.set(key, group);
  }
  const neutral = await bakeCompiler({ root, outputDirectory: `${directory}/scene-neutral`, id, fieldIdentity, boundsArcsec: field.bounds,
    skyBoundsArcsec: skyBounds, sampleEmission: field.sampleEmission, lenses: [{ id: 'neutral-material', label: 'Neutral components', sampleRgb(_x, _y, rgb) { rgb.fill(255); return true; } }],
    stars: stars.map(({ materials: _materials, ...star }) => star), signal,
    progress: p => progress(`Neutral components · ${p.message}`, .3 + .08 * sampledBakeProgress(p)) });
  const lenses: CompilerBakeResult['lenses'] = []; let groupIndex = 0;
  for (const [key, images] of groups) {
    const [ejectaWeight, pwnWeight] = key.split(',').map(Number), mixture = prepared.field({ ejecta: ejectaWeight!, pwn: pwnWeight! });
    const bank = await bakeCompiler({ root, outputDirectory: `${directory}/scene-${groupIndex}`, id, fieldIdentity,
      boundsArcsec: field.bounds, skyBoundsArcsec: skyBounds, sampleEmission: mixture.sampleEmission,
      lenses: images.map(image => ({ id: image.id, label: image.label, sampleRgb: image.sampleRgb })), signal,
      progress: p => progress(`${images.map(i => i.label).join(' / ')} · ${p.message}`, .4 + .5 * (groupIndex + sampledBakeProgress(p)) / groups.size) });
    lenses.push(...bank.lenses.map(lens => ({ ...lens, alphaSha256: bank.alphaSha256 }))); groupIndex++;
  }
  progress('Registering spectral pixels on the retained union geometry…', .91);
  const registered = await registerComponentBanks(root, `${directory}/registered`, neutral, lenses, signal);
  const scene = readCompilerBakeResult({ ...registered, lenses: sourceData.images.map(image => registered.lenses.find(lens => lens.id === image.id)!),
    stars: neutral.stars.map((star, index) => ({ ...star, materials: stars[index]!.materials })) });
  pipeline.push({ id: 'bake', label: 'Bake component-aware spectral volumes', state: 'complete', seconds: (performance.now() - started) / 1000 });
  const sources: CompilerResult['sources'] = [];
  for (const image of sourceData.images) {
    const original = await compilerImagePanel(image, skyBounds, true, 512), starless = await compilerImagePanel(image, skyBounds, false, 512);
    sources.push({ id: image.id, label: image.label, credit: image.credit, page: image.page, width: original.width, height: original.height,
      boundsArcsec: skyBounds, original: await save(`source-${image.id}.png`, original.bytes), starless: await save(`starless-${image.id}.png`, starless.bytes) });
  }
  const comparison = await sampledPanels(prepared.field(sampled.lensComponents[reference.id]!), reference, skyBounds);
  const sampledPrior = { recipe: await save('sampled-recipe.json', sampledBytes), evidence: await save('physical-evidence.json', evidenceBytes), source: inputPins[2],
    emissionComponents: sampled.lensComponents, coordinateEvidence: prepared.evidence };
  const method = await save('method.json', Buffer.from(JSON.stringify({ version: COMPILER_VERSION, implementation, extraImplementation, inputPins,
    recipe, recipeSha256: geometrySha(recipeBytes), request, sampledPrior, pipeline,
    materials: 'The qualified spatial points and independent analytic wind retain one fixed coordinate frame. Spectral tracer weights intentionally change component emission/alpha; photographs supply RGB within each selected support. No photo is extruded or used to move the samples.',
    stars: 'Observed reference residual positions with deterministic conditional support depths; not measured membership. The named pulsar uses a separately pinned position and authored angular display size, without simulated time variability.',
    metrics: 'Image-space display-luminance disagreement against the default starless composite. This operator does not fit those pixels, calibrate radiance, or infer accuracy of its depth from this score.',
    limitations: ['SITELLE depth depends on the cited expansion law and sky registration.', 'Spectral epochs differ; no false common epoch is applied.',
      'Analytic wind thickness, jets and tracer strengths remain explicit model/presentation assumptions.', 'Emission-only transport omits scattering, absorption and Doppler boosting.'] }, null, 2)));
  const result: CompilerResult = { schema: 'cssearth-nebula-compiler-result@1', id, label: recipe.label, defaultSourceId: recipe.defaultSourceId,
    controls: request.controls, scene, sources, pipeline, inspectionBoundsArcsec: sourceData.inspectionBoundsArcsec,
    metrics: { components: prepared.evidence.pointCount + sampled.terms.length, unconstrainedComponents: sampled.terms.length, stars: stars.length, ...comparison.metrics },
    model, method, target: await save('target.png', comparison.target), projection: await save('projection.png', comparison.projection),
    residual: await save('residual.png', comparison.residual), interpretation: recipe.interpretation };
  readCompilerResult(result); await validateSpatialArtifacts(root, result);
  await save('result.json', Buffer.from(JSON.stringify(result))); progress('Spatial nebula and pulsar ready', 1); return result;
}
