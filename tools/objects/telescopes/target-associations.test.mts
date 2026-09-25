import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();

test('transport failures remain distinct from identity contradictions', async () => {
  const { loadTargetAssociations } = await import('./target-associations.mts');
  const { ArchiveTransportError, parseAstroqueryAnswer } = await import('@cssearth/telescope/node');
  const source = { target: 'nix', archive: 'mast' as const, collection: 'HST', observations: ['j96o01010'], evidence: [{ citation: 'paper', locator: 'table', establishes: 'field membership' }] };
  const failures: { collection: string; reason: string }[] = [];
  assert.deepEqual(await loadTargetAssociations([source], { failures, lookup: async () => { throw new ArchiveTransportError('timeout'); } }), []);
  assert.deepEqual(failures, [{ collection: 'HST', reason: 'timeout' }]);
  await assert.rejects(loadTargetAssociations([source], { failures, lookup: async () => { throw new TypeError('wrong collection'); } }), /wrong collection/);
  assert.throws(() => parseAstroqueryAnswer({ schema: 'cssearth-astroquery-answer@2', astroquery: '0.4.11', operation: 'mast-service', transportError: 'timeout' }, { operation: 'mast-service', service: 'x', parameters: {} }), ArchiveTransportError);
});
