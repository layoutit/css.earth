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
 * the target's blocks inside the window are science and every other star's are calibrators. The spectral calibration and the
 * kappa matrix follow pndrs's own choice (pndrsBatchFindBestSpecCal): the closest FRINGE,LAMP scan and the closest KAPPA set
 * taken before the first block, from the whole night. Taking the wavelengths from a star's fringe exposure instead left them
 * 0.5 to 0.9 percent longer than the author's file. Public raw files download anonymously from the ESO data portal.
 *
 * The reduction is esorex for darks, the kappa matrix, the spectral calibration and each exposure's raw OIDATA; the transfer
 * function and the calibration are pndrs's own Yorick scripts, called directly because the pioni_oidata_tf recipe of pipeline
 * 4.0.4 computes the transfer function and then fails to save it ("Data not found: ESO PRO CATG"). Calibrator diameters come
 * from the pipeline's bundled JSDC catalogue. The result is one calibrated OIFITS file for the target. */
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { column, esoEnvironment, frameTime, parseRawTable, queryRawTable, rawFrame, runRecipe } from './eso-pipeline.mts';
import { toolchainPath } from './toolchain.mts';

export { rawFrame } from './eso-pipeline.mts';

export interface RawFrame { readonly dpId: string; readonly dpType: string; readonly object: string; readonly templateStart: string }
export interface PionierBlock { readonly object: string; readonly role: 'science' | 'calibrator'; readonly exposures: readonly string[]; readonly dark: string }
export interface PionierPlan { readonly kappa: { readonly dark: string; readonly frames: readonly string[] }; readonly spectral: string; readonly blocks: readonly PionierBlock[] }

/** The archive's CSV (dp_id, dp_type, object and tpl_start columns) as frames in time order. */
export function parseRawFrames(csv: string): RawFrame[] {
  return parseRawTable(csv).map(row => ({ dpId: column(row, 'dp_id'), dpType: column(row, 'dp_type'), object: column(row, 'object'), templateStart: column(row, 'tpl_start') }));
}

const time = frameTime;

/** `frames` is the whole night; blocks are taken inside [from, to] (ISO times) when given, calibrations from anywhere before. */
export function planPionierNight(frames: readonly RawFrame[], target: string, window: { readonly from?: string; readonly to?: string } = {}): PionierPlan {
  const darks = frames.filter(frame => frame.dpType === 'DARK');
  const inside = (frame: RawFrame) => (!window.from || frame.dpId >= `PIONI.${window.from}`) && (!window.to || frame.dpId <= `PIONI.${window.to}`);
  const blocks: PionierBlock[] = [];
  for (const template of [...new Set(frames.filter(frame => frame.dpType === 'FRINGE,OBJECT' && inside(frame)).map(frame => frame.templateStart))]) {
    const exposures = frames.filter(frame => frame.dpType === 'FRINGE,OBJECT' && frame.templateStart === template);
    const last = time(exposures.at(-1)!.dpId);
    // A block's dark is the first dark after its last exposure, within the template's own few minutes.
    const dark = darks.find(frame => time(frame.dpId) > last && time(frame.dpId) - last < 5 * 60e3);
    if (!dark) throw new Error(`Block ${template} (${exposures[0]!.object}) has no dark after it.`);
    const objects = new Set(exposures.map(frame => frame.object));
    if (objects.size !== 1) throw new Error(`Block ${template} observes ${[...objects].join(' and ')}.`);
    blocks.push({ object: exposures[0]!.object, role: exposures[0]!.object === target ? 'science' : 'calibrator', exposures: exposures.map(frame => frame.dpId), dark: dark.dpId });
  }
  if (!blocks.some(block => block.role === 'science')) throw new Error(`The window holds no block on ${target}.`);
  if (!blocks.some(block => block.role === 'calibrator')) throw new Error('The window holds no calibrator block.');
  const start = time(blocks[0]!.exposures[0]!);
  const before = (type: RegExp) => frames.filter(frame => type.test(frame.dpType) && time(frame.dpId) < start);
  const kappaSets = before(/^KAPPA,/u);
  if (!kappaSets.length) throw new Error('No kappa-matrix frames precede the first block.');
  const kappaTemplate = kappaSets.at(-1)!.templateStart, kappaFrames = kappaSets.filter(frame => frame.templateStart === kappaTemplate);
  const firstKappa = time(kappaFrames[0]!.dpId);
  const kappaDark = [...darks].reverse().find(frame => time(frame.dpId) < firstKappa && firstKappa - time(frame.dpId) < 2 * 60e3);
  if (!kappaDark) throw new Error('The kappa-matrix frames have no dark just before them.');
  const lamp = before(/^FRINGE,LAMP$/u).at(-1);
  if (!lamp) throw new Error('No FRINGE,LAMP spectral calibration precedes the first block.');
  return { kappa: { dark: kappaDark.dpId, frames: kappaFrames.map(frame => frame.dpId) }, spectral: lamp.dpId, blocks };
}

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
  const recipe = async (name: string, step: string, sof: readonly (readonly [string, string])[]) => {
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
  const oidata: { role: PionierBlock['role']; file: string }[] = [];
  for (const [index, block] of plan.blocks.entries()) {
    const dark = await recipe('pioni_dark_calibration', `dark-${index}`, [[await raw(block.dark), 'DARK']]);
    for (const [exposureIndex, exposure] of block.exposures.entries()) {
      oidata.push({ role: block.role, file: await recipe('pioni_oidata_raw', `raw-${index}-${exposureIndex}`,
        [[await raw(exposure), 'FRINGE'], [dark, 'DARK_CALIBRATION'], [kappa, 'KAPPA_MATRIX'], [spectral, 'SPECTRAL_CALIBRATION'], [paths.catalogue, 'JSDC_CAT']]) });
    }
  }
  const transfer = resolve(work, 'transfer-function.fits'), calibrated = resolve(work, 'calibrated.fits');
  await pndrs('pioni_oidata_tf.i', [`--inputOiDataFiles=${oidata.filter(entry => entry.role === 'calibrator').map(entry => entry.file).join(',')}`, `--inputCatalogFile=${paths.catalogue}`, `--outputOiDataTfFile=${transfer}`], 'transfer-function.log');
  await pndrs('pioni_oidata_calibrated.i', [`--inputOiDataFiles=${oidata.filter(entry => entry.role === 'science').map(entry => entry.file).join(',')}`, `--inputOiDataTfFiles=${transfer}`,
    `--outputOiDataCalibratedFile=${calibrated}.partial`, `--outputOiDataTfeFile=${resolve(work, 'transfer-function-estimate.fits')}`], 'calibrated.log');
  await rename(`${calibrated}.partial`, calibrated);
  return calibrated;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [work, ...rest] = process.argv.slice(2);
  const option = (name: string) => { const index = rest.indexOf(name); return index < 0 ? undefined : rest[index + 1]; };
  const target = option('--target'), from = option('--from'), to = option('--to');
  if (!work || !target || !from || !to) throw new TypeError('Usage: calibrate-pionier <work> --target <OBJECT> --from <ISO> --to <ISO> [--frames <csv>] [--raw <dir>] [--pipeline <prefix>] [--calib <dir>] [--yorick <bin>]');
  // The night's calibrations may precede the window by hours: the query starts twelve hours earlier.
  const csv = option('--frames') ? await readFile(option('--frames')!, 'utf8') : await queryRawTable('PIONIER', ['dp_id', 'dp_cat', 'dp_type', 'object', 'tpl_start', 'exposure', 'ins_mode', 'release_date', 'access_estsize'], new Date(Date.parse(`${from}Z`) - 12 * 3600e3).toISOString().slice(0, 19), to);
  const plan = planPionierNight(parseRawFrames(csv), target, { from, to });
  await mkdir(work, { recursive: true });
  await writeFile(resolve(work, 'plan.json'), `${JSON.stringify(plan, null, 2)}\n`);
  const overrides = { ...(option('--pipeline') ? { prefix: option('--pipeline')! } : {}), ...(option('--calib') ? { calib: option('--calib')! } : {}), ...(option('--yorick') ? { yorick: option('--yorick')! } : {}) };
  const calibrated = await calibratePionier(plan, option('--raw') ?? resolve(work, 'raw'), work, await pipelinePaths(overrides));
  console.log(`${calibrated}: ${plan.blocks.filter(block => block.role === 'science').length} science and ${plan.blocks.filter(block => block.role === 'calibrator').length} calibrator blocks.`);
}
