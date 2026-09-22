#!/usr/bin/env node
/** The Keck Observatory Archive's public interfaces, as a program's pins are read and fetched through them.
 *
 * KOA (https://koa.ipac.caltech.edu, run for W. M. Keck Observatory by NExScI at IPAC) serves public data without an account.
 * Three endpoints are used, all anonymous:
 *
 *   TAP/sync                        ADQL over one table per instrument (koa_nirc2, koa_osiris, koa_nirspec, koa_hires,
 *                                   koa_deimos, koa_lris, koa_mosfire, koa_kcwi, koa_esi, koa_nires, koa_lws, koa_nirc,
 *                                   koa_kpf, koa_guider) and koa_reduced_data. An anonymous query is rewritten by the service
 *                                   to hold only rows whose proprietary period has run out, which is the archive's own
 *                                   statement of what is public: `current_date > add_months(date_obs, propint)`.
 *   KoaAPI/nph-getCaliblist         the calibration frames the archive associates with one science frame.
 *   KoaAPI/nph-getL1list            the archive's own reduced products for one science frame, where it made any.
 *
 * and two downloads: getKOA/nph-getKOA?filehand= for a raw (level 0) file and KoaAPI/nph-dnloadL1data for a level 1 one.
 * Neither needs a cookie of ours; the service issues an anonymous one itself. */
import { createWriteStream } from 'node:fs';
import { mkdir, rename, stat } from 'node:fs/promises';
import type { IncomingMessage } from 'node:http';
import { request } from 'node:https';
import { dirname, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { sha256File } from '../../../src/platform/sha256.mts';
import { requireArray, requireRecord, requireString } from '../../sources/source-values.mts';
import { tapRows } from '../astronomy-packages/client.mts';

export const KOA = 'https://koa.ipac.caltech.edu';
export const TAP_SYNC = `${KOA}/TAP`;
/** One table for each instrument KOA serves, as TAP_SCHEMA.tables lists them. */
export const INSTRUMENT_TABLES = ['koa_deimos', 'koa_esi', 'koa_guider', 'koa_hires', 'koa_kcwi', 'koa_kpf', 'koa_lris',
  'koa_lws', 'koa_mosfire', 'koa_nirc', 'koa_nirc2', 'koa_nires', 'koa_nirspec', 'koa_osiris'] as const;
export type InstrumentTable = (typeof INSTRUMENT_TABLES)[number];
export const instrumentTable = (instrument: string): InstrumentTable => {
  const table = `koa_${instrument.toLowerCase()}`;
  if (!(INSTRUMENT_TABLES as readonly string[]).includes(table)) throw new TypeError(`KOA serves no instrument ${instrument}.`);
  return table as InstrumentTable;
};

export const lev0Url = (filehand: string) => `${KOA}/cgi-bin/getKOA/nph-getKOA?filehand=${filehand}`;
export const lev1Url = (instrument: string, koaid: string, filehand: string) =>
  `${KOA}/cgi-bin/KoaAPI/nph-dnloadL1data?instrument=${instrument.toLowerCase()}&koaid=${koaid}&filehand=${filehand}`;

const TIMEOUT = 900_000;

/** One request to KOA, through node's HTTP client rather than fetch. The archive's CGI programs end some header lines with a
 * bare newline instead of CRLF, which undici (and so `fetch`) refuses outright with "Missing expected CR after header value";
 * `insecureHTTPParser` accepts the line and is the only way to read these endpoints from Node. It relaxes nothing else: the
 * request is still HTTPS to koa.ipac.caltech.edu, and every response is checked below before it is used. */
function koaRequest(url: string, body?: string): Promise<IncomingMessage> {
  const target = new URL(url);
  if (target.origin !== KOA) throw new Error(`${url} is not a KOA URL.`);
  return new Promise((ok, fail) => {
    const call = request(target, { method: body === undefined ? 'GET' : 'POST', insecureHTTPParser: true, timeout: TIMEOUT,
      ...(body === undefined ? {} : { headers: { 'content-type': 'application/x-www-form-urlencoded', 'content-length': Buffer.byteLength(body) } }) },
      response => ok(response));
    call.on('error', fail);
    call.on('timeout', () => call.destroy(new Error(`KOA did not answer ${target.pathname} within ${TIMEOUT} ms.`)));
    call.end(body);
  });
}

/** KOA closes a connection part-way often enough that a night of frames rarely comes down in one pass, so a reset is retried
 * rather than treated as a refusal. Only a dropped connection is retried; a refusal by the service is raised at once. */
export async function koaRetry<T>(work: () => Promise<T>, attempts = 6): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try { return await work(); }
    catch (error) {
      const code = (error as { code?: string } | null)?.code ?? '', message = error instanceof Error ? error.message : '';
      if (attempt >= attempts || !/ECONNRESET|ETIMEDOUT|EPIPE|ECONNABORTED|socket hang up|aborted|premature close/u.test(`${code} ${message}`)) throw error;
      await new Promise(ok => setTimeout(ok, attempt * 3000));
    }
  }
}

async function koaText(url: string, body?: string): Promise<{ status: number; type: string; text: string }> {
  return koaRetry(async () => {
    const response = await koaRequest(url, body);
    const chunks: Buffer[] = [];
    for await (const chunk of response) chunks.push(chunk as Buffer);
    return { status: response.statusCode ?? 0, type: response.headers['content-type'] ?? '', text: Buffer.concat(chunks).toString('utf8') };
  });
}

/** One ADQL query. PyVO owns the TAP request and VOTable parsing; KOA's CGI endpoints below remain archive-specific. */
export async function koaQuery(adql: string): Promise<Record<string, string>[]> {
  return tapRows(TAP_SYNC, adql);
}

/** The calibration frames the archive associates with a science frame, as KOA itself groups them. Returned as the archive
 * states them, so a program records the archive's association rather than a grouping of ours. */
export async function koaCalibrations(instrument: string, koaid: string): Promise<Record<string, string>[]> {
  const url = `${KOA}/cgi-bin/KoaAPI/nph-getCaliblist?instrument=${instrument.toLowerCase()}&koaid=${koaid}`;
  const { status, text } = await koaText(url);
  if (status !== 200) throw new Error(`KOA refused the calibration list for ${koaid}: ${status}`);
  const value = requireRecord(JSON.parse(text) as unknown, 'KOA calibration list');
  if (value.status !== 'ok') throw new Error(`KOA has no calibration list for ${koaid}: ${String(value.msg ?? value.status)}`);
  return requireArray(value.table, 'Calibration table').map(entry => {
    const row = requireRecord(entry, 'Calibration frame');
    return Object.fromEntries(Object.entries(row).map(([key, cell]) => [key, requireString(cell, key)]));
  });
}

export interface KoaProduct { readonly filehand: string; readonly level: string; readonly description: string }

/** The archive's own reduced products for a science frame, where KOA made any. KOA states them in two places and neither
 * covers both sets of instruments, so both are asked:
 *
 *   koa_reduced_data, a TAP table, holds the KCWI and DEIMOS products the archive's own pipeline runs wrote;
 *   KoaAPI/nph-getL1list holds the NIRC2, OSIRIS, LWS, HIRES and NIRSPEC ones. For an instrument it does not serve, and KCWI
 *     is one, the endpoint closes the connection without a reply, which is read here as "no list", not as a failure.
 *
 * An instrument with no reduced products at all returns an empty list, and a program then pins the raw frames alone. */
export async function koaProducts(instrument: string, koaid: string, filehand: string): Promise<KoaProduct[]> {
  const catalogued = await koaQuery(`SELECT filehand,ingesttype,description FROM koa_reduced_data WHERE koaid='${koaid}' AND filetype='FITS'`);
  if (catalogued.length) return catalogued.map(row => ({ filehand: row.filehand ?? '', level: row.ingesttype ?? '', description: row.description ?? '' }))
    .filter(product => product.filehand).sort((a, b) => a.filehand.localeCompare(b.filehand, 'en'));
  const url = `${KOA}/cgi-bin/KoaAPI/nph-getL1list?instrument=${instrument.toLowerCase()}&koaid=${koaid}&filehand=${filehand}`;
  const listed = await koaText(url).catch(() => null);
  if (!listed || listed.status !== 200) return [];
  const value = requireRecord(JSON.parse(listed.text) as unknown, 'KOA level 1 list');
  if (value.status === 'error') return [];
  const result = requireRecord(value.result, 'Level 1 result');
  const prefix = requireString(result.lev1subdir_prefix, 'Level 1 directory');
  // The endpoint states its files in two shapes. NIRSPEC groups them: `data` is a list of `{subdir, lev1files}`, and one
  // observation's 72 files are spread over `ascii/flux`, `fits/order`, `fitstbl` and the rest, so the subdirectory is part of
  // the path. Other instruments state a flat `lev1file` list. Both end as one archive path per file.
  const products: KoaProduct[] = [];
  const add = (name: string, subdir = '') => products.push({ filehand: name.startsWith('/') ? name : `${prefix}${subdir ? `/${subdir}` : ''}/${name}`, level: 'lev1', description: subdir });
  for (const entry of Array.isArray(result.lev1file) ? result.lev1file : []) add(requireString(entry, 'Level 1 file'));
  for (const entry of Array.isArray(result.data) ? result.data : []) {
    if (typeof entry === 'string') { add(entry); continue; }
    const group = requireRecord(entry, 'Level 1 group');
    if (typeof group.filehand === 'string') { add(group.filehand); continue; }
    const subdir = requireString(group.subdir, 'Level 1 subdirectory');
    for (const name of requireArray(group.lev1files, 'Level 1 files')) add(requireString(name, 'Level 1 file'), subdir);
  }
  return products;
}

/** Fetch one archive file to `path` unless it is already there with the pinned size, streaming so a cube is never held whole.
 * KOA answers an unknown path with an HTML message and a 200, so the body is refused unless the service says it is a file. */
export async function koaDownload(url: string, path: string, bytes?: number): Promise<{ sha256: string; bytes: number }> {
  const already = await stat(path).then(entry => entry.size, () => -1);
  if (already > 0 && (bytes === undefined || already === bytes)) return sha256File(path);
  // A partial body is left in the `.part` file and overwritten on the next attempt, never renamed into place.
  return koaRetry(() => fetchOnce(url, path, bytes));
}

async function fetchOnce(url: string, path: string, bytes?: number): Promise<{ sha256: string; bytes: number }> {
  await mkdir(dirname(path), { recursive: true });
  const response = await koaRequest(url);
  if (response.statusCode !== 200) throw new Error(`KOA refused ${url}: ${response.statusCode}`);
  // An unknown path is answered with an HTML message and a 200, so the type decides whether this is a file at all.
  if (/html|json/u.test(response.headers['content-type'] ?? '')) {
    const chunks: Buffer[] = [];
    for await (const chunk of response) chunks.push(chunk as Buffer);
    throw new Error(`KOA returned a message, not a file, for ${url}: ${Buffer.concat(chunks).toString('utf8').slice(0, 200)}`);
  }
  const partial = `${path}.part`;
  await pipeline(response, createWriteStream(partial));
  await rename(partial, path);
  const digest = await sha256File(path);
  if (bytes !== undefined && digest.bytes !== bytes) throw new Error(`${path} is ${digest.bytes} bytes, not the pinned ${bytes}.`);
  return digest;
}

export const koaCacheDir = (root: string, ...parts: readonly string[]) => resolve(root, ...parts);
