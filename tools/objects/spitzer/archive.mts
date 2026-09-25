#!/usr/bin/env node
/** Find one Spitzer observation in the Spitzer Heritage Archive at IRSA and pin every file a re-mosaic needs.
 *
 *   node tools/objects/spitzer/archive.mts <program id> <aorkey> [--channels 1,2,3,4] [--data <dir>]
 *
 * What is pinned, per IRAC channel: the archive's own level-2 mosaic (`maic`) with its uncertainty (`munc`) and coverage
 * (`mcov`), and the level-1 frames that went into it, each as its corrected basic-calibrated image (`cbcd`), its uncertainty
 * (`cbunc`) and its imask (`bimsk`). Every file is recorded by URL, byte count and sha256, the sha256 taken from the bytes on
 * first download. Where the archive publishes its own MD5 for a file (it does for the primary level-1 and level-2 products,
 * not for the ancillary planes beside them) that MD5 is recorded and checked, and a mismatch refuses the pin.
 *
 * Beside the files it records what the observation is, twice over: once as the archive's catalogue describes it (target,
 * position, programme, principal investigator, instrument, mode, start and end) and once from the pinned FITS headers
 * themselves (AORKEY, CHNLNUM, OBJECT, INSTRUME, the mosaic's geometry). The two are cross-checked and a disagreement refuses
 * the pin, so a program file cannot name one observation and hold another's bytes.
 *
 * One fact is recorded because the archive's own mosaic depends on it and nothing else states it: in IRAC High Dynamic Range
 * mode an AOR takes a short frame and a long frame at each pointing, and the archive mosaics one frame time, not both. The
 * mosaic header's FRAMTIME says which, and each frame header says what it is, so the membership of the archive's product is
 * read rather than assumed. mosaic.mts uses exactly the frames whose FRAMTIME matches.
 *
 * Access is public and needs no account. Two IRSA services are used and they are not equal in standing:
 *  - the archive's file tree at https://irsa.ipac.caltech.edu/ibe/data/spitzer, a plain indexed HTTPS directory;
 *  - the Heritage Archive's own search backend at .../applications/Spitzer/SHA/sticky/CmdSrv, which is what the archive's web
 *    application calls. The documented `servlet/DataService` interface that IRSA's help pages still describe returned HTTP 404
 *    on 2026-09-19 from both sha.ipac.caltech.edu and irsa.ipac.caltech.edu, so it is gone and this is what is left. It is an
 *    application backend, not a published API, and it may change without notice; everything it returns is validated here.
 *
 * The program is written to tools/objects/spitzer/programs/<program id>.json. */
import { createHash } from 'node:crypto';
import { mkdir, open, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { FitsHeader } from '@cssearth/fits';
import { readFitsFileHdus } from '@cssearth/fits/node';
import { sha256File } from '@cssearth/core/node';
import { flagValue, positionalArguments, hasErrorCode, requireArray, requireRecord, requireString } from '@cssearth/core';

export const PROGRAMS = resolve(import.meta.dirname, 'programs');
export const REPOSITORY = resolve(import.meta.dirname, '../../..');
export const SEARCH = 'https://irsa.ipac.caltech.edu/applications/Spitzer/SHA/sticky/CmdSrv';
export const DATA = 'https://irsa.ipac.caltech.edu/ibe/data/spitzer';
const SCHEMA = 'cssearth-spitzer-program@1';
const HEX64 = /^[0-9a-f]{64}$/u, HEX32 = /^[0-9a-f]{32}$/u;
const REQUEST_TIMEOUT_MS = 180_000, ATTEMPTS = 3;

/** What each pinned file is for. The three frame roles are one frame's image, its uncertainty and its mask; the three mosaic
 * roles are the archive's product and the two planes that say where it is covered and how well it is known. */
export const FILE_ROLES = ['mosaic', 'mosaic-uncertainty', 'mosaic-coverage', 'frame', 'frame-uncertainty', 'frame-mask'] as const;
export type FileRole = typeof FILE_ROLES[number];
/** The archive's file suffix for each role, and whether the catalogue publishes an MD5 for it. */
const ROLE_SUFFIX: Readonly<Record<FileRole, string>> = {
  mosaic: 'maic', 'mosaic-uncertainty': 'munc', 'mosaic-coverage': 'mcov',
  frame: 'cbcd', 'frame-uncertainty': 'cbunc', 'frame-mask': 'bimsk',
};

export interface SpitzerFile {
  readonly role: FileRole;
  readonly name: string;
  readonly url: string;
  readonly bytes: number;
  /** The archive's own MD5, where its catalogue publishes one. Absent for the ancillary planes, which it does not list. */
  readonly archiveMd5?: string;
}
export interface SpitzerFrame {
  /** The frame's data-collection-event number inside the AOR, as the file name carries it (`0001`). */
  readonly dce: string;
  /** FRAMTIME: the commanded frame time. In High Dynamic Range mode this is what separates the short frame from the long one. */
  readonly frameTimeSeconds: number;
  /** EXPTIME: the effective integration the frame holds, which is shorter than FRAMTIME. */
  readonly exposureSeconds: number;
  readonly dateObs: string;
  readonly files: readonly SpitzerFile[];
}
export interface SpitzerMosaicGeometry {
  readonly width: number;
  readonly height: number;
  readonly crval1: number;
  readonly crval2: number;
  readonly pixelScaleArcsec: number;
  readonly units: string;
  /** CREATOR: the pipeline version the archive made this mosaic with (for example `S18.25.0`). */
  readonly creator: string;
}
export interface SpitzerChannel {
  /** IRAC channel 1 to 4. */
  readonly channel: number;
  readonly wavelength: string;
  /** The FRAMTIME of the archive's mosaic: the frames whose FRAMTIME is this are the ones it combined. */
  readonly mosaicFrameTimeSeconds: number;
  readonly mosaic: SpitzerMosaicGeometry;
  readonly products: readonly SpitzerFile[];
  readonly frames: readonly SpitzerFrame[];
}
export interface SpitzerProgram {
  readonly schema: typeof SCHEMA;
  readonly id: string;
  readonly aorKey: number;
  readonly programme: string;
  readonly principalInvestigator: string;
  readonly target: string;
  readonly targetRa: number;
  readonly targetDec: number;
  readonly instrument: string;
  readonly mode: string;
  readonly observedFrom: string;
  readonly observedTo: string;
  readonly channels: readonly SpitzerChannel[];
}

/** One row of a Heritage Archive search, as strings: the backend returns every column as text and nothing here pretends
 * otherwise. Callers convert the columns they use and validate them. */
export type ShaRow = Readonly<Record<string, string>>;

const numeric = (row: ShaRow, key: string, label: string): number => {
  const value = Number(row[key]);
  if (!Number.isFinite(value)) throw new TypeError(`${label}: ${key} is not a number (${String(row[key])}).`);
  return value;
};

/** Ask the Heritage Archive's search backend one question and return its rows. The backend answers a failure as a JSON array of
 * error objects and a success as an object with a table in it, so the shape itself says which happened. */
export async function shaSearch(request: Readonly<Record<string, string>>, options: { readonly timeoutMs?: number; readonly attempts?: number } = {}): Promise<ShaRow[]> {
  const url = `${SEARCH}?cmd=tableSearch&request=${encodeURIComponent(JSON.stringify(request))}`;
  const attempts = options.attempts ?? ATTEMPTS;
  let last: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(options.timeoutMs ?? REQUEST_TIMEOUT_MS) });
      if (!response.ok) throw new Error(`The Heritage Archive answered ${response.status} for ${request.id ?? 'a search'}.`);
      const body: unknown = JSON.parse(await response.text());
      if (Array.isArray(body)) throw new Error(`The Heritage Archive refused ${request.id ?? 'a search'}: ${JSON.stringify(body).slice(0, 400)}`);
      const table = requireRecord(body, 'Heritage Archive answer');
      if (table.tableData === undefined) return [];
      const data = requireRecord(table.tableData, 'tableData');
      const columns = requireArray(data.columns, 'columns').map(entry => requireString(requireRecord(entry, 'column').name, 'column name'));
      return requireArray(data.data ?? [], 'rows').map(raw => {
        const values = requireArray(raw, 'row');
        return Object.fromEntries(columns.map((name, index) => [name, values[index] === null || values[index] === undefined ? '' : String(values[index])]));
      });
    } catch (error) { last = error; }
  }
  throw new Error(`The Heritage Archive did not answer ${request.id ?? 'a search'} in ${attempts} attempts: ${String(last)}`);
}

/** The URL of a file the archive's catalogue names. `heritagefilename` is the path inside the archive's file tree. */
export function archiveUrl(heritageFilename: string): string {
  if (!heritageFilename.startsWith('/sha/archive/')) throw new TypeError(`Not an archive path: ${heritageFilename}`);
  if (heritageFilename.includes('..')) throw new TypeError(`Unsafe archive path: ${heritageFilename}`);
  return `${DATA}${heritageFilename}`;
}

/** The name and URL of the file that plays `role` beside the one the catalogue named. The archive stores a frame's image,
 * uncertainty and mask, and a mosaic and its two planes, as separate files in one directory whose names differ only in the
 * suffix and, for the mosaic's planes, in an internal product id. The frame's siblings are named by substitution; the
 * mosaic's are found by listing the directory, because their product ids are not derivable. */
export function frameSibling(url: string, from: FileRole, to: FileRole): string {
  const suffix = `_${ROLE_SUFFIX[from]}.fits`;
  if (!url.endsWith(suffix)) throw new TypeError(`${url} is not a ${from} file.`);
  return `${url.slice(0, -suffix.length)}_${ROLE_SUFFIX[to]}.fits`;
}

/** The files an archive directory holds, from its index page. Used only to find the mosaic's uncertainty and coverage planes,
 * whose names carry archive-internal ids. */
export async function listArchiveDirectory(url: string): Promise<string[]> {
  const response = await fetch(url.endsWith('/') ? url : `${url}/`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`The archive answered ${response.status} listing ${url}.`);
  const names = new Set<string>();
  for (const match of (await response.text()).matchAll(/<a href="([^"?/][^"]*)">/gu)) {
    const name = match[1];
    if (name && !name.includes('/')) names.add(name);
  }
  return [...names].sort();
}

/** The archive's uncertainty and coverage planes belonging to one IRAC mosaic. */
export async function mosaicCompanions(mosaicUrl: string, aorKey: number, channel: number): Promise<readonly string[]> {
  if (!Number.isSafeInteger(aorKey) || aorKey < 1 || !Number.isSafeInteger(channel) || channel < 1 || channel > 4 ||
      !mosaicUrl.startsWith(`${DATA}/sha/archive/`) || !mosaicUrl.endsWith('_maic.fits')) throw new TypeError('Invalid Spitzer mosaic identity.');
  const directory = mosaicUrl.slice(0, mosaicUrl.lastIndexOf('/'));
  const names = await listArchiveDirectory(directory);
  return (['mosaic-uncertainty', 'mosaic-coverage'] as const).map(role => {
    const suffix = `_${ROLE_SUFFIX[role]}.fits`;
    const found = names.filter(name => name.endsWith(suffix) && name.startsWith(`SPITZER_I${channel}_${aorKey}_`));
    if (found.length !== 1) throw new Error(`Channel ${channel} has ${found.length} ${role} files beside its mosaic; one is expected.`);
    return `${directory}/${found[0]!}`;
  });
}

/** Download `url` to `path` unless the bytes are already there, and return its identity. Written to a neighbouring `.part`
 * file and renamed only once it is whole, so an interrupted run never leaves a short file that looks finished. */
export async function download(url: string, path: string): Promise<{ bytes: number; sha256: string }> {
  const existing = await stat(path).then(entry => entry.size, error => { if (hasErrorCode(error, 'ENOENT')) return -1; throw error; });
  if (existing >= 0) return sha256File(path);
  await mkdir(resolve(path, '..'), { recursive: true });
  const part = `${path}.part`;
  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok || !response.body) throw new Error(`The archive answered ${response.status} for ${url}.`);
  const handle = await open(part, 'w');
  try { await pipeline(Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]), handle.createWriteStream()); }
  finally { await handle.close(); }
  await rename(part, path);
  return sha256File(path);
}

const md5File = async (path: string): Promise<string> => {
  const hash = createHash('md5'), handle = await open(path, 'r');
  try {
    const chunk = Buffer.alloc(8 << 20);
    for (let offset = 0; ; offset += chunk.length) {
      const { bytesRead } = await handle.read(chunk, 0, chunk.length, offset);
      if (!bytesRead) break;
      hash.update(chunk.subarray(0, bytesRead));
    }
  } finally { await handle.close(); }
  return hash.digest('hex');
};

/** Fetch one file and pin it. `archiveMd5` is checked against the bytes when the catalogue published one; the pin is refused
 * rather than recorded when they differ, because a pin that records a digest it could not confirm is worth nothing. */
export async function pinFile(role: FileRole, url: string, directory: string, archiveMd5?: string): Promise<SpitzerFile> {
  const name = url.slice(url.lastIndexOf('/') + 1);
  if (!/^[A-Za-z0-9._-]+\.fits$/u.test(name)) throw new TypeError(`Not an archive FITS name: ${name}`);
  const path = resolve(directory, name);
  const { bytes } = await download(url, path);
  if (archiveMd5 !== undefined) {
    if (!HEX32.test(archiveMd5)) throw new TypeError(`${name}: the archive's checksum is not an MD5 (${archiveMd5}).`);
    const found = await md5File(path);
    if (found !== archiveMd5) throw new Error(`${name} does not match the archive's own MD5: got ${found}, the catalogue says ${archiveMd5}.`);
  }
  return { role, name, url, bytes, ...(archiveMd5 === undefined ? {} : { archiveMd5 }) };
}

const card = (header: FitsHeader, key: string, label: string): string => {
  const value = header[key];
  if (value === undefined) throw new TypeError(`${label} has no ${key}.`);
  return String(value).trim();
};
const cardNumber = (header: FitsHeader, key: string, label: string): number => {
  const value = Number(card(header, key, label));
  if (!Number.isFinite(value)) throw new TypeError(`${label}: ${key} is not a number.`);
  return value;
};

/** The primary header of a pinned file. Every fact this module records about an observation that is not the catalogue's comes
 * from here, so the file's own account is what is checked. */
export const primaryHeader = async (path: string): Promise<FitsHeader> => (await readFitsFileHdus(path))[0]!.header;

/** Pin one AOR: its catalogue description, its level-2 mosaics and the level-1 frames behind them.
 *
 * `channels` selects IRAC channels; every channel the archive holds a mosaic for is available. Files land under
 * `<data>/<program id>/ch<n>/`, and a file already there is reused by byte count and digest rather than fetched again. */
export async function pinProgram(id: string, aorKey: number, channels: readonly number[], dataRoot: string): Promise<SpitzerProgram> {
  if (!/^[A-Za-z0-9._-]+$/u.test(id)) throw new TypeError(`${id} is not a program id.`);
  if (!Number.isSafeInteger(aorKey) || aorKey < 1) throw new TypeError(`${aorKey} is not an AORKEY.`);
  const key = String(aorKey);
  const [aor] = await shaSearch({ id: 'aorByRequestID', aorKey: key });
  if (!aor) throw new Error(`The Heritage Archive holds no AOR ${aorKey}.`);
  const instrument = requireString(aor.modedisplayname, 'mode').split(' ')[0] ?? '';
  if (instrument !== 'IRAC') throw new Error(`AOR ${aorKey} is ${aor.modedisplayname}; this toolkit re-mosaics IRAC imaging only.`);

  const mosaics = (await shaSearch({ id: 'pbcdByRequestID', aorKey: key })).filter(row => row.externalname?.endsWith('_maic.fits'));
  const frames = await shaSearch({ id: 'bcdByRequestID', aorKey: key });
  if (!mosaics.length) throw new Error(`AOR ${aorKey} has no level-2 mosaic in the archive; there would be nothing to check a re-mosaic against.`);

  const pinned: SpitzerChannel[] = [];
  for (const channel of [...new Set(channels)].sort((a, b) => a - b)) {
    const row = mosaics.find(entry => Number(entry.channum) === channel);
    if (!row) throw new Error(`AOR ${aorKey} has no channel ${channel} mosaic.`);
    const directory = resolve(dataRoot, id, `ch${channel}`);
    const mosaicUrl = archiveUrl(requireString(row.heritagefilename, 'mosaic path'));
    const products = [await pinFile('mosaic', mosaicUrl, directory, row.checksum || undefined)];
    for (const [index, url] of (await mosaicCompanions(mosaicUrl, aorKey, channel)).entries())
      products.push(await pinFile(index === 0 ? 'mosaic-uncertainty' : 'mosaic-coverage', url, directory));

    const header = await primaryHeader(resolve(directory, products[0]!.name));
    if (cardNumber(header, 'AORKEY', 'the mosaic') !== aorKey) throw new Error(`Channel ${channel}: the mosaic's AORKEY is ${card(header, 'AORKEY', 'the mosaic')}, not ${aorKey}.`);
    if (cardNumber(header, 'CHNLNUM', 'the mosaic') !== channel) throw new Error(`Channel ${channel}: the mosaic's CHNLNUM disagrees with the catalogue.`);
    if (card(header, 'INSTRUME', 'the mosaic') !== instrument) throw new Error(`Channel ${channel}: the mosaic says ${card(header, 'INSTRUME', 'the mosaic')}, the catalogue says ${instrument}.`);
    const width = cardNumber(header, 'NAXIS1', 'the mosaic'), height = cardNumber(header, 'NAXIS2', 'the mosaic');
    if (width !== numeric(row, 'naxis1', 'the catalogue') || height !== numeric(row, 'naxis2', 'the catalogue'))
      throw new Error(`Channel ${channel}: the mosaic is ${width} x ${height}, the catalogue says ${row.naxis1} x ${row.naxis2}.`);
    if (Math.abs(cardNumber(header, 'CRVAL1', 'the mosaic') - numeric(row, 'crval1', 'the catalogue')) > 1e-6 ||
        Math.abs(cardNumber(header, 'CRVAL2', 'the mosaic') - numeric(row, 'crval2', 'the catalogue')) > 1e-6)
      throw new Error(`Channel ${channel}: the mosaic's reference point disagrees with the catalogue.`);
    const mosaicFrameTime = cardNumber(header, 'FRAMTIME', 'the mosaic');
    const mosaic: SpitzerMosaicGeometry = { width, height, crval1: cardNumber(header, 'CRVAL1', 'the mosaic'), crval2: cardNumber(header, 'CRVAL2', 'the mosaic'),
      pixelScaleArcsec: Math.abs(cardNumber(header, 'PXSCAL2', 'the mosaic')), units: card(header, 'BUNIT', 'the mosaic'), creator: card(header, 'CREATOR', 'the mosaic') };

    const pinnedFrames: SpitzerFrame[] = [];
    for (const entry of frames.filter(candidate => Number(candidate.channum) === channel).sort((a, b) => (a.externalname ?? '').localeCompare(b.externalname ?? ''))) {
      // The catalogue lists the basic-calibrated frame; the archive's own mosaic is built from the corrected one beside it,
      // so that is what is pinned and what mosaic.mts reads.
      const bcdUrl = archiveUrl(requireString(entry.heritagefilename, 'frame path'));
      if (!bcdUrl.endsWith('_bcd.fits')) throw new TypeError(`${bcdUrl} is not a level-1 frame.`);
      const frameUrl = `${bcdUrl.slice(0, -'_bcd.fits'.length)}_cbcd.fits`;
      const files = [await pinFile('frame', frameUrl, directory)];
      for (const role of ['frame-uncertainty', 'frame-mask'] as const) files.push(await pinFile(role, frameSibling(frameUrl, 'frame', role), directory));
      const frameHeader = await primaryHeader(resolve(directory, files[0]!.name));
      if (cardNumber(frameHeader, 'AORKEY', files[0]!.name) !== aorKey || cardNumber(frameHeader, 'CHNLNUM', files[0]!.name) !== channel)
        throw new Error(`${files[0]!.name} belongs to another observation than AOR ${aorKey} channel ${channel}.`);
      const dce = files[0]!.name.split('_')[3];
      if (!dce || !/^\d+$/u.test(dce)) throw new TypeError(`Unreadable frame number in ${files[0]!.name}.`);
      pinnedFrames.push({ dce, frameTimeSeconds: cardNumber(frameHeader, 'FRAMTIME', files[0]!.name),
        exposureSeconds: cardNumber(frameHeader, 'EXPTIME', files[0]!.name), dateObs: card(frameHeader, 'DATE_OBS', files[0]!.name), files });
    }
    if (!pinnedFrames.some(frame => frame.frameTimeSeconds === mosaicFrameTime))
      throw new Error(`Channel ${channel}: no pinned frame has the mosaic's frame time of ${mosaicFrameTime} s, so nothing here made that mosaic.`);
    pinned.push({ channel, wavelength: requireString(row.wavelength, 'wavelength'), mosaicFrameTimeSeconds: mosaicFrameTime, mosaic, products, frames: pinnedFrames });
  }

  return parseSpitzerProgram({
    schema: SCHEMA, id, aorKey, programme: requireString(aor.progid, 'programme'), principalInvestigator: requireString(aor.pi, 'PI'),
    target: requireString(aor.targetname, 'target'), targetRa: numeric(aor, 'raj2000', 'the AOR'), targetDec: numeric(aor, 'decj2000', 'the AOR'),
    instrument, mode: requireString(aor.modedisplayname, 'mode'), observedFrom: requireString(aor.reqbegintime, 'start'), observedTo: requireString(aor.reqendtime, 'end'),
    channels: pinned,
  });
}

export function parseSpitzerProgram(value: unknown): SpitzerProgram {
  const row = requireRecord(value, 'Spitzer program');
  if (row.schema !== SCHEMA) throw new TypeError(`Unsupported Spitzer program schema ${String(row.schema)}.`);
  const number = (entry: unknown, label: string) => { const found = Number(entry); if (!Number.isFinite(found)) throw new TypeError(`${label} is not a number.`); return found; };
  const file = (raw: unknown): SpitzerFile => {
    const entry = requireRecord(raw, 'file'), role = requireString(entry.role, 'file role');
    if (!(FILE_ROLES as readonly string[]).includes(role)) throw new TypeError(`${role} is not a pinned file role.`);
    const name = requireString(entry.name, 'file name'), url = requireString(entry.url, 'file url'), bytes = number(entry.bytes, `${name} bytes`);
    if (!Number.isSafeInteger(bytes) || bytes < 1) throw new TypeError(`${name} has no byte count.`);
    if (!url.startsWith(`${DATA}/sha/archive/`) || !url.endsWith(`/${name}`)) throw new TypeError(`${name} is not pinned to the Spitzer archive.`);
    if (entry.archiveMd5 !== undefined && !HEX32.test(requireString(entry.archiveMd5, 'archive md5'))) throw new TypeError(`${name} has an unreadable archive MD5.`);
    return { role: role as FileRole, name, url, bytes, ...(entry.archiveMd5 === undefined ? {} : { archiveMd5: entry.archiveMd5 as string }) };
  };
  const channels = requireArray(row.channels, 'channels').map(raw => {
    const entry = requireRecord(raw, 'channel'), channel = number(entry.channel, 'channel');
    if (!Number.isSafeInteger(channel) || channel < 1 || channel > 4) throw new TypeError(`${channel} is not an IRAC channel.`);
    const products = requireArray(entry.products, 'products').map(file);
    for (const role of ['mosaic', 'mosaic-uncertainty', 'mosaic-coverage'] as const)
      if (products.filter(product => product.role === role).length !== 1) throw new TypeError(`Channel ${channel} needs exactly one ${role}.`);
    const frames = requireArray(entry.frames, 'frames').map(rawFrame => {
      const frame = requireRecord(rawFrame, 'frame'), files = requireArray(frame.files, 'frame files').map(file);
      for (const role of ['frame', 'frame-uncertainty', 'frame-mask'] as const)
        if (files.filter(candidate => candidate.role === role).length !== 1) throw new TypeError(`A frame of channel ${channel} needs exactly one ${role}.`);
      return { dce: requireString(frame.dce, 'frame number'), frameTimeSeconds: number(frame.frameTimeSeconds, 'FRAMTIME'),
        exposureSeconds: number(frame.exposureSeconds, 'EXPTIME'), dateObs: requireString(frame.dateObs, 'DATE_OBS'), files };
    });
    if (!frames.length) throw new TypeError(`Channel ${channel} pins no frames.`);
    if (new Set(frames.map(frame => frame.dce)).size !== frames.length) throw new TypeError(`Channel ${channel} pins a frame twice.`);
    const mosaicRecord = requireRecord(entry.mosaic, 'mosaic geometry');
    const mosaicFrameTimeSeconds = number(entry.mosaicFrameTimeSeconds, 'the mosaic FRAMTIME');
    if (!frames.some(frame => frame.frameTimeSeconds === mosaicFrameTimeSeconds))
      throw new TypeError(`Channel ${channel} pins no frame with the mosaic's frame time of ${mosaicFrameTimeSeconds} s.`);
    return { channel, wavelength: requireString(entry.wavelength, 'wavelength'), mosaicFrameTimeSeconds, products, frames,
      mosaic: { width: number(mosaicRecord.width, 'mosaic width'), height: number(mosaicRecord.height, 'mosaic height'),
        crval1: number(mosaicRecord.crval1, 'CRVAL1'), crval2: number(mosaicRecord.crval2, 'CRVAL2'),
        pixelScaleArcsec: number(mosaicRecord.pixelScaleArcsec, 'pixel scale'), units: requireString(mosaicRecord.units, 'BUNIT'),
        creator: requireString(mosaicRecord.creator, 'CREATOR') } };
  });
  if (!channels.length) throw new TypeError('A Spitzer program pins at least one channel.');
  if (new Set(channels.map(entry => entry.channel)).size !== channels.length) throw new TypeError('A channel is pinned twice.');
  return { schema: SCHEMA, id: requireString(row.id, 'id'), aorKey: number(row.aorKey, 'AORKEY'), programme: requireString(row.programme, 'programme'),
    principalInvestigator: requireString(row.principalInvestigator, 'PI'), target: requireString(row.target, 'target'),
    targetRa: number(row.targetRa, 'target RA'), targetDec: number(row.targetDec, 'target Dec'), instrument: requireString(row.instrument, 'instrument'),
    mode: requireString(row.mode, 'mode'), observedFrom: requireString(row.observedFrom, 'start'), observedTo: requireString(row.observedTo, 'end'), channels };
}

export const programPath = (id: string) => resolve(PROGRAMS, `${id}.json`);
export const readSpitzerProgram = async (id: string): Promise<SpitzerProgram> => parseSpitzerProgram(JSON.parse(await readFile(programPath(id), 'utf8')) as unknown);
export async function writeSpitzerProgram(program: SpitzerProgram): Promise<void> {
  await mkdir(PROGRAMS, { recursive: true });
  await writeFile(programPath(program.id), `${JSON.stringify(program, null, 2)}\n`);
}
/** Where a program's pinned bytes live by default: outside the repository, because they are megabytes of archive data. */
export const defaultDataRoot = resolve(REPOSITORY, 'output/spitzer');

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), [id, key] = positionalArguments(args, ['--channels', '--data']);
  if (!id || !key) throw new TypeError('Usage: archive <program id> <aorkey> [--channels 1,2,3,4] [--data <dir>]');
  const channels = (flagValue(args, '--channels') ?? '1,2,3,4').split(',').map(entry => Number(entry.trim()));
  const program = await pinProgram(id, Number(key), channels, flagValue(args, '--data') ?? defaultDataRoot);
  await writeSpitzerProgram(program);
  const files = program.channels.reduce((total, channel) => total + channel.products.length + channel.frames.reduce((n, frame) => n + frame.files.length, 0), 0);
  console.log(`${program.id}: AOR ${program.aorKey}, ${program.target}, ${program.mode}, programme ${program.programme}; ${program.channels.length} channels, ${files} files pinned.`);
  for (const channel of program.channels)
    console.log(`  ch${channel.channel} ${channel.wavelength}: mosaic ${channel.mosaic.width} x ${channel.mosaic.height} from ${channel.frames.filter(frame => frame.frameTimeSeconds === channel.mosaicFrameTimeSeconds).length} of ${channel.frames.length} frames at FRAMTIME ${channel.mosaicFrameTimeSeconds} s`);
}
