import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm, symlink, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { it } from 'node:test';
import { discoverRoot, discoverGitRoot } from './root-discovery.js';

it('ancestor marker discovery uses the supplied start and nearest marker; all missing policies are explicit', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'root-discovery-')));
  try {
    const child = join(root, 'nested'), start = join(child, 'src');
    await mkdir(start, { recursive: true });
    await writeFile(join(root, 'marker'), '');
    await writeFile(join(child, 'marker'), '');
    const options = { strategy: 'ancestor-marker' as const, startDirectory: start, marker: 'marker' };
    assert.equal(discoverRoot({ ...options, missing: { behavior: 'throw' } }), child);
    await symlink(child, join(root, 'linked'));
    assert.equal(discoverRoot({ ...options, startDirectory: join(root, 'linked', 'src'), missing: { behavior: 'throw' } }), join(root, 'linked'));
    const absent = { ...options, marker: 'absent-root-discovery-marker' };
    assert.equal(discoverRoot({ ...absent, missing: { behavior: 'undefined' } }), undefined);
    assert.equal(discoverRoot({ ...absent, missing: { behavior: 'fallback', directory: 'unchanged-fallback' } }), 'unchanged-fallback');
    assert.throws(() => discoverRoot({ ...absent, missing: { behavior: 'throw' } }), {
      message: `No absent-root-discovery-marker above ${start}.` });
    assert.throws(() => discoverRoot({ ...absent, missing: { behavior: 'throw', error: () => new Error('caller message') } }), { message: 'caller message' });
  } finally { await rm(root, { recursive: true, force: true }); }
});

it('package discovery uses the caller module from source and dist, with no marker requirement', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'package-discovery-')));
  try {
    const pkg = join(root, 'packages', 'bake');
    await mkdir(join(pkg, 'src', 'nested'), { recursive: true });
    await mkdir(join(pkg, 'dist'), { recursive: true });
    await writeFile(join(pkg, 'package.json'), JSON.stringify({ name: '@fixture/bake', exports: { './package.json': './package.json' } }));
    for (const module of ['src/nested/module.ts', 'dist/module.js']) {
      const options = { strategy: 'package-location' as const, fromUrl: pathToFileURL(join(pkg, module)), packageSpecifier: '@fixture/bake/package.json', rootOffset: '../..' };
      assert.equal(discoverRoot({ ...options, missing: { behavior: 'throw' } }), root);
      const absent = { ...options, packageSpecifier: '@missing/root-discovery/package.json' };
      assert.equal(discoverRoot({ ...absent, missing: { behavior: 'undefined' } }), undefined);
      assert.equal(discoverRoot({ ...absent, missing: { behavior: 'fallback', directory: root } }), root);
      assert.throws(() => discoverRoot({ ...absent, missing: { behavior: 'throw' } }), { code: 'MODULE_NOT_FOUND' });
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

it('Git discovery starts in the supplied directory and preserves each missing policy', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'git-discovery-')));
  try {
    const repo = join(root, 'repo'), nested = join(repo, 'nested');
    await mkdir(nested, { recursive: true });
    execFileSync('git', ['init', '-q', repo]);
    assert.equal(await discoverGitRoot({ startDirectory: nested, missing: { behavior: 'throw' } }), repo);
    assert.equal(await discoverGitRoot({ startDirectory: root, missing: { behavior: 'undefined' } }), undefined);
    const cwd = process.cwd();
    try {
      process.chdir(nested);
      assert.equal(await discoverGitRoot({ missing: { behavior: 'throw' } }), repo);
      process.chdir(root);
      assert.equal(await discoverGitRoot({ missing: { behavior: 'undefined' } }), undefined);
    } finally { process.chdir(cwd); }
    assert.equal(await discoverGitRoot({ startDirectory: root, missing: { behavior: 'fallback', directory: 'fallback' } }), 'fallback');
    await assert.rejects(discoverGitRoot({ startDirectory: root, missing: { behavior: 'throw', error: () => new Error('missing git root') } }), { message: 'missing git root' });
  } finally { await rm(root, { recursive: true, force: true }); }
});
