/** Native protocol completion must clear pending initialization before queued delivery. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { PROBE } from './probe.mts';
const start = PROBE.indexOf('  const NativeWorker = window.Worker;'), end = PROBE.indexOf('  const decodedImages = new Map();');
assert.ok(start >= 0 && end > start);
const code = PROBE.slice(start, end);
const clearError = "        if (event.data && typeof event.data.error === 'string') jobs.clear();\n";
function completion(source: string, request: unknown, reply: unknown) {
  const output: unknown = runInNewContext(`
    const workers = new Map(), workerReplies = [], releasedReplies = new WeakSet(), errors = [];
    let workerSerial = 0, messages = 0;
    class FixtureWorker extends EventTarget { postMessage() {} terminate() {} }
    const window = { Worker: FixtureWorker, __journeyScheduleWorkers: true };
    ${source}
    const worker = new window.Worker(); worker.postMessage(request);
    worker.dispatchEvent(new MessageEvent('message', { data: reply }));
    JSON.stringify({ jobs: workers.get(worker).size, queued: workerReplies.length, errors: errors.length, messages });
  `, { EventTarget, MessageEvent, request, reply });
  if (typeof output !== 'string') throw new Error('Invalid scheduler fixture output');
  const value: unknown = JSON.parse(output);
  if (!value || typeof value !== 'object' || !('jobs' in value) || typeof value.jobs !== 'number'
    || !('queued' in value) || typeof value.queued !== 'number' || !('errors' in value) || typeof value.errors !== 'number'
    || !('messages' in value) || typeof value.messages !== 'number') throw new Error('Invalid scheduler result');
  return value;
}
for (const [name, request, reply] of [
  ['initialization ready', { validatedPlan: true }, { ready: true }],
  ['initialization error', { validatedPlan: true }, { error: 'invalid plan' }],
  ['numeric completion', { id: 7 }, { id: 7 }],
] as const) test(`native ${name} permits queued delivery`, () => {
  assert.deepEqual(completion(code, request, reply), { jobs: 0, queued: 1, errors: 0, messages: 0 });
});
test('deleting native error completion makes the default initialization assertion fail', () => {
  assert.equal(code.split(clearError).length - 1, 1);
  const result = completion(code.replace(clearError, ''), { validatedPlan: true }, { error: 'invalid plan' });
  const requireComplete = () => assert.equal(result.jobs, 0, 'Initialization failure left a pending job');
  assert.throws(requireComplete, /Initialization failure left a pending job/u);
});
