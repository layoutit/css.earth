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
 * the target's blocks are science, every other star's blocks are calibrators, and the spectral calibration is taken from the
 * first exposure of the night. Public raw files download anonymously from the ESO data portal.
 *
 * Known limit, measured on π¹ Gruis: the wavelengths this spectral calibration gives are 0.5 to 0.9 percent longer than the
 * author's file states (1.6376, 1.6857, 1.7374 against 1.6238, 1.6764, 1.7287 um), and calibrating from a whole block of
 * exposures gives the same values. The author's wavelength table is not documented; until it is, a reconstruction's angular
 * scale from these files carries that uncertainty.
 *
 * The reduction is esorex for darks, the kappa matrix, the spectral calibration and each exposure's raw OIDATA; the transfer
 * function and the calibration are pndrs's own Yorick scripts, called directly because the pioni_oidata_tf recipe of pipeline
 * 4.0.4 computes the transfer function and then fails to save it ("Data not found: ESO PRO CATG"). Calibrator diameters come
 * from the pipeline's bundled JSDC catalogue. The result is one calibrated OIFITS file for the target. */
import { spawnSync } from 'node:child_process';
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';
import { toolchainPath } from './toolchain.mts';

export interface RawFrame { readonly dpId: string; readonly dpType: string; readonly object: string; readonly templateStart: string }
export interface PionierBlock { readonly object: string; readonly role: 'science' | 'calibrator'; readonly exposures: readonly string[]; readonly dark: string }
export interface PionierPlan { readonly kappa: { readonly dark: string; readonly frames: readonly string[] }; readonly spectral: string; readonly blocks: readonly PionierBlock[] }

/** The archive's CSV (dp_id, dp_type, object and tpl_start columns, quoted fields allowed) as frames in time order. */
export function parseRawFrames(csv: string): RawFrame[] {
  const lines = csv.split('\n').filter(line => line.trim());
  const split = (line: string) => [...line.matchAll(/("([^"]*)"|[^,]*)(,|$)/gu)].slice(0, -1).map(match => match[2] ?? match[1] ?? '');
  const header = split(lines[0]!), column = (name: string) => { const index = header.indexOf(name); if (index < 0) throw new TypeError(`The raw frame table lacks ${name}.`); return index; };
  const [id, type, object, template] = ['dp_id', 'dp_type', 'object', 'tpl_start'].map(column) as [number, number, number, number];
  return lines.slice(1).map(split).map(cells => ({ dpId: cells[id]!, dpType: cells[type]!, object: cells[object]!, templateStart: cells[template]! }))
    .sort((a, b) => a.dpId.localeCompare(b.dpId));
}

const time = (dpId: string) => Date.parse(`${dpId.replace(/^PIONI\./u, '')}Z`);

export function planPionierNight(frames: readonly RawFrame[], target: string): PionierPlan {
  const darks = frames.filter(frame => frame.dpType === 'DARK');
  const blocks: PionierBlock[] = [];
  for (const template of [...new Set(frames.filter(frame => frame.dpType === 'FRINGE,OBJECT').map(frame => frame.templateStart))]) {
    const exposures = frames.filter(frame => frame.dpType === 'FRINGE,OBJECT' && frame.templateStart === template);
    const last = time(exposures.at(-1)!.dpId);
    // A block's dark is the first dark after its last exposure, within the template's own few minutes.
    const dark = darks.find(frame => time(frame.dpId) > last && time(frame.dpId) - last < 5 * 60e3);
    if (!dark) throw new Error(`Block ${template} (${exposures[0]!.object}) has no dark after it.`);
    const objects = new Set(exposures.map(frame => frame.object));
    if (objects.size !== 1) throw new Error(`Block ${template} observes ${[...objects].join(' and ')}.`);
    blocks.push({ object: exposures[0]!.object, role: exposures[0]!.object === target ? 'science' : 'calibrator', exposures: exposures.map(frame => frame.dpId), dark: dark.dpId });
  }
  const kappaFrames = frames.filter(frame => frame.dpType === 'KAPPA,OBJECT');
  if (!kappaFrames.length) throw new Error('The window holds no kappa-matrix frames.');
  const first = time(kappaFrames[0]!.dpId);
  const kappaDark = [...darks].reverse().find(frame => time(frame.dpId) < first && first - time(frame.dpId) < 2 * 60e3);
  if (!kappaDark) throw new Error('The kappa-matrix frames have no dark just before them.');
  if (!blocks.some(block => block.role === 'science')) throw new Error(`The window holds no block on ${target}.`);
  if (!blocks.some(block => block.role === 'calibrator')) throw new Error('The window holds no calibrator block.');
  return { kappa: { dark: kappaDark.dpId, frames: kappaFrames.map(frame => frame.dpId) }, spectral: blocks[0]!.exposures[0]!, blocks };
}

const exists = (path: string) => access(path).then(() => true, () => false);

/** A public raw frame from the ESO data portal, decompressed, unless it is already in the raw directory. */
export async function rawFrame(dpId: string, directory: string) {
  const target = resolve(directory, `${dpId}.fits`);
  if (await exists(target)) return target;
  const response = await fetch(`https://dataportal.eso.org/dataPortal/file/${dpId}`);
  if (response.status === 401) throw new Error(`${dpId} is still proprietary.`);
  if (!response.ok || !response.body) throw new Error(`${dpId}: the ESO data portal answered ${response.status}.`);
  const compressed = `${target}.Z`;
  await pipeline(Readable.fromWeb(response.body as never), createWriteStream(compressed));
  const run = spawnSync('gzip', ['-d', '-f', compressed]);
  if (run.status !== 0) throw new Error(`${dpId}: could not decompress (${String(run.stderr)}).`);
  return target;
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
  const env = { ...process.env, HOME: resolve(work, 'home'), PATH: `${paths.yorick}:${resolve(paths.prefix, 'bin')}:${process.env.PATH}`, DYLD_LIBRARY_PATH: resolve(paths.prefix, 'lib'),
    PNDRS_DIR: resolve(paths.prefix, 'lib/pionier-4.0.4/pndrs'), PIONIER_PLUGIN_PATH: resolve(paths.prefix, 'lib/pionier-4.0.4') };
  await mkdir(env.HOME, { recursive: true });
  const raw = async (dpId: string) => rawFrame(dpId, rawDirectory);
  const recipe = async (name: string, step: string, sof: readonly (readonly [string, string])[]) => {
    const directory = resolve(work, step);
    await mkdir(directory, { recursive: true });
    await writeFile(resolve(directory, 'in.sof'), sof.map(([file, tag]) => `${file} ${tag}`).join('\n') + '\n');
    const run = spawnSync('esorex', [`--recipe-dir=${resolve(paths.prefix, 'lib/esopipes-plugins')}`, name, 'in.sof'], { cwd: directory, env, encoding: 'utf8' });
    await writeFile(resolve(directory, 'log.txt'), `${run.stdout}${run.stderr}`);
    if (run.status !== 0) throw new Error(`${name} failed for ${step}; see ${resolve(directory, 'log.txt')}.`);
    return resolve(directory, 'outfile_recipe.fits');
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

/** The raw frame table for an interval from the ESO archive, as CSV with the columns parseRawFrames reads. */
export async function queryRawFrames(from: string, to: string) {
  const query = `SELECT dp_id, dp_cat, dp_type, object, tpl_start, exposure, ins_mode, release_date, access_estsize FROM dbo.raw WHERE instrument = 'PIONIER' AND exp_start BETWEEN '${from}' AND '${to}' ORDER BY dp_id`;
  const response = await fetch(`https://archive.eso.org/tap_obs/sync?REQUEST=doQuery&LANG=ADQL&FORMAT=csv&QUERY=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error(`The ESO archive answered ${response.status}.`);
  return response.text();
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [work, ...rest] = process.argv.slice(2);
  const option = (name: string) => { const index = rest.indexOf(name); return index < 0 ? undefined : rest[index + 1]; };
  const target = option('--target'), from = option('--from'), to = option('--to');
  if (!work || !target || !from || !to) throw new TypeError('Usage: calibrate-pionier <work> --target <OBJECT> --from <ISO> --to <ISO> [--frames <csv>] [--raw <dir>] [--pipeline <prefix>] [--calib <dir>] [--yorick <bin>]');
  const csv = option('--frames') ? await readFile(option('--frames')!, 'utf8') : await queryRawFrames(from, to);
  const window = parseRawFrames(csv).filter(frame => frame.dpId >= `PIONI.${from}` && frame.dpId <= `PIONI.${to}`);
  const plan = planPionierNight(window, target);
  await mkdir(work, { recursive: true });
  await writeFile(resolve(work, 'plan.json'), `${JSON.stringify(plan, null, 2)}\n`);
  const overrides = { ...(option('--pipeline') ? { prefix: option('--pipeline')! } : {}), ...(option('--calib') ? { calib: option('--calib')! } : {}), ...(option('--yorick') ? { yorick: option('--yorick')! } : {}) };
  const calibrated = await calibratePionier(plan, option('--raw') ?? resolve(work, 'raw'), work, await pipelinePaths(overrides));
  console.log(`${calibrated}: ${plan.blocks.filter(block => block.role === 'science').length} science and ${plan.blocks.filter(block => block.role === 'calibrator').length} calibrator blocks.`);
}
