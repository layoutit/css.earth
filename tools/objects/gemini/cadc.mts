#!/usr/bin/env node
/** Gemini's raw archive, read through the Canadian Astronomy Data Centre.
 *
 * The Gemini Observatory Archive (archive.gemini.edu) answers every anonymous request with 403 and a body that asks for a
 * login, so none of its own services , /jsonsummary/, /jsonfilelist/, /file/, /download/, /calmgr/ , can be used here. CADC
 * mirrors the same raw files as CAOM-2 collection GEMINI and answers anonymously, so this module is the whole archive route.
 *
 * Two services, both public:
 *   - metadata: ADQL over TAP at `argus`, with the transaction and VOTable owned by PyVO.
 *   - files: `raven`, CADC's global locator, which resolves an artifact URI and redirects to a signed URL for the bytes.
 *
 * CADC records each artifact's byte count and its own md5 (`contentChecksum`). Both are carried into a pin, and a download is
 * accepted only when the bytes, that md5, and our sha256 all agree. */
import { spawn } from 'node:child_process';
import { access, mkdir, rm, stat, symlink } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { sha256File } from '../../../src/platform/sha256.mts';
import { requireString } from '@cssearth/core';
import { tapRows } from '../astronomy-packages/client.mts';

export const CADC_TAP = 'https://ws.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/argus';
export const CADC_FILES = 'https://ws.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/raven/files';
/** Gemini's own files carry the `gemini:GEMINI/` scheme; `cadc:GEMINI*` is what CADC itself stores (previews, the legacy NIFS
 * reductions), and a pin never names one. A raw frame is `S20250906S0037.fits`; the archive's processed masters carry the
 * pipeline's prefix and suffix, `gS20250905S0128_bias.fits`. */
export const ARTIFACT_URI = /^gemini:GEMINI\/([a-z]{0,4}[NS]\d{8}S\d{4}(?:_[a-z0-9]+)?\.fits)$/u;
export const RAW_NAME = /^[NS]\d{8}S\d{4}\.fits$/u;
export const isRawName = (name: string) => RAW_NAME.test(name);
export const artifactName = (uri: string) => {
  const match = ARTIFACT_URI.exec(uri);
  if (!match) throw new TypeError(`${uri} is not a Gemini artifact URI.`);
  return match[1]!;
};
export const downloadUrl = (uri: string) => `${CADC_FILES}/${uri}`;
const sizeOf = (path: string) => stat(path).then(info => info.size, () => -1);
export const exists = (path: string) => access(path).then(() => true, () => false);
const run = (command: string, args: readonly string[]) => new Promise<number>(done => { spawn(command, args, { stdio: 'ignore' }).on('close', code => done(code ?? 1)); });

/** One ADQL query. PyVO owns the TAP transaction, redirect handling and VOTable parsing. */
export async function query(adql: string): Promise<Record<string, string>[]> {
  return tapRows(CADC_TAP, adql);
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
