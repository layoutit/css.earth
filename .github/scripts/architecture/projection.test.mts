/** Hand-built graph projections prove connectivity, tier direction, view filters and stale-edit rejection. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { project, type Edge } from './projection.mts';
const a = 'site/a/a.mts', b = 'site/b/b.mts', c = 'site/a/c.mts';
const tiers = { tiers: [{ tier: 0, name: 'a', folders: ['site/a'] }, { tier: 1, name: 'b', folders: ['site/b'] }], root: { allow: [] } };
const declarations = (edges: Edge[], files: string[] = [a, b, c]) => ({ declarations: edges, summary: { files } });
const cycle: Edge[] = [{ from: a, to: b, kind: 'value', line: 3 }, { from: b, to: a, kind: 'value', line: 8 }];

test('moves preserve SCCs and internal lines; a retarget edit breaks the cycle', () => {
  const next = 'site/a/moved.mts';
  const result = project({ declarations: declarations(cycle), moves: { [a]: next }, tiers });
  assert.equal(result.failed, true);
  assert.deepEqual(result.views.value?.fileSccs[0]?.members, [next, b]);
  assert.equal(result.views.value?.folderSccs.length, 1);
  assert.deepEqual(result.views.value?.fileSccs[0]?.edges.map(edge => edge.line), [3, 8]);
  const fixed = project({ declarations: declarations(cycle), moves: { [a]: next }, tiers,
    edits: [{ op: 'retarget', from: b, to: next, newTo: c }] });
  assert.equal(fixed.views.value?.fileSccs.length, 0);
});

test('SCC alone fails even when all files belong to the same folder and tier', () => {
  const result = project({ declarations: declarations(cycle), moves: {}, tiers: { tiers: [{ tier: 0, name: 'all', folders: ['site'] }], root: { allow: [] } } });
  assert.equal(result.views.all?.folderSccs.length, 0);
  assert.equal(result.views.all?.fileSccs.length, 1);
  assert.equal(result.failed, true);
});

test('type, lazy and asset back edges enter precisely their views', () => {
  for (const kind of ['type', 'lazy', 'asset'] as const) {
    const result = project({ declarations: declarations([cycle[0]!, { ...cycle[1]!, kind }]), moves: {}, tiers });
    assert.equal(result.views.value?.fileSccs.length, 0);
    assert.equal(result.views['value+lazy']?.fileSccs.length, kind === 'lazy' ? 1 : 0);
    assert.equal(result.views['value+lazy+type']?.fileSccs.length, kind === 'asset' ? 0 : 1);
    assert.equal(result.views.all?.fileSccs.length, 1);
  }
});

test('upward points to the higher tier; downward succeeds', () => {
  const result = project({ declarations: declarations([cycle[0]!]), moves: {}, tiers });
  assert.equal(result.views.value?.upward.length, 1); assert.equal(result.failed, true);
  const down = project({ declarations: declarations([cycle[1]!]), moves: {}, tiers });
  assert.equal(down.views.value?.upward.length, 0); assert.equal(down.failed, false);
});

test('lateral pairs are directed allowances; longest folder prefix wins', () => {
  const lateralTiers = { ...tiers, tiers: [{ tier: 0, name: 'shared', folders: ['site', 'site/a', 'site/b'] }] };
  const input = { declarations: declarations([cycle[0]!]), moves: {}, tiers: lateralTiers };
  assert.equal(project(input).views.all?.lateral.length, 1);
  assert.equal(project({ ...input, tiers: { ...lateralTiers, lateral: [['site/a', 'site/b']] } }).failed, false);
  assert.equal(project({ ...input, tiers: { ...lateralTiers, lateral: [['site/b', 'site/a']] } }).failed, true);
});

test('unassigned isolated files fail; external targets are ignored and counted; root allow works', () => {
  const result = project({ declarations: declarations([{ from: a, to: 'node:fs', kind: 'value' }], [a, 'site/orphan.mts']), moves: {}, tiers });
  assert.deepEqual(result.unassigned, ['site/orphan.mts']); assert.equal(result.failed, true);
  assert.equal(result.summary.ignoredDeclarations, 1);
  assert.equal(project({ declarations: declarations([], ['site/env.d.ts']), moves: {}, tiers: { ...tiers, root: { allow: ['site/env.d.ts'] } } }).failed, false);
});

test('edits must match, apply after moves, and add/remove files explicitly', () => {
  const input = { declarations: declarations(cycle), moves: {}, tiers };
  assert.throws(() => project({ ...input, edits: [{ op: 'remove-import', from: a, to: c }] }), /did not match/u);
  assert.throws(() => project({ ...input, edits: [{ op: 'retarget', from: a, to: b, newTo: c, kind: 'type' }] }), /did not match/u);
  assert.throws(() => project({ ...input, moves: { [a]: 'site/a/moved.mts' }, edits: [{ op: 'remove-import', from: a, to: b }] }), /does not exist/u);
  const result = project({ ...input, edits: [{ op: 'remove-import', from: a, to: b }, { op: 'remove-file', path: b },
    { op: 'add-file', path: 'site/a/new.mts' }, { op: 'add-import', from: a, to: 'site/a/new.mts', kind: 'type', note: 'new contract' }] });
  assert.equal(result.failed, false); assert.equal(result.summary.declarations, 1);
});

test('file deletes remove incident edges; collisions and folder moves fail', () => {
  const input = { declarations: declarations(cycle), moves: {}, tiers };
  assert.equal(project({ ...input, moves: { [b]: null } }).failed, false);
  assert.throws(() => project({ ...input, moves: { 'site/a': 'site/new' } }), /folder moves/u);
  assert.throws(() => project({ ...input, moves: { [a]: b } }), /collision/u);
});

test('unknown keys and invalid external values are rejected', () => {
  const input = { declarations: declarations(cycle), moves: {}, tiers };
  assert.throws(() => project({ ...input, tiers: { ...tiers, typo: 1 } }), /unknown key/u);
  assert.throws(() => project({ ...input, tiers: { ...tiers, tiers: [{ tier: '0', name: 'a', folders: [] }] } }), /integer/u);
  assert.throws(() => project({ ...input, edits: [{ op: 'remove-import', from: a, to: b, typo: 1 }] }), /unknown key/u);
  assert.throws(() => project({ ...input, declarations: { declarations: [{ ...cycle[0], kind: 'bad' }] } }), /kind/u);
  assert.throws(() => project({ ...input, declarations: { declarations: [{ ...cycle[0], line: 0 }] } }), /line/u);
  assert.throws(() => project({ ...input, moves: { [a]: '../escape' } }), /relative/u);
});

test('any-tier tests remain SCC nodes but have individual leaf folder nodes', () => {
  const lowTest = 'site/a/a.test.mts', helper = 'site/a/help.test-support.mts';
  const input = { declarations: declarations([{ from: lowTest, to: b, kind: 'lazy' }, { from: b, to: a, kind: 'value' },
    { from: lowTest, to: helper, kind: 'value' }], [a, b, lowTest, helper]), moves: {}, tiers: { ...tiers, tests: 'any-tier' } };
  const result = project(input);
  assert.equal(result.failed, false); assert.equal(result.views.all?.upward.length, 0);
  assert.equal(result.views.all?.fileSccs.length, 0); assert.equal(result.views.all?.folderSccs.length, 0);
  assert.equal(project({ ...input, tiers }).failed, true);
  const cyclic = project({ ...input, edits: [{ op: 'add-import', from: helper, to: lowTest, kind: 'type' }] });
  assert.equal(cyclic.views.all?.fileSccs.length, 1); assert.equal(cyclic.failed, true);
});

test('production cannot import a moved test, fixture or explicitly listed helper', () => {
  for (const target of ['site/a/a.test.mts', 'site/a/fixtures/data.mts', 'site/a/helper.mts']) {
    const result = project({ declarations: declarations([{ from: a, to: target, kind: 'type' }], [a, target]),
      moves: { [target]: 'site/a/moved.mts' }, tiers: { ...tiers, tests: 'any-tier', testFiles: [target] } });
    assert.equal(result.productionImportsTests.length, 1); assert.equal(result.failed, true);
  }
  assert.throws(() => project({ declarations: declarations([]), moves: {}, tiers: { ...tiers, tests: 'ignore' } }), /any-tier/u);
});

test('a self-import is a file SCC even though intra-folder imports are allowed', () => {
  const result = project({ declarations: declarations([{ from: a, to: a, kind: 'lazy' }]), moves: {}, tiers });
  assert.equal(result.views.all?.fileSccs.length, 1); assert.equal(result.failed, true);
});

test('explicit denies reject a downward client-to-server edge and validate their schema', () => {
  const declarations = { declarations: [{ from: 'site/client/a.mts', to: 'site/server/b.mts', kind: 'value' }] };
  const tiers = { root: { allow: [] }, tiers: [{ tier: 2, name: 'Client', folders: ['site/client'] }, { tier: 0, name: 'Server', folders: ['site/server'] }],
    forbid: [{ from: ['site/client'], to: ['site/server'], reason: 'Client cannot use server' }] };
  const result = project({ declarations, moves: {}, tiers });
  assert.equal(result.forbidden.length, 1); assert.equal(result.failed, true);
  assert.equal(project({ declarations, moves: {}, tiers: { ...tiers, forbid: [] } }).failed, false);
  assert.throws(() => project({ declarations, moves: {}, tiers: { ...tiers, forbid: [{ from: 'site/client', to: [], reason: 'bad' }] } }), /array/u);
});
test('same-tier siblings are forbidden; declared new-file imports can expose back edges', () => {
  const declarations = { declarations: [{ from: 'site/a/a.mts', to: 'site/b/b.mts', kind: 'type' }] };
  const tiers = { root: { allow: [] }, tiers: [{ tier: 0, name: 'Siblings', folders: ['site/a', 'site/b'] }] };
  assert.equal(project({ declarations, moves: {}, tiers }).views.all!.lateral.length, 1);
  const result = project({ declarations, moves: {}, tiers, edits: [{ op: 'add-file', path: 'site/b/types.mts', imports: [{ to: 'site/a/a.mts', kind: 'type' }] },
    { op: 'retarget', from: 'site/a/a.mts', to: 'site/b/b.mts', newTo: 'site/b/types.mts' }] });
  assert.equal(result.views.all!.fileSccs.length, 1);
});

test('the committed deny map permits page entries and forbids other startup/client-server injectors', async () => {
  const { readFileSync } = await import('node:fs');
  const data: unknown = JSON.parse(readFileSync('docs/site-architecture/tiers.json', 'utf8'));
  assert.ok(data && typeof data === 'object' && 'forbid' in data && 'tiers' in data);
  assert.ok(Array.isArray(data.tiers));
  const folders = data.tiers.flatMap((tier: unknown) => {
    assert.ok(tier && typeof tier === 'object' && 'folders' in tier && Array.isArray(tier.folders));
    return tier.folders.map((folder: unknown) => { assert.equal(typeof folder, 'string'); return String(folder); });
  });
  const services = ['site/startup', 'site/server', 'site/build'];
  const root = { allow: [] }, tiers = [{ tier: 0, name: 'Services', folders: services },
    { tier: 1, name: 'Consumers', folders: folders.filter(folder => !services.includes(folder)) }];
  const run = (from: string, to: string) => project({ declarations: { declarations: [{ from, to, kind: 'value' }] }, moves: {}, tiers: { root, tiers, forbid: data.forbid } });
  assert.equal(run('site/scene/a.mts', 'site/server/b.mts').forbidden.length, 1);
  assert.equal(run('site/scene/a.mts', 'site/build/b.mts').forbidden.length, 1);
  assert.equal(run('site/scene/a.mts', 'site/startup/b.mts').forbidden.length, 1);
  assert.equal(run('site/layouts/a.mts', 'site/startup/b.mts').failed, false);
  assert.equal(run('site/pages/a.mts', 'site/startup/b.mts').failed, false);
});
