import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { matchVis2, vis2Agreement } from './author-comparison.mts';
import { readReconstruction } from './beam-convolve.mts';
import { discStartImage, fitUniformDisc } from './disc-fit.mts';
import { parseSeason, TWIN_SCALES } from './image-star.mts';
import { readChannelRows } from './oifits-rows.mts';
import { selectOifits } from './oifits-select.mts';
import { parseSqueezeFit, squeezeArguments } from './squeeze.mts';

const repository = resolve(import.meta.dirname, '../../..');
const seasonPath = resolve(import.meta.dirname, 'seasons/pi1-gruis-pionier-2014-09/season.json');
const authorFile = resolve(repository, 'src/objects/pi1-gruis/source/observations/PI_GRU_forImage.fits');

// The end of a real SQUEEZE log (one half of π¹ Gruis's season), colour codes included.
const LOG = [
  'Output -- Best single-frame chi2: 1.844007 obtained at iteration: 1006 in chain number 0.',
  'Output --      pi1-odd-squeeze\tNframes: 500 Chi2r: 1.792861 [31mV2: 2.61 [0m[32mT3P: 0.59 [0m',
  'Output -- pi1-odd-squeeze_MEAN_chain0\tNframes: 500 Chi2r: 1.792861 [31mV2: 2.61 [0m[32mT3P: 0.59 [0m',
  'Output -- pi1-odd-squeeze_MEDIAN_chain0\tNframes: 500 Chi2r: 175.543805 [31mV2:161.58 [0m[32mT3P:197.49 [0m',
].join('\n');

test('the fit is read from the line of the written image, not its chain variants', () => {
  assert.deepEqual(parseSqueezeFit(LOG, 'pi1-odd-squeeze'), { frames: 500, reducedChi2: 1.792861, vis2: 2.61, closurePhase: 0.59, burnedIn: true });
  assert.deepEqual(parseSqueezeFit(LOG, 'pi1-odd-squeeze_MEDIAN_chain0').vis2, 161.58);
  assert.equal(parseSqueezeFit(`${LOG}\nNO CHAIN REACHED BURN IN`, 'pi1-odd-squeeze').burnedIn, false);
  assert.throws(() => parseSqueezeFit(LOG, 'pi1-even-squeeze'), /no fit/u);
});

test('the SQUEEZE command carries the recipe, and -novis only when asked', () => {
  const recipe = { pixelMas: 0.4, width: 128, entropy: 10, elements: 3000, iterations: 3000, discard: 500 };
  const plain = squeezeArguments('in.fits', 'start.fits', 'out', recipe);
  assert.deepEqual(plain.slice(0, 5), ['in.fits', '-s', '0.4', '-w', '128']);
  assert.ok(!plain.includes('-novis'));
  assert.ok(squeezeArguments('in.fits', 'start.fits', 'out', recipe, { novis: true }).includes('-novis'));
  for (const [flag, value] of [['-en', '10'], ['-e', '3000'], ['-n', '3000'], ['-d', '500'], ['-i', 'start.fits'], ['-o', 'out']]) assert.equal(plain[plain.indexOf(flag!) + 1], value);
});

test('the π¹ Gruis season parses, and malformed seasons fail', async () => {
  const raw = JSON.parse(await readFile(seasonPath, 'utf8')) as Record<string, unknown>;
  const season = parseSeason(raw);
  assert.equal(season.data.instrument, 'pionier');
  assert.equal('nights' in season.data && season.data.nights.length, 2);
  assert.equal(season.referenceDiameterMas, 18.17);
  assert.deepEqual(season.selection.errorFloors, { vis2Relative: 0.05, vis2Minimum: 5e-6, closureDegrees: 2 });
  assert.throws(() => parseSeason({ ...raw, schema: 'cssearth-star-season@0' }), /schema/u);
  assert.throws(() => parseSeason({ ...raw, instrument: 'sphere' }), /No calibration/u);
  assert.throws(() => parseSeason({ ...raw, nights: [{ from: '2014-09-26T12:00:00', to: '2014-09-25T14:00:00' }] }), /ordered window/u);
  assert.throws(() => parseSeason({ ...raw, reconstruction: { ...(raw.reconstruction as object), code: 'mira' } }), /SQUEEZE/u);
  const { source: _, ...unsourced } = raw.referenceDiameter as Record<string, unknown>;
  assert.throws(() => parseSeason({ ...raw, referenceDiameter: unsourced }));
});

test('the disc fit on the author file lands on the package diameter, and the start image is that disc', async () => {
  const rows = readChannelRows(await readFile(authorFile));
  const disc = fitUniformDisc(rows, { referenceMas: 18.17 });
  assert.ok(Math.abs(disc.diameterMas - 18.17) < 0.01, `${disc.diameterMas} mas`);
  assert.ok(Math.abs(disc.beamMas - 2.1) < 0.01, `beam ${disc.beamMas} mas`);
  const start = readReconstruction(discStartImage(disc.diameterMas, 0.4, 128));
  assert.equal(start.width, 128);
  assert.ok(start.axes.scale[0] === 0.4 || start.axes.scale[0] === -0.4);
  const total = start.values.reduce((sum, value) => sum + value, 0), lit = start.values.filter(value => value > 0).length;
  assert.ok(Math.abs(total - 1) < 1e-9);
  assert.ok(Math.abs(lit * 0.16 - Math.PI * (disc.diameterMas / 2) ** 2) / lit / 0.16 < 0.02, `${lit} lit pixels`);
});

test('error floors raise only the errors below them', async () => {
  const bytes = await readFile(authorFile), before = readChannelRows(bytes);
  // The author file already carries these floors, so the same floors leave it as it is.
  const same = selectOifits(bytes, { errorFloors: { vis2Relative: 0.05, vis2Minimum: 5e-6, closureDegrees: 2 } });
  assert.ok(same.raisedErrors < before.vis2.length / 100, `${same.raisedErrors} raised`);
  const higher = selectOifits(bytes, { errorFloors: { vis2Relative: 0.1, closureDegrees: 5 } }), after = readChannelRows(higher.bytes);
  assert.ok(after.vis2.every(row => row.error >= 0.1 * Math.abs(row.vis2) - 1e-12));
  assert.ok(after.t3.every(row => row.errorDegrees >= 5 - 1e-9));
  const minimum = readChannelRows(selectOifits(bytes, { errorFloors: { vis2Relative: 0, vis2Minimum: 1e-4, closureDegrees: 0 } }).bytes);
  assert.ok(minimum.vis2.every(row => row.error >= 1e-4 - 1e-12));
  assert.ok(minimum.vis2.some((row, index) => row.error === before.vis2[index]!.error && row.error > 1e-4), 'larger errors are kept');
  assert.throws(() => selectOifits(bytes, { errorFloors: { vis2Relative: 5, closureDegrees: 2 } }));
  assert.throws(() => selectOifits(bytes, { errorFloors: { vis2Relative: 0.05, vis2Minimum: -1, closureDegrees: 2 } }));
});

test('the π¹ Gruis season from raw matches the author file and image, and is cast', async t => {
  const verdictPath = resolve(repository, 'output/stars/pi1-gruis-pionier-2014-09/verdict.json');
  if (!await access(verdictPath).then(() => true, () => false)) return t.skip('run image-star.mts on the season first');
  const result = JSON.parse(await readFile(verdictPath, 'utf8')) as {
    verdict: { cast: boolean; reasons: string[] }; disc: { diameterMas: number };
    comparison: { calibrated: { pairs: number; medianRatio: number; medianSigma: number }; imageCorrelation: number };
  };
  assert.ok(result.verdict.cast, result.verdict.reasons.join('; '));
  // Measured 18.12 mas, 828 pairs at median ratio 0.999 and 0.08 sigma, and 0.990 against the shipped image.
  assert.ok(Math.abs(result.disc.diameterMas - 18.17) < 0.2, `${result.disc.diameterMas} mas`);
  assert.ok(result.comparison.calibrated.pairs > 800, `${result.comparison.calibrated.pairs} paired points`);
  assert.ok(Math.abs(result.comparison.calibrated.medianRatio - 1) < 0.01 && result.comparison.calibrated.medianSigma < 0.2, `median ratio ${result.comparison.calibrated.medianRatio}`);
  assert.ok(result.comparison.imageCorrelation > 0.98, `image correlation ${result.comparison.imageCorrelation}`);
});

test('the author file compared with itself pairs every point with itself', async () => {
  const rows = readChannelRows(await readFile(authorFile)).vis2, agreement = vis2Agreement(matchVis2(rows, rows));
  assert.equal(agreement.pairs, rows.length);
  assert.deepEqual([agreement.ratio5, agreement.medianRatio, agreement.ratio95, agreement.medianSigma], [1, 1, 1, 0]);
});

test('AMBER seasons carry sourced calibrator diameters, and GRAVITY and MATISSE seasons carry exposures', async () => {
  const raw = JSON.parse(await readFile(seasonPath, 'utf8')) as Record<string, unknown>;
  const { nights, ...base } = raw;
  const amber = parseSeason({ ...raw, instrument: 'amber', calibrators: { CANOPUS: { diameterMas: 6.93, errorMas: 0.15, source: 'Ohnaka et al. 2019' } } });
  assert.ok(amber.data.instrument === 'amber' && amber.data.calibrators.get('CANOPUS')?.diameterMas === 6.93);
  assert.throws(() => parseSeason({ ...raw, instrument: 'amber', calibrators: { CANOPUS: { diameterMas: 6.93, errorMas: 0.15 } } }));
  const matisse = parseSeason({ ...base, instrument: 'matisse', exposures: [{ science: 'MATIS.2020-02-08T00:06:12.142' }, { science: 'MATIS.2020-02-08T00:30:00.000', calibrators: ['MATIS.2020-02-08T01:00:00.000'] }] });
  assert.ok('exposures' in matisse.data);
  assert.deepEqual(matisse.data.exposures.map(exposure => exposure.calibrators.length), [0, 1]);
  assert.equal(nights !== undefined, true);
  assert.throws(() => parseSeason({ ...base, instrument: 'gravity' }));
});

test('the π¹ Gruis season from the author file is cast and reproduces the shipped image', async t => {
  const verdictPath = resolve(repository, 'output/stars/pi1-gruis-author-file/verdict.json');
  if (!await access(verdictPath).then(() => true, () => false)) return t.skip('run image-star.mts on the season with --calibrated PI_GRU_forImage.fits first');
  const result = JSON.parse(await readFile(verdictPath, 'utf8')) as {
    verdict: { cast: boolean; reasons: string[] }; fit: { season: { vis2: number; closurePhase: number } }; spots: { ratio: number }; halves: { correlation: number };
    comparison: { calibrated: { medianSigma: number }; imageCorrelation: number };
  };
  assert.ok(result.verdict.cast, result.verdict.reasons.join('; '));
  // The fit SQUEEZE reported for the shipped image, from the same file and recipe.
  assert.deepEqual([result.fit.season.vis2, result.fit.season.closurePhase], [2.45, 1.06]);
  // Against the spottiest twin within 2 percent: measured 2.40 (5.38 against the full-size twin).
  assert.ok(result.spots.ratio > 2 && result.halves.correlation > 0.9, `ratio ${result.spots.ratio}, halves ${result.halves.correlation}`);
  assert.equal(result.comparison.calibrated.medianSigma, 0);
  assert.ok(result.comparison.imageCorrelation > 0.999, `image correlation ${result.comparison.imageCorrelation}`);
});

test('R Aqr\'s 2019 season from raw is not cast because it does not fit its data', async t => {
  const verdictPath = resolve(repository, 'output/stars/r-aqr-pionier-2019/verdict.json');
  if (!await access(verdictPath).then(() => true, () => false)) return t.skip('run image-star.mts on the R Aqr season first');
  const result = JSON.parse(await readFile(verdictPath, 'utf8')) as { verdict: { cast: boolean; reasons: string[] }; fit: { season: { vis2: number; closurePhase: number } }; comparison: Record<string, unknown> };
  assert.equal(result.verdict.cast, false);
  assert.match(result.verdict.reasons[0]!, /does not fit its data/u);
  // Measured 71.8 and 71.9 with lost fringes removed and the error minimum applied.
  assert.ok(result.fit.season.vis2 > 30 && result.fit.season.closurePhase > 30, `${result.fit.season.vis2} and ${result.fit.season.closurePhase}`);
  assert.deepEqual(result.comparison, {}, 'no author file is named for this season');
});

test('the Betelgeuse season averages MATISSE repeats in continuum windows, and twin sizes default to ±2 percent', async () => {
  const raw = JSON.parse(await readFile(resolve(import.meta.dirname, 'seasons/betelgeuse-matisse-2020-02/season.json'), 'utf8')) as Record<string, unknown>;
  const season = parseSeason(raw);
  assert.ok('exposures' in season.data && season.data.exposures.length === 60);
  assert.deepEqual(season.selection.continuum?.windowsMicrometres, [[3.942, 3.974], [3.992, 3.998]]);
  assert.deepEqual(season.twinScales, TWIN_SCALES);
  assert.deepEqual(TWIN_SCALES, [0.98, 0.99, 1, 1.01, 1.02]);
  const selection = raw.selection as Record<string, unknown>;
  assert.throws(() => parseSeason({ ...raw, selection: { ...selection, errorFloors: { vis2Relative: 0.05, closureDegrees: 2 } } }), /its own windows/u);
  assert.deepEqual(parseSeason({ ...raw, check: { twinScales: [0.95, 1, 1.05] } }).twinScales, [0.95, 1, 1.05]);
  assert.throws(() => parseSeason({ ...raw, check: { twinScales: [0.5] } }), /not near/u);
});

test('Betelgeuse from the pinned calibrated files merges identically and is not cast against its spottiest twin', async t => {
  const verdictPath = resolve(repository, 'output/stars/betelgeuse-author-files/verdict.json');
  if (!await access(verdictPath).then(() => true, () => false)) return t.skip('run image-star.mts on the Betelgeuse season with --calibrated on the pinned files first');
  const merged = await readFile(resolve(repository, 'output/stars/betelgeuse-author-files/season.fits'));
  assert.ok(merged.equals(await readFile(resolve(repository, 'src/objects/betelgeuse/source/observations/betelgeuse-matisse-2020-02-continuum.oifits'))));
  const result = JSON.parse(await readFile(verdictPath, 'utf8')) as { verdict: { cast: boolean; reasons: string[] }; spots: { ratio: number; twins: { scale: number; ratio: number }[] }; halves: { correlation: number } };
  // Measured 1.24 to 2.02 across the five twins; the lens is kept with a label (src/objects/betelgeuse/README.md).
  assert.equal(result.verdict.cast, false);
  assert.deepEqual(result.verdict.reasons.map(reason => /spotless/u.test(reason)), [true]);
  assert.equal(result.spots.twins.length, 5);
  assert.ok(Math.min(...result.spots.twins.map(twin => twin.ratio)) < 2 && result.halves.correlation > 0.5);
});
