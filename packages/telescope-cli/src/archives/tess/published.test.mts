import assert from 'node:assert/strict';
import test from 'node:test';
import { PUBLISHED } from './papers.mts';
import { COLMAN_2024, ticOf } from './published.mts';

/** Six rows of VizieR J/AJ/167/189/fig12 as its TAP service answered on 2026-10-06: BE Ceti, TOI-1136, AU Mic, HIP 67522,
 * TIC 278380701 and TIC 150163695. */
const ROWS = [
  { TIC: '184281898', Rvar: '0.0206', Prot: '7.76', f_Prot: '0', Sector: '1', Prot2: '7.71', ProtACF: '7.69' },
  { TIC: '142276270', Rvar: '0.023', Prot: '8.68', f_Prot: '0', Sector: '4', Prot2: '8.69', ProtACF: '8.64' },
  { TIC: '441420236', Rvar: '0.0444', Prot: '4.85', f_Prot: '0', Sector: '1', Prot2: '4.86', ProtACF: '4.84' },
  { TIC: '166527623', Rvar: '0.0211', Prot: '0.71', f_Prot: '1', Sector: '1', Prot2: '1.42', ProtACF: '1.42' },
  { TIC: '278380701', Rvar: '0.00317', Prot: '8.28', f_Prot: '1', Sector: '2', Prot2: '12.17', ProtACF: '12.19' },
  { TIC: '150163695', Rvar: '0.00297', Prot: '', f_Prot: '0', Sector: '1', Prot2: '13.74', ProtACF: '13.55' }] as const;

test('a row of Colman et al.\'s table is read as its columns print it', () => {
  const rows = COLMAN_2024.parse(ROWS); assert.equal(rows.size, 6);
  assert.deepEqual(rows.get(184281898), { tic: 184281898, rotationDays: 7.76, halfPeriod: false, sectors: 1, variabilityRange: 0.0206, twoTermDays: 7.71, autocorrelationDays: 7.69 });
  // A row that prints no period holds none; a flag is the paper's own.
  assert.equal(rows.get(150163695)!.rotationDays, undefined); assert.equal(rows.get(166527623)!.halfPeriod, true);
  assert.throws(() => COLMAN_2024.parse([{ ...ROWS[0], Sector: '' }]), /a row holds no Sector/u); assert.throws(() => COLMAN_2024.parse([{ ...ROWS[0], f_Prot: '2' }]), /neither 0 nor 1/u);
  // The whole table is asked for by the columns that are read, and the entry is the one paper wired.
  assert.equal(COLMAN_2024.query, 'SELECT TIC, Rvar, Prot, f_Prot, Sector, Prot2, ProtACF FROM "J/AJ/167/189/fig12"'); assert.deepEqual(PUBLISHED.map(table => table.paper.id), ['colman-2024', 'canto-martins-2020']);
  assert.equal(ticOf('tess2018263035959-s0003-0000000184281898-0123-s_lc.fits'), 184281898); assert.equal(ticOf('ktwo247589423-c13_llc.fits'), undefined);
});

test('a row is the paper\'s verdict only on light the paper judged, and only when it gives one period', () => {
  const rows = COLMAN_2024.parse(ROWS), row = (tic: number) => rows.get(tic)!;
  // BE Ceti has one 2-minute sector, sector 3: the paper's one detection is of it, with the paper's period and variability.
  assert.deepEqual(COLMAN_2024.judge(row(184281898), [3]), { verdict: { detected: true, periodDays: 7.76, amplitude: 0.0206 }, windows: [3], gives: 7.76 });
  assert.match(COLMAN_2024.says(row(184281898)), /^a rotation period of 7\.76 d, the highest peak of the Lomb-Scargle periodogram of the star's one sector among sectors 1 to 26/u);
  // TOI-1136's four sectors of the first 26 are the paper's four; its sectors after 26 are not the paper's and get nothing.
  assert.deepEqual(COLMAN_2024.judge(row(142276270), [14, 15, 21, 22, 41, 48, 49]), { verdict: { detected: true, periodDays: 8.68, amplitude: 0.023 }, windows: [14, 15, 21, 22], gives: 8.68 });
  assert.match(COLMAN_2024.says(row(142276270)), /the median of the Lomb-Scargle periods of the star's 4 sectors among sectors 1 to 26, each of which passed both/u);
  assert.deepEqual(COLMAN_2024.measures(row(142276270)), { rotationDays: 8.68, variabilityRange: 0.023, sectors: 4, twoTermDays: 8.69, autocorrelationDays: 8.64 });
  // The table counts the sectors of a star's detections and does not name them: with more sectors than detections, no sector is known to be one.
  // The row still prints one period for the star: it is set beside another paper's.
  const fewer = COLMAN_2024.judge(row(441420236), [1, 2]); assert.deepEqual(fewer.windows, []); assert.equal(fewer.gives, 4.85);
  assert.match(fewer.verdict.reason!, /rotation period of 4\.85 d found in 1 of its sectors 1 to 26, and their table does not say which: the star has 2 \(1, 2\)\.$/u);
  assert.match(COLMAN_2024.judge(row(441420236), [27, 95]).verdict.reason!, /the star has no 2-minute light curve there\.$/u);
  // A potential half-period is two candidate periods, and a row without a period is none.
  assert.match(COLMAN_2024.judge(row(166527623), [11]).verdict.reason!, /period of 0\.71 d and flag it as a potential half-period \(their 2-term periodogram gives 1\.42 d and their autocorrelation 1\.42 d\): their table does not give one period/u);
  assert.equal(COLMAN_2024.judge(row(278380701), [3, 4]).verdict.detected, false); assert.equal(COLMAN_2024.judge(row(166527623), [11]).gives, undefined);
  assert.match(COLMAN_2024.judge(row(150163695), [5]).verdict.reason!, /list the star without a rotation period/u);
});
