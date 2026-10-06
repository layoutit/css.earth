import assert from 'node:assert/strict';
import { test } from 'node:test';
import { queuedImport } from './import-queue.mts';

const deferred = <Value,>() => { let resolve!: (value: Value) => void, reject!: (error: unknown) => void; const promise = new Promise<Value>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const turn = () => new Promise(resolve => setTimeout(resolve, 0));

test('a queued import starts only when the one before it has settled, and runs once for every caller', async () => {
  const first = deferred<string>(), second = deferred<string>(), started: string[] = [];
  const loadFirst = queuedImport(() => { started.push('first'); return first.promise; });
  const loadSecond = queuedImport(() => { started.push('second'); return second.promise; });
  const a = loadFirst(), b = loadSecond(), again = loadFirst();
  assert.equal(again, a, 'one promise for every caller');
  await turn();
  assert.deepEqual(started, ['first'], 'the second import waits while the first is in flight');
  first.resolve('one');
  await turn();
  assert.deepEqual(started, ['first', 'second']);
  second.resolve('two');
  assert.deepEqual(await Promise.all([a, b]), ['one', 'two']);
});

test('a failed import does not hold the queue, and the next caller asks again', async () => {
  let attempts = 0;
  const flaky = queuedImport(async () => { if (++attempts === 1) throw new Error('offline'); return 'loaded'; });
  const after = queuedImport(async () => 'after');
  await assert.rejects(flaky(), /offline/u);
  assert.equal(await after(), 'after');
  assert.equal(await flaky(), 'loaded');
  assert.equal(attempts, 2);
});
