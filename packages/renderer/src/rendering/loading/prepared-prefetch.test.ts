import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { prefetchPreparedResources } from './prepared-prefetch.js';
import { waitFor } from '@cssearth/objects/node/contract';

test('background preparation admits four bodies at a time, deduplicates and stops when destroyed', async () => {
  const controller = new AbortController(), releases: (() => void)[] = [];
  const calls: string[] = [];
  const fetcher = mock.fn<typeof fetch>(async input => {
    calls.push(String(input));
    const body = new Promise<ArrayBuffer>(resolve => releases.push(() => resolve(new ArrayBuffer(1))));
    return { arrayBuffer: () => body } as Response;
  });
  const complete = prefetchPreparedResources(['a', 'a', 'b', 'c', 'd', 'e', 'f', 'g'], fetcher, controller.signal);
  await Promise.resolve();
  assert.deepEqual(calls, ['a', 'b', 'c', 'd']);
  releases[0]!(); await waitFor(() => assert.deepEqual(calls, ['a', 'b', 'c', 'd', 'e']));
  controller.abort(); for (const release of releases) release();
  await complete;
  assert.deepEqual(calls, ['a', 'b', 'c', 'd', 'e']);
});

test('failed speculative requests do not stall the remaining prepared images', async () => {
  const calls: string[] = [];
  const fetcher = mock.fn<typeof fetch>(async input => {
    calls.push(String(input));
    if (input === 'a') throw new Error('Network unavailable');
    return new Response(new Uint8Array([1]));
  });
  await prefetchPreparedResources(['a', 'b', 'c', 'd', 'e'], fetcher, new AbortController().signal);
  assert.deepEqual(calls, ['a', 'b', 'c', 'd', 'e']);
});
