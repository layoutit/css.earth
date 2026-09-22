import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as h5 from 'h5wasm/node';
import { prepareAkatsukiUviMap, parseAkatsukiUviProfile, UVI_L3B_GRID } from './uvi-l3b.mts';

const { width: W, height: H, cellDegrees } = UVI_L3B_GRID;
const RADIANS = Math.PI / 180;
/** Rows 720 and above carry the northern radiance; the halves make the south-to-north flip visible. */
const NORTH_RADIANCE = 1.6e8, SOUTH_RADIANCE = 4e7;
const SUB_SOLAR = { longitude: 90, latitude: 0 };

const profile = {
  productId: 'uvi_20230830_100446_365_l3b_v21', filter: '365 nm',
  observationMiddle: '2023-08-30T10:04:46.033', converterId: '7b81c2b8b5a5',
  gain: 5e-9, gamma: 2.2, referenceRadiusMeters: 6051800, outputLongitudeOrigin: 180,
};

/**
 * One synthetic L3b exposure in the archive's own layout: longitude 0 to 360 east, row 0 at the
 * south pole, radiance only on the hemisphere the Sun lights. `headerSubSolar` may disagree with
 * the grid so the reader's orientation guard can be exercised.
 */
function writeExposure(path: string, { headerSubSolar = SUB_SOLAR } = {}) {
  const file = new h5.File(path, 'w');
  const text = (name: string, value: string) => file.create_dataset({ name, data: value });
  const real = (name: string, value: number) => file.create_dataset({ name, data: new Float32Array([value]), shape: [1], dtype: '<f4' });
  for (const [name, value] of [['title', 'Akatsuki Level 3'], ['institute', 'ISAS/JAXA'], ['Conventions', 'CF-1.7'], ['hgid', profile.converterId]] as const)
    file.create_attribute(name, value);
  for (const [name, value] of [['OBJECT', 'VENUS'], ['SPCECRFT', 'VCO'], ['INSTRUME', 'Ultra Violet Imager'], ['FILTER', profile.filter],
    ['DATE_BEG', '2023-08-30T10:04:45.198'], ['DATE_OBS', profile.observationMiddle], ['DATE_END', '2023-08-30T10:04:46.869']] as const) text(name, value);

  const written = (name: string): h5.Dataset => {
    const value = file.get(name);
    if (!(value instanceof h5.Dataset)) throw new TypeError(`fixture did not write ${name}`);
    return value;
  };
  const longitude = Float32Array.from({ length: W }, (_, i) => (i + 0.5) * cellDegrees);
  const latitude = Float32Array.from({ length: H }, (_, i) => -90 + (i + 0.5) * cellDegrees);
  file.create_dataset({ name: 'longitude', data: longitude, shape: [W], dtype: '<f4' });
  written('longitude').create_attribute('units', 'degrees_east');
  file.create_dataset({ name: 'latitude', data: latitude, shape: [H], dtype: '<f4' });
  written('latitude').create_attribute('units', 'degrees_north');

  const radiance = new Float32Array(W * H), incidence = new Int16Array(W * H);
  const scale = 180 / 32767, offset = 0, fill = -32768, radianceFill = -3.4028234663852886e38;
  const sun = [Math.cos(SUB_SOLAR.latitude * RADIANS) * Math.cos(SUB_SOLAR.longitude * RADIANS),
    Math.cos(SUB_SOLAR.latitude * RADIANS) * Math.sin(SUB_SOLAR.longitude * RADIANS), Math.sin(SUB_SOLAR.latitude * RADIANS)];
  for (let row = 0; row < H; row++) {
    const lat = latitude[row] * RADIANS;
    for (let column = 0; column < W; column++) {
      const lon = longitude[column] * RADIANS, index = row * W + column;
      const cosine = Math.cos(lat) * Math.cos(lon) * sun[0] + Math.cos(lat) * Math.sin(lon) * sun[1] + Math.sin(lat) * sun[2];
      const angle = Math.acos(Math.max(-1, Math.min(1, cosine))) / RADIANS;
      // The archive maps the lit hemisphere; everything else keeps the fill value.
      const observed = longitude[column] < 180;
      incidence[index] = observed ? Math.round((angle - offset) / scale) : fill;
      radiance[index] = observed ? (row >= H / 2 ? NORTH_RADIANCE : SOUTH_RADIANCE) : radianceFill;
    }
  }
  file.create_dataset({ name: 'radiance', data: radiance, shape: [1, H, W], dtype: '<f4' });
  const radianceSet = written('radiance');
  radianceSet.create_attribute('units', 'W/m2/sr/m');
  radianceSet.create_attribute('_FillValue', new Float32Array([radianceFill]), [1], '<f4');
  file.create_dataset({ name: 'inangle', data: incidence, shape: [1, H, W], dtype: '<i2' });
  const incidenceSet = written('inangle');
  incidenceSet.create_attribute('units', 'degrees');
  incidenceSet.create_attribute('scale_factor', new Float64Array([scale]), [1], '<f8');
  incidenceSet.create_attribute('add_offset', new Float64Array([offset]), [1], '<f8');
  incidenceSet.create_attribute('_FillValue', new Int16Array([fill]), [1], '<i2');

  real('S_SOLLON', headerSubSolar.longitude); real('S_SOLLAT', headerSubSolar.latitude);
  real('S_SSCLON', 92); real('S_SSCLAT', 1); real('S_SSCPHA', 3.65);
  real('S_TGRADI', profile.referenceRadiusMeters / 1000); real('S_DISTAV', 374422);
  real('S_CLDALT', 70); real('EXPOSURE', 0.046);
  file.create_dataset({ name: 'S_ORBITN', data: new Int16Array([257]), shape: [1], dtype: '<i2' });
  file.close();
}

const directory = mkdtempSync(join(tmpdir(), 'akatsuki-uvi-'));
test.after(() => rmSync(directory, { recursive: true, force: true }));

await h5.ready;
const exposure = join(directory, 'uvi_20230830_100446_365_l3b_v21.nc');
writeExposure(exposure);

test('the lit hemisphere lands where east longitude puts it, and nowhere else', async () => {
  const { rgb, missing, report } = await prepareAkatsukiUviMap(exposure, profile, 8, 4);
  // Column x covers east longitude 180 + (x + 0.5) * 45: only columns 4 to 7 fall inside 0 to 180.
  for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++)
    assert.equal(missing[y * 8 + x], x >= 4 ? 0 : 1, `column ${x} row ${y}`);
  assert.equal(report.paintedCells, 16);
  assert.equal(report.outputLongitudeOrigin, 180);
  assert.deepEqual(report.sourceGrid, [W, H]);
});

test('row 0 of the atlas is the north pole, the opposite of the product grid', async () => {
  const { rgb } = await prepareAkatsukiUviMap(exposure, profile, 8, 4);
  const tone = (x: number, y: number) => rgb[(y * 8 + x) * 3];
  // (radiance * 5e-9) ** (1 / 2.2), rounded over 255: 1.6e8 -> 230, 4e7 -> 123.
  assert.equal(tone(4, 0), 230); assert.equal(tone(7, 0), 230);
  assert.equal(tone(4, 3), 123); assert.equal(tone(7, 3), 123);
  assert.ok(tone(4, 0) > tone(4, 3), 'the northern half must be the brighter one');
});

test('the display transform is monotonic and clamps instead of wrapping', async () => {
  const bright = await prepareAkatsukiUviMap(exposure, { ...profile, gain: 1e-8 }, 8, 4);
  const dim = await prepareAkatsukiUviMap(exposure, { ...profile, gain: 1e-9 }, 8, 4);
  assert.equal(bright.rgb[4 * 3], 255, 'a gain past the white point clamps');
  assert.equal(bright.report.clipped, true);
  assert.ok(dim.rgb[4 * 3] < 230 && dim.rgb[4 * 3] > 0);
  assert.equal(dim.report.clipped, false);
});

test('the report states what was observed, lit and painted', async () => {
  const { report } = await prepareAkatsukiUviMap(exposure, profile, 8, 4);
  assert.equal(report.productId, profile.productId);
  assert.equal(report.orbit, 257);
  assert.equal(report.filter, '365 nm');
  assert.equal(report.radianceUnits, 'W/m2/sr/m');
  assert.equal(report.radianceMaximum, NORTH_RADIANCE);
  assert.equal(report.radianceMinimum, SOUTH_RADIANCE);
  assert.equal(report.whiteRadiance, 2e8);
  // Half the globe carries radiance; the poles are the only cells the lit test drops.
  assert.ok(Math.abs(report.observedShare - 50) < 0.01, `observed ${report.observedShare}`);
  assert.ok(report.litShare > 49.9 && report.litShare <= report.observedShare);
  // The grid has no cell exactly on the equator or on a whole degree; half a cell is the best it can do.
  assert.ok(Math.abs(report.subSolar.grid.latitude - SUB_SOLAR.latitude) <= cellDegrees / 2, `latitude ${report.subSolar.grid.latitude}`);
  assert.ok(Math.abs(report.subSolar.grid.longitude - SUB_SOLAR.longitude) <= cellDegrees / 2, `longitude ${report.subSolar.grid.longitude}`);
});

test('a header that disagrees with the grid stops the bake', async () => {
  const rolled = join(directory, 'rolled.nc');
  writeExposure(rolled, { headerSubSolar: { longitude: 270, latitude: 0 } });
  await assert.rejects(() => prepareAkatsukiUviMap(rolled, profile, 8, 4),
    /least-incidence cell is .* but the header puts the Sun at 270/);
});

test('the profile refuses a transform or a frame it cannot state', () => {
  assert.throws(() => parseAkatsukiUviProfile({ ...profile, gamma: 0 }), TypeError);
  assert.throws(() => parseAkatsukiUviProfile({ ...profile, gain: -1 }), TypeError);
  assert.throws(() => parseAkatsukiUviProfile({ ...profile, outputLongitudeOrigin: 400 }), TypeError);
  assert.throws(() => parseAkatsukiUviProfile({ ...profile, observationMiddle: '30 Aug 2023' }), TypeError);
  assert.throws(() => parseAkatsukiUviProfile({ ...profile, filter: 365 }), TypeError);
  assert.deepEqual(parseAkatsukiUviProfile(profile), profile);
});

test('the output must be the equirectangular 2:1 atlas the lane packs', async () => {
  await assert.rejects(() => prepareAkatsukiUviMap(exposure, profile, 8, 8), TypeError);
  await assert.rejects(() => prepareAkatsukiUviMap(exposure, profile, 0, 0), TypeError);
});

test('a product that is not this instrument, filter or exposure is refused', async () => {
  await assert.rejects(() => prepareAkatsukiUviMap(exposure, { ...profile, filter: '283 nm' }, 8, 4), /filter differs/);
  await assert.rejects(() => prepareAkatsukiUviMap(exposure, { ...profile, observationMiddle: '2023-08-30T10:04:47.000' }, 8, 4), /observation time differs/);
  await assert.rejects(() => prepareAkatsukiUviMap(exposure, { ...profile, converterId: 'deadbeef' }, 8, 4), /converter revision differs/);
  await assert.rejects(() => prepareAkatsukiUviMap(exposure, { ...profile, referenceRadiusMeters: 6371000 }, 8, 4), /target radius differs/);
});
