import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { decodeOsirisGeo, decodeOsirisQuality, acceptOsirisQuality } from './osiris-geo.mts';
import { readOracleFixture, assertPinnedInputs, sampleList, ORACLE_ROOT } from '../../oracles/fixture.mts';
import { requireRecord, requireString, requireFiniteNumber } from '../../sources/source-values.mts';

/** pvl and numpy as the oracle for the OSIRIS level-5 geometry and level-4 quality readers (67P). */
const fixture = await readOracleFixture('pds3/osiris-geo.json');
const [geoInput, qualityInput] = fixture.inputs;
const geo = decodeOsirisGeo(await readFile(resolve(ORACLE_ROOT, geoInput.path)));
const quality = decodeOsirisQuality(await readFile(resolve(ORACLE_ROOT, qualityInput.path)), geo);
const planes = (group: string) => requireRecord(fixture.cases[group]);

test('the fixture is bound to the pinned OSIRIS products and their label identity', async () => {
  await assertPinnedInputs(fixture.inputs);
  const identity = requireRecord(fixture.cases.identity);
  assert.equal(geo.startTime, requireString(identity.START_TIME));
  assert.equal(geo.filter, requireString(identity.FILTER_NAME));
  assert.equal(requireString(identity.INSTRUMENT_ID), 'OSINAC');
});

test('every geometry plane matches the record-pointer reads exactly', () => {
  let compared = 0;
  for (const [name, raw] of Object.entries(planes('geometry'))) {
    const plane = requireRecord(raw);
    assert.equal(geo.width, requireFiniteNumber(plane.width)); assert.equal(geo.height, requireFiniteNumber(plane.height));
    for (const { index, value } of sampleList(plane.samples)) {
      const ours = geo.planes[name][index];
      assert.ok(Object.is(ours, name === 'FACET_INDEX_IMAGE' ? value : Math.fround(value)) || ours === value, `${name} at ${index}: ${ours} vs ${value}`); compared++;
    }
  }
  assert.ok(compared >= 400, `${compared} values compared`);
});

test('the quality companion planes and flag histogram match', () => {
  const qualityPlanes = planes('quality'), histogram = requireRecord(fixture.cases.qualityHistogram);
  for (const { index, value } of sampleList(requireRecord(qualityPlanes.IMAGE).samples)) assert.equal(geo.planes.IMAGE[index], Math.fround(value), `radiance at ${index}`);
  for (const { index, value } of sampleList(requireRecord(qualityPlanes.QUALITY_MAP_IMAGE).samples)) assert.equal(quality.flags[index], value, `flag at ${index}`);
  // The decoder's flag histogram over every pixel equals the oracle's, and so does its count of finite sigma values.
  const expected = Object.fromEntries(Object.entries(histogram).map(([flag, count]) => [flag, requireFiniteNumber(count)]));
  assert.deepEqual(Object.fromEntries(Object.entries(quality.report.histogram)), expected, 'quality flag histogram');
  assert.equal(Object.values(expected).reduce((sum, count) => sum + count, 0), geo.width * geo.height, 'histogram covers the plane');
  assert.equal(quality.report.finiteSigmaPixels, requireFiniteNumber(fixture.cases.finiteSigmaPixels), 'finite sigma count');
  assert.ok(Object.keys(expected).some(flag => acceptOsirisQuality(Number(flag), false)), 'the product holds accepted pixels');
});
