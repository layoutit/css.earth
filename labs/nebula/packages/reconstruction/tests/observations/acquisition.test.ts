import assert from 'node:assert/strict';
import test from 'node:test';
import { inventoryQuery } from '../../src/observations/archives.ts';

test('archive acquisition uses injected endpoint, angular window and table reader without a catalogue owner', async () => {
  let asked: { endpoint: string; query: string; maxRecords: number } | undefined;
  const receipt = await inventoryQuery('irsa', { raDegrees: 42, decDegrees: -12, majorArcmin: null }, 10, {
    endpoint: 'https://archive.example/custom', radiusDegrees: .125,
    table: async (endpoint, query, maxRecords) => { asked = { endpoint, query, maxRecords }; return { rows: [], overflow: false }; },
  });
  assert.equal(asked?.endpoint, 'https://archive.example/custom');
  assert.match(asked!.query, /CIRCLE\('ICRS',42,-12,0\.125\)/);
  assert.equal(asked!.maxRecords, 11);
  assert.equal(receipt.status, 'complete');
  assert.equal(receipt.matchedCount, 0);
});
