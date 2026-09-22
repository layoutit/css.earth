import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { observationSourceFile, readObservationRecipe } from './recipe';

const input = () => JSON.parse(readFileSync('labs/nebula/models/m45/observations.json', 'utf8'));

test('wide-source registration retains explicit native discovery settings without changing other sources', () => {
  const recipe = readObservationRecipe(input());
  assert.deepEqual(recipe.images.find(image => image.id === 'niittee-widefield')!.registrationDetection,
    { sourceMaximum: 8000, referenceMaximum: 4000, maximumStars: 20000 });
  assert.equal(recipe.images.find(image => image.id === 'noirlab-optical')!.registrationDetection, undefined);
});

test('registration detector settings reject unbounded, noninteger and incompatible discovery', () => {
  for (const [key, value] of [['sourceMaximum', 16385], ['referenceMaximum', 0], ['maximumStars', 20001], ['sourceMaximum', 2.5], ['maximumStars', '20000']] as const) {
    const raw = input(), image = raw.images.find((row: { id: string }) => row.id === 'niittee-widefield');
    image.registrationDetection[key] = value;
    assert.throws(() => readObservationRecipe(raw), /finite coordinate|bounded range/);
  }
  const raw = input(), image = raw.images.find((row: { id: string }) => row.id === 'niittee-widefield');
  image.registrationMode = 'publisher-wcs';
  assert.throws(() => readObservationRecipe(raw), /direct field-star discovery/);
});

test('composed sky band sources cache under their own name; publisher sources keep their downloaded name', () => {
  assert.equal(observationSourceFile({ id: 'spitzer-mid-infrared' }), 'spitzer-mid-infrared.tif');
  assert.equal(observationSourceFile({ id: 'spitzer-mid-infrared', skyBands: { path: 'src/objects/m8/source/sky-bands/spitzer-irac.json' } }),
    'spitzer-mid-infrared.skybands.png');
});
