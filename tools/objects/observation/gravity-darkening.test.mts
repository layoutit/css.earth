import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { skyPlaneOrientation, starAstrometry } from '@cssearth/astronomy';
import { parseCieTable } from './disc-integrated-color.mts';
import { gravityDarkenedRows, inclinedPoleOrientation, meanSurfaceTemperature, parseGravityDarkeningRecord, rocheOmegaForFlattening, rocheRadius, surfaceTemperature } from './gravity-darkening.mts';
import { planckRadiance } from '../eclipse-map/eigenmap-fit.mts';

const objects = new URL('../../../src/objects/', import.meta.url);
const record = async (id: string) => {
  const raw = JSON.parse(await readFile(new URL(`${id}/source/photometry/gravity-darkening.json`, objects), 'utf8'));
  return { raw, record: parseGravityDarkeningRecord(raw) };
};

test('the Roche-von Zeipel model reproduces each paper\'s equatorial radius and temperature from its polar values', async () => {
  const ids = (await readdir(objects, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name)
    .filter(id => existsSync(new URL(`${id}/source/photometry/gravity-darkening.json`, objects))).sort();
  assert.deepEqual(ids, ['alderamin', 'altair', 'caph', 'kelt-9', 'rasalhague', 'regulus', 'vega']);
  for (const id of ids) {
    const { raw, record: model } = await record(id);
    // A transit fit publishes the radius ratio and no equatorial temperature (KELT-9, next test).
    if (raw.model.equatorialToPolarRadius) continue;
    const ratio = model.equatorialRadiusSolar / model.polarRadiusSolar;
    // The published radii each carry about half a percent; the model ratio must fall inside their combined error.
    const ratioError = ratio * Math.hypot(raw.model.equatorialRadiusSolar.uncertainty / model.equatorialRadiusSolar, raw.model.polarRadiusSolar.uncertainty / model.polarRadiusSolar);
    // Asymmetric published errors are recorded as their larger side.
    assert.ok(Math.abs(rocheRadius(model.omega, Math.PI / 2) - ratio) <= ratioError, `${id}: equatorial radius`);
    assert.ok(Math.abs(surfaceTemperature(model, Math.PI / 2) - model.equatorTemperatureK!) <= raw.model.equatorTemperatureK.uncertainty, `${id}: equatorial temperature`);
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

test('KELT-9: the Roche surface of the TESS fit\'s flattening, and how its equator compares with the paper\'s text', async () => {
  const { raw, record: model } = await record('kelt-9');
  // Ahlers et al. (2020): equator 1.089 +/- 0.017 times the pole, 2.39 solar radii at the equator, beta 0.137, pole 10,170 K.
  assert.ok(Math.abs(rocheRadius(model.omega, Math.PI / 2) - 1.089) < 1e-9);
  assert.ok(Math.abs(model.omega - rocheOmegaForFlattening(1.089)) < 1e-12 && Math.abs(model.omega - 0.68203) < 1e-5);
  assert.ok(Math.abs(model.polarRadiusSolar - 2.39 / 1.089) < 1e-12);
  assert.equal(model.equatorTemperatureK, undefined, 'the paper gives no equatorial temperature');
  assert.equal(model.inclinationDegrees, undefined, 'the pole is placed by the obliquity record, not a sky view');
  // The Roche-von Zeipel equator is about 500 K cooler than the pole and about 10 percent dimmer in the TESS band (800 nm)...
  const equatorK = surfaceTemperature(model, Math.PI / 2);
  assert.ok(Math.abs(equatorK - 9671.9) < 0.1, `equator ${equatorK}`);
  const tess = planckRadiance(0.8, equatorK) / planckRadiance(0.8, model.poleTemperatureK), bolometric = (equatorK / model.poleTemperatureK) ** 4;
  assert.ok(Math.abs(tess - 0.896) < 0.001 && Math.abs(bolometric - 0.818) < 0.001, `${tess} ${bolometric}`);
  // ...where the paper's text says about 800 K (Figure 2), nearly 1000 K (section 2) and ~38 percent (abstract). The record keeps
  // those statements unmodelled; the README states the difference.
  assert.match(raw.reportedNotModelled.equatorPoleContrast.cell, /38%/);
  // The mean surface temperature stays within the paper's 450 K uncertainty on the adopted 10,170 K.
  assert.ok(Math.abs(meanSurfaceTemperature(model) - 9855) < 1);
});
