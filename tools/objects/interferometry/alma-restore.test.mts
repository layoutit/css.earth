import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCalibrationRecord } from './alma-calibration.mts';
import { pipelineImaging } from './alma-imaging.mts';
import { parseSelfCalibration } from './alma-selfcal.mts';
import { applycalStatement, pipelineTcleanArguments, restoreScript, type ReplayedFlags } from './alma-restore.mts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const record = () => readFile(resolve(root, 'tests/fixtures/alma/uid___A002_X10dde56_X29a8.ms.calapply.txt'), 'utf8');
const fixture = (name: string) => readFile(resolve(root, 'tests/fixtures/alma', name), 'utf8');
const imaging = async () => pipelineImaging(await fixture('casa_commands.tclean.log'), 'R_Dor');
const selfcal = async () => parseSelfCalibration(JSON.parse(await fixture('selfcal.json')));
const plan = { target: 'R_Dor', scienceWindows: '25,27,29,31' };

const flags: ReplayedFlags = { commandFile: '/work/weblog/x.ms.flagcmds.txt', tbuff: [0.96, 1.008],
  inline: ["spw='25' antenna='DV03' reason='nmedian'"], expected: { '25': { DV03: 1, DA41: 2 / 41 } } };

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
    flags, plan, imaging: await imaging(), selfcal: null, imageBase: '/work/R_Dor.restored' });
  const order = ['importasdm(', "inpfile='/work/weblog/x.ms.flagcmds.txt', tbuff=[0.96, 1.008]", "DV03", "mode='summary'", 'PHASE', 'TARGET,CHECK', 'BANDPASS,AMPLITUDE', 'mstransform(', 'tclean(', 'exportfits('];
  let cursor = -1;
  for (const marker of order) {
    const at = script.indexOf(marker, cursor + 1);
    assert.ok(at > cursor, `${marker} comes after what precedes it`);
    cursor = at;
  }
  // The pipeline's flags are replayed by selection, never restored by row, and checked before any calibration is applied.
  assert.ok(!script.includes('flagmanager'), 'a flag version is restored by row, and rows differ between CASA versions');
  assert.ok(script.indexOf('sys.exit("The replayed flags differ') < script.indexOf('applycal('));
  assert.ok(script.includes('if worst[0] > 0.005'));
  // The generated script is Python, and a quoting slip in a template only shows when Python reads it.
  const compiled = spawnSync('python3', ['-c', 'import ast, sys; ast.parse(sys.stdin.read())'], { input: script, encoding: 'utf8' });
  assert.equal(compiled.status, 0, compiled.stderr);
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
    flags, plan, imaging: await imaging(), selfcal: null, imageBase: '/work/x', scratch: '/fast' });
  assert.ok(script.includes("importasdm(asdm='/raw/x', vis='/fast/x.ms'"));
  assert.ok(script.includes("mstransform(vis='/fast/x.ms', outputvis='/fast/R_Dor.targets.ms'"));
  assert.ok(script.includes("tclean(vis=['/fast/R_Dor.targets.ms'], imagename='/fast/x'"), 'CASA images are made on the scratch disk');
  assert.ok(script.includes("fitsimage='/work/x.fits'"), 'only the FITS goes beside the delivery');
  assert.ok(!script.includes("gaintable=['/fast/"), 'caltables are resolved from the working directory, not the scratch disk');
  // Only an import that wrote its marker is reused.
  assert.ok(script.indexOf("open(imported, 'w')") > script.indexOf('importasdm('));
  assert.ok(script.indexOf("if not os.path.exists(imported):") < script.indexOf('importasdm('));
  // A finished calibration is not repeated, and the flags are never replayed over it.
  const guard = script.indexOf('if not os.path.exists(calibrated):');
  assert.ok(guard < script.indexOf("mode='list'") && script.indexOf("open(calibrated, 'w')") < script.indexOf('mstransform('));
  assert.ok(script.split('\n').filter(line => line.trimStart().startsWith("flagdata(vis='/fast/x.ms', mode='list'")).every(line => line.startsWith('        flagdata(')), 'the flag replay sits inside the calibration guard');
  // Inside both guards: the target split's own guard, then the calibration's.
  const calibrations = script.split('\n').filter(line => line.trimStart().startsWith("applycal(vis='/fast/x.ms'") || line.trimStart().startsWith("applycal(vis='x.ms'"));
  assert.ok(calibrations.length > 0 && calibrations.every(line => line.startsWith('        applycal(')), 'every applycal sits inside the calibration guard');
  // A finished target split is imaged again without importing; the previous images go first, or tclean resumes from their model.
  assert.ok(script.indexOf('if not os.path.exists(ready):') < script.indexOf('importasdm('));
  assert.ok(script.indexOf("open(ready, 'w')") < script.indexOf("for product in glob.glob('/fast/x.*')"));
  assert.ok(script.indexOf("for product in glob.glob('/fast/x.*')") < script.indexOf('tclean('));
});

test('imaging follows the pipeline\u2019s own call rather than a plausible guess', async () => {
  const script = restoreScript({ asdm: '/raw/x', visibilities: 'x.ms', applications: parseCalibrationRecord(await record()),
    flags, plan, imaging: await imaging(), selfcal: null, imageBase: '/work/x' });
  // Every argument of the pipeline's final call reaches tclean as the literal it logged; none is re-chosen here.
  const passed = pipelineTcleanArguments(await imaging());
  assert.equal(passed.get('deconvolver'), "'mtmfs'", 'this delivery used mtmfs, whatever the general rule says');
  assert.equal(passed.get('nterms'), '2');
  assert.equal(passed.get('cell'), "['0.0055arcsec']");
  assert.equal(passed.get('threshold'), "'0.000949Jy'");
  assert.equal(passed.get('scan'), "['9,11,13,15,22,24,26,30,33,37']", 'the scan selection is one string, not the first of ten');
  assert.ok(passed.get('antenna')?.endsWith("&']"), 'the auto-correlations stay out of the image');
  assert.equal(passed.get('usemask'), "'auto-multithresh'", 'CLEAN works inside the pipeline\u2019s mask, not on noise peaks');
  assert.ok(passed.get('phasecenter')?.includes('04:36:45.3572'), 'the grid is centred where the pipeline centred it');
  for (const replaced of ['vis', 'imagename', 'calcres', 'calcpsf', 'restart', 'parallel']) assert.ok(!passed.has(replaced), replaced);
  assert.equal(pipelineTcleanArguments(await imaging(), 'ICRS 69.18898818777deg -62.07767209321deg').get('phasecenter'), "'ICRS 69.18898818777deg -62.07767209321deg'");
  // The literals are read by ast.literal_eval in the script, never executed.
  assert.ok(script.includes('ast.literal_eval(value) for name, value in PIPELINE_TCLEAN.items()'));
  assert.ok(passed.get('spw')?.includes('455.3506751226~455.6221594976GHz'));
  assert.ok(!script.includes('455.38~455.65GHz'));
});

test('self-calibration is applied as its record states, with the map that spreads one solution over every window', async () => {
  const solutions = await selfcal();
  const script = restoreScript({ asdm: '/raw/x', visibilities: 'x.ms', applications: parseCalibrationRecord(await record()),
    flags, plan, imaging: await imaging(), selfcal: solutions, tableDirectory: '/aux/sc', imageBase: '/work/x' });
  assert.ok(script.includes("applymode='calflag'"), 'the record says calflag; calonly would let unsolved data through unflagged');
  assert.ok(script.includes("interp=['linearPD', 'linearPD']"));
  assert.ok(script.includes('/aux/sc/Target_R_Dor_'), 'the tables are addressed where the delivery put them');
  assert.ok(script.includes('calwt=False'));
  // The second table's map is 32 entries of one window; the first table needs none.
  assert.ok(/spwmap=\[\[\], \[25, 25, /u.test(script));
  assert.ok(script.includes("mstransform(vis='x.ms', outputvis='R_Dor.targets.ms'"));
  assert.ok(script.indexOf('/aux/sc/Target_R_Dor_') > script.indexOf("outputvis='R_Dor.targets.ms'"));
  assert.ok(script.indexOf('/aux/sc/Target_R_Dor_') < script.indexOf('tclean('));
  assert.ok(script.includes("tclean(vis=['R_Dor.targets.ms']"));
});

test('a delivery whose self-calibration did not succeed is imaged without it', async () => {
  const solutions = { ...(await selfcal()), succeeded: false };
  const script = restoreScript({ asdm: '/raw/x', visibilities: 'x.ms', applications: parseCalibrationRecord(await record()),
    flags, plan, imaging: await imaging(), selfcal: solutions, imageBase: '/work/x' });
  assert.ok(script.includes('no self-calibration applied'));
  // The shipped calibration still carries its own spectral-window maps; it is the self-calibration tables that are absent.
  assert.ok(!script.includes('Target_R_Dor_'));
  assert.ok(script.includes("tclean(vis=['R_Dor.targets.ms']"), 'the targets split is still what gets imaged');
});
