import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { parseCieTable } from './disc-integrated-color.mts';
import { loadStellarPhotometricColor, parseStellarColorRecord, planckColor, readStellarTemperature } from './stellar-photometric-color.mts';

const root = new URL('../../../src/objects/wasp-43/source/', import.meta.url);
const read = async (path: string) => readFile(new URL(path, root));
const colorMatching = parseCieTable((await read('reference/CIE_xyz_1931_2deg.csv')).toString('utf8'), 3);
const record = JSON.parse((await read('photometry/stellar-color.json')).toString('utf8'));

test('a Planck spectrum warms from blue-white through white to orange as it cools', () => {
  const hot = planckColor(10000, colorMatching), d65 = planckColor(6504, colorMatching), cool = planckColor(3500, colorMatching);
  assert.ok(hot.linear[2] === 1 && hot.linear[0] < 1, 'a 10,000 K star peaks in blue');
  assert.ok(d65.linear.every(channel => channel > .9), 'near the sRGB white point every channel is close to the peak');
  assert.ok(cool.linear[0] === 1 && cool.linear[1] > cool.linear[2], 'a 3,500 K star is orange');
});

test("WASP-43's Gaia DR3 photometric temperature gives a pale warm sRGB colour, stable across its percentiles", async () => {
  const { temperature, color, range } = await loadStellarPhotometricColor(read, { colorMatching: 'reference/CIE_xyz_1931_2deg.csv' }, 'photometry/stellar-color.json');
  assert.deepEqual(temperature, { kelvin: 4416.3687, lowerKelvin: 4406.5312, upperKelvin: 4424.338 });
  assert.deepEqual(color.srgb, [255, 220, 184]);
  for (const bound of range) for (let channel = 0; channel < 3; channel++) assert.ok(Math.abs(bound.srgb[channel]! - color.srgb[channel]!) <= 1);
});

test('records and catalogue rows fail closed', () => {
  assert.throws(() => parseStellarColorRecord({ ...record, schema: 'other' }), /cssearth-stellar-photometric-color@1/u);
  assert.throws(() => parseStellarColorRecord({ ...record, spectrum: 'model' }), /Planck/u);
  const parsed = parseStellarColorRecord(record);
  assert.throws(() => readStellarTemperature('source_id,teff_gspphot\n1,4400\n', parsed), /exactly one row/u);
  assert.throws(() => readStellarTemperature(`source_id,teff_gspphot,teff_gspphot_lower,teff_gspphot_upper\n${parsed.sourceId},4400,4500,4600\n`, parsed), /inside its bounds/u);
});
