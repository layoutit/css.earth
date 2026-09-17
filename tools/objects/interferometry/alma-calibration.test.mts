import assert from 'node:assert/strict';
import { test } from 'node:test';
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
