import assert from 'node:assert/strict';
import test from 'node:test';
import { mjdOf } from './quarters.mts';
import { anomalousQuarters, filterFor, parseSantosRow, quarterReadings, SANTOS, SANTOS_2019, SANTOS_2021, SANTOS_GRAVITY, SANTOS_TABLES, santosMeasures, santosSays, santosStar, santosVerdict, variabilityRange, variance } from './santos.mts';

const table = (name: string) => SANTOS_TABLES.find(one => one.name.endsWith(name))!;
/** Rows as VizieR prints them (2026-10-06), with the columns this module reads. */
const ROWS = {
  // Kepler-186, Table 3 of the 2019 paper.
  kepler186: { KIC: '8120608', Q: '1-17', Prot: '33.75', E_Prot: '2.40', Sph: '2186.4', E_Sph: '52.6', Fl1: '', DMK: '', Fl2: '0', Fl3: '0', Fl4: '0', Fl5: '0' },
  // GJ 1245 B, Table 3: a Type 1 candidate, which the FliPer class calls a binary or polluted.
  gj1245b: { KIC: '8451881', Q: '0-17', Prot: '0.70', E_Prot: '0.05', Sph: '2637.0', E_Sph: '409.2', Fl1: '1', DMK: '', Fl2: '', Fl3: '', Fl4: '', Fl5: '2' },
  // Kepler-102, Table 4: no rotational modulation. KIC 4075064, Table 4: a red giant and an eclipsing binary.
  kepler102: { KIC: '10187017', Q: '0-17', Fl1: '0', DMK: '', Fl2: '0', Fl3: '0', Fl4: '0', Fl5: '0' }, redGiantPair: { KIC: '4075064', Q: '1-17', Fl1: '2,3', DMK: '', Fl2: '1', Fl3: '0', Fl4: '2', Fl5: '0' },
  // Kepler-1651, Table 5: several signals. Its columns are out of place in the catalogue's file, so none is read.
  kepler1651: { KIC: '10905746', Q: '0-17', Prot1: '18.22', E_Prot1: '1.56', Sph1: '2.24', E_Sph1: '0.13', Prot2: '', Sph2: '4475.1', Prot3: '3283.5', Fl1: '', DMK: '', Fl2: '', Fl3: '', Fl4: '0', Fl5: '0' },
  // Kepler-1656, Kepler-1313 (a Type 1 candidate) and KIC 3238657 (flagged as no rotational modulation), Table 1 of the 2021 paper.
  kepler1656: { KIC: '4815520', Q: '0-16', Prot: '18.62', E_Prot: '3.48', Sph: '253.9', E_Sph: '10.4', flag1: '', flag2: '1', flag3: '0', flag4: '0', flag5: '0' },
  kepler1313: { KIC: '6779260', Q: '0-17', Prot: '6.13', E_Prot: '0.42', Sph: '7506.6', E_Sph: '390.3', flag1: '1', flag2: '1', flag3: '0', flag4: '0', flag5: '0' },
  flaggedNone: { KIC: '3238657', Q: '1-17', Prot: '11.85', E_Prot: '1.33', Sph: '99.2', E_Sph: '8.4', flag1: '0', flag2: '1', flag3: '0', flag4: '', flag5: '0' },
  // Kepler-10, Table 2: possible rotational modulation. Kepler-452, Table 2: no reason given.
  kepler10: { KIC: '11904151', Q: '0-17', flag1: '1', flag2: '1', flag3: '0', flag4: '0', flag5: '0' }, kepler452: { KIC: '8311864', Q: '0-17', flag1: '', flag2: '1', flag3: '0', flag4: '0', flag5: '0' } } as const;

test('a row of a table of periods is the paper\'s verdict of rotation, with its period', () => {
  const row = parseSantosRow(table('244/21/table3'), ROWS.kepler186);
  assert.deepEqual(row, { kic: 8120608, paper: 'santos-2019', table: 'J/ApJS/244/21/table3', holds: 'rotation', quarters: '1-17', flag: '', alerts: { gaiaBinary: 0, gaiaSubgiant: 0, planetCandidate: 0, fliperClass: 0 }, rotationDays: 33.75, rotationErrorDays: 2.4, activityPpm: 2186.4, activityErrorPpm: 52.6 });
  assert.deepEqual(santosVerdict(row), { detected: true, periodDays: 33.75 });
  assert.equal(santosSays(row), 'a rotation period of 33.75 ± 2.4 d and a photometric activity (S_ph, the scatter of the light over five rotations) of 2186 parts per million');
  assert.deepEqual(santosMeasures(row), { rotationDays: 33.75, rotationErrorDays: 2.4, activityPpm: 2186.4, activityErrorPpm: 52.6 });
  const second = parseSantosRow(table('255/17/table1'), ROWS.kepler1656);
  assert.deepEqual([second.paper, second.alerts, santosVerdict(second)], ['santos-2021', { binary: 0, planetCandidate: 0 }, { detected: true, periodDays: 18.62 }]);
  assert.throws(() => parseSantosRow(table('244/21/table3'), { ...ROWS.kepler186, Prot: '' }), /without a rotation period/u);
});

test('a flagged period is not taken as a star\'s rotation', () => {
  const candidate = santosVerdict(parseSantosRow(table('244/21/table3'), ROWS.gj1245b));
  assert.equal(candidate.detected, false); assert.match(candidate.reason!, /Santos et al\. \(2019, ApJS 244, 21\) list the star with a period of 0\.7 d and flag it as a Type 1 classical-pulsator or close-binary candidate/u);
  assert.match(santosVerdict(parseSantosRow(table('255/17/table1'), ROWS.kepler1313)).reason!, /2021.*period of 6\.13 d.*Type 1/u);
  assert.match(santosVerdict(parseSantosRow(table('255/17/table1'), ROWS.flaggedNone)).reason!, /flag it as showing no rotational modulation/u);
  assert.throws(() => santosVerdict({ ...parseSantosRow(table('244/21/table3'), ROWS.kepler186), flag: '4' }), /does not list/u);
});

test('a star listed without a period, with several signals or not at all has no verdict of rotation, in the paper\'s words', () => {
  assert.equal(santosVerdict(parseSantosRow(table('244/21/table4'), ROWS.kepler102)).reason, 'Santos et al. (2019, ApJS 244, 21) list the star without a rotation period: it shows no rotational modulation.');
  assert.equal(santosVerdict(parseSantosRow(table('244/21/table4'), ROWS.redGiantPair)).reason, 'Santos et al. (2019, ApJS 244, 21) list the star without a rotation period: it is a red giant and it is an eclipsing binary.');
  assert.equal(santosVerdict(parseSantosRow(table('255/17/table2'), ROWS.kepler10)).reason, 'Santos et al. (2021, ApJS 255, 17) list the star without a rotation period: it shows possible rotational modulation, with no period the paper could give.');
  assert.equal(santosVerdict(parseSantosRow(table('255/17/table2'), ROWS.kepler452)).reason, 'Santos et al. (2021, ApJS 255, 17) list the star without a rotation period.');
  const several = parseSantosRow(table('244/21/table5'), ROWS.kepler1651);
  assert.equal(several.rotationDays, undefined); assert.match(santosVerdict(several).reason!, /several signals.*does not give one period/u);
  assert.match(santosVerdict(undefined).reason!, /do not list the star/u);
  assert.throws(() => santosVerdict(parseSantosRow(table('255/17/table2'), { ...ROWS.kepler10, flag1: '12' })), /does not list/u);
});

test('the papers\' filter for a period: 20 days under 23, 55 from 23 to 60, 80 from 60 on', () => {
  assert.deepEqual([0.7, 22.99, 23, 33.75, 59.9, 60, 143].map(filterFor), [20, 20, 55, 55, 55, 80, 80]);
});

test('a quarter whose variance stands 0.9 of the median over its neighbours is removed, as García et al. (2014) print it', () => {
  // Ratios to the median (1): 1, 1, 2.5, 1, 1. The third stands 1.5 over each neighbour.
  assert.deepEqual(anomalousQuarters([4, 4, 10, 4, 4]), [false, false, true, false, false]);
  // 1.8 over one neighbour and level with the other is a mean of 0.9, which is not greater than the threshold.
  assert.deepEqual(anomalousQuarters([1, 2.8, 2.8, 1, 1, 1, 1]), [false, false, false, false, false, false, false]);
  // A star's first or last quarter has one neighbour.
  assert.deepEqual(anomalousQuarters([3, 1, 1, 1, 1]), [true, false, false, false, false]);
  assert.deepEqual(anomalousQuarters([5]), [false]);
  assert.equal(variance([1, 3]), 1); assert.throws(() => anomalousQuarters([1, Number.NaN]), /variance/u);
});

test('a quarter has a map when the papers\' rule keeps it and its measured light spans a turn of the star', () => {
  // Five quarters of a star turning in 10 days: a point a day, swinging by 2,000 parts per million; the fourth swings five times as much, and the fifth is 6 days long.
  const part = (quarter: number, start: number, days: number, swing: number, filled: readonly number[] = []) => ({ quarter, time: Array.from({ length: days }, (_, day) => start + day), flux: Array.from({ length: days }, (_, day) => swing * Math.sin(2 * Math.PI * day / 10)),
    state: Array.from({ length: days }, (_, day) => filled.includes(day) ? 2 : 1) });
  const read = quarterReadings([part(2, 170, 40, 1000), part(3, 260, 40, 1000, [0, 1, 39]), part(4, 352, 40, 1000), part(5, 443, 40, 5000), part(6, 539, 6, 1000)], 10, 'Santos et al. (2019, ApJS 244, 21)');
  assert.deepEqual(read.map(one => [one.verdict.detected, one.left]), [[true, undefined], [true, undefined], [true, undefined], [false, 'variance'], [false, 'turn']]);
  // The points its authors filled in are counted, and left out of what a map is fitted to.
  assert.deepEqual([read[1]!.points, read[1]!.measured, read[1]!.filled, read[1]!.time[0], read[1]!.spanDays, read[1]!.turns], [40, 37, 3, 262, 36, 3.6]);
  assert.equal(read[0]!.verdict.periodDays, 10); assert.ok(Math.abs(read[0]!.verdict.amplitude! - 0.0019) < 1e-4);
  assert.match(read[3]!.verdict.reason!, /In quarter 5 the variance of the star's light is 25 times the median of its quarters.*Santos et al\. \(2019, ApJS 244, 21\) remove such a quarter/u);
  assert.equal(read[4]!.verdict.reason, 'Quarter 6 holds 5.0 days of the star\'s light, less than one turn of 10 d: not every longitude faced Kepler in it.');
  // numpy's percentiles: of 0 to 100 in steps of one, the 95th less the 5th is 90.
  assert.equal(variabilityRange(Array.from({ length: 101 }, (_, value) => value)), 90);
});

test('a star\'s row is set beside its light of the filter the papers read the period in', () => {
  const row = parseSantosRow(table('244/21/table3'), ROWS.kepler186), step = 0.5, clock = (mjd: number) => mjd - mjdOf(0);
  // Two points a day through quarters 2 and 3 (MJD 55002.02 to 55181.99), swinging by 3,000 parts per million every 33.75 days.
  const time = Array.from({ length: 360 }, (_, index) => Number(clock(55002.1 + step * index).toFixed(6))), flux = time.map(at => 3000 * Math.sin(2 * Math.PI * at / 33.75));
  const series = { kic: 8120608, filterDays: 55, time, flux, state: time.map(() => 1), stepDays: step };
  const star = santosStar(row, series);
  assert.deepEqual(star.quarters.map(quarter => [quarter.quarter, quarter.verdict.detected, quarter.turns > 2.5]), [[2, true, true], [3, true, true]]);
  assert.equal(star.verdict.periodDays, 33.75); assert.ok(Math.abs(star.verdict.amplitude! - 0.0059) < 2e-4);
  // What a page says of the light: the filter read, and nothing more when every quarter has a map.
  assert.equal(star.note, 'The papers read a period of 33.75 d in the star\'s light filtered at 55 days, and that is the light curve mapped.');
  // With quarter 1 in the series too (33 days: under one turn), the note counts it and says why.
  const early = Array.from({ length: 66 }, (_, index) => Number(clock(54964.1 + step * index).toFixed(6))), all = [...early, ...time], longer = { ...series, time: all, flux: all.map(at => 3000 * Math.sin(2 * Math.PI * at / 33.75)), state: all.map(() => 1) };
  assert.equal(santosStar(row, longer).note, 'The papers read a period of 33.75 d in the star\'s light filtered at 55 days, and that is the light curve mapped. 1 of the star\'s 3 quarters has no map. Quarter 1 holds less than one turn of the star.');
  // The 20-day light is not the light a period of 33.75 days is read in.
  assert.throws(() => santosStar(row, { ...series, filterDays: 20 }), /filtered at 55 days/u);
  // A row that is no verdict of rotation reads no light.
  assert.deepEqual(santosStar(parseSantosRow(table('244/21/table4'), ROWS.kepler102), undefined).quarters, []);
  assert.equal(santosStar(undefined, undefined).verdict.detected, false);
});

test('each paper is an entry of the published-verdict kind: its tables asked whole, a star\'s row in one of them', () => {
  assert.deepEqual(SANTOS.map(paper => [paper.id, paper.table, paper.missions]), [['santos-2019', 'VizieR J/ApJS/244/21, table 3', ['Kepler']], ['santos-2021', 'VizieR J/ApJS/255/17, table 1', ['Kepler']]]);
  assert.deepEqual(SANTOS_2019.query, ['SELECT KIC, Q, Fl1, Fl2, Fl3, Fl4, Fl5, DMK, Prot, E_Prot, Sph, E_Sph FROM "J/ApJS/244/21/table3"', 'SELECT KIC, Q, Fl1, Fl2, Fl3, Fl4, Fl5, DMK FROM "J/ApJS/244/21/table4"', 'SELECT KIC, Q, Fl1, Fl2, Fl3, Fl4, Fl5, DMK FROM "J/ApJS/244/21/table5"']);
  assert.deepEqual(SANTOS_2021.query, ['SELECT KIC, Q, flag1, flag3, flag4, Prot, E_Prot, Sph, E_Sph FROM "J/ApJS/255/17/table1"', 'SELECT KIC, Q, flag1, flag3, flag4 FROM "J/ApJS/255/17/table2"']);
  // The answers of a paper's queries come as one list, each row saying which query it answers.
  const rows = SANTOS_2019.parse([{ ...ROWS.kepler186, table: '0' }, { ...ROWS.gj1245b, table: '0' }, { ...ROWS.kepler102, table: '1' }, { ...ROWS.kepler1651, table: '2' }]);
  assert.deepEqual([...rows].map(([kic, row]) => [kic, row.holds]), [[8120608, 'rotation'], [8451881, 'rotation'], [10187017, 'none'], [10905746, 'several']]);
  // A row's verdict is the paper's on the star; the quarters handed in come back for a rotation, and none for anything else.
  assert.deepEqual(SANTOS_2019.judge(rows.get(8120608)!, [2, 3]), { verdict: { detected: true, periodDays: 33.75 }, windows: [2, 3] });
  assert.deepEqual(SANTOS_2019.judge(rows.get(8451881)!, [2, 3]).windows, []); assert.match(SANTOS_2019.says(rows.get(8120608)!), /^a rotation period of 33\.75 ± 2\.4 d/u);
  assert.match(SANTOS_2019.swing, /^measured here/u); assert.equal(SANTOS_GRAVITY, 3.5);
  assert.throws(() => SANTOS_2019.parse([{ ...ROWS.kepler186 }]), /does not say which table/u);
  assert.throws(() => SANTOS_2019.parse([{ ...ROWS.kepler186, table: '0' }, { ...ROWS.kepler186, table: '0' }]), /listed twice/u);
  assert.equal(SANTOS_2021.parse([{ ...ROWS.kepler1656, table: '0' }, { ...ROWS.kepler452, table: '1' }]).get(8311864)!.holds, 'none');
});
