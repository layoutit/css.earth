import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPreparedWorldNavigation } from '../prepared-world-navigation.mjs';

const identity = [1,0,0,0,1,0,0,0,1];
function fixture() {
  const frames = [0, 1].map(index => ({ referenceFrame: 'world', epochJdTt: 1,
    originM: [index * 1e8, 0, 0], presentationToReference: identity, metersPerUnit: 1, bodyRadiusM: 1000,
    orbitUpReference: [0,1,0] }));
  const objects = frames.map((worldFrame, index) => ({ id: String(index), worldFrame }));
  const callbacks = new Map(), documentTarget = new EventTarget();
  let next = 0, current = { referenceFrame: 'world', epochJdTt: 1,
    pose: { positionM: [0,0,10000], orientationXyzw: [0,0,0,1] } };
  const paints = [], resources = { destroyed: 0, destroy() { this.destroyed++; } };
  const windowTarget = { requestAnimationFrame(fn) { callbacks.set(++next, fn); return next; },
    cancelAnimationFrame(id) { callbacks.delete(id); } };
  const navigation = { frame: frames[0], capture: () => current,
    optics: () => ({ focalPixels: 1000, principalOffsetPixels: [0,0], framingRadiusPixels: 200 }),
    apply(value) { current = value; paints.push(value); } };
  const factory = { navigation: { frame: frames[1], prepare: async () => ({ resources }) } };
  const service = createPreparedWorldNavigation({ objects, windowTarget, documentTarget });
  const controller = new AbortController();
  return { service, controller, resources, navigation, factory, paints, documentTarget,
    start(options = {}) { return service.prepare({ fromId: '0', toId: '1', fromMount: { navigation },
      toFactory: factory, signal: controller.signal, reducedMotion: false, ...options }); },
    tick(time) { const entries = [...callbacks.values()]; callbacks.clear(); for (const fn of entries) fn(time); },
    get pending() { return callbacks.size; } };
}

test('flight retains the actual departure, paints intermediate world poses, and hands off identical arrival', async () => {
  const f = fixture(), initial = f.navigation.capture(), task = f.start();
  f.tick(100); assert.deepEqual(f.paints[0], initial);
  f.tick(1100); assert.notDeepEqual(f.paints.at(-1), initial);
  f.tick(5100); const handoff = await task;
  const last = f.paints.at(-1);
  assert.deepEqual(handoff.mountOptions.initialWorldCamera, last);
  assert.equal(handoff.mountOptions.preparedResources, f.resources);
  const mounted = { navigation: { ...f.navigation, frame: f.factory.navigation.frame } };
  await handoff.afterMount(mounted, { signal: f.controller.signal });
  assert.deepEqual(f.paints.at(-1), last);
  assert.equal(f.pending, 0);
});

test('new selection cancellation stops painting and releases destination preparation', async () => {
  const f = fixture(), task = f.start();
  f.tick(0); f.tick(400); const count = f.paints.length;
  f.controller.abort();
  await assert.rejects(task, { name: 'AbortError' });
  f.tick(6000); assert.equal(f.paints.length, count);
  assert.equal(f.pending, 0); assert.equal(f.resources.destroyed, 1);
});

test('real camera input interrupts at the last drawn pose and requests URL preservation', async () => {
  const f = fixture(), task = f.start();
  f.tick(0); f.tick(500);
  const event = new Event('wheel');
  Object.defineProperty(event, 'target', { value: { closest: () => true } });
  f.documentTarget.dispatchEvent(event);
  await assert.rejects(task, error => error.name === 'AbortError' && error.preserveView === true);
  assert.equal(f.pending, 0); assert.equal(f.resources.destroyed, 1);
});

test('reduced motion lands in one paint and unsupported frames keep normal links', async () => {
  const f = fixture(), task = f.start({ reducedMotion: true });
  assert.equal(f.service.supports('0', '1'), true);
  assert.equal(f.service.supports('0', 'unprepared'), false);
  f.tick(0); const handoff = await task;
  assert.equal(f.paints.length, 1);
  await handoff.afterMount({ navigation: f.navigation }, { signal: f.controller.signal });
  assert.equal(f.pending, 0);
});
