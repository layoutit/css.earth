import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {prepareControlledOrthographicMosaic} from '../../../../tools/objects/terrestrial-layers/controlled-orthographic-mosaic.mjs';

const sourceRoot = new URL('../../../../src/planets/triton/source/', import.meta.url).pathname;
test('Triton corrects pinned clear-filter frames while withholding unobserved and unstable geometry', async () => {
  const config = JSON.parse(await readFile(`${sourceRoot}/preparation/terrestrial.json`));
  const manifest = JSON.parse(await readFile(`${sourceRoot}/manifest.json`));
  const recipe = config.raster.mosaics[0], entries = manifest.inputs.filter(input => input.consumers.includes(recipe.consumer));
  const width = 360, height = 180;
  const {rgb, missing, grid} = await prepareControlledOrthographicMosaic(sourceRoot, entries, recipe, width, height);
  assert.equal(missing[10 * width + 15], 1, 'The unlit northern cap is not invented');
  assert.equal(missing[125 * width], 0, 'Retain measured terrain in the observed southern hemisphere');
  assert.ok(rgb[(125 * width) * 3] > 50, 'Source-aware correction should retain visible observed signal');
  assert.equal(grid.frames.length, recipe.imageIds.length);
  assert.ok(grid.frames.every(frame => frame.level >= recipe.photometry.minimumLevel && frame.level <= recipe.photometry.maximumLevel));
  assert.ok(missing.some(value => value === 0) && missing.some(value => value === 1));
});
