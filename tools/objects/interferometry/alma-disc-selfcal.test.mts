import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import {
  angularDiameterRadians, besselJ0, beamSolidAngle, brightnessTemperatureKelvin, discProfileExpression,
  discSelfCalibrationScript, fitLimbDarkenedDisc, limbDarkenedDiscVisibility, planckIntensity, PUBLISHED_ROUNDS,
  type GriddedVisibility,
} from './alma-disc-selfcal.mts';

const RADIANS_PER_MAS = Math.PI / (180 * 3.6e6);
const close = (value: number, expected: number, tolerance: number, what: string) =>
  assert.ok(Math.abs(value - expected) <= tolerance, `${what}: ${value} is not within ${tolerance} of ${expected}`);

test('the order-zero Bessel function matches its published values on both sides of the split', () => {
  close(besselJ0(0), 1, 1e-12, 'J0(0)');
  close(besselJ0(1), 0.765_197_686_557_966, 2e-8, 'J0(1)');
  close(besselJ0(2.404_825_557_695_773), 0, 5e-8, 'J0 at its first zero');
  close(besselJ0(5), -0.177_596_771_314_338, 2e-8, 'J0(5)');
  close(besselJ0(20), 0.167_024_664_340_583, 2e-8, 'J0(20)');
  close(besselJ0(-5), besselJ0(5), 1e-15, 'J0 is even');
});

test('a uniform disc is the p = 0 case, and its visibility is 2 J1(x) / x', () => {
  const diameter = 1e-6;
  const at = (x: number) => limbDarkenedDiscVisibility(x / (Math.PI * diameter), diameter, 0);
  close(limbDarkenedDiscVisibility(0, diameter, 0), 1, 1e-12, 'the zero-spacing visibility is the total flux');
  // 2 J1(2) / 2, with J1(2) = 0.5767248078.
  close(at(2), 0.576_724_807_8, 1e-7, 'the uniform disc at x = 2');
  // The disc's nulls are the zeros of J1.
  for (const zero of [3.831_705_970_2, 7.015_586_669_8, 10.173_468_135_1]) close(at(zero), 0, 5e-8, `the null at x = ${zero}`);
  // 2 J1(45) / 45 is small and positive; the quadrature holds up where a power series would not.
  close(at(45), 0.001_259_949, 1e-7, 'the uniform disc at x = 45');
});

test('a limb-darkened disc matches the Bessel form of its own order', () => {
  const diameter = 1e-6;
  // For p = 2 the closed form is 2^2 Gamma(3) J2(x) / x^2 = 2 J2(x), and J2(2) = 0.352834028616637.
  close(limbDarkenedDiscVisibility(2 / (Math.PI * diameter), diameter, 2), 2 * 0.352_834_028_616_637, 1e-7, 'p = 2 at x = 2');
  // A darker limb is a smaller source, so its visibility falls away more slowly and its first null is further out.
  const at = (p: number, x: number) => limbDarkenedDiscVisibility(x / (Math.PI * diameter), diameter, p);
  assert.ok(at(1, 3.8317) > at(0.5, 3.8317));
  assert.ok(at(0.5, 3.8317) > at(0, 3.8317));
  for (const p of [0, 0.5, 1, 2]) close(limbDarkenedDiscVisibility(1e-9, diameter, p), 1, 1e-6, `p = ${p} at zero spacing`);
  assert.throws(() => limbDarkenedDiscVisibility(1, 1e-6, -0.1), /not negative/u);
  assert.throws(() => limbDarkenedDiscVisibility(1, 0, 0), /positive angular diameter/u);
});

test('the fit recovers a disc it is given, including where the disc sits', () => {
  const diameter = 782 * RADIANS_PER_MAS;
  const truth = { flux: 0.5312, limbDarkening: 0.34, offsetRaMas: 12.5, offsetDecMas: -7.25 };
  const cells: GriddedVisibility[] = [];
  // ALMA's C36-7 configuration reaches from about 200 to 3900 kilo-wavelengths at this frequency.
  for (let u = -3_800_000; u <= 3_800_000; u += 190_000) for (let v = -3_800_000; v <= 3_800_000; v += 190_000) {
    const baseline = Math.hypot(u, v);
    if (baseline < 200_000 || baseline > 3_900_000) continue;
    const amplitude = truth.flux * limbDarkenedDiscVisibility(baseline, diameter, truth.limbDarkening);
    // CASA's sign: an offset east of the phase centre carries a positive phase. Measured against the real data, where the fit
    // gave −76.8 mas and the image the same visibilities make put the disc at −75.2 mas.
    const phase = 2 * Math.PI * (u * truth.offsetRaMas + v * truth.offsetDecMas) * RADIANS_PER_MAS;
    cells.push({ u, v, real: amplitude * Math.cos(phase), imaginary: amplitude * Math.sin(phase), weight: 1 });
  }
  assert.ok(cells.length > 400, `the simulated grid has ${cells.length} cells`);
  const fit = fitLimbDarkenedDisc(cells, diameter);
  close(fit.totalFluxJy, truth.flux, 1e-4, 'the fitted total flux density');
  close(fit.limbDarkening, truth.limbDarkening, 5e-3, 'the fitted limb darkening');
  close(fit.offsetRaMas, truth.offsetRaMas, 0.1, 'the fitted offset in right ascension');
  close(fit.offsetDecMas, truth.offsetDecMas, 0.1, 'the fitted offset in declination');
  close(fit.reducedChiSquared, 0, 1e-8, 'a noiseless fit leaves no residual');
  close(fit.diameterMas, 782, 1e-9, 'the diameter is the one the geometry fixes, not a fitted one');
  assert.throws(() => fitLimbDarkenedDisc(cells.slice(0, 4), diameter), /at least sixteen/u);
});

test('brightness temperature inverts the Planck function and stays above its Rayleigh-Jeans limit', () => {
  const frequency = 233e9;
  for (const temperature of [2.7255, 50, 95, 130, 300]) {
    close(brightnessTemperatureKelvin(planckIntensity(temperature, frequency), frequency), temperature, 1e-9, `${temperature} K round trip`);
  }
  const intensity = planckIntensity(100, frequency);
  const rayleighJeans = intensity * (299_792_458 / frequency) ** 2 / (2 * 1.380_649e-23);
  // At 233 GHz the two differ by about five and a half kelvin, close to h nu / 2k, which is why the Planck form is used.
  close(brightnessTemperatureKelvin(intensity, frequency) - rayleighJeans, 5.487, 0.01, 'the Planck correction at 233 GHz');
  close(6.626_070_15e-34 * frequency / (2 * 1.380_649e-23), 5.59, 0.01, 'half of h nu over k');
  assert.ok(Number.isNaN(brightnessTemperatureKelvin(-1e-18, frequency)));
});

test('the beam solid angle and the angular diameter are the standard expressions', () => {
  close(beamSolidAngle(48.4 * RADIANS_PER_MAS, 30.2 * RADIANS_PER_MAS), 3.893e-14, 1e-17, 'the solid angle of the archive beam');
  // Europa's mean radius at five and a half astronomical units is the 0.77 arcsecond disc the paper reports.
  close(angularDiameterRadians(1560.8, 5.5) / RADIANS_PER_MAS, 782.55, 0.01, 'the disc at 5.5 au');
});

const options = {
  visibilities: '/scratch/cont.ms', body: 'Europa', radiusKm: 1560.8, referenceAntenna: 'DV19', cell: '6.25mas',
  imageSize: [2048, 2048] as const, robust: 0, rounds: PUBLISHED_ROUNDS, fluxScale: 0.907,
  fluxScaleSource: 'Trumbo, Brown & Butler 2018', scratch: '/scratch', out: '/out', gridCellWavelengths: 8000,
};
const fit = { totalFluxJy: 0.53, limbDarkening: 0.3, offsetRaMas: 1, offsetDecMas: -1, diameterMas: 782,
  reducedChiSquared: 1.2, cells: 900, shortestBaselineWavelengths: 2e5, longestBaselineWavelengths: 3.9e6 };

test('every generated stage is headless and follows the moving body', () => {
  const scripts = [
    discSelfCalibrationScript('grid', options, { round: 1, visibilities: '/scratch/cont.ms' }),
    discSelfCalibrationScript('round', options, { round: 1, visibilities: '/scratch/cont.ms', fit }),
    discSelfCalibrationScript('final', options, { round: 0, visibilities: '/scratch/cont.ms', fit, frequencyHz: 233e9 }),
  ];
  for (const script of scripts) {
    for (const forbidden of ['plotms', 'viewer(', 'imview', 'plt.show']) assert.ok(!script.includes(forbidden), `a stage calls ${forbidden}`);
  }
  for (const script of scripts.slice(1)) assert.ok(script.includes("phasecenter='TRACKFIELD'"), 'a stage images without following the ephemeris');
  assert.ok(scripts[1]!.includes("calmode='p'"), 'the self-calibration is not phase only');
  assert.ok(scripts[1]!.includes("solint='inf'"), 'the first round does not use the interval it states');
  assert.ok(scripts[1]!.includes('startmodel='), 'the clean does not start from the fitted disc');
  assert.ok(scripts[1]!.includes('robust=0'), 'the imaging is not at the robust value the paper used');
  // The deep clean is boxed on the fitted disc, and the gains are solved over the whole band, not per window.
  for (const script of scripts.slice(1)) assert.ok(/tclean\([^\n]*mask=box/u.test(script), 'a deep clean runs without the disc box');
  assert.ok(scripts[1]!.includes("combine='spw'") && scripts[1]!.includes('spwmap=[[0] * windows]'),
    'the gains are not solved across the band and mapped back');
});

test('the flux-scale correction is applied to the visibilities and checked, not assumed', () => {
  const script = discSelfCalibrationScript('final', options, { round: 0, visibilities: '/scratch/cont.ms', fit, frequencyHz: 233e9 });
  // applycal divides by the gain, so the amplitude gain that multiplies the data by 0.907 is one over its square root.
  assert.ok(script.includes(String(1 / Math.sqrt(0.907))), 'the gain is not the reciprocal square root of the factor');
  assert.ok(/abs\(ratio - 0\.907\) > 0\.002/u.test(script), 'the run does not check the ratio it produced');
  assert.ok(script.includes('brightness-temperature.fits'), 'no brightness-temperature image is written');
});

test('the disc profile written into the script is the profile the visibility model transforms', () => {
  assert.ok(discProfileExpression(0.6).includes('** 0.3'), 'the profile does not raise one minus the squared radius to p over two');
  // A uniform disc is the zeroth power, which is one inside the disc and nothing outside it.
  assert.ok(discProfileExpression(0).includes('** 0'), 'a uniform disc is not the zeroth power');
  assert.ok(discProfileExpression(0.6).includes('rho <= 1.0'), 'the profile is not cut off at the limb');
});

test('the published rounds state which intervals come from the paper', () => {
  assert.equal(PUBLISHED_ROUNDS.length, 3);
  assert.equal(PUBLISHED_ROUNDS.at(-1)!.solutionInterval, '8s');
  assert.equal(PUBLISHED_ROUNDS.at(-1)!.fromPaper, true);
  // The paper states three rounds and the last interval; the other two are this route's and say so.
  assert.deepEqual(PUBLISHED_ROUNDS.map(round => round.fromPaper), [false, false, true]);
  assert.ok(PUBLISHED_ROUNDS.every((round, index) => index === 0 || round.iterations > PUBLISHED_ROUNDS[index - 1]!.iterations),
    'the rounds do not clean more deeply each time');
});
