#!/usr/bin/env node
/** Gemini's raw archive, read through the Canadian Astronomy Data Centre.
 *
 * The Gemini Observatory Archive (archive.gemini.edu) answers every anonymous request with 403 and a body that asks for a
 * login, so none of its own services , /jsonsummary/, /jsonfilelist/, /file/, /download/, /calmgr/ , can be used here. CADC
 * mirrors the same raw files as CAOM-2 collection GEMINI and answers anonymously, so this module is the whole archive route.
 *
 * Two services, both public:
 *   - metadata: ADQL over TAP at `argus`. A query is POSTed and the 303's Location is fetched, which is how CADC returns a
 *     synchronous result of any size.
 *   - files: `raven`, CADC's global locator, which resolves an artifact URI and redirects to a signed URL for the bytes.
 *
 * CADC records each artifact's byte count and its own md5 (`contentChecksum`). Both are carried into a pin, and a download is
 * accepted only when the bytes, that md5, and our sha256 all agree. */
import { spawn } from 'node:child_process';
import { access, mkdir, rm, stat, symlink } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { request as httpsRequest } from 'node:https';
import type { IncomingHttpHeaders } from 'node:http';
import { resolve } from 'node:path';
import { sha256File } from '../../../src/platform/sha256.mts';
import { requireString } from '../../source-values.mts';

export const CADC_TAP = 'https://ws.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/argus/sync';
export const CADC_FILES = 'https://ws.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/raven/files';
/** Gemini's own files carry the `gemini:GEMINI/` scheme; `cadc:GEMINI*` is what CADC itself stores (previews, the legacy NIFS
 * reductions), and a pin never names one. A raw frame is `S20250906S0037.fits`; the archive's processed masters carry the
 * pipeline's prefix and suffix, `gS20250905S0128_bias.fits`. */
export const ARTIFACT_URI = /^gemini:GEMINI\/([a-z]{0,4}[NS]\d{8}S\d{4}(?:_[a-z0-9]+)?\.fits)$/u;
export const RAW_NAME = /^[NS]\d{8}S\d{4}\.fits$/u;
export const isRawName = (name: string) => RAW_NAME.test(name);
/** A TAP answer is a table of text; nothing here needs a larger one, and an unbounded read is how a query mistake exhausts
 * the machine. */
const MAX_TABLE_BYTES = 64 * 1024 * 1024;

export const artifactName = (uri: string) => {
  const match = ARTIFACT_URI.exec(uri);
  if (!match) throw new TypeError(`${uri} is not a Gemini artifact URI.`);
  return match[1]!;
};
export const downloadUrl = (uri: string) => `${CADC_FILES}/${uri}`;
const sizeOf = (path: string) => stat(path).then(info => info.size, () => -1);
export const exists = (path: string) => access(path).then(() => true, () => false);
const run = (command: string, args: readonly string[]) => new Promise<number>(done => { spawn(command, args, { stdio: 'ignore' }).on('close', code => done(code ?? 1)); });

/** One HTTPS request, through node:https rather than fetch. A CAOM query that joins Artifact runs for minutes before CADC
 * sends a byte, and fetch's own header timeout (undici's, five minutes, not settable without a dispatcher) fires first. */
function request(url: string, options: { method?: string; body?: string; headers?: Record<string, string> } = {}) {
  return new Promise<{ status: number; headers: IncomingHttpHeaders; text: string }>((done, fail) => {
    const target = new URL(url);
    const call = httpsRequest({ protocol: target.protocol, hostname: target.hostname, port: target.port, method: options.method ?? 'GET',
      path: `${target.pathname}${target.search}`, headers: options.headers ?? {}, timeout: 1_800_000 }, response => {
      let text = '', bytes = 0;
      response.setEncoding('utf8');
      response.on('data', chunk => {
        bytes += (chunk as string).length;
        if (bytes > MAX_TABLE_BYTES) { call.destroy(new Error(`CADC returned more than the ${MAX_TABLE_BYTES} bytes this reader holds.`)); return; }
        text += chunk as string;
      });
      response.on('end', () => done({ status: response.statusCode ?? 0, headers: response.headers, text }));
    });
    call.on('timeout', () => call.destroy(new Error(`CADC did not answer ${url} within 30 minutes.`)));
    call.on('error', fail);
    call.end(options.body);
  });
}

/** One ADQL query, as rows keyed by column name. CADC answers a POSTed sync query with 303 and the result's location; the
 * result is read as CSV, which is the only format every column of caom2 comes back in unambiguously. */
export async function query(adql: string): Promise<Record<string, string>[]> {
  const body = new URLSearchParams({ REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'csv', QUERY: adql }).toString();
  const started = await request(CADC_TAP, { method: 'POST', body,
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'content-length': String(Buffer.byteLength(body)) } });
  const location = typeof started.headers.location === 'string' ? started.headers.location : undefined;
  if (!location && started.status >= 300) throw new Error(`CADC refused the query: ${started.status} ${started.text.slice(0, 300)}`);
  const response = location ? await request(location) : started;
  if (response.status !== 200) throw new Error(`CADC refused the result: ${response.status} ${response.text.slice(0, 300)}`);
  return parseCsv(response.text);
}

/** RFC 4180 enough for CAOM: quoted fields, doubled quotes inside them, commas and newlines inside quotes. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false, started = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index]!;
    if (quoted) {
      if (character !== '"') field += character;
      else if (text[index + 1] === '"') { field += '"'; index++; }
      else quoted = false;
    } else if (character === '"' && !started) { quoted = true; started = true; }
    else if (character === ',') { row.push(field); field = ''; started = false; }
    else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index++;
      row.push(field); rows.push(row); row = []; field = ''; started = false;
    } else { field += character; started = true; }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift();
  if (!header) return [];
  return rows.filter(entry => entry.length === header.length).map(entry => Object.fromEntries(header.map((name, index) => [name, entry[index] ?? ''])));
}

export interface GeminiFile {
  readonly name: string;
  /** The CAOM artifact URI, which is what `raven` resolves. */
  readonly uri: string;
  readonly bytes: number;
  /** CADC's own digest of the artifact, as CAOM stores it (the `md5:` prefix removed). */
  readonly md5: string;
  readonly sha256?: string;
}

const md5File = async (path: string) => {
  const hash = createHash('md5');
  for await (const chunk of createReadStream(path, { highWaterMark: 8 << 20 })) hash.update(chunk as Buffer);
  return hash.digest('hex');
};

/** The pinned file in `directory`, linked from a directory that already holds it or downloaded through `raven`. A slow
 * transfer is abandoned and resumed on a fresh connection. The bytes, the archive's md5 and, when pinned, our sha256 must all
 * agree before the path is returned; nothing partial is ever handed on. */
export async function geminiFile(file: GeminiFile, directory: string, sources: readonly string[] = []): Promise<string> {
  if (!/^[A-Za-z0-9._-]+$/u.test(file.name)) throw new TypeError(`Invalid Gemini file name: ${file.name}`);
  await mkdir(directory, { recursive: true });
  const target = resolve(directory, file.name);
  if (await sizeOf(target) !== file.bytes) for (const source of sources) {
    const candidate = resolve(source, file.name);
    if (await sizeOf(candidate) === file.bytes) { await rm(target, { force: true }); await symlink(candidate, target); break; }
  }
  for (let attempt = 1; attempt <= 10 && await sizeOf(target) !== file.bytes; attempt++) {
    if (await sizeOf(target) > file.bytes) await rm(target);
    await run('curl', ['-s', '-L', '-C', '-', '--speed-limit', '200000', '--speed-time', '60', '-o', target, downloadUrl(file.uri)]);
  }
  if (await sizeOf(target) !== file.bytes) throw new Error(`${file.name} did not download to its pinned ${file.bytes} bytes.`);
  const md5 = await md5File(target);
  if (md5 !== file.md5) throw new Error(`${file.name} has md5 ${md5}, not the archive's pinned ${file.md5}.`);
  if (file.sha256 !== undefined && (await sha256File(target)).sha256 !== file.sha256) throw new Error(`${file.name} differs from its pinned sha256.`);
  return target;
}

/** The first bytes of an archive file, over a range request: a FITS header is a few records where the file is megabytes. */
export async function primaryHeaderBytes(uri: string, records = 64): Promise<Buffer> {
  const response = await fetch(downloadUrl(uri), { headers: { Range: `bytes=0-${records * 2880 - 1}` }, signal: AbortSignal.timeout(300_000) });
  if (!response.ok) throw new Error(`CADC refused ${uri}: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

export const requireMd5 = (value: unknown, label: string) => {
  const text = requireString(value, label).replace(/^md5:/u, '');
  if (!/^[0-9a-f]{32}$/u.test(text)) throw new TypeError(`${label} is not an md5.`);
  return text;
};
