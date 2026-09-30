/** Offline handoff of existing cloud geometry, prepared pixels and saved display choices. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, relative, sep } from 'node:path';
import { createCloudDensityPreparer } from '../../services/density-material.ts';
import { cloudDensityWeight, validateCloudDensityFilter, type CloudDensityFilter, parsePreparedLmcStars } from '@cssearth/bake/volume';
import { createCloudInspection, parseCloudCatalogue, validateCloudBrightness } from '@cssearth/volume-viewer/scene/cloud-inspection';
import { readPreparedReconstruction } from '../../services/density-reconstruction.ts';
import { finiteModelStarsPath } from '../../services/finite-dataset-bundles.ts';
import type { CloudBrightness, CloudStarOptions } from '@cssearth/volume-viewer/scene/cloud-types';
import type { PreparedCssVolume } from '../../../adapters/renderer/volume-types.ts';
import { validatePreparedCssVolume } from '../../../adapters/renderer/volume-validation.ts';

export interface DatasetPromotion {
  imageId: string; resultId: string; label: string; description: string;
  enabledIds: string[]; brightness: CloudBrightness; density: CloudDensityFilter; stars: CloudStarOptions;
}
export interface VolumeDatasetPromotion {
  schema: 'cssearth-volume-dataset-promotion@1'; id: string; defaultDataset: string; framingRadiusUnits: number;
  datasets: DatasetPromotion[];
  /** Object-owned copies of the emission and dataset recipes behind a compact finite-emission export. */
  evidence?: { emissionRecipe: string; datasetRecipe: string };
}
const bytes = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
const token = (value: unknown): value is string => typeof value === 'string' && /^[a-z][a-z0-9-]*$/.test(value);
const json = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
async function put(path: string, value: string | Uint8Array) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, value); }
function safeRelative(path: string) {
  assert.ok(typeof path === 'string' && !path.startsWith('/') && !path.split('/').includes('..') && !/[\\\u0000-\u0020]/.test(path), 'Invalid prepared relative resource path');
  return path;
}
export function parseVolumeDatasetPromotion(value: VolumeDatasetPromotion): VolumeDatasetPromotion {
  assert.equal(value?.schema, 'cssearth-volume-dataset-promotion@1');
  assert.ok(token(value.id) && token(value.defaultDataset), 'A dataset promotion names its bank id and default dataset.');
  const keys = ['schema', 'id', 'defaultDataset', 'framingRadiusUnits', 'datasets', 'evidence'];
  const unexpected = Object.keys(value).filter(key => !keys.includes(key));
  assert.equal(unexpected.length, 0, `Dataset promotion ${value.id} has unexpected fields: ${unexpected.join(', ')}`);
  assert.ok(Number.isFinite(value.framingRadiusUnits) && value.framingRadiusUnits > 0);
  assert.ok(Array.isArray(value.datasets) && value.datasets.length > 0 && value.datasets.length <= 8);
  assert.equal(new Set(value.datasets.map(dataset => dataset.imageId)).size, value.datasets.length);
  assert.ok(value.datasets.some(dataset => dataset.imageId === value.defaultDataset));
  if (value.evidence !== undefined) {
    const evidence = value.evidence as unknown as Record<string, unknown> | null;
    assert.ok(evidence && typeof evidence === 'object' && !Array.isArray(evidence), 'Invalid promotion evidence');
    for (const key of ['emissionRecipe', 'datasetRecipe']) {
      const path: unknown = evidence[key];
      assert.ok(typeof path === 'string' && /^src\/objects\/[a-z][a-z0-9-]*\/source\/evidence\/[^\\]+\.json$/.test(path) && !path.split('/').includes('..'),
        `Promotion evidence ${key} must be an object-owned evidence copy`);
    }
  }
  for (const dataset of value.datasets) {
    assert.ok(token(dataset.imageId) && token(dataset.resultId) && typeof dataset.label === 'string' && dataset.label && typeof dataset.description === 'string');
    assert.ok(Array.isArray(dataset.enabledIds) && dataset.enabledIds.every(token));
    validateCloudBrightness(dataset.brightness); validateCloudDensityFilter(dataset.density);
    const stars = dataset.stars;
    assert.ok(stars && typeof stars.enabled === 'boolean' && Number.isFinite(stars.brightness) && stars.brightness >= 0 && stars.brightness <= 1 &&
      Number.isFinite(stars.size) && stars.size >= .5 && stars.size <= 3, 'Invalid saved star presentation');
  }
  return value;
}

/** Call into a staging directory, verify, then install it. Existing unrelated files are never deleted. */
export async function promoteVolumeDatasets(root: string, input: VolumeDatasetPromotion, destination: string) {
  const recipe = parseVolumeDatasetPromotion(input), prepareFilter = createCloudDensityPreparer(root);
  const datasets = [], outputs: Record<string, { bytes: number }> = {};
  const output = async (path: string, content: string | Uint8Array) => {
    safeRelative(path); await put(resolve(destination, path), content);
    outputs[path] = { bytes: Buffer.byteLength(content) };
  };
  let commonFrame: unknown, commonStars: unknown;
  const inputs = await Promise.all(recipe.datasets.map(async dataset => {
    const result = await readPreparedReconstruction(root, dataset.resultId);
    assert.equal(result.imageId, dataset.imageId, 'Selected reconstruction belongs to another image');
    const directory = resolve(root, result.subject.directory);
    const descriptor = await json(resolve(directory, 'inspection-object.json'));
    const preparedBytes = await readFile(resolve(directory, safeRelative(descriptor.prepared.url)));
    const volume = validatePreparedCssVolume(JSON.parse(preparedBytes.toString()).data);
    const catalogueBytes = await readFile(resolve(directory, safeRelative(descriptor.properties.preparation.source)));
    const catalogue = parseCloudCatalogue(JSON.parse(catalogueBytes.toString()), result.subject.id, volume.stacks.flatMap(stack => stack.leaves.map(leaf => leaf.id)));
    const inspection = createCloudInspection(catalogue); inspection.setSelection(dataset.enabledIds);
    assert.ok(volume.stacks.every(stack => stack.leaves.some(leaf => inspection.includes(leaf.id))), 'A promoted dataset must contain cloud signal on all axes');
    // A star layer belongs either to the subject catalogue or, for a finite emission model, to the
    // model itself; the model-owned index checks its own path, frame and realizing model.
    const owner = result.subject.sourceSubjectId;
    assert.ok(result.subject.stars || (result.finiteMaterial && token(owner)), 'A promoted dataset needs a star layer or an owning subject');
    const starsPath = result.subject.stars ?? await finiteModelStarsPath(root, owner!, result.finiteMaterial!.modelResultId);
    assert.ok(starsPath, 'A promoted dataset needs a prepared catalogue star layer');
    const stars = parsePreparedLmcStars(await json(resolve(root, starsPath)), volume.frame);
    const stellarGeometry = stars.stars.map(star => [star.id, star.positionUnits]);
    if (commonFrame) { assert.deepEqual(volume.frame, commonFrame); assert.deepEqual(stellarGeometry, commonStars); }
    else { commonFrame = volume.frame; commonStars = stellarGeometry; }
    return { dataset, result, directory, volume, catalogue, inspection, stars };
  }));
  for (const { dataset, result, directory, volume, catalogue, inspection, stars } of inputs) {
    const filtered = await prepareFilter({ subjectId: result.subject.id, filter: dataset.density });
    const filteredByPath = new Map(filtered.resources.map(resource => [resource.sourcePath, resource]));
    const stacks = volume.stacks.map(stack => ({ ...stack, leaves: stack.leaves.filter(leaf => inspection.includes(leaf.id)) }));
    const used = new Set(stacks.flatMap(stack => stack.leaves.map(leaf => leaf.texturePath)));
    const resources = [];
    for (const resource of volume.resources.filter(resource => used.has(resource.path))) {
      const sourcePath = relative(root, resolve(directory, 'prepared', safeRelative(resource.path))).split(sep).join('/');
      const source = filteredByPath.get(sourcePath); assert.ok(source, `Missing selected density texture ${sourcePath}`);
      assert.ok(source.url.startsWith('/@fs/'), 'Density filter must return a local prepared file');
      const image = await readFile(source.url.slice(4));
      const path = `${dataset.imageId}/${resource.path}`;
      await output(`prepared/${path}`, image);
      // The renderer's volume resource contract still requires a digest per texture (cssearth-density-volume@1).
      resources.push({ ...resource, path, bytes: image.length });
    }
    const preparedVolume: PreparedCssVolume = { ...volume, id: `${recipe.id}-${dataset.imageId}`, resources,
      stacks: stacks.map(stack => ({ ...stack, leaves: stack.leaves.map(leaf => ({ ...leaf, texturePath: `${dataset.imageId}/${leaf.texturePath}` })) })) };
    validatePreparedCssVolume(preparedVolume);
    const points = stars.stars.map(star => {
      const weight = cloudDensityWeight(star.cloudSignal, dataset.density);
      const support = star.cloudPartIds.some(id => dataset.enabledIds.includes(id)) ? (dataset.density.showRemoved ? 1 - weight : weight) : 0;
      return { id: star.id, positionUnits: star.positionUnits, colorCss: star.colorCss,
        sizePx: star.sizePx * dataset.stars.size, opacity: star.opacity * support * dataset.stars.brightness };
    });
    datasets.push({ id: dataset.imageId, label: dataset.label, title: dataset.label, description: dataset.description,
      sourceUrl: result.subject.sourcePageUrl, volume: preparedVolume, brightness: dataset.brightness,
      stars: { frame: stars.frame, points } });
    await output(`source/lenses/${dataset.imageId}/result.json`, bytes(result));
    await output(`source/lenses/${dataset.imageId}/provenance.json`, await readFile(resolve(directory, 'source/provenance.json')));
    await output(`source/lenses/${dataset.imageId}/catalogue-stars.json`, bytes(stars));
    await output(`source/lenses/${dataset.imageId}/selection.json`, bytes({ settings: dataset, sourceParts: catalogue, densityFilter: filtered.stats }));
  }
  const data = { schema: 'cssearth-volume-datasets@1', id: recipe.id, defaultDataset: recipe.defaultDataset,
    framingRadiusUnits: recipe.framingRadiusUnits, starsEnabled: recipe.datasets.find(dataset => dataset.imageId === recipe.defaultDataset)!.stars.enabled, datasets };
  const envelope = { schema: 'cssearth-prepared-object@1', id: recipe.id, type: 'volume-dataset-bank', format: 'cssearth-volume-datasets@1', data };
  const recipeBytes = bytes(recipe), preparedBytes = bytes(envelope);
  await output('source/lenses.json', recipeBytes);
  await output('prepared/datasets.json', preparedBytes);
  await output('object.json', bytes({ schema: 'cssearth-object@2', id: recipe.id, type: 'volume-dataset-bank',
    properties: { frame: commonFrame, preparation: { source: 'source/lenses.json' } },
    prepared: { format: 'cssearth-volume-datasets@1', url: 'prepared/datasets.json' } }));
  await put(resolve(destination, 'source/lens-manifest.json'), bytes({ schema: 'cssearth-volume-dataset-manifest@1', outputs }));
  return { id: recipe.id, datasets: datasets.map(dataset => ({ id: dataset.id, stars: dataset.stars.points.length,
    slices: dataset.volume.stacks.reduce((sum, stack) => sum + stack.leaves.length, 0) })),
    bytes: Object.values(outputs).reduce((sum, file) => sum + file.bytes, 0) };
}
