/** The plan's generated tables must expose connectivity failures and become stale on data changes. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';
import { renderNumbers, renderTables, updateTables } from './site-architecture.mts';
const input = {
  declarations: { declarations: [{ from: 'site/a.mts', to: 'site/base/base.mts', kind: 'value' }], summary: { files: ['site/a.mts', 'site/base/base.mts'] } },
  moves: { 'site/a.mts': 'site/app/a.mts' },
  tiers: { tiers: [{ tier: 1, name: 'Foundation', folders: ['site/base'] }, { tier: 2, name: 'Application', folders: ['site/app'] }], root: { allow: [] } }, edits: [],
};
test('renders counts, before/after and exact marked tables; changed data changes the document', () => {
  const tables = renderTables(input);
  assert.match(tables.folders!, /Application \| 1; `a\.mts`/u);
  assert.deepEqual(Object.keys(tables).sort(), ['changes', 'folders']);
  assert.match(renderNumbers(input), /\| all \| 0 \| 0 \| 1 \| 0 \| 0 \| 0 \| 0 \| 0 \|/u);
  const document = Object.keys(tables).map(name => `<!-- generated:${name} -->\n<!-- /generated:${name} -->`).join('\n');
  const written = updateTables(document, tables);
  assert.notEqual(document, written); assert.equal(updateTables(written, tables), written);
  assert.notEqual(updateTables(written, renderTables({ ...input, tiers: { ...input.tiers,
    tiers: input.tiers.tiers.map(tier => ({ ...tier, name: `${tier.name} changed` })) } })), written);
  assert.throws(() => updateTables('', tables), /markers/u);
  assert.throws(() => updateTables(document + document, tables), /markers/u);
});
test('an ordinary new file and import leaves every committed table unchanged; only the on-demand numbers move', () => {
  const before = renderTables(input);
  const grown = { ...input, declarations: { declarations: [...input.declarations.declarations, { from: 'site/app/b.mts', to: 'site/base/base.mts', kind: 'value' }, { from: 'site/app/b.mts', to: 'site/a.mts', kind: 'lazy' }],
    summary: { files: [...input.declarations.summary.files, 'site/app/b.mts'] } } };
  assert.deepEqual(renderTables(grown), before);
  const withoutMove = renderTables({ ...input, declarations: { ...input.declarations, declarations: [...input.declarations.declarations, { from: 'site/a.mts', to: 'site/base/base.mts', kind: 'type' }] } });
  assert.deepEqual(withoutMove, before);
  assert.notEqual(renderNumbers({ ...input, declarations: { ...input.declarations, declarations: [...input.declarations.declarations, { from: 'site/a.mts', to: 'site/base/base.mts', kind: 'type' }] } }), renderNumbers(input));
});
test('a structural change makes the committed folder and change tables differ', () => {
  const before = renderTables(input);
  assert.notEqual(renderTables({ ...input, tiers: { ...input.tiers, tiers: input.tiers.tiers.map(tier => ({ ...tier, name: `${tier.name} moved` })) } }).folders, before.folders);
  const edited = renderTables({ ...input, edits: [{ op: 'add-file', path: 'site/app/c.mts', imports: [], id: 'x', change: 'New edit', note: 'Structural edit.' }] });
  assert.notEqual(edited.changes, before.changes);
});
test('refuses to render a plan with cycles or uncovered root files', () => {
  assert.throws(() => renderTables({ ...input, moves: {} }), /fails projection/u);
  assert.throws(() => renderTables({ ...input, edits: [{ op: 'add-import', from: 'site/base/base.mts', to: 'site/app/a.mts', kind: 'lazy',
    change: 'Bad cycle', note: 'Mutation makes the base depend on application.' }] }), /fails projection/u);
});

test('the stale-table guard throws; equal content passes', async () => {
  const { assertCurrent } = await import('./site-architecture.mts');
  assert.throws(() => assertCurrent('stale', 'current'), /stale/u);
  assert.doesNotThrow(() => assertCurrent('current', 'current'));
});
test('planned findings only warn, enforced findings throw, and invalid statuses fail', async () => {
  const { planFinding } = await import('./site-architecture.mts');
  const failure = () => { throw new Error('plan changed'); };
  const warn = console.warn, messages: string[] = []; console.warn = value => { messages.push(String(value)); };
  try {
    // Removing the warn-only branch makes this assertion fail on the real finding.
    assert.doesNotThrow(() => planFinding('planned', failure, { actions: false }));
    assert.equal(messages.length, 1);
    assert.match(messages[0]!, /WARNING.*plan changed.*Fix: node .*--write/u);
    assert.throws(() => planFinding('enforced', failure), /plan changed/u);
    for (const status of ['unsigned', 'draft', undefined, null]) assert.throws(() => planFinding(status, failure), /status/u);
    assert.doesNotThrow(() => planFinding('enforced', () => {}));
  } finally { console.warn = warn; }
});

test('stale generated tables fail even while the plan status is planned', async () => {
  const { assertCurrent, planFinding } = await import('./site-architecture.mts');
  const warn = console.warn; console.warn = () => {};
  try {
    assert.throws(() => planFinding('planned', () => assertCurrent('committed', 'generated'), { actions: false }), /tables are stale.*--write/u);
    assert.throws(() => planFinding('enforced', () => assertCurrent('committed', 'generated')), /tables are stale/u);
    assert.doesNotThrow(() => planFinding('planned', () => assertCurrent('same', 'same'), { actions: false }));
  } finally { console.warn = warn; }
});

test('deleting the stale-table rethrow turns the planned stale-table assertion red', () => {
  const source = readFileSync(new URL('./site-architecture.mts', import.meta.url), 'utf8');
  const rule = " || (error instanceof Error && 'staleTables' in error)";
  assert.ok(source.includes(rule));
  const start = source.indexOf('export function assertCurrent('), end = source.indexOf('\nexport async function checkSiteArchitecture', start);
  const original = source.slice(start, end);
  const probe = (implementation: string) => {
    const code = ts.transpileModule(implementation, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    return spawnSync(process.execPath, ['-e', `${code}\nrequire('node:assert/strict').throws(() => planFinding('planned', () => assertCurrent('a', 'b'), { actions: false }), /stale/);`], { encoding: 'utf8' });
  };
  assert.equal(probe(original).status, 0);
  assert.notEqual(probe(original.replace(rule, '')).status, 0);
});

test('planned findings always emit Actions warnings, without a count ceiling', async () => {
  const { planFinding } = await import('./site-architecture.mts');
  const warn = console.warn, messages: string[] = []; console.warn = value => { messages.push(String(value)); };
  try {
    for (let i = 0; i < 3; i++) planFinding('planned', () => { throw new Error('changed%\nnext'); }, { actions: true });
    assert.equal(messages.length, 6);
    assert.equal(messages.filter(message => message.startsWith('::warning file=docs/site-architecture.md::')).length, 3);
    assert.match(messages[1]!, /changed%25%0Anext.*--write/u);
  } finally { console.warn = warn; }
});

test('plan schema accepts only planned and enforced statuses', () => {
  for (const status of ['planned', 'enforced']) assert.doesNotThrow(() => renderTables({ ...input, tiers: { ...input.tiers, status } }));
  for (const status of ['draft', 'unsigned', null]) assert.throws(() => renderTables({ ...input, tiers: { ...input.tiers, status } }), /status/u);
});

test('deleting the planned warn-only rule turns the same finding assertion red', () => {
  const source = readFileSync(new URL('./site-architecture.mts', import.meta.url), 'utf8');
  const start = source.indexOf('export function planFinding('), end = source.indexOf('\nexport async function checkSiteArchitecture', start);
  assert.ok(start >= 0 && end > start);
  const original = source.slice(start, end);
  const mutant = original.replace("if (status !== 'planned' || (error instanceof Error && 'staleTables' in error)) throw error;", 'throw error;');
  assert.notEqual(mutant, original);
  const probe = (implementation: string) => {
    const code = ts.transpileModule(implementation, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    return spawnSync(process.execPath, ['-e', `${code}\nrequire('node:assert/strict').doesNotThrow(() => planFinding('planned', () => { throw new Error('plan changed'); }, { actions: false }));`], { encoding: 'utf8' });
  };
  const passing = probe(original); assert.equal(passing.status, 0, passing.stderr);
  assert.match(passing.stderr, /SITE_PLAN_WARNING.*plan changed.*--write/u);
  const failing = probe(mutant); assert.equal(failing.status, 1, failing.stderr);
  assert.match(failing.stderr, /AssertionError.*|Got unwanted exception/u);
});

test('the committed site plan is enforced, so any site folder cycle, layer violation or unassigned root file fails the check', () => {
  const tiers = JSON.parse(readFileSync(new URL('../../../docs/site-architecture/tiers.json', import.meta.url), 'utf8')) as { status?: unknown };
  assert.equal(tiers.status, 'enforced');
});
