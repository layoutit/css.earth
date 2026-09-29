import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { astroScriptBlocks, astroSpecifiers, moduleSpecifiers } from './astro-imports.mts';
import { compare, createBaseline, decodeBaseline, formatBaseline, isStale, isWorse, likelyRenames, measure } from './baseline.mts';
import { cycleClosingEdges, folderCycles, folderGraph, layerOrder, stronglyConnected } from './folders.mts';
import { decodeCruiseResult, missingSources, repositoryFiles, type ImportGraph } from './graph.mts';
import { readCiSteps } from '../ci/check-ci.mts';
import { formatDelta, formatFindings } from './report.mts';
import { declaredPackage, undeclaredImports } from './declared-dependencies.mts';
import { isBroken, objectCodeFiles, REPOSITORY_RULES, repositoryFindings, RETIRED_FOLDERS, retiredFiles } from './repository-rules.mts';
import { evaluateRules, LAYER_RULES } from './rules.mts';
import { builtSource, exportTargets, tsupEntries, workspacePackages, workspaceSource } from './workspaces.mts';
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

test('layer rules name each forbidden file import once, and tests are exempt except in packages', () => {
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
    'packages/renderer/src/f.ts>site/build/prepare/p.mts', 'src/renderers/css/x.ts>labs/prepared/y.mts'], 'CI scripts in .github/ are an application tree too');
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
    ['tests/photometry/limb.test.mts', 'packages/telescope-cli/cli/run.mts'],
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
    'packages/bake/src/photometry/limb.ts>packages/bake/cli/fit-epic-limb.mts',
    'site/build/x.mts>packages/bake/cli/kernel-bank.mts',
    'tests/photometry/limb.test.mts>packages/telescope-cli/cli/run.mts',
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

test('the ratchet passes the baseline tree and fails only when something gets worse', () => {
  const base = measure(graph(...TANGLED, ['labs/objects/o.mts', 'site/objects.mts']));
  const baseline = decodeBaseline(JSON.parse(formatBaseline(createBaseline(base))));
  assert.equal(baseline.cycles.largestCycle, 3);
  assert.deepEqual(baseline.cycles.cycleClosingEdges, [{ from: 'src/c', to: 'src/a', imports: 1 }]);
  const same = compare(baseline, base);
  assert.equal(isWorse(same), false); assert.equal(isStale(same), false);

  const forward = compare(baseline, measure(graph(...TANGLED, ['labs/objects/o.mts', 'site/objects.mts'], ['src/a/two.mts', 'src/c/one.mts'])));
  assert.equal(isWorse(forward), false, 'a new import that follows the recorded layer order is fine');

  const forbidden = compare(baseline, measure(graph(...TANGLED, ['labs/objects/o.mts', 'site/objects.mts'], ['src/a/one.mts', 'labs/x.mts'])));
  assert.equal(isWorse(forbidden), true);
  assert.match(formatDelta(forbidden), /NEW, not allowed:[\s\S]*src\/a\/one\.mts -> labs\/x\.mts/u);
  assert.deepEqual(forbidden.rules.find(rule => rule.rule === 'nothing-imports-applications')?.added, [{ from: 'src/a/one.mts', to: 'labs/x.mts' }]);

  const cycle = compare(baseline, measure(graph(...TANGLED, ['labs/objects/o.mts', 'site/objects.mts'], ['src/b/one.mts', 'src/a/one.mts'])));
  assert.deepEqual(cycle.cycleClosing.added, [{ from: 'src/b', to: 'src/a', imports: 1 }], 'an upward import inside the cycle is new');
  assert.equal(isWorse(cycle), true);

  const newFolder = compare(baseline, measure(graph(...TANGLED, ['labs/objects/o.mts', 'site/objects.mts'], ['src/c/one.mts', 'src/d/one.mts'], ['src/d/one.mts', 'src/a/one.mts'])));
  assert.equal(newFolder.largestCycle.now, 4);
  assert.deepEqual(newFolder.cycleClosing.joined, ['src/d']);
  assert.match(formatDelta(newFolder), /joined a cycle[^\n]*src\/d/u);
  assert.deepEqual(newFolder.cycleClosing.added.map(edge => `${edge.from}>${edge.to}`).sort(), ['src/c>src/d', 'src/d>src/a'], 'a folder new to a cycle has no agreed place');

  const heavier = compare(baseline, measure(graph(...TANGLED, ['labs/objects/o.mts', 'site/objects.mts'], ['src/c/two.mts', 'src/a/one.mts'])));
  assert.equal(isWorse(heavier), false, 'more imports on a recorded edge are reported, not failed');
  assert.deepEqual(heavier.cycleClosing.heavier.map(item => [item.edge.imports, item.was]), [[2, 1]]);

  const fixed = compare(baseline, measure(graph(...TANGLED.filter(([from]) => from !== 'src/c/one.mts'))));
  assert.equal(isWorse(fixed), false);
  assert.equal(isStale(fixed), true, 'a broken cycle and a removed forbidden import ask for a baseline update');
  assert.match(formatDelta(fixed), /--update-baseline/u);
  assert.doesNotMatch(formatDelta(fixed), /NEW/u);
  assert.deepEqual(fixed.cycleClosing.removed, [{ from: 'src/c', to: 'src/a', imports: 1 }]);
  assert.deepEqual(fixed.rules.find(rule => rule.rule === 'nothing-imports-applications')?.removed, [{ from: 'labs/objects/o.mts', to: 'site/objects.mts' }]);
});

test('cycle growth printed after new forbidden imports is marked as possibly following from them, not caused by them', () => {
  const base = measure(graph(...TANGLED));
  const baseline = decodeBaseline(JSON.parse(formatBaseline(createBaseline(base))));
  const both = formatDelta(compare(baseline, measure(graph(...TANGLED, ['src/b/one.mts', 'src/a/one.mts'], ['src/a/one.mts', 'labs/x.mts']))));
  // Here the new forbidden import (src/a -> labs/x) does not cause the new cycle edge (src/b -> src/a), so the line must not claim it does.
  assert.match(both, /labs\/x\.mts\n {2}The cycle growth below may follow from the forbidden imports above[^\n]*\n {2}cycle-closing folder edge src\/b -> src\/a/u);
  assert.doesNotMatch(both, /consequence|caused by/u);
  const cycleOnly = formatDelta(compare(baseline, measure(graph(...TANGLED, ['src/b/one.mts', 'src/a/one.mts']))));
  assert.doesNotMatch(cycleOnly, /may follow from/u, 'no forbidden import above to point at');
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

test('an added and a removed entry that share a target or a source folder look like a rename', () => {
  const pairs = likelyRenames('r', [{ from: 'site/new.mts', to: 'labs/x.mts' }, { from: 'src/a/n.mts', to: 'labs/q.mts' }, { from: 'labs/z.mts', to: 'site/k.mts' }],
    [{ from: 'site/old.mts', to: 'labs/x.mts' }, { from: 'src/a/o.mts', to: 'labs/p.mts' }]);
  assert.deepEqual(pairs.map(pair => `${pair.removed.from}=>${pair.added.from}`), ['site/old.mts=>site/new.mts', 'src/a/o.mts=>src/a/n.mts']);
});

test('Contract lint, and so pnpm check:ci, runs the check after the packages are built', () => {
  const steps = readCiSteps(readFileSync(new URL('../../../.github/workflows/universe.yml', import.meta.url), 'utf8'), 'lint').map(step => step.run.trim());
  const build = steps.indexOf('node .github/scripts/ci/build-ci.mts lint'), check = steps.indexOf('pnpm check:architecture');
  assert.ok(build >= 0, 'the lint job builds the shared packages');
  assert.ok(check > build, 'the lint job runs pnpm check:architecture after that build');
});

test('a repository rule has no baseline: any finding breaks the check and is printed', () => {
  const rule = { id: 'no-x', description: 'no file is named x', check: (_root: string, files: readonly string[]) => files.filter(file => file.endsWith('/x')) };
  const clean = repositoryFindings('/unused', ['a/y'], [rule]), found = repositoryFindings('/unused', ['a/y', 'a/x'], [rule]);
  assert.equal(isBroken(clean), false);
  assert.equal(isBroken(found), true);
  assert.doesNotMatch(formatFindings(clean), /broken/u);
  assert.match(formatFindings(found), /no-x: 1 findings[\s\S]*Repository rules broken:[\s\S]*\n {4}a\/x$/u);
  assert.deepEqual(REPOSITORY_RULES.map(item => item.id), ['retired-folders', 'objects-hold-data', 'nebula-boundaries', 'declared-dependencies', 'pre-install-imports'], 'retired folders, data-only object packages, the nebula boundaries, declared workspace dependencies and pre-install imports are the repository rules');
});

test('a script or Astro module inside an object package is a finding; its data is not', () => {
  assert.deepEqual(objectCodeFiles(['src/objects/mars/object.json', 'src/objects/mars/README.md', 'src/objects/mars/runtime/definition.mjs',
    'src/objects/mars/site/Card.astro', 'src/objects/mars/x.d.ts', 'src/platform/object-runtime.mts', 'site/objects.mts']),
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
