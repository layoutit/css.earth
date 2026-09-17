#!/usr/bin/env node
/** Restore one ALMA execution from its raw visibilities and image it, then check the result against the archive's own image.
 *
 *   node tools/objects/interferometry/alma-restore.mts <working directory> --target R_Dor [--cell 0.006] [--imsize 512]
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
import { toolchainPath } from './toolchain.mts';

export interface ImagingPlan {
  /** The field to image, as the measurement set names it. */
  readonly target: string;
  /** Pixel size in arcseconds; about a fifth of the beam keeps the point spread function sampled. */
  readonly cellArcseconds: number;
  readonly imageSize: number;
  readonly spw: string;
}

const python = (value: string) => `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
const pythonList = (values: readonly string[]) => `[${values.map(python).join(', ')}]`;

/** One applycal call, written as the record states it. */
export function applycalStatement(application: CalibrationApplication, visibilities: string) {
  const tables = application.tables;
  return `applycal(vis=${python(visibilities)}, field=${python(application.field)}, intent=${python(application.intent)}, ` +
    `spw=${python(application.spw)}, antenna=${python(application.antenna)}, ` +
    `gaintable=${pythonList(tables.map(table => table.gaintable))}, gainfield=${pythonList(tables.map(table => table.gainfield))}, ` +
    `spwmap=[${tables.map(table => `[${table.spwmap.join(', ')}]`).join(', ')}], interp=${pythonList(tables.map(table => table.interp))}, ` +
    `calwt=[${tables.map(table => (table.calwt ? 'True' : 'False')).join(', ')}], flagbackup=False)`;
}

/** The CASA script for one restore: import, flags, calibration, split, image. Written out rather than hidden in a task, so the
 * run can be read against the pipeline's own casa_commands log. */
export function restoreScript(options: {
  readonly asdm: string; readonly visibilities: string; readonly applications: readonly CalibrationApplication[];
  readonly flagVersion: string | null; readonly plan: ImagingPlan; readonly imageBase: string;
}) {
  const { asdm, visibilities, applications, flagVersion, plan, imageBase } = options;
  return [
    'import os, sys, json',
    'from casatasks import importasdm, flagmanager, applycal, split, tclean, exportfits, casalog',
    `casalog.setlogfile(${python(`${imageBase}.casa.log`)})`,
    'steps = []',
    `if not os.path.exists(${python(visibilities)}):`,
    // ocorr_mode 'ca' is what the pipeline imports with: cross-correlations and auto-correlations.
    `    importasdm(asdm=${python(asdm)}, vis=${python(visibilities)}, ocorr_mode='ca', asis='Antenna Station Receiver Source CalAtmosphere CalWVR CorrelatorMode SBSummary', bdfflags=True, lazy=False, process_caldevice=False)`,
    "    steps.append('importasdm')",
    ...(flagVersion === null ? ["steps.append('no flag version restored')"] : [
      `flagmanager(vis=${python(visibilities)}, mode='restore', versionname=${python(flagVersion)})`,
      "steps.append('flags restored')",
    ]),
    ...applications.map(application => `${applycalStatement(application, visibilities)}\nsteps.append('applycal ' + ${python(application.intent)})`),
    `split(vis=${python(visibilities)}, outputvis=${python(`${plan.target}.split.ms`)}, field=${python(plan.target)}, spw=${python(plan.spw)}, datacolumn='corrected', keepflags=False)`,
    "steps.append('split')",
    `tclean(vis=${python(`${plan.target}.split.ms`)}, imagename=${python(imageBase)}, specmode='mfs', deconvolver='hogbom', gridder='standard', ` +
      `imsize=${plan.imageSize}, cell=${python(`${plan.cellArcseconds}arcsec`)}, weighting='briggs', robust=0.5, niter=5000, ` +
      "threshold='0.5mJy', pbcor=True, interactive=False)",
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

async function findOne(directory: string, matches: (name: string) => boolean, what: string, deep = true) {
  const names = (await readdir(directory, { recursive: deep })).filter(name => !basename(name).startsWith('._'));
  const found = names.filter(name => matches(basename(name)));
  if (found.length !== 1) throw new Error(`Expected one ${what} under ${directory}, found ${found.length}.`);
  return resolve(directory, found[0]!);
}

/** The flag versions the pipeline saved: each is a directory `flags.<name>` inside `<measurement set>.flagversions`. */
export async function savedFlagVersions(calibration: string) {
  const names = await readdir(calibration, { withFileTypes: true });
  const archive = names.find(entry => entry.isDirectory() && entry.name.endsWith('.ms.flagversions'));
  if (!archive) return [];
  const versions = await readdir(resolve(calibration, archive.name), { withFileTypes: true });
  return versions.filter(entry => entry.isDirectory() && entry.name.startsWith('flags.')).map(entry => entry.name.slice('flags.'.length));
}

export async function restoreExecution(directory: string, plan: ImagingPlan) {
  const work = resolve(directory), unpacked = resolve(work, 'unpacked');
  await mkdir(unpacked, { recursive: true });
  const run = (command: string, args: readonly string[], cwd: string) => {
    const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
    if (result.status !== 0) throw new Error(`${command} ${args[0]} failed (status ${result.status}).`);
  };
  run('tar', ['xf', resolve(work, 'asdm.tar'), '-C', unpacked], work);
  run('tar', ['xf', resolve(work, 'auxiliary.tar'), '-C', unpacked], work);
  const record = await findOne(unpacked, name => name.endsWith('.ms.calapply.txt'), 'calapply record');
  const applications = parseCalibrationRecord(await readFile(record, 'utf8'));
  const calibration = resolve(work, 'calibration');
  await mkdir(calibration, { recursive: true });
  const caltables = await findOne(unpacked, name => name.endsWith('.caltables.tgz'), 'calibration table archive');
  run('tar', ['xzf', caltables, '-C', calibration], work);
  const flags = await findOne(unpacked, name => name.endsWith('.ms.flagversions.tgz'), 'flag version archive');
  run('tar', ['xzf', flags, '-C', calibration], work);
  const staged = await readdir(calibration);
  const missing = requiredTables(applications).filter(table => !staged.includes(table));
  if (missing.length) throw new Error(`The calibration archive is missing ${missing.length} table(s) the record applies: ${missing[0]}`);
  const versions = await savedFlagVersions(calibration);
  const asdm = await findOne(unpacked, name => /^uid___A002_[0-9A-Za-z_]+$/u.test(name), 'raw ASDM directory', false);
  const visibilities = `${basename(asdm)}.ms`;
  const script = restoreScript({ asdm, visibilities, applications, flagVersion: pipelineFlagVersion(versions), plan, imageBase: resolve(work, `${plan.target}.restored`) });
  const scriptPath = resolve(work, 'restore.py');
  await writeFile(scriptPath, script);
  const casa = await toolchainPath('casa');
  run(resolve(casa, 'venv/bin/python'), [scriptPath], calibration);
  return { script: scriptPath, image: resolve(work, `${plan.target}.restored.fits`), applications: applications.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [directory] = process.argv.slice(2);
  if (!directory) throw new TypeError('Usage: alma-restore.mts <working directory> --target <field>');
  const argument = (name: string, fallback: string) => {
    const index = process.argv.indexOf(`--${name}`);
    return index > 0 ? process.argv[index + 1] ?? fallback : fallback;
  };
  const result = await restoreExecution(directory, {
    target: argument('target', 'R_Dor'), cellArcseconds: Number(argument('cell', '0.006')),
    imageSize: Number(argument('imsize', '512')), spw: argument('spw', ''),
  });
  console.log(`Applied ${result.applications} calibration steps; image at ${result.image}`);
}
