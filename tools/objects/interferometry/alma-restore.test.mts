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

test('self-calibration and the line-free selection are used when the delivery carries them', async () => {
  const applications = parseCalibrationRecord(await record());
  const base = { asdm: '/raw/x', visibilities: 'x.ms', applications, flagVersion: 'Pipeline_Final', imageBase: '/work/x' };
  const plain = restoreScript({ ...base, plan: { target: 'R_Dor', cellArcseconds: 0.0055, imageSize: 1024, spw: '' } });
  assert.ok(plain.includes('no self-calibration applied'));
  assert.ok(plain.includes("tclean(vis='R_Dor.split.ms'"), 'without self-calibration the split is imaged');
  const withBoth = restoreScript({ ...base, plan: { target: 'R_Dor', cellArcseconds: 0.0055, imageSize: 1024,
    spw: '25:455.38~455.65GHz,27:458.55~458.58GHz', selfcalTables: ['/aux/sc/a_p.g', '/aux/sc/b_p.g'] } });
  assert.ok(withBoth.includes("spw='25:455.38~455.65GHz,27:458.55~458.58GHz'"), 'the split takes the line-free channels');
  assert.ok(withBoth.includes("applymode='calonly'"), 'self-calibration corrects without flagging what it cannot solve');
  assert.ok(withBoth.includes("tclean(vis='R_Dor.selfcal.ms'"), 'the self-calibrated data is what gets imaged');
  // Self-calibration comes after the shipped calibration and before imaging.
  assert.ok(withBoth.indexOf('/aux/sc/a_p.g') > withBoth.lastIndexOf("intent='"));
  assert.ok(withBoth.indexOf('/aux/sc/a_p.g') < withBoth.indexOf('tclean('));
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
