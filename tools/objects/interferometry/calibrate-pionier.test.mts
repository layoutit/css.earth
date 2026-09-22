import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseRawFrames, planPionierNight } from './calibrate-pionier.mts';
import { readChannelRows } from './oifits-rows.mts';
import { matchVis2 } from './author-comparison.mts';

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
  // 2019 service mode: a calibrator filed as CALIB carries no star name, another programme's science block is not a calibrator,
  // and the lamp and kappa sets come from the morning before (pndrs's preference) though the next morning's are closer.
  const at = (time: string, dpType: string, object = dpType, dpCategory = 'CALIB', programme = '60.A-9800(K)', templateStart = time.slice(0, 19)) =>
    ({ dpId: `PIONI.${time}`, dpType, dpCategory, object, programme, templateStart });
  const night = [
    at('2019-08-06T10:48:40.000', 'DARK'), at('2019-08-06T10:49:35.078', 'KAPPA,LAMP', 'KAPPA,LAMP', 'CALIB', '60.A-9800(K)', '2019-08-06T10:49:30'),
    at('2019-08-06T10:51:40.890', 'FRINGE,LAMP'),
    at('2019-08-07T00:02:17.262', 'FRINGE,OBJECT', 'FRINGE,OBJECT'), at('2019-08-07T00:06:00.000', 'DARK'),
    at('2019-08-07T00:14:00.447', 'FRINGE,OBJECT', 'AI_SCO', 'SCIENCE', '0103.D-0999(A)'), at('2019-08-07T00:18:00.000', 'DARK'),
    at('2019-08-07T01:10:00.000', 'FRINGE,OBJECT', 'RAQR', 'SCIENCE', '0103.D-0255(B)'), at('2019-08-07T01:14:00.000', 'DARK'),
    at('2019-08-07T10:40:00.000', 'DARK'), at('2019-08-07T10:42:00.000', 'KAPPA,LAMP', 'KAPPA,LAMP', 'CALIB', '60.A-9800(K)', '2019-08-07T10:41:50'),
    at('2019-08-07T10:45:00.000', 'FRINGE,LAMP'),
  ];
  const serviceNight = planPionierNight(night, 'RAQR', { from: '2019-08-07T00:00:00', to: '2019-08-07T12:00:00' });
  assert.deepEqual(serviceNight.blocks.map(block => [block.object, block.role]), [['FRINGE,OBJECT', 'calibrator'], ['RAQR', 'science']]);
  assert.equal(serviceNight.spectral, 'PIONI.2019-08-06T10:51:40.890');
  assert.deepEqual(serviceNight.kappa.frames, ['PIONI.2019-08-06T10:49:35.078']);
  // With setups, a GRISM night takes the GRISM lamp and kappa sets of that morning, not the GRISM+Wollaston ones taken last.
  const grism = [...night,
    at('2019-08-06T10:46:10.000', 'DARK'), at('2019-08-06T10:46:35.987', 'KAPPA,LAMP', 'KAPPA,LAMP', 'CALIB', '60.A-9800(K)', '2019-08-06T10:46:30'),
    at('2019-08-06T10:47:50.943', 'FRINGE,LAMP')].sort((a, b) => a.dpId.localeCompare(b.dpId));
  const wollaston = new Set(['PIONI.2019-08-06T10:48:40.000', 'PIONI.2019-08-06T10:49:35.078', 'PIONI.2019-08-06T10:51:40.890', 'PIONI.2019-08-07T10:40:00.000', 'PIONI.2019-08-07T10:42:00.000', 'PIONI.2019-08-07T10:45:00.000']);
  const setupPlan = planPionierNight(grism, 'RAQR', { from: '2019-08-07T00:00:00', to: '2019-08-07T12:00:00' }, dpId => wollaston.has(dpId) ? 'GRI+WOL/52' : 'GRISM/26');
  assert.deepEqual([setupPlan.spectral, setupPlan.kappa.frames[0], setupPlan.kappa.dark], ['PIONI.2019-08-06T10:47:50.943', 'PIONI.2019-08-06T10:46:35.987', 'PIONI.2019-08-06T10:46:10.000']);
});

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
