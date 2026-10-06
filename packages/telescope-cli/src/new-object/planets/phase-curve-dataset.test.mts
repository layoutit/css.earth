/** A published phase-curve fit as a heat-map dataset beside a planet's default dataset (phase-curve-dataset.mts), offline. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { installPhaseCurveDataset, parsePhaseCurveEntries } from './phase-curve-dataset.mts';

const test = sourceTest();

test('the phase-curve route rebuilds HD 209458 b\'s hand-made Zellem heat map: the same record, range, palette and dataset, and the page opens on it', async () => {
  const id = 'hd-209458b', o = `src/objects/${id}`, root = new URL('../../../../../', import.meta.url);
  const paths = ['object.json', 'text.json', 'source/preparation/raster.json', 'source/content/object.json', 'source/manifest.json'];
  const files = new Map<string, string | Buffer>(await Promise.all(paths.map(async path => [`${o}/${path}`, await readFile(new URL(`${o}/${path}`, root), 'utf8')] as const)));
  const before = (path: string) => JSON.parse(String(files.get(`${o}/${path}`))) as Record<string, any>;
  const hand = { surface: before('source/preparation/raster.json').surfaces.find((surface: { id: string }) => surface.id === 'temperature'),
    control: before('source/content/object.json').datasets.controls.find((control: { id: string }) => control.id === 'temperature'), datasets: before('object.json').properties.recipe.surfaces[0].datasets };
  const record = JSON.parse(await readFile(new URL(`${o}/source/science/zellem-2014/phase-curve.json`, root), 'utf8'));
  const [entry] = parsePhaseCurveEntries([{ id, dataset: 'temperature', label: 'Spitzer', path: 'science/zellem-2014/phase-curve.json', url: 'https://arxiv.org/abs/1405.5923',
    credit: 'Zellem et al. (2014)', observed: 'a Spitzer phase curve of January 2010', record }]).get(id)!;
  // The package under test opens on its thermal color, as it did before a measured map took the default from one color.
  const authored = before('source/content/object.json'); authored.datasets.defaultDataset = 'thermal'; files.set(`${o}/source/content/object.json`, JSON.stringify(authored));
  const { minimum, maximum, hottest, promoted } = await installPhaseCurveDataset(files, id, 'HD 209458 b', entry!);
  assert.equal(promoted, true);
  assert.deepEqual([minimum, maximum, hottest], [850, 1600, 41], 'the range the hand-made dataset drew, and its hottest longitude');
  const after = (path: string) => JSON.parse(String(files.get(`${o}/${path}`))) as Record<string, any>;
  const surface = after('source/preparation/raster.json').surfaces.find((s: { id: string }) => s.id === 'temperature');
  // Everything the bake reads to draw the texture is the hand-made dataset's; only the consumer name and the words are the route's.
  for (const key of ['output', 'thumbnail', 'source', 'falseColor']) assert.deepEqual(surface[key], hand.surface[key], key);
  for (const key of ['kind', 'id', 'label', 'format', 'path', 'sampling', 'displaySampling', 'outputLongitudeOrigin', 'units', 'minimum', 'maximum', 'colors', 'labels', 'sourceUrl'])
    assert.deepEqual(surface.science[key], hand.surface.science[key], `science.${key}`);
  const control = after('source/content/object.json').datasets.controls.find((c: { id: string }) => c.id === 'temperature');
  assert.deepEqual(control.legend, hand.control.legend);
  assert.deepEqual([control.thumbnail, control.surface, control.poles, control.falseColor], [hand.control.thumbnail, hand.control.surface, hand.control.poles, hand.control.falseColor]);
  assert.deepEqual(after('object.json').properties.recipe.surfaces[0].datasets, hand.datasets);
  assert.equal(after('source/content/object.json').datasets.defaultDataset, 'temperature', 'the measured map takes the default from the one-color dataset');
  assert.equal((await installPhaseCurveDataset(files, id, 'HD 209458 b', { ...entry!, dataset: 'second' })).promoted, false, 'a default that is already a map stays');
  assert.equal(after('source/content/object.json').datasets.defaultDataset, 'temperature');
  assert.equal(after('source/preparation/raster.json').surfaces.length, 3, 'the dataset is replaced, not added twice; the second is the one added above');
  assert.match(control.notes, /The hottest longitude is 41° east of noon\. The false color runs from 850 to 1,600 K\./u);
  assert.throws(() => parsePhaseCurveEntries([{ id, dataset: 'map', label: 'x', path: 'phase.json', url: 'u', credit: 'c', observed: 'o', record }]), /science\/<paper>/u);
  assert.throws(() => parsePhaseCurveEntries([{ id, dataset: 'map', label: 'x', path: 'science/a/b.json', url: 'u', credit: 'c', observed: 'o', record: { ...record, model: { kind: 'starry' } } }]), /deposited spectra/u);
});
