import assert from 'node:assert/strict';
import { test } from 'node:test';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { GRAVITY_REDUCTION } from './calibrate-gravity.mts';
import { MATISSE_REDUCTION } from './calibrate-matisse.mts';
import { parseAssociationTree, reduceAssociation, type InstrumentReduction, type ReductionIo } from './eso-associations.mts';
import type { EsoHeader } from './eso-pipeline.mts';
import { binaryTable, numbers, readFitsHdus, tableColumn, text, type BinaryTable } from './fits-table.mts';

const fixture = (name: string) => resolve(import.meta.dirname, 'fixtures', name);
const repository = resolve(import.meta.dirname, '../../..');

/** A reduction planned against the archive's recorded tree and headers, with recipes that only name their products. */
async function plan(reduction: InstrumentReduction, prefix: string, dpId: string) {
  const tree = parseAssociationTree(await readFile(fixture(`${prefix}-associations.xml`), 'utf8'));
  const headers = JSON.parse(await readFile(fixture(`${prefix}-headers.json`), 'utf8')) as Record<string, EsoHeader>;
  const io: ReductionIo = {
    header: async name => { const header = headers[name]; if (!header) throw new Error(`no recorded header for ${name}`); return header; },
    frame: async name => name,
    kitFrame: async pattern => `kit:${pattern.source}`,
    run: async (step, _recipe, _frames, _options, categories) => categories.map(category => ({ category, path: `${step}/${category}_0002.fits` })),
  };
  return { tree, record: await reduceAssociation(reduction, tree, dpId, io) };
}
const framesOf = (record: Awaited<ReturnType<typeof plan>>['record'], step: string) => {
  const found = record.steps.find(candidate => candidate.step === step);
  assert.ok(found, `no step ${step}`);
  return found.frames.map(([file, tag]) => `${tag} ${file}`).sort();
};

test('the calselector tree parses into nested associations with their files and messages', async () => {
  const tree = parseAssociationTree(await readFile(fixture('gravity-2018-01-27-associations.xml'), 'utf8'));
  assert.equal(tree.category, 'SCI_SINGLE');
  assert.deepEqual(tree.files.map(file => file.category), ['SINGLE_SCI_RAW', 'SINGLE_SKY_RAW', 'SINGLE_SCI_RAW']);
  assert.deepEqual(tree.children.map(child => child.category), ['DISP_MODEL', 'DIAMETER_CAT', 'STATIC_PARAM', 'DIODE_POSITION', 'STD_SINGLE', 'DARK', 'DARK', 'P2VM']);
  assert.match(tree.messages[0]!, /Missing EOP_PARAM/u);
  assert.deepEqual(tree.children.at(-1)!.children.map(child => child.category), ['WAVE_PARAM', 'DARK']);
  assert.throws(() => parseAssociationTree('<association category="A"><mainFiles>'), /incomplete/u);
});

test('a GRAVITY plan takes the dark with the science integration time, the P2VM calibrations, and the nearest calibrator in the same mode', async () => {
  const { record } = await plan(GRAVITY_REDUCTION, 'gravity-2018-01-27', 'GRAVI.2018-01-27T05:30:10.657');
  assert.equal(record.calibrator, 'GRAVI.2018-01-27T05:57:43.726');
  assert.deepEqual(record.steps.map(step => `${step.recipe} ${step.step}`), [
    'gravity_dark dark-2018-01-27T10:33:32.425',
    'gravity_p2vm p2vm-2018-01-28T10:28:16.378',
    'gravity_vis sci_single-2018-01-27T05:30:10.657',
    'gravity_dark dark-2018-01-27T10:35:32.430',
    'gravity_vis std_single-2018-01-27T05:57:43.726',
    'gravity_viscal calibrate-2018-01-27T05:30:10.657',
  ]);
  // The same frames as the hand-built run whose calibrated file was compared with Rosales-Guzmán et al.'s.
  assert.deepEqual(framesOf(record, 'sci_single-2018-01-27T05:30:10.657'), [
    'BAD p2vm-2018-01-28T10:28:16.378/BAD_0002.fits', 'DARK dark-2018-01-27T10:33:32.425/DARK_0002.fits', 'DIAMETER_CAT M.GRAVITY.2017-03-29T11:53:36.950',
    'DIODE_POSITION M.GRAVITY.2020-06-10T12:25:23.506', 'DISP_MODEL M.GRAVITY.2020-06-10T12:25:24.786', 'EOP_PARAM kit:^GRAVI_EOP_PARAM\\..*\\.fits$',
    'FLAT p2vm-2018-01-28T10:28:16.378/FLAT_0002.fits', 'P2VM p2vm-2018-01-28T10:28:16.378/P2VM_0002.fits', 'SINGLE_SCI_RAW GRAVI.2018-01-27T05:30:10.657',
    'SINGLE_SKY_RAW GRAVI.2018-01-27T05:36:13.672', 'STATIC_PARAM M.GRAVITY.2020-06-10T12:25:39.386', 'WAVE p2vm-2018-01-28T10:28:16.378/WAVE_0002.fits',
  ]);
  const p2vm = framesOf(record, 'p2vm-2018-01-28T10:28:16.378');
  assert.equal(p2vm.length, 15);
  assert.ok(p2vm.includes('DARK_RAW GRAVI.2018-01-28T10:26:40.374') && p2vm.includes('STATIC_PARAM M.GRAVITY.2020-06-10T12:25:39.386'));
  assert.deepEqual(framesOf(record, 'calibrate-2018-01-27T05:30:10.657'), [
    'DIAMETER_CAT M.GRAVITY.2017-03-29T11:53:36.950', 'SINGLE_CAL_VIS std_single-2018-01-27T05:57:43.726/SINGLE_CAL_VIS_0002.fits', 'SINGLE_SCI_VIS sci_single-2018-01-27T05:30:10.657/SINGLE_SCI_VIS_0002.fits',
  ]);
  await assert.rejects(plan(GRAVITY_REDUCTION, 'gravity-2018-01-27', 'GRAVI.2018-01-27T05:36:13.672'), /no recorded header|is not a SINGLE_SCI_RAW/u);
});

test('a MATISSE plan takes the sky and calibrator in the science exposure\'s BCD state and reduces each shared calibration once', async () => {
  const { record } = await plan(MATISSE_REDUCTION, 'matisse-2020-02-08', 'MATIS.2020-02-08T00:06:12.142');
  assert.equal(record.calibrator, 'MATIS.2020-02-08T00:30:08.078');
  const names = record.steps.map(step => step.step);
  assert.equal(new Set(names).size, names.length);
  assert.deepEqual(names, [
    'est_flat-2020-02-08T10:15:53.136', 'est_flat-2020-02-10T13:24:51.412', 'est_flat-2020-02-18T14:05:04.815', 'est_shift-2020-02-18T15:03:23.314',
    'est_kappa-2020-02-10T13:33:50.157', 'target_raw-2020-02-08T00:06:12.142', 'calib_raw-2020-02-08T00:30:08.078', 'calibrate-2020-02-08T00:06:12.142',
  ]);
  assert.deepEqual(framesOf(record, 'target_raw-2020-02-08T00:06:12.142'), [
    'BADPIX M.MATISSE.2021-08-18T08:36:11.406', 'KAPPA_MATRIX est_kappa-2020-02-10T13:33:50.157/KAPPA_MATRIX_0002.fits', 'NONLINEARITY M.MATISSE.2021-08-18T08:36:17.383',
    'OBS_FLATFIELD est_flat-2020-02-08T10:15:53.136/OBS_FLATFIELD_0002.fits', 'SHIFT_MAP est_shift-2020-02-18T15:03:23.314/SHIFT_MAP_0002.fits',
    'SKY_RAW MATIS.2020-02-08T00:03:39.926', 'TARGET_RAW MATIS.2020-02-08T00:06:12.142',
  ]);
  assert.ok(framesOf(record, 'calib_raw-2020-02-08T00:30:08.078').includes('SKY_RAW MATIS.2020-02-08T00:27:14.348'));
  // The shift map's own flat uses the masters of its own epoch, not the night's.
  assert.ok(framesOf(record, 'est_flat-2020-02-18T14:05:04.815').includes('BADPIX M.MATISSE.2020-03-04T07:34:28.550'));
  assert.ok(record.steps.every(step => step.frames.every(([, tag]) => !tag.endsWith('RMNREC'))));
  assert.match(record.calibrated, /TARGET_CAL_INT_0002\.fits$/u);
  // A keyword the calibrator can never share (its DPR TYPE is STD, the science exposure's OBJECT) leaves no calibrator.
  const withoutMatch: InstrumentReduction = { ...MATISSE_REDUCTION, calibrator: { ...MATISSE_REDUCTION.calibrator, keys: [...MATISSE_REDUCTION.calibrator.keys, 'ESO DPR TYPE'] } };
  await assert.rejects(plan(withoutMatch, 'matisse-2020-02-08', 'MATIS.2020-02-08T00:06:12.142'), /No calibrator exposure matches/u);
});

/** Squared visibilities and closure phases of one instrument's tables, rows keyed by sorted station names. */
function observables(bytes: Buffer, insname?: string) {
  const tables = readFitsHdus(bytes).filter(hdu => hdu.header.XTENSION === 'BINTABLE').map(hdu => binaryTable(hdu));
  const pick = (extname: string) => {
    const matches = tables.filter(table => table.hdu.extname === extname && (!insname || table.hdu.header.INSNAME === insname));
    assert.equal(matches.length, 1, `${matches.length} ${extname} tables for ${insname}`);
    return matches[0]!;
  };
  const array = tables.find(table => table.hdu.extname === 'OI_ARRAY')!, names = new Map<number, string>();
  for (let row = 0; row < array.rows; row++) names.set(numbers(bytes, array, row, tableColumn(array, 'STA_INDEX'))[0]!, text(bytes, array, row, tableColumn(array, 'STA_NAME')).trim());
  const waves = pick('OI_WAVELENGTH'), wavelengths = Array.from({ length: waves.rows }, (_, row) => numbers(bytes, waves, row, tableColumn(waves, 'EFF_WAVE'))[0]!);
  const rows = (table: BinaryTable, value: string, closure: boolean) => Array.from({ length: table.rows }, (_, row) => {
    const stations = numbers(bytes, table, row, tableColumn(table, 'STA_INDEX')).map(index => names.get(index)!), sorted = [...stations].sort();
    // A closure triangle read in another station order changes sign for an odd permutation.
    let sign = 1;
    if (closure) { const order = stations.map(name => sorted.indexOf(name)); for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) if (order[i]! > order[j]!) sign = -sign; }
    const flags = numbers(bytes, table, row, tableColumn(table, 'FLAG'));
    return { key: sorted.join('-'), mjd: numbers(bytes, table, row, tableColumn(table, 'MJD'))[0]!, values: numbers(bytes, table, row, tableColumn(table, value)).map((v, i) => flags[i] ? Number.NaN : v * sign) };
  });
  return { wavelengths, vis2: rows(pick('OI_VIS2'), 'VIS2DATA', false), t3: rows(pick('OI_T3'), 'T3PHI', true) };
}
const interpolate = (xs: readonly number[], ys: readonly number[], x: number) => {
  const order = xs.map((_, i) => i).sort((a, b) => xs[a]! - xs[b]!), k = order.findIndex(i => xs[i]! >= x);
  if (k <= 0) return xs[order[0]!] === x ? ys[order[0]!]! : Number.NaN;
  const a = order[k - 1]!, b = order[k]!;
  return ys[a]! + (x - xs[a]!) / (xs[b]! - xs[a]!) * (ys[b]! - ys[a]!);
};
const median = (values: readonly number[]) => { const sorted = values.filter(Number.isFinite).sort((a, b) => a - b); return sorted[sorted.length >> 1]!; };

/** Per baseline, the median ratio of our squared visibility to the author's at the author's wavelengths; per triangle, the
 * median closure-phase difference in degrees. Rows pair by stations and the nearest time. */
async function compareWithAuthor(oursPath: string, authorPath: string, insname?: string) {
  const [ours, author] = (await Promise.all([readFile(oursPath), readFile(authorPath)])).map(bytes => observables(bytes, insname));
  const paired = (kind: 'vis2' | 't3') => author[kind].map(row => {
    const mine = ours[kind].filter(candidate => candidate.key === row.key).sort((a, b) => Math.abs(a.mjd - row.mjd) - Math.abs(b.mjd - row.mjd))[0];
    assert.ok(mine && Math.abs(mine.mjd - row.mjd) < 0.01, `no ${kind} row for ${row.key}`);
    return { key: row.key, pairs: author.wavelengths.map((wavelength, i) => [interpolate(ours.wavelengths, mine.values, wavelength), row.values[i]!] as const) };
  });
  return {
    ratios: paired('vis2').map(({ key, pairs }) => ({ key, median: median(pairs.map(([mine, theirs]) => mine / theirs)) })),
    closures: paired('t3').map(({ key, pairs }) => ({ key, median: median(pairs.map(([mine, theirs]) => ((mine - theirs + 540) % 360) - 180)) })),
  };
}
const present = (...paths: string[]) => Promise.all(paths.map(path => access(path).then(() => true, () => false))).then(all => all.every(Boolean));
