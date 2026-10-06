import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readApplicationSystemView } from './world-system-views.mts';
import { readSystemViewFile } from './system-view-file.test-support.mts';

test('the default reader requests the host URL and preserves status and JSON failures', async t => {
  const requested: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string | URL | Request) => { requested.push(String(url)); return new Response('', { status: 404 }); });
  await assert.rejects(readApplicationSystemView('sun'), /Prepared system view request for sun failed: 404\./);
  assert.deepEqual(requested, ['/world/system-views/sun.json']);
  t.mock.method(globalThis, 'fetch', async () => new Response('{', { status: 200 }));
  await assert.rejects(readApplicationSystemView('sun'), SyntaxError);
  t.mock.method(globalThis, 'fetch', async () => Response.json(await readSystemViewFile('sun')));
  assert.deepEqual(await readApplicationSystemView('sun'), await readApplicationSystemView('sun', readSystemViewFile));
});

// Inline candidates exercise the reader/parser boundary without another prepared-file read.
test('system readers read and validate each requested host independently', async () => {
  const { APPLICATION_WORLD_CONTEXT: plan } = await import('../directory/world-context-plan.mts');
  const requested: string[] = [];
  for (const id of ['sun', 'jupiter']) {
    const host = [plan.focus, ...plan.bodies].find(body => body.id === id)!;
    const candidate = { cameraToReference: [1, 0, 0, 0, 1, 0, 0, 0, 1], minimumM: [-2, -3, -4], maximumM: [2, 3, 4],
      memberPositionsM: host.systemView!.memberIds.map(() => [0, 0, 0]) };
    const result = await readApplicationSystemView(id, async readId => {
      requested.push(readId);
      return { schema: 'cssearth-world-system-view@1', id: readId, candidates: [candidate] };
    });
    assert.deepEqual(result, { candidates: [candidate] });
    await assert.rejects(readApplicationSystemView(id, async () => ({ schema: 'cssearth-world-system-view@1', id: 'wrong', candidates: [candidate] })),
      new RegExp(`Prepared system view for ${id} names wrong`));
  }
  assert.deepEqual(requested, ['sun', 'jupiter']);
});
