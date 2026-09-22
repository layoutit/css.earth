import assert from 'node:assert/strict';
import { sourceLoad, sourceTest } from '../../../tests/objects/source-test.mts';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { decodeAmicaGeo } from './amica-geo.mts';
import { readOracleFixture, assertPinnedInputs, sampleList, ORACLE_ROOT } from '../../oracles/fixture.mts';
import { requireRecord, requireArray, requireString, requireFiniteNumber } from '../../sources/source-values.mts';

/** pvl, numpy and astropy as the oracle for the AMICA Gaskell DDR reader (Itokawa). */
const loaded = await sourceLoad(async () => {
  const fixture = await readOracleFixture('pds3/amica-ddr.json');
  const [cube, label, original, flat] = fixture.inputs.map(input => resolve(ORACLE_ROOT, input.path));
  const frame = decodeAmicaGeo(await readFile(cube), await readFile(label, 'ascii'), await readFile(original), await readFile(flat));
  const planes = requireRecord(fixture.cases.planes), exposure = requireFiniteNumber(fixture.cases.exposure);
  return { fixture, cube, label, original, flat, frame, planes, exposure };
});
const test = sourceTest(null, loaded);
const { fixture, cube, label, original, flat, frame, planes, exposure } = loaded.values;
test('the fixture is bound to the pinned AMICA products and their label identity', async () => {
  await assertPinnedInputs(fixture.inputs);
  const identity = requireRecord(fixture.cases.identity);
  assert.equal(frame.startTime, requireString(identity.START_TIME));
  assert.equal(frame.qualityReport.exposureSeconds, exposure);
  assert.equal(requireFiniteNumber(requireRecord(fixture.cases.cube).bands), 16);
});

test('geometry planes match the big-endian cube exactly, angles after the degree-to-radian conversion, nulls as invalid', () => {
  let compared = 0;
  for (const [name, raw] of Object.entries(planes)) {
    if (name === 'IMAGE') continue;
    const plane = requireRecord(raw), angular = name.includes('ANGLE');
    for (const { index, value } of sampleList(plane.samples)) {
      const ours = frame.planes[name][index];
      if (angular) assert.ok(Math.abs(ours * 180 / Math.PI - value) < 1e-4, `${name} at ${index}: ${ours * 180 / Math.PI} vs ${value}`);
      else assert.equal(ours, Math.fround(value), `${name} at ${index}`);
      compared++;
    }
  }
  assert.ok(compared >= 300, `${compared} values compared`);
});

test('the image is the detector DN over the flat over the exposure, with the DDR\'s vertical reversal', () => {
  let compared = 0;
  for (const raw of requireArray(fixture.cases.imagePairs)) {
    const pair = requireRecord(raw), index = requireFiniteNumber(pair.index), ddr = requireFiniteNumber(pair.ddr), dn = requireFiniteNumber(pair.dn);
    assert.equal(ddr, dn, `DDR band 1 equals the reversed FITS DN at ${index}`);
    if (pair.radiance === null) { assert.equal(frame.acceptPixel(index), false, `rejected at ${index}`); continue; }
    assert.ok(frame.acceptPixel(index), `accepted at ${index}`);
    assert.ok(Math.abs(frame.planes.IMAGE[index] - requireFiniteNumber(pair.radiance)) < 1e-6 * Math.max(1, Math.abs(requireFiniteNumber(pair.radiance))), `radiance at ${index}`); compared++;
  }
  assert.ok(compared >= 40, `${compared} pairs compared`);
});
