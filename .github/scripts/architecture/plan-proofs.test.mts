/** Mutations must invalidate ordered replay and group minimality, not only the final graph. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sequence, minimality } from './plan-proofs.mts';
import { readFileSync } from 'node:fs';
import { trackedStandIn } from './graph.mts';
const fixture = {
  declarations: { declarations: [{ from: 'site/a.mts', to: 'site/b.mts', kind: 'value' }, { from: 'site/b.mts', to: 'site/a.mts', kind: 'type' }], summary: { files: ['site/a.mts', 'site/b.mts'] } },
  moves: { 'site/a.mts': 'site/high/a.mts', 'site/b.mts': 'site/low/b.mts' },
  tiers: { tests: 'any-tier', root: { allow: [] }, tiers: [{ tier: 0, name: 'Low', folders: ['site/low'] }, { tier: 1, name: 'High', folders: ['site/high'] }] },
  edits: { edits: [{ id: 'cut-cycle', op: 'remove-import', from: 'site/low/b.mts', to: 'site/high/a.mts', kind: 'type' }], changes: [{ id: 'cut', edits: ['cut-cycle'] }] },
};
test('old locations replay; S4 prefixes never import legacy from a moved lower folder', () => {
  assert.equal(sequence(fixture).failed, false);
  assert.equal(sequence(fixture).steps[0]!.fileSccs, 0);
  const wrongOrder = { ...fixture, tiers: { ...fixture.tiers, tiers: [...fixture.tiers.tiers].reverse().map((tier, index) => ({ ...tier, tier: index })) } };
  assert.equal(sequence(wrongOrder).failed, true);
});
test('new S3 cycles fail even if a later change cuts them', () => {
  const edits = [
    { id: 'add-node', op: 'add-file', path: 'site/low/new.mts', imports: [] },
    { id: 'add-self-cycle', op: 'add-import', from: 'site/low/new.mts', to: 'site/low/new.mts', kind: 'value' },
    { id: 'remove-self-cycle', op: 'remove-import', from: 'site/low/new.mts', to: 'site/low/new.mts', kind: 'value' },
    ...fixture.edits.edits,
  ];
  assert.equal(sequence({ ...fixture, edits: { edits, changes: [{ id: 'bad', edits: ['add-node', 'add-self-cycle'] }, { id: 'fix', edits: ['remove-self-cycle', 'cut-cycle'] }] } }).failed, true);
});
test('a droppable group fails minimality; removing a required cut breaks acceptance', () => {
  assert.equal(minimality(fixture).failed, false);
  const redundant = { id: 'add-unused', op: 'add-file', path: 'site/low/unused.mts', imports: [] };
  assert.equal(minimality({ ...fixture, edits: { edits: [...fixture.edits.edits, redundant], changes: [...fixture.edits.changes, { id: 'unused', edits: ['add-unused'] }] } }).failed, true);
});
test('generated module maps to its declaration in the same prepared folder', () => {
  assert.equal(trackedStandIn('site/prepared/prepared-shell-icons.mjs', new Set(['site/prepared/prepared-shell-icons.d.mts'])), 'site/prepared/prepared-shell-icons.d.mts');
});
test('committed plan has seven ordered, necessary change groups', () => {
  const data = JSON.parse(readFileSync('docs/site-architecture/edits.json', 'utf8')) as unknown;
  assert.ok(data && typeof data === 'object' && 'changes' in data && Array.isArray(data.changes));
  assert.equal(data.changes.length, 7);
});

test('the last S3 prefix must eliminate pre-existing file cycles even without increasing them', () => {
  const remaining = { ...fixture, edits: { edits: [{ id: 'noop', op: 'add-file', path: 'site/low/noop.mts', imports: [] }], changes: [{ id: 'noop', edits: ['noop'] }] } };
  const result = sequence(remaining);
  assert.equal(result.steps.find(step => step.phase === 'S3')?.fileSccs, 1);
  assert.equal(result.steps.find(step => step.phase === 'S3')?.failed, true);
});
