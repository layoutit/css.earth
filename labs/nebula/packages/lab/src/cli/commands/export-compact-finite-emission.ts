/**
 * Export the minimal checked-in surface that regenerates an accepted finite-emission dataset bank.
 *
 * The delivered inputs are the fitted emission field, its envelope gain map, the neutral alpha bank, the
 * pinned depth density and, per dataset, the registered colour raster with its coverage mask. The mask keeps
 * only the alpha the bake reads, which resizes identically to the registered original's alpha at both the
 * native and the envelope grid, so a few kilobytes replace megabytes of unread RGB.
 *
 * Nothing is fitted, acquired or re-registered here. This command reads an accepted promotion recipe and
 * its saved reconstructions and writes their replay inputs; the application preparation owns the replay.
 */
import assert from 'node:assert/strict';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { basename, dirname, resolve } from 'node:path';
import sharp from 'sharp';
import { parseLabModelJson } from '../../resources/model-paths.ts';
import { readPreparedReconstruction } from '../../server/services/density-reconstruction.ts';
import { finiteModelStarsPath } from '../../server/services/finite-dataset-bundles.ts';
import { parseVolumeDatasetPromotion } from '../../server/workflows/density/volume-dataset-promotion.ts';
import { validateChannelGain, validateDatasetToneCurve } from '@cssearth/bake/volume';

const text = (value: unknown, at: string): string => { assert.ok(typeof value === 'string' && value, `Expected text: ${at}`); return value; };
const record = (value: unknown, at: string): Record<string, unknown> => {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), `Expected an object: ${at}`);
  return value as Record<string, unknown>;
};
const [recipeArgument, objectArgument] = process.argv.slice(2);
assert.ok(recipeArgument && objectArgument, 'Usage: export-compact-finite-emission <promotion-recipe.json> <object-directory>');
const root = process.cwd();
const objectDirectory = objectArgument.replace(/\/+$/, '');
assert.match(objectDirectory, /^src\/objects\/[a-z][a-z0-9-]*$/, 'The delivery owner must be an object package.');
const compact = `${objectDirectory}/source/compact`;
const references = `${objectDirectory}/source/bake-inputs/references`;

const recipe = parseVolumeDatasetPromotion(parseLabModelJson(await readFile(resolve(root, recipeArgument), 'utf8')));

await rm(resolve(root, compact), { recursive: true, force: true });
await rm(resolve(root, references), { recursive: true, force: true });
await mkdir(resolve(root, compact), { recursive: true });
await mkdir(resolve(root, references), { recursive: true });

/** Write a delivered file and return its checked-in path and size. */
async function put(path: string, bytes: Uint8Array) {
  await mkdir(dirname(resolve(root, path)), { recursive: true });
  await writeFile(resolve(root, path), bytes);
  return { path, bytes: bytes.byteLength };
}
const putJson = (path: string, value: unknown) => put(path, gzipSync(Buffer.from(JSON.stringify(value)), { level: 9 }));
const pinOf = async (path: string) => { await readFile(resolve(root, path)); return { path }; };

// Every dataset of one promotion shares a model; its saved reconstruction names the model and its baseline.
// The per-dataset display corrections are read from the dataset's own pinned provenance: the normalized saved
// result keeps only the model and source identities, so reading them there would silently drop both.
const datasetInputs = await Promise.all(recipe.datasets.map(async dataset => {
  const result = await readPreparedReconstruction(root, dataset.resultId);
  assert.equal(result.imageId, dataset.imageId, 'Selected reconstruction belongs to another image');
  assert.ok(result.finiteMaterial, 'A compact finite-emission export needs finite material results.');
  const provenance = record(parseLabModelJson(await readFile(resolve(root, result.subject.directory, 'source/provenance.json'), 'utf8')), 'dataset provenance');
  const material = record(provenance.finiteMaterial, 'dataset finite material');
  assert.equal(material.modelResultId, result.finiteMaterial.modelResultId, 'Dataset provenance names another model.');
  assert.equal(material.sourceResultId, result.finiteMaterial.sourceResultId, 'Dataset provenance names another source.');
  return { dataset, result, finite: result.finiteMaterial,
    channelGain: material.channelGain === null ? undefined : material.channelGain, toneCurve: material.toneCurve };
}));
const modelResultId = datasetInputs[0]!.finite.modelResultId;
assert.ok(datasetInputs.every(entry => entry.finite.modelResultId === modelResultId), 'Every promoted dataset must share one finite model.');
const modelDirectory = `.local/nebula-lab/reconstructions/${modelResultId}`;
const model = record(parseLabModelJson(await readFile(resolve(root, modelDirectory, 'source/provenance.json'), 'utf8')), 'model provenance');
assert.equal(model.method, 'simulation-guided-finite-emission@1');
const geometry = record(model.geometry, 'model geometry'), request = record(model.request, 'model request');
const settings = record(model.material, 'model material').settings;
const materialSettings = record(settings, 'model material settings');
const envelope = record(model.envelope, 'model envelope');

// Model-wide inputs.
const emissionField = await putJson(`${compact}/emission-field.json.gz`,
  parseLabModelJson(await readFile(resolve(root, modelDirectory, 'source/emission-field.json'), 'utf8')));
const envelopeRecord = await putJson(`${compact}/envelope.json.gz`,
  parseLabModelJson(await readFile(resolve(root, modelDirectory, 'source/envelope.json'), 'utf8')));
const neutralSlices = await putJson(`${compact}/neutral-slices.json.gz`,
  parseLabModelJson(await readFile(resolve(root, modelDirectory, 'neutral/volume-slices.json'), 'utf8')));
await cp(resolve(root, modelDirectory, 'neutral/slices'), resolve(root, compact, 'neutral/slices'), { recursive: true });

// The depth density the envelope was fitted with. An envelope that names no alternative density was fitted with
// the model request's own cloud, exactly as the dataset bake resolves it. The delivery carries the density itself,
// and the replay recognises it by the field's own identity, so no digest is recorded beside the path.
const identityPin = record(envelope.priorCloud ?? record(request.cloud, 'model request cloud').provenance, 'envelope prior cloud');
const identityPath = text(identityPin.path, 'envelope prior path');
const priorDirectory = dirname(identityPath);
const priorRecipeBytes = await readFile(resolve(root, identityPath));
const priorRecipe = await put(`${compact}/prior/volume.json`, priorRecipeBytes);
const priorGrid = record(parseLabModelJson(priorRecipeBytes.toString()), 'prior recipe').grid;
const gridPin = record(priorGrid, 'prior grid');
assert.ok(typeof gridPin.path === 'string', 'The depth density must name its grid.');
// Every sibling the recipe names travels with it: the grid and its own provenance record.
for (const sibling of [gridPin, record(record(parseLabModelJson(priorRecipeBytes.toString()), 'prior recipe').provenance, 'prior provenance')]) {
  const relative = text(sibling.path, 'prior sibling path');
  const bytes = await readFile(resolve(root, priorDirectory, relative));
  await put(`${compact}/prior/${basename(relative)}`, bytes);
}

// The image-independent star layer of this model, already prepared and pinned by its own command.
const starsPath = await finiteModelStarsPath(root, String(datasetInputs[0]!.result.subject.sourceSubjectId), modelResultId);
assert.ok(starsPath, 'A delivered finite model needs its prepared catalogue star layer.');
const stars = await putJson(`${compact}/stars.json.gz`, parseLabModelJson(await readFile(resolve(root, starsPath), 'utf8')));

// A fitted dataset tone curve is indexed by the model's own front-projection byte, so a delivery that carries
// one also carries that projection and its pinned grid. Only then, so a delivery without curves keeps its bytes.
let toneProjection: Record<string, unknown> | undefined;
if (datasetInputs.some(entry => entry.toneCurve !== undefined)) {
  const grid = record(model.densityProjection, 'model projection grid');
  assert.ok(Number.isInteger(grid.width) && Number.isInteger(grid.height), 'A tone curve needs the model\'s pinned projection grid.');
  const image = await put(`${compact}/fit-projection.png`, await readFile(resolve(root, modelDirectory, 'source/fit-projection.png')));
  const meta = await sharp(resolve(root, image.path)).metadata();
  assert.equal(meta.width, grid.width, 'Front projection differs from its pinned grid.');
  assert.equal(meta.height, grid.height, 'Front projection differs from its pinned grid.');
  toneProjection = { image, width: grid.width, height: grid.height, tangentBoundsKpc: grid.tangentBoundsKpc };
}

const datasets = [];
for (const { dataset, result, finite, channelGain, toneCurve } of datasetInputs) {
  const sourceDirectory = `.local/nebula-lab/reconstructions/${finite.sourceResultId}`;
  const baseline = record(parseLabModelJson(await readFile(resolve(root, sourceDirectory, 'source/provenance.json'), 'utf8')), 'baseline provenance');
  assert.equal(baseline.method, 'alignment-density-material-v1');
  const work = record(baseline.request, 'baseline request');
  assert.equal(work.imageId, dataset.imageId);
  const registeredBytes = await readFile(resolve(root, sourceDirectory, 'source/registered-image.png'));
  const registered = await put(`${compact}/datasets/${dataset.imageId}/registered.png`, registeredBytes);
  // Only alpha is read from the registered original, so deliver alpha alone, losslessly and at full size.
  const original = resolve(root, sourceDirectory, 'source/original-image.png');
  const meta = await sharp(original).metadata();
  assert.ok(meta.width && meta.height, 'The registered original needs pixel dimensions.');
  const alpha = await sharp(original).ensureAlpha().extractChannel(3).toColourspace('b-w').raw().toBuffer();
  const mask = Buffer.alloc(meta.width * meta.height * 4);
  for (let p = 0; p < meta.width * meta.height; p++) mask[p * 4 + 3] = alpha[p]!;
  const coverage = await put(`${compact}/datasets/${dataset.imageId}/coverage.png`,
    await sharp(mask, { raw: { width: meta.width, height: meta.height, channels: 4 } }).png({ compressionLevel: 9, effort: 10 }).toBuffer());
  datasets.push({ imageId: dataset.imageId, sourceResultId: finite.sourceResultId, resultId: dataset.resultId,
    tangentBoundsKpc: record(baseline.geometry, 'baseline geometry').tangentBoundsKpc,
    sourcePath: text(record(work.source, 'baseline source').path, 'baseline source path'),
    registered, coverage, densityFilter: dataset.density, enabledIds: dataset.enabledIds,
    provenance: await pinOf(`${objectDirectory}/source/lenses/${dataset.imageId}/provenance.json`),
    presentation: { label: dataset.label, description: dataset.description, sourceUrl: result.subject.sourcePageUrl },
    // Only when the accepted dataset carries one, so a delivery without per-dataset correction keeps its exact bytes.
    ...(channelGain === undefined ? {} : { channelGain: validateChannelGain(channelGain) }),
    ...(toneCurve === undefined ? {} : { toneCurve: validateDatasetToneCurve(toneCurve) }),
    brightness: dataset.brightness, stars: dataset.stars });
}

const inputs = {
  schema: 'cssearth-compact-finite-emission@2', method: 'simulation-guided-finite-material@1',
  bankId: recipe.id, defaultDataset: recipe.defaultDataset, framingRadiusUnits: recipe.framingRadiusUnits,
  modelResultId, frame: request.frame,
  geometry: { observerDistanceKpc: geometry.observerDistanceKpc, tangentBoundsKpc: geometry.tangentBoundsKpc,
    physicalBoundsKpc: geometry.physicalBoundsKpc },
  material: { exposureGain: materialSettings.exposureGain, fullChromaAlphaByte: materialSettings.fullChromaAlphaByte },
  appearance: datasetInputs[0]!.result.appearance,
  encoding: { format: 'webp', quality: record(model.settings, 'model settings').quality },
  emissionField, envelope: envelopeRecord, neutralSlices, neutralTextures: `${compact}/neutral`,
  priorCloud: { recipe: priorRecipe },
  ...(toneProjection ? { toneProjection } : {}),
  stars, datasets,
  limitations: [
    'Delivered replay of an accepted image-fitted finite emission model. No fit, star removal or registration runs from these inputs.',
    'The coverage mask carries only the alpha the accepted bake reads from the registered original; its RGB is not delivered because nothing reads it.',
    'The depth density keeps the accepted pin identity so the envelope still refuses a prior it was not fitted with.',
  ],
};
const inputsPin = await put(`${compact}/inputs.json`, Buffer.from(JSON.stringify(inputs, null, 2) + '\n'));
await writeFile(resolve(root, objectDirectory, 'source/compact-delivery.json'), JSON.stringify({
  schema: 'cssearth-compact-density-delivery@1', id: recipe.id,
  delivery: { directory: objectDirectory, method: 'finite-emission', compactInputs: { path: inputsPin.path } },
  researchRecipe: { path: recipeArgument },
}, null, 2) + '\n');

// Numbered records of the laboratory inputs behind these bytes, in the shape the other nebulae use. The
// promotion recipe names the object-owned copies of its emission and dataset recipes; one that predates the
// field keeps the SMC's original layout.
const evidence = recipe.evidence ?? {
  emissionRecipe: `${objectDirectory}/source/evidence/${recipe.id}/constrained/emission-envelope-ellipsoid.json`,
  datasetRecipe: `${objectDirectory}/source/evidence/${recipe.id}/constrained/finite-datasets-ellipsoid.json`,
};
const referenced = [
  { name: 'emission-model', path: `${modelDirectory}/source/provenance.json` },
  { name: 'emission-recipe', path: evidence.emissionRecipe },
  { name: 'dataset-recipe', path: evidence.datasetRecipe },
  { name: 'promotion-recipe', path: recipeArgument },
  { name: 'depth-density', path: identityPath },
  { name: 'catalogue-stars', path: starsPath },
  ...datasetInputs.map(entry => ({ name: `baseline-${entry.dataset.imageId}`, path: `.local/nebula-lab/reconstructions/${entry.finite.sourceResultId}/source/provenance.json` })),
];
for (const [index, entry] of referenced.entries()) {
  const bytes = await readFile(resolve(root, entry.path));
  await writeFile(resolve(root, references, `${String(index + 1).padStart(2, '0')}-${entry.name}.json`),
    JSON.stringify({ schema: 'cssearth-delivered-input-reference@1', originalPath: entry.path, bytes: bytes.length,
      role: 'Laboratory record behind a delivered replay input; the delivered files are listed in source/compact/inputs.json.' }, null, 2) + '\n');
}
console.log(JSON.stringify({ compact, inputs: inputsPin, datasets: datasets.length, references: referenced.length }, null, 2));
