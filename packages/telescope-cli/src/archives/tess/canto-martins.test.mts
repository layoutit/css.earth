import assert from 'node:assert/strict';
import test from 'node:test';
import { CANTO_MARTINS, CANTO_MARTINS_2020, CANTO_MARTINS_TABLES, parseCantoMartinsRow } from './canto-martins.mts';
import { PUBLISHED } from './papers.mts';
import { keptAsPublished, publishedApart, type PublishedFinding } from './published.mts';
import { besideCatalogued } from './verdict.mts';

/** Rows of VizieR J/ApJS/250/20 as its table service printed them on 2026-10-07, each tagged with its table's place in
 * the entry's queries. Table 1: TOI-1775, HIP 65 A, HD 110082, TOI-1782, TOI-1807 and TIC 271900960. Table 2: WASP-77 A
 * and WASP-43. Tables 3, 4 and 5: TIC 4646810, TIC 1133072 and TIC 129979528. */
const ROWS = [
  { TIC: '9348006', Prot: '5.329', e_Prot: '0.592', tSPAN: '24', Ncyc: '4.5', table: '0' }, { TIC: '201248411', Prot: '13.219', e_Prot: '1.859', tSPAN: '47', Ncyc: '3.6', table: '0' },
  { TIC: '383390264', Prot: '2.149', e_Prot: '0.044', tSPAN: '52', Ncyc: '24.2', table: '0' }, { TIC: '160045097', Prot: '6.071', e_Prot: '0.709', tSPAN: '26', Ncyc: '4.3', table: '0' },
  { TIC: '180695581', Prot: '4.242', e_Prot: '0.391', tSPAN: '23', Ncyc: '5.4', table: '0' }, { TIC: '271900960', Prot: '1.606', e_Prot: '0.005', tSPAN: '285', Ncyc: '177.5', table: '0' },
  { TIC: '1129033', Prot1: '5.00', Prot2: '10.00', Prot3: '', tSPAN: '19', Ncyc: '1.9', table: '1' }, { TIC: '36734222', Prot1: '7.41', Prot2: '', Prot3: '', tSPAN: '19', Ncyc: '2.6', table: '1' },
  { TIC: '4646810', tSPAN: '21', table: '2' }, { TIC: '1133072', tSPAN: '15', table: '3' }, { TIC: '129979528', Ppul: '0.049', tSPAN: '17', table: '4' }] as const;

test('a row of Canto Martins et al.\'s tables is read as its columns print it, and its table is the paper\'s verdict', () => {
  const rows = CANTO_MARTINS_2020.parse(ROWS); assert.equal(rows.size, 11);
  assert.deepEqual(rows.get(9348006), { tic: 9348006, found: 'rotation', spanDays: 24, rotationDays: 5.329, rotationErrorDays: 0.592, cycles: 4.5 });
  assert.deepEqual(rows.get(1129033), { tic: 1129033, found: 'dubious', spanDays: 19, candidatesDays: [5, 10] }); assert.deepEqual(rows.get(36734222)!.candidatesDays, [7.41]);
  assert.deepEqual(rows.get(4646810), { tic: 4646810, found: 'ambiguous', spanDays: 21 }); assert.deepEqual(rows.get(129979528), { tic: 129979528, found: 'pulsation', spanDays: 17, pulsationDays: 0.049 });
  // The five tables are asked whole, each by the columns that are read: the sectors a row names are not among them.
  assert.deepEqual(CANTO_MARTINS_2020.query, ['SELECT TIC, Prot, e_Prot, tSPAN, Ncyc FROM "J/ApJS/250/20/table1"', 'SELECT TIC, Prot1, Prot2, Prot3, tSPAN, Ncyc FROM "J/ApJS/250/20/table2"',
    'SELECT TIC, tSPAN FROM "J/ApJS/250/20/table3"', 'SELECT TIC, tSPAN FROM "J/ApJS/250/20/table4"', 'SELECT TIC, Ppul, tSPAN FROM "J/ApJS/250/20/table5"']);
  assert.deepEqual(CANTO_MARTINS, { sectors: [1, 22], sectorDays: 28 }); assert.deepEqual(PUBLISHED.map(table => table.paper.id), ['colman-2024', 'canto-martins-2020']);
  // A row without its table, a target listed twice and a table of periods without one are refused.
  assert.throws(() => CANTO_MARTINS_2020.parse([{ TIC: '9348006', Prot: '5.329', tSPAN: '24', Ncyc: '4.5' }]), /does not say which table/u); assert.throws(() => CANTO_MARTINS_2020.parse([ROWS[0], ROWS[0]]), /TIC 9348006 is listed twice/u);
  assert.throws(() => parseCantoMartinsRow(CANTO_MARTINS_TABLES[0], { TIC: '9348006', tSPAN: '24', Ncyc: '4.5' }), /a row holds no Prot/u); assert.throws(() => parseCantoMartinsRow(CANTO_MARTINS_TABLES[3], { TIC: '1133072' }), /a row holds no tSPAN/u);
});

test('a row of Table 1 is the paper\'s verdict only when its time span says which of the star\'s sectors it covers', () => {
  const rows = CANTO_MARTINS_2020.parse(ROWS), row = (tic: number) => rows.get(tic)!;
  // TOI-1775 has one 2-minute sector among 1 to 22, sector 21: the 24 days the paper analysed are its light. Sector 48 is not the paper's.
  assert.deepEqual(CANTO_MARTINS_2020.judge(row(9348006), [21, 48]), { verdict: { detected: true, periodDays: 5.329 }, windows: [21], gives: 5.329 });
  assert.equal(CANTO_MARTINS_2020.says(row(9348006)), 'a rotation period of 5.329 ± 0.592 d, the peak of the wavelet\'s global spectrum of 24 days of the star\'s light in sectors 1 to 22 (4.5 cycles), which the paper lists among its unambiguous rotation periods');
  assert.deepEqual(CANTO_MARTINS_2020.measures(row(9348006)), { rotationDays: 5.329, rotationErrorDays: 0.592, spanDays: 24, cycles: 4.5 });
  // HIP 65 A's 47 days and HD 110082's 52 are more than one sector holds: both of each star's two sectors were analysed.
  assert.deepEqual(CANTO_MARTINS_2020.judge(row(201248411), [1, 2, 28, 29, 68]), { verdict: { detected: true, periodDays: 13.219 }, windows: [1, 2], gives: 13.219 });
  assert.deepEqual(CANTO_MARTINS_2020.judge(row(383390264), [12, 13, 27, 38, 39, 65, 66, 93]).windows, [12, 13]);
  // TOI-1782's 26 days are one of its four sectors among 1 to 22, and the table does not say which.
  const one = CANTO_MARTINS_2020.judge(row(160045097), [14, 20, 21, 22, 41]); assert.deepEqual(one.windows, []);
  assert.match(one.verdict.reason!, /^Canto Martins et al\. \(2020\) list the star with an unambiguous rotation period of 6\.071 d, in 26 days of its light in sectors 1 to 22, and their table does not say which sectors those are: the star has 4 there \(14, 20, 21, 22\), and 3 of them could hold that span\.$/u);
  // A span longer than the star's sectors hold is not their light, and a star with no sector there has none the paper judged.
  assert.match(CANTO_MARTINS_2020.judge(row(271900960), [4]).verdict.reason!, /in 285 days of its light in sectors 1 to 22: more than the star's one sector there \(4\) holds, at 28 days a sector\.$/u);
  assert.match(CANTO_MARTINS_2020.judge(row(9348006), [48, 75]).verdict.reason!, /the star has no 2-minute light curve there\.$/u);
  // The other tables are the paper's verdict too: no rotation with one period.
  assert.match(CANTO_MARTINS_2020.judge(row(1129033), [4]).verdict.reason!, /among the 32 with a dubious rotation period \(5 or 10 d\).*does not give one period for it\.$/u);
  assert.match(CANTO_MARTINS_2020.judge(row(4646810), [4]).verdict.reason!, /among the 109 with ambiguous variability/u); assert.match(CANTO_MARTINS_2020.judge(row(1133072), [8]).verdict.reason!, /among the 714 whose light curves are noisy/u);
  assert.match(CANTO_MARTINS_2020.judge(row(129979528), [18]).verdict.reason!, /among the 10 that pulsate, with a period of 0\.049 d/u);
});

test('a paper\'s verdict is drawn at the paper\'s period or not at all, and two papers apart give none', () => {
  const rows = CANTO_MARTINS_2020.parse(ROWS), KELT = { days: 15.7332, source: 'VizieR J/AJ/155/39/table6 (Variability properties of TIC sources with KELT), column Prot: 15.7332 d, the row 0.0 arcsec from the star\'s J2000 place' },
    OWN = { days: 5.329, source: 'VizieR J/ApJS/250/20/table1 (Rotation periods in TESS objects of interest (TOIs)), column Prot: 5.329 d, the row 0.0 arcsec from the star\'s J2000 place' };
  const checked = (tic: number, windows: readonly number[], adopted?: number, catalogued: readonly typeof KELT[] = []) => { const said = CANTO_MARTINS_2020.judge(rows.get(tic)!, windows).verdict; return keptAsPublished(CANTO_MARTINS_2020, said, besideCatalogued(said, adopted), adopted, catalogued); };
  // HIP 65 A: the catalogues print 13.2 d, the paper's 13.219 d within 20%. A star with no catalogued period but the paper's own keeps the paper's.
  assert.deepEqual(checked(201248411, [1, 2], 13.2), { detected: true, periodDays: 13.219 }); assert.deepEqual(checked(9348006, [21], undefined, [OWN]), { detected: true, periodDays: 5.329 });
  // TOI-1807: the paper's 4.242 d is half the 8.8 d the catalogues print. A period measured here would be doubled; a paper's is withheld.
  assert.deepEqual(checked(180695581, [22, 23], 8.8), { detected: false, reason: 'Canto Martins et al. (2020, ApJS 250, 20) list the star with a rotation period of 4.242 d, half the 8.8 d its record holds from the catalogues: the two published periods differ, and the paper\'s verdict is not drawn at a period it does not give.' });
  // Neither the catalogued period nor its half: withheld with the catalogue check's own sentence.
  assert.equal(checked(9348006, [21], 13.659).reason, 'Canto Martins et al. (2020, ApJS 250, 20) list the star with a rotation period of 5.329 d. The light\'s period, 5.329 d, is neither the star\'s catalogued rotation period, 13.659 d, nor its half.');
  // TOI-1775 as its record is: the paper's 5.329 d and 15.7332 d from the ground, and no period adopted between them. The paper's is one of the two.
  assert.deepEqual(checked(9348006, [21], undefined, [KELT, OWN]), { detected: false, reason: 'Canto Martins et al. (2020, ApJS 250, 20) list the star with a rotation period of 5.329 d, and its record holds 15.7332 d from another table (VizieR J/AJ/155/39/table6): the two published periods differ, the record adopts neither, and neither is drawn.' });
  // A period from another table within 20% of the paper's withholds nothing.
  assert.equal(checked(9348006, [21], undefined, [{ ...KELT, days: 5.5 }, OWN]).detected, true);
  // Two papers that print a star periods more than 20% apart: neither is taken, whether or not each row is a verdict here. Within 20%, or with one that prints none, nothing is said.
  const finding = (citation: string, gives?: number): PublishedFinding => ({ paper: { ...CANTO_MARTINS_2020, citation }, row: {}, judgement: { verdict: { detected: false, reason: 'none' }, windows: [], ...(gives === undefined ? {} : { gives }) }, says: '', measures: {} });
  assert.equal(publishedApart([finding('A et al. (2024)', 10.51), finding('B et al. (2020)', 13.219)]), 'A et al. (2024) list the star with a rotation period of 10.51 d and B et al. (2020) with one of 13.219 d: the two papers differ, and neither period is taken.');
  assert.equal(publishedApart([finding('A', 8.68), finding('B', 8.189)]), undefined); assert.equal(publishedApart([finding('A', 8.68), finding('B')]), undefined); assert.equal(publishedApart([finding('A', 8.68)]), undefined);
  // A row whose light cannot be told still prints its period, and a row of another table prints none.
  assert.equal(CANTO_MARTINS_2020.judge(rows.get(160045097)!, [14, 20, 21, 22]).gives, 6.071); assert.equal(CANTO_MARTINS_2020.judge(rows.get(1129033)!, [4]).gives, undefined);
});
