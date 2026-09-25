/** What every ESO interferometer reduction here shares: the archive's raw frame table, anonymous downloads of public frames,
 * and esorex recipes run in their own directories with their set-of-frames and log kept beside the product.
 *
 * The raw table is archive.eso.org/tap_obs (dbo.raw). Planning reads its columns by name, so an instrument's planner asks for
 * the columns it needs (tpl_start, dp_type, dp_cat, object or target...) and the saved CSV of a test fixture is the same text
 * the archive returns. */
import { spawnSync } from 'node:child_process';
import { access, mkdir, open, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { esoHierarchy, fitsCardValue, MAX_HEADER_RECORDS, readFitsHeader, type FitsHeader } from '@cssearth/fits';
import { tapRows } from '../astronomy-packages/client.mts';

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

/** The raw frame table for an instrument and interval. PyVO owns TAP and VOTable parsing. */
export async function queryRawTable(instrument: string, columns: readonly string[], from: string, to: string) {
  const query = `SELECT ${columns.join(', ')} FROM dbo.raw WHERE instrument = '${instrument}' AND exp_start BETWEEN '${from}' AND '${to}' ORDER BY dp_id`;
  return tapRows('https://archive.eso.org/tap_obs', query);
}

const exists = (path: string) => access(path).then(() => true, () => false);
let downloads = 0;

/** A public raw frame from the ESO data portal, decompressed, unless it is already in the raw directory. */
export async function rawFrame(dpId: string, directory: string) {
  const target = resolve(directory, `${dpId}.fits`);
  if (await exists(target)) return target;
  await mkdir(directory, { recursive: true });
  // Private temporary names, so two calls for the same frame (a prefetch and a step) never write one file.
  const partial = `${target}.${process.pid}-${++downloads}`, download = `${partial}.download`;
  // The portal drops connections now and then, before or during a transfer, and for minutes at a time it answers 401 to public
  // frames it serves before and after (on 17 September 2026, a Betelgeuse exposure public since 2021 and a PIONIER frame it had
  // served that morning). The whole request is repeated up to five times, waiting 5, 10, 20 and 40 seconds in between. Other
  // refusals (a missing frame) are not repeated.
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(`https://dataportal.eso.org/dataPortal/file/${dpId}`).catch((error: unknown) => error as Error);
    if (!(response instanceof Error) && response.status !== 401 && response.status < 500 && (!response.ok || !response.body)) throw new Error(`${dpId}: the ESO data portal answered ${response.status}.`);
    const failure = response instanceof Error ? response
      : response.status === 401 ? new Error(`${dpId}: the ESO data portal refused it (401) five times; a frame still in its proprietary period is refused so too.`)
      : !response.ok || !response.body ? new Error(`${dpId}: the ESO data portal answered ${response.status}.`)
      : await pipeline(Readable.fromWeb(response.body as never), createWriteStream(download)).then(() => undefined, (error: unknown) => error as Error);
    if (!failure) break;
    if (attempt === 5) throw failure;
    await new Promise(done => setTimeout(done, 5000 * 2 ** (attempt - 1)));
  }
  // Raw frames arrive Unix-compressed (magic 1f 9d); processed calibration files (M.*) arrive as plain FITS.
  const magic = Buffer.alloc(2), handle = await open(download, 'r');
  await handle.read(magic, 0, 2, 0); await handle.close();
  if (magic[0] === 0x1f && (magic[1] === 0x9d || magic[1] === 0x8b)) {
    await rename(download, `${partial}.Z`);
    const run = spawnSync('gzip', ['-d', '-f', `${partial}.Z`]);
    if (run.status !== 0) throw new Error(`${dpId}: could not decompress (${String(run.stderr)}).`);
    await rename(partial, target);
  } else await rename(download, target);
  return target;
}

/** Download a night's frames before its steps run, a few at a time: a PIONIER frame takes about 10 seconds to arrive on one
 * connection and 2 to reduce, so a 311-exposure night spent most of its hour downloading one frame after another. */
export async function rawFrames(dpIds: Iterable<string>, directory: string, connections = 4) {
  const queue = [...new Set(dpIds)];
  await Promise.all(Array.from({ length: connections }, async () => { for (let id = queue.shift(); id !== undefined; id = queue.shift()) await rawFrame(id, directory); }));
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

export type EsoHeader = Readonly<Record<string, string | number | boolean>>;

/** Header card lines as keywords, with HIERARCH ones as "ESO DET2 SEQ1 DIT" style keys, each value read by @cssearth/fits. The archive's
 * header service prints cards without their trailing blanks and widens long HIERARCH cards past 80 columns, so each line is read on
 * its own rather than as an 80-column record. */
export function parseHeaderCards(cards: Iterable<string>): EsoHeader {
  const header: Record<string, string | number | boolean> = {};
  for (const line of cards) {
    const card = line.padEnd(80), key = card.slice(0, 8).trim();
    if (!/^[\x20-\x7e]+$/u.test(card)) throw new Error('Invalid FITS header characters.');
    if (key === 'END' && !card.slice(3).trim()) return header;
    if (key === 'CONTINUE') throw new Error('Unsupported FITS CONTINUE convention in header text.');
    if (key !== 'HIERARCH' && card[8] !== '=') continue;
    const name = key === 'HIERARCH' ? esoHierarchy(card).key : key;
    if (Object.hasOwn(header, name)) throw new Error(`Duplicate FITS field: ${name}`);
    const value = fitsCardValue(card);
    if (value !== undefined) header[name] = value;
  }
  throw new Error('A FITS header has no END card.');
}

/** Keywords with a value; a card with an empty value field states none. */
const stated = (header: FitsHeader): EsoHeader => Object.fromEntries(Object.entries(header).filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined));

/** A FITS file's primary header, read record by record up to its END card. */
export async function esoHeader(path: string) {
  const handle = await open(path, 'r'), blocks: Buffer[] = [];
  try {
    for (let offset = 0; offset < MAX_HEADER_RECORDS * 2880; offset += 2880) {
      const block = Buffer.alloc(2880), { bytesRead } = await handle.read(block, 0, 2880, offset);
      if (bytesRead < 2880) break;
      blocks.push(block);
      let end = false;
      for (let i = 0; i < 2880 && !end; i += 80) end = block.toString('latin1', i, i + 8) === 'END     ' && !block.toString('latin1', i + 8, i + 80).trim();
      if (end) break;
    }
  } finally { await handle.close(); }
  return stated(readFitsHeader(Buffer.concat(blocks)).header);
}

const HTML_ENTITIES: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', '#x27': "'", '#39': "'" };

/** A raw frame's primary header from the archive's header service, so frames can be chosen before any is downloaded. The page
 * text is kept in the directory, and read from there when present. */
export async function archiveHeader(dpId: string, directory: string) {
  if (!/^[A-Z]+\.\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}$/u.test(dpId)) throw new TypeError(`${dpId} is not a raw frame id.`);
  const cached = resolve(directory, `${dpId}.header.txt`), read = (text: string) => {
    const header = parseHeaderCards(text.split('\n'));
    if (!('ESO DPR TYPE' in header)) throw new Error(`${dpId}: the archive header has no DPR TYPE.`);
    return header;
  };
  if (await exists(cached)) return read(await readFile(cached, 'utf8'));
  // The service refuses a percent-encoded id.
  const response = await fetch(`https://archive.eso.org/hdr?DpId=${dpId}`);
  if (!response.ok) throw new Error(`${dpId}: the ESO header service answered ${response.status}.`);
  const pre = /<pre>([\s\S]*?)<\/pre>/u.exec(await response.text());
  if (!pre) throw new Error(`${dpId}: the ESO header service returned no header.`);
  const text = pre[1]!.replace(/&(amp|lt|gt|quot|#x27|#39);/gu, (_, name: string) => HTML_ENTITIES[name]!), header = read(text);
  await mkdir(directory, { recursive: true });
  await writeFile(cached, text);
  return header;
}
