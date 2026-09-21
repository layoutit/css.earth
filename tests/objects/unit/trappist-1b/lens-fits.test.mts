/** The MIRI lens is fitted at preparation time from its recipe in source/preparation/raster.json. This check runs the recipe as
 * shipped and holds it to what it was measured to give. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadBareRockFit, loadEclipseMapFit } from '../../../../tools/objects/terrestrial-layers/eclipse-map-fit.mts';

const source = resolve(import.meta.dirname, '../../../../src/objects/trappist-1b/source');
const near = (actual: number, expected: number, tolerance: number, label: string) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual}, expected ${expected} ± ${tolerance}`);

test('the MIRI 15 µm lens is a bare rock fitted to ten visits this project reduced from raw, and fits them better than a smooth map', async () => {
  const raster = JSON.parse(await readFile(resolve(source, 'preparation/raster.json'), 'utf8')) as { surfaces: { id: string; science: { fit: object } }[] };
  const science = raster.surfaces.find(entry => entry.id === 'temperature')!.science;
  const rock = await loadBareRockFit(source, science);
  // Measured 2026-09-21: 497 K under the star, 485 to 510 K where chi-squared rises by 1, on the same 6737 samples as the old map.
  assert.equal(rock.fit.samples, 6737);
  near(rock.fit.substellarK, 497.39, 0.05, 'substellar temperature'); near(rock.fit.lowerK, 484.84, 0.05, 'lower'); near(rock.fit.upperK, 509.71, 0.05, 'upper');
  near(rock.fit.chiSquared, 7002.20, 0.05, 'chi2');
  near(rock.sample(0, 0)!, rock.fit.substellarK, 1e-9, 'substellar point');
  near(rock.sample(60, 0)!, rock.fit.substellarK * 0.5 ** 0.25, 1e-9, '60 degrees from the star');
  assert.equal(rock.sample(90.5, 0), 0); assert.equal(rock.sample(180, 0), 0); near(rock.sample(0, 90)!, 0, 1, 'pole, on the terminator');
  // The map this lens replaced: harmonics of degree 1 and 2 symmetric about the star-facing point, one to four eigencurves chosen
  // by BIC, on the same light curve and systematics. It took degree 2 with one eigencurve, one parameter more than the rock.
  const smooth = await loadEclipseMapFit(source, { ...science, format: 'eclipse-map-fit', fit: { ...science.fit, degrees: [1, 2], eigencurves: [1, 2, 3, 4], positive: true, longitudeSymmetric: true } });
  near(smooth.fit.fit.chiSquared, 7015.99, 0.05, 'smooth map chi2');
  assert.equal(smooth.fit.fit.parameters, rock.fit.parameters + 1);
  assert.ok(rock.fit.chiSquared < smooth.fit.fit.chiSquared && rock.fit.bic < smooth.fit.fit.bic);
});
