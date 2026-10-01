import { test } from 'node:test';
import assert from 'node:assert/strict';
import { afterStartup, holdStartup, releaseStartup, startupOpen } from './startup-gate.js';

function idleWindow() {
  const idle: (() => void)[] = [];
  const target = { requestIdleCallback: (run: () => void) => { idle.push(run); return idle.length; },
    setTimeout: () => { throw new Error('An idle-capable window waits for idle.'); } } as unknown as Window;
  return { target, idle };
}

test('a document that never holds its gate loads at once', () => {
  const { target } = idleWindow();
  const loaded: string[] = [];
  afterStartup(target, () => loaded.push('dots'));
  afterStartup(null, () => loaded.push('detached'));
  assert.deepEqual(loaded, ['dots', 'detached']);
  assert.equal(startupOpen(target), true);
});

test('a held gate queues loads until it is released and the browser is idle, in order', () => {
  const { target, idle } = idleWindow();
  holdStartup(target);
  const loaded: string[] = [];
  afterStartup(target, () => loaded.push('dots'));
  afterStartup(target, () => loaded.push('sky'));
  assert.equal(loaded.length, 0);
  releaseStartup(target);
  assert.equal(loaded.length, 0, 'release waits for idle');
  assert.equal(startupOpen(target), false);
  afterStartup(target, () => loaded.push('backing'));
  releaseStartup(target);
  assert.equal(idle.length, 1, 'a second release schedules nothing');
  idle[0]!();
  assert.deepEqual(loaded, ['dots', 'sky', 'backing']);
  assert.equal(startupOpen(target), true);
  afterStartup(target, () => loaded.push('later'));
  assert.deepEqual(loaded.at(-1), 'later', 'an open gate runs at once');
});

test('a document holds its gate once', () => {
  const { target, idle } = idleWindow();
  holdStartup(target);
  releaseStartup(target);
  idle[0]!();
  holdStartup(target);
  const loaded: string[] = [];
  afterStartup(target, () => loaded.push('dots'));
  assert.deepEqual(loaded, ['dots']);
});

test('without idle callbacks the released gate drains on the next task', () => {
  const timers: (() => void)[] = [];
  const target = { setTimeout: (run: () => void) => { timers.push(run); return timers.length; } } as unknown as Window;
  holdStartup(target);
  const loaded: string[] = [];
  afterStartup(target, () => loaded.push('dots'));
  releaseStartup(target);
  assert.equal(loaded.length, 0);
  timers[0]!();
  assert.deepEqual(loaded, ['dots']);
});
