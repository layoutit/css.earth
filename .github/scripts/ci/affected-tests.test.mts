import assert from 'node:assert/strict';
import { test } from 'node:test';
import { affectedTests } from './affected-tests.mts';

const packages = [
  { directory: 'core', name: '@cssearth/core', dependencies: [] },
  { directory: 'renderer', name: '@cssearth/renderer', dependencies: ['@cssearth/core'] },
  { directory: 'bake', name: '@cssearth/bake', dependencies: ['@cssearth/renderer', '@cssearth/core'] },
  { directory: 'telescope-cli', name: '@cssearth/telescope-cli', dependencies: ['@cssearth/bake'] },
];
const site = ['@cssearth/core', '@cssearth/renderer'];

test('a changed package tests itself and every package that depends on it, and the site when the site imports one', () => {
  assert.deepEqual(affectedTests(['packages/core/src/a.ts'], packages, site), { packages: ['core', 'renderer'], site: true });
  assert.deepEqual(affectedTests(['packages/telescope-cli/src/a.mts'], packages, site), { packages: ['telescope-cli'], site: false });
});

test('the offline tools join when they or another tool changed, not when the renderer they import did', () => {
  assert.deepEqual(affectedTests(['packages/renderer/src/a.ts'], packages, site), { packages: ['renderer'], site: true });
  assert.deepEqual(affectedTests(['packages/bake/src/a.ts'], packages, site), { packages: ['bake', 'telescope-cli'], site: false });
});

test('object data and the site test no package; documentation tests nothing', () => {
  assert.deepEqual(affectedTests(['src/objects/mars/text.json'], packages, site), { packages: [], site: true });
  assert.deepEqual(affectedTests(['docs/ci-cd.md'], packages, site), { packages: [], site: false });
});

test('a push or a shared configuration change tests everything', () => {
  assert.deepEqual(affectedTests(null, packages, site), { packages: 'all', site: true });
  assert.deepEqual(affectedTests(['pnpm-lock.yaml', 'src/objects/mars/text.json'], packages, site), { packages: 'all', site: true });
});
