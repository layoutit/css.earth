import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
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
  assert.ok(parsed.spectrum === 'planck');
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
  const { recipe: table } = limbDarkening;
  assert.ok(table.source === 'table');
  assert.throws(() => readQuadraticLimbDarkening('Name\tu1-j\nOTHER\t0.5\n', table), /exactly one row/u);
});

test('a Gaia XP sampled spectrum gives the colour of the star\'s own light: HD 189733 A pale orange-white, B, a red dwarf, orange', async () => {
  const { readXpSampledSpectrum, xpSampledColor, XP_SAMPLED_WAVELENGTHS_NM } = await import('./stellar-photometric-color.mts');
  assert.deepEqual([XP_SAMPLED_WAVELENGTHS_NM[0], XP_SAMPLED_WAVELENGTHS_NM.at(-1), XP_SAMPLED_WAVELENGTHS_NM.length], [336, 1020, 343]);
  for (const [id, sourceId, srgb] of [['hd-189733', '1827242816201846144', [255, 226, 207]], ['hd-189733-companion', '1827242816176111360', [255, 201, 123]]] as const) {
    const system = new URL(`../../../src/objects/${id}/source/`, import.meta.url);
    const load = async () => loadStellarPhotometricColor(async path => readFile(new URL(path, system)), { colorMatching: 'reference/CIE_xyz_1931_2deg.csv' }, 'photometry/stellar-color.json');
    const { color, range, temperature } = await load();
    assert.equal(temperature, null);
    assert.deepEqual(color.srgb, srgb, id);
    for (const bound of range!) for (let channel = 0; channel < 3; channel++) assert.ok(Math.abs(bound.srgb[channel]! - color.srgb[channel]!) <= 3, `${id} bound`);
    const csv = (await readFile(new URL('photometry/gaia-dr3-xp-sampled.csv', system))).toString('utf8');
    assert.throws(() => readXpSampledSpectrum(csv, '1'), /exactly one row/u);
    // A flat spectrum in energy is slightly pink in sRGB, since the D65 white is not flat; a hotter slope is bluer.
    const flat = xpSampledColor(new Array(343).fill(1), colorMatching), blue = xpSampledColor(XP_SAMPLED_WAVELENGTHS_NM.map(w => (500 / w) ** 4), colorMatching);
    assert.ok(blue.linear[2]! / blue.linear[0]! > flat.linear[2]! / flat.linear[0]!);
  }
});

test('a cool dwarf too faint to measure in blue: TRAPPIST-1 keeps its own spectrum, with samples consistent with zero read as no emission', async () => {
  const { readXpSampledSpectrum, xpSampledColor, NOISE_FLOOR_SIGMA } = await import('./stellar-photometric-color.mts');
  const system = new URL('../../../src/objects/trappist-1/source/', import.meta.url);
  const { color, range, temperature, spectrum } = await loadStellarPhotometricColor(
    async path => readFile(new URL(path, system)), { colorMatching: 'reference/CIE_xyz_1931_2deg.csv' }, 'photometry/stellar-color.json');
  assert.equal(temperature, null);
  assert.equal(spectrum?.samples, 343);
  assert.deepEqual(color.srgb, [255, 205, 106]);
  // The blue end is noise, so the one-sigma range is wide there and narrow in red.
  assert.equal(range![0].srgb[0], 255);
  assert.ok(range![1].srgb[2]! - range![0].srgb[2]! > 50, 'the blue channel is poorly constrained');
  const flux = readXpSampledSpectrum((await readFile(new URL('photometry/gaia-dr3-xp-sampled.csv', system))).toString('utf8'), '2635476908753563008');
  const visible = (wavelength: number) => (wavelength - 336) / 2;
  // Sixteen visible samples are at or below zero; none is below zero by more than the floor allows.
  const nonPositive = flux.flux.filter((value, index) => value <= 0 && index >= visible(380) && index <= visible(780));
  assert.equal(nonPositive.length, 16);
  assert.ok(flux.flux.every((value, index) => value > 0 || Math.abs(value) <= NOISE_FLOOR_SIGMA * flux.fluxError[index]!));
  // A sample below zero by more than the floor is a spectrum no colour is taken from.
  const broken = [...flux.flux]; broken[visible(500)] = -1e6 * flux.fluxError[visible(500)]!;
  assert.throws(() => xpSampledColor(broken, colorMatching, flux.fluxError), /consistent with zero/u);
});

test('TRAPPIST-1 bakes its cited I+z model-prior limb law without off-disc light', async () => {
  const system = new URL('../../../src/objects/trappist-1/source/', import.meta.url);
  const source = async (path: string) => readFile(new URL(path, system));
  const science = JSON.parse((await source('preparation/raster.json')).toString('utf8')).surfaces[0].science;
  const { limbDarkening, color } = await loadStellarPhotometricColor(source, science, 'photometry/stellar-color.json');
  assert.ok(limbDarkening);
  assert.equal(limbDarkening.recipe.source, 'published');
  assert.equal(limbDarkening.coefficients.u1, 0.65);
  assert.equal(limbDarkening.coefficients.u2, 0.28);
  assert.ok('basis' in limbDarkening.coefficients && limbDarkening.coefficients.basis === 'model-prior');
  assert.ok(Math.abs(limbDarkening.coefficients.u1Bounds[0] - 0.55) < 1e-12);
  assert.ok(Math.abs(limbDarkening.coefficients.u2Bounds[0] - 0.16) < 1e-12);
  assert.ok(Math.abs(quadraticIntensity(0, 0.65, 0.28) - 0.07) < 1e-12);
  const plate = limbDarkeningPlate(256, limbDarkening.coefficients, color);
  assert.equal(plate.data[3], 0);
  assert.equal(plate.data[(128 * 256 + 128) * 4 + 3], 0);
  assert.ok(plate.data[(128 * 256 + 254) * 4 + 3]! > 100);
});
