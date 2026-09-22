import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { GRAVITY_REDUCTION } from './calibrate-gravity.mts';
import { MATISSE_REDUCTION } from './calibrate-matisse.mts';
import { archiveFrameId, parseAssociationTree, reduceAssociation, stepFiles, type InstrumentReduction, type ReductionIo } from './eso-associations.mts';
import { parseHeaderCards, type EsoHeader } from './eso-pipeline.mts';
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
  assert.deepEqual(record.calibrators, ['GRAVI.2018-01-27T05:57:43.726']);
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
  // A chosen calibrator must head its own calibrator association: the science tree is refused.
  const headers = JSON.parse(await readFile(fixture('gravity-2018-01-27-headers.json'), 'utf8')) as Record<string, EsoHeader>;
  const tree = parseAssociationTree(await readFile(fixture('gravity-2018-01-27-associations.xml'), 'utf8'));
  await assert.rejects(reduceAssociation(GRAVITY_REDUCTION, tree, 'GRAVI.2018-01-27T05:30:10.657', {
    header: async name => headers[name]!, frame: async name => name, kitFrame: async pattern => pattern.source,
    run: async (step, _recipe, _frames, _options, categories) => categories.map(category => ({ category, path: `${step}/${category}` })),
  }, [{ tree, dpId: 'GRAVI.2018-01-27T05:42:19.687' }]), /heads a SCI_SINGLE association, not STD_SINGLE/u);
});

test('a MATISSE plan takes the sky and calibrator in the science exposure\'s BCD state and reduces each shared calibration once', async () => {
  const { record } = await plan(MATISSE_REDUCTION, 'matisse-2020-02-08', 'MATIS.2020-02-08T00:06:12.142');
  assert.deepEqual(record.calibrators, ['MATIS.2020-02-08T00:30:08.078']);
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

test('GRAVITY calibrated from raw frames with the authors\' calibrator exposures reproduces Rosales-Guzmán et al.\'s file', async context => {
  const ours = resolve(repository, 'output/calibration/rcar-2018-01-27/calibrate-2018-01-27T05:30:10.657/GRAVI.2018-01-27T05:30:10.657_singlescivis_singlesciviscalibrated.fits');
  const author = resolve(repository, 'output/calibration/oracles/p1_GRAVI.2018-01-27T05_30_10.657_singlescivis_singlesciviscalibrated.fits');
  if (!await present(ours, author)) {
    context.skip('run calibrate-gravity.mts GRAVI.2018-01-27T05:30:10.657 with --calibrator for 06:51:37.863, 07:02:58.891, 07:56:08.026 and 08:07:26.055, and restore the OiDB file, to cover this');
    return;
  }
  const { ratios, closures } = await compareWithAuthor(ours, author, 'GRAVITY_SC_P1');
  for (const { key, median } of ratios) context.diagnostic(`V² ${key}: median ratio ${median.toFixed(3)}`);
  for (const { key, median } of closures) context.diagnostic(`closure ${key}: median difference ${median.toFixed(2)} degrees`);
  assert.equal(ratios.length, 6);
  // Measured with GRAVITY 1.11.0 against the authors' 1.0.7: all points 0.994, baselines 0.96 to 1.12 (the high two where V² is
  // below 0.02), closure phases within 0.2 degree on every triangle. The archive tree's own calibrator exposure alone gave 0.955.
  assert.ok(Math.abs(median(ratios.map(ratio => ratio.median)) - 1) < 0.05, 'median of the baseline ratios');
  for (const { key, median: ratio } of ratios) assert.ok(Math.abs(ratio - 1) < 0.2, `${key}: median ratio ${ratio.toFixed(3)}`);
  for (const { key, median: difference } of closures) assert.ok(Math.abs(difference) < 3, `${key}: closure difference ${difference.toFixed(2)} degrees`);
});

test('MATISSE calibrated from raw frames reproduces the IN-IN exposure of Drevon et al.\'s Betelgeuse file', async context => {
  // The calibrated file of the first MATISSE run: the same recipes, default settings and frames the plan test above selects, run by
  // hand before the tool existed (its target step also read the JSDC catalogue, which only a calibrator uses).
  const oursPath = resolve(repository, 'output/calibration-probe/matisse/work/cal-oifits/TARGET_CAL_INT_0002.fits');
  const authorPath = resolve(repository, 'src/objects/betelgeuse/source/observations/oifits/2020-02-08T000149_alfOri_A0B2D0C1_IR-LM_MED_IN_IN_noChop_cal_oifits_0.fits');
  if (!await present(oursPath, authorPath)) { context.skip('run calibrate-matisse.mts MATIS.2020-02-08T00:06:12.142 into that path and restore the Betelgeuse sources to cover this'); return; }
  const { ratios, closures } = await compareWithAuthor(oursPath, authorPath);
  for (const { key, median } of closures) context.diagnostic(`closure ${key}: median difference ${median.toFixed(2)} degrees`);
  assert.equal(ratios.length, 6);
  // Measured with MATISSE 2.5.0 defaults against the authors' 1.5.1/1.6.0 reduction. On B2-C1, the one baseline where V² is high
  // (0.50), the median ratio is 1.048. The other five have V² below 0.03, where ratios mean little: there the median difference
  // runs from −0.0052 (B2-D0) to +0.0025 (C1-D0). Closure phases differ by at most 2 degrees per triangle. Removing the channel
  // bias subtraction (cb), which the authors did not use, changed none of these.
  const author = observables(await readFile(authorPath));
  const mine = observables(await readFile(oursPath));
  for (const row of author.vis2) {
    const match = mine.vis2.find(candidate => candidate.key === row.key)!;
    const pairs = author.wavelengths.map((wavelength, i) => [interpolate(mine.wavelengths, match.values, wavelength), row.values[i]!] as const).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
    const level = median(pairs.map(([, theirs]) => theirs));
    context.diagnostic(`V² ${row.key} at ${level.toFixed(4)}: median difference ${median(pairs.map(([ours, theirs]) => ours - theirs)).toFixed(4)}`);
    if (level > 0.1) assert.ok(Math.abs(median(pairs.map(([ours, theirs]) => ours / theirs)) - 1) < 0.1, `${row.key}: ratio`);
    else assert.ok(Math.abs(median(pairs.map(([ours, theirs]) => ours - theirs))) < 0.01, `${row.key}: difference at V² ${level.toFixed(4)}`);
  }
  for (const { key, median: difference } of closures) assert.ok(Math.abs(difference) < 3, `${key}: closure difference ${difference.toFixed(2)} degrees`);
});

test('archive header text reads through the shared FITS reader, one line per card however wide', () => {
  const lines = ['SIMPLE  =                T / Standard FITS', "HIERARCH ESO TPL NAME = 'DARK - Woll: IN, Grism: HIGH, DET1: 0.7000000, DET2: 30' / ",
    "HIERARCH ESO DET CLDC1 DCNM16 = 'DC16_RelaySwitchLowActive' / Name of bias voltage", 'HIERARCH ESO DET CHIP PXSPACE= 3.000e-05 / Pixel-Pixel Spacing', 'END'];
  const header = parseHeaderCards(lines);
  assert.equal(header['ESO TPL NAME'], 'DARK - Woll: IN, Grism: HIGH, DET1: 0.7000000, DET2: 30');
  assert.equal(header['ESO DET CLDC1 DCNM16'], 'DC16_RelaySwitchLowActive');
  assert.equal(header['ESO DET CHIP PXSPACE'], 3e-5);
  assert.throws(() => parseHeaderCards([`HIERARCH ESO TPL NAME = 'unterminated`, 'END']), /Unterminated/);
  assert.throws(() => parseHeaderCards(lines.slice(0, -1)), /END/);
  assert.throws(() => parseHeaderCards([lines[0]!, lines[0]!, 'END']), /Duplicate/);
});

test('archive frames are identified by name, so a discarded exposure does not rerun its step; products by size and time', async () => {
  const { mkdtemp, writeFile, utimes, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const raw = await mkdtemp(resolve(tmpdir(), 'raw-')), product = resolve(raw, 'products', 'OBS_FLATFIELD.fits');
  await (await import('node:fs/promises')).mkdir(resolve(raw, 'products'));
  const exposure = resolve(raw, 'MATIS.2020-02-08T00:07:36.150.fits'), master = resolve(raw, 'M.MATISSE.2021-08-18T08:36:11.406.fits');
  assert.equal(archiveFrameId(exposure, raw), 'MATIS.2020-02-08T00:07:36.150');
  assert.equal(archiveFrameId(master, raw), 'M.MATISSE.2021-08-18T08:36:11.406');
  assert.equal(archiveFrameId(product, raw), undefined, 'a product in a subfolder is not an archive frame');
  assert.equal(archiveFrameId(resolve(raw, 'MATIS.2020-02-08T00:07:36.150.fits.download'), raw), undefined);
  await writeFile(product, 'flat');
  const frames = [[exposure, 'TARGET_RAW'], [product, 'OBS_FLATFIELD']] as const;
  const before = JSON.stringify(await stepFiles(frames, raw));
  // The exposure was never downloaded (or was discarded): its identity does not need the file.
  assert.equal(JSON.stringify(await stepFiles(frames, raw)), before);
  await utimes(product, new Date(), new Date(Date.now() + 60_000));
  assert.notEqual(JSON.stringify(await stepFiles(frames, raw)), before, 'a rewritten product invalidates the step');
  await rm(raw, { recursive: true, force: true });
  assert.deepEqual(MATISSE_REDUCTION.discardRaw, ['TARGET_RAW', 'CALIB_RAW']);
});
