/**
 * A pin identifies bytes git does not hold. Files authored in this repository (documents, local inputs,
 * generated intermediates, tool-written inputs) carry none: git records them, so there is nothing to refresh.
 * Downloaded inputs stay verified against their upstream bytes and are never repinned. `--adopt-downloads`
 * gives a new download its first pin, only while its pin is still the all-zero placeholder.
 * `--check` reports without writing.
 */
import { sha256 } from '../../src/platform/sha256.mts';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hasErrorCode, isRecord, requireArray, requireRecord, requireString } from './source-values.mts';

export interface DocumentPinChange { file: 'source/manifest.json'; path: string; expectedBytes: number; expectedSha256: string; previousSha256: string }

const optionalBytes = (path: string) => readFile(path).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });

/** Paths an acquisition plan restores; those are downloads, not authored files. */
async function acquiredPaths(objectDirectory: string) {
  const plan = await readFile(resolve(objectDirectory, 'source/preparation/acquisition.json'), 'utf8')
    .then(text => requireRecord(JSON.parse(text), 'acquisition plan'))
    .catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });
  return new Set(requireArray(plan?.operations ?? [], 'acquisition operations')
    .flatMap(operation => isRecord(operation) && typeof operation.path === 'string' ? [operation.path] : []));
}

/** Give each new download present on disk its first pin; returns what changed. */
export async function pinObjectDocuments(objectDirectory: string, { write = true, adoptDownloads = false } = {}): Promise<DocumentPinChange[]> {
  if (!adoptDownloads) return [];
  const manifestPath = resolve(objectDirectory, 'source/manifest.json');
  const manifest = requireRecord(JSON.parse(await readFile(manifestPath, 'utf8')), 'source manifest');
  const acquired = await acquiredPaths(objectDirectory), changes: DocumentPinChange[] = [], placeholder = '0'.repeat(64);
  for (const entry of requireArray(manifest.inputs ?? [], 'manifest inputs').map(value => requireRecord(value, 'manifest input'))) {
    const path = requireString(entry.path, 'input path');
    if (!acquired.has(path) || entry.expectedSha256 !== placeholder) continue;
    const bytes = await optionalBytes(resolve(objectDirectory, 'source', path));
    if (!bytes) continue;
    const actual = { expectedBytes: bytes.length, expectedSha256: sha256(bytes) };
    changes.push({ file: 'source/manifest.json', path, ...actual, previousSha256: placeholder });
    Object.assign(entry, actual);
  }
  if (write && changes.length) await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  return changes;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const arguments_ = process.argv.slice(2), check = arguments_.includes('--check'), adoptDownloads = arguments_.includes('--adopt-downloads');
  const ids = arguments_.filter(argument => !argument.startsWith('--'));
  if (ids.length !== 1 || !/^[a-z][a-z0-9-]*$/u.test(ids[0])) throw new TypeError('Usage: pin-object-documents <object-id> --adopt-downloads [--check]');
  const changes = await pinObjectDocuments(resolve('src/objects', ids[0]), { write: !check, adoptDownloads });
  for (const change of changes) console.log(`${check ? 'unpinned' : 'pinned'} ${change.path} -> ${change.expectedSha256.slice(0, 8)} (${change.expectedBytes} bytes)`);
  if (!changes.length) console.log(`${ids[0]}: nothing to pin.`);
  if (check && changes.length) process.exitCode = 1;
}
