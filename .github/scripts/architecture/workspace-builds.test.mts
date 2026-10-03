import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { buildRules } from '@cssearth/bake/preparation';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { readWorkspaceGraph, workspaceOrder, workspaceExternals, externalWorkspaceSpecifier } from '@cssearth/bake/preparation/workspace-graph';

test('workspace discovery and build order pick up a new package and dev dependency', () => {
  const root = mkdtempSync(join(tmpdir(), 'workspace-order-'));
  try {
    writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
    function pkg(name: string, dependencies: Record<string, string> = {}) {
      mkdirSync(join(root, 'packages', name), { recursive: true });
      writeFileSync(join(root, 'packages', name, 'package.json'), JSON.stringify({ name: '@cssearth/' + name,
        scripts: { build: 'tsup' }, exports: { '.': { import: './dist/index.js' } }, devDependencies: dependencies }));
    }
    pkg('a');
    assert.deepEqual(workspaceOrder(readWorkspaceGraph(root)).map(pkg => pkg.name), ['@cssearth/a']);
    pkg('z'); pkg('a', { '@cssearth/z': 'workspace:*' });
    const graph = readWorkspaceGraph(root);
    assert.deepEqual(workspaceOrder(graph).map(pkg => pkg.name), ['@cssearth/z', '@cssearth/a']);
    assert.deepEqual(buildRules(root).map(rule => rule.name), ['@cssearth/z', '@cssearth/a']);
    const cli = spawnSync(process.execPath, [resolve('.github/scripts/architecture/workspace-builds.mts')], { cwd: root, encoding: 'utf8' });
    assert.equal(cli.status, 0, cli.stderr);
    assert.deepEqual(cli.stdout.trim().split('\n'), ['@cssearth/z', '@cssearth/a']);
    assert.deepEqual(workspaceExternals(graph, '@cssearth/a'), ['@cssearth/z']);
    assert.throws(() => workspaceOrder(graph.filter(pkg => pkg.name !== '@cssearth/z')), /Missing workspace/);
    assert.throws(() => assert.deepEqual(workspaceOrder(graph.map(pkg => ({ ...pkg, dependencies: [] }))).map(pkg => pkg.name), ['@cssearth/z', '@cssearth/a']), assert.AssertionError);
    assert.throws(() => assert.deepEqual(workspaceExternals(graph.map(pkg => ({ ...pkg, dependencies: [] })), '@cssearth/a'), ['@cssearth/z']), assert.AssertionError);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('workspace cycles fail explicitly', () => {
  assert.throws(() => workspaceOrder([{ name: 'a', directory: 'a', manifest: {}, dependencies: ['b'] },
    { name: 'b', directory: 'b', manifest: {}, dependencies: ['a'] }]), /cycle/);
});

test('mixed source and built exports retain their own bundling policy', () => {
  const pkg = { name: '@cssearth/mixed', directory: 'packages/mixed', dependencies: [], manifest: { exports: { '.': { import: './dist/index.js' }, './source': './src/source.ts' } } };
  assert.equal(externalWorkspaceSpecifier([pkg], [pkg.name], pkg.name), true);
  assert.equal(externalWorkspaceSpecifier([pkg], [pkg.name], pkg.name + '/source'), false);
});
