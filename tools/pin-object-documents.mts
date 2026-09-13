/**
 * Refresh the byte and SHA-256 pins that bind an object's authored documents:
 * the source manifest's `documents` entries and the descriptor's
 * `recipe.sources`. Preparation refuses an edited recipe, content file or
 * acquisition plan until both agree with the bytes on disk, so run this after
 * editing them and before preparing. `--check` reports stale pins without writing.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireRecord, requireString } from './source-values.mts';

export interface DocumentPinChange { file: 'source/manifest.json' | 'object.json'; path: string; expectedBytes: number; expectedSha256: string; previousSha256: string }

async function identity(path: string) {
  const bytes = await readFile(path);
  return { expectedBytes: bytes.length, expectedSha256: createHash('sha256').update(bytes).digest('hex') };
}

/** Recompute both pin sets for one object directory; returns what changed. */
export async function pinObjectDocuments(objectDirectory: string, { write = true } = {}): Promise<DocumentPinChange[]> {
  const manifestPath = resolve(objectDirectory, 'source/manifest.json'), descriptorPath = resolve(objectDirectory, 'object.json');
  const manifest = requireRecord(JSON.parse(await readFile(manifestPath, 'utf8')), 'source manifest');
  const descriptor = requireRecord(JSON.parse(await readFile(descriptorPath, 'utf8')), 'object descriptor');
  const changes: DocumentPinChange[] = [];
  for (const value of requireArray(manifest.documents, 'manifest documents')) {
    const entry = requireRecord(value, 'manifest document'), path = requireString(entry.path, 'document path');
    const actual = await identity(resolve(objectDirectory, 'source', path));
    if (entry.expectedBytes === actual.expectedBytes && entry.expectedSha256 === actual.expectedSha256) continue;
    changes.push({ file: 'source/manifest.json', path, ...actual, previousSha256: String(entry.expectedSha256) });
    entry.expectedBytes = actual.expectedBytes; entry.expectedSha256 = actual.expectedSha256;
  }
  const recipe = requireRecord(requireRecord(descriptor.properties, 'descriptor properties').recipe, 'descriptor recipe');
  for (const value of requireArray(recipe.sources, 'descriptor recipe sources')) {
    const source = requireRecord(value, 'descriptor source'), path = requireString(source.path, 'descriptor source path');
    const actual = await identity(resolve(objectDirectory, path));
    if (source.sha256 === actual.expectedSha256) continue;
    changes.push({ file: 'object.json', path, ...actual, previousSha256: String(source.sha256) });
    source.sha256 = actual.expectedSha256;
  }
  if (write && changes.some(change => change.file === 'source/manifest.json')) await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  if (write && changes.some(change => change.file === 'object.json')) await writeFile(descriptorPath, JSON.stringify(descriptor, null, 2) + '\n');
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
