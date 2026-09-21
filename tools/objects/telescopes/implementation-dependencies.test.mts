import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { implementationFingerprint } from './implementation-dependencies.mts';

test('implementation identity follows transitive local TypeScript imports', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'implementation-closure-'));
  try {
    await writeFile(resolve(root, 'entry.mts'), "import { value } from './helper.mts'; export const answer=value;\n");
    await writeFile(resolve(root, 'helper.mts'), 'export const value=1;\n');
    const before = await implementationFingerprint(root, ['entry.mts']);
    assert.deepEqual(before.files.map(file => file.path), ['entry.mts', 'helper.mts']);
    await writeFile(resolve(root, 'helper.mts'), 'export const value=2;\n');
    const after = await implementationFingerprint(root, ['entry.mts']);
    assert.notEqual(after.sha256, before.sha256);
  } finally { await rm(root, { recursive: true, force: true }); }
});
