import { setupBakeOracleInputs } from '../../../cameras/oracle-inputs.mts';
await setupBakeOracleInputs();
import assert from 'node:assert/strict';
import { sourceLoad, sourceTest, sourceValues } from '@cssearth/objects/node/source-test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { decodeOsirisReflectance, acceptOsirisQuality } from '@cssearth/bake/objects/layers/terrestrial';
import { readOracleFixture, assertPinnedInputs, sampleList, ORACLE_ROOT } from '@cssearth/core/oracle';
import { requireRecord, requireString, requireFiniteNumber } from '@cssearth/core';

/** pvl and numpy as the oracle for the OSIRIS level-4 reflectance reader behind the archived-camera route (Steins). */
const loaded = await sourceLoad(async () => {
  const fixture = await readOracleFixture(new URL('osiris-reflectance.json', import.meta.url).pathname);
  const [input] = fixture.inputs;
  const source = resolve(ORACLE_ROOT, 'src/objects/steins/source');
  const config = JSON.parse(await readFile(resolve(source, 'preparation/terrestrial.json'), 'utf8'));
  const recipe = config.raster.surfaceObservations[0], frameRecipe = recipe.frames.find((frame: { path: string }) => input.path.endsWith(frame.path));
  const camera = JSON.parse(await readFile(resolve(source, frameRecipe.cameraPath), 'utf8'));
  const frame = decodeOsirisReflectance(await readFile(resolve(ORACLE_ROOT, input.path)), camera, recipe.allowLossy);
  const planes = requireRecord(fixture.cases.planes);
  return { fixture, input, source, config, recipe, frameRecipe, camera, frame, planes };
});
const test = sourceTest(null, loaded);
test('the fixture is bound to the pinned Steins product and its label identity', async () => {
  const { fixture, input, source, config, recipe, frameRecipe, camera, frame, planes } = sourceValues(loaded);
  await assertPinnedInputs(fixture.inputs);
  const identity = requireRecord(fixture.cases.identity);
  assert.equal(frame.startTime, requireString(identity.START_TIME));
  assert.equal(frame.filter, requireString(identity.FILTER_NAME));
  assert.equal(requireString(identity.INSTRUMENT_ID), 'OSIWAC');
  assert.equal(frame.width, requireFiniteNumber(requireRecord(planes.IMAGE).width));
});

test('reflectance values and quality decisions match the record-pointer reads', () => {
  const { fixture, input, source, config, recipe, frameRecipe, camera, frame, planes } = sourceValues(loaded);
  let compared = 0;
  for (const { index, value } of sampleList(requireRecord(planes.IMAGE).samples)) { assert.equal(frame.planes.IMAGE[index], Math.fround(value), `I/F at ${index}`); compared++; }
  for (const { index, value } of sampleList(requireRecord(planes.QUALITY_MAP_IMAGE).samples)) {
    assert.equal(frame.acceptPixel(index) && Number.isFinite(frame.planes.IMAGE[index]), acceptOsirisQuality(value, recipe.allowLossy) && Number.isFinite(frame.planes.IMAGE[index]), `quality ${value} at ${index}`); compared++;
  }
  assert.ok(compared >= 90, `${compared} values compared`);
  const histogram = requireRecord(fixture.cases.qualityHistogram);
  assert.equal(Object.values(histogram).reduce<number>((sum, v) => sum + requireFiniteNumber(v), 0), frame.width * frame.height);
});
