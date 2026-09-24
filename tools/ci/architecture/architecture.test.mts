import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { astroScriptBlocks, astroSpecifiers, resolveSpecifier, type ResolveContext } from './astro-imports.mts';
import { compare, createBaseline, decodeBaseline, formatBaseline, isStale, isWorse, likelyRenames, measure } from './baseline.mts';
import { cycleClosingEdges, folderCycles, folderGraph, layerOrder, stronglyConnected } from './folders.mts';
import { decodeCruiseResult, missingSources, type ImportGraph } from './graph.mts';
import { distSource, loadRendererBuildConfig, rendererDistEntries } from './renderer-entries.mts';
import { formatDelta } from './report.mts';
import { evaluateRules, LAYER_RULES } from './rules.mts';
import { isTestPath, zoneOf } from './zones.mts';

/** A small graph from `from -> to` pairs; every named path becomes a file. */
function graph(...pairs: readonly (readonly [string, string])[]): ImportGraph {
  const files = new Map<string, { test: boolean; script: boolean; entryHint: boolean; loc: number }>();
  for (const path of pairs.flat()) files.set(path, { test: isTestPath(path), script: false, entryHint: false, loc: 1 });
  return { files, edges: pairs.map(([from, to]) => ({ from, to, test: isTestPath(from), symbols: [], typeOnly: false })) };
}

// src/a -> src/b -> src/c -> src/a is one folder cycle; packages/p is a clean leaf.
const TANGLED: readonly (readonly [string, string])[] = [
  ['src/a/one.mts', 'src/b/one.mts'], ['src/a/one.mts', 'src/b/two.mts'], ['src/b/one.mts', 'src/c/one.mts'],
  ['src/c/one.mts', 'src/a/one.mts'], ['src/a/one.mts', 'packages/p/src/index.ts'], ['site/page.mts', 'src/a/one.mts'],
];

test('folders follow the prototype zones', () => {
  const expected: Record<string, string> = {
    'packages/core/src/validate.ts': 'packages/core',
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
    'netlify/functions/x.mts': 'netlify',
    'astro.config.mts': '(repository root)',
  };
  for (const [file, zone] of Object.entries(expected)) assert.equal(zoneOf(file), zone, file);
  for (const file of ['site/test/x.mts', 'tools/a.test.mts', 'tests/objects/x.mts', 'src/x/fixtures/a.json', 'tools/ci/foo-harness.mts'])
    assert.equal(isTestPath(file), true, file);
  assert.equal(isTestPath('tools/ci/testing-tools.mts'), false);
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

test('Astro specifiers resolve like the cruise: extensions, .js to .ts, workspaces and #imports', () => {
  const context: ResolveContext = {
    tracked: new Set(['site/shape.ts', 'src/r/residency.ts', 'packages/core/src/index.ts', 'labs/p/src/api.ts', 'tools/objects/lens.ts', 'site/components/Card.astro']),
    workspaces: [
      { name: '@x/core', directory: 'packages/core', exports: { '.': { types: './dist/index.d.ts' } } },
      { name: '@x/lab', directory: 'labs/p', exports: { './api': './src/api.ts' } },
    ],
    imports: { '#preparation/*': { types: './tools/objects/*.ts', default: './tools/objects/dist/*.js' } },
    distEntries: new Map([['src/renderers/css/dist/universe', 'src/renderers/css/universe/index.ts']]),
  };
  const from = 'site/components/X.astro';
  assert.equal(resolveSpecifier(from, '../shape', context), 'site/shape.ts');
  assert.equal(resolveSpecifier(from, './Card.astro', context), 'site/components/Card.astro');
  assert.equal(resolveSpecifier(from, '../../src/r/residency.js', context), 'src/r/residency.ts');
  assert.equal(resolveSpecifier(from, '@x/core', context), 'packages/core/src/index.ts', 'an unbuilt dist entry counts as the source entry');
  assert.equal(resolveSpecifier(from, '@x/lab/api', context), 'labs/p/src/api.ts');
  assert.equal(resolveSpecifier(from, '#preparation/lens', context), 'tools/objects/lens.ts');
  assert.equal(resolveSpecifier(from, '../../src/renderers/css/dist/universe.js', context), 'src/renderers/css/universe/index.ts');
  assert.equal(resolveSpecifier(from, 'astro/types', context), undefined, 'npm packages are external');
  assert.equal(resolveSpecifier(from, '../prepared-generated.json', context), undefined, 'untracked output is not an edge');
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
    ['src/renderers/css/preparation/z.ts', 'tools/objects/w.mts'], ['site/a.mts', 'src/preparation/stars/s.ts'],
    ['tools/objects/o.mts', 'site/objects.mts'], ['tools/objects/o.mts', 'tools/prepare/prepare-x.mts'],
    ['src/platform/p.test.mts', 'tools/prepare/prepare-x.mts'], ['astro.config.mts', 'tools/performance/p.mts'],
    ['netlify/functions/f.mts', 'site/find.mts'], ['labs/nebula/run.mts', 'labs/nebula/x.mts'],
  ));
  const pairs = (rule: string) => (violations.get(rule) ?? []).map(item => `${item.from}>${item.to}`);
  assert.deepEqual(pairs('packages-import-only-packages'), ['packages/p/src/a.test.ts>tools/helper.mts', 'packages/p/src/a.ts>src/platform/x.mts']);
  assert.deepEqual(pairs('nothing-imports-applications'), ['src/renderers/css/preparation/z.ts>tools/objects/w.mts', 'src/renderers/css/x.ts>tools/prepared/y.mts', 'tools/objects/o.mts>site/objects.mts']);
  assert.deepEqual(pairs('runtime-imports-no-preparation'), ['site/a.mts>src/preparation/stars/s.ts', 'src/renderers/css/x.ts>tools/prepared/y.mts'],
    'renderer preparation code is preparation, not runtime');
  assert.deepEqual(pairs('nothing-imports-prepare-scripts'), ['tools/objects/o.mts>tools/prepare/prepare-x.mts']);
  assert.deepEqual([...violations.keys()], LAYER_RULES.map(rule => rule.id));
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

test('external JSON is validated before use', () => {
  assert.throws(() => decodeBaseline({ schema: 'other' }), /schema/u);
  assert.throws(() => decodeBaseline({ schema: 'cssearth-architecture-baseline@1', cycles: { largestCycle: 1.5, layerOrder: [], cycleClosingEdges: [] }, rules: {} }), /whole number/u);
  assert.throws(() => decodeBaseline({ schema: 'cssearth-architecture-baseline@1', cycles: { largestCycle: 1, layerOrder: [], cycleClosingEdges: [] }, rules: { r: [{ from: 'a' }] } }), /to must be a string/u);
  assert.throws(() => decodeCruiseResult({ modules: [{ source: 'a.ts', dependencies: [{ module: './b' }] }] }), /resolved must be a string/u);
  assert.deepEqual(decodeCruiseResult({ modules: [{ source: 'a.ts', dependencies: [{ module: './b', resolved: 'b.ts', coreModule: false }] }] }),
    [{ source: 'a.ts', coreModule: false, couldNotResolve: false, dependencies: [{ module: './b', resolved: 'b.ts', coreModule: false, couldNotResolve: false }] }]);
});

test('compiled renderer imports count as the entry sources its tsup config names', async () => {
  const root = resolve(import.meta.dirname, '../../..'), entries = rendererDistEntries(root, await loadRendererBuildConfig(root));
  assert.equal(entries.get('src/renderers/css/dist/navigation'), 'src/renderers/css/navigation/index.ts');
  assert.equal(entries.get('src/renderers/css/dist/platform/object-orbit'), 'src/renderers/css/navigation/object-orbit.ts');
  for (const source of entries.values()) assert.equal(existsSync(resolve(root, source)), true, source);
  assert.equal(distSource('src/renderers/css/dist/index.js', entries), 'src/renderers/css/index.ts');
  assert.equal(distSource('src/renderers/css/dist/universe.d.ts', entries), 'src/renderers/css/universe/index.ts');
  assert.equal(distSource('src/renderers/css/dist/chunk-abc.js', entries), undefined);
  assert.equal(distSource('src/renderers/css/index.ts', entries), undefined);
  assert.deepEqual(rendererDistEntries('/repo', { entry: { a: '/repo/src/renderers/css/a.ts' } }), new Map([['src/renderers/css/dist/a', 'src/renderers/css/a.ts']]));
  assert.throws(() => rendererDistEntries('/repo', { entry: { a: 1 } }), /must be a string/u);
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
