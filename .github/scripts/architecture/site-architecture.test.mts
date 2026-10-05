/** The plan's generated tables must expose connectivity failures and become stale on data changes. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';
import { renderTables, updateTables } from './site-architecture.mts';
const input = {
  declarations: { declarations: [{ from: 'site/a.mts', to: 'site/base/base.mts', kind: 'value' }], summary: { files: ['site/a.mts', 'site/base/base.mts'] } },
  moves: { 'site/a.mts': 'site/app/a.mts' },
  tiers: { tiers: [{ tier: 1, name: 'Foundation', folders: ['site/base'] }, { tier: 2, name: 'Application', folders: ['site/app'] }], root: { allow: [] } }, edits: [],
};
test('renders counts, before/after and exact marked tables; changed data changes the document', () => {
  const tables = renderTables(input);
  assert.match(tables.folders!, /Application \| 1 \| 1/u);
  assert.match(tables.numbers!, /\| all \| 0 \| 0 \| 1 \| 0 \| 0 \| 0 \| 0 \| 0 \|/u);
  const document = Object.keys(tables).map(name => `<!-- generated:${name} -->\n<!-- /generated:${name} -->`).join('\n');
  const written = updateTables(document, tables);
  assert.notEqual(document, written); assert.equal(updateTables(written, tables), written);
  assert.notEqual(updateTables(written, renderTables({ ...input, tiers: { ...input.tiers,
    tiers: input.tiers.tiers.map(tier => ({ ...tier, name: `${tier.name} changed` })) } })), written);
  assert.throws(() => updateTables('', tables), /markers/u);
  assert.throws(() => updateTables(document + document, tables), /markers/u);
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
  const mutant = original.replace("if (status !== 'planned') throw error;", 'throw error;');
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
