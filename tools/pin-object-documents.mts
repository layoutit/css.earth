/**
 * Refresh the byte and SHA-256 pins that bind an object's authored files: the
 * source manifest's `documents`, its `local` inputs that no acquisition step
 * downloads, its `generatedIntermediates`, and inputs a named repository tool
 * writes (`recipe.generator`). The descriptor and the navigation marker reference
 * sources by path only. Catalogued and downloaded inputs are never repinned; they
 * stay verified against their upstream bytes. `adoptDownloads` gives a new download
 * its first pin, only while its pin is still the all-zero placeholder.
 * Preparation in write mode runs this first. `--check` reports stale pins without writing;
 * `--adopt-downloads` adopts first pins for downloaded inputs present on disk.
 */
import { sha256 } from '../src/platform/sha256.mts';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hasErrorCode, isRecord, requireArray, requireRecord, requireString } from './source-values.mts';
import { MARKER_SOURCE_HINTS } from '../src/navigation/marker-recipe.mts';

export interface DocumentPinChange { file: 'source/manifest.json' | 'source/preparation/navigation.json'; path: string; expectedBytes: number; expectedSha256: string; previousSha256: string }

const identityOf = (bytes: Uint8Array) => ({ expectedBytes: bytes.length, expectedSha256: sha256(bytes) });
const optionalBytes = (path: string) => readFile(path).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });

/** Paths an acquisition plan restores; those are downloads, not authored files. */
async function acquiredPaths(objectDirectory: string) {
  const plan = await readFile(resolve(objectDirectory, 'source/preparation/acquisition.json'), 'utf8')
    .then(text => requireRecord(JSON.parse(text), 'acquisition plan'))
    .catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });
  return new Set(requireArray(plan?.operations ?? [], 'acquisition operations')
    .flatMap(operation => isRecord(operation) && typeof operation.path === 'string' ? [operation.path] : []));
}

/** Recompute the authored pins in one object's manifest; returns what changed. */
export async function pinObjectDocuments(objectDirectory: string, { write = true, adoptDownloads = false } = {}): Promise<DocumentPinChange[]> {
  const manifestPath = resolve(objectDirectory, 'source/manifest.json');
  const manifest = requireRecord(JSON.parse(await readFile(manifestPath, 'utf8')), 'source manifest');
  const acquired = await acquiredPaths(objectDirectory), changes: DocumentPinChange[] = [];
  const entries = (key: string) => requireArray(manifest[key] ?? [], `manifest ${key}`).map(value => requireRecord(value, `manifest ${key} entry`));
  // Bytes this run writes; check mode pins them without touching disk.
  const pending = new Map<string, Buffer>();
  // A marker recipe names its source by path; a copy of the manifest record left by older tooling is dropped.
  const navigationPath = resolve(objectDirectory, 'source/preparation/navigation.json'), navigationText = await optionalBytes(navigationPath);
  if (navigationText) {
    const navigation = requireRecord(JSON.parse(navigationText.toString('utf8')), 'navigation marker'), source = requireRecord(navigation.source, 'navigation marker source');
    const kept = ['path', ...MARKER_SOURCE_HINTS];
    if (Object.keys(source).some(key => !kept.includes(key))) {
      const bytes = Buffer.from(JSON.stringify({ ...navigation, source: Object.fromEntries(kept.filter(key => key in source).map(key => [key, source[key]])) }, null, 2) + '\n');
      pending.set(navigationPath, bytes);
      changes.push({ file: 'source/preparation/navigation.json', path: requireString(source.path, 'marker source path'), ...identityOf(bytes), previousSha256: String(source.expectedSha256 ?? '') });
    }
  }
  const placeholder = '0'.repeat(64);
  const repinned = (entry: Record<string, unknown>) => {
    const downloaded = acquired.has(requireString(entry.path, 'input path'));
    if (downloaded) return adoptDownloads && entry.expectedSha256 === placeholder;
    return isRecord(entry.sourceBinding) && entry.sourceBinding.kind === 'local' || isRecord(entry.recipe) && typeof entry.recipe.generator === 'string';
  };
  const authored = [...entries('inputs').filter(repinned), ...entries('generatedIntermediates'), ...entries('documents')];
  for (const entry of authored) {
    // Context objects pin repository outputs by their repository path (`src/objects/sun/prepared/world-context.json`).
    const path = requireString(entry.path, 'document path'), at = path.startsWith('src/') ? resolve(objectDirectory, '../../..', path) : resolve(objectDirectory, 'source', path);
    const bytes = pending.get(at) ?? await optionalBytes(at);
    if (!bytes) continue;
    const actual = identityOf(bytes);
    if (entry.expectedBytes === actual.expectedBytes && entry.expectedSha256 === actual.expectedSha256) continue;
    changes.push({ file: 'source/manifest.json', path, ...actual, previousSha256: String(entry.expectedSha256) });
    Object.assign(entry, actual);
  }
  if (!write) return changes;
  for (const [path, bytes] of pending) await writeFile(path, bytes);
  if (changes.some(change => change.file === 'source/manifest.json')) await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  return changes;
}

/** Refresh every object manifest that pins a repository output by its path, after the tool that writes it ran. */
export async function pinManifestsReferencing(root: string, repositoryPath: string): Promise<(DocumentPinChange & { objectId: string })[]> {
  const { readdir } = await import('node:fs/promises');
  const changes: (DocumentPinChange & { objectId: string })[] = [];
  for (const directory of await readdir(resolve(root, 'src/objects'), { withFileTypes: true })) {
    if (!directory.isDirectory()) continue;
    const text = await optionalBytes(resolve(root, 'src/objects', directory.name, 'source/manifest.json'));
    if (!text || !text.toString('utf8').includes(`"path": "${repositoryPath}"`)) continue;
    for (const change of await pinObjectDocuments(resolve(root, 'src/objects', directory.name))) changes.push({ ...change, objectId: directory.name });
  }
  return changes;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const arguments_ = process.argv.slice(2), check = arguments_.includes('--check'), adoptDownloads = arguments_.includes('--adopt-downloads');
  const ids = arguments_.filter(argument => !argument.startsWith('--'));
  if (ids.length !== 1 || !/^[a-z][a-z0-9-]*$/u.test(ids[0])) throw new TypeError('Usage: pin-object-documents <object-id> [--check] [--adopt-downloads]');
  const changes = await pinObjectDocuments(resolve('src/objects', ids[0]), { write: !check, adoptDownloads });
  for (const change of changes) console.log(`${check ? 'stale' : 'pinned'} ${change.file} ${change.path} ${change.previousSha256.slice(0, 8)} -> ${change.expectedSha256.slice(0, 8)} (${change.expectedBytes} bytes)`);
  if (!changes.length) console.log(`${ids[0]}: document pins are current.`);
  if (check && changes.length) process.exitCode = 1;
}
