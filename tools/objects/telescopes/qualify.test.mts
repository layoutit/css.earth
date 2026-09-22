import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { card, imageFixture } from '../../../tests/fixtures/fits/helpers.mts';
import { fitsObservationInterval, recordQualification, QUALIFICATION_SCHEMA } from './qualify.mts';
import { loadQualifiedObservations } from './qualified-observations.mts';
import { assessRequest } from './request-satisfaction.mts';
import { productRecordPath, writeProductRecord } from '../product-record.mts';

const dates = { 'DATE-BEG': '2022-08-30T07:49:58.558', 'DATE-END': '2022-08-30T08:03:50.173' };
const expected = { startIso: '2022-08-30T07:49:58.558Z', endIso: '2022-08-30T08:03:50.173Z' };

test('FITS UTC dates are independent of the host timezone, with or without TIMESYS', () => {
  const previous = process.env.TZ;
  try {
    for (const zone of ['America/Argentina/Buenos_Aires', 'Asia/Tokyo', 'UTC']) {
      process.env.TZ = zone;
      assert.deepEqual(fitsObservationInterval({ ...dates, TIMESYS: 'UTC' }), expected);
      assert.deepEqual(fitsObservationInterval(dates), expected);
    }
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});

test('FITS split dates include TIME-OBS and preserve explicit ISO offsets', () => {
  assert.deepEqual(fitsObservationInterval({ 'DATE-OBS': '2022-08-30', 'TIME-OBS': '07:49:58.558',
    'DATE-END': '2022-08-30', 'TIME-END': '08:03:50.173' }), expected);
  assert.deepEqual(fitsObservationInterval({ 'DATE-BEG': expected.startIso, 'DATE-END': expected.endIso }), expected);
  assert.deepEqual(fitsObservationInterval({ 'DATE-BEG': '2022-08-30T04:49:58.558-03:00',
    'DATE-END': '2022-08-30T05:03:50.173-03:00' }), expected);
});

test('unsupported scales and incomplete or invalid intervals remain unknown', () => {
  for (const TIMESYS of ['TAI', 'TT', 'TDB', 'unknown']) assert.deepEqual(fitsObservationInterval({ ...dates, TIMESYS }), {});
  for (const start of ['invalid', '2022-08-30', '2022-02-30T07:49:58', '2022-08-30T09:00:00', '2022-08-30T07:49:60'])
    assert.deepEqual(fitsObservationInterval({ ...dates, 'DATE-BEG': start }), {});
  assert.deepEqual(fitsObservationInterval({ 'DATE-BEG': dates['DATE-BEG'] }), {});
  assert.deepEqual(fitsObservationInterval({ 'DATE-BEG': '1971-08-30T07:00:00', 'DATE-END': '1971-08-30T08:00:00' }), {});
});

test('qualification readback answers time-bounded requests using the FITS UTC interval', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'qualification-utc-')), previous = process.env.TZ;
  try {
    process.env.TZ = 'America/Argentina/Buenos_Aires';
    const product = resolve(root, 'image.fits'), receipt = resolve(root, 'comparison.json');
    await writeFile(product, imageFixture(16, [1, 2, 3, 4], Object.entries({ ...dates, TIMESYS: 'UTC' }).map(([key, value]) => card(key, `'${value}'`))));
    await writeFile(receipt, '{}');
    await writeProductRecord(productRecordPath(product), { telescope: 'Spitzer', stage: 'fixture', inputs: [], software: [], parameters: {} }, [{ path: 'image.fits', file: product }]);
    await recordQualification(root, { schema: QUALIFICATION_SCHEMA, target: 'test', telescope: 'Spitzer', mode: 'IRAC Map', observation: 'obs', program: 'test-obs',
      configuration: { kind: 'spitzer-irac-channel', channel: 1 }, product, receipt });
    const [loaded] = await loadQualifiedObservations(root, 'test');
    assert.ok(loaded);
    assert.equal(loaded.facts.startIso, expected.startIso);
    assert.equal(loaded.facts.endIso, expected.endIso);
    const request = { target: 'test', wavelengthMicrometres: [3.2, 3.8] as const };
    assert.equal(assessRequest({ ...request, time: { fromIso: '2022-08-30T07:00:00Z', toIso: '2022-08-30T09:00:00Z' } }, loaded.facts).constraints.time!.answer, 'yes');
    assert.equal(assessRequest({ ...request, time: { fromIso: '2022-08-30T10:00:00Z', toIso: '2022-08-30T12:00:00Z' } }, loaded.facts).constraints.time!.answer, 'no');
  } finally {
    if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous;
    await rm(root, { recursive: true, force: true });
  }
});
