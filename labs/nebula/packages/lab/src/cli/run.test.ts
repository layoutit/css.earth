import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, glob } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { labTestFiles, selectLabTests } from './run.ts';

test('the unfiltered CI command selects every lab test, including newly added tests', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lab-discovery-'));
  try {
    for (const path of ['labs/nebula/packages/new/src/new.test.ts', 'labs/nebula/packages/new/browser/new.test.mts', 'packages/volume-viewer/src/new.test.cts', 'labs/nebula/packages/new/src/new.test.tsx']) {
      await mkdir(resolve(root, path, '..'), { recursive: true }); await writeFile(resolve(root, path), '');
    }
    const selected = await labTestFiles(root);
    assert.equal(selected.length, 4);
    assert.throws(() => assert.equal(selected.filter(path => !path.endsWith('new.test.cts')).length, 4), assert.AssertionError);
    const expected: string[] = [];
    for await (const path of glob(['labs/nebula/packages/**/*.test.{ts,tsx,mts,cts}', 'packages/volume-viewer/src/**/*.test.{ts,tsx,mts,cts}'])) expected.push(resolve(path));
    assert.deepEqual(await labTestFiles(process.cwd()), expected.sort());
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('--without-sources drops only source-backed tests', () => {
  const files = ['a/x.test.ts', 'a/y.sources.test.ts'];
  assert.deepEqual(selectLabTests(files, ['--without-sources']), ['a/x.test.ts']);
  assert.deepEqual(selectLabTests(files, []), files);
});
