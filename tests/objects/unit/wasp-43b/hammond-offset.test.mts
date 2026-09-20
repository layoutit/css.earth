/** Why the MIRI map's longitudinal offset (6.05 degrees) differs from Hammond et al. (2024)'s 7.5 +/- 0.5 on the same observation.
 * Their timing agrees with the data; the difference is which of two systematics solutions the light curve is given. A fast detector
 * ramp with a steep linear trend and a slow ramp with a gentle trend both fit; Hammond et al.'s Table 1 (ramp r1 = 3.7 +/- 0.3 per day,
 * amplitude 1319 +/- 66 ppm, trend -240 +/- 60 ppm/day) is the slow one. On the light curve they mapped (Bell et al.'s Eureka! v1
 * white light), this repository's fit with their time constant returns their systematics and their offset; the data prefer the
 * fast ramp. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BODIES, hostedOrbit, starAstrometry, type HostedOrbit } from '@cssearth/astronomy';
import { fitLightCurveMap, meridionalOffset, type FitRecipe } from '../../../../tools/objects/eclipse-map/light-curve-map.mts';
import { measureTransitShift } from '../../../../tools/objects/eclipse-map/transit-timing.mts';
import { readCsvColumns } from '../../../../tools/objects/terrestrial-layers/eclipse-map-fit.mts';

const source = resolve(import.meta.dirname, '../../../../src/objects/wasp-43b/source');
const orbit = hostedOrbit('wasp-43b'), host = starAstrometry('wasp-43'), radiusRatio = BODIES['wasp-43b'].meanRadiusKm / BODIES['wasp-43'].meanRadiusKm;
const load = async (path: string) => {
  const table = readCsvColumns(await readFile(resolve(source, path)));
  const mask = table.get('mask')!, keep = Array.from(mask.keys()).filter(i => i >= 780 && mask[i] === 0 && Number.isFinite(table.get('flux')![i]!));
  const pick = (name: string) => Float64Array.from(keep, i => table.get(name)![i]!);
  return { time: pick('time'), flux: pick('flux'), error: pick('err'), columns: new Map([['centroid_y', pick('centroid_y')], ['psf_width_y', pick('psf_width_y')]]) };
};
const ours = 'science/jwst-1366-miri/white-5.0-10.5um.csv', bell = 'science/bell-2024/eureka-v1-white-5.0-10.5um.csv';
const at = (seconds: number): HostedOrbit => ({ ...orbit, transitTimeBmjdTdb: orbit.transitTimeBmjdTdb + seconds / 86400 });
const near = (actual: number, expected: number, tolerance: number, label: string) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual}, expected ${expected} ± ${tolerance}`);

test('Hammond et al.\'s ephemeris, read with starry\'s light delay, places the transit where both light curves show it', async () => {
  const epoch = 4893, packageTransit = orbit.transitTimeBmjdTdb + epoch * orbit.periodDays;
  // Their t0 with the period Bell et al. fitted (the paper prints it rounded to 0.813474 d). starry, through exoplanet, delays light
  // relative to the barycentre, so a transit is seen a sin(i)/c before its geometric time: 4.859 stellar radii, i = 82.106 degrees.
  const lightSeconds = 4.859 * BODIES['wasp-43'].meanRadiusKm * Math.sin(82.106 * Math.PI / 180) / 299792.458;
  const hammondObserved = (55934.292283 + epoch * 0.8134740621723353 - packageTransit) * 86400 - lightSeconds;
  near(hammondObserved, -20.6, 0.1, 'Hammond et al. observed transit');
  // Measured 2026-09-17: -20.5 s on Bell et al.'s curve, -19.5 s on this project's reduction (batman-package 2.5.3 agrees on both).
  const bellTransit = measureTransitShift(await load(bell), orbit, host, radiusRatio), oursTransit = measureTransitShift(await load(ours), orbit, host, radiusRatio);
  near(bellTransit.shiftSeconds, -20.5, 1, 'Bell et al. curve'); near(oursTransit.shiftSeconds, -19.5, 1, 'this project\'s curve');
  assert.ok(bellTransit.uncertaintySeconds > .5 && bellTransit.uncertaintySeconds < 2, `Bell timing uncertainty ${bellTransit.uncertaintySeconds} s`);
  assert.deepEqual(oursTransit.fit.software, { 'batman-package': '2.5.3', scipy: '1.18.1', numpy: '2.5.3' });
  assert.equal(oursTransit.modelFlux.length, oursTransit.samples); assert.equal(oursTransit.residualFlux.length, oursTransit.samples);
  near(hammondObserved, bellTransit.shiftSeconds, 1, 'their timing matches the curve they fitted');
  // With the rounded period instead, the transit would be at -47 s, which the curve rules out.
  const rounded = (55934.292283 + epoch * 0.813474 - packageTransit) * 86400 - lightSeconds;
  assert.ok(bellTransit.chiSquaredAt(rounded) > 400, `rounded period: ${rounded} s, chi2 +${bellTransit.chiSquaredAt(rounded)}`);
});

test('with Hammond et al.\'s ramp time constant the fit returns their systematics and their offset; the data prefer a faster ramp', async () => {
  const recipe = (JSON.parse(await readFile(resolve(source, 'preparation/raster.json'), 'utf8')) as { surfaces: { id: string; science: { fit: FitRecipe } }[] })
    .surfaces.find(surface => surface.id === 'miri')!.science.fit;
  const fit = async (path: string, tau: number) => {
    const systematics = recipe.systematics.map(s => s.kind === 'exponential-ramp' ? { kind: 'exponential-ramp' as const, timeConstantsDays: [tau] } : s);
    // The transit as each curve shows it, with light time across the orbit (15 s later at eclipse).
    const curve = await load(path), shift = measureTransitShift(curve, orbit, host, radiusRatio).shiftSeconds;
    const result = fitLightCurveMap(curve, { ...recipe, degrees: [2], eigencurves: [6], systematics }, at(shift), host, radiusRatio, { stellarRadiusKm: BODIES['wasp-43'].meanRadiusKm });
    const [trend, ramp, position, width] = result.fit.systematics;
    return { chiSquared: result.fit.chiSquared, offset: meridionalOffset(result.basis, result.fit), ramp: ramp! * 1e6, trend: trend! * 1e6, position: position!, width: width! };
  };
  // Measured 2026-09-17 on Bell et al.'s curve. Fast (0.10 d): chi2 11798.0, 5.45 deg, ramp 749 ppm, trend -926 ppm/day.
  // Slow (0.27 d, 1/3.7): chi2 11812.2, 7.45 deg, ramp 1275 ppm, trend -279 ppm/day, position 0.0120, width -0.0423.
  const fast = await fit(bell, 0.10), slow = await fit(bell, 1 / 3.7);
  near(slow.ramp, 1319, 2 * 66, 'ramp amplitude against Table 1'); near(slow.trend, -240, 2 * 60, 'trend against Table 1');
  near(slow.position, 0.0122, 0.0013, 'position trend'); near(slow.width, -0.0385, 0.0072, 'width trend');
  near(slow.offset, 7.5, 0.5, 'offset against Hammond et al.');
  assert.ok(Math.abs(fast.trend + 240) > 10 * 60, `the fast ramp's trend (${fast.trend} ppm/day) is not theirs`);
  near(fast.offset, 5.45, 0.15, 'fast-ramp offset');
  // The fast ramp fits better by 14, about 9.5 after Hammond et al.'s error scaling of 1.2225.
  near(slow.chiSquared - fast.chiSquared, 14.2, 1, 'chi2 preference for the fast ramp');
  // This project's reduction: the same two solutions, 6.1 and 7.95 degrees, 14.1 apart.
  const oursFast = await fit(ours, 0.1026), oursSlow = await fit(ours, 1 / 3.7);
  near(oursFast.offset, 6.1, 0.15, 'this reduction, fast ramp'); near(oursSlow.offset, 7.95, 0.15, 'this reduction, slow ramp');
  near(oursSlow.chiSquared - oursFast.chiSquared, 14.1, 1, 'this reduction also prefers the fast ramp');
});
