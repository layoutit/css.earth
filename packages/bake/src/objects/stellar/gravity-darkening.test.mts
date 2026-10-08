import { pathToFileURL } from 'node:url';
import { projectRoot as findProjectRoot } from '@cssearth/core/node';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { skyPlaneOrientation, starAstrometry } from '@cssearth/astronomy';
import { parseCieTable } from '@cssearth/bake/objects/color';
import { espinosaLaraRieutordTemperature, gravityDarkenedRows, inclinedPoleOrientation, meanSurfaceTemperature, parseGravityDarkeningRecord, rocheGravity, rocheOmegaForFlattening, rocheRadius, surfaceTemperature } from '@cssearth/bake/objects/stellar';
import { planckRadiance } from '@cssearth/bake/objects/raster';
import { readCie1931ColorMatching } from '@cssearth/bake/objects/sources';

const objects = new URL('src/objects/', pathToFileURL(findProjectRoot(import.meta.url) + '/'));
const record = async (id: string) => {
  const raw = JSON.parse(await readFile(new URL(`${id}/source/photometry/gravity-darkening.json`, objects), 'utf8'));
  return { raw, record: parseGravityDarkeningRecord(raw) };
};

test('the Roche-von Zeipel model reproduces each paper\'s equatorial radius and temperature from its polar values', async () => {
  const ids = (await readdir(objects, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name)
    .filter(id => existsSync(new URL(`${id}/source/photometry/gravity-darkening.json`, objects))).sort();
  assert.deepEqual(ids, ['achernar', 'alderamin', 'altair', 'caph', 'kaus-australis', 'kelt-9', 'mascara-1', 'megrez', 'rasalhague', 'regulus', 'vega', 'wasp-189']);
  for (const id of ids) {
    const { raw, record: model } = await record(id);
    // A transit fit publishes the radius ratio or the flattening and no equatorial temperature (KELT-9, WASP-189 and MASCARA-1, below).
    if (raw.model.equatorialToPolarRadius) continue;
    const ratio = model.equatorialRadiusSolar / model.polarRadiusSolar;
    // The published radii each carry about half a percent; the model ratio must fall inside their combined error.
    // A paper that fits the equatorial radius and derives the polar one prints the latter without an error (Achernar: Domiciano de
    // Souza et al. 2014, Table 6): the ratio then carries the fitted radius's error alone.
    const ratioError = ratio * Math.hypot(raw.model.equatorialRadiusSolar.uncertainty / model.equatorialRadiusSolar, (raw.model.polarRadiusSolar.uncertainty ?? 0) / model.polarRadiusSolar);
    // Asymmetric published errors are recorded as their larger side.
    assert.ok(Math.abs(rocheRadius(model.omega, Math.PI / 2) - ratio) <= ratioError, `${id}: equatorial radius`);
    // A derived equatorial temperature printed without an error is held to what the fitted exponent's own error moves it.
    const equator = Math.PI / 2, temperatureError = raw.model.equatorTemperatureK.uncertainty
      ?? Math.abs(surfaceTemperature({ ...model, beta: model.beta! + raw.model.beta.uncertainty }, equator) - surfaceTemperature(model, equator));
    assert.ok(Math.abs(surfaceTemperature(model, equator) - model.equatorTemperatureK!) <= temperatureError, `${id}: equatorial temperature`);
    assert.equal(surfaceTemperature(model, 0), model.poleTemperatureK, `${id}: the pole is the reference`);
  }
  // Monnier et al. (2012), Table 2, give Vega's surface-averaged temperature as 9360 ± 90 K.
  assert.ok(Math.abs(meanSurfaceTemperature((await record('vega')).record) - 9360) <= 90);
});

test('the texture rows are brightest and bluest at the poles and dimmest and reddest at the equator', async () => {
  const { record: model } = await record('altair');
  const colorMatching = parseCieTable((await readCie1931ColorMatching()).toString('utf8'), 3);
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

test('WASP-189 and MASCARA-1: each transit fit\'s flattening, and the equator its Roche surface gives', async () => {
  // Deline et al. (2022), Table 3: the polar radius 2.88% smaller than the equatorial 2.363 solar radii; beta 0.22, fixed; pole 7967 K.
  // Hooton et al. (2022), Table 5: oblateness 0.0439; equatorial radius 2.082 solar radii; beta 0.199 and pole 7490 K, both fixed.
  const fits = [{ id: 'wasp-189', oblateness: 0.0288, equatorialSolar: 2.363, omega: 0.42821, equatorK: 7760.1 }, { id: 'mascara-1', oblateness: 0.0439, equatorialSolar: 2.082, omega: 0.52046, equatorK: 7217.7 }];
  for (const fit of fits) {
    const { record: model } = await record(fit.id);
    assert.equal(model.equatorialRadiusSolar, fit.equatorialSolar, fit.id);
    assert.ok(Math.abs(1 - model.polarRadiusSolar / model.equatorialRadiusSolar - fit.oblateness) < 1e-6, `${fit.id}: the record's ratio is the printed flattening`);
    assert.ok(Math.abs(rocheRadius(model.omega, Math.PI / 2) - 1 / (1 - fit.oblateness)) < 1e-6 && Math.abs(model.omega - fit.omega) < 1e-5, `${fit.id}: omega ${model.omega}`);
    assert.equal(model.equatorTemperatureK, undefined, `${fit.id}: the paper gives no equatorial temperature`);
    assert.equal(model.inclinationDegrees, undefined, `${fit.id}: the pole is placed by the obliquity record, not a sky view`);
    assert.ok(Math.abs(surfaceTemperature(model, Math.PI / 2) - fit.equatorK) < 0.1, `${fit.id}: equator ${surfaceTemperature(model, Math.PI / 2)}`);
  }
  // Deline et al. say about 200 K lie between WASP-189's poles and equator (section 5.1): this surface gives 207 K.
  const { record: wasp } = await record('wasp-189');
  assert.ok(Math.abs(wasp.poleTemperatureK - surfaceTemperature(wasp, Math.PI / 2) - 207) < 1);
});

test('the law of Espinosa Lara & Rieutord gives their closed form at the equator and von Zeipel\'s law at slow rotation', () => {
  for (const omega of [0.3, 0.7, 0.9, 0.972, 0.997, 0.999]) {
    // Their rotation rate is the equatorial angular velocity over the Keplerian one there: 8/27 of this module's, times x_e cubed.
    const keplerian = 8 / 27 * omega * omega * rocheRadius(omega, Math.PI / 2) ** 3;
    const closedForm = Math.sqrt(2 / (2 + keplerian)) * (1 - keplerian) ** (1 / 12) * Math.exp(-4 / 3 * keplerian / (2 + keplerian) ** 3);
    assert.ok(Math.abs(espinosaLaraRieutordTemperature(omega, Math.PI / 2) - closedForm) < 1e-12, `omega ${omega}`);
    assert.equal(espinosaLaraRieutordTemperature(omega, 0), 1, 'the pole is the reference');
    // The numerical solution meets the two printed limits where each takes over, without a step, and both hemispheres are alike.
    const step = (at: number) => Math.abs(espinosaLaraRieutordTemperature(omega, at * (1 + 1e-9)) / espinosaLaraRieutordTemperature(omega, at * (1 - 1e-9)) - 1);
    assert.ok(step(Math.PI / 2 - 1e-3) < 2e-6 && step(1e-6) < 1e-9, `${step(Math.PI / 2 - 1e-3)} ${step(1e-6)}`);
    assert.equal(espinosaLaraRieutordTemperature(omega, 2.1), espinosaLaraRieutordTemperature(omega, Math.PI - 2.1));
    const latitudes = Array.from({ length: 90 }, (_, index) => espinosaLaraRieutordTemperature(omega, (index + 0.5) / 180 * Math.PI));
    assert.ok(latitudes.every((value, index) => index === 0 || value < latitudes[index - 1]!), 'cooler at every step from pole to equator');
  }
  // "von Zeipel's law is recovered at slow rotation" (their section 2.3): T follows g to the power 1/4.
  assert.ok(Math.abs(espinosaLaraRieutordTemperature(0.05, Math.PI / 2) - rocheGravity(0.05, Math.PI / 2).gravity ** 0.25) < 1e-6);
});

test('Kaus Australis: the law reproduces both of the paper\'s models from their rotation rate and pole', async () => {
  // Bailey et al. (2024), ApJ 972, 103, Table 5: a Roche model with the gravity darkening of Espinosa Lara & Rieutord (2011).
  const printed = [{ omega: 0.997, pole: 11791, equator: 7884, radii: [5.98, 8.59] }, { omega: 0.999, pole: 11721, equator: 7433, radii: [6.01, 8.80] }] as const;
  for (const model of printed) {
    assert.ok(Math.abs(model.pole * espinosaLaraRieutordTemperature(model.omega, Math.PI / 2) - model.equator) < 1, `equator at omega ${model.omega}`);
    // The radii are printed to three figures.
    assert.ok(Math.abs(rocheRadius(model.omega, Math.PI / 2) - model.radii[1] / model.radii[0]) < 0.002, `flattening at omega ${model.omega}`);
  }
  const { raw, record: model } = await record('kaus-australis');
  assert.equal(model.beta, undefined, 'the law has no exponent');
  assert.equal(raw.model.law.value, 'espinosa-lara-rieutord-2011');
  assert.deepEqual([model.omega, model.poleTemperatureK, model.equatorTemperatureK, model.polarRadiusSolar, model.equatorialRadiusSolar], [0.999, 11721, 7433, 6.01, 8.8], 'the model the paper calls Best');
  // The surface mean comes out at 9994 K where the paper prints an effective temperature of 9950 K for the same model.
  assert.ok(Math.abs(meanSurfaceTemperature(model) - 9950) < 50, `${meanSurfaceTemperature(model)}`);
});

test('a record gives an exponent or names the law, never both and never another law', () => {
  const value = (number: number) => ({ value: number }), base = { schema: 'cssearth-roche-von-zeipel@1', source: 'a table',
    model: { omega: value(0.9), poleTemperatureK: value(9000), polarRadiusSolar: value(2), equatorialRadiusSolar: value(2.5) } };
  assert.throws(() => parseGravityDarkeningRecord(base), /gives β or names its law, not both/u);
  assert.throws(() => parseGravityDarkeningRecord({ ...base, model: { ...base.model, beta: value(0.2), law: { value: 'espinosa-lara-rieutord-2011' } } }), /gives β or names its law, not both/u);
  assert.throws(() => parseGravityDarkeningRecord({ ...base, model: { ...base.model, law: { value: 'lucy-1967' } } }), /only gravity-darkening law a record names in place of β is espinosa-lara-rieutord-2011/u);
  assert.equal(parseGravityDarkeningRecord({ ...base, model: { ...base.model, law: { value: 'espinosa-lara-rieutord-2011' } } }).beta, undefined);
  assert.equal(parseGravityDarkeningRecord({ ...base, model: { ...base.model, beta: value(0.2) } }).beta, 0.2);
});
