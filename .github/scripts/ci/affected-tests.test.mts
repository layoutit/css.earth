import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { affectedTests, FOREIGN_TESTS } from './affected-tests.mts';

const packages = [
  { directory: 'core', name: '@cssearth/core', dependencies: [] },
  { directory: 'renderer', name: '@cssearth/renderer', dependencies: ['@cssearth/core'] },
  { directory: 'bake', name: '@cssearth/bake', dependencies: ['@cssearth/renderer', '@cssearth/core'] },
  { directory: 'telescope-cli', name: '@cssearth/telescope-cli', dependencies: ['@cssearth/bake'] },
];
const site = ['@cssearth/core', '@cssearth/renderer'];
const renderer = FOREIGN_TESTS.renderer!.slice().sort();

test('a changed package tests itself and every package that depends on it, and the site when the site imports one', () => {
  assert.deepEqual(affectedTests(['packages/core/src/a.ts'], packages, site), { packages: ['core', 'renderer'], site: true, files: renderer });
  assert.deepEqual(affectedTests(['packages/telescope-cli/src/a.mts'], packages, site), { packages: ['telescope-cli'], site: false, files: [] });
});

test('the offline tools join when they or another tool changed, not when the renderer they import did', () => {
  assert.deepEqual(affectedTests(['packages/renderer/src/a.ts'], packages, site), { packages: ['renderer'], site: true, files: renderer });
  assert.deepEqual(affectedTests(['packages/bake/src/a.ts'], packages, site), { packages: ['bake', 'telescope-cli'], site: false, files: FOREIGN_TESTS.bake!.slice().sort() });
});

test('object data and the site test no package; documentation tests nothing', () => {
  assert.deepEqual(affectedTests(['src/objects/mars/text.json'], packages, site), { packages: [], site: true, files: [] });
  assert.deepEqual(affectedTests(['docs/ci-cd.md'], packages, site), { packages: [], site: false, files: [] });
});

test('a push or a shared configuration change tests everything', () => {
  assert.deepEqual(affectedTests(null, packages, site), { packages: 'all', site: true, files: [] });
  assert.deepEqual(affectedTests(['pnpm-lock.yaml', 'src/objects/mars/text.json'], packages, site), { packages: 'all', site: true, files: [] });
});

test('the bake tests that exercise the renderer run on a renderer-only change, though the bake does not join', () => {
  const result = affectedTests(['packages/renderer/src/a.ts'], packages, site);
  assert.deepEqual(result.packages, ['renderer']);
  assert.ok(result.files.includes('integration/renderer-bake/src/contract/navigable-object-mount.test.ts'));
  assert.deepEqual(affectedTests(['packages/core/src/a.ts'], packages, site).files, renderer, 'a package the renderer depends on reaches them too');
  assert.deepEqual(affectedTests(['packages/bake/src/a.ts'], packages, site).files, FOREIGN_TESTS.bake!.slice().sort(), 'integration suites also run on a bake-only change');
  assert.deepEqual(affectedTests(['docs/ci-cd.md'], packages, site).files, []);
});

test('every foreign test exists, sits in an offline tool or integration and imports its owner package', () => {
  const root = resolve(import.meta.dirname, '../../..');
  for (const [owner, tests] of Object.entries(FOREIGN_TESTS)) for (const test of tests) {
    assert.ok(existsSync(resolve(root, test)), `${test} is missing`);
    assert.match(test, /^(?:packages\/(bake|telescope-cli)\/|integration\/renderer-bake\/)/u);
    assert.match(readFileSync(resolve(root, test), 'utf8'), new RegExp(`@cssearth/${owner}[/'"]`, 'u'), `${test} does not import ${owner}`);
  }
});


test('directly edited integration suites stay in the packages lane and two changed owners collect once', () => {
  const file = FOREIGN_TESTS.bake![0]!;
  assert.deepEqual(affectedTests([file], packages, site), { packages: [], site: true, files: [file] });
  const result = affectedTests(['packages/bake/src/a.ts', 'packages/renderer/src/a.ts'], packages, site);
  assert.equal(result.files.length, new Set(result.files).size);
  assert.ok(result.files.includes(file));
});
