import assert from 'node:assert/strict';
import { test } from 'node:test';
import { globSync, readdirSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { parse } from 'yaml';
import { resolve, matchesGlob } from 'node:path';
import { affectedTests, pinnedSourceOwners, TOOL_OBJECT_TEST_LIMIT, testLaneFiles, testOwners } from './affected-tests.mts';

const packages = [
  { directory: 'core', name: '@cssearth/core', dependencies: [] },
  { directory: 'renderer', name: '@cssearth/renderer', dependencies: ['@cssearth/core'] },
  { directory: 'bake', name: '@cssearth/bake', dependencies: ['@cssearth/renderer', '@cssearth/core'] },
  { directory: 'telescope-cli', name: '@cssearth/telescope-cli', dependencies: ['@cssearth/bake'] },
];
const site = ['@cssearth/core', '@cssearth/renderer'];
const mount = 'integration/prepared-object-mount/navigable-object-mount.test.mts';
const owners = new Map([[mount, ['bake', 'renderer']], ['packages/bake/src/presentation/depth-partition-contract.test.ts', ['objects']]]);
const renderer = [mount];
const select = (paths: readonly string[] | null) => affectedTests(paths, packages, site, owners);

test('a changed package tests itself and every package that depends on it, and the site when the site imports one', () => {
  assert.deepEqual(select(['packages/core/src/a.ts']), { packages: ['core', 'renderer'], site: true, files: renderer });
  assert.deepEqual(select(['packages/telescope-cli/src/a.mts']), { packages: ['telescope-cli'], site: false, files: [] });
});

test('the offline tools join when they or another tool changed, not when the renderer they import did', () => {
  assert.deepEqual(select(['packages/renderer/src/a.ts']), { packages: ['renderer'], site: true, files: renderer });
  assert.deepEqual(select(['packages/bake/src/a.ts']), { packages: ['bake', 'telescope-cli'], site: false, files: [mount] });
});

test('a pinned schema source outside packages/ selects the package whose test pins it', () => {
  for (const path of ['.github/scripts/checks/check-body-references.mts', 'src/objects/heliosphere/source/ibex/extract.py'])
    assert.deepEqual(select([path]), { packages: ['bake', 'telescope-cli'], site: true, files: [mount] }, path);
  assert.deepEqual(select(['src/objects/heliosphere/source/ibex/other.py']), { packages: [], site: true, files: [] });
});

test('object data and the site test no package; documentation tests nothing', () => {
  assert.deepEqual(select(['src/objects/mars/text.json']), { packages: [], site: true, files: [] });
  assert.deepEqual(select(['docs/ci-cd.md']), { packages: [], site: false, files: [] });
});

test('a push or a shared configuration change tests everything', () => {
  assert.deepEqual(select(null), { packages: 'all', site: true, files: [] });
  assert.deepEqual(select(['pnpm-lock.yaml', 'src/objects/mars/text.json']), { packages: 'all', site: true, files: [] });
});

test('the bake tests that exercise the renderer run on a renderer-only change, though the bake does not join', () => {
  const result = select(['packages/renderer/src/a.ts']);
  assert.deepEqual(result.packages, ['renderer']);
  assert.ok(result.files.includes('integration/prepared-object-mount/navigable-object-mount.test.mts'));
  assert.deepEqual(select(['packages/core/src/a.ts']).files, renderer, 'a package the renderer depends on reaches them too');
  assert.deepEqual(select(['packages/bake/src/a.ts']).files, [mount], 'integration suites also run on a bake-only change');
  assert.deepEqual(select(['docs/ci-cd.md']).files, []);
});

test('every package and integration test is collected in a lane from the root script globs', () => {
  const root = resolve(import.meta.dirname, '../../..');
  const lanes = testLaneFiles(root, JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as unknown, ['test:packages', 'test:site']);
  const collected = new Set([...lanes.packages, ...lanes.site]);
  const tests = globSync(['packages/**/*.test.{ts,mts}', 'integration/**/*.test.{ts,mts}'], { cwd: root });
  assert.ok(tests.length > 0);
  for (const file of tests) assert.ok(collected.has(file), `${file} is not routed to any CI lane`);
  const discovered = testOwners(root);
  for (const file of lanes.packages) assert.ok(discovered.has(file), `${file} is absent from affected routing`);
});

test('directly edited integration suites stay in the packages lane and two changed owners collect once', () => {
  const file = mount;
  assert.deepEqual(select([file]), { packages: [], site: true, files: [file] });
  const result = select(['packages/bake/src/a.ts', 'packages/renderer/src/a.ts']);
  assert.equal(result.files.length, new Set(result.files).size);
  assert.ok(result.files.includes(file));
});

test('foreign package tests follow imports without a handwritten owner map', () => {
  const result = select(['packages/objects/src/format.ts']);
  assert.deepEqual(result.files, ['packages/bake/src/presentation/depth-partition-contract.test.ts']);
});


test('real-tree discovery keeps offline tools bounded for objects and runs them for bake changes', () => {
  const root = resolve(import.meta.dirname, '../../..');
  const workspaces = readdirSync(resolve(root, 'packages'), { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => {
    const manifest = JSON.parse(readFileSync(resolve(root, 'packages', entry.name, 'package.json'), 'utf8'));
    return { directory: entry.name, name: String(manifest.name), dependencies: ['dependencies', 'devDependencies', 'peerDependencies']
      .flatMap(field => Object.keys(manifest[field] ?? {})).filter(name => name.startsWith('@cssearth/')) };
  });
  const discovered = testOwners(root);
  const objects = affectedTests(['packages/objects/src/index.ts'], workspaces, site, discovered);
  assert.notEqual(objects.packages, 'all');
  assert.ok(!objects.packages.includes('bake') && !objects.packages.includes('telescope-cli'));
  const toolTests = [...discovered].filter(([file, imports]) => /^packages\/(bake|telescope-cli)\//u.test(file) && imports.includes('objects'));
  assert.ok(toolTests.length > TOOL_OBJECT_TEST_LIMIT);
  const bounded = new Map(toolTests.slice(0, TOOL_OBJECT_TEST_LIMIT));
  const boundedResult = affectedTests(['packages/objects/src/index.ts'], workspaces, site, bounded, new Map());
  assert.deepEqual(boundedResult.files, [...bounded.keys()].sort(), 'real discovered imports run at the bounded count');
  assert.deepEqual(objects.files.filter(file => /^packages\/(bake|telescope-cli)\//u.test(file)), []);
  const bake = affectedTests(['packages/bake/src/stars/point-field-bank.ts'], workspaces, site, discovered);
  assert.ok(bake.packages.includes('bake') && bake.packages.includes('telescope-cli'));
  assert.ok(bake.files.includes(mount));
  assert.ok(!bake.files.some(file => file.startsWith('packages/bake/')), 'bake runs through its package glob');
  assert.deepEqual(affectedTests(['src/objects/venus/object.json'], workspaces, site, discovered).files, [],
    'eclipse-map uses injected inputs, not object files');
});

test('internal raster and surface geometry changes select bake and its direct consumers', () => {
  for (const file of ['packages/bake/src/baking/polar.ts', 'packages/bake/src/surface-geometry/surface.ts'])
    assert.deepEqual(select([file]).packages, ['bake', 'telescope-cli']);
});

test('editing a renderer fixture that a bake test pins selects that bake test, so the producer check runs before the merge', () => {
  for (const fixture of ['packages/renderer/test/fixtures/leaf-box-placements.json', 'packages/renderer/test/fixtures/shell-facing-levels.json']) {
    const files = affectedTests([fixture], packages, site).files;
    assert.ok(files.some(file => file.startsWith('packages/bake/')), `${fixture} selects no bake test`);
  }
  assert.ok(!affectedTests(['packages/renderer/src/index.ts'], packages, site).files.some(file => file.startsWith('packages/bake/')));
});


test('derived object imports select tools below the limit and keep the gate above it', () => {
  for (const count of [TOOL_OBJECT_TEST_LIMIT, TOOL_OBJECT_TEST_LIMIT + 1]) {
    const imports = new Map(Array.from({ length: count }, (_, index) => [`packages/bake/src/case-${index}.test.ts`, ['objects']]));
    const result = affectedTests(['packages/objects/src/parser.ts'], packages, site, imports, new Map());
    assert.equal(result.files.length, count <= TOOL_OBJECT_TEST_LIMIT ? count : 0);
  }
});
test('source pin ownership is derived from real test literals', () => {
  const root = resolve(import.meta.dirname, '../../..');
  const pins = pinnedSourceOwners(root, testOwners(root));
  assert.ok(pins.get('.github/scripts/checks/check-body-references.mts')?.includes('bake'));
  assert.ok(pins.get('src/objects/heliosphere/source/ibex/extract.py')?.includes('bake'));
});

/** gitignore-style sparse patterns have no brace expansion. Check every script variant. */
function changesSparsePatterns(text: string): string[] {
  const workflow = parse(text);
  const step = workflow.jobs.changes.steps.find((step: { with?: Record<string, unknown> }) => step.with?.['sparse-checkout']);
  assert.ok(step && typeof step.with['sparse-checkout'] === 'string');
  return step.with['sparse-checkout'].trim().split('\n').map((line: string) => line.trim());
}
function expandBraces(pattern: string): string[] {
  const match = /\{([^{}]+)\}/u.exec(pattern);
  return match ? match[1]!.split(',').flatMap(part => expandBraces(pattern.slice(0, match.index) + part + pattern.slice(match.index + match[0].length))) : [pattern];
}
function sparseCoverage(patterns: readonly string[]): string[] {
  const manifest = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'));
  const missing: string[] = [];
  for (const name of ['test:packages', 'test:site']) {
    const script: string = manifest.scripts[name];
    for (const match of script.matchAll(/"([^"\n]+)"/gu)) for (const glob of expandBraces(match[1]!)) {
      // Witness for each expanded glob, including the excluded rendered-page name.
      const witness = glob.replaceAll('**/', 'nested/').replaceAll('!(rendered-page)', 'contract').replaceAll('*', 'sample');
      if (!patterns.some(pattern => matchesGlob(witness, pattern.replace(/^\//u, '')))) missing.push(glob);
    }
  }
  return missing;
}
test('changes sparse patterns cover every quoted root test glob; deleting a pattern is red', () => {
  const patterns = changesSparsePatterns(readFileSync(new URL('../../workflows/universe.yml', import.meta.url), 'utf8'));
  assert.deepEqual(sparseCoverage(patterns), []);
  assert.ok(sparseCoverage(patterns.filter(pattern => pattern !== '/packages/**/*.test.mts')).includes('packages/**/*.test.mts'));
  assert.deepEqual(sparseCoverage(patterns), []);
});
test('real sparse clone preserves objects-only foreign test selection', { timeout: 20000 }, t => {
  const root = resolve(import.meta.dirname, '../../..'), temp = mkdtempSync(resolve(tmpdir(), 'affected-sparse-'));
  const sparse = resolve(temp, 'clone');
  try {
    try {
      execFileSync('git', ['clone', '--quiet', '--no-checkout', '--depth', '1', pathToFileURL(root).href, sparse], { timeout: 15000, stdio: 'pipe' });
    } catch (error) {
      t.skip(`file:// shallow clone unavailable within 15 seconds: ${String(error)}`);
      return;
    }
    const patterns = changesSparsePatterns(readFileSync(resolve(root, '.github/workflows/universe.yml'), 'utf8'));
    execFileSync('git', ['sparse-checkout', 'set', '--no-cone', '--stdin'], { cwd: sparse, input: patterns.join('\n') + '\n', stdio: 'pipe' });
    execFileSync('git', ['read-tree', '-mu', 'HEAD'], { cwd: sparse, stdio: 'pipe' });
    const workspaces = readdirSync(resolve(root, 'packages'), { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => {
      const manifest = JSON.parse(readFileSync(resolve(root, 'packages', entry.name, 'package.json'), 'utf8'));
      return { directory: entry.name, name: String(manifest.name), dependencies: ['dependencies', 'devDependencies', 'peerDependencies']
        .flatMap(field => Object.keys(manifest[field] ?? {})).filter(name => name.startsWith('@cssearth/')) };
    });
    const changed = ['packages/objects/src/index.ts'];
    const fullOwners = testOwners(root), sparseOwners = testOwners(sparse);
    assert.deepEqual([...sparseOwners], [...fullOwners], 'sparse discovery retains every package test owner');
    const full = affectedTests(changed, workspaces, site, fullOwners, pinnedSourceOwners(root, fullOwners));
    const actual = affectedTests(changed, workspaces, site, sparseOwners, pinnedSourceOwners(sparse, sparseOwners));
    assert.ok(full.files.length > 0);
    assert.deepEqual(actual.files, full.files);
    t.diagnostic(`Sparse probe: ${sparseOwners.size} owners; ${actual.files.length} extra files equal full tree: ${actual.files.join(', ')}`);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
