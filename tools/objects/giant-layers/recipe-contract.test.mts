import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import {type Guard, parse} from '../material-composition/data-schema.mts';
import {layeredRecipe} from '../material-composition/layered-recipe.mts';
import {radialMotionRecipe} from '../material-composition/radial-motion-recipe.mts';
import {spectralRecipe} from '../material-composition/spectral-recipe.mts';
import {layeredPresentationRecipe as oblatePresentation} from '../material-composition/presentation-recipe.mts';
import {bandedGeometryRecipe} from './geometry-contract.mts';
import {photometricRecipe} from './photometric-contract.mts';
import {normalizedPresentationRecipe} from './normalized-presentation-contract.mts';
import {parseRadialLayerRecipe} from './index.mts';
import {parseObservedSurfaceRecipe} from '../observed-surfaces/index.mts';
const read = async (body: string, file: string): Promise<unknown> => JSON.parse(await readFile(new URL(`../../../src/objects/${body}/source/preparation/${file}.json`, import.meta.url), 'utf8'));

test('all existing giant preparation recipes satisfy the operator-owned structural contracts', async () => {
  const fixtures: [string, string, Guard<unknown>][] = [
    ['saturn', 'geometry', layeredRecipe], ['saturn', 'radial-motion', radialMotionRecipe],
    ['saturn', 'surface', spectralRecipe], ['saturn', 'presentation', oblatePresentation],
    ['jupiter', 'materials', photometricRecipe], ['jupiter', 'presentation', normalizedPresentationRecipe],
    ['jupiter', 'geometry', bandedGeometryRecipe],
  ];
  for (const [body, file, guard] of fixtures) {
    const input = await read(body, file);
    assert.equal(parse(input, guard, `${body}/${file}`), input, 'validation preserves source metadata and record identity');
  }
  for (const body of ['saturn', 'jupiter', 'uranus', 'neptune']) parseRadialLayerRecipe(await read(body, 'rings'));
  // Uranus and Neptune left the giant lane for the shared sphere lane; their observed surfaces and rings still come from here.
  for (const body of ['uranus', 'neptune']) parseObservedSurfaceRecipe(await read(body, 'observations'));
});

test('nested malformed scalar, buffer-channel and rotation facts cannot cross typed recipe boundaries', async () => {
  const radial = parseRadialLayerRecipe(await read('saturn', 'rings'));
  assert.ok('interior' in radial.layers[0]);
  Object.assign(radial.layers[0].interior, {baseAlpha: '0.25'});
  assert.throws(() => parseRadialLayerRecipe(radial), /structure/);
  const observed = parseObservedSurfaceRecipe(await read('neptune', 'observations'));
  Object.assign(observed.lenses[0].decode, {channels: 5});
  assert.throws(() => parseObservedSurfaceRecipe(observed), /structure/);
});
