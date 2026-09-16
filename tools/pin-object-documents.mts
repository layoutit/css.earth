/**
 * Refresh the byte and SHA-256 pins that bind an object's authored files: the
 * source manifest's `documents`, its `local` inputs that no acquisition step
 * downloads, the navigation marker's copy of its source record, and the
 * descriptor's `recipe.sources`. Catalogued and downloaded
 * inputs are never repinned; they stay verified against their upstream bytes.
 * Preparation in write mode runs this first. `--check` reports stale pins without writing.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hasErrorCode, isRecord, requireArray, requireRecord, requireString } from './source-values.mts';

export interface DocumentPinChange { file: 'source/manifest.json' | 'source/preparation/navigation.json' | 'object.json'; path: string; expectedBytes: number; expectedSha256: string; previousSha256: string }

const identityOf = (bytes: Uint8Array) => ({ expectedBytes: bytes.length, expectedSha256: createHash('sha256').update(bytes).digest('hex') });
const optionalBytes = (path: string) => readFile(path).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });
// The navigation marker repeats its source's manifest record; the manifest owns these facts.
const MARKER_SOURCE_FIELDS = ['expectedBytes', 'expectedSha256', 'origin', 'credit', 'license', 'acquisition', 'redistribution'] as const;

/** Paths an acquisition plan restores; those are downloads, not authored files. */
async function acquiredPaths(objectDirectory: string) {
  const plan = await readFile(resolve(objectDirectory, 'source/preparation/acquisition.json'), 'utf8')
    .then(text => requireRecord(JSON.parse(text), 'acquisition plan'))
    .catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });
  return new Set(requireArray(plan?.operations ?? [], 'acquisition operations')
    .flatMap(operation => isRecord(operation) && typeof operation.path === 'string' ? [operation.path] : []));
}

/** Recompute the authored pin sets for one object directory; returns what changed. */
export async function pinObjectDocuments(objectDirectory: string, { write = true } = {}): Promise<DocumentPinChange[]> {
  const manifestPath = resolve(objectDirectory, 'source/manifest.json'), descriptorPath = resolve(objectDirectory, 'object.json');
  const navigationPath = resolve(objectDirectory, 'source/preparation/navigation.json');
  const manifest = requireRecord(JSON.parse(await readFile(manifestPath, 'utf8')), 'source manifest');
  const descriptor = requireRecord(JSON.parse(await readFile(descriptorPath, 'utf8')), 'object descriptor');
  const acquired = await acquiredPaths(objectDirectory), changes: DocumentPinChange[] = [];
  // Bytes this run would write; check mode hashes them without touching disk.
  const pending = new Map<string, Uint8Array>();
  const repin = async (entry: Record<string, unknown>, file: DocumentPinChange['file'], path: string, at: string) => {
    const bytes = pending.get(at) ?? await optionalBytes(at);
    if (!bytes) return;
    const actual = identityOf(bytes);
    if (entry.expectedBytes === actual.expectedBytes && entry.expectedSha256 === actual.expectedSha256) return;
    changes.push({ file, path, ...actual, previousSha256: String(entry.expectedSha256) });
    Object.assign(entry, actual);
  };
  const entries = (key: string) => requireArray(manifest[key] ?? [], `manifest ${key}`).map(value => requireRecord(value, `manifest ${key} entry`));
  for (const entry of entries('inputs')) {
    const path = requireString(entry.path, 'input path');
    if (isRecord(entry.sourceBinding) && entry.sourceBinding.kind === 'local' && !acquired.has(path)) await repin(entry, 'source/manifest.json', path, resolve(objectDirectory, 'source', path));
  }
  const navigationText = await optionalBytes(navigationPath);
  if (navigationText) {
    const navigation = requireRecord(JSON.parse(navigationText.toString('utf8')), 'navigation marker');
    const marker = isRecord(navigation.source) ? navigation.source : null;
    const record = marker && [...entries('inputs'), ...entries('documents'), ...entries('generatedIntermediates')].find(entry => entry.path === marker.path);
    if (marker && record && MARKER_SOURCE_FIELDS.some(field => field in record && marker[field] !== record[field])) {
      const previousSha256 = String(marker.expectedSha256);
      for (const field of MARKER_SOURCE_FIELDS) if (field in record) marker[field] = record[field];
      const bytes = Buffer.from(JSON.stringify(navigation, null, 2) + '\n');
      pending.set(navigationPath, bytes);
      changes.push({ file: 'source/preparation/navigation.json', path: requireString(marker.path, 'marker source path'),
        expectedBytes: Number(marker.expectedBytes), expectedSha256: String(marker.expectedSha256), previousSha256 });
    }
  }
  for (const entry of entries('documents')) {
    const path = requireString(entry.path, 'document path');
    await repin(entry, 'source/manifest.json', path, resolve(objectDirectory, 'source', path));
  }
  const recipe = requireRecord(requireRecord(descriptor.properties, 'descriptor properties').recipe, 'descriptor recipe');
  for (const value of requireArray(recipe.sources, 'descriptor recipe sources')) {
    const source = requireRecord(value, 'descriptor source'), path = requireString(source.path, 'descriptor source path'), at = resolve(objectDirectory, path);
    const actual = identityOf(pending.get(at) ?? await readFile(at));
    if (source.sha256 === actual.expectedSha256) continue;
    changes.push({ file: 'object.json', path, ...actual, previousSha256: String(source.sha256) });
    source.sha256 = actual.expectedSha256;
  }
  if (!write) return changes;
  for (const [path, bytes] of pending) await writeFile(path, bytes);
  if (changes.some(change => change.file === 'source/manifest.json')) await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  if (changes.some(change => change.file === 'object.json')) await writeFile(descriptorPath, JSON.stringify(descriptor, null, 2) + '\n');
  return changes;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const arguments_ = process.argv.slice(2), check = arguments_.includes('--check'), ids = arguments_.filter(argument => argument !== '--check');
  if (ids.length !== 1 || !/^[a-z][a-z0-9-]*$/u.test(ids[0])) throw new TypeError('Usage: pin-object-documents <object-id> [--check]');
  const changes = await pinObjectDocuments(resolve('src/objects', ids[0]), { write: !check });
  for (const change of changes) console.log(`${check ? 'stale' : 'pinned'} ${change.file} ${change.path} ${change.previousSha256.slice(0, 8)} -> ${change.expectedSha256.slice(0, 8)} (${change.expectedBytes} bytes)`);
  if (!changes.length) console.log(`${ids[0]}: document pins are current.`);
  if (check && changes.length) process.exitCode = 1;
}
