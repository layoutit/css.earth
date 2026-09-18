#!/usr/bin/env node
/** Restore one ALMA execution from its raw visibilities and image it, then check the result against the archive's own image.
 *
 *   node tools/objects/interferometry/alma-restore.mts <working directory> --target R_Dor [--scratch <fast local directory>]
 *
 * The working directory holds what the archive served for one member observing unit set: `asdm.tar` (one execution's raw
 * visibilities), `auxiliary.tar` (the pipeline's calibration tables, its flag versions and its calapply record) and
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
import { pipelineImaging, type PipelineImaging } from './alma-imaging.mts';
import { parseSelfCalibration, type SelfCalibration } from './alma-selfcal.mts';
import { toolchainPath } from './toolchain.mts';

export interface ImagingPlan {
  /** The field to image, as the measurement set names it. */
  readonly target: string;
  /** The science spectral windows to split, by id. Which channels of them are imaged is the pipeline's own selection, applied
   * at imaging time: splitting on it would renumber nothing but would discard the channels a later comparison may want. */
  readonly scienceWindows: string;
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
  readonly flagVersion: string | null; readonly plan: ImagingPlan; readonly imageBase: string;
  readonly imaging: PipelineImaging; readonly selfcal: SelfCalibration | null; readonly tableDirectory?: string;
  readonly flagStage?: string; readonly scratch?: string;
}) {
  const { asdm, applications, flagVersion, plan, imageBase, imaging, selfcal } = options;
  // Both measurement sets live on the scratch disk: the import and the corrected column are random writes that an external
  // drive serves at a tenth of its sequential rate. The calibration tables stay where they were unpacked.
  const onScratch = (name: string) => (options.scratch ? `${options.scratch}/${name}` : name);
  const visibilities = onScratch(options.visibilities), targets = onScratch(`${plan.target}.targets.ms`);
  const resolveTable = (table: string) => (options.tableDirectory ? `${options.tableDirectory}/${table}` : table);
  return [
    'import os, sys, json, shutil',
    'from casatasks import importasdm, flagmanager, applycal, mstransform, tclean, exportfits, casalog',
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
    // Restoring flags and applying the calibration are one step: restoring the flags again would undo what calflagstrict
    // flagged. A marker records that both finished, so a later failure does not repeat an hour of applycal.
    `calibrated = ${python(`${visibilities}.calibrated`)}`,
    'if not os.path.exists(calibrated):',
    ...[...(flagVersion === null ? ["steps.append('no flag version restored')"] : [
      // Replace the filler's empty flag versions with the pipeline's before restoring from them.
      `shutil.rmtree(${python(`${visibilities}.flagversions`)}, ignore_errors=True)`,
      `shutil.copytree(os.path.join(${python(options.flagStage ?? '.')}, ${python(`${options.visibilities}.flagversions`)}), ${python(`${visibilities}.flagversions`)})`,
      `flagmanager(vis=${python(visibilities)}, mode='restore', versionname=${python(flagVersion)})`,
      "steps.append('flags restored')",
    ]),
    ...applications.flatMap(application => [applycalStatement(application, visibilities), `steps.append('applycal ' + ${python(application.intent)})`]),
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
    // The imaging the pipeline itself performed, from the command log it shipped.
    `tclean(vis=${python(targets)}, imagename=${python(imageBase)}, field=${python(plan.target)}, spw=${python(imaging.spw)}, ` +
      `${imaging.scan === null ? '' : `scan=${python(imaging.scan)}, `}${imaging.intent === null ? '' : `intent=${python(imaging.intent)}, `}` +
      `datacolumn='corrected', specmode='mfs', deconvolver=${python(imaging.deconvolver)}${imaging.terms > 1 ? `, nterms=${imaging.terms}` : ''}, ` +
      `gridder='standard', imsize=[${imaging.imageSize[0]}, ${imaging.imageSize[1]}], cell=${python(imaging.cell)}, ` +
      `weighting=${python(imaging.weighting)}, robust=${imaging.robust}, niter=100000, threshold=${python(imaging.threshold)}, ` +
      "restoringbeam='common', pbcor=True, interactive=False)",
    "steps.append('tclean')",
    `exportfits(imagename=${python(`${imageBase}.image.pbcor`)}, fitsimage=${python(`${imageBase}.fits`)}, overwrite=True, dropdeg=False)`,
    "steps.append('exportfits')",
    `open(${python(`${imageBase}.steps.json`)}, 'w').write(json.dumps(steps, indent=1))`,
    "print('restore complete:', ', '.join(steps))",
  ].join('\n') + '\n';
}

/** The flag version the pipeline left behind, from the names its flagversions archive carries. */
export function pipelineFlagVersion(names: readonly string[]) {
  // The pipeline's last save before imaging; its own restore uses this name.
  const wanted = ['Pipeline_Final', 'statwt_1', 'Applycal'];
  for (const name of wanted) if (names.includes(name)) return name;
  return null;
}

/** A macOS volume that is not HFS+ carries an AppleDouble twin beside every file, and those twins are not the data. */
const real = (name: string) => !name.split('/').some(part => part.startsWith('._'));

async function findOne(directory: string, matches: (name: string) => boolean, what: string, deep = true) {
  const names = (await readdir(directory, { recursive: deep })).filter(real);
  const found = names.filter(name => matches(basename(name)));
  if (found.length !== 1) throw new Error(`Expected one ${what} under ${directory}, found ${found.length}.`);
  return resolve(directory, found[0]!);
}

/** The flag versions the pipeline saved: each is a directory `flags.<name>` inside `<measurement set>.flagversions`. */
export async function savedFlagVersions(calibration: string) {
  const names = (await readdir(calibration, { withFileTypes: true })).filter(entry => real(entry.name));
  const archive = names.find(entry => entry.isDirectory() && entry.name.endsWith('.ms.flagversions'));
  if (!archive) return [];
  const versions = (await readdir(resolve(calibration, archive.name), { withFileTypes: true })).filter(entry => real(entry.name));
  return versions.filter(entry => entry.isDirectory() && entry.name.startsWith('flags.')).map(entry => entry.name.slice('flags.'.length));
}

export async function restoreExecution(directory: string, plan: ImagingPlan, options: { readonly scratch?: string } = {}) {
  const work = resolve(directory), unpacked = resolve(work, 'unpacked');
  await mkdir(unpacked, { recursive: true });
  const run = (command: string, args: readonly string[], cwd: string) => {
    const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
    if (result.status !== 0) throw new Error(`${command} ${args[0]} failed (status ${result.status}).`);
  };
  // Both tarballs unpack into one tree. Extracting 23 GB again on a rerun costs a quarter of an hour for nothing.
  const asdmPresent = await readdir(unpacked, { recursive: true })
    .then(names => names.some(name => name.endsWith('.asdm.sdm')), () => false);
  if (!asdmPresent) run('tar', ['xf', resolve(work, 'asdm.tar'), '-C', unpacked], work);
  run('tar', ['xf', resolve(work, 'auxiliary.tar'), '-C', unpacked], work);
  const record = await findOne(unpacked, name => name.endsWith('.ms.calapply.txt'), 'calapply record');
  const applications = parseCalibrationRecord(await readFile(record, 'utf8'));
  const calibration = resolve(work, 'calibration');
  await mkdir(calibration, { recursive: true });
  const caltables = await findOne(unpacked, name => name.endsWith('.caltables.tgz'), 'calibration table archive');
  run('tar', ['xzf', caltables, '-C', calibration], work);
  // importasdm writes its own <vis>.flagversions and refuses to start if that name is taken, so the pipeline's copy is staged
  // elsewhere and moved in afterwards. hifa_restoredata does the same: remove the filler's version, restore the delivered one.
  const flagStage = resolve(work, 'flagversions');
  await mkdir(flagStage, { recursive: true });
  const flags = await findOne(unpacked, name => name.endsWith('.ms.flagversions.tgz'), 'flag version archive');
  run('tar', ['xzf', flags, '-C', flagStage], work);
  // The auxiliary products carry the self-calibration solutions and the record that says how to apply them.
  const products = resolve(work, 'auxproducts');
  await mkdir(products, { recursive: true });
  const auxproducts = await findOne(unpacked, name => name.endsWith('.auxproducts.tgz'), 'auxiliary product archive');
  run('tar', ['xzf', auxproducts, '-C', products], work);
  const staged = (await readdir(calibration)).filter(real);
  const missing = requiredTables(applications).filter(table => !staged.includes(table));
  if (missing.length) throw new Error(`The calibration archive is missing ${missing.length} table(s) the record applies: ${missing[0]}`);
  const versions = await savedFlagVersions(flagStage);
  const flagVersion = pipelineFlagVersion(versions);
  // The pipeline's flags are half of what restoring means; running without them would calibrate data it had thrown away.
  if (flagVersion === null) throw new Error(`The delivery saved no flag version this route recognises (found ${versions.join(', ') || 'none'}).`);
  // The delivery nests the ASDM under its project, science goal, group and member, and names it with the suffix the archive
  // gives the tarball. importasdm takes the directory; the measurement set is named for the execution, without the suffix.
  const asdm = await findOne(unpacked, name => /^uid___A002_[0-9A-Za-z_]+\.asdm\.sdm$/u.test(name), 'raw ASDM directory');
  const execution = basename(asdm).replace(/\.asdm\.sdm$/u, '');
  const visibilities = `${execution}.ms`;

  const log = await findOne(unpacked, name => name.endsWith('.casa_commands.log'), 'pipeline command log');
  const imaging = pipelineImaging(await readFile(log, 'utf8'), plan.target);
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
  const script = restoreScript({ asdm, visibilities, applications, flagVersion, plan, imaging, selfcal, scratch,
    flagStage, tableDirectory: workdir ? resolve(products, workdir.name) : undefined, imageBase: resolve(work, `${plan.target}.restored`) });
  const scriptPath = resolve(work, 'restore.py');
  await writeFile(scriptPath, script);
  const casa = await toolchainPath('casa');
  run(resolve(casa, 'venv/bin/python'), [scriptPath], calibration);
  return { script: scriptPath, image: resolve(work, `${plan.target}.restored.fits`), applications: applications.length,
    imaging, selfcal, flagVersion };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [directory] = process.argv.slice(2);
  if (!directory) throw new TypeError('Usage: alma-restore.mts <working directory> --target <field>');
  const argument = (name: string, fallback: string) => {
    const index = process.argv.indexOf(`--${name}`);
    return index > 0 ? process.argv[index + 1] ?? fallback : fallback;
  };
  const scratch = argument('scratch', '');
  const result = await restoreExecution(directory, { target: argument('target', 'R_Dor'), scienceWindows: argument('spw', '25,27,29,31') },
    scratch ? { scratch } : {});
  console.log(`Restored flags ${result.flagVersion} and applied ${result.applications} calibration steps.`);
  console.log(result.selfcal?.succeeded
    ? `Self-calibrated at ${result.selfcal.solutionInterval} with ${result.selfcal.tables.length} table(s), ${result.selfcal.applyMode}.`
    : 'No self-calibration in this delivery.');
  console.log(`Imaged with ${result.imaging.deconvolver}${result.imaging.terms > 1 ? ` (${result.imaging.terms} terms)` : ''} at ${result.imaging.cell}; image at ${result.image}`);
}
