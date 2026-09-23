import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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

test('production-shaped two-entry fingerprints retain both dependency closures without writing bundles', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'implementation-multiple-'));
  try {
    await writeFile(resolve(root, 'dispatcher.mts'), "import './shared.mts'; export const dispatch=true;\n");
    await writeFile(resolve(root, 'owner.mts'), "import './shared.mts'; import './science.mts'; export const owner=true;\n");
    await writeFile(resolve(root, 'shared.mts'), 'export const shared=1;\n');
    await writeFile(resolve(root, 'science.mts'), 'export const method=1;\n');
    const found = await implementationFingerprint(root, ['dispatcher.mts', 'owner.mts']);
    assert.deepEqual(found.files.map(file => file.path), ['dispatcher.mts', 'owner.mts', 'science.mts', 'shared.mts']);
    await assert.rejects(readFile(resolve(root, '.fingerprint-output/dispatcher.js')), /ENOENT/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('fingerprints generated-module imports through authored sources without a dist build', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'implementation-authored-'));
  try {
    await writeFile(resolve(root, 'entry.mts'), "import { value } from './dist/universe.js'; export const answer=value;\n");
    await mkdir(resolve(root, 'universe'), { recursive: true });
    await writeFile(resolve(root, 'universe/index.ts'), 'export const value=1;\n');
    const before = await implementationFingerprint(root, ['entry.mts']);
    assert.deepEqual(before.files.map(file => file.path), ['entry.mts', 'universe/index.ts']);
    await mkdir(resolve(root, 'dist'));
    await writeFile(resolve(root, 'dist/universe.js'), 'export const value=999;\n');
    const withBuild = await implementationFingerprint(root, ['entry.mts']);
    assert.equal(withBuild.sha256, before.sha256);
    await writeFile(resolve(root, 'universe/index.ts'), 'export const value=2;\n');
    const after = await implementationFingerprint(root, ['entry.mts']);
    assert.notEqual(after.sha256, before.sha256);
  } finally { await rm(root, { recursive: true, force: true }); }
});
