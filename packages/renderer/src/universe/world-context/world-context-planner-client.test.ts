import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { parsePreparedWorldContextSummary } from '@cssearth/objects';
import type { WorldPlannerInitialise, WorldPlannerWorker } from './world-context-planner-client.js';
import { createWorldContextPlannerClient } from './world-context-planner-client.js';
import { stubGlobal, unstubAllGlobals } from '@cssearth/objects/node/contract';

const summaryText = await readFile(new URL('../../../../../src/objects/observable-universe/prepared/world.json', import.meta.url), 'utf8');
const summary = parsePreparedWorldContextSummary(JSON.parse(summaryText));
const source = { orbitBanksUrl: '/world/orbits/' };

function recordingWorker() {
  const posted: unknown[] = [];
  const worker: WorldPlannerWorker = { onmessage: null, onerror: null, postMessage: value => { posted.push(value); }, terminate() {} };
  return { posted, create: () => worker };
}

test('the client vouches only for a plan validated on its own thread', () => {
  const validated = recordingWorker();
  createWorldContextPlannerClient(summary, validated.create, {}, source).destroy();
  // The thread's own validated plan crosses as is: validation is not repeated here or in the worker.
  assert.equal((validated.posted[0] as WorldPlannerInitialise).validatedPlan, summary);

  // Anything else (a clone, a hand-built value) is validated before the envelope carries it.
  const cloned = recordingWorker();
  createWorldContextPlannerClient(structuredClone(summary), cloned.create, {}, source).destroy();
  const sent = (cloned.posted[0] as WorldPlannerInitialise).validatedPlan;
  assert.notEqual(sent, summary);
  assert.equal(Object.isFrozen(sent), true);
  assert.equal(sent.bodies.length, summary.bodies.length);

  const forged = { ...structuredClone(summary), bodies: [{ id: 'Not An Id' }] };
  assert.throws(() => createWorldContextPlannerClient(forged as never, recordingWorker().create, {}, source), TypeError);
});

test('the planner worker starts from the vouched summary clone', async () => {
  const replies: unknown[] = [];
  stubGlobal('postMessage', (value: unknown) => { replies.push(value); });
  try {
    await import('./world-context-planner-worker.js');
    const scope = globalThis as unknown as { onmessage(event: { data: WorldPlannerInitialise }): void };
    const message: WorldPlannerInitialise = { validatedPlan: structuredClone(summary), source, annotationPriorities: {}, annotationLandmarks: [] };
    scope.onmessage({ data: message });
    assert.deepEqual(replies, [{ ready: true }]);
  } finally {
    unstubAllGlobals();
  }
});
