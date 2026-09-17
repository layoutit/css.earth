import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { parseCieTable } from './disc-integrated-color.mts';
import { limbDarkeningPlate, loadStellarPhotometricColor, parseStellarColorRecord, planckColor, quadraticIntensity, readQuadraticLimbDarkening, readStellarTemperature } from './stellar-photometric-color.mts';
import { linearToSrgb } from '../color-transfer.mts';

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

test("WASP-43's TESS limb darkening is read from its pinned catalogue row and darkens the limb plate by the quadratic law", async () => {
  const science = JSON.parse((await read('preparation/raster.json')).toString('utf8')).surfaces[0].science;
  const { limbDarkening, color } = await loadStellarPhotometricColor(read, science, 'photometry/stellar-color.json');
  assert.ok(limbDarkening);
  // Patel & Espinoza (2022), table 4: u1 0.55 (+0.22 -0.31), u2 0.00 (+0.46 -0.30).
  assert.deepEqual(limbDarkening.coefficients, { u1: 0.55, u2: 0, u1Bounds: [0.55 - 0.31, 0.55 + 0.22], u2Bounds: [-0.30, 0.46] });
  const size = 256, plate = limbDarkeningPlate(size, limbDarkening.coefficients, color);
  const alphaAt = (radial: number) => plate.data[((size / 2) * size + Math.floor(size / 2 + radial * size / 2)) * 4 + 3]! / 255;
  assert.ok(alphaAt(0) <= 1 / 255, 'the centre is not dimmed');
  assert.equal(plate.data[3], 0, 'outside the disc the plate is transparent');
  assert.ok(plate.data.every((value, i) => i % 4 === 3 || value === 0), 'the plate is black');
  // Displayed luminance under the plate matches the colour dimmed by I(mu) in linear light, at several radii.
  for (const radial of [0.5, 0.8, 0.95]) {
    const texel = (Math.floor(size / 2 + radial * size / 2) + 0.5 - size / 2) / (size / 2), ratio = quadraticIntensity(Math.sqrt(1 - texel ** 2), 0.55, 0);
    const luminance = (linear: readonly number[]) => linear.reduce((sum, value, c) => sum + [0.2126, 0.7152, 0.0722][c]! * linearToSrgb(value), 0);
    const expected = 1 - luminance(color.linear.map(value => value * ratio)) / luminance(color.linear);
    assert.ok(Math.abs(alphaAt(radial) - expected) <= 1 / 255, `alpha at ${radial}: ${alphaAt(radial)} vs ${expected}`);
  }
  assert.ok(alphaAt(0.95) > alphaAt(0.8) && alphaAt(0.8) > alphaAt(0.5), 'darker toward the limb');
  assert.throws(() => readQuadraticLimbDarkening('Name\tu1-j\nOTHER\t0.5\n', limbDarkening.recipe), /exactly one row/u);
});
