import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { readWorkspaces } from './affected-tests.mts';
import { ciBuildPlan } from './build-ci.mts';
import { workspacePackageDirectories } from './workspace-packages.mts';

test('workspace discovery and the build plan ignore restored outputs without a manifest', t => {
  const root = mkdtempSync(resolve(tmpdir(), 'ci-workspaces-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const name of ['current', 'removed']) mkdirSync(resolve(root, 'packages', name, 'dist'), { recursive: true });
  writeFileSync(resolve(root, 'packages/removed/dist/index.js'), 'stale compiled output');
  writeFileSync(resolve(root, 'packages/current/package.json'), JSON.stringify({
    name: '@cssearth/current', scripts: { build: 'tsc' }, main: './dist/index.js', types: './dist/index.d.ts',
    dependencies: { '@cssearth/core': 'workspace:*' },
  }));
  writeFileSync(resolve(root, 'packages/not-a-directory'), 'ignored');
  mkdirSync(resolve(root, 'packages/directory-manifest/package.json'), { recursive: true });

  assert.deepEqual(workspacePackageDirectories(root), ['current']);
  assert.deepEqual(readWorkspaces(root), [{ directory: 'current', name: '@cssearth/current', dependencies: ['@cssearth/core'] }]);
  const outputs = [{ path: 'packages/current/dist', required: ['index.js', 'index.d.ts'] }];
  for (const mode of ['packages', 'lint', 'full'] as const)
    assert.deepEqual(ciBuildPlan(root, mode).find(task => task.id === 'packages')?.outputs, outputs);
  assert.ok(!ciBuildPlan(root, 'generators').some(task => task.id === 'packages'));

  // A tracked CLI launcher is available at install time; the cache still requires every compiled lane export.
  writeFileSync(resolve(root, 'packages/current/package.json'), JSON.stringify({
    name: '@cssearth/current', scripts: { build: 'node build.mts' }, bin: { current: 'run.mjs' },
    exports: { './lane': { import: './dist/lane.js', types: './dist/lane.d.ts' } },
  }));
  assert.deepEqual(ciBuildPlan(root, 'packages')[0]?.outputs,
    [{ path: 'packages/current/dist', required: ['lane.js', 'lane.d.ts'] }]);

  writeFileSync(resolve(root, 'packages/current/package.json'), '{broken');
  assert.throws(() => ciBuildPlan(root, 'packages'), SyntaxError, 'invalid current manifests must still fail');
});
