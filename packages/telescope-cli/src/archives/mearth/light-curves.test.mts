import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { before, clipped, COLUMNS, conjunctionJd, filesOf, longest, MEARTH_SOUTH, MEARTH_TIME_ZERO, nightly, nightOf, nightsOf, parseLightCurve, seasonsOf, type MearthLightCurve } from './light-curves.mts';

/** The header and nine exposures of LHS 475's light curve as the release serves it (three segments). */
const FILE = readFileSync(resolve(import.meta.dirname, 'fixtures/2MASSJ19205439-8233170_tel18_2014-2022.head.txt'), 'utf8');
const curve = (bjd: readonly number[], magnitude: readonly number[] = bjd.map(() => 0)): MearthLightCurve => ({ telescope: 'tel18', filter: 'RG715', twomass: '19205439-8233170', bjd, magnitude, error: bjd.map(() => 0.004), segment: bjd.map(() => 1), commonMode: bjd.map(() => 0) });

test('a file of the release is read by the columns its notes list, with what its header says of it', () => {
  const read = parseLightCurve(FILE);
  assert.deepEqual({ telescope: read.telescope, filter: read.filter, twomass: read.twomass, aperturePixels: read.aperturePixels, deblended: read.deblended }, { telescope: 'tel18', filter: 'RG715', twomass: '19205439-8233170', aperturePixels: 8.485, deblended: false });
  assert.equal(read.bjd.length, 9); assert.equal(read.bjd[0], 2457687.506594); assert.equal(read.magnitude[0], 0.015849); assert.equal(read.error[0], 0.004); assert.equal(read.commonMode[0], 0.000405);
  assert.deepEqual(read.segment, [1, 1, 1, 1, 2, 2, 2, 3, 3]);
  // A file without the notes' columns is refused, not guessed at.
  assert.throws(() => parseLightCurve(FILE.replace('Corr_Mag', 'Corrected')), /columns its release notes list/u);
  assert.throws(() => parseLightCurve(FILE.replace('# twomass ', '# other   ')), /holds no twomass/u);
  assert.equal(COLUMNS.length, 19);
});

test('a star\'s files are those the release\'s index names for its 2MASS designation', () => {
  const index = '<a href="lc/2MASSJ19205439-8233170_tel18_2014-2022.txt">[lc]</a> <a href="lc/2MASSJ14294291-6240465_tel13_2014-2022.txt">[lc]</a><a href="lc/2MASSJ14294291-6240465_tel11_2014-2022.txt">[lc]</a><a href="charts/2MASSJ14294291-6240465_tel11_2014-2022_aperture.png">';
  assert.deepEqual(filesOf(index, '14294291-6240465'), ['2MASSJ14294291-6240465_tel11_2014-2022.txt', '2MASSJ14294291-6240465_tel13_2014-2022.txt']);
  assert.deepEqual(filesOf(index, '10145184-4709244'), []);
  assert.throws(() => filesOf(index, 'GJ 1132'), /not a 2MASS designation/u);
});

test('the light a paper analysed ends on its last day, and is clipped at five scaled deviations from its median', () => {
  const light = curve([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [0, 0.001, -0.001, 0.002, -0.002, 0.001, -0.001, 0, 0.5, 0]);
  assert.deepEqual(before(light, 9.5).bjd, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  // The median is 0 and the scaled deviation 0.0015: the flare of 0.5 mag is left out, and nothing else.
  assert.deepEqual(clipped(light).bjd, [1, 2, 3, 4, 5, 6, 7, 8, 10]); assert.equal(clipped(light).magnitude.includes(0.5), false);
});

test('a night runs from one local noon at Cerro Tololo to the next', () => {
  // Local noon there is 16:43 UT, 0.197 of a Julian day.
  assert.equal(Number((-MEARTH_SOUTH.longitudeDegrees / 360).toFixed(3)), 0.197);
  assert.equal(nightOf(2457687.19), nightOf(2457686.9)); assert.equal(nightOf(2457687.2), nightOf(2457687.19) + 1);
  assert.equal(nightsOf(parseLightCurve(FILE)), 3);
  const light = nightly([10.5, 10.6, 10.7, 11.5, 11.6], [0.01, 0.03, 0.02, -0.01, -0.03]);
  assert.deepEqual(light.exposures, [3, 2]); assert.deepEqual(light.magnitude, [0.02, -0.02]); assert.deepEqual(light.bjd.map(one => Number(one.toFixed(2))), [10.6, 11.55]);
});

test('the longest dataset is the light curve with the most nights', () => {
  const run = curve(Array.from({ length: 400 }, (_, index) => 100.5 + index / 4000)), survey = curve([100.5, 101.5, 102.5, 103.5]);
  assert.equal(nightsOf(run), 1); assert.equal(longest([run, survey]), survey); assert.equal(longest([curve([])]), undefined);
});

test('a star is in conjunction when the Sun\'s mean longitude is its ecliptic longitude', () => {
  // A star at the equinox point: the Sun's mean longitude is 0 some 80.7 days after J2000.0, on 2000 March 21.
  assert.equal(Number(conjunctionJd(0, 0).toFixed(1)), 2451625.7);
  // Proxima Centauri, at ecliptic longitude 239 degrees: 19 November.
  assert.equal(new Date((conjunctionJd(217.4289, -62.6795) - 2440587.5) * 86400000).toISOString().slice(0, 10), '2000-11-19');
});

test('a light curve is cut into the star\'s seasons, each named by the year of its middle', () => {
  // A star in conjunction on 21 March: one night every ten days from May 2016 to January 2018.
  const first = 2457510.5, bjd = Array.from({ length: 62 }, (_, index) => first + 10 * index), seasons = seasonsOf({ bjd, magnitude: bjd.map((_, index) => 0.01 * Math.sin(index)), exposures: bjd.map(() => 3) }, 0, 0);
  assert.deepEqual(seasons.map(one => one.season), [2016, 2017]);
  assert.equal(seasons[0]!.nights + seasons[1]!.nights, 62); assert.equal(seasons[0]!.exposures, 3 * seasons[0]!.nights); assert.equal(seasons[0]!.spanDays, 10 * (seasons[0]!.nights - 1));
  assert.equal(seasons[0]!.time[0], first - MEARTH_TIME_ZERO);
  for (const season of seasons) assert.ok(Math.abs(season.flux.reduce((sum, one) => sum + one, 0) / season.flux.length - 1) < 1e-6);
  // A brighter night is a smaller magnitude and a larger share of the light.
  const two = seasonsOf({ bjd: [first, first + 1], magnitude: [0.01, -0.01], exposures: [1, 1] }, 0, 0)[0]!; assert.ok(two.flux[1]! > two.flux[0]!);
});
