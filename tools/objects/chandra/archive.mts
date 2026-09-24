#!/usr/bin/env node
/** Find a Chandra observation's files in the Chandra Data Archive and pin them as a Chandra program.
 *
 *   node tools/objects/chandra/archive.mts <program id> <obsid> [<obsid> ...]
 *
 * For each observation the program records every FITS file the archive keeps under that obsid: the level-1 inputs standard data
 * processing reads (the level-1 event list, the aspect solution and its quality, bad pixels, the mask, the mission timeline and
 * the good-time and status filters, the parameter block, the bias maps, the ephemerides) and the level-2 products the archive's
 * own run produced (the level-2 event list, the binned images, a grating spectrum when there is one), each by URL, byte count
 * and nothing more. Nothing is renamed: a file keeps the archive's own path under the obsid directory, so
 * reprocess.mts can lay the tree out again as the CIAO tools expect it.
 *
 * Alongside them it records what the observation is: instrument, detector, grating, read and data mode, target, proposal and
 * sequence, the observation's start and stop and its livetime, the dataset DOI, and how the archive's own run was configured --
 * the processing version (ASCDSVER), the randomisations, the CTI and time-dependent-gain switches and the calibration files
 * their names state. Those come from the level-1 and level-2 event headers, read over a range request rather than downloaded,
 * and are checked against what the archive's own catalogue says about the observation.
 *
 * The catalogue is queried through PyVO at https://cda.cfa.harvard.edu/cxctap. ivoa.ObsCore is not served there; cxc.observation
 * is, and is what this route reads.
 *
 * The program is written to tools/objects/chandra/programs/<program id>.json. */
import { createGunzip } from 'node:zlib';
import { spawn } from 'node:child_process';
import { mkdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFitsHeader, type FitsHeader } from '../../fits/fits.mts';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { tapRows } from '../astronomy-packages/client.mts';

export const PROGRAMS = resolve(import.meta.dirname, 'programs');
export const TAP = 'https://cda.cfa.harvard.edu/cxctap';
export const ARCHIVE = 'https://cxc.cfa.harvard.edu/cdaftp/byobsid';
const NAME = /^[A-Za-z0-9._-]+$/u;
/** Where the archive keeps an observation's files. Nothing outside these directories is pinned. */
const DIRECTORIES = ['primary', 'primary/responses', 'secondary', 'secondary/aspect', 'secondary/ephem'] as const;
/** A level-2 product carries the level in its name, as standard data processing writes it. Everything else is a level-1 input. */
const PRODUCT = /_(?:evt2|pha2|img2|src2|reg2|bgd2)\.fits(?:\.gz)?$/u;
const FITS = /\.fits(?:\.gz)?$/u;
/** The directory under `byobsid` is the obsid's last digit. */
export const obsidDirectory = (obsid: number) => `${ARCHIVE}/${obsid % 10}/${obsid}`;

/** What this route will not pin, and why. A program pins only what reprocess.mts can re-run and compare.mts can then check
 * independently, so a mode whose re-run would have to be seeded from the archive's own product is refused at the pin rather than
 * pinned and quietly half-checked. The ledger reports these as refused modes. */
export const REFUSED_MODES: Readonly<Record<string, string>> = {
  'any detector, HETG or LETG': "chandra_repro needs the grating's zero-order position. Its default takes that position from the " +
    "archive's own level-2 event list, which would make the re-run depend on the product it is being compared against. The " +
    "independent option, tg_zo_position=detect, found no source on either grating observation tried here: obsid 169 " +
    '(ACIS-S/HETG, Crab Pulsar) and obsid 12228 (HRC-S/LETG, Crab Pulsar) both stopped with "No sources detected" under ' +
    'CIAO 4.18.0. Measured 2026-09-19.',
};

/** The reason this route refuses an observation, or null when it will pin it. */
export function refuseObservation(entry: { grating: string }): string | null {
  if (entry.grating.trim().toUpperCase() !== 'NONE') return REFUSED_MODES['any detector, HETG or LETG']!;
  return null;
}

export interface ChandraFile {
  /** The file's path under the observation's archive directory, e.g. `secondary/acisf02798_002N004_evt1.fits.gz`. */
  readonly path: string;
  readonly url: string;
  readonly bytes: number;
}
/** The mode an observation was taken in, as a receipt and the ledger both name it: the read mode and the data mode, and the
 * data mode alone for a detector that states no read mode (HRC states none). */
export const observationMode = (entry: { readonly readMode?: string; readonly dataMode: string }): string => [entry.readMode, entry.dataMode].filter(Boolean).join('/');

export interface ChandraObservation {
  readonly obsid: number;
  readonly instrument: string;
  readonly detector: string;
  readonly grating: string;
  /** TIMED or CONTINUOUS for ACIS. Absent for HRC, which states no read mode. */
  readonly readMode?: string;
  readonly dataMode: string;
  readonly targetName: string;
  readonly proposalNumber: string;
  readonly sequenceNumber: string;
  readonly startDate: string;
  /** Mission elapsed time of the observation's first and last event frames (TSTART, TSTOP), and the livetime the archive's
   * level-2 product reports for it. */
  readonly startMet: number;
  readonly stopMet: number;
  readonly livetimeSeconds: number;
  /** What the archive catalogue calls the observation's exposure. It is the livetime for an ordinary observation and neither the
   * livetime nor the elapsed time for a heavily dead-timed one (obsid 169: 1781 s against a 39.5 s livetime and a 11,766 s span),
   * so both are recorded and only their ordering is checked. */
  readonly catalogueExposureSeconds: number;
  /** The archive's Digital Object Identifier for the dataset (DS_IDENT). */
  readonly datasetDoi: string;
  /** The processing system version of the archive's own run, level 1 and level 2. A re-run under another CIAO differs first here. */
  readonly ascdsVersion: string;
  /** How the archive's own run was configured, from the level-2 header: the randomisations, the CTI and time-dependent-gain
   * switches, and the calibration files their names state. A re-run that differs from the archive's product differs first in one
   * of these (compare.mts). */
  readonly processing: Readonly<Record<string, string>>;
  readonly inputs: readonly ChandraFile[];
  readonly products: readonly ChandraFile[];
}
export interface ChandraProgram {
  readonly schema: 'cssearth-chandra-program@1';
  readonly id: string;
  readonly target: string;
  readonly observations: readonly ChandraObservation[];
}

const archiveFile = (obsid: number) => (value: unknown): ChandraFile => {
  const row = requireRecord(value, 'Archive file'), path = requireString(row.path, 'File path'), url = requireString(row.url, 'File URL');
  const bytes = requireFiniteNumber(row.bytes, 'File bytes');
  const directory = path.slice(0, path.lastIndexOf('/')), name = path.slice(path.lastIndexOf('/') + 1);
  if (!(DIRECTORIES as readonly string[]).includes(directory) || !NAME.test(name) || !FITS.test(name)) throw new TypeError(`Invalid archive file: ${path}`);
  if (url !== `${obsidDirectory(obsid)}/${path}` || !Number.isSafeInteger(bytes) || bytes < 1) throw new TypeError(`Invalid archive file: ${path}`);
  return { path, url, bytes };
};

export function parseChandraProgram(value: unknown): ChandraProgram {
  const row = requireRecord(value, 'Chandra program');
  if (row.schema !== 'cssearth-chandra-program@1') throw new TypeError('Unsupported Chandra program.');
  const observations = requireArray(row.observations).map(raw => {
    const entry = requireRecord(raw, 'Chandra observation'), obsid = requireFiniteNumber(entry.obsid, 'Obsid');
    if (!Number.isSafeInteger(obsid) || obsid < 1) throw new TypeError(`${obsid} is not a Chandra obsid.`);
    const inputs = requireArray(entry.inputs).map(archiveFile(obsid)), products = requireArray(entry.products).map(archiveFile(obsid));
    if (!inputs.some(file => /_evt1\.fits(?:\.gz)?$/u.test(file.path))) throw new TypeError(`${obsid}: a program pins the level-1 event list.`);
    if (!products.some(file => /_evt2\.fits(?:\.gz)?$/u.test(file.path))) throw new TypeError(`${obsid}: a program pins the archive's level-2 event list.`);
    if (inputs.some(file => PRODUCT.test(file.path))) throw new TypeError(`${obsid}: a level-2 product is pinned as an input.`);
    if (!products.every(file => PRODUCT.test(file.path))) throw new TypeError(`${obsid}: products are the archive's level-2 products.`);
    for (const list of [inputs, products]) if (new Set(list.map(file => file.path)).size !== list.length) throw new TypeError(`${obsid}: a file appears twice.`);
    const start = requireFiniteNumber(entry.startMet, 'TSTART'), stop = requireFiniteNumber(entry.stopMet, 'TSTOP');
    const livetime = requireFiniteNumber(entry.livetimeSeconds, 'Livetime');
    const catalogued = requireFiniteNumber(entry.catalogueExposureSeconds, 'Catalogue exposure');
    if (!(stop > start) || !(livetime > 0) || !(livetime <= stop - start)) throw new TypeError(`${obsid}: its livetime does not fit between TSTART and TSTOP.`);
    if (!(catalogued >= livetime - 1) || !(catalogued <= stop - start + 1)) throw new TypeError(`${obsid}: the catalogue's exposure does not lie between the livetime and the elapsed time.`);
    const processing = Object.fromEntries(Object.entries(requireRecord(entry.processing, 'processing')).map(([key, value]) => [key, requireString(value, key)]));
    return { obsid, instrument: requireString(entry.instrument, 'Instrument'), detector: requireString(entry.detector, 'Detector'),
      grating: requireString(entry.grating, 'Grating'), dataMode: requireString(entry.dataMode, 'Data mode'),
      ...(entry.readMode === undefined ? {} : { readMode: requireString(entry.readMode, 'Read mode') }),
      targetName: requireString(entry.targetName, 'Target name'), proposalNumber: requireString(entry.proposalNumber, 'Proposal number'),
      sequenceNumber: requireString(entry.sequenceNumber, 'Sequence number'), startDate: requireString(entry.startDate, 'Start date'),
      startMet: start, stopMet: stop, livetimeSeconds: livetime, catalogueExposureSeconds: catalogued, datasetDoi: requireString(entry.datasetDoi, 'Dataset DOI'),
      ascdsVersion: requireString(entry.ascdsVersion, 'ASCDSVER'), processing, inputs, products };
  });
  if (new Set(observations.map(entry => entry.obsid)).size !== observations.length) throw new TypeError('An observation appears twice in the program.');
  return { schema: row.schema, id: requireString(row.id, 'Program id'), target: requireString(row.target, 'Target'), observations };
}

/** A pinned file on disk at its pinned size and, once known, its pinned digest: linked from a source directory that already has
 * it, or downloaded with curl, which resumes a partial transfer. The archive drops slow transfers, so one under 200 kB/s for a
 * minute is abandoned and resumed on a fresh connection, twenty times at most. The archive's path is kept, because the CIAO
 * tools read an observation as the directory the archive lays out. */
export async function chandraFile(file: ChandraFile, directory: string, sources: readonly string[] = []): Promise<string> {
  const target = resolve(directory, file.path);
  await mkdir(resolve(target, '..'), { recursive: true });
  const sizeOf = (path: string) => stat(path).then(info => info.size, () => -1);
  if (await sizeOf(target) !== file.bytes) for (const source of sources) {
    const candidate = resolve(source, file.path);
    if (await sizeOf(candidate) === file.bytes) { await rm(target, { force: true }); await symlink(candidate, target); break; }
  }
  for (let attempt = 1; attempt <= 20 && await sizeOf(target) !== file.bytes; attempt++) {
    if (await sizeOf(target) > file.bytes) await rm(target);
    await new Promise<void>(done => { spawn('curl', ['-s', '-L', '-C', '-', '--speed-limit', '200000', '--speed-time', '60', '-o', target, file.url], { stdio: 'inherit' }).on('close', () => done()); });
  }
  if (await sizeOf(target) !== file.bytes) throw new Error(`${file.path} did not download to its pinned ${file.bytes} bytes.`);
  return target;
}

/** One ADQL query against the Chandra Data Archive. PyVO owns TAP and VOTable parsing. */
export async function cxcQuery(query: string): Promise<Record<string, string>[]> {
  return tapRows(TAP, query);
}

/** The files the archive lists under one of an observation's directories, with their sizes. The listing is an Apache-style
 * index; only the FITS files are taken from it, and a size is asked for each with a HEAD, because the index reports them
 * rounded. */
async function listDirectory(obsid: number, directory: string): Promise<ChandraFile[]> {
  const base = `${obsidDirectory(obsid)}/${directory}`;
  const response = await fetch(`${base}/`, { redirect: 'follow', signal: AbortSignal.timeout(120_000) });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`The Chandra archive refused ${base}/: ${response.status}`);
  const body = await response.text();
  const names = [...new Set([...body.matchAll(/href="([^"]+)"/gu)].map(match => match[1]!).filter(name => FITS.test(name) && NAME.test(name)))].sort();
  const files: ChandraFile[] = [];
  for (const name of names) {
    const url = `${base}/${name}`;
    const head = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(120_000) });
    if (!head.ok) throw new Error(`The Chandra archive refused ${url}: ${head.status}`);
    const bytes = Number(head.headers.get('content-length'));
    if (!Number.isSafeInteger(bytes) || bytes < 1) throw new Error(`${url} has no size.`);
    files.push({ path: `${directory}/${name}`, url, bytes });
  }
  return files;
}

/** Decompress what a range of a gzipped file holds. The truncated member at its end is expected; what was decompressed before it
 * is kept. A body the server already decoded is returned as it came. */
async function inflatePrefix(body: Buffer, limit: number): Promise<Buffer> {
  if (body[0] !== 0x1f || body[1] !== 0x8b) return body;
  const chunks: Buffer[] = [];
  await new Promise<void>(done => {
    const gunzip = createGunzip();
    let size = 0;
    gunzip.on('data', chunk => { chunks.push(chunk as Buffer); size += (chunk as Buffer).length; if (size > limit) gunzip.destroy(); });
    gunzip.on('error', () => done());
    gunzip.on('end', () => done());
    gunzip.on('close', () => done());
    gunzip.end(body);
  });
  return Buffer.concat(chunks);
}

/** The primary and first-extension header of an archive file, read over a range request: a header is a few records, the file may
 * be hundreds of megabytes. The archive serves a `.fits.gz` with `Content-Encoding: gzip`, so a client that accepts that encoding
 * is handed the decompressed bytes and one that does not is handed the file; both are read here. */
export async function archiveHeaders(url: string, bytes = 512 * 1024): Promise<{ primary: FitsHeader; extension: FitsHeader }> {
  const response = await fetch(url, { headers: { Range: `bytes=0-${bytes - 1}` }, redirect: 'follow', signal: AbortSignal.timeout(300_000) });
  if (!response.ok) throw new Error(`The Chandra archive refused ${url}: ${response.status}`);
  const decompressed = await inflatePrefix(Buffer.from(await response.arrayBuffer()), 8 * 1024 * 1024);
  if (decompressed.length < 2880) throw new Error(`${url} did not yield a FITS header.`);
  const primary = readFitsHeader(decompressed);
  const extension = readFitsHeader(decompressed, primary.dataOffset);
  return { primary: primary.header, extension: extension.header };
}

const text = (header: FitsHeader, key: string) => {
  const value = header[key];
  if (value === undefined || value === '' || (typeof value === 'string' && !value.trim())) throw new Error(`The header has no ${key}.`);
  return typeof value === 'string' ? value.trim() : String(value);
};
const optional = (header: FitsHeader, key: string) => {
  const value = header[key];
  return value === undefined ? undefined : typeof value === 'string' ? value.trim() : typeof value === 'boolean' ? (value ? 'T' : 'F') : String(value);
};
/** How the archive's own run was configured, as the level-2 event header states it. */
const PROCESSING_CARDS = ['CREATOR', 'ASCDSVER', 'REVISION', 'DATE', 'RAND_SKY', 'RAND_PI', 'RAND_TIM', 'CTI_CORR', 'CTI_APP', 'TGAINCOR', 'TGAINFIL',
  'GRD_FILE', 'GAINFILE', 'CTIFILE', 'THRFILE', 'SUBPIXFL', 'PIX_ADJ', 'READMODE', 'DATAMODE', 'CHECKVF', 'DTCOR'] as const;

/** One observation's level-1 inputs, level-2 products and identity, as the archive lists them and its own event headers state
 * them, checked against the archive catalogue. */
export async function chandraObservation(obsid: number): Promise<ChandraObservation> {
  const [row] = await cxcQuery(`SELECT obsid, target_name, instrument, grating, exposure_time, start_date, status, proposal_number, sequence_num FROM cxc.observation WHERE obsid=${obsid}`);
  if (!row) throw new Error(`The Chandra archive has no observation ${obsid}.`);
  if (row.status !== 'archived') throw new Error(`Observation ${obsid} is ${row.status ?? 'unknown'}, not archived; only public observations are pinned.`);
  const listed = (await Promise.all(DIRECTORIES.map(directory => listDirectory(obsid, directory)))).flat();
  const inputs = listed.filter(file => !PRODUCT.test(file.path)), products = listed.filter(file => PRODUCT.test(file.path));
  const level1 = inputs.find(file => /_evt1\.fits(?:\.gz)?$/u.test(file.path));
  const level2 = products.find(file => /_evt2\.fits(?:\.gz)?$/u.test(file.path));
  if (!level1) throw new Error(`${obsid}: the archive lists no level-1 event list.`);
  if (!level2) throw new Error(`${obsid}: the archive lists no level-2 event list.`);
  const [one, two] = await Promise.all([archiveHeaders(level1.url), archiveHeaders(level2.url)]);
  // The pin must describe the files it pins, so the two event headers must agree on what the observation is, and agree with the
  // catalogue. A level-2 product made from another level 1 would show here.
  // READMODE is ACIS's; HRC states none, so a card absent from both headers is not a disagreement.
  for (const key of ['OBS_ID', 'INSTRUME', 'DETNAM', 'GRATING', 'READMODE', 'DATAMODE', 'TSTART', 'TSTOP', 'DS_IDENT', 'SEQ_NUM']) {
    if (one.extension[key] === undefined && two.extension[key] === undefined) continue;
    if (text(one.extension, key) !== text(two.extension, key)) throw new Error(`${obsid}: level 1 says ${key}=${text(one.extension, key)}, level 2 ${text(two.extension, key)}.`);
  }
  if (Number(text(two.extension, 'OBS_ID')) !== obsid) throw new Error(`${obsid}: its event header says OBS_ID=${text(two.extension, 'OBS_ID')}.`);
  const instrument = text(two.extension, 'INSTRUME'), detector = text(two.extension, 'DETNAM'), grating = text(two.extension, 'GRATING');
  if (!requireString(row.instrument, 'catalogue instrument').startsWith(instrument)) throw new Error(`${obsid}: the catalogue calls it ${row.instrument}, the header ${instrument}.`);
  if (grating.toUpperCase() !== requireString(row.grating, 'catalogue grating').toUpperCase()) throw new Error(`${obsid}: the catalogue's grating is ${row.grating}, the header's ${grating}.`);
  if (requireString(row.proposal_number, 'catalogue proposal').replace(/^0+/u, '') !== text(two.extension, 'SEQ_NUM').replace(/^0+/u, '') &&
    !requireString(row.sequence_num, 'catalogue sequence').replace(/^0+/u, '').includes(text(two.extension, 'SEQ_NUM').replace(/^0+/u, '')))
    throw new Error(`${obsid}: the catalogue's sequence ${row.sequence_num} is not the header's SEQ_NUM ${text(two.extension, 'SEQ_NUM')}.`);
  const livetime = requireFiniteNumber(two.extension.LIVETIME ?? two.extension.EXPOSURE, 'LIVETIME');
  // The catalogue's exposure and the header's livetime agree for an ordinary observation and part company for a heavily
  // dead-timed one, so what is checked is that the catalogue's value lies between the livetime and the elapsed time.
  const exposure = requireFiniteNumber(Number(row.exposure_time), 'catalogue exposure') * 1000;
  const elapsed = requireFiniteNumber(two.extension.TSTOP, 'TSTOP') - requireFiniteNumber(two.extension.TSTART, 'TSTART');
  if (!(exposure >= livetime - 1) || !(exposure <= elapsed + 1))
    throw new Error(`${obsid}: the catalogue's exposure is ${exposure.toFixed(1)} s, outside the header's livetime ${livetime.toFixed(1)} s and elapsed ${elapsed.toFixed(1)} s.`);
  const refused = refuseObservation({ grating });
  if (refused) throw new Error(`${obsid} is not pinned: ${refused}`);
  const processing = Object.fromEntries(PROCESSING_CARDS.map(key => [key, optional(two.extension, key)]).filter((pair): pair is [string, string] => pair[1] !== undefined));
  return { obsid, instrument, detector, grating, ...(two.extension.READMODE === undefined ? {} : { readMode: text(two.extension, 'READMODE') }), dataMode: text(two.extension, 'DATAMODE'),
    targetName: text(two.extension, 'OBJECT'), proposalNumber: requireString(row.proposal_number, 'proposal'), sequenceNumber: text(two.extension, 'SEQ_NUM'),
    startDate: requireString(row.start_date, 'start date'), startMet: requireFiniteNumber(two.extension.TSTART, 'TSTART'),
    stopMet: requireFiniteNumber(two.extension.TSTOP, 'TSTOP'), livetimeSeconds: livetime, catalogueExposureSeconds: exposure, datasetDoi: text(two.extension, 'DS_IDENT'),
    ascdsVersion: text(two.extension, 'ASCDSVER'), processing, inputs, products };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [id, ...obsids] = process.argv.slice(2);
  if (!id || !NAME.test(id) || !obsids.length || !obsids.every(value => /^\d+$/u.test(value))) throw new TypeError('Usage: archive <program id> <obsid> [...]');
  const path = resolve(PROGRAMS, `${id}.json`);
  const existing = await readFile(path, 'utf8').then(text => parseChandraProgram(JSON.parse(text)), () => null);
  const entries = [...existing?.observations ?? []];
  let target = existing?.target;
  for (const value of obsids) {
    const entry = await chandraObservation(Number(value));
    target ??= entry.targetName;
    // Digests recorded by an earlier download stay with their file.
    const keep = (list: readonly ChandraFile[], previous: readonly ChandraFile[] = []) => list.map(file => {
      const before = previous.find(other => other.path === file.path && other.bytes === file.bytes);
      return file;
    });
    const index = entries.findIndex(other => other.obsid === entry.obsid);
    const withDigests = { ...entry, inputs: keep(entry.inputs, entries[index]?.inputs), products: keep(entry.products, entries[index]?.products) };
    if (index >= 0) entries[index] = withDigests; else entries.push(withDigests);
    console.log(`${entry.obsid}: ${entry.instrument}/${entry.detector} ${entry.grating} ${[entry.readMode, entry.dataMode].filter(Boolean).join('/')} ${entry.targetName}, ${(entry.livetimeSeconds / 1000).toFixed(1)} ks, ${entry.inputs.length} inputs, ${entry.products.length} products, ASCDSVER ${entry.ascdsVersion}`);
  }
  const program = parseChandraProgram({ schema: 'cssearth-chandra-program@1', id, target, observations: entries });
  await mkdir(PROGRAMS, { recursive: true });
  await writeFile(path, `${JSON.stringify(program, null, 2)}\n`);
  console.log(`CHANDRA_PROGRAM ${path}`);
}
