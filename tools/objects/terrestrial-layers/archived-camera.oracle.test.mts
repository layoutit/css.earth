import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { decodeOsirisReflectance } from './archived-camera.mts';
import { acceptOsirisQuality } from './osiris-geo.mts';
import { readOracleFixture, assertPinnedInputs, sampleList, ORACLE_ROOT } from '../../oracles/fixture.mts';
import { requireRecord, requireString, requireFiniteNumber } from '../../sources/source-values.mts';

/** pvl and numpy as the oracle for the OSIRIS level-4 reflectance reader behind the archived-camera route (Steins). */
const fixture = await readOracleFixture('pds3/osiris-reflectance.json');
const [input] = fixture.inputs;
const source = resolve(ORACLE_ROOT, 'src/objects/steins/source');
const config = JSON.parse(await readFile(resolve(source, 'preparation/terrestrial.json'), 'utf8'));
const recipe = config.raster.surfaceObservations[0], frameRecipe = recipe.frames.find((frame: { path: string }) => input.path.endsWith(frame.path));
const camera = JSON.parse(await readFile(resolve(source, frameRecipe.cameraPath), 'utf8'));
const frame = decodeOsirisReflectance(await readFile(resolve(ORACLE_ROOT, input.path)), camera, recipe.allowLossy);
const planes = requireRecord(fixture.cases.planes);

test('the fixture is bound to the pinned Steins product and its label identity', async () => {
  await assertPinnedInputs(fixture.inputs);
  const identity = requireRecord(fixture.cases.identity);
  assert.equal(frame.startTime, requireString(identity.START_TIME));
  assert.equal(frame.filter, requireString(identity.FILTER_NAME));
  assert.equal(requireString(identity.INSTRUMENT_ID), 'OSIWAC');
  assert.equal(frame.width, requireFiniteNumber(requireRecord(planes.IMAGE).width));
});

test('reflectance values and quality decisions match the record-pointer reads', () => {
  let compared = 0;
  for (const { index, value } of sampleList(requireRecord(planes.IMAGE).samples)) { assert.equal(frame.planes.IMAGE[index], Math.fround(value), `I/F at ${index}`); compared++; }
  for (const { index, value } of sampleList(requireRecord(planes.QUALITY_MAP_IMAGE).samples)) {
    assert.equal(frame.acceptPixel(index) && Number.isFinite(frame.planes.IMAGE[index]), acceptOsirisQuality(value, recipe.allowLossy) && Number.isFinite(frame.planes.IMAGE[index]), `quality ${value} at ${index}`); compared++;
  }
  assert.ok(compared >= 90, `${compared} values compared`);
  const histogram = requireRecord(fixture.cases.qualityHistogram);
  assert.equal(Object.values(histogram).reduce<number>((sum, v) => sum + requireFiniteNumber(v), 0), frame.width * frame.height);
});
