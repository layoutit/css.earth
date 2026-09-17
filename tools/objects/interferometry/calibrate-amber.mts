#!/usr/bin/env node
/** Calibrate VLTI/AMBER visibilities from raw frames with ESO's pipeline.
 *
 *   node tools/objects/interferometry/calibrate-amber.mts <work-directory> --target <TARGET> --from <ISO> --to <ISO>
 *     --calibrator <TARGET>=<diameter mas>:<error mas> [--frames <archive.csv>] [--raw <directory>] [--selection <percent>]
 *
 * Planning (planAmberNight), from the archive's raw table: an observing block is the frames sharing tpl_start whose tpl_id is
 * AMBER_3Tstd_obs_1row, in the science block's ins_mode, with its OBJECT exposures, one DARK and one SKY; its role comes from the
 * target column. The P2VM is the latest set of four "WAVE,3TEL" and ten "3P2V" frames before the first block. Each science
 * block is calibrated with the calibrator block nearest in time.
 *
 * Reduction: amber_p2vm; amber_SciCal per block (no binning, no transfer function); amber_oimerge; amber_selector keeping the
 * best `selection` percent of frames by fringe S/N on one baseline at a time, as amdlib selects per baseline (the recipe's own
 * percentage keeps or drops whole frames across baselines); amber_trf with a one-star calibrator database holding the stated
 * diameter; amber_calibrate. The calibrated file keeps each baseline's squared visibility from its own selection; closure
 * phases and differential visibilities come from the first run (the selector leaves closure phases identical). Finally the
 * wavelengths are calibrated on the science star's CO lines (co-wavelength.mts), which the pipeline's lamp-based table misses by
 * about 2 nm near 2.3 um. */
import { readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { measureCoShift, MINIMUM_CO_CORRELATION } from './co-wavelength.mts';
import { column, esoEnvironment, frameTime, parseRawTable, queryRawTable, rawFrame, runRecipe, type RawRow } from './eso-pipeline.mts';
import { binaryTable, binaryTableHdu, numbers, primaryHdu, readFitsHdus, tableColumn, writeCell } from './fits-table.mts';
import { toolchainPath } from './toolchain.mts';

export const AMBER_COLUMNS = ['dp_id', 'dp_cat', 'dp_type', 'dp_tech', 'object', 'target', 'ob_name', 'tpl_start', 'tpl_id', 'exposure', 'ins_mode', 'release_date', 'access_estsize'];

export interface AmberBlock { readonly target: string; readonly role: 'science' | 'calibrator'; readonly start: string; readonly objects: readonly string[]; readonly dark: string; readonly sky: string }
export interface AmberPlan { readonly p2vm: { readonly wave: readonly string[]; readonly p2v: readonly string[] }; readonly blocks: readonly AmberBlock[]; readonly pairs: readonly { readonly science: number; readonly calibrator: number }[] }

export function planAmberNight(rows: readonly RawRow[], target: string, window: { readonly from?: string; readonly to?: string } = {}): AmberPlan {
  const inside = (row: RawRow) => (!window.from || row.dp_id! >= `AMBER.${window.from}`) && (!window.to || row.dp_id! <= `AMBER.${window.to}`);
  const templates = [...new Set(rows.filter(row => column(row, 'tpl_id') === 'AMBER_3Tstd_obs_1row' && inside(row)).map(row => column(row, 'tpl_start')))];
  const science = rows.find(row => column(row, 'tpl_id') === 'AMBER_3Tstd_obs_1row' && inside(row) && column(row, 'target') === target && column(row, 'dp_type') === 'OBJECT');
  if (!science) throw new Error(`The window holds no AMBER block on ${target}.`);
  const mode = column(science, 'ins_mode');
  const blocks: AmberBlock[] = [];
  for (const start of templates) {
    const frames = rows.filter(row => column(row, 'tpl_start') === start && column(row, 'ins_mode') === mode);
    const objects = frames.filter(row => column(row, 'dp_type') === 'OBJECT').map(row => row.dp_id!);
    const dark = frames.find(row => column(row, 'dp_type') === 'DARK')?.dp_id, sky = frames.find(row => column(row, 'dp_type') === 'SKY')?.dp_id;
    if (!objects.length) continue;
    if (!dark || !sky) throw new Error(`Block ${start} lacks its ${dark ? 'SKY' : 'DARK'} frame.`);
    const name = column(frames[0]!, 'target');
    blocks.push({ target: name, role: name === target ? 'science' : 'calibrator', start, objects, dark, sky });
  }
  const first = frameTime(blocks[0]!.objects[0]!);
  const earlier = rows.filter(row => column(row, 'ins_mode') === mode && frameTime(row.dp_id!) < first);
  const p2v = earlier.filter(row => column(row, 'dp_type') === '3P2V').slice(-10);
  if (p2v.length !== 10) throw new Error('No set of ten 3P2V frames precedes the first block.');
  const wave = earlier.filter(row => column(row, 'dp_type') === 'WAVE,3TEL' && frameTime(row.dp_id!) < frameTime(p2v[0]!.dp_id!)).slice(-4);
  if (wave.length !== 4) throw new Error('No set of four WAVE,3TEL frames precedes the P2V frames.');
  const calibrators = blocks.map((block, index) => ({ block, index })).filter(entry => entry.block.role === 'calibrator');
  if (!calibrators.length) throw new Error('The window holds no calibrator block.');
  const pairs = blocks.flatMap((block, index) => block.role !== 'science' ? [] : [{ science: index,
    calibrator: calibrators.reduce((best, entry) => Math.abs(frameTime(entry.block.objects[0]!) - frameTime(block.objects[0]!)) < Math.abs(frameTime(best.block.objects[0]!) - frameTime(block.objects[0]!)) ? entry : best).index }]);
  return { p2vm: { wave: wave.map(row => row.dp_id!), p2v: p2v.map(row => row.dp_id!) }, blocks, pairs };
}

/** A one-star calibrator database in the layout of the kit's calibrator_database_amber_K.fits. */
export function calibratorDatabase(name: string, rightAscensionDegrees: number, declinationDegrees: number, diameterMas: number, errorMas: number) {
  const hours = rightAscensionDegrees / 15, h = Math.floor(hours), m = Math.floor((hours - h) * 60), s = ((hours - h) * 60 - m) * 60;
  const absolute = Math.abs(declinationDegrees), d = Math.floor(absolute), dm = Math.floor((absolute - d) * 60), ds = ((absolute - d) * 60 - dm) * 60;
  const columns = [['Name', '30A'], ['hourRA', 'J'], ['minuteRA', 'J'], ['secondRA', 'D'], ['signDEC', 'J'], ['degreeDEC', 'J'], ['minuteDEC', 'J'], ['secondDEC', 'D'], ['pmRA', 'D'], ['pmDEC', 'D'],
    ['Sp', '5A'], ['L', '5A'], ['SpInfo', '30A'], ['flag', 'J'], ['Teff', 'D'], ['logg', 'D'], ['pi', 'D'], ['epi', 'D'], ['diameterErr', 'D'], ['diameter', 'D'], ['V_band', 'D'], ['J_band', 'D'], ['H_band', 'D'], ['K_band', 'D'], ['N_band', 'D']]
    .map(([columnName, form]) => ({ name: columnName!, form: form! }));
  const row = [name, h, m, s, declinationDegrees < 0 ? -1 : 1, d, dm, ds, 0, 0, '', '', 'stated diameter', 1, 0, 0, 0, 0, errorMas, diameterMas, 0, 0, 0, 0, 0];
  return Buffer.concat([primaryHdu([['ORIGIN', 'cssEarth calibrate-amber.mts']]), binaryTableHdu('CALIBRATOR_DATA', columns, [row], [])]);
}

/** The station pair of each OI_VIS2 row, so squared visibilities can be taken per baseline from separate selections. */
const baselines = (bytes: Buffer) => readFitsHdus(bytes).filter(hdu => hdu.extname === 'OI_VIS2').flatMap(hdu => {
  const table = binaryTable(hdu);
  return Array.from({ length: table.rows }, (_, row) => ({ table, row, stations: numbers(bytes, table, row, tableColumn(table, 'STA_INDEX')).join('-') }));
});

export async function calibrateAmber(plan: AmberPlan, rawDirectory: string, work: string, prefix: string, calibration: string, calibrators: ReadonlyMap<string, { diameterMas: number; errorMas: number }>, selection = 80) {
  const eso = esoEnvironment(prefix, resolve(work, 'home')), raw = (dpId: string) => rawFrame(dpId, rawDirectory);
  const maps: [string, string][] = [[resolve(calibration, 'BadPixelMap.fits'), 'AMBER_BADPIX'], [resolve(calibration, 'FlatFieldMap.fits'), 'AMBER_FLATFIELD']];
  const p2vm = (await runRecipe(eso, work, 'p2vm', 'amber_p2vm', [...maps, ...await Promise.all(plan.p2vm.wave.map(async id => [await raw(id), 'AMBER_3WAVE'] as const)),
    ...await Promise.all(plan.p2vm.p2v.map(async id => [await raw(id), 'AMBER_3P2V'] as const))])).find(file => file.endsWith('/p2vm.fits'));
  if (!p2vm) throw new Error('amber_p2vm wrote no P2VM.');
  const reduceBlock = async (index: number) => {
    const block = plan.blocks[index]!, kind = block.role === 'science' ? 'SCIENCE' : 'CALIB';
    const reduced = await runRecipe(eso, work, `block-${index}/scical`, 'amber_SciCal', [...maps, [p2vm, 'P2VM_REDUCED'], [await raw(block.dark), `AMBER_DARK_${kind}`], [await raw(block.sky), `AMBER_SKY_${kind}`],
      ...await Promise.all(block.objects.map(async id => [await raw(id), block.role === 'science' ? 'AMBER_SCIENCE' : 'AMBER_CALIB'] as const))], ['--binning=1', '--selectPlusTrf=FALSE']);
    const merged = (await runRecipe(eso, work, `block-${index}/merge`, 'amber_oimerge', reduced.filter(file => /amber_0/u.test(file)).map(file => [file, `${kind}_REDUCED`] as const))).find(file => /merged/u.test(file));
    if (!merged) throw new Error(`amber_oimerge wrote nothing for block ${index}.`);
    const selected: string[] = [];
    for (let baseline = 0; baseline < 3; baseline++) {
      const percents = [100, 100, 100]; percents[baseline] = selection;
      const products = await runRecipe(eso, work, `block-${index}/select-b${baseline + 1}`, 'amber_selector', [[merged, `${kind}_REDUCED`]],
        ['--selection-method=Fringe_SNR_percentage_x', `--X1=${percents[0]}`, `--X2=${percents[1]}`, `--X3=${percents[2]}`, '--ANDselection=TRUE', '--AverageFrames=TRUE']);
      selected.push(products.find(file => /filtered/u.test(file))!);
    }
    return selected;
  };
  const results: string[] = [];
  for (const pair of plan.pairs) {
    const science = await reduceBlock(pair.science), calibrator = await reduceBlock(pair.calibrator), calibratorBlock = plan.blocks[pair.calibrator]!;
    const stated = calibrators.get(calibratorBlock.target);
    if (!stated) throw new Error(`No diameter was given for the calibrator ${calibratorBlock.target}.`);
    // The strict image reader refuses some AMBER header cards; the table reader keeps the ones it can parse, RA and DEC among them.
    const header = readFitsHdus(await readFile(await raw(calibratorBlock.objects[0]!)))[0]!.header;
    const database = resolve(work, `calibrator-${calibratorBlock.target}.fits`);
    await writeFile(database, calibratorDatabase(calibratorBlock.target, Number(header.RA), Number(header.DEC), stated.diameterMas, stated.errorMas));
    const calibrated: Buffer[] = [];
    for (let baseline = 0; baseline < 3; baseline++) {
      const transfer = (await runRecipe(eso, work, `pair-${pair.science}/trf-b${baseline + 1}`, 'amber_trf', [[calibrator[baseline]!, 'CALIB_REDUCED_FILTERED'], [database, 'CALIB_DATABASE_K']])).find(file => /trf/u.test(file));
      if (!transfer) throw new Error('amber_trf wrote no transfer function.');
      const product = (await runRecipe(eso, work, `pair-${pair.science}/calibrate-b${baseline + 1}`, 'amber_calibrate', [[science[baseline]!, 'SCIENCE_REDUCED_FILTERED'], [transfer, 'AMBER_TRF_K']])).find(file => /cal_/u.test(file));
      if (!product) throw new Error('amber_calibrate wrote no calibrated file.');
      calibrated.push(await readFile(product));
    }
    // Baseline k's squared visibilities come from the run that selected on baseline k.
    const output = Buffer.from(calibrated[0]!), rowsOut = baselines(output);
    for (let baseline = 1; baseline < 3; baseline++) {
      const source = calibrated[baseline]!, target = rowsOut[baseline]!, from = baselines(source).find(entry => entry.stations === target.stations)!;
      for (const name of ['VIS2DATA', 'VIS2ERR', 'FLAG']) {
        const values = numbers(source, from.table, from.row, tableColumn(from.table, name)), destination = tableColumn(target.table, name);
        values.forEach((value, k) => writeCell(output, target.table, target.row, destination, k, name === 'FLAG' ? value !== 0 : value));
      }
    }
    // Wavelengths from the science star's CO lines.
    const hdus = readFitsHdus(output), wavelengthTable = binaryTable(hdus.find(hdu => hdu.extname === 'OI_WAVELENGTH')!), spectrum = binaryTable(hdus.find(hdu => hdu.extname === 'AMBER_SPECTRUM')!);
    const effective = tableColumn(wavelengthTable, 'EFF_WAVE');
    const wavelengths = Array.from({ length: wavelengthTable.rows }, (_, row) => numbers(output, wavelengthTable, row, effective)[0]!);
    const flux = Array.from({ length: spectrum.rows }, (_, row) => numbers(output, spectrum, row, tableColumn(spectrum, 'SPECTRUM')).reduce((sum, value) => sum + value, 0));
    const shift = measureCoShift(wavelengths.map(value => value * 1e6), flux);
    if (shift.correlation < MINIMUM_CO_CORRELATION) throw new Error(`The science spectrum shows no clear CO pattern (correlation ${shift.correlation.toFixed(2)}); its wavelengths cannot be calibrated on it.`);
    wavelengths.forEach((value, row) => writeCell(output, wavelengthTable, row, effective, 0, value - shift.shiftNm * 1e-9));
    const path = resolve(work, `calibrated-${pair.science}.fits`);
    await writeFile(`${path}.partial`, output); await rename(`${path}.partial`, path);
    await writeFile(resolve(work, `calibrated-${pair.science}.json`), `${JSON.stringify({ calibrator: calibratorBlock.target, selectionPercent: selection, coShiftNm: shift.shiftNm, coCorrelation: shift.correlation }, null, 2)}\n`);
    results.push(path);
  }
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [work, ...rest] = process.argv.slice(2);
  const option = (name: string) => { const index = rest.indexOf(name); return index < 0 ? undefined : rest[index + 1]; };
  const target = option('--target'), from = option('--from'), to = option('--to');
  const calibrators = new Map(rest.flatMap((value, index) => {
    if (rest[index - 1] !== '--calibrator') return [];
    const [name, numbersText] = value.split('='), [diameter, error] = String(numbersText).split(':').map(Number);
    return [[name!, { diameterMas: diameter!, errorMas: error! }] as const];
  }));
  if (!work || !target || !from || !to || !calibrators.size) throw new TypeError('Usage: calibrate-amber <work> --target <TARGET> --from <ISO> --to <ISO> --calibrator <TARGET>=<mas>:<error> [--frames <csv>] [--raw <dir>] [--selection 80]');
  const csv = option('--frames') ? await readFile(option('--frames')!, 'utf8') : await queryRawTable('AMBER', AMBER_COLUMNS, new Date(Date.parse(`${from}Z`) - 12 * 3600e3).toISOString().slice(0, 19), to);
  const plan = planAmberNight(parseRawTable(csv), target, { from, to });
  const root = await toolchainPath('amber');
  await writeFile(resolve(work, 'plan.json'), `${JSON.stringify(plan, null, 2)}\n`).catch(async () => { const { mkdir } = await import('node:fs/promises'); await mkdir(work, { recursive: true }); await writeFile(resolve(work, 'plan.json'), `${JSON.stringify(plan, null, 2)}\n`); });
  const files = await calibrateAmber(plan, option('--raw') ?? resolve(work, 'raw'), work, resolve(root, 'pipeline'), resolve(root, 'calib/share/esopipes/datastatic/amber-4.4.5'), calibrators, Number(option('--selection') ?? 80));
  console.log(files.join('\n'));
}
