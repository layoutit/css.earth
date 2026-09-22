import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseApplycal, parseCalibrationRecord, requiredTables } from './alma-calibration.mts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const RECORD = resolve(root, 'tests/fixtures/alma/uid___A002_X10dde56_X29a8.ms.calapply.txt');

test('the calapply record ALMA ships is read as the applications it states', async () => {
  const applications = parseCalibrationRecord(await readFile(RECORD, 'utf8'));
  assert.equal(applications.length, 3);
  assert.deepEqual(applications.map(application => application.intent), ['PHASE', 'TARGET,CHECK', 'BANDPASS,AMPLITUDE']);
  const target = applications[1]!;
  assert.equal(target.field, 'R_Dor,J0525-5725');
  assert.equal(target.vis, 'uid___A002_X10dde56_X29a8.ms');
  assert.equal(target.spw, '25,27,29,31');
  // Every per-table argument belongs to its own table, so the order applycal takes them is preserved.
  assert.ok(target.tables.length >= 5);
  assert.ok(target.tables[0]!.gaintable.endsWith('.tsyscal.tbl'));
  assert.equal(target.tables[0]!.calwt, true);
  assert.ok(target.tables[0]!.spwmap.length > 0, 'the Tsys table maps spectral windows');
  assert.ok(target.tables.every(table => table.interp.length > 0 || table.gaintable.includes('ants')));
  // The tables are named once each for the caller to stage.
  const tables = requiredTables(applications);
  assert.equal(new Set(tables).size, tables.length);
  assert.ok(tables.some(name => name.includes('bandpass')));
});

test('a calapply line that states anything this route does not replay is refused', () => {
  const base = "applycal(vis='a.ms', field='F', intent='TARGET', spw='0', antenna='0~1', gaintable=['t.tbl'], gainfield=[''], spwmap=[[]], interp=['linear'], calwt=[True])";
  assert.equal(parseApplycal(base).tables.length, 1);
  assert.throws(() => parseApplycal(base.replace('calwt=[True]', 'calwt=[True], parang=True')), /does not replay/u);
  assert.throws(() => parseApplycal(base.replace("gaintable=['t.tbl']", "gaintable=['t.tbl','u.tbl']")), /differ in length/u);
  const empty = base.replace("gaintable=['t.tbl']", 'gaintable=[]').replace("gainfield=['']", 'gainfield=[]')
    .replace('spwmap=[[]]', 'spwmap=[]').replace("interp=['linear']", 'interp=[]').replace('calwt=[True]', 'calwt=[]');
  assert.throws(() => parseApplycal(empty), /names no calibration table/u);
  assert.throws(() => parseApplycal(base.replace("field='F', ", '')), /missing field/u);
  assert.throws(() => parseCalibrationRecord('flagdata(vis=\'a.ms\')'), /not an applycal call/u);
  assert.throws(() => parseCalibrationRecord('# nothing but a comment'), /applies no calibration/u);
  assert.throws(() => parseCalibrationRecord(`${base}\n${base.replace("vis='a.ms'", "vis='b.ms'")}`), /one measurement set/u);
});

test('quoted commas and nested lists survive the split', () => {
  const line = "applycal(vis='a.ms', field='X,Y', intent='TARGET,CHECK', spw='0,1', antenna='0~41', gaintable=['a.tbl','b.tbl'], gainfield=['X,Y','nearest'], spwmap=[[17,1,2],[]], interp=['linear,linear','nearest,linear'], calwt=[True,False])";
  const parsed = parseApplycal(line);
  assert.equal(parsed.field, 'X,Y');
  assert.deepEqual(parsed.tables[0]!.spwmap, [17, 1, 2]);
  assert.deepEqual(parsed.tables[1]!.spwmap, []);
  assert.equal(parsed.tables[0]!.interp, 'linear,linear');
  assert.equal(parsed.tables[1]!.calwt, false);
});

test('the pipeline’s line-free ranges are read, and rendered as one selection per window', async () => {
  const { parseContinuumRanges, continuumSelection } = await import('./alma-calibration.mts');
  const ranges = parseContinuumRanges(await readFile(resolve(root, 'tests/fixtures/alma/cont.dat'), 'utf8'));
  const star = ranges.get('R_Dor');
  assert.ok(star, 'the delivery names the science target');
  assert.equal(star!.length, 18);
  assert.deepEqual([...new Set(star!.map(range => range.spectralWindow))].sort((a, b) => a - b), [25, 27, 29, 31]);
  assert.ok(star!.every(range => range.frame === 'LSRK'));
  // Only a fifth of this band is line-free for this star; imaging all of it as continuum would fold its lines in.
  const width = star!.reduce((total, range) => total + (range.highGHz - range.lowGHz), 0);
  assert.ok(width > 1.6 && width < 1.8, `line-free width ${width} GHz`);
  const selection = continuumSelection(star!);
  assert.ok(selection.startsWith('25:455.38~455.65GHz;'));
  assert.equal(selection.split(',').length, 4);
  assert.ok(selection.includes('31:'));
});

test('a cont.dat this route cannot read is refused rather than imaged blindly', async () => {
  const { parseContinuumRanges, continuumSelection } = await import('./alma-calibration.mts');
  assert.throws(() => parseContinuumRanges(''), /names at least one field/u);
  assert.throws(() => parseContinuumRanges('Field: X\nSpectralWindow: 1\nnot a range\n'), /not a frequency range/u);
  assert.throws(() => parseContinuumRanges('Field: X\n1.0~2.0GHz LSRK\n'), /before its field and spectral window/u);
  assert.throws(() => parseContinuumRanges('Field: X\nSpectralWindow: 1\n2.0~1.0GHz LSRK\n'), /no increasing frequency range/u);
  // A window the pipeline marked as having no line-free channels contributes nothing rather than everything.
  const none = parseContinuumRanges('Field: X\nSpectralWindow: 1\nNONE\nSpectralWindow: 2\n3.0~4.0GHz LSRK\n');
  assert.equal(none.get('X')!.length, 1);
  assert.equal(continuumSelection(none.get('X')!), '2:3~4GHz');
  assert.throws(() => continuumSelection([]), /at least one range/u);
  assert.throws(() => continuumSelection([{ spectralWindow: 1, lowGHz: 1, highGHz: 2, frame: 'LSRK' }, { spectralWindow: 1, lowGHz: 3, highGHz: 4, frame: 'TOPO' }]), /mix reference frames/u);
});
