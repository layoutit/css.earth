/** Shared byte and receipt boundary for an exact, still scientifically unresolved archive source. */
import { createHash } from 'node:crypto';
import { lstat, mkdir, mkdtemp, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { get } from 'node:https';
import { basename, dirname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { sha256, sha256File } from '../../../src/platform/sha256.mts';
import { requireArray, requireRecord, requireString } from '../../sources/source-values.mts';
import { writeProductRecord, type ProductInput } from '../product-record.mts';
import { EXPLORATION_SCHEMA } from './exploration.mts';
import { FITS_SOURCE_SCHEMA } from './fits-source.mts';
import { parseLimits } from './vo/contracts.mts';

export interface SourceFile { readonly url: string; readonly name: string; readonly path?: string; readonly bytes?: number; readonly md5?: string; readonly archiveEncoding?: 'gzip' }
export interface SourceSelection {
  readonly archive: string; readonly telescope: string; readonly identity: string; readonly target: string;
  readonly discovery: unknown; readonly current: unknown; readonly limitations: readonly string[];
  readonly files: readonly SourceFile[]; readonly primaryFits?: string;
}
export interface SavedSource {
  readonly bytes: Buffer; readonly target: string; readonly maximum: number; readonly selected: Record<string, unknown>;
  readonly evidence: Buffer;
}

export async function readSavedSource(explorationPath: string, serviceName: string, pick: number): Promise<SavedSource> {
  if (!Number.isSafeInteger(pick) || pick < 1) throw new TypeError('--pick must be a positive source number.');
  const bytes = await readFile(explorationPath), session = requireRecord(JSON.parse(bytes.toString('utf8')), 'saved exploration');
  if (session.schema !== EXPLORATION_SCHEMA) throw new TypeError('Expected a saved Telescope exploration.');
  const answer = requireRecord(session.answer, 'saved exploration answer'), request = requireRecord(answer.request, 'saved request');
  const target = requireString(session.target, 'saved target');
  if (target !== answer.target || request.target !== target) throw new TypeError('Saved exploration target identity disagrees.');
  const matches = requireArray(answer.services, 'saved services').map(value => requireRecord(value, 'saved service')).filter(value => value.service === serviceName);
  if (matches.length !== 1) throw new TypeError(`Saved exploration has no unique ${serviceName} service.`);
  const sources = requireArray(matches[0]!.sources, 'saved source choices');
  if (pick > sources.length) throw new TypeError(`--pick must be between 1 and ${sources.length}.`);
  const selected = requireRecord(sources[pick - 1], 'saved source'), pin = requireString(selected.evidence, 'source evidence');
  if (!/^[a-f0-9]{64}$/u.test(pin)) throw new TypeError('Saved source has no valid discovery pin.');
  const evidence = await readFile(resolve(dirname(explorationPath), 'archive-source-evidence', `${pin}.json`));
  if (sha256(evidence) !== pin) throw new Error('The saved archive source differs from its pinned discovery response. Explore again.');
  return { bytes, target, selected, evidence, maximum: parseLimits(request.transferLimits).scienceBytes };
}

/** Node's HTTPS stream preserves archive Content-Encoding bytes that fetch would decode. */
export async function rawHttpsFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const source = new URL(input instanceof Request ? input.url : String(input));
  const read = (url: URL, redirects: number): Promise<Response> => {
    if (url.protocol !== 'https:' || url.username || url.password || redirects > 5) throw new TypeError('Archive raw transfer requires a bounded HTTPS URL.');
    return new Promise((accept, reject) => {
      const request = get(url, { headers: init?.headers as Record<string, string> | undefined, signal: init?.signal ?? undefined }, response => {
        if ([301, 302, 303, 307, 308].includes(response.statusCode ?? 0) && response.headers.location) {
          response.resume(); read(new URL(response.headers.location, url), redirects + 1).then(accept, reject); return;
        }
        const headers = new Headers();
        for (const [name, value] of Object.entries(response.headers)) if (value !== undefined)
          headers.set(name, Array.isArray(value) ? value.join(', ') : value);
        const status = response.statusCode ?? 500;
        accept(new Response([204, 205, 304].includes(status) ? null : Readable.toWeb(response) as ReadableStream<Uint8Array>, { status, headers }));
      });
      request.on('error', reject);
    });
  };
  return read(source, 0);
}

/** Stream the exact response while hashing it; a declared size never substitutes for a transfer cap. */
export async function downloadSource(file: SourceFile, path: string, maximum: number, fetcher: typeof fetch = fetch) {
  if (!/^[A-Za-z0-9._-]+$/u.test(file.name) || basename(path) !== file.name || !Number.isSafeInteger(maximum) || maximum < 1)
    throw new TypeError('Invalid archive file or transfer bound.');
  if (file.bytes !== undefined && (!Number.isSafeInteger(file.bytes) || file.bytes < 1 || file.bytes > maximum)) throw new RangeError(`${file.name} exceeds the transfer bound.`);
  const response = await fetcher(file.url, { signal: AbortSignal.timeout(180_000), headers: { 'accept-encoding': 'identity' } });
  if (!response.ok || !response.body) {
    await response.body?.cancel(); throw new Error(`Archive source ${file.url} returned HTTP ${response.status}.`);
  }
  const encoding = response.headers.get('content-encoding');
  if (/text\/html|application\/json/iu.test(response.headers.get('content-type') ?? '') ||
      encoding && (file.archiveEncoding !== 'gzip' || !/^(?:x-)?gzip$/iu.test(encoding))) {
    await response.body.cancel(); throw new TypeError(`Archive source ${file.url} did not provide original file bytes.`);
  }
  const declared = Number(response.headers.get('content-length'));
  if (declared > maximum) { await response.body.cancel(); throw new RangeError(`${file.name} exceeds the transfer bound.`); }
  const reader = response.body.getReader(), sha = createHash('sha256'), md5 = createHash('md5');
  const handle = await open(path, 'wx'); let bytes = 0;
  try {
    for (;;) {
      const chunk = await reader.read(); if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maximum) { await reader.cancel(); throw new RangeError(`${file.name} exceeds the transfer bound.`); }
      await handle.writeFile(chunk.value); sha.update(chunk.value); md5.update(chunk.value);
    }
  } catch (error) { await handle.close(); await rm(path, { force: true }); throw error; }
  await handle.close();
  const digest = sha.digest('hex'), archiveMd5 = md5.digest('hex');
  if (file.bytes !== undefined && bytes !== file.bytes || file.md5 !== undefined && archiveMd5 !== file.md5) {
    await rm(path, { force: true }); throw new Error(`${file.name} differs from the archive's size or MD5.`);
  }
  if (/\.fits?$/iu.test(file.name) || /\.fits?\.gz$/iu.test(file.name)) {
    const handle = await open(path, 'r'); const prefix = Buffer.alloc(9);
    try { await handle.read(prefix, 0, prefix.length, 0); } finally { await handle.close(); }
    const valid = /\.gz$/iu.test(file.name) ? prefix[0] === 0x1f && prefix[1] === 0x8b : prefix.toString('ascii') === 'SIMPLE  =';
    if (!valid) { await rm(path, { force: true }); throw new TypeError(`${file.name} has no FITS signature.`); }
  }
  return { bytes, sha256: digest, md5: archiveMd5 };
}

export async function deliverSource(explorationPath: string, outputDirectory: string, saved: SavedSource, selection: SourceSelection,
  fetcher: typeof fetch = fetch) {
  if (selection.target !== saved.target) throw new TypeError('Archive source target differs from the saved exploration.');
  const destination = resolve(outputDirectory);
  try { await lstat(destination); throw new TypeError('Output directory already exists; choose a new --out directory.'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  await mkdir(dirname(destination), { recursive: true });
  const staging = await mkdtemp(resolve(dirname(destination), '.archive-source-'));
  try {
    const files: { path: string; url: string; bytes: number; sha256: string; md5: string }[] = [];
    let remaining = saved.maximum;
    for (const file of selection.files) {
      const relative = file.path ?? file.name;
      if (!relative.split('/').every(part => /^[A-Za-z0-9._-]+$/u.test(part) && part !== '.' && part !== '..') ||
          basename(relative) !== file.name) throw new TypeError(`Invalid archive source path ${relative}.`);
      if (files.some(entry => entry.path === relative)) throw new Error(`Archive source repeats ${relative}.`);
      const destination = resolve(staging, relative);
      await mkdir(dirname(destination), { recursive: true });
      const result = await downloadSource(file, destination, remaining, fetcher);
      files.push({ path: relative, url: file.url, ...result }); remaining -= result.bytes;
    }
    if (!files.length) throw new TypeError('Archive source has no retrievable files.');
    const metadata = Buffer.from(`${JSON.stringify(selection.current, null, 2)}\n`);
    const report = { schema: 'cssearth-archive-source@1', status: 'unresolved', archive: selection.archive,
      target: saved.target, identity: selection.identity, discovery: selection.discovery, files, limitations: selection.limitations };
    await writeFile(resolve(staging, 'explore.json'), saved.bytes);
    await writeFile(resolve(staging, 'discovery.json'), saved.evidence);
    await writeFile(resolve(staging, 'current-metadata.json'), metadata);
    await writeFile(resolve(staging, 'source.json'), `${JSON.stringify(report, null, 2)}\n`);
    const fits = selection.primaryFits ? files.find(file => file.path === selection.primaryFits) :
      files.length === 1 && /\.fits?(?:\.gz)?$/iu.test(files[0]!.path) ? files[0] : undefined;
    if (selection.primaryFits && (!fits || !/\.fits?(?:\.gz)?$/iu.test(fits.path))) throw new TypeError('Archive primary FITS was not pinned.');
    const inputs: ProductInput[] = [
      { role: 'saved exploration', identity: resolve(explorationPath), bytes: saved.bytes.length, sha256: sha256(saved.bytes) },
      { role: 'archive discovery response', identity: `${selection.archive}#discovery`, bytes: saved.evidence.length, sha256: sha256(saved.evidence) },
      { role: 'current exact-source metadata', identity: `${selection.archive}#current`, bytes: metadata.length, sha256: sha256(metadata) },
      ...files.map(file => ({ role: 'original archive source', identity: file.url, bytes: file.bytes, sha256: file.sha256 })),
    ];
    const implementation = (await sha256File(import.meta.filename)).sha256;
    await writeProductRecord(resolve(staging, 'output.product.json'), {
      telescope: selection.telescope, stage: 'telescope-archive-source', inputs,
      parameters: { target: saved.target, archive: selection.archive, identity: selection.identity, status: 'unresolved',
        limitations: selection.limitations, ...(fits ? { fitsSource: { schema: FITS_SOURCE_SCHEMA, path: fits.path,
          label: fits.path, limitations: selection.limitations } } : {}) },
      software: [{ name: 'cssEarth Telescope archive source', version: implementation }],
    }, [...files.map(file => ({ path: file.path, file: resolve(staging, file.path) })),
      ...['explore.json', 'discovery.json', 'current-metadata.json', 'source.json'].map(path => ({ path, file: resolve(staging, path) }))]);
    await rename(staging, destination);
    return { files: files.map(file => resolve(destination, file.path)), receipt: resolve(destination, 'output.product.json'),
      source: resolve(destination, 'source.json'), status: 'unresolved' as const };
  } finally { await rm(staging, { recursive: true, force: true }); }
}
