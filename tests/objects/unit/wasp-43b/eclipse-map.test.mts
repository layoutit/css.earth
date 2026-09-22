/** The deposited eclipse map, turned by this package's own orbit and synchronous rotation, must reproduce the deposited JWST
 * light curve; the same map mirrored east-west must not. This ties the lens's longitudes, the orbit's phase and the rotation's
 * sense to the observation rather than to the map file's own labels. North and south are not decidable from photometry. */
import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('wasp-43b');
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BODIES, hostedOrbit, starAstrometry } from '@cssearth/astronomy';
import { readTarMember } from '../../../../tools/objects/terrestrial-layers/tar-member.mts';
import { readNpyObject } from '../../../../tools/objects/terrestrial-layers/npy-pickle.mts';
import { npyArrayAt } from '../../../../tools/objects/terrestrial-layers/npy-dictionary-map.mts';
import { fitScaleAndOffset, mapPhaseCurve, mirrorGrid, type EmissionGrid } from '../../../../tools/objects/eclipse-map/phase-curve.mts';

const deposit = resolve(import.meta.dirname, '../../../../src/objects/wasp-43b/source/science/challener-2024/wasp-43b.tar');
const load = async () => {
  const tar = await readFile(deposit);
  const numbers = (name: string) => Float64Array.from(readTarMember(tar, `wasp-43b/${name}`).toString('utf8').trim().split(/\s+/u).map(Number));
  const maps = readNpyObject(readTarMember(tar, 'wasp-43b/maps.npy'));
  const floats = (name: string) => { const array = npyArrayAt(maps, ['whitelight', name]); assert.ok(array.data instanceof Float64Array); return { shape: array.shape, data: array.data }; };
  const latitudes = floats('lat').data, longitudes = floats('lon').data;
  const grid = (name: string): EmissionGrid => { const { shape, data } = floats(name); return { width: shape[1]!, height: shape[0]!, values: data, latitudes, longitudes }; };
  return { flux: grid('fmap'), temperature: grid('tmap'), time: numbers('time.txt'), data: numbers('flux-whitelight.txt'), error: numbers('ferr-whitelight.txt') };
};

test('the deposited map fits the deposited light curve through the package orbit and rotation; its east-west mirror does not', async () => {
  const { flux, time, data, error } = await load();
  assert.equal(time.length, 4498); assert.equal(data.length, 4498);
  const orbit = hostedOrbit('wasp-43b'), host = starAstrometry('wasp-43'), radiusRatio = BODIES['wasp-43b'].meanRadiusKm / BODIES['wasp-43'].meanRadiusKm;
  // The transit (phases within 0.04 of mid-transit) measures the star, not the map.
  const outsideTransit = (i: number) => { const phase = (((time[i]! - orbit.transitTimeBmjdTdb) / orbit.periodDays) % 1 + 1) % 1; return Math.min(phase, 1 - phase) >= 0.04; };
  const fit = (grid: EmissionGrid) => fitScaleAndOffset(mapPhaseCurve(grid, orbit, host, radiusRatio, time), data, error, outsideTransit);
  const deposited = fit(flux), eastWest = fit(mirrorGrid(flux, 'longitude')), northSouth = fit(mirrorGrid(flux, 'latitude'));
  const uniform = fit({ ...flux, values: new Float64Array(flux.values.length).fill(1) });
  // Measured 2026-09-16: 2.1198 deposited, 16.336 mirrored east-west, 2.1278 mirrored north-south, 92.75 uniform, over 4202 samples.
  assert.equal(deposited.samples, 4202);
  assert.ok(Math.abs(deposited.reducedChiSquared - 2.1198) < 0.001, `deposited map ${deposited.reducedChiSquared}`);
  assert.ok(eastWest.reducedChiSquared > 7 * deposited.reducedChiSquared, `east-west mirror ${eastWest.reducedChiSquared}`);
  assert.ok(uniform.reducedChiSquared > 40 * deposited.reducedChiSquared, `uniform planet ${uniform.reducedChiSquared}`);
  assert.ok(Math.abs(northSouth.reducedChiSquared / deposited.reducedChiSquared - 1) < 0.01, 'north and south are nearly degenerate, as the paper states');
  // The map is in planet-to-star flux per unit projected area: summed over the visible disc it needs no rescaling.
  assert.ok(Math.abs(deposited.scale - 1) < 0.05, `flux scale ${deposited.scale}`);
});

test('the hottest cell is where the paper puts the hotspot: east of the substellar point and south of the equator', async () => {
  const { temperature } = await load();
  let hottest = 0;
  for (let i = 1; i < temperature.values.length; i++) if (temperature.values[i]! > temperature.values[hottest]!) hottest = i;
  // Challener et al. (2024): 6.9 +/- 0.5 degrees east, -13.4 +3.2/-1.7 degrees; cells are 3.75 degrees.
  assert.equal(temperature.longitudes[hottest], 5.625);
  assert.equal(temperature.latitudes[hottest], -13.125);
  assert.ok(Math.abs(temperature.values[hottest]! - 1975.68) < 0.01);
});
