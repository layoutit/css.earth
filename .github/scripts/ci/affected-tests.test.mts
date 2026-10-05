import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, globSync, readdirSync, readFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { parse } from 'yaml';
import { resolve, dirname, matchesGlob } from 'node:path';
import { affectedTests, pinnedSourceOwners, importsChangedObjects, TOOL_OBJECT_TEST_LIMIT, testLaneFiles, testOwners } from './affected-tests.mts';

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
  assert.ok(objects.files.includes('packages/bake/src/presentation/depth-partition-contract.test.ts'));
  assert.ok(objects.files.filter(file => /^packages\/(bake|telescope-cli)\//u.test(file)).length <= toolTests.length);
  const bake = affectedTests(['packages/bake/src/stars/point-field-bank.ts'], workspaces, site, discovered);
  assert.ok(bake.packages.includes('bake') && bake.packages.includes('telescope-cli'));
  assert.ok(bake.files.includes(mount));
  assert.ok(!bake.files.some(file => file.startsWith('packages/bake/')), 'bake runs through its package glob');
  assert.deepEqual(affectedTests(['src/objects/venus/object.json'], workspaces, site, discovered).files,
    ['packages/bake/src/presentation/venus-descriptor-pin.test.mts'], 'only the declared descriptor reader joins');
});

test('objects depth-partition changes retain the bake producer consumer contract above the count limit', () => {
  const files = affectedTests(['packages/objects/src/prepared-data/runtime-validation/depth-partitions.ts'], packages, site).files;
  assert.ok(files.includes('packages/bake/src/presentation/depth-partition-contract.test.ts'));
});

test('foreign fixtures outside test folders select their bake reader', () => {
  const files = affectedTests(['packages/renderer/src/universe/batched-spatial-points.cells.json'], packages, site).files;
  assert.ok(files.includes('packages/bake/src/volume/catalogue-points.test.ts'));
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
// A small repository of the test's own: the host checkout may be a shallow or partial clone that cannot be cloned again,
// and the claim is about the workflow's sparse patterns and the routing, not about the host's history.
function sparseScenario(patterns: readonly string[]) {
  const root = resolve(import.meta.dirname, '../../..'), temp = mkdtempSync(resolve(tmpdir(), 'affected-sparse-'));
  const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const files: Record<string, string> = {
    'package.json': JSON.stringify({ name: 'scenario', scripts: { 'test:packages': manifest.scripts['test:packages'], 'test:site': manifest.scripts['test:site'] } }),
    '.github/workflows/universe.yml': readFileSync(resolve(root, '.github/workflows/universe.yml'), 'utf8'),
    'packages/objects/src/index.ts': 'export const changed = 1;\n',
    'packages/bake/src/pin.test.mts': "import { run } from '@cssearth/objects';\nconst extractor = 'src/objects/heliosphere/source/ibex/extract.py';\nrun(extractor);\n",
    'packages/telescope-cli/src/archive.test.mts': "import { run } from '@cssearth/objects';\nrun();\n",
    'integration/foreign/foreign.test.mts': "import { run } from '@cssearth/objects';\nrun();\n",
    'src/objects/heliosphere/source/ibex/extract.py': 'print(1)\n',
    'src/objects/heliosphere/object.json': '{}\n',
  };
  const git = (...args: string[]) => execFileSync('git', args, { cwd: temp, stdio: 'pipe' });
  for (const [path, text] of Object.entries(files)) { mkdirSync(dirname(resolve(temp, path)), { recursive: true }); writeFileSync(resolve(temp, path), text); }
  git('init', '--quiet'); git('add', '-A');
  git('-c', 'user.name=scenario', '-c', 'user.email=scenario@example.invalid', 'commit', '--quiet', '-m', 'scenario');
  const fullOwners = testOwners(temp);
  return { temp, git, fullOwners, patterns };
}
function applySparse(scenario: ReturnType<typeof sparseScenario>) {
  execFileSync('git', ['sparse-checkout', 'set', '--no-cone', '--stdin'], { cwd: scenario.temp, input: scenario.patterns.join('\n') + '\n', stdio: 'pipe' });
  execFileSync('git', ['read-tree', '-mu', 'HEAD'], { cwd: scenario.temp, stdio: 'pipe' });
  return testOwners(scenario.temp);
}
const scenarioWorkspaces = [
  { directory: 'objects', name: '@cssearth/objects', dependencies: [] },
  { directory: 'bake', name: '@cssearth/bake', dependencies: ['@cssearth/objects'] },
  { directory: 'telescope-cli', name: '@cssearth/telescope-cli', dependencies: ['@cssearth/bake'] },
];
test('sparse checkout of the real workflow patterns preserves objects-only foreign test selection', () => {
  const patterns = changesSparsePatterns(readFileSync(resolve(import.meta.dirname, '../../workflows/universe.yml'), 'utf8'));
  const scenario = sparseScenario(patterns);
  try {
    const sparseOwners = applySparse(scenario);
    const extractor = 'src/objects/heliosphere/source/ibex/extract.py';
    assert.equal(existsSync(resolve(scenario.temp, extractor)), false, 'real workflow patterns omit the pinned extractor');
    assert.ok(scenario.fullOwners.size >= 3);
    assert.deepEqual([...sparseOwners], [...scenario.fullOwners], 'sparse discovery retains every test owner');
    const run = (paths: string[], owners: ReadonlyMap<string, readonly string[]>) =>
      affectedTests(paths, scenarioWorkspaces, site, owners, pinnedSourceOwners(scenario.temp, owners));
    const full = run(['packages/objects/src/index.ts'], scenario.fullOwners), sparse = run(['packages/objects/src/index.ts'], sparseOwners);
    assert.ok(full.files.includes('integration/foreign/foreign.test.mts'));
    assert.deepEqual(sparse, full);
    const fullExtractor = run([extractor], scenario.fullOwners), sparseExtractor = run([extractor], sparseOwners);
    assert.ok(fullExtractor.packages.includes('bake'));
    assert.deepEqual(sparseExtractor, fullExtractor, 'extractor-only routing survives the sparse checkout');
  } finally { rmSync(scenario.temp, { recursive: true, force: true }); }
});
test('the sparse scenario is red when a test glob leaves the patterns or routing stops reading the pins', () => {
  const patterns = changesSparsePatterns(readFileSync(resolve(import.meta.dirname, '../../workflows/universe.yml'), 'utf8'));
  const scenario = sparseScenario(patterns.filter(pattern => !pattern.includes('integration')));
  try {
    assert.notDeepEqual([...applySparse(scenario)], [...scenario.fullOwners], 'dropping the integration pattern loses a foreign owner');
    const pins = pinnedSourceOwners(scenario.temp, scenario.fullOwners);
    assert.deepEqual([...pins.get('src/objects/heliosphere/source/ibex/extract.py') ?? []], ['bake'], 'a pin is read from the test text, not the file');
  } finally { rmSync(scenario.temp, { recursive: true, force: true }); }
});

test('above-limit import discovery distinguishes objects root and subpath entries', () => {
  const changed = ['packages/objects/src/prepared-data/runtime-validation/depth-partitions.ts'];
  assert.ok(importsChangedObjects("import { parsePreparedObjectRuntime } from '@cssearth/objects';", changed));
  assert.ok(!importsChangedObjects("import { x } from '@cssearth/objects/sources';", changed));
  assert.ok(importsChangedObjects("await import('@cssearth/objects/node');", ['packages/objects/src/node/contract.ts']));
});
