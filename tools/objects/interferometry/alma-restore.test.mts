import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCalibrationRecord } from './alma-calibration.mts';
import { applycalStatement, pipelineFlagVersion, restoreScript } from './alma-restore.mts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const record = () => readFile(resolve(root, 'tests/fixtures/alma/uid___A002_X10dde56_X29a8.ms.calapply.txt'), 'utf8');

test('an applycal statement restates the record, table for table', async () => {
  const [phase] = parseCalibrationRecord(await record());
  const statement = applycalStatement(phase!, 'x.ms');
  assert.ok(statement.startsWith("applycal(vis='x.ms', field='J0516-6207', intent='PHASE'"));
  // The per-table arguments stay parallel lists in applycal's own order.
  for (const name of ['gaintable=[', 'gainfield=[', 'spwmap=[[', 'interp=[', 'calwt=[']) assert.ok(statement.includes(name), name);
  assert.equal(statement.match(/\.tbl'/gu)?.length, phase!.tables.length);
  assert.ok(statement.includes('flagbackup=False'), 'the flag state is the restored one, not one this route writes');
  // A quote inside a field name cannot break out of the generated Python.
  const injected = { ...phase!, field: "it's" };
  assert.ok(applycalStatement(injected, 'x.ms').includes("field='it\\'s'"));
});

test('the restore script performs import, flags, every application, split and imaging, in that order', async () => {
  const applications = parseCalibrationRecord(await record());
  const script = restoreScript({ asdm: '/raw/uid___A002_X1', visibilities: 'uid___A002_X1.ms', applications,
    flagVersion: 'Pipeline_Final', plan: { target: 'R_Dor', cellArcseconds: 0.006, imageSize: 512, spw: '' }, imageBase: '/work/R_Dor.restored' });
  const order = ['importasdm(', "mode='restore'", ...applications.map(a => `intent='${a.intent}'`), 'split(', 'tclean(', 'exportfits('];
  let cursor = -1;
  for (const marker of order) {
    const at = script.indexOf(marker, cursor + 1);
    assert.ok(at > cursor, `${marker} comes after what precedes it`);
    cursor = at;
  }
  assert.ok(script.includes("ocorr_mode='ca'"), 'the ASDM is imported the way the pipeline imports it');
  assert.ok(script.includes("datacolumn='corrected'"), 'the split takes the calibrated column');
  assert.ok(script.includes("cell='0.006arcsec'") && script.includes('imsize=512'));
  // An import that already ran is not repeated: the measurement set is the expensive product.
  assert.ok(script.includes("if not os.path.exists('uid___A002_X1.ms'):"));
});

test('a run without a saved flag version says so instead of restoring one that is not there', async () => {
  const applications = parseCalibrationRecord(await record());
  const script = restoreScript({ asdm: '/raw/x', visibilities: 'x.ms', applications, flagVersion: null,
    plan: { target: 'R_Dor', cellArcseconds: 0.006, imageSize: 512, spw: '' }, imageBase: '/work/x' });
  assert.ok(!script.includes("mode='restore'"));
  assert.ok(script.includes('no flag version restored'));
  assert.equal(pipelineFlagVersion([]), null);
  assert.equal(pipelineFlagVersion(['Original', 'Pipeline_Final']), 'Pipeline_Final');
  assert.equal(pipelineFlagVersion(['Original', 'statwt_1']), 'statwt_1');
});
