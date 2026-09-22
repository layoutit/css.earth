/** c's temperature lens is a bare-rock model set by one measurement, its 15 µm eclipse depth. This check runs the recipe as shipped
 * and holds it to what it was measured to give. */
import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('trappist-1c');
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadBareRockEclipse } from '../../../../tools/objects/terrestrial-layers/eclipse-map-fit.mts';
import { bareRockDaysideFlux } from '../../../../tools/objects/eclipse-map/bare-rock.mts';
import { bandTemperatureTable } from '../../../../tools/objects/eclipse-map/light-curve-map.mts';

const source = resolve(import.meta.dirname, '../../../../src/objects/trappist-1c/source');
const near = (actual: number, expected: number, tolerance: number, label: string) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual}, expected ${expected} ± ${tolerance}`);

test('the bare-rock model of c shows its measured eclipse depth and is dark at night', async () => {
  const raster = JSON.parse(await readFile(resolve(source, 'preparation/raster.json'), 'utf8')) as { surfaces: { id: string; science: unknown }[] };
  const rock = await loadBareRockEclipse(source, raster.surfaces.find(entry => entry.id === 'temperature')!.science);
  // Measured 2026-09-21: the 318 to 389 ppm eclipse depth of this project's joint fit is a rock of 392 to 421 K under the star,
  // drawn at 407 K for the middle of the range; a black rock at c's distance would reach 480 K.
  assert.deepEqual(rock.report.eclipseDepthPpm, [318, 389]);
  near(rock.lowerK, 392.26, 0.01, 'lower'); near(rock.upperK, 421.41, 0.01, 'upper'); near(rock.substellarK, 407.11, 0.01, 'drawn');
  near(bareRockDaysideFlux(rock.substellarK, bandTemperatureTable(rock.band, { minimumK: 20 }), rock.radiusRatio) * 1e6, 353.5, 0.01, 'eclipse depth of the drawn rock, ppm');
  near(rock.sample(0, 0)!, rock.substellarK, 1e-9, 'substellar point');
  assert.equal(rock.sample(180, 0), 0); assert.equal(rock.sample(90.5, 0), 0);
});
