/** The MIRI lens is fitted at preparation time from its recipe in source/preparation/raster.json. This check runs the recipe as
 * shipped and holds it to what it was measured to give. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadBareRockFit, loadEclipseMapFit, readCsvColumns } from '../../../../tools/objects/terrestrial-layers/eclipse-map-fit.mts';
import { bareRockDaysideFlux } from '../../../../tools/objects/eclipse-map/bare-rock.mts';
import { bandTemperatureTable } from '../../../../tools/objects/eclipse-map/light-curve-map.mts';

const source = resolve(import.meta.dirname, '../../../../src/objects/trappist-1b/source');
const near = (actual: number, expected: number, tolerance: number, label: string) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual}, expected ${expected} ± ${tolerance}`);
const recipe = async () => {
  const raster = JSON.parse(await readFile(resolve(source, 'preparation/raster.json'), 'utf8')) as { surfaces: { id: string; science: { fit: object; path: string; ephemeris: { transitTimeBmjdTdb: number; periodDays: number } } }[] };
  return raster.surfaces.find(entry => entry.id === 'temperature')!.science;
};

test('the recipe ephemeris puts every eclipse of b in the light curve where the light curve shows it', async () => {
  const science = await recipe(), { transitTimeBmjdTdb: t0, periodDays: period } = science.ephemeris;
  const table = readCsvColumns(await readFile(resolve(source, science.path)));
  const time = table.get('time')!, flux = table.get('flux')!, mask = table.get('mask')!;
  // The five 1177 visits, each 3.2 hours around one eclipse of b: the centre of a 36-minute box with the deepest dip.
  const duration = 36.4 / 1440;
  let checked = 0;
  for (let visit = 1; visit <= 5; visit++) {
    const column = table.get(`visit${visit}`)!, rows = Array.from(time.keys()).filter(i => column[i] === 1 && mask[i] === 0);
    const first = time[rows[0]!]!, last = time[rows[rows.length - 1]!]!;
    const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    let best = { centre: 0, depth: -Infinity };
    for (let centre = first + duration / 2; centre <= last - duration / 2; centre += 0.5 / 1440) {
      const inside = rows.filter(i => Math.abs(time[i]! - centre) < duration / 2 - 0.002).map(i => flux[i]!);
      const outside = rows.filter(i => Math.abs(time[i]! - centre) > duration / 2 + 0.002).map(i => flux[i]!);
      const depth = mean(outside) - mean(inside);
      if (depth > best.depth) best = { centre, depth };
    }
    const predicted = t0 + (Math.round((best.centre - t0) / period - 0.5) + 0.5) * period;
    near((best.centre - predicted) * 1440, 0, 3, `visit ${visit} eclipse centre, minutes from the ephemeris`);
    checked++;
  }
  assert.equal(checked, 5);
});

test('the MIRI 15 µm lens is a bare rock fitted to ten visits this project reduced from raw', async () => {
  const science = await recipe();
  const rock = await loadBareRockFit(source, science);
  // Measured 2026-09-21: 575 K under the star, 565 to 586 K where chi-squared rises by 1, on 6905 samples. At eclipse that rock
  // shows 865 ppm, as Greene et al. (2023) measured 861.
  assert.equal(rock.fit.samples, 6905);
  near(rock.fit.substellarK, 575.43, 0.05, 'substellar temperature'); near(rock.fit.lowerK, 565.17, 0.05, 'lower'); near(rock.fit.upperK, 585.58, 0.05, 'upper');
  near(rock.fit.chiSquared, 6803.00, 0.05, 'chi2');
  near(bareRockDaysideFlux(rock.fit.substellarK, bandTemperatureTable(rock.band, { minimumK: 20 }), rock.radiusRatio) * 1e6, 864.6, 0.5, 'eclipse depth, ppm');
  near(rock.sample(0, 0)!, rock.fit.substellarK, 1e-9, 'substellar point');
  near(rock.sample(60, 0)!, rock.fit.substellarK * 0.5 ** 0.25, 1e-9, '60 degrees from the star');
  assert.equal(rock.sample(90.5, 0), 0); assert.equal(rock.sample(180, 0), 0); near(rock.sample(0, 90)!, 0, 1, 'pole, on the terminator');
  // With the package orbit's 2015 timing instead, the eclipses fall two hours early and the fit is far worse: 7002.2 over 6737
  // samples (its transit exclusion falls elsewhere), 1.039 per sample against 0.985.
  const { ephemeris: _ephemeris, ...packageTiming } = science;
  const early = await loadBareRockFit(source, packageTiming);
  assert.ok(early.fit.chiSquared / early.fit.samples - rock.fit.chiSquared / rock.fit.samples > 0.05, `package timing chi2 ${early.fit.chiSquared} over ${early.fit.samples}`);
});

test('a smooth map fits the same data no better than the rock, and puts its hot spot where the star is overhead', async () => {
  const science = await recipe();
  const rock = await loadBareRockFit(source, science);
  const smooth = (longitudeSymmetric: boolean) => loadEclipseMapFit(source, { ...science, format: 'eclipse-map-fit',
    fit: { ...science.fit, degrees: [1, 2], eigencurves: [1, 2, 3, 4], positive: true, longitudeSymmetric } });
  // The map this lens replaced: harmonics of degree 1 and 2 symmetric about the star-facing point, chosen by BIC.
  const centred = await smooth(true);
  near(centred.fit.fit.chiSquared, 6796.60, 0.05, 'smooth map chi2');
  assert.equal(centred.fit.fit.parameters, rock.fit.parameters + 1);
  assert.ok(rock.fit.bic < centred.fit.fit.bic, `rock BIC ${rock.fit.bic}, smooth ${centred.fit.fit.bic}`);
  // Left free in longitude, the hot spot stays within 2 degrees of noon.
  near((await smooth(false)).fit.hotspot.longitude, 0, 2, 'free hot spot longitude');
});
