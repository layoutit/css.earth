/** A published phase-curve fit as a heat-map lens beside a planet's default lens (phase-curve-lens.mts), offline. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sourceTest } from '../../../../tests/objects/source-test.mts';
import { installPhaseCurveLens, parsePhaseCurveEntries } from './phase-curve-lens.mts';

const test = sourceTest();

test('the phase-curve route rebuilds HD 209458 b\'s hand-made Zellem heat map: the same record, range, palette and lens, beside the default', async () => {
  const id = 'hd-209458b', o = `src/objects/${id}`, root = new URL('../../../../', import.meta.url);
  const paths = ['object.json', 'text.json', 'source/preparation/raster.json', 'source/content/object.json', 'source/manifest.json'];
  const files = new Map<string, string | Buffer>(await Promise.all(paths.map(async path => [`${o}/${path}`, await readFile(new URL(`${o}/${path}`, root), 'utf8')] as const)));
  const before = (path: string) => JSON.parse(String(files.get(`${o}/${path}`))) as Record<string, any>;
  const hand = { surface: before('source/preparation/raster.json').surfaces.find((surface: { id: string }) => surface.id === 'temperature'),
    control: before('source/content/object.json').lenses.controls.find((control: { id: string }) => control.id === 'temperature'), lenses: before('object.json').properties.recipe.surfaces[0].lenses };
  const record = JSON.parse(await readFile(new URL(`${o}/source/science/zellem-2014/phase-curve.json`, root), 'utf8'));
  const [entry] = parsePhaseCurveEntries([{ id, lens: 'temperature', label: 'Spitzer', path: 'science/zellem-2014/phase-curve.json', url: 'https://arxiv.org/abs/1405.5923',
    credit: 'Zellem et al. (2014)', observed: 'a Spitzer phase curve of January 2010', record }]).get(id)!;
  const { minimum, maximum, hottest } = await installPhaseCurveLens(files, id, 'HD 209458 b', entry!);
  assert.deepEqual([minimum, maximum, hottest], [850, 1600, 41], 'the range the hand-made lens drew, and its hottest longitude');
  const after = (path: string) => JSON.parse(String(files.get(`${o}/${path}`))) as Record<string, any>;
  const surface = after('source/preparation/raster.json').surfaces.find((s: { id: string }) => s.id === 'temperature');
  // Everything the bake reads to draw the texture is the hand-made lens's; only the consumer name and the words are the route's.
  for (const key of ['output', 'thumbnail', 'source', 'falseColor']) assert.deepEqual(surface[key], hand.surface[key], key);
  for (const key of ['kind', 'id', 'label', 'format', 'path', 'sampling', 'displaySampling', 'outputLongitudeOrigin', 'units', 'minimum', 'maximum', 'colors', 'labels', 'sourceUrl'])
    assert.deepEqual(surface.science[key], hand.surface.science[key], `science.${key}`);
  const control = after('source/content/object.json').lenses.controls.find((c: { id: string }) => c.id === 'temperature');
  assert.deepEqual(control.legend, hand.control.legend);
  assert.deepEqual([control.thumbnail, control.surface, control.poles, control.falseColor], [hand.control.thumbnail, hand.control.surface, hand.control.poles, hand.control.falseColor]);
  assert.deepEqual(after('object.json').properties.recipe.surfaces[0].lenses, hand.lenses);
  assert.equal(after('source/content/object.json').lenses.defaultLens, 'thermal', 'the colour lens stays the default');
  assert.equal(after('source/preparation/raster.json').surfaces.length, 2, 'the lens is replaced, not added twice');
  assert.match(control.notes, /The hottest longitude is 41° east of noon\. The false colour runs from 850 to 1,600 K\./u);
  assert.throws(() => parsePhaseCurveEntries([{ id, lens: 'map', label: 'x', path: 'phase.json', url: 'u', credit: 'c', observed: 'o', record }]), /science\/<paper>/u);
  assert.throws(() => parsePhaseCurveEntries([{ id, lens: 'map', label: 'x', path: 'science/a/b.json', url: 'u', credit: 'c', observed: 'o', record: { ...record, model: { kind: 'starry' } } }]), /deposited spectra/u);
});
