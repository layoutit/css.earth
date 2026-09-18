#!/usr/bin/env node
/** Reduce a JWST time-series observation from raw exposures with Eureka!, for eclipse mapping from raw data.
 *
 *   node tools/objects/jwst/reduce-tso.mts <program directory> <work directory> [--raw <directory>]
 *
 * A program directory (tools/objects/jwst/programs/<id>) pins the raw segments by name and size, the CRDS context, the
 * Eureka! control files, and an author's deposited light curve to compare with. The run:
 *
 * 1. Takes each segment from --raw when a file of the pinned size is there, and otherwise downloads it from MAST with resume,
 *    three at a time: MAST throttles one connection to a fraction of what three reach together.
 * 2. Runs Stage 1 (ramp fitting) and Stage 2 (calibration) on batches of segments, one Python process and one worker at a time,
 *    and refuses to start a batch with less than half the memory free: one MIRI segment's Stage 1 peaks near 17 GB.
 * 3. Runs Stage 3 (spectral extraction) on every calibrated segment, then Stage 4 twice: the white light curve and the channels.
 * 4. Exports both light curves to CSV (time, flux, err, mask, centroid_y, psf_width_y; flux and err divided by the median flux),
 *    and the author's deposited curves the same way, so compare-light-curves.mts reads plain text. A deposit is either a zip holding
 *    Eureka! light-curve files (checked by sha256) or individual files (checked by the md5 the archive lists): time, flux and error
 *    columns with optional decorrelation vectors, and optionally a fitted map, exported as author-map.json. The star's median extracted counts
 *    per detector column (ours-stellar-counts.csv) are the band response an eclipse map's temperature conversion needs.
 *
 * Finished batches and stages are recorded in the work directory and skipped on a rerun. */
import { spawn, spawnSync } from 'node:child_process';
import { access, mkdir, readdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../source-values.mts';
import { eurekaToolchain, type EurekaToolchain } from './toolchain.mts';
import { freeMemoryPercent, mastFile, toolchainPython } from './mast.mts';

export interface Segment { readonly name: string; readonly bytes: number; readonly uri: string }
export interface TsoProgram {
  readonly id: string; readonly eventName: string; readonly crdsContext: string; readonly batchSegments: number;
  readonly stages: { readonly S1: string; readonly S2: string; readonly S3: string; readonly S4: string; readonly S4channels: string };
  readonly segments: readonly Segment[];
  readonly oracle: EurekaZipOracle | DepositFilesOracle;
}
export interface EurekaZipOracle { readonly kind: 'eureka-light-curve-zip'; readonly url: string; readonly path: string; readonly bytes: number; readonly sha256: string; readonly lightCurve: string }
export interface DepositFile { readonly path: string; readonly url: string; readonly bytes: number; readonly md5: string }
export interface DepositFilesOracle {
  readonly kind: 'deposit-files'; readonly files: readonly DepositFile[];
  /** Deposit paths of the light curve's columns, one value per line (decorrelation vectors: whitespace-separated columns). */
  readonly time: string; readonly flux: string; readonly err: string; readonly dvectors?: string;
  /** A ThERESA output (a pickled dict with fmap and tmap), exported as author-map.json. */
  readonly map?: string;
}

export async function readProgram(directory: string): Promise<TsoProgram> {
  const record = requireRecord(JSON.parse(await readFile(resolve(directory, 'program.json'), 'utf8')) as unknown, 'program.json');
  if (record.schema !== 'cssearth-jwst-tso-program@1') throw new TypeError(`${directory}: unexpected program schema.`);
  const stages = requireRecord(record.stages, 'stages'), oracle = requireRecord(record.oracle, 'oracle');
  const segments = requireArray(record.segments).map(value => {
    const segment = requireRecord(value, 'segment');
    const name = requireString(segment.name);
    if (!/^jw\d{11}_\d{5}_\d{5}-seg\d{3}_[a-z0-9]+_uncal\.fits$/u.test(name)) throw new TypeError(`${name} is not a raw JWST segment name.`);
    return { name, bytes: requireFiniteNumber(segment.bytes), uri: requireString(segment.uri) };
  });
  if (new Set(segments.map(segment => segment.name)).size !== segments.length) throw new TypeError(`${directory}: a segment is listed twice.`);
  return {
    id: requireString(record.id), eventName: requireString(record.eventName), crdsContext: requireString(record.crdsContext),
    batchSegments: requireFiniteNumber(record.batchSegments),
    stages: { S1: requireString(stages.S1), S2: requireString(stages.S2), S3: requireString(stages.S3), S4: requireString(stages.S4), S4channels: requireString(stages.S4channels) },
    segments,
    oracle: parseOracle(oracle),
  };
}

function parseOracle(oracle: Record<string, unknown>): TsoProgram['oracle'] {
  if (oracle.kind === 'eureka-light-curve-zip') return { kind: 'eureka-light-curve-zip', url: requireString(oracle.url), path: requireString(oracle.path), bytes: requireFiniteNumber(oracle.bytes), sha256: requireString(oracle.sha256), lightCurve: requireString(oracle.lightCurve) };
  if (oracle.kind !== 'deposit-files') throw new TypeError(`Unknown oracle kind ${String(oracle.kind)}.`);
  const files = requireArray(oracle.files).map(value => {
    const file = requireRecord(value, 'deposit file'), md5 = requireString(file.md5);
    if (!/^[0-9a-f]{32}$/u.test(md5)) throw new TypeError(`${String(file.path)}: md5 is not 32 hex digits.`);
    return { path: requireString(file.path), url: requireString(file.url), bytes: requireFiniteNumber(file.bytes), md5 };
  });
  const listed = (key: 'time' | 'flux' | 'err' | 'dvectors' | 'map') => {
    if (oracle[key] === undefined) return undefined;
    const path = requireString(oracle[key]);
    if (!files.some(file => file.path === path)) throw new TypeError(`The oracle's ${key} file ${path} is not among its files.`);
    return path;
  };
  return { kind: 'deposit-files', files, time: listed('time')!, flux: listed('flux')!, err: listed('err')!, ...(listed('dvectors') ? { dvectors: listed('dvectors')! } : {}), ...(listed('map') ? { map: listed('map')! } : {}) };
}

/** A control file with its top, input and output directories set; every other line is kept as written. */
export function renderSettings(template: string, directories: { readonly topdir: string; readonly inputdir: string; readonly outputdir: string }) {
  let text = template;
  for (const [key, value] of Object.entries(directories)) {
    const pattern = new RegExp(`^(${key}[ \\t]+)[^#\\n]*`, 'mu');
    if (!pattern.test(text)) throw new TypeError(`The control file has no ${key} line.`);
    text = text.replace(pattern, (_, lead: string) => `${lead}${value}  `);
  }
  return text;
}

const exists = (path: string) => access(path).then(() => true, () => false);
const segmentFile = (segment: Segment, raw: string, rawSources: readonly string[]) => mastFile(segment, raw, rawSources);

/** Every segment in place before Stage 1 starts, three downloads at a time. */
async function segmentFiles(segments: readonly Segment[], raw: string, rawSources: readonly string[]) {
  const queue = [...segments];
  await Promise.all(Array.from({ length: 3 }, async () => { for (let segment = queue.shift(); segment; segment = queue.shift()) await segmentFile(segment, raw, rawSources); }));
}

const md5File = (path: string) => new Promise<string>((done, fail) => {
  const hash = createHash('md5');
  createReadStream(path).on('data', chunk => hash.update(chunk)).on('error', fail).on('end', () => done(hash.digest('hex')));
});

const TEXT_EXPORTER = `
import json, sys, numpy as np
time, flux, err, dvectors, fitted = sys.argv[1:6]
columns = [np.loadtxt(time), np.loadtxt(flux), np.loadtxt(err)]
names = ['time', 'flux', 'err', 'mask']
columns.append(np.zeros_like(columns[0]))
if dvectors:
    d = np.atleast_2d(np.loadtxt(dvectors))
    for k in range(d.shape[1]): columns.append(d[:, k]); names.append(f'd{k + 1}')
np.savetxt('author-white.csv', np.column_stack(columns), delimiter=',', header=','.join(names), comments='')
if fitted:
    output = np.load(fitted, allow_pickle=True).item()
    json.dump({key: np.asarray(output[key]).tolist() for key in ('fmap', 'tmap', 'fmap_unc', 'tmap_unc') if key in output}, open('author-map.json', 'w'))
print('author', len(columns[0]), 'integrations', 'with map' if fitted else '')
`;

const STAGE_RUNNER = `
import json, resource, sys, time
stage, ecf, event = sys.argv[1:4]
start = time.time()
if stage == 'S12':
    from eureka.S1_detector_processing import s1_process
    from eureka.S2_calibrations import s2_calibrate
    s2_calibrate.calibrateJWST(event, ecf_path=ecf, s1_meta=s1_process.rampfitJWST(event, ecf_path=ecf))
elif stage == 'S3':
    from eureka.S3_data_reduction import s3_reduce
    s3_reduce.reduce(event, ecf_path=ecf)
elif stage == 'S4':
    from eureka.S4_generate_lightcurves import s4_genLC
    s4_genLC.genlc(event, ecf_path=ecf)
print(json.dumps({'stage': stage, 'seconds': round(time.time() - start, 1), 'peak_rss_gb': round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1e9, 2)}))
`;

const EXPORTER = `
import sys, numpy as np, xarray as xr
source, prefix = sys.argv[1:3]
lc = xr.open_dataset(source, engine='h5netcdf')
# Eureka! 1.4 writes data, err, mask and centroid_sy; the Eureka! v1 deposit writes flux, err, mask, psf_width_y and flux_white.
flux, err, mask = (np.asarray(lc[name]) for name in ('flux' if 'flux' in lc else 'data', 'err', 'mask'))
width = np.asarray(lc['psf_width_y' if 'psf_width_y' in lc else 'centroid_sy'])
def write(name, f, e, m):
    median = np.nanmedian(np.where(m, np.nan, f))
    np.savetxt(name, np.column_stack([lc.time, f / median, e / median, m.astype(float), lc.centroid_y, width]),
               delimiter=',', header='time,flux,err,mask,centroid_y,psf_width_y', comments='')
if 'flux_white' in lc: write(prefix + '-white.csv', *(np.asarray(lc[name]).ravel() for name in ('flux_white', 'err_white', 'mask_white')))
if flux.shape[0] == 1: write(prefix + '-white.csv', flux[0], err[0], mask[0])
else:
    for k in range(flux.shape[0]): write(f'{prefix}-ch{k:02d}.csv', flux[k], err[k], mask[k])
print(prefix, flux.shape[0], 'channel(s)', 'with white' if 'flux_white' in lc else '')
`;

const COUNTS = `
import sys, numpy as np, xarray as xr
source, name = sys.argv[1:3]
spec = xr.open_dataset(source, engine='h5netcdf')
# Median over integrations of the optimal spectrum, masked pixels excluded, sorted by wavelength: electrons per integration per column.
optimal = np.where(np.asarray(spec.optmask).astype(bool), np.nan, np.asarray(spec.optspec))
wave = np.asarray(spec.wave_1d); order = np.argsort(wave)
np.savetxt(name, np.column_stack([wave[order], np.nanmedian(optimal, axis=0)[order]]), delimiter=',', header='wavelength_um,counts', comments='')
print(name, optimal.shape)
`;

const python = (toolchain: EurekaToolchain, cwd: string, script: string, args: readonly string[], log: string) =>
  toolchainPython(toolchain, cwd, script, args, log).then(result => result.lastLine);

async function findOne(directory: string, pattern: RegExp): Promise<string> {
  const found: string[] = [];
  const walk = async (path: string): Promise<void> => {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const full = resolve(path, entry.name);
      if (entry.isDirectory()) await walk(full); else if (pattern.test(entry.name)) found.push(full);
    }
  };
  await walk(directory);
  if (found.length !== 1) throw new Error(`${found.length} files match ${pattern} under ${directory}.`);
  return found[0]!;
}

const sha256File = (path: string) => new Promise<string>((done, fail) => {
  const hash = createHash('sha256');
  createReadStream(path).on('data', chunk => hash.update(chunk)).on('error', fail).on('end', () => done(hash.digest('hex')));
});

export async function reduceTso(programDirectory: string, work: string, rawSources: readonly string[] = []) {
  const program = await readProgram(programDirectory), toolchain = await eurekaToolchain(program.crdsContext);
  const raw = resolve(work, 'raw'), progressPath = resolve(work, 'progress.json');
  await mkdir(raw, { recursive: true });
  const progress = await readFile(progressPath, 'utf8').then(text => JSON.parse(text) as { segments: string[]; steps: Record<string, string> }, () => ({ segments: [] as string[], steps: {} as Record<string, string> }));
  const save = () => writeFile(progressPath, `${JSON.stringify(progress, null, 2)}\n`);
  const settings = async (step: string, template: string, stagePrefix: string, inputdir: string, outputdir: string) => {
    const directory = resolve(work, 'ecf', step);
    await mkdir(directory, { recursive: true });
    const text = renderSettings(await readFile(resolve(programDirectory, template), 'utf8'), { topdir: `${work}/`, inputdir, outputdir });
    await writeFile(resolve(directory, `${stagePrefix}_${program.eventName}.ecf`), text);
    return directory;
  };

  // Stages 1 and 2, in batches.
  const pending = program.segments.filter(segment => !progress.segments.includes(segment.name));
  await segmentFiles(pending, raw, rawSources);
  for (let start = 0; start < pending.length; start += program.batchSegments) {
    const batch = pending.slice(start, start + program.batchSegments), name = `batch${String(Object.keys(progress.steps).filter(key => key.startsWith('batch')).length + 1).padStart(2, '0')}`;
    const input = resolve(work, `Uncalibrated_${name}`);
    await mkdir(input, { recursive: true });
    for (const segment of batch) {
      const file = await segmentFile(segment, raw, rawSources), link = resolve(input, segment.name);
      if (!await exists(link)) await symlink(file, link);
    }
    const free = freeMemoryPercent();
    if (!(free >= 50)) throw new Error(`Only ${free}% of memory is free; Stage 1 needs about 17 GB. Close other work and rerun: finished batches are kept.`);
    const ecf = await settings(name, program.stages.S1, 'S1', `Uncalibrated_${name}`, `Stage1_${name}`);
    await writeFile(resolve(ecf, `S2_${program.eventName}.ecf`), renderSettings(await readFile(resolve(programDirectory, program.stages.S2), 'utf8'), { topdir: `${work}/`, inputdir: `Stage1_${name}`, outputdir: `Stage2_${name}` }));
    progress.steps[name] = await python(toolchain, work, STAGE_RUNNER, ['S12', ecf, program.eventName], resolve(work, `${name}.log`));
    const collected = resolve(work, 'Stage2_all');
    await mkdir(collected, { recursive: true });
    const walk = async (path: string): Promise<void> => {
      for (const entry of await readdir(path, { withFileTypes: true })) {
        const full = resolve(path, entry.name);
        if (entry.isDirectory()) await walk(full);
        else if (entry.name.endsWith('_calints.fits') && !await exists(resolve(collected, entry.name))) await symlink(full, resolve(collected, entry.name));
      }
    };
    await walk(resolve(work, `Stage2_${name}`));
    progress.segments.push(...batch.map(segment => segment.name));
    await save();
  }

  // Stage 3 on every calibrated segment, then Stage 4 for the white light curve and for the channels.
  for (const [step, template, prefix, inputdir, outputdir] of [
    ['S3', program.stages.S3, 'S3', 'Stage2_all', 'Stage3'],
    ['S4', program.stages.S4, 'S4', 'Stage3', 'Stage4'],
    ['S4channels', program.stages.S4channels, 'S4', 'Stage3', 'Stage4_channels'],
  ] as const) {
    if (progress.steps[step]) continue;
    progress.steps[step] = await python(toolchain, work, STAGE_RUNNER, [step.slice(0, 2), await settings(step, template, prefix, inputdir, outputdir), program.eventName], resolve(work, `${step}.log`));
    await save();
  }

  // Light curves as CSV: ours, and the author's deposit.
  const curves = resolve(work, 'light-curves');
  await mkdir(curves, { recursive: true });
  await python(toolchain, curves, EXPORTER, [await findOne(resolve(work, 'Stage4'), /^S4_.*_LCData\.h5$/u), 'ours'], resolve(work, 'export-ours.log'));
  await python(toolchain, curves, EXPORTER, [await findOne(resolve(work, 'Stage4_channels'), /^S4_.*_LCData\.h5$/u), 'ours'], resolve(work, 'export-ours-channels.log'));
  await python(toolchain, curves, COUNTS, [await findOne(resolve(work, 'Stage3'), /^S3_.*_SpecData\.h5$/u), 'ours-stellar-counts.csv'], resolve(work, 'export-counts.log'));
  const oracle = program.oracle, oracleDirectory = resolve(work, 'oracle');
  await mkdir(oracleDirectory, { recursive: true });
  if (oracle.kind === 'eureka-light-curve-zip') {
    const deposit = resolve(oracleDirectory, oracle.path);
    if (!await exists(deposit) || await sha256File(deposit) !== oracle.sha256) {
      const fetched = spawnSync('curl', ['-s', '-L', '-o', deposit, oracle.url], { stdio: 'inherit' });
      if (fetched.status !== 0 || await sha256File(deposit) !== oracle.sha256) throw new Error(`${oracle.path} does not match its pinned sha256.`);
    }
    const unzip = spawnSync('unzip', ['-o', '-q', deposit, oracle.lightCurve, '-d', oracleDirectory]);
    if (unzip.status !== 0) throw new Error(`Could not extract ${oracle.lightCurve}.`);
    await python(toolchain, curves, EXPORTER, [resolve(oracleDirectory, oracle.lightCurve), 'author'], resolve(work, 'export-author.log'));
  } else {
    for (const file of oracle.files) {
      const path = resolve(oracleDirectory, file.path);
      if (await exists(path) && await md5File(path) === file.md5) continue;
      const fetched = spawnSync('curl', ['-s', '-L', '-o', path, file.url], { stdio: 'inherit' });
      if (fetched.status !== 0 || await md5File(path) !== file.md5) throw new Error(`${file.path} does not match its listed md5.`);
    }
    const at = (name?: string) => (name ? resolve(oracleDirectory, name) : '');
    await python(toolchain, curves, TEXT_EXPORTER, [at(oracle.time), at(oracle.flux), at(oracle.err), at(oracle.dvectors), at(oracle.map)], resolve(work, 'export-author.log'));
  }
  return curves;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [programDirectory, work, ...rest] = process.argv.slice(2);
  if (!programDirectory || !work) throw new TypeError('Usage: reduce-tso <program directory> <work directory> [--raw <directory> ...]');
  const rawSources = rest.flatMap((value, index) => rest[index - 1] === '--raw' ? [resolve(value)] : []);
  console.log(`Light curves in ${await reduceTso(resolve(programDirectory), resolve(work), rawSources)}`);
}
