/** Offline handoff of existing cloud geometry, prepared pixels and saved display choices. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, relative, sep } from 'node:path';
import { createCloudDensityPreparer } from '../../services/density-material.ts';
import { cloudDensityWeight, validateCloudDensityFilter, type CloudDensityFilter, parsePreparedLmcStars } from '@cssearth/bake/volume';
import { createCloudInspection, parseCloudCatalogue, validateCloudBrightness } from '@cssearth/volume-viewer/scene/cloud-inspection';
import { readPreparedReconstruction } from '../../services/density-reconstruction.ts';
import { finiteModelStarsPath } from '../../services/finite-lens-bundles.ts';
import type { CloudBrightness, CloudStarOptions } from '@cssearth/volume-viewer/scene/cloud-types';
import type { PreparedCssVolume } from '../../../adapters/renderer/volume-types.ts';
import { validatePreparedCssVolume } from '../../../adapters/renderer/volume-validation.ts';

export interface LensPromotion {
  imageId: string; resultId: string; label: string; description: string;
  enabledIds: string[]; brightness: CloudBrightness; density: CloudDensityFilter; stars: CloudStarOptions;
}
export interface VolumeLensPromotion {
  schema: 'cssearth-volume-lens-promotion@1'; id: string; defaultLens: string; framingRadiusUnits: number;
  settingsReceiptSha256: string; lenses: LensPromotion[];
  /** Object-owned copies of the emission and lens recipes behind a compact finite-emission export. */
  evidence?: { emissionRecipe: string; lensRecipe: string };
}
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const bytes = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
const token = (value: unknown): value is string => typeof value === 'string' && /^[a-z][a-z0-9-]*$/.test(value);
const sha = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const json = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
async function put(path: string, value: string | Uint8Array) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, value); }
function safeRelative(path: string) {
  assert.ok(typeof path === 'string' && !path.startsWith('/') && !path.split('/').includes('..') && !/[\\\u0000-\u0020]/.test(path), 'Invalid prepared relative resource path');
  return path;
}
export function parseVolumeLensPromotion(value: VolumeLensPromotion): VolumeLensPromotion {
  assert.equal(value?.schema, 'cssearth-volume-lens-promotion@1');
  assert.ok(token(value.id) && token(value.defaultLens) && sha(value.settingsReceiptSha256));
  assert.ok(Number.isFinite(value.framingRadiusUnits) && value.framingRadiusUnits > 0);
  assert.ok(Array.isArray(value.lenses) && value.lenses.length > 0 && value.lenses.length <= 8);
  assert.equal(new Set(value.lenses.map(lens => lens.imageId)).size, value.lenses.length);
  assert.ok(value.lenses.some(lens => lens.imageId === value.defaultLens));
  if (value.evidence !== undefined) {
    const evidence = value.evidence as unknown as Record<string, unknown> | null;
    assert.ok(evidence && typeof evidence === 'object' && !Array.isArray(evidence), 'Invalid promotion evidence');
    for (const key of ['emissionRecipe', 'lensRecipe']) {
      const path: unknown = evidence[key];
      assert.ok(typeof path === 'string' && /^src\/objects\/[a-z][a-z0-9-]*\/source\/evidence\/[^\\]+\.json$/.test(path) && !path.split('/').includes('..'),
        `Promotion evidence ${key} must be an object-owned evidence copy`);
    }
  }
  for (const lens of value.lenses) {
    assert.ok(token(lens.imageId) && sha(lens.resultId) && typeof lens.label === 'string' && lens.label && typeof lens.description === 'string');
    assert.ok(Array.isArray(lens.enabledIds) && lens.enabledIds.every(token));
    validateCloudBrightness(lens.brightness); validateCloudDensityFilter(lens.density);
    const stars = lens.stars;
    assert.ok(stars && typeof stars.enabled === 'boolean' && Number.isFinite(stars.brightness) && stars.brightness >= 0 && stars.brightness <= 1 &&
      Number.isFinite(stars.size) && stars.size >= .5 && stars.size <= 3, 'Invalid saved star presentation');
  }
  return value;
}

/** Call into a staging directory, verify, then install it. Existing unrelated files are never deleted. */
export async function promoteVolumeLenses(root: string, input: VolumeLensPromotion, destination: string) {
  const recipe = parseVolumeLensPromotion(input), prepareFilter = createCloudDensityPreparer(root);
  const lenses = [], outputs: Record<string, { sha256: string; bytes: number }> = {};
  const output = async (path: string, content: string | Uint8Array) => {
    safeRelative(path); await put(resolve(destination, path), content);
    outputs[path] = { sha256: hash(content), bytes: Buffer.byteLength(content) };
  };
  let commonFrame: unknown, commonStars: unknown;
  const inputs = await Promise.all(recipe.lenses.map(async lens => {
    const result = await readPreparedReconstruction(root, lens.resultId);
    assert.equal(result.imageId, lens.imageId, 'Selected reconstruction belongs to another image');
    const directory = resolve(root, result.subject.directory);
    const descriptor = await json(resolve(directory, 'inspection-object.json'));
    const preparedBytes = await readFile(resolve(directory, safeRelative(descriptor.prepared.url)));
    assert.equal(hash(preparedBytes), descriptor.prepared.sha256);
    const volume = validatePreparedCssVolume(JSON.parse(preparedBytes.toString()).data);
    const catalogueBytes = await readFile(resolve(directory, safeRelative(descriptor.properties.preparation.source)));
    assert.equal(hash(catalogueBytes), descriptor.properties.preparation.sha256);
    const catalogue = parseCloudCatalogue(JSON.parse(catalogueBytes.toString()), result.subject.id, volume.stacks.flatMap(stack => stack.leaves.map(leaf => leaf.id)));
    const inspection = createCloudInspection(catalogue); inspection.setSelection(lens.enabledIds);
    assert.ok(volume.stacks.every(stack => stack.leaves.some(leaf => inspection.includes(leaf.id))), 'A promoted lens must contain cloud signal on all axes');
    // A star layer belongs either to the subject catalogue or, for a finite emission model, to the
    // model itself; the model-owned index verifies its own pin, frame and realizing model.
    const owner = result.subject.sourceSubjectId;
    assert.ok(result.subject.stars || (result.finiteMaterial && token(owner)), 'A promoted lens needs a star layer or an owning subject');
    const starsPath = result.subject.stars ?? await finiteModelStarsPath(root, owner!, result.finiteMaterial!.modelResultId);
    assert.ok(starsPath, 'A promoted lens needs a prepared catalogue star layer');
    const stars = parsePreparedLmcStars(await json(resolve(root, starsPath)), volume.frame);
    const stellarGeometry = stars.stars.map(star => [star.id, star.positionUnits]);
    if (commonFrame) { assert.deepEqual(volume.frame, commonFrame); assert.deepEqual(stellarGeometry, commonStars); }
    else { commonFrame = volume.frame; commonStars = stellarGeometry; }
    return { lens, result, directory, volume, catalogue, inspection, stars };
  }));
  for (const { lens, result, directory, volume, catalogue, inspection, stars } of inputs) {
    const filtered = await prepareFilter({ subjectId: result.subject.id, filter: lens.density });
    const filteredByPath = new Map(filtered.resources.map(resource => [resource.sourcePath, resource]));
    const stacks = volume.stacks.map(stack => ({ ...stack, leaves: stack.leaves.filter(leaf => inspection.includes(leaf.id)) }));
    const used = new Set(stacks.flatMap(stack => stack.leaves.map(leaf => leaf.texturePath)));
    const resources = [];
    for (const resource of volume.resources.filter(resource => used.has(resource.path))) {
      const sourcePath = relative(root, resolve(directory, 'prepared', safeRelative(resource.path))).split(sep).join('/');
      const source = filteredByPath.get(sourcePath); assert.ok(source, `Missing selected density texture ${sourcePath}`);
      assert.ok(source.url.startsWith('/@fs/'), 'Density filter must return a local prepared file');
      const image = await readFile(source.url.slice(4));
      const path = `${lens.imageId}/${resource.path}`;
      await output(`prepared/${path}`, image);
      resources.push({ ...resource, path, sha256: hash(image), bytes: image.length });
    }
    const preparedVolume: PreparedCssVolume = { ...volume, id: `${recipe.id}-${lens.imageId}`, resources,
      stacks: stacks.map(stack => ({ ...stack, leaves: stack.leaves.map(leaf => ({ ...leaf, texturePath: `${lens.imageId}/${leaf.texturePath}` })) })) };
    validatePreparedCssVolume(preparedVolume);
    const points = stars.stars.map(star => {
      const weight = cloudDensityWeight(star.cloudSignal, lens.density);
      const support = star.cloudPartIds.some(id => lens.enabledIds.includes(id)) ? (lens.density.showRemoved ? 1 - weight : weight) : 0;
      return { id: star.id, positionUnits: star.positionUnits, colorCss: star.colorCss,
        sizePx: star.sizePx * lens.stars.size, opacity: star.opacity * support * lens.stars.brightness };
    });
    lenses.push({ id: lens.imageId, label: lens.label, title: lens.label, description: lens.description,
      sourceUrl: result.subject.sourcePageUrl, volume: preparedVolume, brightness: lens.brightness,
      stars: { frame: stars.frame, points } });
    await output(`source/lenses/${lens.imageId}/result.json`, bytes(result));
    await output(`source/lenses/${lens.imageId}/provenance.json`, await readFile(resolve(directory, 'source/provenance.json')));
    await output(`source/lenses/${lens.imageId}/catalogue-stars.json`, bytes(stars));
    await output(`source/lenses/${lens.imageId}/selection.json`, bytes({ settings: lens, sourceParts: catalogue, densityFilter: filtered.stats }));
  }
  const data = { schema: 'cssearth-volume-lenses@1', id: recipe.id, defaultLens: recipe.defaultLens,
    framingRadiusUnits: recipe.framingRadiusUnits, starsEnabled: recipe.lenses.find(lens => lens.imageId === recipe.defaultLens)!.stars.enabled, lenses };
  const envelope = { schema: 'cssearth-prepared-object@1', id: recipe.id, type: 'volume-lens-bank', format: 'cssearth-volume-lenses@1', data };
  const recipeBytes = bytes(recipe), preparedBytes = bytes(envelope);
  await output('source/lenses.json', recipeBytes);
  await output('prepared/lenses.json', preparedBytes);
  await output('object.json', bytes({ schema: 'cssearth-object@1', id: recipe.id, type: 'volume-lens-bank',
    properties: { frame: commonFrame, preparation: { source: 'source/lenses.json' } },
    prepared: { format: 'cssearth-volume-lenses@1', url: 'prepared/lenses.json' } }));
  await put(resolve(destination, 'source/lens-manifest.json'), bytes({ schema: 'cssearth-volume-lens-manifest@1', outputs }));
  return { id: recipe.id, lenses: lenses.map(lens => ({ id: lens.id, stars: lens.stars.points.length,
    slices: lens.volume.stacks.reduce((sum, stack) => sum + stack.leaves.length, 0) })),
    bytes: Object.values(outputs).reduce((sum, file) => sum + file.bytes, 0) };
}
