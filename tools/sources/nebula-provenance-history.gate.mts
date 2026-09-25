/** Explicit historical-byte audit. Requires the recorded Git revisions; routine CI does not fetch history. */
import assert from 'node:assert/strict';
import { sha256 } from '@cssearth/core/node';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceObject, sourceArray, sourceText } from '../../src/platform/source-catalog.mts';

const root = resolve(import.meta.dirname, '../..');
const json = async (path: string) => sourceObject(JSON.parse(await readFile(resolve(root, path), 'utf8')));
let copies = 0;
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
    assert.deepEqual(current, previous); assert.equal(sha256(previous), reference.sha256); copies++;
  }
}
assert.ok(copies > 0);
console.log(`NEBULA_PROVENANCE_HISTORY_PASS ${copies} retained copies`);
