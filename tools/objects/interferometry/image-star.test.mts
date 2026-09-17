import assert from 'node:assert/strict';
import { test } from 'node:test';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { matchVis2, vis2Agreement } from './author-comparison.mts';
import { readReconstruction } from './beam-convolve.mts';
import { discStartImage, fitUniformDisc } from './disc-fit.mts';
import { parseSeason } from './image-star.mts';
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
  assert.deepEqual(season.selection.errorFloors, { vis2Relative: 0.05, closureDegrees: 2 });
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
  // The author file already carries 5% and 2 degrees, so the same floors leave it as it is.
  const same = selectOifits(bytes, { errorFloors: { vis2Relative: 0.05, closureDegrees: 2 } });
  assert.ok(same.raisedErrors < before.vis2.length / 100, `${same.raisedErrors} raised`);
  const higher = selectOifits(bytes, { errorFloors: { vis2Relative: 0.1, closureDegrees: 5 } }), after = readChannelRows(higher.bytes);
  assert.ok(after.vis2.every(row => row.error >= 0.1 * Math.abs(row.vis2) - 1e-12));
  assert.ok(after.t3.every(row => row.errorDegrees >= 5 - 1e-9));
  assert.throws(() => selectOifits(bytes, { errorFloors: { vis2Relative: 5, closureDegrees: 2 } }));
});

test('the π¹ Gruis season from raw matches the author file and image, and is cast', async t => {
  const verdictPath = resolve(repository, 'output/stars/pi1-gruis-pionier-2014-09/verdict.json');
  if (!await access(verdictPath).then(() => true, () => false)) return t.skip('run image-star.mts on the season first');
  const result = JSON.parse(await readFile(verdictPath, 'utf8')) as {
    verdict: { cast: boolean; reasons: string[] }; disc: { diameterMas: number };
    comparison: { calibrated: { pairs: number; medianRatio: number }; imageCorrelation: number };
  };
  assert.ok(result.verdict.cast, result.verdict.reasons.join('; '));
  assert.ok(Math.abs(result.disc.diameterMas - 18.17) < 0.5, `${result.disc.diameterMas} mas`);
  assert.ok(result.comparison.calibrated.pairs > 500, `${result.comparison.calibrated.pairs} paired points`);
  assert.ok(Math.abs(result.comparison.calibrated.medianRatio - 1) < 0.05, `median ratio ${result.comparison.calibrated.medianRatio}`);
  assert.ok(result.comparison.imageCorrelation > 0.7, `image correlation ${result.comparison.imageCorrelation}`);
});

test('the author file compared with itself pairs every point with itself', async () => {
  const rows = readChannelRows(await readFile(authorFile)).vis2, agreement = vis2Agreement(matchVis2(rows, rows));
  assert.equal(agreement.pairs, rows.length);
  assert.deepEqual([agreement.ratio5, agreement.medianRatio, agreement.ratio95, agreement.medianSigma], [1, 1, 1, 0]);
});
