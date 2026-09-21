import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { skyPlaneOrientation, starAstrometry } from '@cssearth/astronomy';
import { parseCieTable } from './disc-integrated-color.mts';
import { gravityDarkenedRows, inclinedPoleOrientation, meanSurfaceTemperature, parseGravityDarkeningRecord, rocheRadius, surfaceTemperature } from './gravity-darkening.mts';

const objects = new URL('../../../src/objects/', import.meta.url);
const record = async (id: string) => {
  const raw = JSON.parse(await readFile(new URL(`${id}/source/photometry/gravity-darkening.json`, objects), 'utf8'));
  return { raw, record: parseGravityDarkeningRecord(raw) };
};

test('the Roche-von Zeipel model reproduces each paper\'s equatorial radius and temperature from its polar values', async () => {
  const ids = (await readdir(objects, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name)
    .filter(id => existsSync(new URL(`${id}/source/photometry/gravity-darkening.json`, objects))).sort();
  assert.deepEqual(ids, ['alderamin', 'altair', 'caph', 'rasalhague', 'regulus', 'vega']);
  for (const id of ids) {
    const { raw, record: model } = await record(id);
    const ratio = model.equatorialRadiusSolar / model.polarRadiusSolar;
    // The published radii each carry about half a percent; the model ratio must fall inside their combined error.
    const ratioError = ratio * Math.hypot(raw.model.equatorialRadiusSolar.uncertainty / model.equatorialRadiusSolar, raw.model.polarRadiusSolar.uncertainty / model.polarRadiusSolar);
    // Asymmetric published errors are recorded as their larger side.
    assert.ok(Math.abs(rocheRadius(model.omega, Math.PI / 2) - ratio) <= ratioError, `${id}: equatorial radius`);
    assert.ok(Math.abs(surfaceTemperature(model, Math.PI / 2) - model.equatorTemperatureK) <= raw.model.equatorTemperatureK.uncertainty, `${id}: equatorial temperature`);
    assert.equal(surfaceTemperature(model, 0), model.poleTemperatureK, `${id}: the pole is the reference`);
  }
  // Monnier et al. (2012), Table 2, give Vega's surface-averaged temperature as 9360 ± 90 K.
  assert.ok(Math.abs(meanSurfaceTemperature((await record('vega')).record) - 9360) <= 90);
});

test('the texture rows are brightest and bluest at the poles and dimmest and reddest at the equator', async () => {
  const { record: model } = await record('altair');
  const colorMatching = parseCieTable(await readFile(new URL('altair/source/reference/CIE_xyz_1931_2deg.csv', objects), 'utf8'), 3);
  const rows = gravityDarkenedRows(model, { linear: [0.8, 0.85, 1], srgb: [231, 238, 255] }, colorMatching, 64);
  const [pole, equator] = [rows[0]!, rows[32]!];
  assert.ok(pole.reduce((a, b) => a + b) > equator.reduce((a, b) => a + b), 'the pole is brighter');
  assert.ok(pole[2] / pole[0] > equator[2] / equator[0], 'the pole is bluer');
  assert.deepEqual(rows[0], rows[63], 'both poles are alike');
});

test('an inclined pole at 90 degrees is the sky-plane axis, and a pole-on star faces its pole to the Earth', () => {
  const altair = starAstrometry('altair');
  const inclined = inclinedPoleOrientation(altair, 90, 30), sky = skyPlaneOrientation(altair, 30);
  for (const key of ['rightAscensionDegrees', 'declinationDegrees', 'displayMeridianDegrees'] as const) assert.ok(Math.abs(inclined[key] - sky[key]) < 1e-9, key);
  const vega = starAstrometry('vega'), poleOn = inclinedPoleOrientation(vega, 0, 0);
  // Pole-on: the pole points from the star back to the Sun, the opposite of the star's direction.
  assert.ok(Math.abs(poleOn.declinationDegrees + vega.declinationDegrees) < 1e-9);
});
