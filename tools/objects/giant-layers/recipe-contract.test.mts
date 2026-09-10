import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {parse} from '../material-composition/data-schema.mts';
import {layeredRecipe} from '../material-composition/layered-recipe.mts';
import {radialMotionRecipe} from '../material-composition/radial-motion-recipe.mts';
import {spectralRecipe} from '../material-composition/spectral-recipe.mts';
import {layeredPresentationRecipe as oblatePresentation} from '../material-composition/presentation-recipe.mts';
import {bandedGeometryRecipe} from './geometry-contract.mts';
import {photometricRecipe} from './photometric-contract.mts';
import {layeredPresentationRecipe} from './presentation-contract.mts';
import {normalizedPresentationRecipe} from './normalized-presentation-contract.mts';
import {parseRadialLayerRecipe} from './index.mts';
import {parseObservedSurfaceRecipe} from './observations.mts';
import {parseEllipsoidMaterialRecipe} from './materials.mts';
const read = async (body, file) => JSON.parse(await readFile(new URL(`../../../src/planets/${body}/source/preparation/${file}.json`, import.meta.url), 'utf8'));

test('all existing giant preparation recipes satisfy the operator-owned structural contracts', async () => {
  const fixtures = [
    ['saturn', 'geometry', layeredRecipe], ['saturn', 'radial-motion', radialMotionRecipe],
    ['saturn', 'surface', spectralRecipe], ['saturn', 'presentation', oblatePresentation],
    ['jupiter', 'materials', photometricRecipe], ['jupiter', 'presentation', normalizedPresentationRecipe],
    ...['jupiter', 'uranus', 'neptune'].map(body => [body, 'geometry', bandedGeometryRecipe]),
    ...['uranus', 'neptune'].map(body => [body, 'presentation', layeredPresentationRecipe]),
  ];
  for (const [body, file, guard] of fixtures) {
    const input = await read(body, file);
    assert.equal(parse(input, guard, `${body}/${file}`), input, 'validation preserves source metadata and record identity');
  }
  for (const body of ['saturn', 'jupiter', 'uranus', 'neptune']) parseRadialLayerRecipe(await read(body, 'rings'));
  for (const body of ['uranus', 'neptune']) {
    parseObservedSurfaceRecipe(await read(body, 'observations'));
    parseEllipsoidMaterialRecipe(await read(body, 'materials'));
  }
});

test('nested malformed scalar, buffer-channel and rotation facts cannot cross typed recipe boundaries', async () => {
  const radial = await read('saturn', 'rings');
  radial.layers[0].interior.baseAlpha = '0.25';
  assert.throws(() => parseRadialLayerRecipe(radial), /structure/);
  const observed = await read('neptune', 'observations');
  observed.lenses[0].decode.channels = 5;
  assert.throws(() => parseObservedSurfaceRecipe(observed), /structure/);
  const material = await read('uranus', 'materials');
  material.raster.view.rotations[0].axis = 'w';
  assert.throws(() => parseEllipsoidMaterialRecipe(material), /structure/);
});
