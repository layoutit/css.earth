/** The plan's generated tables must expose connectivity failures and become stale on data changes. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
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
test('draft findings warn and enforced findings throw; malformed status fails', async () => {
  const { planFinding } = await import('./site-architecture.mts');
  const failure = () => { throw new Error('plan changed'); };
  const warn = console.warn, messages: unknown[] = []; console.warn = value => { messages.push(value); };
  try {
    assert.doesNotThrow(() => planFinding('draft', failure, { draftUntil: '2026-11-02', today: '2026-10-05', warningCeiling: 1 })); assert.match(String(messages[0]), /WARNING.*--write/u);
    assert.throws(() => planFinding('enforced', failure), /plan changed/u);
    assert.throws(() => planFinding('unsigned', failure), /status/u);
  } finally { console.warn = warn; }
});

test('expired draft findings fail and a zero warning ceiling fails; Actions annotates allowed findings', async () => {
  const { planFinding } = await import('./site-architecture.mts');
  const failure = () => { throw new Error('changed'); };
  assert.throws(() => planFinding('draft', failure, { draftUntil: '2000-01-01', today: '2026-10-05', warningCeiling: 1 }), /expired/u);
  assert.throws(() => planFinding('draft', failure, { draftUntil: '2026-11-02', today: '2026-10-05', warningCeiling: 0 }), /ceiling/u);
  const warn = console.warn, messages: string[] = []; console.warn = value => { messages.push(String(value)); };
  try {
    planFinding('draft', failure, { draftUntil: '2026-11-02', today: '2026-10-05', warningCeiling: 1, actions: true });
    assert.ok(messages.some(message => message.startsWith('::warning file=')));
  } finally { console.warn = warn; }
});

test('draft policy requires a valid calendar date and a nonnegative warning ceiling', () => {
  const tiers = { ...input.tiers, status: 'draft', draftUntil: '2026-11-02', warningCeiling: 0 };
  assert.doesNotThrow(() => renderTables({ ...input, tiers }));
  assert.throws(() => renderTables({ ...input, tiers: { ...tiers, draftUntil: '2026-02-30' } }), /draftUntil/u);
  assert.throws(() => renderTables({ ...input, tiers: { ...tiers, warningCeiling: -1 } }), /warningCeiling/u);
});
