import assert from 'node:assert/strict';
import test from 'node:test';
import { HYDROGEN_MASS_G, MASS_PER_ELECTRON, SECONDS_PER_YEAR, SOLAR_MASS_G, SOLAR_RADIUS_CM, hydrostaticCorona, lossFunction, parkerWind } from './corona-models.mts';
import { DISPLAY, RADIAL_FILTER, filteredValue, scaleValue } from './author.mts';

const EPS_ERIDANI = { massSolar: 0.82, radiusSolar: 0.74, kelvin: 0.35 * 1.160451812e7 };
const massLossGramsPerSecond = 30 * 2e-14 * SOLAR_MASS_G / SECONDS_PER_YEAR;

test('Parker\'s wind passes the speed of sound at its critical radius and carries the same mass through every sphere', () => {
  const wind = parkerWind({ massLossGramsPerSecond, ...EPS_ERIDANI });
  assert.ok(Math.abs(wind.speedKmS(wind.criticalRadii) / wind.soundKmS - 1) < 1e-6);
  assert.ok(wind.speedKmS(1) < wind.soundKmS && wind.speedKmS(4) > wind.soundKmS);
  for (const radii of [1, 1.5, 2, 3, 4]) {
    const flux = 4 * Math.PI * (radii * EPS_ERIDANI.radiusSolar * SOLAR_RADIUS_CM) ** 2 * wind.density(radii) * MASS_PER_ELECTRON * HYDROGEN_MASS_G * wind.speedKmS(radii) * 1e5;
    assert.ok(Math.abs(flux / massLossGramsPerSecond - 1) < 1e-9, `mass flux at ${radii} radii`);
  }
  // The values the dataset states for this star.
  assert.equal(wind.speedKmS(1).toFixed(0), '93');
  assert.equal(wind.criticalRadii.toFixed(2), '1.89');
  assert.equal(wind.density(4).toExponential(1), '8.9e+5');
});

test('gas at rest radiates the X-ray luminosity it was given, and thins out more slowly when hotter', () => {
  const xrayLuminosityErgS = 10 ** 28.35, corona = hydrostaticCorona({ xrayLuminosityErgS, ...EPS_ERIDANI, outerRadii: 4 });
  const radiusCm = EPS_ERIDANI.radiusSolar * SOLAR_RADIUS_CM, steps = 20000;
  let emissionMeasure = 0;
  for (let i = 0; i < steps; i++) { const x = 1 + (i + 0.5) * 3 / steps; emissionMeasure += corona.density(x) ** 2 * 4 * Math.PI * (x * radiusCm) ** 2 * radiusCm * 3 / steps; }
  assert.ok(Math.abs(emissionMeasure * lossFunction(EPS_ERIDANI.kelvin) / xrayLuminosityErgS - 1) < 1e-4);
  const hotter = hydrostaticCorona({ xrayLuminosityErgS, ...EPS_ERIDANI, kelvin: 2 * EPS_ERIDANI.kelvin, outerRadii: 4 });
  assert.ok(hotter.density(4) / hotter.basePerCm3 > corona.density(4) / corona.basePerCm3);
});

test('the radial filter leaves a place of typical density as bright as the plain scale, and saturates at its ceiling', () => {
  const [low, high] = DISPLAY.densityRangePerCm3, typical = 1e7, radii = 2;
  assert.equal(scaleValue(high, radii), 1);
  assert.equal(scaleValue(low, radii), 0);
  assert.equal(scaleValue(high, 0.9), 0);
  assert.equal(scaleValue(high, DISPLAY.outerFadeRadii[1]), 0);
  // The filtered exposure is `ceiling` times longer, so value times exposure matches the plain display at typical density.
  assert.ok(Math.abs(filteredValue(typical, typical, radii) * RADIAL_FILTER.ceiling - scaleValue(typical, radii)) < 1e-12);
  assert.ok(Math.abs(filteredValue(3 * typical, typical, radii) / filteredValue(typical, typical, radii) - 3) < 1e-12);
  assert.equal(filteredValue(50 * typical, typical, radii), filteredValue(RADIAL_FILTER.ceiling * typical, typical, radii));
});
