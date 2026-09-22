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
 *    and waits for 14 GB of free memory before a batch starts: Stage 1 has peaked at 8 to 12 GB per batch. The next
 *    batch downloads while one reduces; a calibrated batch's downloaded raw files and Stage 1 ramps are then removed, so a
 *    programme larger than the free disk still reduces.
 * 3. Runs Stage 3 (spectral extraction) on every calibrated segment, then Stage 4 twice: the white light curve and the channels.
 * 4. Exports both light curves to CSV (time, flux, err, mask, centroid_y, psf_width_y; flux and err divided by the median flux),
 *    and the author's deposited curves the same way, so compare-light-curves.mts reads plain text. A deposit is either a zip holding
 *    Eureka! light-curve files (checked by sha256) or individual files (checked by the md5 the archive lists): time, flux and error
 *    columns with optional decorrelation vectors, and optionally a fitted map, exported as author-map.json. The star's median extracted counts
 *    per detector column (ours-stellar-counts.csv) are the band response an eclipse map's temperature conversion needs.
 *
 * Finished batches and stages are recorded in the work directory and skipped on a rerun. */
import { spawnSync } from 'node:child_process';
import { access, lstat, mkdir, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { totalmem } from 'node:os';
import { createHash } from 'node:crypto';
import { createReadStream, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../sources/source-values.mts';
import { eurekaToolchain, type EurekaToolchain } from './toolchain.mts';
import { freeMemoryPercent, mastFile, toolchainPython } from './mast.mts';

export interface Segment { readonly name: string; readonly bytes: number; readonly uri: string }
export interface TsoProgram {
  readonly id: string; readonly eventName: string; readonly crdsContext: string; readonly batchSegments: number;
  /** How Stage 3 measures the star: a dispersed spectrum, or aperture photometry of an imaging time series. Photometry has one
   * channel, so it has no channel light curves and no per-column stellar counts. */
  readonly mode: 'spectroscopy' | 'photometry';
  readonly stages: { readonly S1: string; readonly S2: string; readonly S3: string; readonly S4: string; readonly S4channels?: string };
  readonly segments: readonly Segment[];
  /** The author's deposited light curve, when one exists. A visit whose authors deposited none is checked against published
   * values instead, outside this reduction. */
  readonly oracle?: EurekaZipOracle | DepositFilesOracle;
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
  const stages = requireRecord(record.stages, 'stages');
  const segments = requireArray(record.segments).map(value => {
    const segment = requireRecord(value, 'segment');
    const name = requireString(segment.name);
    if (!/^jw\d{11}_\d{5}_\d{5}-seg\d{3}_[a-z0-9]+_uncal\.fits$/u.test(name)) throw new TypeError(`${name} is not a raw JWST segment name.`);
    return { name, bytes: requireFiniteNumber(segment.bytes), uri: requireString(segment.uri) };
  });
  if (new Set(segments.map(segment => segment.name)).size !== segments.length) throw new TypeError(`${directory}: a segment is listed twice.`);
  // A dispersed spectrum has channel light curves and photometry has none: the channel stage follows the mode.
  if ((record.mode === 'photometry') === (stages.S4channels !== undefined)) {
    throw new TypeError(`${directory}: ${record.mode === 'photometry' ? 'photometry has no channel stage (S4channels)' : 'a spectroscopy program needs its channel stage (S4channels)'}.`);
  }
  return {
    id: requireString(record.id), eventName: requireString(record.eventName), crdsContext: requireString(record.crdsContext),
    batchSegments: requireFiniteNumber(record.batchSegments),
    mode: record.mode === undefined ? 'spectroscopy' : requireString(record.mode) === 'photometry' ? 'photometry'
      : requireString(record.mode) === 'spectroscopy' ? 'spectroscopy' : (() => { throw new TypeError(`${directory}: mode must be spectroscopy or photometry.`); })(),
    stages: { S1: requireString(stages.S1), S2: requireString(stages.S2), S3: requireString(stages.S3), S4: requireString(stages.S4),
      ...(stages.S4channels === undefined ? {} : { S4channels: requireString(stages.S4channels) }) },
    segments,
    ...(record.oracle === undefined ? {} : { oracle: parseOracle(requireRecord(record.oracle, 'oracle')) }),
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

/** Segments downloaded ahead of the batch being reduced. */
const DOWNLOAD_AHEAD = 6;

const exists = (path: string) => access(path).then(() => true, () => false);
/** Memory macOS reports free, in GB. Stage 1 has peaked at 8 to 12 GB per batch on MIRI imaging segments. */
const STAGE_1_FREE_GB = 14;
const freeMemoryGb = () => freeMemoryPercent() / 100 * totalmem() / 1e9;

/** Waits up to half an hour for another reduction's Stage 1 to finish rather than failing the batch. */
async function waitForMemory() {
  for (let waited = 0; ; waited += 15) {
    const free = freeMemoryGb();
    if (free >= STAGE_1_FREE_GB) return;
    if (waited >= 1800) throw new Error(`Only ${free.toFixed(1)} GB of memory has been free for half an hour; Stage 1 needs ${STAGE_1_FREE_GB} GB. Finished batches are kept.`);
    await new Promise(done => setTimeout(done, 15000));
  }
}

const segmentFile = (segment: Segment, raw: string, rawSources: readonly string[]) => mastFile(segment, raw, rawSources);

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
# Aperture photometry records no cross-dispersion centroid or width; those columns are written as NaN so every
# light curve this pipeline exports has the same shape.
def column(*names):
    for name in names:
        if name in lc: return np.asarray(lc[name]).ravel()
    return np.full(np.asarray(lc.time).shape, np.nan)
width = column('psf_width_y', 'centroid_sy')
centroid = column('centroid_y')
def write(name, f, e, m):
    median = np.nanmedian(np.where(m, np.nan, f))
    np.savetxt(name, np.column_stack([lc.time, f / median, e / median, m.astype(float), centroid, width]),
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

/** `segments` reduces only the first n pinned segments: a partial run that proves the path before a programme's whole
 * download is committed. The light curve it produces covers that part of the time series and nothing more. */
export async function reduceTso(programDirectory: string, work: string, rawSources: readonly string[] = [], segments?: number) {
  const full = await readProgram(programDirectory), toolchain = await eurekaToolchain(full.crdsContext);
  if (segments !== undefined && !(Number.isInteger(segments) && segments > 0 && segments <= full.segments.length)) {
    throw new TypeError(`--segments must be between 1 and ${full.segments.length}.`);
  }
  const program = segments === undefined ? full : { ...full, segments: full.segments.slice(0, segments) };
  const raw = resolve(work, 'raw'), progressPath = resolve(work, 'progress.json');
  await mkdir(raw, { recursive: true });
  // One reduction per work directory: a second run on the same visit would download into and calibrate the same files.
  const lock = resolve(work, 'reduce.lock');
  const holder = Number(await readFile(lock, 'utf8').catch(() => ''));
  if (holder && holder !== process.pid && (() => { try { process.kill(holder, 0); return true; } catch { return false; } })()) {
    console.log(`${work} is being reduced by process ${holder}; leaving it to that run.`);
    return resolve(work, 'light-curves');
  }
  await writeFile(lock, String(process.pid));
  process.on('exit', () => { try { rmSync(lock); } catch { /* already removed */ } });
  const progress = await readFile(progressPath, 'utf8').then(text => JSON.parse(text) as { segments: string[]; steps: Record<string, string> }, () => ({ segments: [] as string[], steps: {} as Record<string, string> }));
  const save = () => writeFile(progressPath, `${JSON.stringify(progress, null, 2)}\n`);
  const settings = async (step: string, template: string, stagePrefix: string, inputdir: string, outputdir: string) => {
    const directory = resolve(work, 'ecf', step);
    await mkdir(directory, { recursive: true });
    const text = renderSettings(await readFile(resolve(programDirectory, template), 'utf8'), { topdir: `${work}/`, inputdir, outputdir });
    await writeFile(resolve(directory, `${stagePrefix}_${program.eventName}.ecf`), text);
    return directory;
  };

  // Stages 1 and 2, in batches. A whole programme's raw segments can outgrow the disk, so each batch is downloaded while
  // the previous one reduces, and once a batch is calibrated its downloaded raw files and Stage 1 ramps are removed.
  // Raw files linked from --raw belong to their source directory and are kept.
  const pending = program.segments.filter(segment => !progress.segments.includes(segment.name));
  const batches = Array.from({ length: Math.ceil(pending.length / program.batchSegments) }, (_, index) => pending.slice(index * program.batchSegments, (index + 1) * program.batchSegments));
  if (batches.length > 0) {
    // New segments change the time series: the later stages run again over all of them.
    for (const step of ['S3', 'S4', 'S4channels']) delete progress.steps[step];
    for (const directory of ['Stage3', 'Stage4', 'Stage4_channels']) await rm(resolve(work, directory), { recursive: true, force: true });
    await save();
  }
  // Downloads run ahead of the reduction, three connections at a time, at most DOWNLOAD_AHEAD segments beyond the batch
  // being reduced: MAST throttles each connection, and a one-segment batch would otherwise download on one.
  const downloads = new Map(pending.map(segment => {
    let settle!: { resolve: (path: string) => void; reject: (error: unknown) => void };
    const promise = new Promise<string>((resolve, reject) => { settle = { resolve, reject }; });
    promise.catch(() => {});
    return [segment.name, { promise, ...settle }] as const;
  }));
  let reduced = 0, wake = () => {};
  const downloader = (async () => {
    const active = new Set<Promise<void>>();
    for (const [index, segment] of pending.entries()) {
      while (index - reduced >= DOWNLOAD_AHEAD + program.batchSegments || active.size >= 3) {
        await (active.size >= 3 ? Promise.race(active) : new Promise<void>(done => { wake = done; }));
      }
      const slot = downloads.get(segment.name)!;
      const tracked: Promise<void> = segmentFile(segment, raw, rawSources).then(slot.resolve, slot.reject).finally(() => active.delete(tracked));
      active.add(tracked);
    }
    await Promise.all(active);
  })();
  for (const batch of batches) {
    await Promise.all(batch.map(segment => downloads.get(segment.name)!.promise));
    const name = `batch${String(Object.keys(progress.steps).filter(key => key.startsWith('batch')).length + 1).padStart(2, '0')}`;
    const input = resolve(work, `Uncalibrated_${name}`);
    await mkdir(input, { recursive: true });
    for (const segment of batch) {
      const file = await segmentFile(segment, raw, rawSources), link = resolve(input, segment.name);
      if (!await exists(link)) await symlink(file, link);
    }
    await waitForMemory();
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
    await rm(resolve(work, `Stage1_${name}`), { recursive: true, force: true });
    for (const segment of batch) {
      const target = resolve(raw, segment.name);
      if (!(await lstat(target)).isSymbolicLink()) await rm(target);
    }
    reduced += batch.length;
    wake();
  }
  await downloader;

  // Stage 3 on every calibrated segment, then Stage 4 for the white light curve and, for a dispersed spectrum, the channels.
  const channelStage = program.stages.S4channels;
  for (const [step, template, prefix, inputdir, outputdir] of [
    ['S3', program.stages.S3, 'S3', 'Stage2_all', 'Stage3'],
    ['S4', program.stages.S4, 'S4', 'Stage3', 'Stage4'],
    ...(channelStage === undefined ? [] : [['S4channels', channelStage, 'S4', 'Stage3', 'Stage4_channels'] as const]),
  ] as const) {
    if (progress.steps[step]) continue;
    progress.steps[step] = await python(toolchain, work, STAGE_RUNNER, [step.slice(0, 2), await settings(step, template, prefix, inputdir, outputdir), program.eventName], resolve(work, `${step}.log`));
    await save();
  }

  // Light curves as CSV: ours, and the author's deposit.
  const curves = resolve(work, 'light-curves');
  await mkdir(curves, { recursive: true });
  await python(toolchain, curves, EXPORTER, [await findOne(resolve(work, 'Stage4'), /^S4_.*_LCData\.h5$/u), 'ours'], resolve(work, 'export-ours.log'));
  if (channelStage !== undefined) {
    await python(toolchain, curves, EXPORTER, [await findOne(resolve(work, 'Stage4_channels'), /^S4_.*_LCData\.h5$/u), 'ours'], resolve(work, 'export-ours-channels.log'));
  }
  // A dispersed spectrum carries the star's counts per detector column, the band response a temperature conversion needs.
  // Photometry has one band: its response is the filter's own transmission, which the package pins instead.
  if (program.mode === 'spectroscopy') {
    await python(toolchain, curves, COUNTS, [await findOne(resolve(work, 'Stage3'), /^S3_.*_SpecData\.h5$/u), 'ours-stellar-counts.csv'], resolve(work, 'export-counts.log'));
  }
  const oracle = program.oracle, oracleDirectory = resolve(work, 'oracle');
  if (!oracle) return curves;
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
  if (!programDirectory || !work) throw new TypeError('Usage: reduce-tso <program directory> <work directory> [--raw <directory> ...] [--segments <n>]');
  const rawSources = rest.flatMap((value, index) => rest[index - 1] === '--raw' ? [resolve(value)] : []);
  const limit = rest.flatMap((value, index) => rest[index - 1] === '--segments' ? [Number(value)] : []).at(0);
  console.log(`Light curves in ${await reduceTso(resolve(programDirectory), resolve(work), rawSources, limit)}`);
}
