import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCalibrationRecord } from './alma-calibration.mts';
import { pipelineImaging } from './alma-imaging.mts';
import { parseSelfCalibration } from './alma-selfcal.mts';
import { applycalStatement, pipelineFlagVersion, restoreScript } from './alma-restore.mts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const record = () => readFile(resolve(root, 'tests/fixtures/alma/uid___A002_X10dde56_X29a8.ms.calapply.txt'), 'utf8');
const fixture = (name: string) => readFile(resolve(root, 'tests/fixtures/alma', name), 'utf8');
const imaging = async () => pipelineImaging(await fixture('casa_commands.tclean.log'), 'R_Dor');
const selfcal = async () => parseSelfCalibration(JSON.parse(await fixture('selfcal.json')));
const plan = { target: 'R_Dor', scienceWindows: '25,27,29,31' };

test('an applycal statement restates the record, table for table', async () => {
  const [phase] = parseCalibrationRecord(await record());
  const statement = applycalStatement(phase!, 'x.ms');
  // The record's intent is the pipeline's name, translated against the measurement set's own states when the script runs.
  assert.ok(statement.startsWith("applycal(vis='x.ms', field='J0516-6207', intent=casa_intent('x.ms', 'PHASE')"));
  // The per-table arguments stay parallel lists in applycal's own order.
  for (const name of ['gaintable=[', 'gainfield=[', 'spwmap=[[', 'interp=[', 'calwt=[']) assert.ok(statement.includes(name), name);
  assert.equal(statement.match(/\.tbl'/gu)?.length, phase!.tables.length);
  assert.ok(statement.includes('flagbackup=False'), 'the flag state is the restored one, not one this route writes');
  // A quote inside a field name cannot break out of the generated Python.
  const injected = { ...phase!, field: "it's" };
  assert.ok(applycalStatement(injected, 'x.ms').includes("field='it\\'s'"));
});

test('the restore script performs import, flags, every application, the targets split and imaging, in that order', async () => {
  const script = restoreScript({ asdm: '/raw/uid___A002_X1', visibilities: 'uid___A002_X1.ms', applications: parseCalibrationRecord(await record()),
    flagVersion: 'Pipeline_Final', plan, imaging: await imaging(), selfcal: null, imageBase: '/work/R_Dor.restored' });
  const order = ['importasdm(', "mode='restore'", 'PHASE', 'TARGET,CHECK', 'BANDPASS,AMPLITUDE', 'mstransform(', 'tclean(', 'exportfits('];
  let cursor = -1;
  for (const marker of order) {
    const at = script.indexOf(marker, cursor + 1);
    assert.ok(at > cursor, `${marker} comes after what precedes it`);
    cursor = at;
  }
  // The import takes hifa_restoredata's own arguments, not the manual calibration script's.
  assert.ok(script.includes("ocorr_mode='ca'") && script.includes('bdfflags=True') && script.includes('lazy=True'));
  assert.ok(script.includes('CalPointing') && !script.includes('CorrelatorMode'));
  // The calibration is applied the way the pipeline applied it, which the calapply record does not state.
  assert.equal(script.match(/applymode='calflagstrict'/gu)?.length, 3);
  // The split keeps the window numbering, because the self-calibration maps are indexed by absolute window id.
  assert.ok(script.includes('reindex=False') && script.includes("spw='25,27,29,31'"));
  assert.ok(script.includes("intent='OBSERVE_TARGET#ON_SOURCE'"));
  // A measurement set left by an interrupted import is removed, never reused, and the full set goes once the target is split.
  assert.ok(script.indexOf("shutil.rmtree(stale") < script.indexOf('importasdm('));
  const removed = script.indexOf("os.remove(imported); os.remove(calibrated); shutil.rmtree('uid___A002_X1.ms')");
  assert.ok(removed > script.indexOf('mstransform(') && removed < script.indexOf('tclean('));
  assert.ok(script.indexOf('disk_usage') < script.indexOf('importasdm('), 'the scratch disk is checked before anything is written');
});

test('both measurement sets are written to the scratch disk, the calibration tables stay where they were unpacked', async () => {
  const script = restoreScript({ asdm: '/raw/x', visibilities: 'x.ms', applications: parseCalibrationRecord(await record()),
    flagVersion: 'Pipeline_Final', plan, imaging: await imaging(), selfcal: null, imageBase: '/work/x', scratch: '/fast' });
  assert.ok(script.includes("importasdm(asdm='/raw/x', vis='/fast/x.ms'"));
  assert.ok(script.includes("mstransform(vis='/fast/x.ms', outputvis='/fast/R_Dor.targets.ms'"));
  assert.ok(script.includes("tclean(vis='/fast/R_Dor.targets.ms'"));
  assert.ok(!script.includes("gaintable=['/fast/"), 'caltables are resolved from the working directory, not the scratch disk');
  // The delivered flag versions are staged under the bare name, whatever disk the measurement set is on.
  assert.ok(script.includes("os.path.join('.', 'x.ms.flagversions'), '/fast/x.ms.flagversions')"));
  // Only an import that wrote its marker is reused.
  assert.ok(script.indexOf("open(imported, 'w')") > script.indexOf('importasdm('));
  assert.ok(script.indexOf("if not os.path.exists(imported):") < script.indexOf('importasdm('));
  // A finished calibration is not repeated, and the flags are never restored over it.
  const guard = script.indexOf('if not os.path.exists(calibrated):');
  assert.ok(guard < script.indexOf("mode='restore'") && script.indexOf("open(calibrated, 'w')") < script.indexOf('mstransform('));
  assert.ok(/\n    applycal\(/u.test(script), 'every applycal sits inside the calibration guard');
});

test('imaging follows the pipeline\u2019s own call rather than a plausible guess', async () => {
  const script = restoreScript({ asdm: '/raw/x', visibilities: 'x.ms', applications: parseCalibrationRecord(await record()),
    flagVersion: 'Pipeline_Final', plan, imaging: await imaging(), selfcal: null, imageBase: '/work/x' });
  assert.ok(script.includes("deconvolver='mtmfs', nterms=2"), 'this delivery used mtmfs, whatever the general rule says');
  assert.ok(script.includes("cell='0.0055arcsec'") && script.includes('imsize=[3200, 3200]'));
  assert.ok(script.includes("threshold='0.000949Jy'") && script.includes("weighting='briggs', robust=0.5"));
  assert.ok(script.includes("scan='9,11,13,15,22,24,26,30,33,37'"), 'the scan selection is one string, not the first of ten');
  // The channels imaged are the pipeline's frame-converted ranges, never cont.dat's LSRK numbers.
  assert.ok(script.includes('455.3506751226~455.6221594976GHz'));
  assert.ok(!script.includes('455.38~455.65GHz'));
});

test('self-calibration is applied as its record states, with the map that spreads one solution over every window', async () => {
  const solutions = await selfcal();
  const script = restoreScript({ asdm: '/raw/x', visibilities: 'x.ms', applications: parseCalibrationRecord(await record()),
    flagVersion: 'Pipeline_Final', plan, imaging: await imaging(), selfcal: solutions, tableDirectory: '/aux/sc', imageBase: '/work/x' });
  assert.ok(script.includes("applymode='calflag'"), 'the record says calflag; calonly would let unsolved data through unflagged');
  assert.ok(script.includes("interp=['linearPD', 'linearPD']"));
  assert.ok(script.includes('/aux/sc/Target_R_Dor_'), 'the tables are addressed where the delivery put them');
  assert.ok(script.includes('calwt=False'));
  // The second table's map is 32 entries of one window; the first table needs none.
  assert.ok(/spwmap=\[\[\], \[25, 25, /u.test(script));
  assert.ok(script.includes("mstransform(vis='x.ms', outputvis='R_Dor.targets.ms'"));
  assert.ok(script.indexOf('/aux/sc/Target_R_Dor_') > script.indexOf("outputvis='R_Dor.targets.ms'"));
  assert.ok(script.indexOf('/aux/sc/Target_R_Dor_') < script.indexOf('tclean('));
  assert.ok(script.includes("tclean(vis='R_Dor.targets.ms'"));
});

test('a delivery whose self-calibration did not succeed is imaged without it', async () => {
  const solutions = { ...(await selfcal()), succeeded: false };
  const script = restoreScript({ asdm: '/raw/x', visibilities: 'x.ms', applications: parseCalibrationRecord(await record()),
    flagVersion: 'Pipeline_Final', plan, imaging: await imaging(), selfcal: solutions, imageBase: '/work/x' });
  assert.ok(script.includes('no self-calibration applied'));
  // The shipped calibration still carries its own spectral-window maps; it is the self-calibration tables that are absent.
  assert.ok(!script.includes('Target_R_Dor_'));
  assert.ok(script.includes("tclean(vis='R_Dor.targets.ms'"), 'the targets split is still what gets imaged');
  assert.equal(pipelineFlagVersion([]), null);
  assert.equal(pipelineFlagVersion(['Original', 'Pipeline_Final']), 'Pipeline_Final');
  assert.equal(pipelineFlagVersion(['Original', 'statwt_1']), 'statwt_1');
});
