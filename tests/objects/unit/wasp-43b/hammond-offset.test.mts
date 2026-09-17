/** Why the MIRI map's longitudinal offset (6.05 degrees) differs from Hammond et al. (2024)'s 7.5 +/- 0.5 on the same observation.
 * An eclipse map's longitude trades against two things the fit assumes: when the eclipses happen, and the time constant of the
 * detector ramp. These checks measure both on the package's pinned light curve and show the published ephemeris accounts for the
 * rest. Hammond et al. quote t0 = 55934.292283 BMJD_TDB with the period held at 0.813474 d. */
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
const load = async () => {
  const raster = JSON.parse(await readFile(resolve(source, 'preparation/raster.json'), 'utf8')) as { surfaces: { id: string; science: { path: string; fit: FitRecipe } }[] };
  const science = raster.surfaces.find(surface => surface.id === 'miri')!.science, table = readCsvColumns(await readFile(resolve(source, science.path)));
  const mask = table.get('mask')!, keep = Array.from(mask.keys()).filter(i => i >= 780 && mask[i] === 0), pick = (name: string) => Float64Array.from(keep, i => table.get(name)![i]!);
  return { recipe: science.fit, curve: { time: pick('time'), flux: pick('flux'), error: pick('err'), columns: new Map([['centroid_y', pick('centroid_y')], ['psf_width_y', pick('psf_width_y')]]) } };
};
const at = (seconds: number): HostedOrbit => ({ ...orbit, transitTimeBmjdTdb: orbit.transitTimeBmjdTdb + seconds / 86400 });
// This visit's transit number from the package ephemeris, and where Hammond et al.'s printed ephemeris puts that transit.
const epoch = 4893, hammondSeconds = (55934.292283 + epoch * 0.813474 - (orbit.transitTimeBmjdTdb + epoch * orbit.periodDays)) * 86400;
const near = (actual: number, expected: number, tolerance: number, label: string) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual}, expected ${expected} ± ${tolerance}`);

test('the transit in the MIRI curve comes 19.5 s before the package ephemeris predicts, and 20 s after Hammond et al.\'s ephemeris', async () => {
  const { curve } = await load();
  near(hammondSeconds, -39.5, 0.1, 'Hammond et al. ephemeris minus package');
  const transit = measureTransitShift(curve, orbit, host, radiusRatio);
  // Measured 2026-09-17: -19.5 s (-20.0 to -18.5); batman-package 2.5.3 on the same window gives the same, and -20.5 s on Bell et al.'s deposited curve.
  near(transit.shiftSeconds, -19.5, 1, 'mid-transit'); assert.ok(transit.high - transit.low <= 2.5, 'measured to about a second');
  assert.ok(transit.chiSquaredAt(hammondSeconds) > 400, `Hammond et al.'s ephemeris is ${transit.chiSquaredAt(hammondSeconds)} worse on the transit`);
});

test('longitude follows the assumed eclipse timing and the ramp time constant; the printed ephemeris reproduces 7.5 degrees', async () => {
  const { recipe, curve } = await load();
  // Each timing uses the ramp time constant the lens recipe's profile refines to there (measured 2026-09-17), so the test runs
  // one fit per case; lens-fits.test.mts checks the refinement itself.
  const withRamp = (tau: number) => recipe.systematics.map(s => s.kind === 'exponential-ramp' ? { kind: 'exponential-ramp' as const, timeConstantsDays: [tau] } : s);
  const fit = (seconds: number, tau: number) => {
    const result = fitLightCurveMap(curve, { ...recipe, degrees: [2], eigencurves: [6], systematics: withRamp(tau) }, at(seconds), host, radiusRatio);
    return { chiSquared: result.fit.chiSquared, offset: meridionalOffset(result.basis, result.fit) };
  };
  // Eclipse light leaves the planet 2a/c (15.0 s) after transit light, so the eclipses should sit near -19.5 + 15 = -4.5 s.
  const packageTiming = fit(0, 0.1026), measured = fit(-4.5, 0.1052), hammond = fit(hammondSeconds, 0.1385);
  // Measured 2026-09-17: 6.05 degrees (chi2 11255.8), 6.2 (11250.4), 7.45 (11427.5).
  near(packageTiming.offset, 6.05, 0.1, 'package ephemeris'); near(measured.offset, 6.2, 0.1, 'measured timing'); near(hammond.offset, 7.45, 0.15, 'Hammond et al. ephemeris');
  assert.ok(measured.chiSquared < packageTiming.chiSquared && hammond.chiSquared - measured.chiSquared > 150, 'the eclipses prefer the measured timing');
  assert.ok(Math.abs(hammond.offset - 7.5) <= 0.5, 'within Hammond et al.\'s interval');
  // The ramp: at the measured timing, 0.08 and 0.16 day time constants fit within chi2 4 of each other and differ by about a degree.
  const fast = fit(-4.5, 0.08), slow = fit(-4.5, 0.16);
  // Measured: 5.8 degrees at chi2 11253.5, 6.95 at 11254.4.
  assert.ok(Math.abs(fast.chiSquared - slow.chiSquared) < 4 && slow.offset - fast.offset > 0.9, `ramp 0.08 d: ${fast.offset} at ${fast.chiSquared}; 0.16 d: ${slow.offset} at ${slow.chiSquared}`);
});
