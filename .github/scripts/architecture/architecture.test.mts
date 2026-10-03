import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { astroScriptBlocks, astroSpecifiers, moduleSpecifiers } from './astro-imports.mts';
import { compare, createBaseline, decodeBaseline, formatBaseline, isStale, isWorse, measure } from './baseline.mts';
import { cycleClosingEdges, folderCycles, folderGraph, layerOrder, stronglyConnected } from './folders.mts';
import { decodeCruiseResult, missingSources, repositoryFiles, type ImportGraph } from './graph.mts';
import { formatDelta, formatFindings } from './report.mts';
import { declaredPackage, undeclaredImports } from './declared-dependencies.mts';
import { isBroken, objectCodeFiles, REPOSITORY_RULES, repositoryFindings, RETIRED_FOLDERS, retiredFiles } from './repository-rules.mts';
import { evaluateRules, LAYER_RULES } from './rules.mts';
import { builtSource, exportTargets, tsupEntries, workspacePackages, workspaceSource } from './workspaces.mts';
import { packageCycles, packageCycleText } from './package-cycles.mts';
import { isTestPath, zoneOf } from './zones.mts';

/** A small graph from `from -> to` pairs; every named path becomes a file. */
function graph(...pairs: readonly (readonly [string, string] | readonly [string, string, 'type'])[]): ImportGraph {
  const files = new Map<string, { test: boolean; script: boolean; entryHint: boolean; loc: number }>();
  for (const [from, to] of pairs) for (const path of [from, to]) files.set(path, { test: isTestPath(path), script: false, entryHint: false, loc: 1 });
  return { files, edges: pairs.map(([from, to, kind]) => ({ from, to, test: isTestPath(from), symbols: [], typeOnly: kind === 'type' })) };
}

// src/a -> src/b -> src/c -> src/a is one folder cycle; packages/p is a clean leaf.
const TANGLED: readonly (readonly [string, string])[] = [
  ['src/a/one.mts', 'src/b/one.mts'], ['src/a/one.mts', 'src/b/two.mts'], ['src/b/one.mts', 'src/c/one.mts'],
  ['src/c/one.mts', 'src/a/one.mts'], ['src/a/one.mts', 'packages/p/src/index.ts'], ['site/page.mts', 'src/a/one.mts'],
];

test('folders follow the prototype zones', () => {
  const expected: Record<string, string> = {
    'packages/core/src/validate.ts': 'packages/core',
    'packages/bake/src/raster/index.ts': 'packages/bake/src/raster',
    'packages/bake/src/volume/node/index.ts': 'packages/bake/src/volume',
    'packages/bake/src/objects/color/index.ts': 'packages/bake/src/objects/color',
    'packages/bake/src/objects/layers/giant/index.ts': 'packages/bake/src/objects/layers/giant',
    'packages/bake/src/entries.test.ts': 'packages/bake/src(root)',
    'packages/bake/cli/kernel-bank.mts': 'packages/bake/cli',
    'packages/bake/authoring/comet-1p/x.mts': 'packages/bake/authoring/comet-1p',
    'packages/bake/tsup.config.ts': 'packages/bake(root)',
    'labs/nebula/packages/volume-core/src/x.ts': 'labs/nebula-pkg/volume-core',
    'labs/nebula/run.mts': 'labs/nebula(app)',
    'labs/experiments/native-scroll/run.mts': 'labs/experiments',
    'src/renderers/css/navigation/x.ts': 'src/renderers/css/navigation',
    'src/renderers/css/index.ts': 'src/renderers/css(root)',
    'src/preparation/stars/x.ts': 'src/preparation/stars',
    'site/components/X.astro': 'site/components',
    'site/objects.mts': 'site(root)',
    '.github/scripts/ci/x.mts': '.github/scripts/ci',
    '.github/scripts/x.mts': '.github/scripts(root)',
    'netlify/functions/x.mts': 'netlify',
    'astro.config.mts': '(repository root)',
  };
  for (const [file, zone] of Object.entries(expected)) assert.equal(zoneOf(file), zone, file);
  for (const file of ['site/test/x.mts', 'labs/a.test.mts', 'tests/objects/x.mts', 'src/x/fixtures/a.json', 'labs/ci/foo-harness.mts'])
    assert.equal(isTestPath(file), true, file);
  assert.equal(isTestPath('labs/ci/testing-tools.mts'), false);
});

test('a cycle between two bake topics is a folder cycle, not hidden inside the package', () => {
  const folders = folderGraph(graph(['packages/bake/src/raster/a.ts', 'packages/bake/src/scene/index.ts'],
    ['packages/bake/src/scene/b.ts', 'packages/bake/src/raster/index.ts']));
  assert.deepEqual(folderCycles(folders), [['packages/bake/src/raster', 'packages/bake/src/scene']]);
});

test('Astro frontmatter and bundled scripts become import specifiers', () => {
  const source = [
    '---', "import Card from './Card.astro';", "import type { Shape } from '../shape';", "import { a, b } from '../site-thing.mts';", '---',
    '<div />', "<script>import { run } from '../client.mts'; run();</script>",
    "<script is:inline>import('/never.js');</script>", '<script type="application/ld+json">{"import": 1}</script>',
    '<script src="../entry.ts"></script>',
  ].join('\n');
  assert.equal(astroScriptBlocks(source).length, 3, 'frontmatter, one module script and one src script');
  assert.deepEqual(astroSpecifiers(source, 'site/components/X.astro').map(item => [item.specifier, item.typeOnly, item.symbols]), [
    ['./Card.astro', false, ['default']], ['../shape', true, ['Shape']], ['../site-thing.mts', false, ['a', 'b']],
    ['../client.mts', false, ['run']], ['../entry.ts', false, []],
  ]);
});

test('a dynamic import of a no-expression template literal is a specifier; a computed one is not', () => {
  const found = moduleSpecifiers("await import(`./a.mts`);\nawait import('./b.mts');\nconst name = './c.mts'; await import(name);\nawait import(`./${name}`);\n", 'site/x.ts');
  assert.deepEqual(found.map(item => [item.specifier, item.typeOnly, item.symbols]), [['./a.mts', false, ['(dynamic)']], ['./b.mts', false, ['(dynamic)']]]);
  assert.deepEqual(astroSpecifiers("---\nconst late = await import(`../late.mts`);\n---\n<script>import(`../client.mts`);</script>", 'site/X.astro')
    .map(item => item.specifier), ['../late.mts', '../client.mts']);
});

test('type-level imports are import specifiers: typeof import() and import().Name', () => {
  const found = moduleSpecifiers("type A = typeof import('@x/a');\ntype B = import('../b.ts').Shape<number>;\nlet c: import('./c').Deep.Name;\n", 'site/x.ts');
  assert.deepEqual(found.map(item => [item.specifier, item.typeOnly, item.symbols]), [
    ['@x/a', true, ['*']], ['../b.ts', true, ['Shape']], ['./c', true, ['Deep']],
  ]);
  assert.deepEqual(astroSpecifiers("---\ntype P = typeof import('../p.mts');\n---\n", 'site/X.astro').map(item => item.specifier), ['../p.mts']);
});

test('tsup entries are read from each config form this repository uses, and anything else is refused', () => {
  assert.deepEqual([...tsupEntries("export default defineConfig({ entry: ['src/index.ts'] })", 'a')], [['index', 'src/index.ts']]);
  assert.deepEqual([...tsupEntries("export default defineConfig({ entry: ['src/a.ts', 'src/node/b.ts'] })", 'a')], [['a', 'src/a.ts'], ['node/b', 'src/node/b.ts']]);
  assert.deepEqual([...tsupEntries("export default defineConfig({ entry: { index: 'src/index.ts', 'node/index': './src/node/index.ts' } })", 'b')],
    [['index', 'src/index.ts'], ['node/index', 'src/node/index.ts']]);
  assert.deepEqual([...tsupEntries("const entry: Record<string, string> = { 'objects/color': 'src/objects/color/index.ts' };\nexport default defineConfig({ entry })", 'c')],
    [['objects/color', 'src/objects/color/index.ts']]);
  assert.deepEqual([...tsupEntries("export default { entry: { 'platform/orbit': fileURLToPath(new URL('./src/navigation/orbit.ts', import.meta.url)) } }", 'd')],
    [['platform/orbit', 'src/navigation/orbit.ts']]);
  assert.throws(() => tsupEntries("export default { entry: glob('src/*.ts') }", 'e'), /cannot read the tsup entry/u);
  assert.throws(() => tsupEntries('export default {}', 'f'), /expected one tsup `entry`/u);
});

test('a dist target resolves to the source of the tsup entry that builds it, through the package exports', () => {
  const [bake, lab] = workspacePackages(new Map([
    ['packages/bake/package.json', { manifest: { name: '@x/bake', exports: {
      './volume/node': { types: './dist/volume/node.d.ts', import: './dist/volume/node.js' },
      './platform/*': { types: './dist/platform/*.d.ts' },
    } }, tsup: "const entry = { 'volume/node': 'src/volume/node/index.ts', 'platform/orbit': 'src/nav/orbit.ts' };\nexport default { entry };" }],
    ['labs/p/package.json', { manifest: { name: '@x/lab', exports: { './api': './src/api.ts' } } }],
  ]));
  const workspaces = [bake!, lab!];
  const tracked = new Set(['packages/bake/src/volume/node/index.ts', 'packages/bake/src/nav/orbit.ts', 'labs/p/src/api.ts']);
  assert.deepEqual(builtSource('packages/bake/dist/volume/node.d.ts', workspaces), { source: 'packages/bake/src/volume/node/index.ts' });
  assert.deepEqual(builtSource('packages/bake/dist/volume/node.js', workspaces), { source: 'packages/bake/src/volume/node/index.ts' });
  assert.match(JSON.stringify(builtSource('packages/bake/dist/types/volume/node/index.d.ts', workspaces)), /not the output of a tsup entry/u);
  assert.equal(builtSource('packages/bake/src/volume/node/index.ts', workspaces), undefined);
  assert.deepEqual(workspaceSource('@x/bake/volume/node', bake!, workspaces, tracked), { source: 'packages/bake/src/volume/node/index.ts' });
  assert.deepEqual(workspaceSource('@x/bake/platform/orbit', bake!, workspaces, tracked), { source: 'packages/bake/src/nav/orbit.ts' });
  assert.deepEqual(workspaceSource('@x/lab/api', lab!, workspaces, tracked), { source: 'labs/p/src/api.ts' });
  assert.match(JSON.stringify(workspaceSource('@x/bake', bake!, workspaces, tracked)), /not exported/u, 'bake has no main entry');
  assert.deepEqual([...exportTargets({ types: 'dist/index.d.ts', main: 'dist/index.js' }, 'p')], [['.', 'dist/index.d.ts']]);
  assert.deepEqual([...exportTargets({ exports: { types: './dist/index.d.ts', import: './dist/index.js' } }, 'p')], [['.', './dist/index.d.ts']]);
});

test('strongly connected folders, the greedy layer order and the edges that close each cycle', () => {
  const folders = folderGraph(graph(...TANGLED));
  assert.deepEqual(folderCycles(folders), [['src/a', 'src/b', 'src/c']]);
  assert.deepEqual(stronglyConnected(['x', 'y', 'z'], [{ from: 'x', to: 'y' }, { from: 'y', to: 'x' }]).map(item => item.join()), ['x,y', 'z']);
  const order = layerOrder(['src/a', 'src/b', 'src/c'], folders.edges);
  assert.deepEqual(order, ['src/a', 'src/b', 'src/c'], 'the heavier a -> b edge (2 imports) points down');
  assert.deepEqual(cycleClosingEdges(folders.edges, folderCycles(folders), order).map(edge => `${edge.from}>${edge.to}`), ['src/c>src/a']);
});

test('layer rules name each forbidden file import once, and tests are exempt except in packages and for application imports', () => {
  const violations = evaluateRules(graph(
    ['packages/p/src/a.ts', 'src/platform/x.mts'], ['packages/p/src/a.test.ts', 'labs/helper.mts'],
    ['src/renderers/css/x.ts', 'labs/prepared/y.mts'], ['src/renderers/css/x.ts', 'labs/prepared/y.mts'],
    ['site/a.mts', 'packages/bake/src/stars/index.ts'], ['site/b.mts', 'packages/bake/src/prepared/y.mts', 'type'],
    ['packages/renderer/src/stars/bank.ts', 'packages/bake/src/stars/index.ts', 'type'], ['packages/renderer/src/stars/bank.test.ts', 'packages/bake/src/stars/index.ts'],
    ['packages/renderer/src/stars/bank.ts', 'packages/core/src/index.ts'],
    ['site/c.mts', 'packages/telescope-cli/src/query.mts'], ['packages/renderer/src/sky/d.ts', 'packages/telescope-cli/src/archives/programs.mts', 'type'],
    ['packages/renderer/src/sky/d.test.ts', 'packages/telescope-cli/src/query.mts'],
    ['labs/objects/o.mts', 'site/objects.mts'], ['astro.config.mts', 'labs/prepare/p.mts'],
    ['netlify/functions/f.mts', 'site/find.mts'], ['labs/nebula/run.mts', 'labs/nebula/x.mts'],
    ['labs/ci/x.mts', '.github/scripts/ci/y.mts'], ['.github/scripts/ci/y.mts', 'labs/ci/z.mts'], ['.github/scripts/ci/y.mts', 'packages/core/src/validate.ts'],
    ['site/build/prepare/p.mts', 'packages/bake/src/stars/index.ts'], ['site/e.mts', 'site/build/prepare/p.mts', 'type'], ['site/test/e.test.mts', 'site/build/prepare/p.mts'],
    ['astro.config.mts', 'site/build/source-maps.mts'], ['packages/renderer/src/f.ts', 'site/build/prepare/p.mts', 'type'], ['packages/bake/src/g.ts', 'site/build/prepare/p.mts'],
  ));
  const pairs = (rule: string) => (violations.get(rule) ?? []).map(item => `${item.from}>${item.to}`);
  assert.deepEqual(pairs('packages-import-only-packages'), ['packages/bake/src/g.ts>site/build/prepare/p.mts', 'packages/p/src/a.test.ts>labs/helper.mts',
    'packages/p/src/a.ts>src/platform/x.mts', 'packages/renderer/src/f.ts>site/build/prepare/p.mts'], 'no package reaches site/build, not even the bake or a renderer type');
  assert.deepEqual(pairs('nothing-imports-applications'), ['.github/scripts/ci/y.mts>labs/ci/z.mts', 'labs/ci/x.mts>.github/scripts/ci/y.mts', 'labs/objects/o.mts>site/objects.mts', 'packages/bake/src/g.ts>site/build/prepare/p.mts',
    'packages/p/src/a.test.ts>labs/helper.mts', 'packages/renderer/src/f.ts>site/build/prepare/p.mts', 'src/renderers/css/x.ts>labs/prepared/y.mts'], 'CI scripts in .github/ are an application tree too');
  assert.deepEqual(pairs('runtime-imports-no-preparation'), [
    'packages/renderer/src/sky/d.ts>packages/telescope-cli/src/archives/programs.mts', 'packages/renderer/src/stars/bank.ts>packages/bake/src/stars/index.ts',
    'site/a.mts>packages/bake/src/stars/index.ts', 'site/b.mts>packages/bake/src/prepared/y.mts', 'site/c.mts>packages/telescope-cli/src/query.mts',
  ], 'the renderer package is runtime, type-only imports count, neither runtime owner reaches bake or the telescope command, tests may, and site/build is build-time');
  assert.deepEqual(pairs('runtime-imports-no-site-build'), ['site/e.mts>site/build/prepare/p.mts'],
    'the runtime never imports site-owned preparation, even for a type; tests and astro.config may');
  assert.deepEqual([...violations.keys()], LAYER_RULES.map(rule => rule.id));
});

test('nothing imports a package command entry: another entry, package code and tests, type-only imports included', () => {
  const violations = evaluateRules(graph(
    ['packages/bake/cli/fit-epic-limb.mts', 'packages/bake/cli/kernel-bank.mts'],
    ['packages/bake/src/photometry/limb.ts', 'packages/bake/cli/fit-epic-limb.mts', 'type'],
    ['packages/bake/src/photometry/limb.test.mts', 'packages/telescope-cli/cli/run.mts'],
    ['site/build/x.mts', 'packages/bake/cli/kernel-bank.mts'],
    ['packages/bake/cli/kernel-bank.mts', 'packages/bake/src/objects/cameras/index.ts'],
    ['packages/bake/src/cli/x.ts', 'packages/bake/src/raster/index.ts'],
    ['packages/astronomy/cli/generate-series.mts', 'packages/astronomy/cli/lib/sources.mts'],
    ['tests/astronomy/source.test.mts', 'packages/astronomy/cli/scene-ephemeris.mts'],
    ['packages/astronomy/cli/generate-series.mts', 'packages/astronomy/cli/fetch-fixtures.mts'],
  ));
  assert.deepEqual((violations.get('nothing-imports-cli-entries') ?? []).map(item => `${item.from}>${item.to}`), [
    'packages/astronomy/cli/generate-series.mts>packages/astronomy/cli/fetch-fixtures.mts',
    'packages/bake/cli/fit-epic-limb.mts>packages/bake/cli/kernel-bank.mts',
    'packages/bake/src/photometry/limb.test.mts>packages/telescope-cli/cli/run.mts',
    'packages/bake/src/photometry/limb.ts>packages/bake/cli/fit-epic-limb.mts',
    'site/build/x.mts>packages/bake/cli/kernel-bank.mts',
  ], 'an entry may import libraries; a folder named cli inside src is not an entry folder');
});

test('packages/telescope never imports @cssearth/bake: production, tests and type-only imports', () => {
  const violations = evaluateRules(graph(
    ['packages/telescope/src/archive.ts', 'packages/bake/src/raster/index.ts'],
    ['packages/telescope/src/archive.test.ts', 'packages/bake/src/volume/index.ts'],
    ['packages/telescope/src/node/fetch.ts', 'packages/bake/src/objects/color/index.ts', 'type'],
    ['packages/telescope/src/archive.ts', 'packages/core/src/index.ts'], ['packages/telescope-cli/src/run.mts', 'packages/bake/src/raster/index.ts'],
    ['packages/bake/src/raster/index.ts', 'packages/telescope/src/index.ts'],
  ));
  assert.deepEqual((violations.get('telescope-imports-no-bake') ?? []).map(item => `${item.from}>${item.to}`), [
    'packages/telescope/src/archive.test.ts>packages/bake/src/volume/index.ts',
    'packages/telescope/src/archive.ts>packages/bake/src/raster/index.ts',
    'packages/telescope/src/node/fetch.ts>packages/bake/src/objects/color/index.ts',
  ], 'the telescope CLI and bake itself may use the telescope library');
});

test('bake nebula/ and objects/ never import each other, in either direction', () => {
  const violations = evaluateRules(graph(
    ['packages/bake/src/nebula/frame.ts', 'packages/bake/src/objects/color/index.ts'],
    ['packages/bake/src/objects/raster/lane.test.ts', 'packages/bake/src/nebula/index.ts', 'type'],
    ['packages/bake/src/nebula/index.ts', 'packages/bake/src/nebula/objects.ts'], ['packages/bake/src/nebula/frame.ts', 'packages/objects/src/index.ts'],
    ['packages/bake/src/nebula/frame.ts', 'packages/bake/src/volume/index.ts'], ['packages/bake/src/objects/color/index.ts', 'packages/bake/src/raster/index.ts'],
  ));
  assert.deepEqual((violations.get('bake-nebula-and-objects-independent') ?? []).map(item => `${item.from}>${item.to}`), [
    'packages/bake/src/nebula/frame.ts>packages/bake/src/objects/color/index.ts',
    'packages/bake/src/objects/raster/lane.test.ts>packages/bake/src/nebula/index.ts',
  ], 'nebula/objects.ts and the @cssearth/objects package are not bake objects/');
});

test('the baseline format excludes package cycles, including a retired key', () => {
  const baseline = createBaseline(measure(graph()));
  assert.equal(Object.hasOwn(baseline, 'packageCycles'), false);
  const decoded = decodeBaseline({ ...baseline, packageCycles: [{ nodes: ['@cssearth/a'], scc: ['@cssearth/a'] }] });
  assert.equal(Object.hasOwn(decoded, 'packageCycles'), false);
  const encoded = formatBaseline(decoded);
  assert.doesNotMatch(encoded, /packageCycles/u);
  assert.deepEqual(decodeBaseline(JSON.parse(encoded)), baseline);
});

test('external JSON is validated before use', () => {
  assert.throws(() => decodeBaseline({ schema: 'other' }), /schema/u);
  assert.throws(() => decodeBaseline({ schema: 'cssearth-architecture-baseline@1', cycles: { largestCycle: 1.5, layerOrder: [], cycleClosingEdges: [] }, rules: {} }), /whole number/u);
  assert.throws(() => decodeBaseline({ schema: 'cssearth-architecture-baseline@1', cycles: { largestCycle: 1, layerOrder: [], cycleClosingEdges: [] }, rules: { r: [{ from: 'a' }] } }), /to must be a string/u);
  assert.throws(() => decodeCruiseResult({ modules: [{ source: 'a.ts', dependencies: [{ module: './b' }] }] }), /resolved must be a string/u);
  assert.deepEqual(decodeCruiseResult({ modules: [{ source: 'a.ts', dependencies: [{ module: './b', resolved: 'b.ts', coreModule: false }] }] }),
    [{ source: 'a.ts', coreModule: false, couldNotResolve: false, dependencies: [{ module: './b', resolved: 'b.ts', coreModule: false, couldNotResolve: false }] }]);
});

test('a source file missing from disk or from the cruise makes the graph incomplete', () => {
  const expected = ['src/a.mts', 'src/b.ts', 'src/c.json', 'src/objects/x/prepared/p.mts', 'site/X.astro', 'src/gone.mts'];
  assert.deepEqual(missingSources(expected, new Set(['src/a.mts', 'src/gone.mts']), path => path !== 'src/gone.mts'), ['src/b.ts', 'src/gone.mts'],
    'JSON, Astro and excluded prepared output are not cruised sources');
});

test('a repository rule has no baseline: any finding breaks the check and is printed', () => {
  const rule = { id: 'no-x', description: 'no file is named x', check: (_root: string, files: readonly string[]) => files.filter(file => file.endsWith('/x')) };
  const clean = repositoryFindings('/unused', ['a/y'], [rule]), found = repositoryFindings('/unused', ['a/y', 'a/x'], [rule]);
  assert.equal(isBroken(clean), false);
  assert.equal(isBroken(found), true);
  assert.doesNotMatch(formatFindings(clean), /broken/u);
  assert.match(formatFindings(found), /no-x: 1 findings[\s\S]*Repository rules broken:[\s\S]*\n {4}a\/x$/u);
  assert.deepEqual(REPOSITORY_RULES.map(item => item.id), ['preparation-without-renderer', 'workspace-package-cycles', 'integration-owners', 'retired-folders', 'objects-hold-data', 'nebula-boundaries', 'declared-dependencies', 'pre-install-imports'], 'package cycles, retired folders, data-only object packages, the nebula boundaries, declared workspace dependencies and pre-install imports are the repository rules');
});

test('a script or Astro module inside an object package is a finding; its data is not', () => {
  assert.deepEqual(objectCodeFiles(['src/objects/mars/object.json', 'src/objects/mars/README.md', 'src/objects/mars/runtime/definition.mjs',
    'src/objects/mars/site/Card.astro', 'src/objects/mars/x.d.ts', 'src/platform/object-runtime.mts', 'site/objects.mts', 'src/objects/earth/paged-ellipsoid-scene.test.mts',
    'src/objects/europa/scientific-focus.test.mts', 'src/objects/earth/fixtures/polar-caps.mts']),
  ['src/objects/mars/runtime/definition.mjs: object packages hold data only; put code in packages/ or site/',
    'src/objects/mars/site/Card.astro: object packages hold data only; put code in packages/ or site/',
    'src/objects/mars/x.d.ts: object packages hold data only; put code in packages/ or site/']);
});

test('a file under a retired folder is a finding; a sibling folder with a longer name is not', () => {
  assert.deepEqual(retiredFiles(['old/deep/x.json', 'old-labels/x.mts', 'old', 'other/old/x.mts'], ['old']),
    ['old/deep/x.json: old/ is retired; put the file in the folder its code moved to',
      'other/old/x.mts: old/ is retired; put the file in the folder its code moved to']);
  assert.ok(RETIRED_FOLDERS.every(folder => !folder.includes('/') && !folder.endsWith('/')), 'retired folders are path segments, named without a trailing slash');
  assert.deepEqual([...RETIRED_FOLDERS].sort(), RETIRED_FOLDERS, 'kept sorted');
});

test('the repository check fails when any file is added under tools/, tracked or not, and passes without one', () => {
  const rule = REPOSITORY_RULES.find(item => item.id === 'retired-folders');
  assert.ok(rule, 'the retired-folders rule is registered');
  assert.deepEqual(RETIRED_FOLDERS, ['tools'], 'tools/ is retired as a whole, not folder by folder');
  const root = mkdtempSync(join(tmpdir(), 'retired-tools-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: root });
    mkdirSync(join(root, 'labs'));
    writeFileSync(join(root, 'labs', 'kept.mts'), 'export {};\n');
    const findings = () => repositoryFindings(root, repositoryFiles(root), [rule]);
    assert.equal(isBroken(findings()), false, 'a tree without tools/ is clean');
    for (const path of ['tools/new.mts', 'tools/deep/nested/data.json', 'tools/README.md', 'tools/objects/tsconfig.json', 'packages/astronomy/tools/new.mts']) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), '{}\n');
      assert.equal(isBroken(findings()), true, `${path} added (untracked) must fail the check`);
      assert.match([...findings().values()].flat().join('\n'), new RegExp(`${path.replace(/[.]/gu, '\\.')}: tools/ is retired`, 'u'));
      rmSync(join(root, path.startsWith('tools/') ? 'tools' : 'packages'), { recursive: true });
      assert.equal(isBroken(findings()), false, `removing ${path} clears it`);
    }
    mkdirSync(join(root, 'tools'));
    writeFileSync(join(root, 'tools', 'tracked.mts'), 'export {};\n');
    execFileSync('git', ['add', '-A'], { cwd: root });
    assert.equal(isBroken(findings()), true, 'a tracked file under tools/ fails too');
  } finally { rmSync(root, { recursive: true, force: true }); }
  assert.deepEqual(retiredFiles(['packages/bake/tools/x.mts', 'toolsmith/x.mts', 'labs/tools/x.mts']),
    ['packages/bake/tools/x.mts: tools/ is retired; put the file in the folder its code moved to',
      'labs/tools/x.mts: tools/ is retired; put the file in the folder its code moved to'],
    'tools/ is retired at any depth');
});

test('a packages/* file may import another workspace package only when its package.json declares it', () => {
  const packages = [
    declaredPackage('packages/cli/package.json', { name: '@x/cli', dependencies: { '@x/lib': 'workspace:*' }, devDependencies: { '@x/fixtures': 'workspace:*' } }),
    declaredPackage('packages/lib/package.json', { name: '@x/lib' }),
    declaredPackage('packages/fixtures/package.json', { name: '@x/fixtures' }),
    declaredPackage('labs/nebula/packages/lab/package.json', { name: '@x/lab' }),
  ];
  const sources = new Map([
    ['packages/cli/src/run.mts', "import { a } from '@x/lib/sub';\nimport '@x/cli/self';\nimport fixture from '@x/fixtures';\nimport sharp from 'sharp';"],
    ['packages/cli/src/run.test.mts', "import('@x/lab');\ntype T = import('@x/lab').T;"],
    ['packages/lib/src/index.ts', "export * from '@x/fixtures';"],
    ['labs/nebula/packages/lab/src/x.mts', "import '@x/lib';"],
    ['site/x.mts', "import '@x/lib';"],
  ]);
  assert.deepEqual(undeclaredImports(packages, sources), [
    'packages/cli/src/run.test.mts: imports @x/lab, which packages/cli/package.json does not declare',
    'packages/lib/src/index.ts: imports @x/fixtures, which packages/lib/package.json does not declare',
  ], 'any dependency field declares; self, npm and non-packages/* importers are out of scope; a file reports each package once');
  assert.throws(() => declaredPackage('packages/bad/package.json', { name: '@x/bad', dependencies: [] }), /dependencies is not an object/u);
});

test('a CommonJS require and a TypeScript import-equals of an undeclared workspace package are findings too', () => {
  const packages = [declaredPackage('packages/cli/package.json', { name: '@x/cli' }), declaredPackage('packages/lib/package.json', { name: '@x/lib' }),
    declaredPackage('packages/core/package.json', { name: '@x/core' })];
  assert.deepEqual(undeclaredImports(packages, new Map([
    ['packages/cli/src/a.cts', "const lib = require('@x/lib/sub');"],
    ['packages/cli/src/b.ts', "import core = require('@x/core');\nconst n = require(name);"],
  ])), [
    'packages/cli/src/a.cts: imports @x/lib, which packages/cli/package.json does not declare',
    'packages/cli/src/b.ts: imports @x/core, which packages/cli/package.json does not declare',
  ], 'a computed require names no package');
});

test('outside tests, a tsup-built package must ship a workspace package it imports; one run from source may list it in devDependencies', () => {
  const manifest = (name: string) => ({ name, dependencies: { '@x/core': 'workspace:*' }, devDependencies: { '@x/catalog': 'workspace:*' } });
  const packages = [declaredPackage('packages/renderer/package.json', manifest('@x/renderer'), true),
    declaredPackage('packages/telescope-cli/package.json', manifest('@x/telescope-cli'), false),
    declaredPackage('packages/core/package.json', { name: '@x/core' }, true), declaredPackage('packages/catalog/package.json', { name: '@x/catalog' }, true)];
  const text = "import { a } from '@x/core';\nimport type { B } from '@x/catalog';";
  assert.deepEqual(undeclaredImports(packages, new Map([
    ['packages/renderer/src/universe/a.ts', text], ['packages/renderer/src/universe/a.test.ts', text], ['packages/renderer/tests/support.ts', text],
    ['packages/telescope-cli/src/run.mts', text],
  ])), ['packages/renderer/src/universe/a.ts: imports @x/catalog, which packages/renderer/package.json lists only in devDependencies although tsup builds this package'],
  'type-only imports count, since dist/*.d.ts keeps them; tests and the source-run package are exempt');
});

test('retired root tests and dependent integration owners fail without a baseline', () => {
  const root = mkdtempSync(join(tmpdir(), 'integration-owners-'));
  const write = (path: string, text: string) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); };
  const rules = REPOSITORY_RULES.filter(rule => ['retired-folders', 'integration-owners'].includes(rule.id));
  assert.equal(rules.length, 2, 'both rules must be wired into CI');
  const broken = () => isBroken(repositoryFindings(root, repositoryFiles(root), rules));
  try {
    execFileSync('git', ['init', '-q'], { cwd: root });
    write('packages/a/package.json', '{"name":"@x/a"}');
    write('packages/b/package.json', '{"name":"@x/b"}');
    write('packages/c/package.json', '{"name":"@x/c","dependencies":{"@x/a":"workspace:*"}}');
    write('integration/example.test.mts', "import '@x/a'; import '@x/b';\n");
    assert.equal(broken(), false, 'independent owners are green');
    write('tests/new.mts', 'export {};');
    assert.equal(broken(), true, 'an untracked root tests file is red');
    execFileSync('git', ['add', 'tests/new.mts'], { cwd: root });
    assert.equal(broken(), true, 'a tracked root tests file is red');
    assert.equal(isBroken(repositoryFindings(root, repositoryFiles(root), rules.filter(rule => rule.id !== 'retired-folders'))), false, 'disabling retirement makes the mutation green');
    rmSync(join(root, 'tests'), { recursive: true });
    assert.equal(broken(), true, 'a tracked tests file missing from disk is still red');
    execFileSync('git', ['rm', '-f', 'tests/new.mts'], { cwd: root });
    mkdirSync(join(root, 'tests'));
    assert.equal(broken(), true, 'an empty root tests directory is red too');
    rmSync(join(root, 'tests'), { recursive: true });
    write('integration/example.test.mts', "import '@x/a';\n");
    assert.equal(broken(), true, 'one owner is red');
    assert.equal(isBroken(repositoryFindings(root, repositoryFiles(root), rules.filter(rule => rule.id !== 'integration-owners'))), false, 'disabling integration makes the mutation green');
    write('packages/b/package.json', '{"name":"@x/b","dependencies":{"@x/c":"workspace:*"}}');
    write('integration/example.test.mts', "import '@x/a'; import '@x/b';\n");
    assert.equal(broken(), true, 'a transitive dependency is red');
    write('packages/b/package.json', '{"name":"@x/b"}');
    assert.equal(broken(), false, 'restoring independence clears the finding');
    write('labs/nebula/packages/lab/package.json', '{"name":"@x/lab","dependencies":{"@x/a":"workspace:*"}}');
    write('integration/example.test.mts', "import '@x/a'; import '@x/lab';\n");
    assert.equal(broken(), true, 'a lab package maps to its labs owner and dependency graph');
    write('packages/renderer/package.json', '{"name":"@cssearth/renderer"}');
    write('packages/bake/package.json', '{"name":"@cssearth/bake","dependencies":{"@cssearth/renderer":"workspace:*"}}');
    write('integration/renderer-bake/conformance.test.ts', "import '@cssearth/bake'; import '@cssearth/renderer';\n");
    write('integration/example.test.mts', "import '@x/a'; import '@x/b';\n");
    assert.equal(broken(), false, 'the named renderer-bake conformance boundary permits dependent owners');
    write('integration/renderer-bake/conformance.test.ts', "import '@cssearth/renderer';\n");
    assert.equal(broken(), true, 'removing either conformance owner is red');
    rmSync(join(root, 'integration/renderer-bake'), { recursive: true });
    write('site/a.mts', 'export {};');
    write('src/a.mts', 'export {};');
    write('integration/example.test.mts', "import '../site/a.mts'; import '../src/a.mts';\n");
    assert.equal(broken(), false, 'relative application imports count as owners');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('package-only and application-entry layers fail without a baseline, including updates', () => {
  const baseline = createBaseline(measure(graph()));
  for (const id of ['packages-import-only-packages', 'nothing-imports-applications']) {
    const rule = LAYER_RULES.find(rule => rule.id === id);
    assert.ok(rule?.noBaseline, `${id} must have no baseline`);
    const measurement = measure(graph(['packages/core/src/x.ts', 'site/x.mts']), [rule]);
    assert.equal(Object.hasOwn(baseline.rules, id), false);
    assert.equal(isWorse(compare(baseline, measurement)), true, `${id} finding is red`);
    assert.match(formatDelta(compare(baseline, measurement)), new RegExp(`${id}: 1 file-to-file imports \\(no baseline; any finding fails\\)`, 'u'));
    assert.throws(() => createBaseline(measurement), /Cannot baseline/u, 'update cannot bless the finding');
    const stale = { ...baseline, rules: { ...baseline.rules, [id]: measurement.rules.get(id)! } };
    assert.equal(isWorse(compare(stale, measurement)), true, 'a stale recorded violation is no exemption');
    assert.equal(Object.hasOwn(decodeBaseline(stale).rules, id), false, 'decoding drops stale no-baseline keys');
    assert.deepEqual(compare(decodeBaseline(stale), measure(graph())).unknownRules, [], 'no stale unknown-rule keys');
    const mutation = measure(graph(['packages/core/src/x.ts', 'site/x.mts']), [{ ...rule, noBaseline: false }]);
    assert.equal(isWorse(compare(createBaseline(mutation), mutation)), false, 'disabling no-baseline lets the mutation bless the violation');
  }
});

test('nothing-imports-applications covers tests and every non-application tree, with one named exception', () => {
  const rule = LAYER_RULES.find(item => item.id === 'nothing-imports-applications')!;
  const found = (...pairs: readonly (readonly [string, string])[]) => measure(graph(...pairs), [rule]).rules.get(rule.id)!.length;
  for (const from of ['src/platform/x.mts', 'src/platform/x.test.mts', 'integration/x.test.mts', 'packages/core/src/x.test.ts', 'labs/other/x.test.mts'])
    assert.equal(found([from, 'site/runtime-policy.mts']), 1, `${from} -> site/ fails`);
  assert.equal(found(['src/platform/x.mts', 'labs/nebula/y.mts']), 1, 'src -> labs fails');
  assert.equal(found(['src/platform/x.mts', '.github/scripts/y.mts']), 1, 'src -> .github fails');
  assert.equal(found(['labs/performance/source-maps.test.mts', 'site/build/source-maps.mts']), 0, 'the named exception passes');
  assert.equal(found(['labs/performance/other.test.mts', 'site/build/source-maps.mts']), 1, 'a sibling test does not inherit it');
  assert.equal(found(['labs/performance/source-maps.test.mts', 'site/build/other.mts']), 1, 'the exception is one file pair');
  const mutation = measure(graph(['src/platform/x.test.mts', 'site/a.mts']), [{ ...rule, includeTests: false }]);
  assert.equal(mutation.rules.get(rule.id)!.length, 0, 'dropping includeTests hides a test import, so the test above is what guards it');
});

test('recorded cycle-closing folder edges pass but every new closing edge fails', () => {
  const original = measure(graph(...TANGLED)), baseline = createBaseline(original);
  assert.equal(isWorse(compare(baseline, original)), false);
  const heavier = measure(graph(...TANGLED, ['src/c/two.mts', 'src/a/one.mts']));
  assert.deepEqual(createBaseline(heavier, baseline).cycles, baseline.cycles, 'tightening keeps recorded order and never raises existing import counts');
  const lighter = { ...original, folderEdges: original.folderEdges.map(edge => ({ ...edge, imports: 0.5 })) };
  assert.deepEqual(createBaseline(lighter, baseline).cycles, baseline.cycles, 'retained edge bytes survive import-count changes in either direction');
  const extended = measure(graph(...TANGLED, ['src/c/two.mts', 'src/b/two.mts']));
  const delta = compare(baseline, extended);
  assert.deepEqual(delta.cycleClosing.added.map(({ from, to }) => [from, to]), [['src/c', 'src/b']]);
  assert.equal(delta.largestCycle.now, delta.largestCycle.baseline, 'same SCC size cannot conceal a new closing edge');
  assert.equal(isWorse(delta), true);
});

test('manifest cycles fail without a baseline across all dependency fields', () => {
  const root = mkdtempSync(join(tmpdir(), 'package-cycles-'));
  const write = (id: string, fields: Record<string, unknown> = {}) => {
    const path = join(root, 'packages', id, 'package.json');
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify({ name: `@cssearth/${id}`, ...fields }));
  };
  const rule = REPOSITORY_RULES.find(rule => rule.id === 'workspace-package-cycles');
  assert.ok(rule, 'cycle detection must be wired into the no-baseline repository checks');
  const findings = () => repositoryFindings(root, repositoryFiles(root), [rule]);
  try {
    execFileSync('git', ['init', '-q'], { cwd: root });
    write('a', { dependencies: { '@cssearth/b': 'workspace:*' } });
    write('b', { devDependencies: { '@cssearth/a': 'workspace:*' }, peerDependencies: { '@cssearth/c': 'workspace:*' } });
    write('c', { dependencies: { '@cssearth/a': 'workspace:*' } });
    assert.deepEqual(packageCycles(root, repositoryFiles(root)).map(packageCycleText), [
      '@cssearth/a -> @cssearth/b -> @cssearth/c -> @cssearth/a', '@cssearth/a -> @cssearth/b -> @cssearth/a',
    ]);
    assert.equal(isBroken(findings()), true, 'any cycle fails without reading or creating a baseline');
    assert.match(formatFindings(findings()), /workspace-package-cycles: 2 findings \(no baseline; any finding fails\)/u);
    assert.match(formatFindings(findings()), /workspace package cycle: @cssearth\/a -> @cssearth\/b -> @cssearth\/a/u);
    assert.equal(isBroken(repositoryFindings(root, repositoryFiles(root), [])), false, 'disabling the rule makes the mutation green');
    write('b');
    assert.equal(isBroken(findings()), false, 'removing the cycle clears the finding');
    write('a', { peerDependencies: { '@cssearth/a': 'workspace:*' } });
    assert.equal(isBroken(findings()), true, 'self-dependency is a cycle');
    write('a', { dependencies: [] });
    assert.throws(findings, /dependencies/u, 'malformed fields fail rather than hiding edges');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
