#!/usr/bin/env node
/** Restore one MANUALLY reduced ALMA execution from its raw visibilities and image it, then check the result against the
 * archive's own image.
 *
 *   node tools/objects/interferometry/alma-restore-manual.mts <working directory> --target Europa [--scratch <dir>] [--archive <fits>]
 *
 * `alma-restore.mts` restores a pipeline delivery: it replays the `calapply` record and the pipeline's own tclean call. A
 * manual delivery has neither. What it ships instead is the reduction script a person wrote — numbered CASA steps — plus the
 * tables those steps solved, the CASA log of the run, the two imaging scripts and the CLEAN mask the reducer drew by hand.
 * This route replays those: `alma-manual-calibration.mts` reads the calibration script, the delivery's log supplies the one
 * value the script computes rather than states, and the imaging scripts supply the image.
 *
 * The 2015 script is never executed. It was written for CASA 4.5.0 and would re-solve, on this machine, every table the
 * delivery already carries; its steps are replayed with casatasks 6.7 instead. Three things then differ by construction and
 * are stated rather than tuned away:
 *
 *   - the ASDM is imported lazily, so the visibilities stay in its binary files instead of being copied into the measurement
 *     set. This changes what the disk holds, not what is calibrated.
 *   - `clean` is gone; `tclean` replaces it, and `manualTcleanArguments` names every substitution.
 *   - the reducer cleaned interactively, drawing the mask as they watched. A headless run cannot, so it is given the mask they
 *     drew, which the delivery ships in `product/`. Nothing here invents a mask or a stopping threshold.
 *
 * The run writes a `cssearth-telescope-product@1` record beside the restored image (`<image>.fits.product.json`): the delivery
 * files it replayed at their digests, the generated CASA script, the pinned CASA, and the image with the units and conventions
 * its own header states. Its evidence list starts empty; with `--archive`, the comparison with the archive's own image of the
 * same execution is written beside the image and added to that record as `archive-agreement` evidence. An image whose record
 * says this same restore made it is not restored again.
 *
 * Europa is an ephemeris field: it moves several arcseconds across one execution, far more than the 0.77 arcsecond disc, so
 * the image must follow the ephemeris importasdm attached. The run checks for that ephemeris and images with
 * `phasecenter='TRACKFIELD'`; a field that turns out not to carry one stops the route rather than being imaged smeared. */
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compareImages, measureSource, readContinuumImage, type ImageComparison, type SourceMeasurement } from './alma-image.mts';
import {
  manualTables, parseManualCalibration, parseScriptAssignments, parseScriptCalls, resolveNamedMaps, resolveValue,
  type ManualApplication, type ManualCalibration, type ManualFlag, type PythonValue,
} from './alma-manual-calibration.mts';
import { toolchainDescriptor, toolchainPath } from './toolchain.mts';
import { requireArray, requireString } from '@cssearth/core';
import { sha256 } from '@cssearth/core/node';
import { addProductEvidence, fileSize, productRecordPath, readProductRecord, sameRun, writeProductRecord,
  type ProductInput, type ProductRun, type ProductSoftware } from '../product-record.mts';

/** The imaging a manual delivery performed, read from the two scripts it ships instead of a command log. Both set their
 * parameters as plain variables and hand the names to the task, so the assignments are read alongside the calls. */
export interface ManualImaging {
  readonly finalVisibilities: string;
  readonly continuumVisibilities: string;
  readonly imageName: string;
  readonly field: string;
  /** The spectral windows averaged into the continuum, and how many channels of each are averaged together. Both are empty
   * when the delivery found no line emission and imaged the target split itself, with no continuum average at all; the
   * continuum measurement set is then the final one. */
  readonly continuumWindows: string;
  readonly channelWidths: readonly number[];
  readonly cell: string;
  readonly imageSize: readonly [number, number];
  readonly weighting: string;
  readonly robust: number;
  readonly iterations: number;
  readonly threshold: string;
  /** The multiscale scales the clean was given, empty when it cleaned with delta functions alone. */
  readonly scales: readonly number[];
  readonly mode: string;
  readonly pointSpreadMode: string | null;
  /** True when the reducer cleaned by hand; the mask they drew is then the only record of where they stopped. */
  readonly interactive: boolean;
  /** Whether the weights were rebuilt before averaging, as CASA 4.4 and later require for a manual reduction. */
  readonly initialisesWeights: boolean;
  /** scriptForImagingPrep's flag selections, and the intent it split the target with. */
  readonly preparationFlags: readonly Readonly<Record<string, string>>[];
  readonly targetIntent: string;
}

const listOfNumbers = (value: PythonValue | undefined, what: string) => {
  if (!Array.isArray(value) || !value.length) throw new TypeError(`${what} is not a list of numbers in the imaging script.`);
  return value.map(entry => { if (typeof entry !== 'number') throw new TypeError(`${what} holds something that is not a number.`); return entry; });
};
const stringOf = (value: PythonValue | undefined, what: string) => {
  if (typeof value !== 'string') throw new TypeError(`${what} is not a string in the imaging script.`);
  return value;
};
const numberOf = (value: PythonValue | undefined, what: string) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${what} is not a number in the imaging script.`);
  return value;
};

export function manualImaging(imagingScript: string, preparationScript: string): ManualImaging {
  const names = parseScriptAssignments(imagingScript);
  const calls = parseScriptCalls(imagingScript);
  const resolved = (value: PythonValue | undefined) => (value === undefined ? undefined : resolveValue(value, names));
  // split2 was CASA 4.4's channel average, the one that weights the result properly; CASA 6 has only split, which does the same.
  const average = calls.find(call => (call.task === 'split2' || call.task === 'split') && call.keywords.has('width'));
  if (!average) throw new TypeError('The imaging script averages no continuum.');
  const cleans = calls.filter(call => call.task === 'clean' || call.task === 'tclean');
  if (cleans.length !== 1) throw new TypeError(`The imaging script cleans ${cleans.length} times; one was expected.`);
  const clean = cleans[0]!;
  const size = listOfNumbers(resolved(clean.keywords.get('imsize')), 'imsize');
  if (size.length !== 2) throw new TypeError('The imaging script states an image size that is not two numbers.');
  const preparation = parseScriptCalls(preparationScript);
  const preparationNames = parseScriptAssignments(preparationScript);
  const split = preparation.filter(call => call.task === 'split').at(-1);
  if (!split) throw new TypeError('The imaging preparation script splits no target out.');
  return {
    finalVisibilities: stringOf(resolved(average.keywords.get('vis')), 'the averaged measurement set'),
    continuumVisibilities: stringOf(resolved(average.keywords.get('outputvis')), 'the continuum measurement set'),
    imageName: stringOf(resolved(clean.keywords.get('imagename')), 'imagename'),
    field: stringOf(resolved(clean.keywords.get('field')), 'field'),
    continuumWindows: stringOf(resolved(average.keywords.get('spw')), 'the continuum spectral windows'),
    channelWidths: listOfNumbers(resolved(average.keywords.get('width')), 'width'),
    cell: stringOf(resolved(clean.keywords.get('cell')), 'cell'),
    imageSize: [size[0]!, size[1]!],
    weighting: stringOf(resolved(clean.keywords.get('weighting')), 'weighting'),
    robust: numberOf(resolved(clean.keywords.get('robust')), 'robust'),
    iterations: numberOf(resolved(clean.keywords.get('niter')), 'niter'),
    threshold: stringOf(resolved(clean.keywords.get('threshold')), 'threshold'),
    scales: listOfNumbers(resolved(clean.keywords.get('multiscale')), 'multiscale'),
    mode: stringOf(resolved(clean.keywords.get('mode')), 'mode'),
    pointSpreadMode: clean.keywords.has('psfmode') ? stringOf(resolved(clean.keywords.get('psfmode')), 'psfmode') : null,
    interactive: resolved(clean.keywords.get('interactive')) === true,
    initialisesWeights: calls.some(call => call.task === 'initweights'),
    preparationFlags: preparation.filter(call => call.task === 'flagdata').map(call => Object.fromEntries(
      ['mode', 'uvrange', 'spw', 'antenna', 'timerange', 'action'].flatMap(key => {
        const value = resolveValue(call.keywords.get(key) ?? '', preparationNames);
        return typeof value === 'string' && value.length ? [[key, value] as const] : [];
      }))),
    targetIntent: stringOf(resolved(split.keywords.get('intent')), 'the target split intent'),
  };
}

/** The CASA 4 `clean` arguments as CASA 6 `tclean` takes them, with every substitution named.
 *
 * `psfmode` chose CLEAN's minor cycle and has no tclean argument; with `multiscale` set, the minor cycle is the multiscale one
 * either way. `imagermode='csclean'` is tclean's default `gridder='standard'`. `interactive=True` means the reducer drew the
 * mask by hand, so a headless replay is given that mask rather than a threshold invented here. */
export function manualTcleanArguments(imaging: ManualImaging) {
  if (imaging.mode !== 'mfs') throw new TypeError(`This route replays continuum imaging; the script cleans in ${imaging.mode}.`);
  if (imaging.weighting !== 'briggs') throw new TypeError(`This route replays Briggs weighting; the script weights ${imaging.weighting}.`);
  return new Map<string, PythonValue>([
    ['specmode', 'mfs'], ['deconvolver', 'multiscale'], ['scales', imaging.scales], ['gridder', 'standard'],
    ['imsize', [...imaging.imageSize]], ['cell', imaging.cell], ['weighting', imaging.weighting], ['robust', imaging.robust],
    ['niter', imaging.iterations], ['threshold', imaging.threshold], ['interactive', false], ['pbcor', true],
  ]);
}

const python = (value: PythonValue): string => {
  if (typeof value === 'string') return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return `[${value.map(entry => python(entry)).join(', ')}]`;
  throw new TypeError('A value the restore script cannot write as a Python literal.');
};
const keywords = (values: Iterable<readonly [string, PythonValue]>) => [...values].map(([name, value]) => `${name}=${python(value)}`).filter(part => part.length > 0).join(', ');
const call = (task: string, parts: readonly string[]) => `${task}(${parts.filter(part => part.length > 0).join(', ')})`;

/** One flagdata or flagcmd call from the reduction script, written against the measurement set the replay has. */
function flagStatement(flag: ManualFlag, visibilities: string) {
  const selections: [string, PythonValue][] = Object.entries(flag.selections);
  if (flag.task === 'flagcmd') return `flagcmd(vis=${python(visibilities)}, inpmode='table', useapplied=True, action='apply')`;
  return call('flagdata', [`vis=${python(visibilities)}`, `mode=${python(flag.mode)}`,
    keywords([...selections, ...(flag.autocorrelations ? [['autocorr', true] as const] : [])]), 'flagbackup=False']);
}

/** One applycal from the reduction script, with any named spectral-window map replaced by the list the delivery's log records. */
function applycalStatement(application: ManualApplication, visibilities: string, maps: ReadonlyMap<string, readonly number[]>, tableDirectory: string) {
  const spwmap = application.tables.map(table => {
    if (Array.isArray(table.spwmap)) return [...table.spwmap];
    const named = (table.spwmap as { named: string }).named;
    const resolved = maps.get(table.gaintable);
    if (!resolved) throw new Error(`The script passes ${named} to applycal for ${table.gaintable}, and the delivery's log does not record it.`);
    return [...resolved];
  });
  return call('applycal', [`vis=${python(visibilities)}`, `field=${python(application.field)}`,
    application.spw ? `spw=${python(application.spw)}` : '',
    `gaintable=${python(application.tables.map(table => `${tableDirectory}/${table.gaintable}`))}`,
    `gainfield=${python(application.tables.map(table => table.gainfield))}`, `interp=${python(application.interpolation)}`,
    // An applycal the script gave no map is left without one; a list of empty lists would say the same thing less clearly.
    spwmap.some(map => map.length) ? `spwmap=${python(spwmap)}` : '',
    `calwt=${python(application.calibrateWeights)}`, 'flagbackup=False']);
}

export interface ManualRestoreOptions {
  readonly asdm: string;
  readonly calibration: ManualCalibration;
  readonly maps: ReadonlyMap<string, readonly number[]>;
  readonly imaging: ManualImaging;
  readonly target: string;
  readonly tableDirectory: string;
  /** The CLEAN mask the reducer drew, unpacked from the delivery's products, or null to clean the whole field. */
  readonly mask: string | null;
  readonly scratch: string;
  readonly imageBase: string;
}

/** The CASA script for one manual restore: import, flags, observatory calibration, split, calibrator calibration, split,
 * imaging preparation, channel average, tclean, export. Written out rather than hidden in a task, so the run can be read
 * against the delivery's own log. */
export function manualRestoreScript(options: ManualRestoreOptions) {
  const { calibration, imaging, maps, target, tableDirectory } = options;
  const at = (name: string) => `${options.scratch}/${name}`;
  const raw = at(calibration.measurementSet);
  const split = at(basename(calibration.scienceSplit.outputVisibilities));
  const calibrated = at(basename(calibration.finalSplit.outputVisibilities));
  const final = at(basename(imaging.finalVisibilities));
  const continuum = at(basename(imaging.continuumVisibilities));
  // The image is named for the target, not for the delivery's `calibrated_final_cont`: that name is one dot away from the
  // continuum measurement set, and clearing `<name>.*` before a clean would take the measurement set with it.
  const imaged = at(`${target}.restored`);
  const tclean = manualTcleanArguments(imaging);
  return [
    'import os, sys, json, shutil, glob',
    'from casatools import table',
    'from casatasks import importasdm, flagdata, flagcmd, applycal, split, setjy, initweights, tclean, exportfits, casalog',
    `casalog.setlogfile(${python(`${options.imageBase}.casa.log`)})`,
    'steps = []',
    `ready = ${python(`${continuum}.ready`)}`,
    'if not os.path.exists(ready):',
    ...[
      // A measurement set left by an interrupted task looks whole to every later one, so each stage writes a marker and only a
      // marked stage is reused. The stages run in the reduction script's own order.
      'def stage(marker, work):',
      '    if os.path.exists(marker): return False',
      '    work()',
      "    open(marker, 'w').close()",
      '    return True',
      'def drop(*paths):',
      '    for path in paths:',
      "        shutil.rmtree(path, ignore_errors=True); shutil.rmtree(path + '.flagversions', ignore_errors=True)",
      // The lazy import leaves the visibilities in the ASDM's binary files, so the measurement set holds metadata, flags and
      // the corrected column. The corrected column of the full set, both splits and the averaged continuum need about four
      // times the ASDM once over.
      `need = sum(os.path.getsize(os.path.join(root, name)) for root, _, names in os.walk(${python(options.asdm)}) for name in names)`,
      `free = shutil.disk_usage(${python(options.scratch)}).free`,
      'if free < 4.5 * need:',
      "    sys.exit(f'The scratch disk has {free / 1e9:.0f} GB free; this restore needs about {4.5 * need / 1e9:.0f} GB.')",
      'def do_import():',
      `    drop(${python(raw)})`,
      // The reduction script imports with lazy=False; lazy=True reads the visibilities from the ASDM in place instead of
      // copying them, which changes what the disk holds and not what is calibrated. Every other argument is the script's.
      `    importasdm(asdm=${python(options.asdm)}, vis=${python(raw)}, ${keywords([...calibration.importAsdm].flatMap(([name, value]): readonly (readonly [string, PythonValue])[] =>
        name === 'lazy' ? [['lazy', true]] : (name === 'vis' || typeof value === 'object' ? [] : [[name, value]])))})`,
      `if stage(${python(`${raw}.imported`)}, do_import): steps.append('importasdm (lazy)')`,
      'def do_apriori():',
      ...calibration.aprioriFlags.map(flag => `    ${flagStatement(flag, raw)}`),
      ...calibration.observatoryApplications.map(application => `    ${applycalStatement(application, raw, maps, tableDirectory)}`),
      `if stage(${python(`${raw}.calibrated`)}, do_apriori): steps.append('a-priori flags and observatory calibration on ${calibration.observatoryApplications.length} fields')`,
      'def do_science_split():',
      `    drop(${python(split)})`,
      `    split(vis=${python(raw)}, outputvis=${python(split)}, datacolumn=${python(calibration.scienceSplit.dataColumn)}, ` +
        `spw=${python(calibration.scienceSplit.spw)}, keepflags=${python(calibration.scienceSplit.keepFlags)})`,
      `if stage(${python(`${split}.ready`)}, do_science_split): steps.append('split science windows ${calibration.scienceSplit.spw}')`,
      `drop(${python(raw)})`,
      'def do_calibrate():',
      ...calibration.initialFlags.map(flag => `    ${flagStatement(flag, split)}`),
      // setjy puts the flux calibrator's model in the measurement set. The delivered gain tables already carry that scale, so
      // this changes nothing that is applied; it is replayed because the script states it, and because the number it sets is
      // the one the published re-reduction corrected.
      `    setjy(vis=${python(split)}, standard=${python(calibration.fluxScale.standard)}, field=${python(calibration.fluxScale.field)}, ` +
        `fluxdensity=${python([calibration.fluxScale.fluxDensityJy, 0, 0, 0])}, spix=${python(calibration.fluxScale.spectralIndex)}, ` +
        `reffreq=${python(calibration.fluxScale.referenceFrequency)})`,
      ...calibration.calibratorApplications.map(application => `    ${applycalStatement({ ...application, spw: '' }, split, maps, tableDirectory)}`),
      `if stage(${python(`${split}.calibrated`)}, do_calibrate): steps.append('initial flags, flux scale ${calibration.fluxScale.fluxDensityJy.toFixed(4)} Jy and calibrator calibration')`,
      'def do_calibrated_split():',
      `    drop(${python(calibrated)})`,
      `    split(vis=${python(split)}, outputvis=${python(calibrated)}, datacolumn=${python(calibration.finalSplit.dataColumn)}, ` +
        `antenna=${python(calibration.finalSplit.antenna)}, keepflags=${python(calibration.finalSplit.keepFlags)})`,
      `if stage(${python(`${calibrated}.ready`)}, do_calibrated_split): steps.append('split calibrated antennas ${calibration.finalSplit.antenna}')`,
      `drop(${python(split)})`,
      'def do_prepare():',
      ...imaging.preparationFlags.map(selections => `    flagdata(vis=${python(calibrated)}, ${keywords(Object.entries(selections))}, flagbackup=False)`),
      `    drop(${python(final)})`,
      `    split(vis=${python(calibrated)}, outputvis=${python(final)}, intent=${python(imaging.targetIntent)}, datacolumn='data')`,
      ...(imaging.initialisesWeights ? [`    initweights(vis=${python(final)}, wtmode='weight', dowtsp=True)`] : []),
      `if stage(${python(`${final}.ready`)}, do_prepare): steps.append('imaging preparation: ${imaging.preparationFlags.length} flag selection(s), target split, weights')`,
      'def do_average():',
      `    drop(${python(continuum)})`,
      // split2's width is one entry per selected window, which is what makes the averaged weights right.
      `    split(vis=${python(final)}, outputvis=${python(continuum)}, spw=${python(imaging.continuumWindows)}, ` +
        `width=${python([...imaging.channelWidths])}, datacolumn='data')`,
      'do_average()',
      `steps.append('averaged spw ${imaging.continuumWindows} by ${imaging.channelWidths.join(',')}')`,
      "open(ready, 'w').close()",
    ].map(line => `    ${line}`),
    // Europa's apparent motion over one execution is several arcseconds, many times its 0.77 arcsecond disc, so the image has
    // to follow the ephemeris the ASDM carries. A field without one would be imaged at a fixed direction and smeared.
    `tb = table(); tb.open(${python(`${continuum}/FIELD`)})`,
    "ephemeris = 'EPHEMERIS_ID' in tb.colnames() and int(tb.getcol('EPHEMERIS_ID').max()) >= 0",
    'tb.close()',
    `if not ephemeris: sys.exit('The target field carries no ephemeris, so a moving body would be imaged smeared.')`,
    "steps.append('field carries an ephemeris; imaging with phasecenter TRACKFIELD')",
    `for product in glob.glob(${python(`${imaged}.*`)}):`,
    '    if os.path.isdir(product): shutil.rmtree(product)',
    // The imaging script names the target by the id it had before the target split, and CASA 6's split renumbers fields where
    // CASA 4's did not. The name selects the same field under either, so the target is named.
    `tclean(vis=${python(continuum)}, imagename=${python(imaged)}, field=${python(target)}, phasecenter='TRACKFIELD', ` +
      `${keywords(tclean)}${options.mask === null ? '' : `, mask=${python(options.mask)}`})`,
    `steps.append('tclean ${imaging.weighting} robust ${imaging.robust}, ${imaging.iterations} iterations, multiscale ${imaging.scales.join(',')}${options.mask === null ? ', no mask' : ', delivered mask'}')`,
    `exportfits(imagename=${python(`${imaged}.image.pbcor`)}, fitsimage=${python(`${options.imageBase}.fits`)}, overwrite=True, dropdeg=False)`,
    "steps.append('exportfits')",
    `open(${python(`${options.imageBase}.steps.json`)}, 'w').write(json.dumps(steps, indent=1))`,
    "print('manual restore complete:', ', '.join(steps))",
  ].join('\n') + '\n';
}

/** A macOS volume that is not HFS+ carries an AppleDouble twin beside every file, and those twins are not the data. */
const real = (name: string) => !name.split('/').some(part => part.startsWith('._'));

async function findOne(directory: string, matches: (name: string) => boolean, what: string) {
  const names = (await readdir(directory, { recursive: true })).filter(real);
  const found = names.filter(name => matches(basename(name)));
  if (found.length !== 1) throw new Error(`Expected one ${what} under ${directory}, found ${found.length}.`);
  return resolve(directory, found[0]!);
}

const run = (command: string, args: readonly string[], cwd: string) => {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} ${args[0]} failed (status ${result.status}).`);
};

/** The delivery files one restore replays, at their bytes and digests.
 *
 * An ASDM holds tens of gigabytes of binary visibilities whose bytes say nothing another execution's do not, and reading them
 * all would cost more than the import does; the XML tables that state which execution, which antennas and which scans these
 * are carry its identity, as the metadata tables do for a measurement set (alma-disc-selfcal.mts). Everything else the replay
 * reads is a file of its own. */
export async function manualDeliveryPins(files: { readonly asdm: string; readonly calibrationScript: string; readonly imagingScript: string;
  readonly preparationScript: string; readonly log: string; readonly tables: string; readonly mask: string | null }): Promise<ProductInput[]> {
  let bytes = 0;
  for (const table of ['ASDM.xml', 'ExecBlock.xml', 'Main.xml', 'Antenna.xml']) bytes += (await fileSize(resolve(files.asdm, table))).bytes;
  const pin = async (role: string, path: string): Promise<ProductInput> => ({ role, identity: basename(path), ...(await fileSize(path)) });
  return [
    { role: 'raw ASDM (ASDM, ExecBlock, Main and Antenna tables)', identity: basename(files.asdm), bytes },
    await pin('manual reduction script', files.calibrationScript),
    await pin('imaging script', files.imagingScript),
    await pin('imaging preparation script', files.preparationScript),
    await pin('reduction log, which states the spectral-window map the script computes', files.log),
    await pin('delivered calibration tables', files.tables),
    ...(files.mask === null ? [] : [await pin('CLEAN mask the reducer drew', files.mask)]),
  ];
}

/** What identifies one manual restore: the delivery files it replays, the CASA script generated from them (which carries every
 * parameter, path and substitution this route makes), and the pinned CASA that runs it. */
export const manualRestoreRun = (inputs: readonly ProductInput[], parameters: { readonly target: string; readonly script: string; readonly mask: string | null },
  software: readonly ProductSoftware[], toolchainDigest: string): ProductRun => ({
  telescope: 'ALMA', stage: 'restore-manual', inputs,
  parameters: { target: parameters.target, restoreScript: sha256(parameters.script), mask: parameters.mask === null ? 'none' : basename(parameters.mask) },
  software, toolchainDigest,
});

/** The pinned CASA a replay runs on, as the record states it. */
export async function casaSoftware(): Promise<{ toolchainDigest: string; software: readonly ProductSoftware[] }> {
  const toolchain = await toolchainDescriptor('casa');
  return { toolchainDigest: toolchain.digest, software: requireArray(toolchain.entry.requirements, 'casa requirements')
    .map(requirement => { const [name, version] = requireString(requirement, 'requirement').split('=='); return { name: name!, version: version ?? 'unpinned' }; }) };
}

export interface ManualRestoreComparison { readonly measurement: SourceMeasurement; readonly archive: SourceMeasurement; readonly difference: ImageComparison }

/** Write the comparison with the archive's own image of this execution, and add what it establishes to the record of the run
 * that made the restored image. An image with no record beside it is refused: evidence belongs to the run that made the
 * product, and nothing here states what made an image that has none. */
export async function recordArchiveComparison(image: string, archive: string, comparison: ManualRestoreComparison) {
  const receipt = `${image.replace(/\.fits$/u, '')}.archive-comparison.json`;
  await writeFile(receipt, `${JSON.stringify({ schema: 'cssearth-alma-manual-restore-comparison@1', image: basename(image), archiveImage: basename(archive), ...comparison }, null, 2)}\n`);
  await addProductEvidence(productRecordPath(image), [{ kind: 'archive-agreement', receipt: basename(receipt), product: basename(image),
    establishes: 'The image this route made from the raw visibilities, by replaying the delivery’s own reduction, agrees with the image the archive delivered for the ' +
      'same execution: the receipt holds the peak, the noise, the half-power disc, the beam and the correlation of the two. It establishes that the replay reproduces the ' +
      'reduction that was delivered, and nothing about the body it shows.' }], recorded => resolve(dirname(image), recorded));
  return receipt;
}

export async function restoreManualExecution(directory: string, options: { readonly target: string; readonly scratch?: string; readonly archive?: string; readonly mask?: boolean; readonly dryRun?: boolean } = { target: 'Europa' }) {
  const work = resolve(directory), unpacked = resolve(work, 'unpacked');
  await mkdir(unpacked, { recursive: true });
  const aux = resolve(work, 'aux');
  const script = await findOne(aux, name => name.endsWith('.ms.scriptForCalibration.py'), 'manual reduction script');
  const calibration = parseManualCalibration(await readFile(script, 'utf8'));
  // The reduction log states the one value the script computes instead of writing: the Tsys spectral-window map.
  const logs = resolve(work, 'logs');
  await mkdir(logs, { recursive: true });
  for (const archive of (await readdir(resolve(aux, 'log'))).filter(real)) run('tar', ['xzf', resolve(aux, 'log', archive), '-C', logs], work);
  let maps: ReadonlyMap<string, readonly number[]> | null = null, mapLog: string | null = null;
  for (const name of (await readdir(logs)).filter(real)) {
    try { maps = resolveNamedMaps(calibration, await readFile(resolve(logs, name), 'utf8')); mapLog = resolve(logs, name); break; } catch { continue; }
  }
  if (!maps || !mapLog) throw new Error(`No log in ${logs} records the spectral-window maps the reduction script names.`);
  const imagingScript = resolve(aux, 'script/scriptForImaging.py'), preparationScript = resolve(aux, 'script/scriptForImagingPrep.py');
  const imaging = manualImaging(await readFile(imagingScript, 'utf8'), await readFile(preparationScript, 'utf8'));

  const tables = resolve(work, 'calibration');
  await mkdir(tables, { recursive: true });
  const bundle = await findOne(resolve(aux, 'calibration'), name => name.endsWith('.calibration.tgz'), 'calibration table archive');
  const tableDirectory = resolve(tables, basename(bundle).replace(/\.tgz$/u, ''));
  if (!await readdir(tableDirectory).then(() => true, () => false)) run('tar', ['xzf', bundle, '-C', tables], work);
  const staged = (await readdir(tableDirectory)).filter(real);
  const missing = manualTables(calibration).filter(table => !staged.includes(table));
  if (missing.length) throw new Error(`The delivery is missing ${missing.length} table(s) the reduction script applies: ${missing[0]}`);

  let mask: string | null = null, maskArchive: string | null = null;
  if (options.mask !== false) {
    const products = resolve(work, 'products');
    await mkdir(products, { recursive: true });
    maskArchive = await findOne(resolve(aux, 'product'), name => name.endsWith('.mask.tgz'), 'CLEAN mask archive');
    if (!(await readdir(products)).filter(real).length) run('tar', ['xzf', maskArchive, '-C', products], work);
    mask = resolve(products, (await readdir(products)).filter(real).find(name => name.endsWith('.mask'))!);
  }

  const asdmTar = await findOne(work, name => name.endsWith('.asdm.sdm.tar'), 'raw ASDM tarball');
  const present = await readdir(unpacked, { recursive: true }).then(names => names.some(name => name.endsWith('.asdm.sdm')), () => false);
  if (!present) run('tar', ['xf', asdmTar, '-C', unpacked], work);
  const asdm = await findOne(unpacked, name => /^uid___A002_[0-9A-Za-z_]+\.asdm\.sdm$/u.test(name), 'raw ASDM directory');

  const scratch = resolve(options.scratch ?? resolve(work, 'scratch'));
  await mkdir(scratch, { recursive: true });
  const imageBase = resolve(work, `${options.target}.restored`);
  const source = manualRestoreScript({ asdm, calibration, maps, imaging, target: options.target, tableDirectory, mask, scratch, imageBase });
  const path = resolve(work, 'restore-manual.py');
  await writeFile(path, source);
  const casa = await toolchainPath('casa');
  const image = `${imageBase}.fits`;
  if (options.dryRun) return { script: path, image, calibration, imaging, restored: null, comparison: null, record: null, receipt: null };

  const casaPins = await casaSoftware();
  const productRun = manualRestoreRun(await manualDeliveryPins({ asdm, calibrationScript: script, imagingScript, preparationScript, log: mapLog,
    tables: bundle, mask: maskArchive }), { target: options.target, script: source, mask: maskArchive }, casaPins.software, casaPins.toolchainDigest);
  // A restore is an import, five calibration stages and a clean; it runs for hours. It is skipped only when the record beside
  // the image says this same delivery, script and CASA made it and the image is still the file that run wrote.
  const recordPath = productRecordPath(image);
  const reused = await sameRun(await readProductRecord(recordPath), productRun, name => resolve(dirname(image), name));
  if (!reused) { await rm(recordPath, { force: true }); run(resolve(casa, 'venv/bin/python'), [path], work); }

  const restored = readContinuumImage(await readFile(image));
  if (typeof restored.header.BUNIT !== 'string') throw new Error(`${image} states no BUNIT, so the record could not say what its numbers are.`);
  if (!reused) {
    await writeProductRecord(recordPath, productRun, [{ path: basename(image), file: image, units: restored.header.BUNIT,
      conventions: { axes: [restored.header.CTYPE1, restored.header.CTYPE2].filter(value => typeof value === 'string').join(', '), phaseCentre: 'TRACKFIELD: the ephemeris the ASDM carries',
        primaryBeam: 'primary-beam corrected (tclean pbcor)', beam: 'BMAJ, BMIN and BPA in degrees, as the restoring beam' } }]);
  }
  const comparison = options.archive
    ? { measurement: measureSource(restored, 700, 600), archive: measureSource(readContinuumImage(await readFile(options.archive)), 700, 600),
      difference: compareImages(restored, readContinuumImage(await readFile(options.archive)), 600) }
    : null;
  const receipt = comparison && options.archive ? await recordArchiveComparison(image, options.archive, comparison) : null;
  return { script: path, image, calibration, imaging, restored, comparison, record: recordPath, receipt };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [directory] = process.argv.slice(2);
  if (!directory) throw new TypeError('Usage: alma-restore-manual.mts <working directory> --target <field> [--scratch <dir>] [--archive <fits>] [--no-mask]');
  const argument = (name: string) => {
    const index = process.argv.indexOf(`--${name}`);
    return index > 0 ? process.argv[index + 1] : undefined;
  };
  const result = await restoreManualExecution(directory, {
    target: argument('target') ?? 'Europa', scratch: argument('scratch'), archive: argument('archive'),
    mask: !process.argv.includes('--no-mask'), dryRun: process.argv.includes('--dry-run'),
  });
  if (!result.restored) { console.log(`Wrote ${result.script}; nothing was run.`); process.exit(0); }
  const { imaging } = result;
  console.log(`Replayed ${result.calibration.steps.size - result.calibration.solvedSteps.length} steps of a CASA ${result.calibration.casaVersion} manual reduction with casatasks 6.7.`);
  console.log(`Imaged ${imaging.imageSize[0]}x${imaging.imageSize[1]} of ${imaging.cell}, ${imaging.weighting} robust ${imaging.robust}, ${imaging.iterations} iterations.`);
  console.log(`  ${result.image}`);
  console.log(`  record ${result.record}`);
  if (result.receipt) console.log(`  archive comparison ${result.receipt}`);
  if (result.comparison) {
    const { measurement, archive, difference } = result.comparison;
    const line = (name: string, value: string) => console.log(`  ${name.padEnd(22)}${value}`);
    line('peak (Jy/beam)', `${measurement.peak.toExponential(3)} here, ${archive.peak.toExponential(3)} in the archive (ratio ${difference.peakRatio.toFixed(3)})`);
    line('noise (Jy/beam)', `${measurement.noise.toExponential(2)} here, ${archive.noise.toExponential(2)} in the archive`);
    line('half-power disc', `${measurement.halfPowerDiameterMas.toFixed(1)} mas here, ${archive.halfPowerDiameterMas.toFixed(1)} mas in the archive`);
    line('beam area ratio', difference.beamRatio.toFixed(3));
    line('correlation', `${difference.correlation.toFixed(4)} over ${difference.samples} samples`);
  }
}
