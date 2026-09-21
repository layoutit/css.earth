import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test, { type TestContext } from 'node:test';
import { ciCacheKeys, compiledCiCacheKeys, isTypecheckCacheInput, type CacheRuntime } from './ci-cache-key.mts';

const runtime: CacheRuntime = { node: '22.23.2', platform: 'linux', arch: 'x64', environment: {} };

function fixture(t: TestContext) {
  const root = mkdtempSync(resolve(tmpdir(), 'cssearth-cache-key-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const write = (path: string, value: string) => { mkdirSync(dirname(resolve(root, path)), { recursive: true }); writeFileSync(resolve(root, path), value); };
  git('init', '-q');
  write('package.json', JSON.stringify({ packageManager: 'pnpm@10.33.0', devDependencies: { typescript: '5.9.3' } }));
  write('pnpm-lock.yaml', 'lockfileVersion: 9.0\n');
  write('tsconfig.json', '{"compilerOptions":{"strict":true}}');
  write('.gitignore', 'node_modules/\ndist/\noutput/\n');
  write('tools/prepare.mts', 'export const prepared = 1;');
  git('add', '.');
  return { root, git, write, keys: () => ciCacheKeys({ root, runtime }) };
}

test('tracked source, object data and binary changes, additions and deletions invalidate the full build key', t => {
  const f = fixture(t), original = f.keys();
  f.write('tools/prepare.mts', 'export const prepared = 2;');
  const edited = f.keys();
  assert.notEqual(edited.buildDigest, original.buildDigest, 'unstaged current bytes must invalidate');
  assert.equal(edited.tsconfigDigest, original.tsconfigDigest, 'ordinary source edits keep the incremental compiler family');
  f.write('src/objects/new-body/prepared/controls.json', '{"real":"input"}');
  f.git('add', 'src/objects');
  const added = f.keys();
  assert.notEqual(added.buildDigest, edited.buildDigest);
  f.write('src/objects/new-body/prepared/controls.json', '{"real":"changed"}');
  const dataChanged = f.keys();
  assert.notEqual(dataChanged.buildDigest, added.buildDigest);
  f.write('src/objects/new-body/source/pin.bin', 'binary one');
  f.git('add', 'src/objects/new-body/source/pin.bin');
  const binary = f.keys();
  f.write('src/objects/new-body/source/pin.bin', 'binary two');
  const beforeDelete = f.keys();
  assert.notEqual(beforeDelete.buildDigest, binary.buildDigest);
  unlinkSync(resolve(f.root, 'tools/prepare.mts'));
  const deleted = f.keys();
  assert.equal(deleted.missing, 1);
  assert.notEqual(deleted.buildDigest, beforeDelete.buildDigest);
  f.git('rm', '--cached', 'tools/prepare.mts');
  assert.notEqual(f.keys().buildDigest, deleted.buildDigest, 'a removed tracked path differs from a tracked deletion marker');
});

test('installed, ignored and untracked outputs do not affect either digest', t => {
  const f = fixture(t), before = f.keys();
  for (const file of ['node_modules/package/tsconfig.json', 'dist/bundle.mjs', 'output/generated.json', 'untracked.txt']) f.write(file, 'ignored bytes');
  assert.deepEqual(f.keys(), before);
});

test('lockfile, package compiler pin and both tsconfig naming conventions change both cache families', t => {
  const f = fixture(t);
  for (const file of ['pnpm-lock.yaml', 'package.json', 'tsconfig.json', 'site/astro.tsconfig.json']) {
    const before = f.keys();
    if (file === 'package.json') f.write(file, JSON.stringify({ packageManager: 'pnpm@10.33.0', devDependencies: { typescript: '6.0.0' } }));
    else f.write(file, file.endsWith('.json') ? '{"compilerOptions":{"strict":false}}' : 'lockfileVersion: 9.0\nchanged: true\n');
    f.git('add', file);
    const after = f.keys();
    assert.notEqual(after.buildDigest, before.buildDigest, file);
    assert.notEqual(after.tsconfigDigest, before.tsconfigDigest, file);
  }
  assert.equal(isTypecheckCacheInput('site/astro.tsconfig.json'), true);
});

test('paths, runtime platform/toolchain and build environment are part of the deterministic identity', t => {
  const f = fixture(t), before = f.keys();
  assert.deepEqual(f.keys(), before);
  for (const altered of [{ ...runtime, node: '24.1.0' }, { ...runtime, arch: 'arm64' }, { ...runtime, platform: 'darwin' },
    { ...runtime, environment: { ASSET_ORIGIN: 'https://assets.example.test' } },
    { ...runtime, environment: { CSSEARTH_PERFORMANCE_SOURCEMAPS: '1' } }]) {
    assert.notEqual(ciCacheKeys({ root: f.root, runtime: altered }).buildDigest, before.buildDigest);
  }
  renameSync(resolve(f.root, 'tools/prepare.mts'), resolve(f.root, 'tools/renamed.mts'));
  f.git('add', '-A');
  assert.notEqual(f.keys().buildDigest, before.buildDigest, 'equal bytes at a new path cannot reuse an old bundle');
  const reordered = fixture(t);
  renameSync(resolve(reordered.root, 'tools/prepare.mts'), resolve(reordered.root, 'tools/renamed.mts'));
  reordered.git('rm', '-r', '--cached', '.');
  for (const path of ['tools/renamed.mts', 'tsconfig.json', 'pnpm-lock.yaml', 'package.json', '.gitignore']) reordered.git('add', path);
  assert.equal(f.keys().buildDigest, reordered.keys().buildDigest, 'index insertion order and checkout location cannot change the key');
});

test('tracked symlink targets are hashed without following ignored trees; external targets fail closed', t => {
  const f = fixture(t);
  symlinkSync('prepare.mts', resolve(f.root, 'tools/alias.mts'));
  f.git('add', 'tools/alias.mts');
  const before = f.keys();
  f.write('tools/prepare.mts', 'changed target');
  assert.notEqual(f.keys().buildDigest, before.buildDigest);
  unlinkSync(resolve(f.root, 'tools/alias.mts'));
  symlinkSync('/tmp/not-a-tracked-build-input', resolve(f.root, 'tools/alias.mts'));
  assert.throws(f.keys, /escapes|tracked target/);
});

test('an empty index and unresolved conflicts cannot produce a reusable key', t => {
  const f = fixture(t);
  const blob = f.git('hash-object', 'tools/prepare.mts').trim();
  execFileSync('git', ['update-index', '--index-info'], { cwd: f.root,
    input: `0 ${'0'.repeat(40)}\ttools/prepare.mts\n100644 ${blob} 1\ttools/prepare.mts\n100644 ${blob} 2\ttools/prepare.mts\n` });
  assert.throws(f.keys, /resolved ordinary tracked files/);
  f.git('rm', '-r', '--cached', '.');
  assert.throws(f.keys, /empty Git index/);
});

test('a dangling internal link is explicit; an untracked target appearing cannot produce a false hit', t => {
  const f = fixture(t);
  symlinkSync('missing.mts', resolve(f.root, 'tools/old-alias.mts'));
  f.git('add', 'tools/old-alias.mts');
  const before = f.keys();
  assert.deepEqual(f.keys(), before);
  f.write('tools/missing.mts', 'new input');
  assert.throws(f.keys, /tracked target/);
  f.git('add', 'tools/missing.mts');
  assert.notEqual(f.keys().buildDigest, before.buildDigest);
});

function compilerFixture(t: TestContext) {
  const f = fixture(t);
  f.write('packages/core/package.json', JSON.stringify({ name: '@fixture/core', type: 'module', main: 'dist/index.js', types: 'dist/index.d.ts', scripts: { build: 'tsup' } }));
  const tsconfig = JSON.stringify({ compilerOptions: { strict: true, module: 'ESNext', moduleResolution: 'Bundler', target: 'ES2022', types: [] }, include: ['**/*.ts'] });
  f.write('packages/core/tsconfig.json', tsconfig);
  f.write('packages/core/tsup.config.ts', "export default {entry: ['src/index.ts'], format: ['esm'], dts: true};");
  f.write('packages/core/src/index.ts', 'export const core = 1;');
  f.write('packages/core/data/records.json', '{"source":1}');
  f.write('src/renderers/css/tsconfig.json', tsconfig);
  f.write('src/renderers/css/tsup.config.ts', "import {fileURLToPath} from 'node:url'; export default {entry: {index:fileURLToPath(new URL('./index.ts',import.meta.url))}, tsconfig:fileURLToPath(new URL('./tsconfig.json',import.meta.url)), format:['esm'], dts:true};");
  f.write('src/renderers/css/index.ts', "import {helper} from '../../platform/outside.js'; import {core} from '@fixture/core'; import type {Contract} from '../../../shared/contracts.mts'; export const value = helper + core; export type Output = Contract;");
  f.write('src/platform/outside.ts', 'export const helper = 1;');
  f.write('shared/contracts.mts', 'export interface Contract { value: number; }');
  f.git('add', '.');
  mkdirSync(resolve(f.root, 'node_modules/@fixture'), { recursive: true });
  symlinkSync('../../packages/core', resolve(f.root, 'node_modules/@fixture/core'));
  return { ...f, compiled: () => compiledCiCacheKeys({ root: f.root, runtime }) };
}

test('compiler-owned component keys survive CI/test edits and absent or restored package dist', async t => {
  const f = compilerFixture(t), before = await f.compiled();
  assert.deepEqual(before.fallbackReasons, [], 'cold compilation inputs must resolve without any dist');
  f.write('tools/check-ci.test.mts', 'export const testOnly = 1;');
  f.write('.github/workflows/test.yml', 'name: Changed CI');
  f.git('add', '.');
  f.write('packages/core/dist/index.js', 'export const core = 1;');
  f.write('packages/core/dist/index.d.ts', 'export declare const core = 1;');
  const after = await f.compiled();
  assert.deepEqual(after.fallbackReasons, []);
  assert.notEqual(after.buildDigest, before.buildDigest);
  assert.equal(after.packageDigest, before.packageDigest);
  assert.equal(after.rendererDigest, before.rendererDigest);
});

test('resolved runtime and type-only imports outside the renderer invalidate its key without an owner allowlist', async t => {
  const f = compilerFixture(t), before = await f.compiled();
  f.write('src/platform/outside.ts', 'export const helper = 2;');
  const runtimeEdit = await f.compiled();
  assert.deepEqual(runtimeEdit.fallbackReasons, []);
  assert.equal(runtimeEdit.packageDigest, before.packageDigest);
  assert.notEqual(runtimeEdit.rendererDigest, before.rendererDigest);
  f.write('shared/contracts.mts', 'export interface Contract { value: string; }');
  const typeEdit = await f.compiled();
  assert.deepEqual(typeEdit.fallbackReasons, []);
  assert.notEqual(typeEdit.rendererDigest, runtimeEdit.rendererDigest);
});

test('package-local generator data and outside-package source imports affect the package and downstream renderer', async t => {
  const f = compilerFixture(t), before = await f.compiled();
  f.write('packages/core/data/records.json', '{"source":2}');
  const dataEdit = await f.compiled();
  assert.notEqual(dataEdit.packageDigest, before.packageDigest);
  assert.notEqual(dataEdit.rendererDigest, before.rendererDigest);
  f.write('packages/core/src/index.ts', "export {helper as core} from '../../../src/platform/outside.js';");
  const externalImport = await f.compiled();
  f.write('src/platform/outside.ts', 'export const helper = 9;');
  const externalEdit = await f.compiled();
  assert.deepEqual(externalEdit.fallbackReasons, []);
  assert.notEqual(externalEdit.packageDigest, externalImport.packageDigest);
});

test('unresolved authored imports and unaudited package build scripts explicitly fall back to the full identity', async t => {
  const f = compilerFixture(t);
  unlinkSync(resolve(f.root, 'src/platform/outside.ts'));
  const unresolved = await f.compiled();
  assert.equal(unresolved.rendererDigest, unresolved.buildDigest);
  assert.match(unresolved.fallbackReasons.join('\n'), /Unresolved authored compiler input/);
  f.write('src/platform/outside.ts', 'export const helper = 1;');
  f.write('packages/core/package.json', JSON.stringify({ name: '@fixture/core', scripts: { build: 'node custom-build.mts' } }));
  const changedBuild = await f.compiled();
  assert.equal(changedBuild.packageDigest, changedBuild.buildDigest);
  assert.match(changedBuild.fallbackReasons.join('\n'), /Unaudited package build/);
});
