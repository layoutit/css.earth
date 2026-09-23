import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { createSceneSessions } from '../scene-session.mts';
import { createPreparedSceneOwnership } from '../prepared-scene-ownership.mts';
import type { SceneFactory } from '../browser-types.mts';
import type { ObjectSceneLifecycle } from '../../src/renderers/css/runtime/deferred-object-mount.js';
import { unusedSharedView } from './navigation-test-values.mts';

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture() {
  const scenes = createSceneSessions(), errors: unknown[] = [], calls: string[] = [];
  const options = { objectId: 'mercury', onFailure(session: ReturnType<typeof scenes.start>, error: unknown) {
    errors.push(error, ...session.dispose(error));
  }, onCleanupError(error: unknown) { errors.push(error); } };
  const session = scenes.start(options);
  const native = (ready = Promise.resolve()): ObjectSceneLifecycle => ({
    ready, sharedView: unusedSharedView,
    pause() { calls.push('pause'); }, resume() { calls.push('resume'); }, destroy() { calls.push('destroy'); },
  });
  return { scenes, session, options, errors, calls, native, stage: {} as HTMLElement };
}

test('readiness waits for native activation and restoration; one session commands playback and teardown', async () => {
  const h = fixture(), ready = deferred<void>(), mounted = deferred<void>();
  const work = h.session.activate(() => { mounted.resolve(); return h.native(ready.promise); }, h.stage, {});
  await mounted.promise;
  assert.equal(h.session.commit(), false, 'A native mount alone cannot publish readiness');
  h.session.play(true); assert.deepEqual(h.calls, ['pause']);
  assert.throws(() => h.scenes.start(h.options), /Retire the current scene/);
  ready.resolve(); assert.equal(await work, true);
  assert.equal(h.session.state.kind, 'loading', 'Dataset and saved-view restoration still precede commit');
  assert.equal(h.session.commit(), true);
  h.session.play(true); h.session.play(true);
  assert.equal(h.session.playing, true); assert.deepEqual(h.calls, ['pause', 'resume']);
  h.session.dispose(); h.session.dispose();
  assert.equal(h.session.signal.aborted, true); assert.equal(h.scenes.current, null);
  assert.equal(h.scenes.state.kind, 'disposed'); assert.deepEqual(h.calls, ['pause', 'resume', 'destroy']);
  assert.equal(h.session.commit(), false);
});

test('a late factory cannot mount or replace the next session after cancellation', async () => {
  const h = fixture(), factory = deferred<SceneFactory>();
  const old = h.session.activate(factory.promise, h.stage, {});
  h.session.dispose(); assert.equal(await old, false);
  const next = h.scenes.start(h.options);
  await next.activate(() => h.native(), h.stage, {}); next.commit();
  factory.resolve(() => { assert.fail('The retired factory must not mount'); });
  await Promise.resolve();
  assert.equal(h.scenes.current, next); assert.equal(h.scenes.state.kind, 'ready');
  assert.deepEqual(h.errors, []); next.dispose();
});

test('a transferred prepared bank survives request completion and releases on scene teardown', async () => {
  const h = fixture(), request = new AbortController(), ownership = createPreparedSceneOwnership(request.signal);
  let released = 0;
  ownership.own({ destroy() { released++; } });
  assert.equal(await h.session.activate(() => h.native(), h.stage, {}, {
    mountOptions: {}, transferTo: ownership.transferTo, async afterMount() {},
  }), true);
  request.abort();
  assert.equal(ownership.signal.aborted, false); assert.equal(released, 0);
  assert.throws(() => ownership.transferTo(new AbortController().signal), /already belongs/);
  h.session.dispose(); ownership.dispose();
  assert.equal(ownership.signal.aborted, true); assert.equal(released, 1);
});

test('failed activation releases transferred preparation even when the factory throws before returning a mount', async () => {
  const h = fixture(), request = new AbortController(), ownership = createPreparedSceneOwnership(request.signal);
  const failure = new Error('factory rejected its prepared bank'); let released = 0;
  ownership.own({ destroy() { released++; } });
  await assert.rejects(h.session.activate(() => { throw failure; }, h.stage, {}, {
    mountOptions: {}, transferTo: ownership.transferTo, async afterMount() {},
  }), failure);
  h.session.dispose(failure);
  assert.equal(h.scenes.state.kind, 'failed'); assert.equal(h.scenes.current, null);
  assert.equal(released, 1); assert.equal(request.signal.aborted, false);
});

test('cancellation before handoff releases a late bank and forbids transfer', () => {
  const request = new AbortController(), ownership = createPreparedSceneOwnership(request.signal);
  request.abort(); let released = 0;
  ownership.own({ destroy() { released++; } });
  assert.equal(ownership.signal.aborted, true); assert.equal(released, 1);
  assert.throws(() => ownership.transferTo(new AbortController().signal), { name: 'AbortError' });
  ownership.dispose(); assert.equal(released, 1);
});

test('URL replacement stays bounded and flush failures cannot skip native or binding cleanup', async () => {
  const h = fixture(); let oldReleased = 0, currentReleased = 0;
  await h.session.activate(() => h.native(), h.stage, {}); h.session.commit();
  h.session.setViewUrl({ start() {}, capture: () => null, schedule() {}, flush() {}, destroy() { oldReleased++; } });
  h.session.setViewUrl({ start() {}, capture: () => null, schedule() {},
    flush() { assert.equal(h.scenes.current, null); throw new Error('flush failed'); },
    destroy() { currentReleased++; throw new Error('binding cleanup failed'); },
  });
  assert.equal(oldReleased, 1);
  const errors = h.session.dispose();
  assert.deepEqual(errors.map(error => error instanceof Error ? error.message : error), ['flush failed', 'binding cleanup failed']);
  assert.equal(currentReleased, 1); assert.equal(h.session.signal.aborted, true);
  assert.deepEqual(h.calls, ['pause', 'destroy']);
  assert.deepEqual(h.session.dispose(), []);
});
