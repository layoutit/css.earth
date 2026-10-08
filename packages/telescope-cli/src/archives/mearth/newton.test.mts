import assert from 'node:assert/strict';
import test from 'node:test';
import type { MearthLightCurve } from './light-curves.mts';
import { MEARTH_PAPERS, NEWTON_2018, NEWTON_2018_LAST_BJD, newtonStar, parseNewtonRow, rowAt, swingOf } from './newton.mts';

/** Rows as VizieR's TAP service answers the entry's query (2026-10-08). */
const ROWS = {
  proxima: { Type: 'A', twomass: '14294291-6240465', RAJ2000: '217.42925', DEJ2000: '-62.67963889', Per: '88.977', Amp: '0.0073', e_Amp: '0.0067', Flag: '', NPts: '6009', NDays: '600', ftest: '2893' },
  lhs475: { Type: 'A', twomass: '19205439-8233170', RAJ2000: '290.226083', DEJ2000: '-82.55447222', Per: '79.317', Amp: '0.0025', e_Amp: '0.0039', Flag: '', NPts: '2446', NDays: '235', ftest: '209' },
  gradeB: { Type: 'B', twomass: '02460224-7024062', RAJ2000: '41.509354', DEJ2000: '-70.401749', Per: '106.804', Amp: '0.002', e_Amp: '0.0025', Flag: '', NPts: '5271', NDays: '491', ftest: '237' },
  // A grade A rotator whose aperture the paper flags as contaminated; a candidate; LHS 3844, a non-detection.
  flagged: { Type: 'A', twomass: '01234181-3833496', RAJ2000: '20.924334', DEJ2000: '-38.563774', Per: '33.864', Amp: '0.0061', e_Amp: '0.0028', Flag: '1', NPts: '8988', NDays: '745', ftest: '2977' },
  candidate: { Type: 'U', twomass: '02280771-3628204', RAJ2000: '37.032223', DEJ2000: '-36.472343', Per: '42.631', Amp: '0.009', e_Amp: '0.0035', Flag: '', NPts: '486', NDays: '71', ftest: '449' },
  lhs3844: { Type: 'N', twomass: '22415815-6910089', RAJ2000: '340.492065', DEJ2000: '-69.168991', Per: '', Amp: '0.0105', e_Amp: '0.0038', Flag: '', NPts: '805', NDays: '83', ftest: '463' } } as const;

test('a grade A or B row is the paper\'s verdict of rotation, at its period and with its sinusoid\'s swing', () => {
  const row = parseNewtonRow(ROWS.proxima);
  assert.deepEqual(row, { twomass: '14294291-6240465', grade: 'A', raDegrees: 217.42925, decDegrees: -62.67963889, contaminated: false, nights: 600, points: 6009, fTest: 2893, rotationDays: 88.977, semiAmplitudeMag: 0.0073, semiAmplitudeErrorMag: 0.0067 });
  // Twice 0.0073 mag is 1.34% of the light.
  assert.equal(swingOf(0.0073), 0.013447);
  assert.deepEqual(NEWTON_2018.judge(row, [2016, 2017]), { verdict: { detected: true, periodDays: 88.977, amplitude: 0.013447 }, windows: [2016, 2017], gives: 88.977 });
  assert.equal(NEWTON_2018.says(row), 'a grade A rotation period of 88.977 d, with a sinusoid of semi-amplitude 0.0073 mag in the star\'s longest dataset, of 600 nights');
  assert.deepEqual(NEWTON_2018.measures(row), { rotationDays: 88.977, semiAmplitudeMag: 0.0073, semiAmplitudeErrorMag: 0.0067, nights: 600, points: 6009, fTest: 2893 });
  assert.equal(NEWTON_2018.judge(parseNewtonRow(ROWS.gradeB), []).verdict.periodDays, 106.804);
});

test('a candidate, a non-detection and a flagged rotator are no rotation', () => {
  const said = (cells: Readonly<Record<string, string>>) => NEWTON_2018.judge(parseNewtonRow(cells), [2017]);
  assert.match(said(ROWS.lhs3844).verdict.reason!, /non-detection/u); assert.deepEqual(said(ROWS.lhs3844).windows, []);
  // The candidate's period is in the table and is not read.
  assert.equal(parseNewtonRow(ROWS.candidate).rotationDays, undefined); assert.match(said(ROWS.candidate).verdict.reason!, /possible or uncertain detection/u);
  const flagged = said(ROWS.flagged); assert.equal(flagged.verdict.detected, false); assert.match(flagged.verdict.reason!, /33\.864 d \(grade A\) and flag its aperture as contaminated/u); assert.equal(flagged.gives, 33.864);
});

test('a row the table\'s description does not cover is refused', () => {
  assert.throws(() => parseNewtonRow({ ...ROWS.proxima, Type: 'C' }), /type "C"/u);
  assert.throws(() => parseNewtonRow({ ...ROWS.proxima, Flag: '2' }), /flag 2/u);
  assert.throws(() => parseNewtonRow({ ...ROWS.proxima, Per: '' }), /holds no Per/u);
  assert.throws(() => parseNewtonRow({ ...ROWS.proxima, twomass: 'Proxima' }), /2MASS designation/u);
  assert.throws(() => NEWTON_2018.parse([ROWS.proxima, ROWS.proxima]), /listed twice/u);
  assert.equal(NEWTON_2018.parse([ROWS.proxima, ROWS.lhs475]).get('19205439-8233170')!.rotationDays, 79.317);
  assert.match(String(NEWTON_2018.query), /"2MASS" AS twomass.*"F-test" AS ftest FROM "J\/AJ\/156\/217\/table1"/u); assert.deepEqual(MEARTH_PAPERS, [NEWTON_2018]); assert.deepEqual(NEWTON_2018.missions, ['MEarth']);
});

test('a star\'s row is the one at its J2000 place', () => {
  const rows = [ROWS.proxima, ROWS.lhs475].map(parseNewtonRow);
  assert.equal(rowAt(rows, { raDegrees: 217.4289, decDegrees: -62.6795 }, 3)!.twomass, '14294291-6240465');
  assert.equal(rowAt(rows, { raDegrees: 217.5, decDegrees: -62.6795 }, 3), undefined);
});

/** A light curve of one exposure a night for `nights` nights from `first`, in steps of `step` days. */
const light = (telescope: string, first: number, nights: number, step = 1): MearthLightCurve => { const bjd = Array.from({ length: nights }, (_, index) => first + step * index);
  return { telescope, filter: 'RG715', twomass: '19205439-8233170', bjd, magnitude: bjd.map(time => 0.0025 * Math.sin(2 * Math.PI * time / 79.317)), error: bjd.map(() => 0.004), segment: bjd.map(() => 1), commonMode: bjd.map(() => 0) }; };
/** A model that takes nothing off: the test's light has no baseline and no common mode. */
const asItIs = async (curve: MearthLightCurve) => ({ baselines: [0], commonModeScale: 0.7234, semiAmplitude: 0.0025, corrected: curve.magnitude });

test('a star is read on its longest dataset, cut at the paper\'s last day, one map a season that holds a turn', async () => {
  const row = parseNewtonRow(ROWS.lhs475), place = { raDegrees: 290.226, decDegrees: -82.5545 };
  // LHS 475 is in conjunction on 9 January. One telescope watched it from October 2016 to past the paper's last day; another for four nights.
  const files = [{ filename: 'a.txt', curve: light('tel18', 2457687.6, 600) }, { filename: 'b.txt', curve: light('tel11', 2457800.6, 4) }], read = await newtonStar(row, files, place, asItIs);
  assert.equal(read.filename, 'a.txt'); assert.deepEqual(read.file, { telescope: 'tel18', filter: 'RG715' });
  // 492 nights lie before 2 March 2018.
  assert.deepEqual(read.fitted, { datasetNights: 492, fittedSemiAmplitudeMag: 0.0025, commonModeScale: 0.7234 }); assert.ok(read.seasons.every(season => season.time.at(-1)! + 2450000 < NEWTON_2018_LAST_BJD));
  assert.deepEqual(read.seasons.map(season => [season.season, season.nights, season.turns, season.verdict.detected]), [[2016, 75, 0.93, false], [2017, 366, 4.6, true], [2018, 51, 0.63, false]]);
  assert.deepEqual(read.verdict, { detected: true, periodDays: 79.317, amplitude: swingOf(0.0025) });
  assert.match(read.seasons[0]!.verdict.reason!, /2016 season holds 74 days of its MEarth light, less than one turn of 79\.317 d/u);
  assert.equal(read.note, 'The light curve mapped is the star\'s longest dataset in the MEarth release, that of telescope 18: 492 nights before 2 March 2018, where the paper\'s table prints 235 for its longest. The paper\'s model, fitted to it here at 79.317 d by its authors\' code, gives the sinusoid a semi-amplitude of 0.0025 mag, where the table prints 0.0025. The star\'s 2016 and 2018 seasons hold less than one turn of it and have no map.');
});

test('a star none of whose seasons holds a turn has no map, and a row that is no verdict reads no light', async () => {
  const row = parseNewtonRow(ROWS.lhs475), place = { raDegrees: 290.226, decDegrees: -82.5545 };
  const read = await newtonStar(row, [{ filename: 'a.txt', curve: light('tel18', 2457687.6, 40) }], place, asItIs);
  assert.equal(read.verdict.detected, false); assert.match(read.verdict.reason!, /none of its seasons with MEarth holds a turn of it/u);
  await assert.rejects(newtonStar(parseNewtonRow(ROWS.flagged), [], place, asItIs), /no verdict of rotation/u);
  await assert.rejects(newtonStar(row, [{ filename: 'late.txt', curve: light('tel18', NEWTON_2018_LAST_BJD + 1, 40) }], place, asItIs), /no light of the star from before the paper's last day/u);
  await assert.rejects(newtonStar(row, [{ filename: 'other.txt', curve: { ...light('tel18', 2457687.6, 40), twomass: '14294291-6240465' } }], place, asItIs), /not of 19205439-8233170/u);
});
