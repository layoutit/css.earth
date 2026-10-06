import assert from 'node:assert/strict';
import test from 'node:test';
import { CORONA_DISPLAY, coronaExposureGain, coronaPeakValue, coronaScaleValue } from './display.ts';
import { HYDROGEN_MASS_G, JOHNSTONE_GUEDEL_2015, MASS_PER_ELECTRON, SECONDS_PER_YEAR, SOLAR_MASS_G, SOLAR_RADIUS_CM, WOOD_2021, coronalTemperatureFromSurfaceFlux, hydrostaticCorona, lossFunction, massLossFromSurfaceFlux, parkerWind, xraySurfaceFlux } from './models.ts';
import { expandSurfaceField, fieldLineClosed, openShare, potentialField, synthesizeSurfaceField, type SurfaceFieldMap } from './potential-field.ts';
import { SHEET_CORONA, neutralLine, sheetCoronaDensity } from './sheet.ts';

/** A map on 2° cells from a function of colatitude and east longitude. */
const mapOf = (radial: (theta: number, phi: number) => number): SurfaceFieldMap => { const width = 180, height = 90;
  return { width, height, radial: Float64Array.from({ length: width * height }, (_, i) => radial((Math.floor(i / width) + 0.5) * Math.PI / height, (i % width + 0.5) * 2 * Math.PI / width)) }; };
const DIPOLE = expandSurfaceField(mapOf(theta => 10 * Math.cos(theta)), 8), SOURCE = SHEET_CORONA.sourceRadii;
/** A dipole tilted 30° toward longitude 0. */
const TILT = 30 * Math.PI / 180, TILTED = expandSurfaceField(mapOf((theta, phi) => 10 * (Math.cos(TILT) * Math.cos(theta) + Math.sin(TILT) * Math.sin(theta) * Math.cos(phi))), 8);

test('a dipole map expands to one harmonic and its potential field is the textbook one', () => {
  // The 2° cells are summed at their centres, which leaves 0.2% of a 10 gauss dipole.
  const back = synthesizeSurfaceField(DIPOLE, 36, 18);
  for (let row = 0; row < 18; row++) assert.ok(Math.abs(back[row * 36]! - 10 * Math.cos((row + 0.5) * Math.PI / 18)) < 0.03);
  for (const [radii, theta] of [[1, 0.4], [1.5, 1.1], [2.2, 2.6]] as const) {
    const [br, bt, bp] = potentialField(DIPOLE, SOURCE, radii, theta, 1), closure = SOURCE ** -3;
    assert.ok(Math.abs(br - 10 * Math.cos(theta) * (2 * radii ** -3 + closure) / (2 + closure)) < 0.01, `radial field at ${radii}`);
    assert.ok(Math.abs(bt - 10 * Math.sin(theta) * (radii ** -3 - closure) / (2 + closure)) < 0.01, `meridional field at ${radii}`);
    assert.ok(Math.abs(bp) < 1e-9);
  }
  // At the source surface the field is radial, and beyond it falls as the inverse square.
  const [, atSource] = potentialField(DIPOLE, SOURCE, SOURCE, 1, 0), beyond = potentialField(DIPOLE, SOURCE, 2 * SOURCE, 1, 0);
  assert.ok(Math.abs(atSource) < 1e-9);
  assert.ok(Math.abs(beyond[0] - potentialField(DIPOLE, SOURCE, SOURCE, 1, 0)[0] / 4) < 1e-12 && beyond[1] === 0 && beyond[2] === 0);
});

test('a dipole\'s field lines close near its equator and open at its poles, and all are open from the source surface', () => {
  assert.equal(fieldLineClosed(DIPOLE, SOURCE, 1.05, Math.PI / 2, 0), true);
  assert.equal(fieldLineClosed(DIPOLE, SOURCE, 1.05, 0.2, 0), false);
  assert.equal(fieldLineClosed(DIPOLE, SOURCE, SOURCE, Math.PI / 2, 0), false);
  const open = openShare(DIPOLE, SOURCE), shares = open.shares.map(([, share]) => share);
  assert.deepEqual(shares, [...shares].sort((a, b) => a - b), 'the open share grows outward');
  assert.ok(shares[0]! > 0.1 && shares[0]! < 0.6 && shares.at(-1)! > 0.8);
  assert.equal(open(SOURCE), 1); assert.equal(open(3.9), 1);
  assert.ok(Math.abs(open(1.75) - (open(1.5) + open(2)) / 2) < 1e-12 && open(1.75) > open(1.5));
});

test('the neutral line of a dipole is its magnetic equator, wherever the dipole points', () => {
  const upright = neutralLine(DIPOLE);
  for (const theta of [0.3, 1.2, Math.PI / 2, 2.5]) assert.ok(Math.abs(upright.distanceDegrees(theta, 2) - Math.abs(90 - theta * 180 / Math.PI)) < 1.1, `angle from the equator at ${theta}`);
  assert.ok(Math.abs(upright.shareWithin(10) - Math.sin(10 * Math.PI / 180)) < 0.02);
  const tilted = neutralLine(TILTED);
  // Toward longitude 0 the magnetic equator is 30° south of the star's; at longitude 90° the two cross.
  assert.ok(tilted.distanceDegrees((90 + 30) * Math.PI / 180, 0) < 1.1);
  assert.ok(tilted.distanceDegrees(Math.PI / 2, Math.PI / 2) < 1.1);
  assert.ok(Math.abs(tilted.distanceDegrees(Math.PI / 2, 0) - 30) < 1.1);
  assert.throws(() => neutralLine(expandSurfaceField(mapOf(() => 0), 4)), /no neutral line/u);
});

const STAR = { massSolar: 0.82, radiusSolar: 0.74 }, KELVIN = 0.35 * 1.160451812e7, MASS_LOSS = 30 * WOOD_2021.solarMassLossSolarMassesPerYear * SOLAR_MASS_G / SECONDS_PER_YEAR;

test('the wind carries its mass loss through every sphere, and gas at rest radiates its X-ray output', () => {
  const wind = parkerWind({ massLossGramsPerSecond: MASS_LOSS, kelvin: KELVIN, ...STAR });
  assert.ok(Math.abs(wind.speedKmS(wind.criticalRadii) / wind.soundKmS - 1) < 1e-6);
  for (const radii of [1, 2, 4]) assert.ok(Math.abs(4 * Math.PI * (radii * STAR.radiusSolar * SOLAR_RADIUS_CM) ** 2 * wind.density(radii) * MASS_PER_ELECTRON * HYDROGEN_MASS_G * wind.speedKmS(radii) * 1e5 / MASS_LOSS - 1) < 1e-9);
  const atRest = hydrostaticCorona({ xrayLuminosityErgS: 10 ** 28.35, kelvin: KELVIN, ...STAR, outerRadii: 4 });
  let measure = 0; const steps = 4000, dx = 3 / steps, radiusCm = STAR.radiusSolar * SOLAR_RADIUS_CM;
  for (let i = 0; i < steps; i++) { const x = 1 + (i + 0.5) * dx; measure += atRest.density(x) ** 2 * 4 * Math.PI * x * x * dx * radiusCm ** 3; }
  assert.ok(Math.abs(measure * lossFunction(KELVIN) / 10 ** 28.35 - 1) < 1e-3);
});

test('the two relations give what their papers print, and the mass-loss line is the median of the paper\'s own stars', () => {
  assert.ok(Math.abs(coronalTemperatureFromSurfaceFlux(1e6) / 1e6 - JOHNSTONE_GUEDEL_2015.coefficientMK * 10 ** (6 * JOHNSTONE_GUEDEL_2015.index)) < 1e-9);
  assert.equal((coronalTemperatureFromSurfaceFlux(1.5e6) / 1e6).toFixed(1), '4.4');
  // Wood et al. (2021), Table 3: the single main-sequence stars with an astrospheric detection, as star, mass loss in units of
  // the Sun's, log X-ray luminosity and radius in solar radii (arXiv:2105.00019).
  const rows = [['GJ 887', 0.5, 27.03, 0.47], ['EV Lac', 1, 28.99, 0.32], ['GJ 205', 0.3, 27.66, 0.59], ['YZ CMi', 30, 28.57, 0.33], ['GJ 173', 0.75, 26.84, 0.42], ['ε Eri', 30, 28.31, 0.74], ['61 Cyg A', 0.5, 27.03, 0.67],
    ['ε Ind', 0.5, 27.39, 0.73], ['GJ 892', 0.5, 26.85, 0.78], ['61 Vir', 0.3, 26.87, 0.99], ['π1 UMa', 0.5, 28.99, 0.97]] as const;
  assert.equal(rows.length, WOOD_2021.stars);
  const offsets = rows.map(([, massLoss, logLuminosity, radius]) => Math.log10(massLoss / radius ** 2) - WOOD_2021.index * Math.log10(xraySurfaceFlux(10 ** logLuminosity, radius))).sort((a, b) => a - b);
  const median = offsets[(offsets.length - 1) / 2]!, mean = offsets.reduce((sum, value) => sum + value, 0) / offsets.length;
  assert.equal((-median / WOOD_2021.index).toFixed(2), WOOD_2021.anchorLogSurfaceFlux.toFixed(2));
  assert.equal(Math.sqrt(offsets.reduce((sum, value) => sum + (value - mean) ** 2, 0) / offsets.length).toFixed(2), WOOD_2021.scatterDex.toFixed(2));
  assert.equal((offsets[0]! - median).toFixed(2), WOOD_2021.lowestDex.toFixed(2));
  assert.equal((offsets.at(-1)! - median).toFixed(2), WOOD_2021.highestDex.toFixed(2));
  // A star of the Sun's size at the anchor loses mass as the Sun does.
  assert.ok(Math.abs(massLossFromSurfaceFlux(10 ** WOOD_2021.anchorLogSurfaceFlux, 1) - 1) < 1e-12);
  assert.ok(Math.abs(massLossFromSurfaceFlux(10 ** (WOOD_2021.anchorLogSurfaceFlux + 1), 2) - 4 * 10 ** WOOD_2021.index) < 1e-9);
});

test('the density is gas at rest on the reversal line and the wind through the open share away from it', () => {
  const atRest = (radii: number) => 1e8 / radii ** 4, wind = (radii: number) => 1e6 / radii ** 2, open = (radii: number) => radii >= SOURCE ? 1 : 0.5;
  const line = neutralLine(DIPOLE), corona = sheetCoronaDensity({ neutralDistanceDegrees: line.distanceDegrees, atRest, wind, openShare: open });
  assert.ok(Math.abs(corona.offSheet(2) - 2 * wind(2)) < 1e-6);
  assert.ok(Math.abs(corona.density(2, 0.05, 0) / corona.offSheet(2) - 1) < 1e-6, 'far from the line');
  assert.ok(Math.abs(corona.density(2, Math.PI / 2, 0) / atRest(2) - 1) < 0.02, 'on the line');
  // The sheet narrows outward, and its excess over the wind falls beyond the source surface.
  const off = (radii: number, degrees: number) => corona.density(radii, (90 - degrees) * Math.PI / 180, 0) / corona.offSheet(radii);
  assert.ok(off(1.2, 12) > 1 && off(2, 12) / off(2, 0) < off(1.2, 12) / off(1.2, 0));
  assert.ok(off(3.9, 0) < off(2.6, 0) && off(3.9, 0) > 1);
  for (const radii of [1.5, 2.5, 3.5]) assert.ok(Math.abs(corona.density(radii, Math.PI / 2, 0) / corona.onSheet(radii) - 1) < 0.02, `the reversal line holds the densest gas at ${radii}`);
});

test('the densest gas of a radius sits on the scale, thinner gas is dimmer in proportion, and nothing shows inside the star', () => {
  assert.equal(coronaScaleValue(1e7, 0.99), 0);
  assert.equal(coronaScaleValue(1e7, 2), 0.5);
  assert.equal(coronaScaleValue(1e7, 4), 0);
  assert.equal(coronaPeakValue(1e7, 1e7, 2), 0.5); assert.equal(coronaPeakValue(3e7, 1e7, 2), 0.5);
  assert.ok(Math.abs(coronaPeakValue(1e6, 1e7, 2) - 0.05) < 1e-12);
  assert.ok(Math.abs(coronaExposureGain() - -Math.log(1 - CORONA_DISPLAY.topAlpha) / CORONA_DISPLAY.fullScaleColumnRadii) < 1e-12);
});
