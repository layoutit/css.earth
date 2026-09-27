#!/usr/bin/env node
/** Restore one ALMA execution from its raw visibilities and image it, then check the result against the archive's own image.
 *
 *   node tools/objects/interferometry/alma-restore.mts <working directory> --target R_Dor [--scratch <fast local directory>]
 *
 * A delivery of several executions (a mosaic observed over several sessions) is restored one execution at a time and then
 * imaged once, the way its pipeline imaged it:
 *
 *   node tools/objects/interferometry/alma-restore.mts <working directory> --target eps_eri --spw 19,21,23,25 \
 *     --asdm <project>_uid___A002_<a>_<b>.asdm.sdm.tar --split-only --scratch <dir>      (once per execution)
 *   node tools/objects/interferometry/alma-restore.mts <working directory> --target eps_eri --image-delivery --scratch <dir>
 *
 * The working directory holds what the archive served for one member observing unit set: `asdm.tar` (one execution's raw
 * visibilities, or the tarball `--asdm` names), `auxiliary.tar` (the pipeline's calibration tables, its flag versions and its calapply records) and
 * `archive.fits` (the continuum image the pipeline made, kept as the oracle). Nothing is downloaded here; `alma-archive.mts`
 * says where those files are.
 *
 * The three steps are the ones `hifa_restoredata` performs, written out so each is visible: import the ASDM, restore the flag
 * version the pipeline left, and apply the calibration exactly as the shipped record states. Then the target is split out and
 * imaged. The ALMA pipeline package is not installed and is not used; every task here is in casatasks.
 *
 * What this route does not reproduce: the pipeline's renormalisation step (`hifa_renorm`) and its self-calibration, whose gain
 * tables are not in the calapply record. Both change the result, so the comparison against the archive image states the
 * difference rather than expecting equality. */
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseCalibrationRecord, requiredTables, type CalibrationApplication } from './alma-calibration.mts';
import { readFitsHeader } from '@cssearth/fits';
import { agentFlagCommands, completeInlineCommands, echoedFlagCommands, loggedFlagging, pipelineFlagSummary } from './alma-flags.mts';
import { pipelineImaging, precisePhaseCentre, type PipelineImaging } from './alma-imaging.mts';
import { parseSelfCalibration, type SelfCalibration } from './alma-selfcal.mts';
import { toolchainPath } from './toolchain.mts';

export interface ImagingPlan {
  /** The field to image, as the measurement set names it. */
  readonly target: string;
  /** The science spectral windows to split, by id. Which channels of them are imaged is the pipeline's own selection, applied
   * at imaging time: splitting on it would renumber nothing but would discard the channels a later comparison may want. */
  readonly scienceWindows: string;
}

/** tclean arguments the route sets itself: the measurement set and image it works on, the pipeline's instructions to continue
 * the iteration before this one instead of starting afresh, and `parallel`, which asks for the MPI cluster the pipeline ran
 * under. That changes how the work is spread, not the image, and a plain casatasks install has no cluster to give it. */
const REPLACED_TCLEAN_ARGUMENTS = new Set(['vis', 'imagename', 'calcres', 'calcpsf', 'restart', 'parallel']);

/** The pipeline's tclean arguments this route passes on unchanged, as the Python literals the log wrote. */
export function pipelineTcleanArguments(imaging: PipelineImaging, phaseCentre?: string) {
  const passed = new Map([...imaging.arguments].filter(([name]) => !REPLACED_TCLEAN_ARGUMENTS.has(name)));
  if (phaseCentre !== undefined) passed.set('phasecenter', python(phaseCentre));
  return passed;
}

const python = (value: string) => `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
const pythonList = (values: readonly string[]) => `[${values.map(python).join(', ')}]`;

/** One applycal call, written as the record states it. */
export function applycalStatement(application: CalibrationApplication, visibilities: string) {
  const tables = application.tables;
  return `applycal(vis=${python(visibilities)}, field=${python(application.field)}, intent=casa_intent(${python(visibilities)}, ${python(application.intent)}), ` +
    `spw=${python(application.spw)}, antenna=${python(application.antenna)}, ` +
    `gaintable=${pythonList(tables.map(table => table.gaintable))}, gainfield=${pythonList(tables.map(table => table.gainfield))}, ` +
    `spwmap=[${tables.map(table => `[${table.spwmap.join(', ')}]`).join(', ')}], interp=${pythonList(tables.map(table => table.interp))}, ` +
    `calwt=[${tables.map(table => (table.calwt ? 'True' : 'False')).join(', ')}], applymode='calflagstrict', flagbackup=False)`;
}

/** The CASA script for one restore: import, flags, calibration, split, image. Written out rather than hidden in a task, so the
 * run can be read against the pipeline's own casa_commands log. */
export function restoreScript(options: {
  readonly asdm: string; readonly visibilities: string; readonly applications: readonly CalibrationApplication[];
  readonly flags: ReplayedFlags; readonly plan: ImagingPlan; readonly imageBase: string;
  readonly imaging: PipelineImaging; readonly selfcal: SelfCalibration | null; readonly tableDirectory?: string;
  readonly scratch?: string; readonly phaseCentre?: string;
  /** The target split's name. A delivery of several executions names it as the pipeline did, `<execution>_target.ms`, so
   * the imaging call its log recorded finds every split under the name it gave it. */
  readonly split?: string;
  /** Stop after the split: the executions of one delivery are imaged together once each is restored (deliveryImagingScript). */
  readonly splitOnly?: boolean;
}) {
  const { asdm, applications, flags, plan, imageBase, imaging, selfcal } = options;
  // Both measurement sets live on the scratch disk: the import and the corrected column are random writes that an external
  // drive serves at a tenth of its sequential rate. The calibration tables stay where they were unpacked.
  const onScratch = (name: string) => (options.scratch ? `${options.scratch}/${name}` : name);
  const visibilities = onScratch(options.visibilities), targets = onScratch(options.split ?? `${plan.target}.targets.ms`);
  const resolveTable = (table: string) => (options.tableDirectory ? `${options.tableDirectory}/${table}` : table);
  return [
    'import os, sys, json, shutil, glob, ast',
    'from casatasks import importasdm, flagdata, applycal, mstransform, tclean, exportfits, casalog',
    `casalog.setlogfile(${python(`${imageBase}.casa.log`)})`,
    // The calapply record names intents the pipeline's way; the measurement set names them as the observatory scheduled them.
    // The pipeline translates one into the other before it calls applycal, and so does this route, reading the set's own
    // states. An intent without a translation, or one with no scan to select, stops the run rather than calibrating less.
    "PIPELINE_INTENTS = {'AMPLITUDE': ('CALIBRATE_FLUX', 'CALIBRATE_AMPLI'), 'BANDPASS': ('CALIBRATE_BANDPASS',), 'PHASE': ('CALIBRATE_PHASE',), 'TARGET': ('OBSERVE_TARGET',), 'CHECK': ('OBSERVE_CHECK_SOURCE',), 'POLARIZATION': ('CALIBRATE_POLARIZATION',)}",
    'def casa_intent(vis, names):',
    '    from casatools import table',
    "    tb = table(); tb.open(vis + '/STATE'); modes = {mode for row in tb.getcol('OBS_MODE') for mode in str(row).split(',')}; tb.close()",
    '    patterns = []',
    "    for name in names.split(','):",
    "        if name not in PIPELINE_INTENTS: sys.exit(f'The calapply record names intent {name}, which this route does not translate.')",
    "        found = sorted(mode for mode in modes if mode.split('#')[0] in PIPELINE_INTENTS[name])",
    "        if not found: sys.exit(f'The measurement set has no scan with intent {name}.')",
    "        patterns += [f'*{mode}*' for mode in found]",
    "    return ','.join(patterns)",
    'steps = []',
    // The calibrated, self-calibrated target split is the input to imaging, and making it is most of the run. A marker records
    // that it is finished, so a change to the imaging alone re-images instead of importing and calibrating again.
    `ready = ${python(`${targets}.ready`)}`,
    'if not os.path.exists(ready):',
    ...[
      // A measurement set left by an interrupted import looks whole to every later task, so it is reused only when the import
      // wrote its completion marker; anything else is removed and imported afresh.
      `imported = ${python(`${visibilities}.imported`)}`,
      `shutil.rmtree(${python(targets)}, ignore_errors=True)`,
      'if not os.path.exists(imported):',
      `    for stale in (${python(visibilities)}, ${python(`${visibilities}.flagversions`)}):`,
      '        shutil.rmtree(stale, ignore_errors=True)',
      `    if os.path.exists(${python(`${visibilities}.calibrated`)}): os.remove(${python(`${visibilities}.calibrated`)})`,
      // The lazy import leaves the visibilities in the ASDM's binary files and reads them in place, so the measurement set holds
      // only metadata, flags and the corrected column. What the scratch disk must hold is then about the ASDM's size once.
      `    need = sum(os.path.getsize(os.path.join(root, name)) for root, _, names in os.walk(${python(asdm)}) for name in names)`,
      `    free = shutil.disk_usage(os.path.dirname(os.path.abspath(${python(visibilities)}))).free`,
      "    if free < 1.5 * need:",
      "        sys.exit(f'The scratch disk has {free / 1e9:.0f} GB free; the corrected column and the target split need about {1.5 * need / 1e9:.0f} GB.')",
      // ocorr_mode 'ca' is what the pipeline imports with: cross-correlations and auto-correlations.
      // hifa_restoredata's own defaults, so the measurement set carries the metadata the pipeline's did.
      `    importasdm(asdm=${python(asdm)}, vis=${python(visibilities)}, ocorr_mode='ca', asis='SBSummary ExecBlock Antenna Annotation Station Receiver Source CalAtmosphere CalWVR CalPointing', bdfflags=True, lazy=True)`,
      "    open(imported, 'w').close()",
      "    steps.append('importasdm')",
      // Flagging and applying the calibration are one step: flagging again from scratch would undo what calflagstrict flagged.
      // A marker records that both finished, so a later failure does not repeat an hour of applycal.
      `calibrated = ${python(`${visibilities}.calibrated`)}`,
      'if not os.path.exists(calibrated):',
      ...[
        // The pipeline's flags, replayed by selection: its hifa_flagdata command file with the logged time buffer, then the
        // inline commands later stages applied. A flag version would be restored by row, and rows differ between CASA versions.
        `flagdata(vis=${python(visibilities)}, mode='list', inpfile=${python(flags.commandFile)}, tbuff=[${flags.tbuff.join(', ')}], action='apply', flagbackup=False)`,
        ...(flags.inline.length ? [`flagdata(vis=${python(visibilities)}, mode='list', inpfile=${pythonList(flags.inline)}, action='apply', flagbackup=False)`] : []),
        // The pipeline's per-antenna count is the state after hif_applycal. It is checked twice. Before anything is calibrated,
        // so a replay that flags other data than the pipeline did stops here, not after an hour of applycal; a pair the
        // pipeline ended fully flagged is left to the second check, because applycal flags all of an antenna's data when every
        // gain solution it would apply is flagged (DV22 in ALMA 2019.1.00696.S). After applycal, every pair, with no exemption.
        `expected = json.loads(${python(JSON.stringify(flags.expected))})`,
        'def compare(stage, exempt_full):',
        '    report, worst = {}, (0.0, None)',
        '    for spw, antennas in expected.items():',
        `        counts = flagdata(vis=${python(visibilities)}, mode='summary', field=${python(plan.target)}, spw=spw)['antenna']`,
        '        for name, theirs in antennas.items():',
        "            ours = counts[name]['flagged'] / counts[name]['total']",
        '            report[spw + " " + name] = [round(ours, 6), round(theirs, 6)]',
        '            if exempt_full and theirs >= 0.999999: continue',
        "            if abs(ours - theirs) >= worst[0]: worst = (abs(ours - theirs), f'spw {spw} {name}: {100 * ours:.2f}% here, {100 * theirs:.2f}% in the pipeline')",
        `    open(${python(`${imageBase}.flags.`)} + stage + '.json', 'w').write(json.dumps(report, indent=1))`,
        `    if worst[0] > ${FLAG_TOLERANCE}: sys.exit("The replayed flags differ from the pipeline's count " + stage + ": " + worst[1])`,
        '    return worst[0]',
        "steps.append(f'flags replayed; largest per-antenna difference from the pipeline before calibration {100 * compare(\"before-calibration\", True):.2f} points')",
        ...applications.flatMap(application => [applycalStatement(application, visibilities), `steps.append('applycal ' + ${python(application.intent)})`]),
        "steps.append(f'after calibration, largest per-antenna difference from the pipeline {100 * compare(\"after-calibration\", False):.2f} points')",
      "open(calibrated, 'w').close()"].map(line => `    ${line}`),
      // Every science channel, science target only, and the spectral windows keep their numbers: the self-calibration maps are
      // indexed by absolute window id, so renumbering them here would misapply the solutions without failing.
      // split has no reindex argument; mstransform, which split wraps, does.
      `mstransform(vis=${python(visibilities)}, outputvis=${python(targets)}, field=${python(plan.target)}, spw=${python(plan.scienceWindows)}, intent='OBSERVE_TARGET#ON_SOURCE', datacolumn='corrected', keepflags=True, reindex=False)`,
      "steps.append('split targets')",
      // The full measurement set is rebuilt from the ASDM by the next run; only the target split is imaged.
      `os.remove(imported); os.remove(calibrated); shutil.rmtree(${python(visibilities)}); shutil.rmtree(${python(`${visibilities}.flagversions`)}, ignore_errors=True)`,
      ...(selfcal === null || !selfcal.succeeded ? ["steps.append('no self-calibration applied')"] : [
        `applycal(vis=${python(targets)}, field=${python(plan.target)}, gaintable=${pythonList(selfcal.tables.map(table => resolveTable(table)))}, ` +
          `interp=${pythonList([...selfcal.interpolation])}, spwmap=[${selfcal.spectralWindowMaps.map(map => `[${map.join(', ')}]`).join(', ')}], ` +
          `calwt=False, applymode=${python(selfcal.applyMode)}, flagbackup=False)`,
        `steps.append('self-calibration at ' + ${python(selfcal.solutionInterval)})`,
      ]),
      "open(ready, 'w').close()",
    ].map(line => `    ${line}`),
    ...(options.splitOnly ? ["steps.append('split only: imaged with the other executions of the delivery')"]
      : imagingLines({ targets: [targets], imaging, imageBase, scratch: options.scratch, phaseCentre: options.phaseCentre })),
    `open(${python(`${imageBase}.steps.json`)}, 'w').write(json.dumps(steps, indent=1))`,
    "print('restore complete:', ', '.join(steps))",
  ].join('\n') + '\n';
}

/** The pipeline's own imaging of the restored target splits, exported beside the delivery. */
function imagingLines(options: {
  readonly targets: readonly string[]; readonly imaging: PipelineImaging; readonly imageBase: string;
  readonly scratch?: string; readonly phaseCentre?: string;
}) {
  const { targets, imaging, imageBase } = options;
  // CASA's images are directories of tables; on an external exFAT drive every file gains an AppleDouble twin that vanishes
  // mid-delete, so they are made on the scratch disk and only the exported FITS goes beside the delivery.
  const imaged = options.scratch ? `${options.scratch}/${imageBase.split('/').at(-1)}` : imageBase;
  return [
    // tclean continues from any model it finds under its image name, so the previous run's images are removed first.
    `for product in glob.glob(${python(`${imaged}.*`)}):`,
    '    if os.path.isdir(product): shutil.rmtree(product)',
    // The imaging the pipeline itself performed: its final tclean call, argument for argument, from the command log it shipped.
    // Leaving any out changes the image. Without the antenna selection's trailing &, the auto-correlations entered the Briggs
    // weights and widened the beam; without phasecenter the grid moved 0.37 mas; without the auto-multithresh mask, CLEAN
    // worked on noise peaks everywhere and the noise fell 40% below the archive's. Each value is a Python literal read with
    // ast.literal_eval, so nothing in the log is executed. REPLACED_TCLEAN_ARGUMENTS lists the few this route sets itself.
    // A mosaic's per-execution selections (antenna, scan) are lists parallel to vis, so the splits keep the log's order.
    `PIPELINE_TCLEAN = {${[...pipelineTcleanArguments(imaging, options.phaseCentre)].map(([name, value]) => `${python(name)}: ${python(value)}`).join(', ')}}`,
    `tclean(vis=${pythonList(targets)}, imagename=${python(imaged)}, **{name: ast.literal_eval(value) for name, value in PIPELINE_TCLEAN.items()})`,
    "steps.append('tclean')",
    // mtmfs writes one image per Taylor term; the zeroth is the continuum intensity.
    `exportfits(imagename=${python(`${imaged}.image${imaging.terms > 1 ? '.tt0' : ''}.pbcor`)}, fitsimage=${python(`${imageBase}.fits`)}, overwrite=True, dropdeg=False)`,
    "steps.append('exportfits')",
  ];
}

/** The measurement sets the log's imaging call names, in its order: one per execution of the delivery. */
export function loggedVisibilities(imaging: PipelineImaging): string[] {
  const vis = imaging.arguments.get('vis');
  if (!vis) throw new TypeError(`The logged tclean for ${imaging.field} names no measurement sets.`);
  return [...vis.matchAll(/'([^']+)'/gu)].map(match => match[1]!);
}

/** Image the restored splits of every execution together, as the delivery's own imaging call did. Each split must exist and
 * be finished (its `.ready` marker), or the image would silently carry fewer executions than the archive's. */
export function deliveryImagingScript(options: {
  readonly imaging: PipelineImaging; readonly imageBase: string; readonly scratch: string; readonly phaseCentre?: string;
}) {
  const targets = loggedVisibilities(options.imaging).map(name => `${options.scratch}/${name}`);
  return [
    'import os, sys, json, shutil, glob, ast',
    'from casatasks import tclean, exportfits, casalog',
    `casalog.setlogfile(${python(`${options.imageBase}.casa.log`)})`,
    `missing = [vis for vis in ${pythonList(targets)} if not os.path.exists(vis + '.ready')]`,
    "if missing: sys.exit('Restore these executions first (alma-restore.mts --asdm <tar> --split-only): ' + ', '.join(missing))",
    'steps = []',
    ...imagingLines({ targets, imaging: options.imaging, imageBase: options.imageBase, scratch: options.scratch, phaseCentre: options.phaseCentre }),
    `open(${python(`${options.imageBase}.steps.json`)}, 'w').write(json.dumps(steps, indent=1))`,
    "print('delivery imaged:', ', '.join(steps))",
  ].join('\n') + '\n';
}

/** The execution a raw tarball holds, from the archive's own file name: `<project>_uid___A002_<a>_<b>.asdm.sdm.tar`. */
export function executionOfTarball(path: string): string | null {
  return /(uid___A002_[0-9A-Za-z]+_[0-9A-Za-z]+)\.asdm\.sdm\.tar$/u.exec(basename(path))?.[1] ?? null;
}

/** A macOS volume that is not HFS+ carries an AppleDouble twin beside every file, and those twins are not the data. */
const real = (name: string) => !name.split('/').some(part => part.startsWith('._'));

async function findOne(directory: string, matches: (name: string) => boolean, what: string, deep = true) {
  const names = (await readdir(directory, { recursive: deep })).filter(real);
  const found = names.filter(name => matches(basename(name)));
  if (found.length !== 1) throw new Error(`Expected one ${what} under ${directory}, found ${found.length}.`);
  return resolve(directory, found[0]!);
}

/** The largest per-antenna difference from the pipeline's flag count the replay may leave, as a fraction. */
const FLAG_TOLERANCE = 0.005;

export interface ReplayedFlags {
  /** hifa_flagdata's commands, written where CASA can read them. */
  readonly commandFile: string;
  readonly tbuff: readonly [number, number];
  readonly inline: readonly string[];
  /** The pipeline's flagged fraction for the target, by spectral window and antenna. */
  readonly expected: Readonly<Record<string, Readonly<Record<string, number>>>>;
}

/** The pipeline's flags as selections, from the weblog the delivery ships and its command log. */
async function replayedFlags(work: string, unpacked: string, commands: string, visibilities: string, target: string,
  run: (command: string, args: readonly string[], cwd: string) => void): Promise<ReplayedFlags> {
  const weblog = await findOne(unpacked, name => name.endsWith('.weblog.tgz'), 'pipeline weblog');
  const out = resolve(work, 'weblog');
  await mkdir(out, { recursive: true });
  run('tar', ['xzf', weblog, '-C', out, `*/stage*/${visibilities}-agent_flagcmds.txt`, '*/stage*/casapy.log'], work);
  const agent = await findOne(out, name => name === `${visibilities}-agent_flagcmds.txt`, 'hifa_flagdata command file');
  const commandFile = resolve(work, 'weblog', `${visibilities}.flagcmds.txt`);
  await writeFile(commandFile, agentFlagCommands(await readFile(agent, 'utf8')).join('\n') + '\n');
  const logged = loggedFlagging(commands, visibilities), tbuff = logged.tbuff;
  const logs = (await readdir(out, { recursive: true })).filter(name => real(name) && name.endsWith('/casapy.log'))
    .sort((a, b) => Number(/stage(\d+)/u.exec(a)?.[1] ?? 0) - Number(/stage(\d+)/u.exec(b)?.[1] ?? 0));
  // Commands the command log cut short are completed from the task's own echo in the stage logs, in the same order.
  const echoed = (await Promise.all(logs.map(name => readFile(resolve(out, name), 'utf8')))).flatMap(text => echoedFlagCommands(text, visibilities));
  const inline = completeInlineCommands(logged.inline, echoed);
  // The count hif_applycal logged; the last stage that logged one for this set is the state the calibration left.
  let expected: Record<string, Record<string, number>> | null = null;
  for (const name of logs) {
    const text = await readFile(resolve(out, name), 'utf8');
    if (!text.includes(`Executing flagdata(vis='${visibilities}'`) || !text.includes("name='AntSpw")) continue;
    const summary = pipelineFlagSummary(text, visibilities, target);
    expected = Object.fromEntries([...summary].map(([spw, antennas]) => [String(spw), Object.fromEntries(antennas)]));
  }
  if (!expected) throw new Error(`The weblog logs no per-antenna flag count for ${target}, so a replay could not be checked.`);
  return { commandFile, tbuff, inline, expected };
}

export async function restoreExecution(directory: string, plan: ImagingPlan,
  options: { readonly scratch?: string; readonly asdm?: string; readonly splitOnly?: boolean } = {}) {
  const work = resolve(directory), unpacked = resolve(work, 'unpacked');
  await mkdir(unpacked, { recursive: true });
  const run = (command: string, args: readonly string[], cwd: string) => {
    const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
    if (result.status !== 0) throw new Error(`${command} ${args[0]} failed (status ${result.status}).`);
  };
  // A delivery of several executions ships one raw tarball each; `--asdm` names which one this run restores. The archive
  // names the tarball for its execution, so the ASDM, its calibration record and its flags are all found by that name.
  const tarball = resolve(options.asdm ?? resolve(work, 'asdm.tar')), wanted = executionOfTarball(tarball);
  const isAsdm = (name: string) => (wanted ? name === `${wanted}.asdm.sdm` : /^uid___A002_[0-9A-Za-z_]+\.asdm\.sdm$/u.test(name));
  // Both tarballs unpack into one tree. Extracting 23 GB again on a rerun costs a quarter of an hour for nothing.
  const asdmPresent = await readdir(unpacked, { recursive: true })
    .then(names => names.some(name => isAsdm(basename(name))), () => false);
  if (!asdmPresent) run('tar', ['xf', tarball, '-C', unpacked], work);
  run('tar', ['xf', resolve(work, 'auxiliary.tar'), '-C', unpacked], work);
  // The delivery nests the ASDM under its project, science goal, group and member, and names it with the suffix the archive
  // gives the tarball. importasdm takes the directory; the measurement set is named for the execution, without the suffix.
  const asdm = await findOne(unpacked, isAsdm, 'raw ASDM directory');
  const execution = basename(asdm).replace(/\.asdm\.sdm$/u, '');
  const visibilities = `${execution}.ms`;
  // One calapply record per execution, named for its measurement set. The `_target.ms.auxcalapply.txt` records beside them
  // apply the continuum fit the pipeline subtracts before imaging cubes (hif_uvcontfit); a continuum image does not use them.
  const record = await findOne(unpacked, name => name === `${visibilities}.calapply.txt`, `calapply record for ${execution}`);
  const applications = parseCalibrationRecord(await readFile(record, 'utf8'));
  const calibration = resolve(work, 'calibration');
  await mkdir(calibration, { recursive: true });
  // The solved tables come one archive per observing session, and the sessions are not numbered in execution order, so every
  // archive is unpacked; the tables are named for their execution, and the record's own list says which it applies.
  // (`.auxcaltables.tgz`, the continuum fits, never ends in `.caltables.tgz`.)
  const archives = (await readdir(unpacked, { recursive: true })).filter(name => real(name) && name.endsWith('.caltables.tgz'));
  if (!archives.length) throw new Error(`Expected a calibration table archive under ${unpacked}, found none.`);
  for (const archive of archives) run('tar', ['xzf', resolve(unpacked, archive), '-C', calibration], work);
  // The auxiliary products carry the self-calibration solutions and the record that says how to apply them.
  const products = resolve(work, 'auxproducts');
  await mkdir(products, { recursive: true });
  const auxproducts = await findOne(unpacked, name => name.endsWith('.auxproducts.tgz'), 'auxiliary product archive');
  run('tar', ['xzf', auxproducts, '-C', products], work);
  const staged = (await readdir(calibration)).filter(real);
  const missing = requiredTables(applications).filter(table => !staged.includes(table));
  if (missing.length) throw new Error(`The calibration archive is missing ${missing.length} table(s) the record applies: ${missing[0]}`);

  const log = await findOne(unpacked, name => name.endsWith('.casa_commands.log'), 'pipeline command log');
  const commands = await readFile(log, 'utf8');
  const imaging = pipelineImaging(commands, plan.target);
  const flags = await replayedFlags(work, unpacked, commands, visibilities, plan.target, run);
  const selfcalRecord = await readdir(products, { withFileTypes: true })
    .then(entries => entries.find(entry => real(entry.name) && entry.isFile() && entry.name.endsWith('.selfcal.json'))?.name ?? null);
  const selfcal = selfcalRecord ? parseSelfCalibration(JSON.parse(await readFile(resolve(products, selfcalRecord), 'utf8'))) : null;
  const workdir = (await readdir(products, { withFileTypes: true })).find(entry => real(entry.name) && entry.isDirectory() && entry.name.startsWith('sc_workdir'));
  if (selfcal?.succeeded && !workdir) throw new Error('The delivery self-calibrated but ships no table directory.');
  if (selfcal?.succeeded) {
    const tables = (await readdir(resolve(products, workdir!.name))).filter(real);
    const absent = selfcal.tables.filter(table => !tables.includes(table));
    if (absent.length) throw new Error(`The self-calibration record names ${absent.length} table(s) the delivery does not carry: ${absent[0]}`);
  }

  const scratch = resolve(options.scratch ?? calibration);
  await mkdir(scratch, { recursive: true });
  // The log rounds the phase centre; the archive image, when it is here as the oracle, records it unrounded.
  const archive = resolve(work, 'archive.fits');
  const phaseCentre = imaging.phaseCentre !== null && await readFile(archive).then(() => true, () => false)
    ? precisePhaseCentre(imaging.phaseCentre, readFitsHeader(await readFile(archive)).header, imaging.imageSize).phaseCentre : undefined;
  const script = restoreScript({ asdm, visibilities, applications, flags, plan, imaging, selfcal, scratch, phaseCentre,
    tableDirectory: workdir ? resolve(products, workdir.name) : undefined, imageBase: resolve(work, `${plan.target}.restored`),
    ...(options.splitOnly ? { split: `${execution}_target.ms`, splitOnly: true } : {}) });
  const scriptPath = resolve(work, options.splitOnly ? `restore.${execution}.py` : 'restore.py');
  await writeFile(scriptPath, script);
  const casa = await toolchainPath('casa');
  run(resolve(casa, 'venv/bin/python'), [scriptPath], calibration);
  return { script: scriptPath, execution, image: options.splitOnly ? null : resolve(work, `${plan.target}.restored.fits`), applications: applications.length,
    imaging, selfcal, flaggedAntennas: Object.values(flags.expected)[0] ? Object.keys(Object.values(flags.expected)[0]!).length : 0 };
}

/** Image every restored execution of the delivery together with the pipeline's own final call, beside the delivery. */
export async function imageDelivery(directory: string, plan: ImagingPlan, options: { readonly scratch: string }) {
  const work = resolve(directory), unpacked = resolve(work, 'unpacked');
  const log = await findOne(unpacked, name => name.endsWith('.casa_commands.log'), 'pipeline command log');
  const imaging = pipelineImaging(await readFile(log, 'utf8'), plan.target);
  const archive = resolve(work, 'archive.fits');
  const phaseCentre = imaging.phaseCentre !== null && await readFile(archive).then(() => true, () => false)
    ? precisePhaseCentre(imaging.phaseCentre, readFitsHeader(await readFile(archive)).header, imaging.imageSize).phaseCentre : undefined;
  const imageBase = resolve(work, `${plan.target}.restored`), scriptPath = resolve(work, 'image-delivery.py');
  await writeFile(scriptPath, deliveryImagingScript({ imaging, imageBase, scratch: resolve(options.scratch), phaseCentre }));
  const casa = await toolchainPath('casa');
  const result = spawnSync(resolve(casa, 'venv/bin/python'), [scriptPath], { cwd: resolve(options.scratch), stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Imaging the delivery failed (status ${result.status}).`);
  return { script: scriptPath, image: `${imageBase}.fits`, imaging, executions: loggedVisibilities(imaging).length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [directory] = process.argv.slice(2);
  if (!directory) throw new TypeError('Usage: alma-restore.mts <working directory> --target <field> [--asdm <tarball> --split-only | --image-delivery] [--scratch <dir>]');
  const argument = (name: string, fallback: string) => {
    const index = process.argv.indexOf(`--${name}`);
    return index > 0 ? process.argv[index + 1] ?? fallback : fallback;
  };
  const scratch = argument('scratch', ''), asdm = argument('asdm', '');
  const plan = { target: argument('target', 'R_Dor'), scienceWindows: argument('spw', '25,27,29,31') };
  if (process.argv.includes('--image-delivery')) {
    if (!scratch) throw new TypeError('--image-delivery reads the splits from --scratch <dir>, where --split-only wrote them.');
    const imaged = await imageDelivery(directory, plan, { scratch });
    console.log(`Imaged ${imaged.executions} executions together with ${imaged.imaging.deconvolver} at ${imaged.imaging.cell}; image at ${imaged.image}`);
  } else {
    const result = await restoreExecution(directory, plan, { ...(scratch ? { scratch } : {}), ...(asdm ? { asdm } : {}), splitOnly: process.argv.includes('--split-only') });
    console.log(`${result.execution}: replayed the pipeline's flags, checked on ${result.flaggedAntennas} antennas, and applied ${result.applications} calibration steps.`);
    console.log(result.selfcal?.succeeded
      ? `Self-calibrated at ${result.selfcal.solutionInterval} with ${result.selfcal.tables.length} table(s), ${result.selfcal.applyMode}.`
      : 'No self-calibration in this delivery.');
    console.log(result.image ? `Imaged with ${result.imaging.deconvolver}${result.imaging.terms > 1 ? ` (${result.imaging.terms} terms)` : ''} at ${result.imaging.cell}; image at ${result.image}`
      : `Split to ${result.execution}_target.ms; image the delivery once every execution is restored (--image-delivery).`);
  }
}
