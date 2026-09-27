import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { astroScriptBlocks, astroSpecifiers, moduleSpecifiers } from './astro-imports.mts';
import { compare, createBaseline, decodeBaseline, formatBaseline, isStale, isWorse, likelyRenames, measure } from './baseline.mts';
import { cycleClosingEdges, folderCycles, folderGraph, layerOrder, stronglyConnected } from './folders.mts';
import { decodeCruiseResult, missingSources, type ImportGraph } from './graph.mts';
import { readCiSteps } from '../../../.github/scripts/ci/check-ci.mts';
import { formatDelta } from './report.mts';
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
    'src/renderers/css/navigation/x.ts': 'src/renderers/css/navigation',
    'src/renderers/css/index.ts': 'src/renderers/css(root)',
    'src/preparation/stars/x.ts': 'src/preparation/stars',
    'tools/objects/hst/x.mts': 'tools/objects/hst',
    'tools/objects/x.mts': 'tools/objects(root)',
    'site/components/X.astro': 'site/components',
    'site/objects.mts': 'site(root)',
    'tools/ci/x.mts': 'tools/ci',
    '.github/scripts/ci/x.mts': '.github/scripts/ci',
    '.github/scripts/x.mts': '.github/scripts(root)',
    'netlify/functions/x.mts': 'netlify',
    'astro.config.mts': '(repository root)',
  };
  for (const [file, zone] of Object.entries(expected)) assert.equal(zoneOf(file), zone, file);
  for (const file of ['site/test/x.mts', 'tools/a.test.mts', 'tests/objects/x.mts', 'src/x/fixtures/a.json', 'tools/ci/foo-harness.mts'])
    assert.equal(isTestPath(file), true, file);
  assert.equal(isTestPath('tools/ci/testing-tools.mts'), false);
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
    ['packages/p/src/a.ts', 'src/platform/x.mts'], ['packages/p/src/a.test.ts', 'tools/helper.mts'],
    ['src/renderers/css/x.ts', 'tools/prepared/y.mts'], ['src/renderers/css/x.ts', 'tools/prepared/y.mts'],
    ['site/a.mts', 'packages/bake/src/stars/index.ts'], ['site/b.mts', 'tools/prepared/y.mts', 'type'],
    ['packages/renderer/src/stars/bank.ts', 'packages/bake/src/stars/index.ts', 'type'], ['packages/renderer/src/stars/bank.test.ts', 'packages/bake/src/stars/index.ts'],
    ['packages/renderer/src/stars/bank.ts', 'packages/core/src/index.ts'],
    ['tools/objects/o.mts', 'site/objects.mts'], ['tools/objects/o.mts', 'tools/prepare/cli/prepare-x.mts'],
    ['tools/objects/o.mts', 'tools/prepare/prepare-x.mts'], ['src/platform/p.test.mts', 'tools/prepare/cli/prepare-x.mts'], ['astro.config.mts', 'tools/performance/p.mts'],
    ['netlify/functions/f.mts', 'site/find.mts'], ['labs/nebula/run.mts', 'labs/nebula/x.mts'],
    ['tools/ci/x.mts', '.github/scripts/ci/y.mts'], ['.github/scripts/ci/y.mts', 'tools/ci/z.mts'], ['.github/scripts/ci/y.mts', 'packages/core/src/validate.ts'],
  ));
  const pairs = (rule: string) => (violations.get(rule) ?? []).map(item => `${item.from}>${item.to}`);
  assert.deepEqual(pairs('packages-import-only-packages'), ['packages/p/src/a.test.ts>tools/helper.mts', 'packages/p/src/a.ts>src/platform/x.mts']);
  assert.deepEqual(pairs('nothing-imports-applications'), ['.github/scripts/ci/y.mts>tools/ci/z.mts', 'site/b.mts>tools/prepared/y.mts', 'src/renderers/css/x.ts>tools/prepared/y.mts',
    'tools/ci/x.mts>.github/scripts/ci/y.mts', 'tools/objects/o.mts>site/objects.mts'], 'CI scripts in .github/ are an application tree too');
  assert.deepEqual(pairs('runtime-imports-no-preparation'), [
    'packages/renderer/src/stars/bank.ts>packages/bake/src/stars/index.ts', 'site/a.mts>packages/bake/src/stars/index.ts', 'site/b.mts>tools/prepared/y.mts',
  ], 'the renderer package is runtime, type-only imports count, and its tests may use bake');
  assert.deepEqual(pairs('nothing-imports-prepare-scripts'), ['tools/objects/o.mts>tools/prepare/cli/prepare-x.mts'],
    'a prepare entry is never imported; its library beside it may be');
  assert.deepEqual([...violations.keys()], LAYER_RULES.map(rule => rule.id));
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
  const base = measure(graph(...TANGLED, ['tools/objects/o.mts', 'site/objects.mts']));
  const baseline = decodeBaseline(JSON.parse(formatBaseline(createBaseline(base))));
  assert.equal(baseline.cycles.largestCycle, 3);
  assert.deepEqual(baseline.cycles.cycleClosingEdges, [{ from: 'src/c', to: 'src/a', imports: 1 }]);
  const same = compare(baseline, base);
  assert.equal(isWorse(same), false); assert.equal(isStale(same), false);

  const forward = compare(baseline, measure(graph(...TANGLED, ['tools/objects/o.mts', 'site/objects.mts'], ['src/a/two.mts', 'src/c/one.mts'])));
  assert.equal(isWorse(forward), false, 'a new import that follows the recorded layer order is fine');

  const forbidden = compare(baseline, measure(graph(...TANGLED, ['tools/objects/o.mts', 'site/objects.mts'], ['src/a/one.mts', 'tools/x.mts'])));
  assert.equal(isWorse(forbidden), true);
  assert.match(formatDelta(forbidden), /NEW, not allowed:[\s\S]*src\/a\/one\.mts -> tools\/x\.mts/u);
  assert.deepEqual(forbidden.rules.find(rule => rule.rule === 'nothing-imports-applications')?.added, [{ from: 'src/a/one.mts', to: 'tools/x.mts' }]);

  const cycle = compare(baseline, measure(graph(...TANGLED, ['tools/objects/o.mts', 'site/objects.mts'], ['src/b/one.mts', 'src/a/one.mts'])));
  assert.deepEqual(cycle.cycleClosing.added, [{ from: 'src/b', to: 'src/a', imports: 1 }], 'an upward import inside the cycle is new');
  assert.equal(isWorse(cycle), true);

  const newFolder = compare(baseline, measure(graph(...TANGLED, ['tools/objects/o.mts', 'site/objects.mts'], ['src/c/one.mts', 'src/d/one.mts'], ['src/d/one.mts', 'src/a/one.mts'])));
  assert.equal(newFolder.largestCycle.now, 4);
  assert.deepEqual(newFolder.cycleClosing.joined, ['src/d']);
  assert.match(formatDelta(newFolder), /joined a cycle[^\n]*src\/d/u);
  assert.deepEqual(newFolder.cycleClosing.added.map(edge => `${edge.from}>${edge.to}`).sort(), ['src/c>src/d', 'src/d>src/a'], 'a folder new to a cycle has no agreed place');

  const heavier = compare(baseline, measure(graph(...TANGLED, ['tools/objects/o.mts', 'site/objects.mts'], ['src/c/two.mts', 'src/a/one.mts'])));
  assert.equal(isWorse(heavier), false, 'more imports on a recorded edge are reported, not failed');
  assert.deepEqual(heavier.cycleClosing.heavier.map(item => [item.edge.imports, item.was]), [[2, 1]]);

  const fixed = compare(baseline, measure(graph(...TANGLED.filter(([from]) => from !== 'src/c/one.mts'))));
  assert.equal(isWorse(fixed), false);
  assert.equal(isStale(fixed), true, 'a broken cycle and a removed forbidden import ask for a baseline update');
  assert.match(formatDelta(fixed), /--update-baseline/u);
  assert.doesNotMatch(formatDelta(fixed), /NEW/u);
  assert.deepEqual(fixed.cycleClosing.removed, [{ from: 'src/c', to: 'src/a', imports: 1 }]);
  assert.deepEqual(fixed.rules.find(rule => rule.rule === 'nothing-imports-applications')?.removed, [{ from: 'tools/objects/o.mts', to: 'site/objects.mts' }]);
});

test('cycle growth printed after new forbidden imports is marked as possibly following from them, not caused by them', () => {
  const base = measure(graph(...TANGLED));
  const baseline = decodeBaseline(JSON.parse(formatBaseline(createBaseline(base))));
  const both = formatDelta(compare(baseline, measure(graph(...TANGLED, ['src/b/one.mts', 'src/a/one.mts'], ['src/a/one.mts', 'tools/x.mts']))));
  // Here the new forbidden import (src/a -> tools/x) does not cause the new cycle edge (src/b -> src/a), so the line must not claim it does.
  assert.match(both, /tools\/x\.mts\n {2}The cycle growth below may follow from the forbidden imports above[^\n]*\n {2}cycle-closing folder edge src\/b -> src\/a/u);
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
  const pairs = likelyRenames('r', [{ from: 'site/new.mts', to: 'tools/x.mts' }, { from: 'src/a/n.mts', to: 'tools/q.mts' }, { from: 'labs/z.mts', to: 'site/k.mts' }],
    [{ from: 'site/old.mts', to: 'tools/x.mts' }, { from: 'src/a/o.mts', to: 'tools/p.mts' }]);
  assert.deepEqual(pairs.map(pair => `${pair.removed.from}=>${pair.added.from}`), ['site/old.mts=>site/new.mts', 'src/a/o.mts=>src/a/n.mts']);
});

test('Contract lint, and so pnpm check:ci, runs the check after the packages are built', () => {
  const steps = readCiSteps(readFileSync(new URL('../../../.github/workflows/universe.yml', import.meta.url), 'utf8'), 'lint').map(step => step.run.trim());
  const build = steps.indexOf('node tools/ci/build-ci.mts lint'), check = steps.indexOf('pnpm check:architecture');
  assert.ok(build >= 0, 'the lint job builds the shared packages');
  assert.ok(check > build, 'the lint job runs pnpm check:architecture after that build');
});
