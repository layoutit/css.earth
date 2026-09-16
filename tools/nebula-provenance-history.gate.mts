/** Explicit historical-byte audit. Requires the recorded Git revisions; routine CI does not fetch history. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseSourceCatalog, sourceObject, sourceArray, sourceText } from '../src/platform/source-catalog.mts';

const root = resolve(import.meta.dirname, '..');
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const json = async (path: string) => sourceObject(JSON.parse(await readFile(resolve(root, path), 'utf8')));
let copies = 0, historical = 0;
for (const directory of await readdir(resolve(root, 'src/objects'), { withFileTypes: true })) {
  if (!directory.isDirectory()) continue;
  const ledger = await json(`src/objects/${directory.name}/source/provenance-references.json`).catch((error: unknown) => {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  });
  if (!ledger) continue;
  for (const reference of sourceArray(ledger.references, sourceObject)) {
    const revision = sourceText(reference.revision), original = sourceText(reference.originalPath);
    const current = await readFile(resolve(root, sourceText(reference.path)));
    const previous = execFileSync('git', ['show', `${revision}:${original}`], { cwd: root, maxBuffer: 8 * 1024 * 1024 });
    assert.deepEqual(current, previous); assert.equal(hash(previous), reference.sha256); copies++;
  }
}
const records = await Promise.all((await readdir(resolve(root, 'src/sources'))).filter(path => path.endsWith('.json')).map(path => json(`src/sources/${path}`)));
for (const record of parseSourceCatalog({ schema: 'cssearth-source-catalog@1', records }).records) for (const evidence of record.evidence) {
  if (!('path' in evidence) || !evidence.path.startsWith('labs/')) continue;
  const bytes = execFileSync('git', ['show', `${evidence.revision}:${evidence.path}`], { cwd: root, maxBuffer: 8 * 1024 * 1024 });
  assert.equal(hash(bytes), evidence.sha256); historical++;
}
assert.ok(copies > 0 && historical > 0);
console.log(`NEBULA_PROVENANCE_HISTORY_PASS ${copies} retained copies; ${historical} historical source records`);
