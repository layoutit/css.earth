import assert from 'node:assert/strict';
import { test } from 'node:test';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseRawFrames, planPionierNight } from './calibrate-pionier.mts';
import { readChannelRows, type ChannelVis2 } from './oifits-rows.mts';

const repository = resolve(import.meta.dirname, '../../..');
const fixture = resolve(import.meta.dirname, 'fixtures/pionier-2014-09-25-raw-frames.csv');

test('a night plan pairs each block with its own dark and splits science from calibrators by object', async () => {
  const frames = parseRawFrames(await readFile(fixture, 'utf8'));
  assert.equal(frames.length, 33);
  assert.equal(frames.find(frame => frame.dpId === 'PIONI.2014-09-25T23:15:46.468')!.dpType, 'KAPPA,OBJECT', 'quoted fields keep their commas');
  const window = { from: '2014-09-25T23:14:00', to: '2014-09-26T00:08:00' };
  const plan = planPionierNight(frames, 'PI_GRU', window);
  assert.deepEqual(plan.blocks.map(block => [block.object, block.role, block.exposures.length, block.dark]), [
    ['LAM_GRU', 'calibrator', 5, 'PIONI.2014-09-25T23:42:07.068'],
    ['PI_GRU', 'science', 5, 'PIONI.2014-09-25T23:52:37.477'],
    ['RHO_GRU', 'calibrator', 5, 'PIONI.2014-09-26T00:07:50.369'],
  ]);
  assert.equal(plan.kappa.dark, 'PIONI.2014-09-25T23:14:30.818');
  assert.equal(plan.kappa.frames.length, 4);
  // pndrs's choice: the closest lamp scan before the first block (22:48, not 22:35), and the on-sky kappa set of 23:15 rather than
  // the lamp kappa set of 22:36, because it is closer.
  assert.equal(plan.spectral, 'PIONI.2014-09-25T22:48:00.483');
  assert.throws(() => planPionierNight(frames, 'ALF_ORI', window), /no block on ALF_ORI/u);
  assert.throws(() => planPionierNight(frames.filter(frame => frame.dpId !== 'PIONI.2014-09-25T23:52:37.477'), 'PI_GRU', window), /no dark after it/u);
  assert.throws(() => planPionierNight(frames.filter(frame => frame.dpType !== 'FRINGE,LAMP'), 'PI_GRU', window), /No FRINGE,LAMP/u);
});

/** Pairs our calibrated squared visibilities with the author's for the same exposure: the same baseline vector (either sign)
 * within a metre, channels matched in wavelength order. */
export function matchVis2(ours: readonly ChannelVis2[], theirs: readonly ChannelVis2[]) {
  const byBaseline = (rows: readonly ChannelVis2[]) => { const groups = new Map<string, ChannelVis2[]>(); for (const row of rows) { const key = `${row.u.toFixed(3)},${row.v.toFixed(3)}`; (groups.get(key) ?? groups.set(key, []).get(key)!).push(row); } return [...groups.values()].map(group => group.sort((a, b) => a.wavelengthMetres - b.wavelengthMetres)); };
  const reference = byBaseline(theirs), pairs: [ChannelVis2, ChannelVis2][] = [];
  for (const group of byBaseline(ours)) {
    const { u, v } = group[0]!;
    const match = reference.find(candidate => Math.min(Math.hypot(candidate[0]!.u - u, candidate[0]!.v - v), Math.hypot(candidate[0]!.u + u, candidate[0]!.v + v)) < 1);
    if (match && match.length === group.length) group.forEach((row, index) => pairs.push([row, match[index]!]));
  }
  return pairs;
}

test('calibrating the raw π¹ Gruis block reproduces the author\'s published squared visibilities', async context => {
  const ours = resolve(repository, 'output/calibration/pi1-2014-09-25/calibrated.fits'), author = resolve(repository, 'src/objects/pi1-gruis/source/observations/PI_GRU_forImage.fits');
  if (!await access(ours).then(() => true, () => false) || !await access(author).then(() => true, () => false)) {
    context.skip('run calibrate-pionier.mts on the fixture window and restore the π¹ Gruis file to cover this'); return;
  }
  const pairs = matchVis2(readChannelRows(await readFile(ours)).vis2, readChannelRows(await readFile(author)).vis2);
  // One block of six baselines in three channels (Paladini et al. 2018, 25 September 2014, 23:46-23:51 UT).
  assert.equal(pairs.length, 18);
  const ratios = pairs.map(([a, b]) => a.vis2 / b.vis2).sort((x, y) => x - y), sigmas = pairs.map(([a, b]) => Math.abs(a.vis2 - b.vis2) / Math.hypot(a.error, b.error)).sort((x, y) => x - y);
  const median = ratios[ratios.length >> 1]!;
  assert.ok(Math.abs(median - 1) < 0.02, `median ratio ${median.toFixed(3)}`);
  assert.ok(ratios[0]! > 0.94 && ratios.at(-1)! < 1.06, `ratios ${ratios[0]!.toFixed(3)}-${ratios.at(-1)!.toFixed(3)}`);
  assert.ok(sigmas.at(-1)! < 1.5, `largest difference ${sigmas.at(-1)!.toFixed(2)} sigma`);
  // The wavelengths are the author's: the lamp scan pndrs chooses, not a star's fringe exposure (0.9 percent off).
  for (const [a, b] of pairs) assert.ok(Math.abs(a.wavelengthMetres / b.wavelengthMetres - 1) < 5e-4, `wavelength ${a.wavelengthMetres} against ${b.wavelengthMetres}`);
});
