import { implementationPins } from '@cssearth/nebula-lab/server/implementation';
/** One reproducible optical-material experiment on an explicitly pinned existing cloud. */
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { geometrySha, readGeometryPin } from '../geometry/registered-source.ts';
import { jointRecord, jointPath } from '../../../features/joint-fit/model.ts';
import { readCompilerRecipe, readCompilerRequest } from '../../../features/compiler/model.ts';
import { validateCompilerResult } from './bank-validation.ts';
import { readCompilerResult, type CompilerResult } from '../../../features/compiler/result.ts';
import { readRetainedEmissionField } from '@cssearth/volume-core/fields/retained-emission';
import { createEmissionField } from '@cssearth/volume-core/fields/emission';
import { createEmissionMaterial } from '@cssearth/volume-core/materials/component-material';
import { loadCompilerImages, compilerImagePanel } from './images.ts';
import { createOpticalComposite } from '@cssearth/nebula-reconstruction/observations/optical-composite';
import { prepareRetainedMaterialBank } from './retained-material-bank.ts';
import { restoreOpticalCompositeSources } from './optical-composite-inputs.ts';
import type { CompilerPin } from '@cssearth/volume-core/contracts/compiler-bake';

function sourcePin(v: unknown): CompilerPin {
  if (!jointRecord(v) || !jointPath(v.path) || !v.path.startsWith('.local/nebula-lab/')) throw new TypeError('Invalid composite source path.');
  return { path: v.path };
}
function modelPath(v: unknown): string {
  if (!jointPath(v) || !v.startsWith('labs/nebula/models/')) throw new TypeError('Invalid composite recipe path.'); return v;
}
export function readOpticalCompositeRecipe(v: unknown) {
  if (!jointRecord(v) || v.schema !== 'cssearth-optical-composite-recipe@1' ||
      typeof v.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,95}$/.test(v.id) || typeof v.label !== 'string' || !v.label.trim() ||
      !jointPath(v.observationCatalogue) || !v.observationCatalogue.startsWith('.local/nebula-lab/observations/') ||
      typeof v.detailSourceId !== 'string' || typeof v.wideSourceId !== 'string' || v.detailSourceId === v.wideSourceId ||
      typeof v.featherArcsec !== 'number' || !Number.isFinite(v.featherArcsec) || v.featherArcsec < 1 || v.featherArcsec > 3600 ||
      typeof v.lowFrequencyArcsec !== 'number' || !Number.isFinite(v.lowFrequencyArcsec) || v.lowFrequencyArcsec < 1 || v.lowFrequencyArcsec > 300 ||
      typeof v.interpretation !== 'string') throw new TypeError('Invalid optical composite recipe.');
  return { schema: v.schema, id: v.id, label: v.label, compilerRecipe: modelPath(v.compilerRecipe),
    baseResult: sourcePin(v.baseResult), neutralSlices: sourcePin(v.neutralSlices), observationRecipe: modelPath(v.observationRecipe),
    observationCatalogue: v.observationCatalogue, detailSourceId: v.detailSourceId, wideSourceId: v.wideSourceId,
    featherArcsec: v.featherArcsec, lowFrequencyArcsec: v.lowFrequencyArcsec, interpretation: v.interpretation };
}

interface SuppliedCompositeBase { result: CompilerResult; neutralSlices: CompilerPin; sourceInputs: CompilerPin[]; signal: AbortSignal }

/** Standalone research replay continues to use the historical recipe's explicit cloud/slice pins. */
export async function prepareOpticalComposite(root: string, recipePath: string, previewOnly = false,
  progress: (message: string) => void = () => {}) {
  const { result: _result, ...prepared } = await prepareComposite(root, recipePath, previewOnly, progress);
  return prepared;
}

/** Add the same component-bound material to a freshly compiled cloud, without publishing it to the lab. */
export async function prepareOpticalCompositeForResult(root: string, recipePath: string, value: CompilerResult,
  options: { signal?: AbortSignal; progress?: (message: string) => void } = {}): Promise<CompilerResult> {
  const signal = options.signal ?? new AbortController().signal, progress = options.progress ?? (() => {});
  signal.throwIfAborted();
  const result = await validateCompilerResult(root, value);
  const recipe = readOpticalCompositeRecipe(JSON.parse(await readFile(resolve(root, modelPath(recipePath)), 'utf8')));
  const neutralPath = `${dirname(result.scene.neutral.path)}/volume-slices.json`;
  const neutralSlices = sourcePin({ path: neutralPath, sha256: geometrySha(await readFile(resolve(root, neutralPath))) });
  const sourceInputs = await restoreOpticalCompositeSources(root, recipe, signal, progress);
  const prepared = await prepareComposite(root, recipePath, false, progress, { result, neutralSlices, sourceInputs, signal });
  if (!prepared.result) throw new Error('Composite preparation produced no compiler result.');
  return prepared.result;
}

async function prepareComposite(root: string, recipePath: string, previewOnly: boolean,
  progress: (message: string) => void, supplied?: SuppliedCompositeBase) {
  const started = performance.now();
  const recipeBytes = await readFile(resolve(root, modelPath(recipePath))), recipe = readOpticalCompositeRecipe(JSON.parse(recipeBytes.toString()));
  const base = supplied?.result ?? await validateCompilerResult(root, JSON.parse((await readGeometryPin(root, recipe.baseResult)).toString()));
  const neutralSlices = supplied?.neutralSlices ?? recipe.neutralSlices;
  if (base.sources.some(s => s.id === recipe.id)) throw new TypeError('Composite identity already exists in the retained cloud.');
  const previous: unknown = JSON.parse((await readGeometryPin(root, base.method)).toString());
  if (!jointRecord(previous)) throw new TypeError('Missing original cloud method.');
  const compilerBytes = await readFile(resolve(root, recipe.compilerRecipe)), compilerRecipe = readCompilerRecipe(JSON.parse(compilerBytes.toString()));
  const request = readCompilerRequest(previous.request);
  if (geometrySha(compilerBytes) !== previous.recipeSha256 || request.recipePath !== recipe.compilerRecipe || !compilerRecipe.depthRecipe)
    throw new TypeError('Composite must use the retained cloud recipe and sky frame.');
  const depth = previous.physicalDepth;
  if (!jointRecord(depth)) throw new TypeError('Composite requires the retained sky-frame snapshot.');
  const originalDepth: unknown = JSON.parse((await readGeometryPin(root, sourcePin(depth.recipe))).toString());
  if (!jointRecord(originalDepth) || !Array.isArray(originalDepth.centerIcrsDegrees) || originalDepth.centerIcrsDegrees.length !== 2 ||
      !originalDepth.centerIcrsDegrees.every(Number.isFinite)) throw new TypeError('Missing composite sky origin.');
  const center: [number, number] = [Number(originalDepth.centerIcrsDegrees[0]), Number(originalDepth.centerIcrsDegrees[1])];
  const data = await loadCompilerImages(root, recipe.observationCatalogue, { ...request, imageToFrame: {} }, center, true, recipe.lowFrequencyArcsec);
  const detail = data.images.find(image => image.id === recipe.detailSourceId), wide = data.images.find(image => image.id === recipe.wideSourceId);
  if (!detail || !wide || data.images.length !== 2) throw new TypeError('Composite needs exactly its two qualified native optical images.');
  const composite = createOpticalComposite(detail, wide, base.scene.skyBoundsArcsec, { method: 'detail-fusion', featherArcsec: recipe.featherArcsec, maxFitSamples: 16384 });
  const image = { ...detail, id: recipe.id, label: recipe.label, credit: `${detail.credit}; ${wide.credit}`, ...composite };
  const inputPaths = [recipePath, recipe.compilerRecipe, recipe.observationRecipe, recipe.observationCatalogue,
    compilerRecipe.observationRecipe, compilerRecipe.observationCatalogue, compilerRecipe.structureRecipe, compilerRecipe.structureCatalogue,
    ...(compilerRecipe.observedStars ? [compilerRecipe.observedStars.path] : []), compilerRecipe.depthRecipe];
  const activeDepth: unknown = JSON.parse(await readFile(resolve(root, compilerRecipe.depthRecipe), 'utf8'));
  if (!jointRecord(activeDepth) || !jointRecord(activeDepth.evidence) || typeof activeDepth.evidence.path !== 'string') throw new TypeError('Missing cloud evidence.');
  inputPaths.push(activeDepth.evidence.path);
  const sourcePins = data.images.flatMap(image => [image.original, image.diffuse, image.stars].map(layer => ({ path: layer.path, sha256: layer.sha256 })));
  const implementation = await implementationPins(root, ['labs/nebula/packages/lab/src/server/workflows/compiler/optical-composite-preparation.ts']);
  const inputs = await Promise.all([...new Set([...inputPaths, ...sourcePins.map(pin => pin.path),
    ...(supplied?.sourceInputs.map(pin => pin.path) ?? []), ...(supplied ? [neutralSlices.path] : []),
    ...implementation.map(owner => owner.path)])]
    .map(async path => ({ path, sha256: geometrySha(await readFile(resolve(root, path))) })));
  if (supplied?.sourceInputs.some(pin => !inputs.some(input => input.path === pin.path)))
    throw new Error('Composite source inputs changed during preparation.');
  const baseBytes = Buffer.from(JSON.stringify(base));
  const id = geometrySha(JSON.stringify({ recipe: geometrySha(recipeBytes),
    base: supplied ? { id: base.id, sha256: geometrySha(baseBytes), neutralSlices } : recipe.baseResult, inputs, fit: composite.metadata }));
  const directory = `.local/nebula-lab/compiler/${id}`; await mkdir(resolve(root, directory), { recursive: true });
  if (supplied) {
    try {
      const cached = await validateCompilerResult(root, JSON.parse(await readFile(resolve(root, directory, 'result.json'), 'utf8')));
      if (cached.id !== id) throw new TypeError('Cached composite result identity differs.');
      progress('Prepared optical composite restored.');
      return { id, directory, fit: composite.metadata, publication: undefined, result: cached };
    } catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
  }
  const save = async (name: string, bytes: Uint8Array) => { const path = `${directory}/${name}`;
    supplied?.signal.throwIfAborted();
    await writeFile(resolve(root, `${path}.pending`), bytes); await rename(resolve(root, `${path}.pending`), resolve(root, path));
    return { path, sha256: geometrySha(bytes) }; };
  progress(`Optical detail fusion: ${recipe.lowFrequencyArcsec} arcsec Gaussian scale; ${recipe.featherArcsec} arcsec edge feather; wide-field colour retained.`);
  const original = await compilerImagePanel(image, base.scene.skyBoundsArcsec, true, 2048);
  const starless = await compilerImagePanel(image, base.scene.skyBoundsArcsec, false, 2048);
  const originalPin = await save('optical-composite-original.png', original.bytes), starlessPin = await save('optical-composite-starless.png', starless.bytes);
  await save('optical-composite.json', Buffer.from(JSON.stringify({ recipe, fit: composite.metadata, sourcePins, nativeGrids: data.images.map(image =>
    ({ id: image.id, width: image.diffuse.width, height: image.diffuse.height })), original: originalPin, starless: starlessPin }, null, 2)));
  if (previewOnly) return { id, directory, fit: composite.metadata, publication: undefined, result: undefined };
  if (composite.metadata.status !== 'fitted' && composite.metadata.status !== 'detail-fusion') throw new Error('Optical composition failed; inspect the prepared images before any 3D bake.');
  const fieldModel = readRetainedEmissionField(JSON.parse((await readGeometryPin(root, base.model)).toString()));
  if (fieldModel.identity !== base.scene.fieldIdentity) throw new TypeError('Retained cloud field identity differs.');
  const field = createEmissionField(fieldModel), material = createEmissionMaterial(fieldModel, image, field);
  const lens = await prepareRetainedMaterialBank({ root, outputDirectory: `${directory}/optical-composite`, scene: base.scene,
    neutralSlicesPin: neutralSlices, sampleEmission: field.sampleEmission, lens: { id: recipe.id, label: recipe.label, sampleMaterial: material.sampleMaterial },
    onProgress: value => { supplied?.signal.throwIfAborted(); if (value.completed % 100 === 0 || value.completed === value.total) progress(`Optical material: ${value.completed}/${value.total} retained slabs`); } });
  const physicalDepth = { ...depth, recipe: await save('depth-recipe.json', await readGeometryPin(root, sourcePin(depth.recipe))),
    evidence: await save('physical-evidence.json', await readGeometryPin(root, sourcePin(depth.evidence))) };
  const method = await save('method.json', Buffer.from(JSON.stringify({ ...previous, implementation, physicalDepth,
    opticalComposite: { recipe: { path: recipePath, sha256: geometrySha(recipeBytes) }, sourcePins, fit: composite.metadata, material: material.receipt,
      retainedResult: supplied ? await save('base-result.json', baseBytes) : recipe.baseResult,
      ...(supplied ? { neutralSlices, inputs, baseSelection: 'supplied-compiler-result; historical recipe cloud pins are inspection provenance only' } : {}),
      interpretation: recipe.interpretation },
    execution: 'Existing cloud and stars retained; only one optical component-bound material prepared. Historical material limitations remain.' }, null, 2)));
  const stars = base.scene.stars.map(star => {
    if (!star.materials) return star;
    const material = star.materials[recipe.detailSourceId];
    if (!material) throw new TypeError('Retained stars do not carry the composite detail-source material.');
    return { ...star, materials: { ...star.materials, [recipe.id]: { ...material, rgb: [...material.rgb] } } };
  });
  const result = readCompilerResult({ ...base, id, method,
    pipeline: [...base.pipeline, { id: 'optical-composite', label: 'Blend optical sources · retain cloud', state: 'complete', seconds: (performance.now() - started) / 1000 }],
    scene: { ...base.scene, id, volumeId: base.scene.volumeId ?? base.id,
    lenses: [...base.scene.lenses, lens], stars }, sources: [...base.sources, { id: recipe.id, label: recipe.label, credit: image.credit,
      page: wide.page, width: original.width, height: original.height, boundsArcsec: base.scene.skyBoundsArcsec, original: originalPin, starless: starlessPin }] });
  await validateCompilerResult(root, result);
  const resultPin = await save('result.json', Buffer.from(JSON.stringify(result)));
  if (supplied) return { id, directory, fit: composite.metadata, publication: undefined, result };
  const publication = { schema: 'cssearth-nebula-compiler-published@1', recipePath: recipe.compilerRecipe, result: resultPin, inputs };
  await save('publication.json', Buffer.from(JSON.stringify(publication, null, 2)));
  return { id, directory, fit: composite.metadata, publication, result };
}
