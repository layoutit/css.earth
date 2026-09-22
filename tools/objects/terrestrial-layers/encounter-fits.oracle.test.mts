import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { decodeEncounterFits } from './encounter-fits.mts';
import { readOracleFixture, assertPinnedInputs, readOracleInput, sampleList, ORACLE_ROOT } from '../../oracles/fixture.mts';
import { requireRecord, requireArray, requireString, requireFiniteNumber } from '../../sources/source-values.mts';

/** astropy as the oracle for the encounter FITS reader, one product per instrument layout: Deep Impact ITS, Stardust NAVCAM and MRI. */
const fixture = await readOracleFixture('fits/encounter.json');
const products = requireRecord(fixture.cases.products);

test('the fixture is bound to one pinned product per encounter instrument', async () => {
  await assertPinnedInputs(fixture.inputs);
  assert.deepEqual(Object.keys(products).sort(), ['comet-103p', 'comet-81p', 'comet-9p']);
  assert.deepEqual(Object.values(products).map(product => requireString(requireRecord(requireRecord(product).identity).instrument)).sort(), ['ITSVIS', 'MRIVIS', 'NAVCAM']);
});

for (const [body, raw] of Object.entries(products)) test(`${body}: planes, header identity and every per-pixel decision match astropy`, async () => {
  const product = requireRecord(raw), source = resolve(ORACLE_ROOT, 'src/objects', body, 'source');
  const frame = JSON.parse(await readFile(resolve(source, 'preparation/terrestrial.json'), 'utf8')).raster.surfaceObservations[0].frames[0];
  const control = JSON.parse(await readFile(resolve(source, frame.controlPath), 'utf8'));
  assert.equal(`src/objects/${body}/source/${frame.path}`, requireString(product.path));
  assert.equal(control.observation.detectorBorderPixels, requireFiniteNumber(product.detectorBorderPixels));
  const input = fixture.inputs.find(input => input.path === product.path); assert.ok(input);
  const decoded = decodeEncounterFits(await readOracleInput(input), control.observation);
  const identity = requireRecord(product.identity);
  assert.equal(decoded.header.INSTRUME, requireString(identity.instrument));
  assert.equal(decoded.units, requireString(identity.units));
  assert.equal(decoded.startTime, requireString(identity.date));
  assert.equal(decoded.filter, requireString(identity.filter));
  assert.equal(decoded.header.OBJECT, requireString(identity.target));
  assert.deepEqual(Object.keys(decoded.planes), requireArray(product.hdus).map(hdu => requireString(requireRecord(hdu).name)), 'HDU order and names');
  for (const { index, value } of sampleList(product.primary)) assert.equal(decoded.values[index], Math.fround(value), `radiance at ${index}`);
  for (const { index, value } of sampleList(product.quality)) assert.equal(decoded.quality[index], value, `quality at ${index}`);
  const counts: Record<string, number> = { 'detector-overclock': 0, 'detector-quality': 0, 'nonfinite-radiance': 0, accepted: 0 };
  for (let i = 0; i < decoded.width * decoded.height; i++) counts[decoded.reason(i) ?? 'accepted']++;
  const expected = requireRecord(product.reasons);
  assert.deepEqual(counts, Object.fromEntries(Object.keys(counts).map(key => [key, requireFiniteNumber(expected[key])])), 'accept and reject counts');
});
