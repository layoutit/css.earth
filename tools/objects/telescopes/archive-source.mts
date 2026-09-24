/** Shared byte and receipt boundary for an exact, still scientifically unresolved archive source. */
import { createHash } from 'node:crypto';
import { lstat, mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { get } from 'node:https';
import { basename, dirname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { sha256, sha256File } from '../../../src/platform/sha256.mts';
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { writeProductRecord, type ProductInput } from '../product-record.mts';
import { EXPLORATION_SCHEMA } from './exploration.mts';
import { FITS_SOURCE_SCHEMA } from './fits-source.mts';
import { parseLimits } from './vo/contracts.mts';

export interface SourceFile { readonly url: string; readonly name: string; readonly path?: string; readonly bytes?: number; readonly md5?: string; readonly archiveEncoding?: 'gzip' }
export interface SourceSelection {
  readonly archive: string; readonly telescope: string; readonly identity: string; readonly target: string;
  readonly discovery: unknown; readonly current: unknown; readonly limitations: readonly string[];
  readonly files: readonly SourceFile[]; readonly primaryFits?: string;
  readonly fitsCompanions?: { readonly uncertainty: string; readonly coverage: string };
  /** Optional content-qualified descriptor made from the already downloaded original bytes. */
  readonly describe?: (directory: string, files: readonly { readonly path: string; readonly bytes: number; readonly sha256: string }[]) => Promise<unknown>;
}
export interface SavedSource {
  readonly bytes: Buffer; readonly target: string; readonly maximum: number; readonly selected: Record<string, unknown>;
  readonly evidence: Buffer;
}

interface TransferEntry { readonly path: string; readonly url: string; readonly bytes: number; readonly sha256: string; readonly md5: string }
interface TransferProgress { readonly schema: 'cssearth-archive-transfer@1'; readonly selection: string; readonly files: readonly TransferEntry[] }
const progressFile = 'transfer-progress.json';
const progressBytes = (progress: TransferProgress) => `${JSON.stringify(progress, null, 2)}\n`;
async function saveProgress(staging: string, progress: TransferProgress) {
  const temporary = resolve(staging, `${progressFile}.tmp`);
  await rm(temporary, { force: true });
  await writeFile(temporary, progressBytes(progress), { flag: 'wx' });
  await rename(temporary, resolve(staging, progressFile));
}
async function checkedParent(staging: string, relative: string) {
  let path = staging;
  for (const part of relative.split('/').slice(0, -1)) {
    path = resolve(path, part);
    const stat = await lstat(path).catch(error => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    });
    if (stat && !stat.isDirectory()) throw new Error(`Partial transfer has a non-directory parent for ${relative}.`);
  }
}
async function checkedProgress(staging: string, selection: string, sources: readonly SourceFile[]): Promise<TransferProgress> {
  const progress = requireRecord(JSON.parse(await readFile(resolve(staging, progressFile), 'utf8')), 'saved transfer progress');
  if (progress.schema !== 'cssearth-archive-transfer@1' || progress.selection !== selection) throw new Error('Partial transfer belongs to another saved selection or changed archive metadata. Choose a new --out directory.');
  const files = requireArray(progress.files, 'completed transfer files').map(value => requireRecord(value, 'completed transfer file'));
  const expected = new Map(sources.map(file => [file.path ?? file.name, file]));
  const seen = new Set<string>(), checked: TransferEntry[] = [];
  for (const file of files) {
    const path = requireString(file.path, 'completed path'), source = expected.get(path), bytes = file.bytes;
    if (!source || seen.has(path) || file.url !== source.url || typeof bytes !== 'number' || !Number.isSafeInteger(bytes) || bytes < 1 ||
        typeof file.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(file.sha256) || typeof file.md5 !== 'string' || !/^[a-f0-9]{32}$/u.test(file.md5) ||
        source.bytes !== undefined && source.bytes !== bytes || source.md5 !== undefined && source.md5 !== file.md5)
      throw new Error('Partial transfer manifest does not match the selected archive files. Choose a new --out directory.');
    seen.add(path);
    await checkedParent(staging, path);
    const local = resolve(staging, path), stat = await lstat(local);
    if (!stat.isFile() || stat.size !== bytes || (await sha256File(local)).sha256 !== file.sha256)
      throw new Error(`Completed partial file ${path} changed. Choose a new --out directory.`);
    checked.push({ path, url: source.url, bytes, sha256: file.sha256, md5: file.md5 });
  }
  return { schema: 'cssearth-archive-transfer@1', selection, files: checked };
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
  fetcher: typeof fetch = fetch, resume = false) {
  if (selection.target !== saved.target) throw new TypeError('Archive source target differs from the saved exploration.');
  const destination = resolve(outputDirectory);
  try { await lstat(destination); throw new TypeError('Output directory already exists; choose a new --out directory.'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  await mkdir(dirname(destination), { recursive: true });
  const paths = new Set<string>();
  const reserved = new Set([progressFile, `${progressFile}.tmp`, 'descriptor.json', 'explore.json',
    'discovery.json', 'current-metadata.json', 'source.json', 'output.product.json']);
  for (const file of selection.files) {
    const path = file.path ?? file.name;
    if (!path.split('/').every(part => /^[A-Za-z0-9._-]+$/u.test(part) && part !== '.' && part !== '..') ||
        basename(path) !== file.name || paths.has(path) || reserved.has(path))
      throw new TypeError(`Invalid or repeated archive source path ${path}.`);
    paths.add(path);
  }
  const key = sha256(JSON.stringify({ exploration: sha256(saved.bytes), evidence: sha256(saved.evidence), maximum: saved.maximum,
    target: saved.target, archive: selection.archive, telescope: selection.telescope, identity: selection.identity,
    discovery: selection.discovery, current: selection.current, files: selection.files, primaryFits: selection.primaryFits,
    fitsCompanions: selection.fitsCompanions, limitations: selection.limitations }));
  const staging = `${destination}.partial`;
  let progress: TransferProgress;
  if (resume) {
    const stat = await lstat(staging).catch(error => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    });
    if (!stat?.isDirectory()) throw new Error(`No partial transfer at ${staging}. Run fetch without --resume or choose a new --out directory.`);
    progress = await checkedProgress(staging, key, selection.files);
  } else {
    await mkdir(staging).catch(error => {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error(`Partial transfer exists at ${staging}. Repeat with --resume or choose a new --out directory.`);
      throw error;
    });
    progress = { schema: 'cssearth-archive-transfer@1', selection: key, files: [] };
    try { await saveProgress(staging, progress); }
    catch (error) { await rm(staging, { recursive: true, force: true }); throw error; }
  }
  try {
    const files: TransferEntry[] = [];
    let remaining = saved.maximum;
    for (const file of selection.files) {
      const relative = file.path ?? file.name;
      const local = resolve(staging, relative);
      const prior = progress.files.find(entry => entry.path === relative);
      if (!prior) {
        await checkedParent(staging, relative);
        await mkdir(dirname(local), { recursive: true });
        await rm(local, { force: true }); // A failed attempt may have left an uncommitted file.
        const result = await downloadSource(file, local, remaining, fetcher);
        const entry = { path: relative, url: file.url, ...result };
        progress = { ...progress, files: [...progress.files, entry] };
        await saveProgress(staging, progress);
        files.push(entry); remaining -= result.bytes;
      } else {
        if (prior.bytes > remaining) throw new RangeError('Reused source exceeds the saved transfer bound.');
        files.push(prior); remaining -= prior.bytes;
      }
    }
    if (!files.length) throw new TypeError('Archive source has no retrievable files.');
    for (const name of ['descriptor.json', 'explore.json', 'discovery.json', 'current-metadata.json', 'source.json', 'output.product.json'])
      await rm(resolve(staging, name), { force: true });
    const metadata = Buffer.from(`${JSON.stringify(selection.current, null, 2)}\n`);
    const descriptor = selection.describe ? await selection.describe(staging, files) : undefined;
    if (descriptor !== undefined) await writeFile(resolve(staging, 'descriptor.json'), `${JSON.stringify(descriptor, null, 2)}\n`);
    const report = { schema: 'cssearth-archive-source@1', status: 'unresolved', archive: selection.archive,
      target: saved.target, identity: selection.identity, discovery: selection.discovery, files, limitations: selection.limitations };
    await writeFile(resolve(staging, 'explore.json'), saved.bytes);
    await writeFile(resolve(staging, 'discovery.json'), saved.evidence);
    await writeFile(resolve(staging, 'current-metadata.json'), metadata);
    await writeFile(resolve(staging, 'source.json'), `${JSON.stringify(report, null, 2)}\n`);
    const fits = selection.primaryFits ? files.find(file => file.path === selection.primaryFits) :
      files.length === 1 && /\.fits?(?:\.gz)?$/iu.test(files[0]!.path) ? files[0] : undefined;
    if (selection.primaryFits && (!fits || !/\.fits?(?:\.gz)?$/iu.test(fits.path))) throw new TypeError('Archive primary FITS was not pinned.');
    if (selection.fitsCompanions && (!fits || Object.values(selection.fitsCompanions).some(path =>
      !files.some(file => file.path === path && /\.fits?(?:\.gz)?$/iu.test(path)))))
      throw new TypeError('Archive FITS companion was not pinned.');
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
          label: fits.path, limitations: selection.limitations,
          ...(selection.fitsCompanions ? { companions: selection.fitsCompanions } : {}) } } : {}) },
      software: [{ name: 'cssEarth Telescope archive source', version: implementation }],
    }, [...files.map(file => ({ path: file.path, file: resolve(staging, file.path) })),
      ...(descriptor === undefined ? [] : [{ path: 'descriptor.json', file: resolve(staging, 'descriptor.json') }]),
      ...['explore.json', 'discovery.json', 'current-metadata.json', 'source.json'].map(path => ({ path, file: resolve(staging, path) }))]);
    await rm(resolve(staging, progressFile));
    await rename(staging, destination);
    return { files: files.map(file => resolve(destination, file.path)), receipt: resolve(destination, 'output.product.json'),
      source: resolve(destination, 'source.json'), ...(descriptor === undefined ? {} : { descriptor: resolve(destination, 'descriptor.json') }),
      status: 'unresolved' as const };
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)} Partial files remain at ${staging}; repeat the same fetch with --resume.`, { cause: error });
  }
}
