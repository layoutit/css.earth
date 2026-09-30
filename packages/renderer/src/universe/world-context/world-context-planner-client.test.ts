import { readFile } from 'node:fs/promises';
import { expect, test, vi } from 'vitest';
import { parsePreparedWorldContextSummary } from '../../prepared-data/world-context.js';
import type { WorldPlannerInitialise, WorldPlannerWorker } from './world-context-planner-client.js';
import { createWorldContextPlannerClient } from './world-context-planner-client.js';

const summaryText = await readFile(new URL('../../../../../src/objects/sun/prepared/world-context-summary.json', import.meta.url), 'utf8');
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
  expect((validated.posted[0] as WorldPlannerInitialise).validatedPlan).toBe(summary);

  // Anything else (a clone, a hand-built value) is validated before the envelope carries it.
  const cloned = recordingWorker();
  createWorldContextPlannerClient(structuredClone(summary), cloned.create, {}, source).destroy();
  const sent = (cloned.posted[0] as WorldPlannerInitialise).validatedPlan;
  expect(sent).not.toBe(summary);
  expect(Object.isFrozen(sent)).toBe(true);
  expect(sent.bodies.length).toBe(summary.bodies.length);

  const forged = { ...structuredClone(summary), bodies: [{ id: 'Not An Id' }] };
  expect(() => createWorldContextPlannerClient(forged as never, recordingWorker().create, {}, source)).toThrow(TypeError);
});

test('the planner worker starts from the vouched summary clone', async () => {
  const replies: unknown[] = [];
  vi.stubGlobal('postMessage', (value: unknown) => { replies.push(value); });
  try {
    await import('./world-context-planner-worker.js');
    const scope = globalThis as unknown as { onmessage(event: { data: WorldPlannerInitialise }): void };
    const message: WorldPlannerInitialise = { validatedPlan: structuredClone(summary), source, annotationPriorities: {}, annotationLandmarks: [] };
    scope.onmessage({ data: message });
    expect(replies).toEqual([{ ready: true }]);
  } finally {
    vi.unstubAllGlobals();
  }
});
