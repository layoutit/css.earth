#!/usr/bin/env node
/** Calibrate VLTI/PIONIER visibilities from raw frames with ESO's pipeline, instead of relying on the JMMC OiDB's automated
 * product (which did not converge for Antares) or on an author's file existing at all.
 *
 *   node tools/objects/interferometry/calibrate-pionier.mts <work-directory> --target <OBJECT> --from <ISO time> --to <ISO time>
 *     [--frames <archive.csv>] [--raw <directory>] [--pipeline <prefix>] [--calib <directory>] [--yorick <bin directory>]
 *
 * The frames are the ESO archive's raw table (archive.eso.org/tap_obs, dbo.raw) for the window, or a saved copy of it. Each
 * observing block is a run of FRINGE,OBJECT exposures on one star followed by its own DARK; the KAPPA,OBJECT frames follow a
 * DARK too. planPionierNight reads those associations from dp_type, object and tpl_start, so no frame is chosen by hand:
 * the target's blocks inside the window are science; blocks filed as CALIB or in the target's programme are calibrators. The spectral calibration and the
 * kappa matrix follow pndrs's own choice (pndrsBatchFindBestSpecCal): the FRINGE,LAMP scan and KAPPA set closest to the first
 * block, preferring by one day those taken before it; the archive is queried from 36 hours before the window to 24 after. Taking the wavelengths from a star's fringe exposure instead left them
 * 0.5 to 0.9 percent longer than the author's file. Public raw files download anonymously from the ESO data portal.
 *
 * The reduction is esorex for darks, the kappa matrix, the spectral calibration and each exposure's raw OIDATA; the transfer
 * function and the calibration are pndrs's own Yorick scripts, called directly because the pioni_oidata_tf recipe of pipeline
 * 4.0.4 computes the transfer function and then fails to save it ("Data not found: ESO PRO CATG"). Calibrator diameters come
 * from the pipeline's bundled JSDC catalogue. The result is one calibrated OIFITS file for the target. */
import { spawnSync } from 'node:child_process';
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { archiveHeader, column, esoEnvironment, frameTime, parseRawTable, queryRawTable, rawFrame, runRecipe } from './eso-pipeline.mts';
import { toolchainPath } from './toolchain.mts';

export { rawFrame } from './eso-pipeline.mts';

export interface RawFrame { readonly dpId: string; readonly dpType: string; readonly dpCategory: string; readonly object: string; readonly programme: string; readonly templateStart: string }
export interface PionierBlock { readonly object: string; readonly role: 'science' | 'calibrator'; readonly exposures: readonly string[]; readonly dark: string }
export interface PionierPlan { readonly kappa: { readonly dark: string; readonly frames: readonly string[] }; readonly spectral: string; readonly blocks: readonly PionierBlock[] }

/** The archive's CSV (dp_id, dp_cat, dp_type, object, prog_id and tpl_start columns) as frames in time order. */
export function parseRawFrames(csv: string): RawFrame[] {
  return parseRawTable(csv).map(row => ({ dpId: column(row, 'dp_id'), dpType: column(row, 'dp_type'), dpCategory: column(row, 'dp_cat'), object: column(row, 'object'),
    programme: column(row, 'prog_id'), templateStart: column(row, 'tpl_start') }));
}

const time = frameTime;

/** `frames` is the whole night; blocks are taken inside [from, to] (ISO times) when given, calibrations from anywhere near.
 * `setupOf` gives a frame's optical and detector setup (disperser and detector windows, from its header); when given, only
 * calibrator blocks, kappa sets, lamp scans and darks in the science data's setup are used, as pndrs requires. Service-mode
 * mornings take FREE, GRISM and GRISM+Wollaston sets one after another, and a set in another setup fails in pndrs. */
export function planPionierNight(frames: readonly RawFrame[], target: string, window: { readonly from?: string; readonly to?: string } = {},
  setupOf?: (dpId: string) => string | undefined): PionierPlan {
  const darks = frames.filter(frame => frame.dpType === 'DARK');
  const inside = (frame: RawFrame) => (!window.from || frame.dpId >= `PIONI.${window.from}`) && (!window.to || frame.dpId <= `PIONI.${window.to}`);
  const blocks: PionierBlock[] = [];
  // A calibrator is a block the archive files as CALIB (2019 service mode names it only "FRINGE,OBJECT") or a block of the
  // target's own programme (2014 visitor mode filed named calibrators as SCIENCE). Other programmes' science blocks are skipped.
  const programmes = new Set(frames.filter(frame => frame.dpType === 'FRINGE,OBJECT' && frame.object === target && inside(frame)).map(frame => frame.programme));
  const usable = (frame: RawFrame) => frame.object === target || frame.dpCategory === 'CALIB' || programmes.has(frame.programme);
  const scienceFrame = frames.find(frame => frame.dpType === 'FRINGE,OBJECT' && frame.object === target && inside(frame));
  const scienceSetup = scienceFrame && setupOf?.(scienceFrame.dpId);
  const sameSetup = (frame: RawFrame) => !setupOf || setupOf(frame.dpId) === scienceSetup;
  for (const template of [...new Set(frames.filter(frame => frame.dpType === 'FRINGE,OBJECT' && inside(frame) && usable(frame)).map(frame => frame.templateStart))]) {
    const exposures = frames.filter(frame => frame.dpType === 'FRINGE,OBJECT' && frame.templateStart === template);
    if (!sameSetup(exposures[0]!)) continue;
    const last = time(exposures.at(-1)!.dpId);
    // A block's dark is the first dark after its last exposure, within 15 minutes: service mode may put an on-sky kappa sequence
    // between them (11 August 2019), or follow an aborted one-exposure template directly with the full block (29 August 2019).
    const dark = darks.find(frame => time(frame.dpId) > last && time(frame.dpId) - last < 15 * 60e3);
    if (!dark) throw new Error(`Block ${template} (${exposures[0]!.object}) has no dark after it.`);
    const objects = new Set(exposures.map(frame => frame.object));
    if (objects.size !== 1) throw new Error(`Block ${template} observes ${[...objects].join(' and ')}.`);
    blocks.push({ object: exposures[0]!.object, role: exposures[0]!.object === target ? 'science' : 'calibrator', exposures: exposures.map(frame => frame.dpId), dark: dark.dpId });
  }
  if (!blocks.some(block => block.role === 'science')) throw new Error(`The window holds no block on ${target}.`);
  if (!blocks.some(block => block.role === 'calibrator')) throw new Error('The window holds no calibrator block.');
  const start = time(blocks[0]!.exposures[0]!);
  // pndrsBatchFindBestSpecCal's score: the time distance in days, plus one day for a calibration taken after the data and minus
  // one for one taken before. Observatory calibrations come in the morning, so this picks the previous morning's set over the
  // next morning's, and still finds the next one when none precedes.
  const best = (type: RegExp) => frames.filter(frame => type.test(frame.dpType) && sameSetup(frames.find(first => first.templateStart === frame.templateStart && type.test(first.dpType))!))
    .map(frame => { const days = (time(frame.dpId) - start) / 86400e3; return { frame, score: Math.abs(days) + Math.sign(days) }; })
    .sort((a, b) => a.score - b.score)[0]?.frame;
  const kappa = best(/^KAPPA,/u);
  if (!kappa) throw new Error('No kappa-matrix frames in the night.');
  const kappaTemplate = kappa.templateStart, kappaFrames = frames.filter(frame => /^KAPPA,/u.test(frame.dpType) && frame.templateStart === kappaTemplate);
  const firstKappa = time(kappaFrames[0]!.dpId);
  const kappaDark = [...darks].reverse().find(frame => time(frame.dpId) < firstKappa && firstKappa - time(frame.dpId) < 2 * 60e3 && sameSetup(frame));
  if (!kappaDark) throw new Error('The kappa-matrix frames have no dark just before them.');
  const lamp = best(/^FRINGE,LAMP$/u);
  if (!lamp) throw new Error('No FRINGE,LAMP spectral calibration in the night.');
  return { kappa: { dark: kappaDark.dpId, frames: kappaFrames.map(frame => frame.dpId) }, spectral: lamp.dpId, blocks };
}

/** Files per pndrs argument: pndrsGetArgument splits a comma list with strword(output, ",", 15), so a sixteenth file stays glued
 * to the fifteenth and the call fails with "should be an exising file". */
export const PNDRS_FILE_LIMIT = 15;

export interface PipelinePaths { readonly prefix: string; readonly catalogue: string; readonly yorick: string }

export async function pipelinePaths(overrides: Partial<{ prefix: string; calib: string; yorick: string }> = {}): Promise<PipelinePaths> {
  const root = overrides.prefix && overrides.calib && overrides.yorick ? null : await toolchainPath('pionier');
  const prefix = overrides.prefix ?? resolve(root!, 'pipeline'), calib = overrides.calib ?? resolve(root!, 'calib');
  const yorick = overrides.yorick ?? resolve(root!, 'build/yorick-y_2_2_04/relocate/bin');
  return { prefix, catalogue: resolve(calib, 'share/esopipes/datastatic/pionier-4.0.4/PI_GCAL_150501_FAINT.fits'), yorick };
}

export async function calibratePionier(plan: PionierPlan, rawDirectory: string, work: string, paths: PipelinePaths) {
  await mkdir(rawDirectory, { recursive: true }); await mkdir(work, { recursive: true });
  const eso = esoEnvironment(paths.prefix, resolve(work, 'home'), { PATH: `${paths.yorick}:${resolve(paths.prefix, 'bin')}:${process.env.PATH}`,
    PNDRS_DIR: resolve(paths.prefix, 'lib/pionier-4.0.4/pndrs'), PIONIER_PLUGIN_PATH: resolve(paths.prefix, 'lib/pionier-4.0.4') });
  const env = eso.env as NodeJS.ProcessEnv & { PNDRS_DIR: string };
  const raw = async (dpId: string) => rawFrame(dpId, rawDirectory);
  // A step whose set of frames and product are already on disk is not run again, so an interrupted night resumes where it stopped.
  const recipe = async (name: string, step: string, sof: readonly (readonly [string, string])[]) => {
    const done = resolve(work, step, 'outfile_recipe.fits'), sofText = sof.map(([file, tag]) => `${file} ${tag}`).join('\n') + '\n';
    if (await readFile(resolve(work, step, 'in.sof'), 'utf8').then(text => text === sofText, () => false) && await access(done).then(() => true, () => false)) return done;
    const products = await runRecipe(eso, work, step, name, sof);
    const product = products.find(file => file.endsWith('outfile_recipe.fits'));
    if (!product) throw new Error(`${name} wrote no product for ${step}.`);
    return product;
  };
  const pndrs = (script: string, args: readonly string[], log: string) => {
    const run = spawnSync(resolve(paths.yorick, 'yorick'), ['-batch', resolve(env.PNDRS_DIR, script), ...args], { cwd: work, env, encoding: 'utf8' });
    return writeFile(resolve(work, log), `${run.stdout}${run.stderr}`).then(() => { if (run.status !== 0) throw new Error(`${script} failed; see ${resolve(work, log)}.`); });
  };

  const kappaDark = await recipe('pioni_dark_calibration', 'dark-kappa', [[await raw(plan.kappa.dark), 'DARK']]);
  const kappa = await recipe('pioni_kappa_matrix', 'kappa', [[kappaDark, 'DARK_CALIBRATION'], ...await Promise.all(plan.kappa.frames.map(async frame => [await raw(frame), 'KAPPA'] as const))]);
  const spectral = await recipe('pioni_spectral_calibration', 'spectral', [[await raw(plan.spectral), 'SPEC_CAL']]);
  const oidata: { role: PionierBlock['role']; block: number; file: string }[] = [];
  for (const [index, block] of plan.blocks.entries()) {
    const dark = await recipe('pioni_dark_calibration', `dark-${index}`, [[await raw(block.dark), 'DARK']]);
    for (const [exposureIndex, exposure] of block.exposures.entries()) {
      oidata.push({ role: block.role, block: index, file: await recipe('pioni_oidata_raw', `raw-${index}-${exposureIndex}`,
        [[await raw(exposure), 'FRINGE'], [dark, 'DARK_CALIBRATION'], [kappa, 'KAPPA_MATRIX'], [spectral, 'SPECTRAL_CALIBRATION'], [paths.catalogue, 'JSDC_CAT']]) });
    }
  }
  // pndrs reads at most 15 files per argument (PNDRS_FILE_LIMIT), and a service-mode night holds more. Whole blocks are
  // grouped up to that limit; each calibrator group gives one transfer-function file, and every science group is calibrated against
  // all of them, so the transfer function is still interpolated across the night.
  const groups = (role: PionierBlock['role']) => {
    const result: string[][] = [];
    for (const blockIndex of [...new Set(oidata.filter(entry => entry.role === role).map(entry => entry.block))]) {
      const files = oidata.filter(entry => entry.block === blockIndex).map(entry => entry.file);
      if (files.length > PNDRS_FILE_LIMIT) throw new Error(`Block ${blockIndex} has ${files.length} exposures; pndrs reads at most ${PNDRS_FILE_LIMIT}.`);
      if (!result.length || result.at(-1)!.length + files.length > PNDRS_FILE_LIMIT) result.push([]);
      result.at(-1)!.push(...files);
    }
    return result;
  };
  const transfers: string[] = [];
  for (const [index, files] of groups('calibrator').entries()) {
    const transfer = resolve(work, `transfer-function-${index + 1}.fits`);
    await pndrs('pioni_oidata_tf.i', [`--inputOiDataFiles=${files.join(',')}`, `--inputCatalogFile=${paths.catalogue}`, `--outputOiDataTfFile=${transfer}`], `transfer-function-${index + 1}.log`);
    transfers.push(transfer);
  }
  if (transfers.length > PNDRS_FILE_LIMIT) throw new Error(`${transfers.length} transfer-function files; pndrs reads at most ${PNDRS_FILE_LIMIT}.`);
  const science = groups('science'), calibratedFiles: string[] = [];
  for (const [index, files] of science.entries()) {
    const calibrated = resolve(work, science.length === 1 ? 'calibrated.fits' : `calibrated-${index + 1}.fits`);
    await pndrs('pioni_oidata_calibrated.i', [`--inputOiDataFiles=${files.join(',')}`, `--inputOiDataTfFiles=${transfers.join(',')}`,
      `--outputOiDataCalibratedFile=${calibrated}.partial`, `--outputOiDataTfeFile=${resolve(work, `transfer-function-estimate-${index + 1}.fits`)}`], `calibrated-${index + 1}.log`);
    await access(`${calibrated}.partial`).catch(() => { throw new Error(`pndrs wrote no calibrated file; see ${resolve(work, `calibrated-${index + 1}.log`)}.`); });
    await rename(`${calibrated}.partial`, calibrated);
    calibratedFiles.push(calibrated);
  }
  return calibratedFiles;
}

/** Plan and calibrate one observing window: the raw table from 36 hours before to 24 after, each candidate's setup from its archive
 * header, the plan written beside the products. Returns the calibrated files. */
export async function calibratePionierWindow(work: string, target: string, from: string, to: string, rawDirectory: string,
  { frames: framesCsv, overrides = {} }: { frames?: string; overrides?: Partial<{ prefix: string; calib: string; yorick: string }> } = {}) {
  const csv = framesCsv ?? await queryRawTable('PIONIER', ['dp_id', 'dp_cat', 'dp_type', 'object', 'prog_id', 'tpl_start', 'exposure', 'ins_mode', 'release_date', 'access_estsize'], new Date(Date.parse(`${from}Z`) - 36 * 3600e3).toISOString().slice(0, 19), new Date(Date.parse(`${to}Z`) + 24 * 3600e3).toISOString().slice(0, 19));
  const frames = parseRawFrames(csv), headers = resolve(rawDirectory, 'headers');
  // Setups from archive headers: each candidate block's and calibration set's first frame, and the darks just before kappa sets.
  const firstOfTemplate = new Map<string, RawFrame>();
  for (const frame of frames) if (/^(FRINGE,OBJECT|KAPPA,|FRINGE,LAMP)/u.test(frame.dpType) && !firstOfTemplate.has(`${frame.templateStart}/${frame.dpType}`)) firstOfTemplate.set(`${frame.templateStart}/${frame.dpType}`, frame);
  const firsts = [...firstOfTemplate.values()];
  const kappaStarts = firsts.filter(frame => frame.dpType.startsWith('KAPPA,')).map(frame => time(frame.dpId));
  const nearKappa = frames.filter(frame => frame.dpType === 'DARK' && kappaStarts.some(start => start > time(frame.dpId) && start - time(frame.dpId) < 2 * 60e3));
  const setups = new Map<string, string>();
  for (const frame of [...firsts, ...nearKappa]) {
    const header = await archiveHeader(frame.dpId, headers);
    setups.set(frame.dpId, `${String(header['ESO INS OPTI2 NAME'])}/${String(header['ESO DET SUBWINS'])}`);
  }
  const plan = planPionierNight(frames, target, { from, to }, dpId => setups.get(dpId));
  await mkdir(work, { recursive: true });
  await writeFile(resolve(work, 'plan.json'), `${JSON.stringify(plan, null, 2)}\n`);
  return { plan, files: await calibratePionier(plan, rawDirectory, work, await pipelinePaths(overrides)) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [work, ...rest] = process.argv.slice(2);
  const option = (name: string) => { const index = rest.indexOf(name); return index < 0 ? undefined : rest[index + 1]; };
  const target = option('--target'), from = option('--from'), to = option('--to');
  if (!work || !target || !from || !to) throw new TypeError('Usage: calibrate-pionier <work> --target <OBJECT> --from <ISO> --to <ISO> [--frames <csv>] [--raw <dir>] [--pipeline <prefix>] [--calib <dir>] [--yorick <bin>]');
  const overrides = { ...(option('--pipeline') ? { prefix: option('--pipeline')! } : {}), ...(option('--calib') ? { calib: option('--calib')! } : {}), ...(option('--yorick') ? { yorick: option('--yorick')! } : {}) };
  const { plan, files } = await calibratePionierWindow(work, target, from, to, option('--raw') ?? resolve(work, 'raw'), { ...(option('--frames') ? { frames: await readFile(option('--frames')!, 'utf8') } : {}), overrides });
  console.log(`${files.join(', ')}: ${plan.blocks.filter(block => block.role === 'science').length} science and ${plan.blocks.filter(block => block.role === 'calibrator').length} calibrator blocks.`);
}
