import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

export const REPRESENTATION_RECEIPT_SCHEMA = 'cssearth-prepared-representation-receipt@1';
export const representationHash = value => createHash('sha256').update(
  typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const hash = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const facts = ['nodes', 'camera', 'frames', 'controls', 'resources'];

// The capture harness remains unchanged on both sides. This receipt qualifies
// representation changes only; camera/selection, raster and pixel comparisons
// are performed separately and cannot be waived by a receipt.
export function requireRepresentationReceipt(receipt, { objectId, baselineSource, candidateSource,
  before, after, baselineFacts, candidateFacts, behaviorCorrection = null }) {
  assert.equal(receipt?.schema, REPRESENTATION_RECEIPT_SCHEMA, 'Representation receipt schema');
  assert.equal(receipt.objectId, objectId, 'Representation object identity');
  assert.ok(hash(baselineSource) && hash(candidateSource), 'Both source snapshots must be bound');
  assert.equal(receipt.baselineSource, baselineSource, 'Representation baseline source');
  assert.equal(receipt.candidateSource, candidateSource, 'Representation candidate source');
  assert.deepEqual(receipt.before, before, 'Exact original prepared file hashes');
  assert.deepEqual(receipt.after, after, 'Exact candidate prepared file hashes');
  const changes = Object.keys({ ...before, ...after }).filter(path => before[path] !== after[path]).sort();
  assert.deepEqual(receipt.changes.map(change => change.path).sort(), changes, 'Every changed prepared file must be declared exactly once');
  assert.equal(new Set(receipt.changes.map(change => change.path)).size, changes.length, 'No duplicate representation changes');
  for (const change of receipt.changes) {
    assert.equal(change.before, before[change.path] ?? null, 'Original change hash');
    assert.equal(change.after, after[change.path] ?? null, 'Candidate change hash');
    assert.ok((change.before === null || hash(change.before)) && (change.after === null || hash(change.after)), 'Prepared hashes are SHA256');
    assert.ok(Array.isArray(change.inputs) && change.inputs.length > 0, 'Representation must name its original inputs');
    for (const input of change.inputs) {
      assert.ok(Object.hasOwn(before, input.path), 'Representation input must belong to the sealed original');
      assert.equal(input.sha256, before[input.path], 'Representation input hash');
    }
  }
  assert.ok(baselineFacts && candidateFacts, 'Independent semantic observations are required');
  for (const name of facts) {
    assert.ok(Object.hasOwn(baselineFacts, name) && Object.hasOwn(candidateFacts, name), `Missing semantic ${name}`);
    assert.equal(receipt.witnesses?.before?.[name], representationHash(baselineFacts[name]), `Original ${name} witness`);
    assert.equal(receipt.witnesses?.after?.[name], representationHash(candidateFacts[name]), `Candidate ${name} witness`);
    if (name === 'controls' && behaviorCorrection) {
      assert.ok(isDeepStrictEqual(behaviorCorrection.before, baselineFacts.controls), 'Exact legacy control behavior');
      assert.ok(isDeepStrictEqual(behaviorCorrection.after, candidateFacts.controls), 'Exact corrected control behavior');
      assert.equal(behaviorCorrection.kind, 'exclusive-interior-lens', 'Only the specified control correction is accepted');
    } else assert.ok(isDeepStrictEqual(candidateFacts[name], baselineFacts[name]), `Prepared ${name} correspondence`);
  }
  return receipt;
}

export function createRepresentationReceipt({ objectId, baselineSource, candidateSource, before, after,
  inputPaths, baselineFacts, candidateFacts, behaviorCorrection }) {
  const witnesses = value => Object.fromEntries(facts.map(name => [name, representationHash(value[name])]));
  const receipt = { schema: REPRESENTATION_RECEIPT_SCHEMA, objectId, baselineSource, candidateSource, before, after,
    changes: Object.keys({ ...before, ...after }).filter(path => before[path] !== after[path]).sort().map(path => ({
      path, before: before[path] ?? null, after: after[path] ?? null,
      inputs: inputPaths.map(path => ({ path, sha256: before[path] })),
    })), witnesses: { before: witnesses(baselineFacts), after: witnesses(candidateFacts) } };
  return requireRepresentationReceipt(receipt, { objectId, baselineSource, candidateSource, before, after,
    baselineFacts, candidateFacts, behaviorCorrection });
}
