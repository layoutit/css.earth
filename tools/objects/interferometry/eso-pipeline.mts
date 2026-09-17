/** What every ESO interferometer reduction here shares: the archive's raw frame table, anonymous downloads of public frames,
 * and esorex recipes run in their own directories with their set-of-frames and log kept beside the product.
 *
 * The raw table is archive.eso.org/tap_obs (dbo.raw). Planning reads its columns by name, so an instrument's planner asks for
 * the columns it needs (tpl_start, dp_type, dp_cat, object or target...) and the saved CSV of a test fixture is the same text
 * the archive returns. */
import { spawnSync } from 'node:child_process';
import { access, mkdir, readdir, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export type RawRow = Readonly<Record<string, string>>;

/** The archive's CSV as rows keyed by column name, in dp_id order. Quoted fields may hold commas. */
export function parseRawTable(csv: string): RawRow[] {
  const lines = csv.split('\n').filter(line => line.trim());
  if (!lines.length) return [];
  const split = (line: string) => [...line.matchAll(/("([^"]*)"|[^,]*)(,|$)/gu)].slice(0, -1).map(match => match[2] ?? match[1] ?? '');
  const header = split(lines[0]!);
  if (!header.includes('dp_id')) throw new TypeError('The raw frame table lacks dp_id.');
  return lines.slice(1).map(line => { const cells = split(line); return Object.fromEntries(header.map((name, index) => [name, cells[index] ?? ''])); })
    .sort((a, b) => a.dp_id!.localeCompare(b.dp_id!));
}

export function column(row: RawRow, name: string) {
  const value = row[name];
  if (value === undefined) throw new TypeError(`The raw frame table lacks ${name}.`);
  return value;
}

/** The time a frame starts, from its dp_id (INSTRUMENT.YYYY-MM-DDThh:mm:ss.sss). */
export const frameTime = (dpId: string) => Date.parse(`${dpId.replace(/^[A-Z]+\./u, '')}Z`);

/** The raw frame table for an instrument and interval (ISO times), as CSV. */
export async function queryRawTable(instrument: string, columns: readonly string[], from: string, to: string) {
  const query = `SELECT ${columns.join(', ')} FROM dbo.raw WHERE instrument = '${instrument}' AND exp_start BETWEEN '${from}' AND '${to}' ORDER BY dp_id`;
  const response = await fetch(`https://archive.eso.org/tap_obs/sync?REQUEST=doQuery&LANG=ADQL&FORMAT=csv&QUERY=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error(`The ESO archive answered ${response.status}.`);
  return response.text();
}

const exists = (path: string) => access(path).then(() => true, () => false);

/** A public raw frame from the ESO data portal, decompressed, unless it is already in the raw directory. */
export async function rawFrame(dpId: string, directory: string) {
  const target = resolve(directory, `${dpId}.fits`);
  if (await exists(target)) return target;
  await mkdir(directory, { recursive: true });
  const response = await fetch(`https://dataportal.eso.org/dataPortal/file/${dpId}`);
  if (response.status === 401) throw new Error(`${dpId} is still proprietary.`);
  if (!response.ok || !response.body) throw new Error(`${dpId}: the ESO data portal answered ${response.status}.`);
  const compressed = `${target}.Z`;
  await pipeline(Readable.fromWeb(response.body as never), createWriteStream(compressed));
  const run = spawnSync('gzip', ['-d', '-f', compressed]);
  if (run.status !== 0) throw new Error(`${dpId}: could not decompress (${String(run.stderr)}).`);
  return target;
}

export interface EsoPipeline { readonly prefix: string; readonly env: NodeJS.ProcessEnv }

/** The environment a kit's esorex needs: its bin and lib, and a HOME of its own so no user configuration is read. */
export function esoEnvironment(prefix: string, home: string, extra: NodeJS.ProcessEnv = {}): EsoPipeline {
  return { prefix, env: { ...process.env, HOME: home, PATH: `${resolve(prefix, 'bin')}:${process.env.PATH}`, DYLD_LIBRARY_PATH: resolve(prefix, 'lib'), ...extra } };
}

export type SetOfFrames = readonly (readonly [string, string])[];

/** Run one recipe in work/step with the given frames and options; returns the FITS products it wrote there. */
export async function runRecipe(pipelineSetup: EsoPipeline, work: string, step: string, recipe: string, frames: SetOfFrames, options: readonly string[] = []) {
  const directory = resolve(work, step);
  await mkdir(directory, { recursive: true });
  await mkdir(pipelineSetup.env.HOME!, { recursive: true });
  await writeFile(resolve(directory, 'in.sof'), frames.map(([file, tag]) => `${file} ${tag}`).join('\n') + '\n');
  const run = spawnSync(resolve(pipelineSetup.prefix, 'bin/esorex'), [`--recipe-dir=${resolve(pipelineSetup.prefix, 'lib/esopipes-plugins')}`, recipe, ...options, 'in.sof'],
    { cwd: directory, env: pipelineSetup.env, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  await writeFile(resolve(directory, 'log.txt'), `${run.stdout}${run.stderr}`);
  if (run.status !== 0) throw new Error(`${recipe} failed for ${step}; see ${resolve(directory, 'log.txt')}.`);
  return (await readdir(directory)).filter(name => name.endsWith('.fits')).sort().map(name => resolve(directory, name));
}
