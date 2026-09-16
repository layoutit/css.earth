import assert from 'node:assert/strict';
import test from 'node:test';
import { inventoryQuery } from '../../src/observations/archives.ts';

test('archive acquisition uses injected endpoint, angular window and transport without a catalogue owner', async () => {
  let requested = '', agent = '';
  const receipt = await inventoryQuery('irsa', { raDegrees: 42, decDegrees: -12, majorArcmin: null }, 10, {
    endpoint: 'https://archive.example/custom', radiusDegrees: .125,
    transport: { timeoutMs: 1000, userAgent: 'test-science-client', fetch: async (input, init) => {
      requested = String(input); agent = new Headers(init?.headers).get('User-Agent') ?? '';
      return new Response(JSON.stringify({ metadata: [{ name: 'obs_id' }], data: [] }), { status: 200 });
    } },
  });
  const url = new URL(requested);
  assert.equal(url.origin + url.pathname, 'https://archive.example/custom');
  assert.match(url.searchParams.get('QUERY')!, /CIRCLE\('ICRS',42,-12,0\.125\)/);
  assert.equal(agent, 'test-science-client');
  assert.equal(receipt.status, 'complete');
  assert.equal(receipt.matchedCount, 0);
  assert.match(receipt.responseSha256!, /^[a-f0-9]{64}$/);
});
