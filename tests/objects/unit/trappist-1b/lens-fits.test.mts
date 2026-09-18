/** The MIRI lens is fitted at preparation time from its recipe in source/preparation/raster.json. This check runs the recipe as
 * shipped and holds it to what it was measured to give. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { bandTemperatureTable, hemisphereTemperature } from '../../../../tools/objects/eclipse-map/light-curve-map.mts';
import { loadEclipseMapFit } from '../../../../tools/objects/terrestrial-layers/eclipse-map-fit.mts';

const source = resolve(import.meta.dirname, '../../../../src/objects/trappist-1b/source');
const near = (actual: number, expected: number, tolerance: number, label: string) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual}, expected ${expected} ± ${tolerance}`);

test('the MIRI 15 µm lens, fitted to ten visits this project reduced from raw, is centred on the star-facing point', async () => {
  const raster = JSON.parse(await readFile(resolve(source, 'preparation/raster.json'), 'utf8')) as { surfaces: { id: string; science: unknown }[] };
  const map = await loadEclipseMapFit(source, raster.surfaces.find(entry => entry.id === 'temperature')!.science);
  const table = bandTemperatureTable(map.band), hemisphere = (centre: number) => hemisphereTemperature(map.fit.basis, map.fit.fit, table, map.radiusRatio, centre).temperature;
  // The map is symmetric about the star-facing point: the hot spot's offset is not measured (see the README). Measured 2026-09-18:
  // BIC takes degree 2 with one eigencurve; the night hemisphere's 242 K comes mostly from its poles, which the data do not constrain.
  near(map.fit.hotspot.longitude, 0, 1e-9, 'hot spot longitude');
  assert.equal(map.fit.basis.lmax, 2); assert.equal(map.fit.fit.ncurves, 1); assert.equal(map.fit.samples, 6575);
  near(map.fit.fit.chiSquared, 6846.19, 0.5, 'chi2');
  near(map.sample(0, 0)!, 519.4, 1, 'substellar temperature'); near(map.sample(180, 0)!, 44.1, 1, 'antistellar temperature');
  const day = hemisphere(0), night = hemisphere(180);
  near(day, 463.4, 1, 'dayside hemisphere');
  near(night, 242.2, 1, 'nightside hemisphere');
});
