import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createProcessingJobs } from './service.ts';

test('durable jobs accept validated operation scopes without star-removal request fields', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nebula-generic-job-'));
  const options = {
    namespace: 'fixture-operation',
    parseRequest(value: unknown) {
      if (!value || typeof value !== 'object' || !('target' in value) || value.target !== 'cloud')
        throw new TypeError('Unknown target.');
      return { target: value.target };
    },
    requestKey: (request: { target: string }) => request.target,
    sample: async () => 'verified',
    validateResult: async (value: unknown) => { assert.equal(value, 'verified'); },
  };
  try {
    const first = createProcessingJobs(root, options), requestId = crypto.randomUUID();
    await first.start({ requestId, request: { target: 'cloud' } });
    await first.idle();
    assert.equal((await first.get(requestId)).status, 'completed');
    await first.shutdown();
    const restored = createProcessingJobs(root, options);
    assert.equal((await restored.get(requestId)).result, 'verified');
    await restored.shutdown();
  } finally { await rm(root, { recursive: true, force: true }); }
});
