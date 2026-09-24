#!/usr/bin/env node
/**
 * The EHT image of a black hole, made the way its collaboration made it: EHT's own eht-imaging pipeline, run on the
 * released calibrated data for a drawn sample of its published Top Set parameter combinations, and averaged.
 *
 *   node tools/objects/eht/topset-mean.mts <object-id> [--python <path>] [--workers <n>]
 *
 * The recipe is the object's `source/preparation/eht-topset.json`: the data and pipeline releases by commit and git blob id,
 * the one change made to the pipeline, the toolchain it needs and the drawn combinations. Files are fetched from the releases
 * and checked by blob id; reconstructions are kept under `.local/<object-id>/eht/` and a finished one is never run again.
 * The mean is written to the recipe's output beside the object's sources, with the spread between the sample's first half
 * and the whole reported so the average's convergence is on record.
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readFitsImage } from '../../fits/fits.mts';
import { headerBlock, padBlock } from '../interferometry/fits-table.mts';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';

interface ReleaseFile { readonly role: string; readonly path: string; readonly blob: string }
interface Release { readonly repository: string; readonly commit: string; readonly files: readonly ReleaseFile[] }

const root = resolve(import.meta.dirname, '../../..');
const args = process.argv.slice(2), objectId = args.find(arg => !arg.startsWith('--') && !/^\d+$/u.test(arg) && !arg.includes('/'));
const option = (name: string) => { const index = args.indexOf(`--${name}`); return index < 0 ? undefined : args[index + 1]; };
if (!objectId || !/^[a-z][a-z0-9-]*$/u.test(objectId)) throw new Error('Usage: node tools/objects/eht/topset-mean.mts <object-id> [--python <path>] [--workers <n>]');
const python = option('python') ?? resolve(root, 'output/toolchains/ehtim/env/bin/python');
const workers = Number(option('workers') ?? 2);
if (!Number.isSafeInteger(workers) || workers < 1) throw new Error(`--workers is a positive integer, not ${option('workers')}.`);

const sourceDirectory = resolve(root, 'src/objects', objectId, 'source');
const recipe = requireRecord(JSON.parse(await readFile(resolve(sourceDirectory, 'preparation/eht-topset.json'), 'utf8')), 'EHT Top Set recipe');
if (recipe.schema !== 'cssearth-eht-topset-mean@1') throw new Error(`${objectId}: the EHT recipe schema is ${String(recipe.schema)}, not cssearth-eht-topset-mean@1.`);
const release = (value: unknown, label: string): Release => {
  const record = requireRecord(value, label);
  return { repository: requireString(record.repository, `${label} repository`), commit: requireString(record.commit, `${label} commit`),
    files: requireArray(record.files, `${label} files`).map(file => { const entry = requireRecord(file, `${label} file`);
      return { role: requireString(entry.role, `${label} file role`), path: requireString(entry.path, `${label} file path`), blob: requireString(entry.blob, `${label} file blob`) }; }) };
};
const data = release(recipe.data, 'data release'), pipeline = release(recipe.pipeline, 'pipeline release');
const change = requireRecord(requireRecord(recipe.pipeline, 'pipeline release').change, 'pipeline change');
const sample = requireRecord(recipe.sample, 'sample');
const combinations = requireArray(sample.combinations, 'sample combinations').map(value => requireFiniteNumber(value, 'combination'));
if (combinations.length !== requireFiniteNumber(sample.size, 'sample size') || new Set(combinations).size !== combinations.length ||
    combinations.some(value => !Number.isSafeInteger(value) || value < 0 || value >= requireFiniteNumber(sample.population, 'sample population'))) {
  throw new Error(`${objectId}: the sample lists ${combinations.length} combinations; it must list ${String(sample.size)} distinct rows below ${String(sample.population)}.`);
}

const work = resolve(root, '.local', objectId, 'eht');
const gitBlob = (bytes: Buffer) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const exists = (path: string) => access(path).then(() => true, () => false);
/** A release file in the work directory, fetched when absent and always checked against its blob id. */
async function releaseFile(source: Release, file: ReleaseFile): Promise<string> {
  const target = resolve(work, 'release', source.repository.split('/').at(-1)!, file.path);
  if (!await exists(target)) {
    const url = `https://raw.githubusercontent.com/${source.repository}/${source.commit}/${file.path}`, response = await fetch(url);
    if (!response.ok) throw new Error(`${url} answered HTTP ${response.status}.`);
    await mkdir(resolve(target, '..'), { recursive: true });
    await writeFile(target, Buffer.from(await response.arrayBuffer()));
  }
  const blob = gitBlob(await readFile(target));
  if (blob !== file.blob) throw new Error(`${source.repository}@${source.commit.slice(0, 7)} ${file.path} is blob ${blob}, not the recipe's ${file.blob}.`);
  return target;
}
const [low, high] = await Promise.all(['low band', 'high band'].map(role => {
  const file = data.files.find(entry => entry.role === role);
  if (!file) throw new Error(`${objectId}: the data release names no ${role} file.`);
  return releaseFile(data, file);
}));
const pipelineFiles = new Map(await Promise.all(pipeline.files.map(async file => [file.role, await releaseFile(pipeline, file)] as const)));
// The run directory holds the changed pipeline beside the pre-imaging module it imports, and the Top Set parameters.
const run = resolve(work, 'run');
await mkdir(resolve(run, 'fits'), { recursive: true }); await mkdir(resolve(run, 'logs'), { recursive: true });
const script = await readFile(pipelineFiles.get('pipeline')!, 'utf8'), replace = requireString(change.replace, 'change text'), replacement = requireString(change.with, 'change replacement');
if (script.split(replace).length !== 2) throw new Error(`${objectId}: the pipeline change "${replace}" does not occur exactly once.`);
await writeFile(resolve(run, 'eht-imaging_pipeline.py'), script.replace(replace, replacement));
await writeFile(resolve(run, 'preimcal.py'), await readFile(pipelineFiles.get('pre-imaging')!));
// preimcal.py reads the refractive-scattering noise models from its working directory by name.
for (const file of pipeline.files.filter(entry => entry.role === 'scattering model'))
  await writeFile(resolve(run, file.path.split('/').at(-1)!), await readFile(resolve(work, 'release', pipeline.repository.split('/').at(-1)!, file.path)));
const parameters = resolve(run, 'eht-imaging_params.csv');
await writeFile(parameters, await readFile(pipelineFiles.get('parameters')!));

const fitsPath = (combination: number) => resolve(run, 'fits', `combo-${String(combination).padStart(4, '0')}.fits`);
/** One reconstruction; skipped when its FITS exists, written atomically so an interrupted run is never taken as finished. */
async function reconstruct(combination: number) {
  const out = fitsPath(combination);
  if (await exists(out)) return;
  const partial = resolve(run, 'fits', `.combo-${combination}.fits`);
  await new Promise<void>((accept, reject) => {
    const child = spawn('nice', ['-n', '15', python, '-u', 'eht-imaging_pipeline.py', '-i', low!, '-i2', high!, '-p', parameters, '-c', String(combination), '-o', partial],
      { cwd: run, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, MPLBACKEND: 'Agg', OMP_NUM_THREADS: '1', OPENBLAS_NUM_THREADS: '1', MKL_NUM_THREADS: '1', VECLIB_MAXIMUM_THREADS: '1', NUMEXPR_NUM_THREADS: '1' } });
    const log: Buffer[] = [];
    child.stdout.on('data', chunk => log.push(chunk)); child.stderr.on('data', chunk => log.push(chunk));
    // The log is written before the run settles, so a failure that stops the tool still leaves it to read.
    child.once('exit', code => void writeFile(resolve(run, 'logs', `combo-${combination}.log`), Buffer.concat(log)).then(() =>
      code === 0 ? accept() : reject(new Error(`Combination ${combination} failed (${code}); see ${resolve(run, 'logs', `combo-${combination}.log`)}.`)), reject));
  });
  await rename(partial, out);
}
let next = 0, done = 0;
await Promise.all(Array.from({ length: workers }, async () => {
  while (next < combinations.length) {
    const combination = combinations[next++]!;
    await reconstruct(combination);
    if (++done % 20 === 0 || done === combinations.length) console.log(`${done} of ${combinations.length} reconstructions`);
  }
}));

// Average on the pipeline's own grid. eht-imaging states its phase centre as OBSRA/OBSDEC; the standard WCS reference cards
// say the same position, as the sky reader needs.
const images = await Promise.all(combinations.map(async combination => readFitsImage(await readFile(fitsPath(combination)))));
const first = images[0]!, header = first.header, grid = ['NAXIS1', 'NAXIS2', 'CDELT1', 'CDELT2', 'CRPIX1', 'CRPIX2', 'CTYPE1', 'CTYPE2', 'OBSRA', 'OBSDEC'] as const;
for (const [index, image] of images.entries()) for (const key of grid) {
  if (image.header[key] !== header[key]) throw new Error(`Combination ${combinations[index]} has ${key} ${String(image.header[key])}, not ${String(header[key])}: the reconstructions do not share a grid.`);
}
const mean = (subset: typeof images) => {
  const sum = new Float64Array(first.values.length);
  for (const image of subset) for (let i = 0; i < sum.length; i++) sum[i] += Number(image.values[i]);
  return sum.map(value => value / subset.length);
};
const all = mean(images), half = mean(images.slice(0, images.length >> 1));
let peak = 0, worst = 0, square = 0;
for (let i = 0; i < all.length; i++) { peak = Math.max(peak, all[i]!); worst = Math.max(worst, Math.abs(all[i]! - half[i]!)); square += (all[i]! - half[i]!) ** 2; }
const values = Buffer.alloc(all.length * 8);
all.forEach((value, i) => values.writeDoubleBE(value, i * 8));
const card = (key: string) => [key, header[key] as string | number] as [string, string | number];
const bytes = Buffer.concat([headerBlock([['SIMPLE', true], ['BITPIX', -64], ['NAXIS', 2], ['NAXIS1', first.width], ['NAXIS2', first.height],
  card('CTYPE1'), card('CTYPE2'), card('CDELT1'), card('CDELT2'), card('CRPIX1'), card('CRPIX2'),
  ['CRVAL1', header.OBSRA as number], ['CRVAL2', header.OBSDEC as number], ['CUNIT1', 'deg'], ['CUNIT2', 'deg'],
  card('OBSRA'), card('OBSDEC'), card('BUNIT'), card('FREQ'), card('MJD'), card('TELESCOP'), ['NCOMBINE', images.length, 'Top Set reconstructions averaged']]), padBlock(values)]);
const output = resolve(sourceDirectory, requireString(recipe.output, 'output'));
await mkdir(resolve(output, '..'), { recursive: true });
await writeFile(output, bytes);
console.log(`${images.length} reconstructions averaged into ${output}; half against all: ${(Math.sqrt(square / all.length) / peak * 100).toFixed(1)}% rms, ${(worst / peak * 100).toFixed(1)}% at most, of the peak.`);
