import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCameraHandover } from '../scene/camera-handover.mts';
import type { SceneSubject } from '../scene/scene-subject.mts';

function fixture({ canSwap = (): boolean => true } = {}) {
  const timers = new Map<number, () => void>(), documentTarget = new EventTarget();
  let serial = 0;
  const fetched: string[] = [], swaps: SceneSubject[] = [];
  let changes = 0;
  const handover = createCameraHandover({ documentTarget: documentTarget as unknown as Document,
    windowTarget: { setTimeout(callback: () => void) { timers.set(++serial, callback); return serial; }, clearTimeout(id: number) { timers.delete(id); } } as unknown as Window,
    mountedId: () => 'earth', canSwap, fetchAhead: id => fetched.push(id), onChange: () => { changes++; }, swap: next => swaps.push(next) });
  const motion = (active: boolean, coasting = false) => documentTarget.dispatchEvent(new CustomEvent('objectmotionchange', { detail: { active, coasting } }));
  const settle = () => { const pending = [...timers.values()]; timers.clear(); for (const run of pending) run(); };
  return { handover, motion, settle, timers, fetched, swaps, changes: () => changes };
}

test('a crossing shows at once; its scene is fetched and mounted when the camera rests', () => {
  const { handover, motion, settle, timers, fetched, swaps, changes } = fixture();
  motion(true);
  handover.cross({ objectId: 'milky-way' }, 'zoom-scope');
  assert.deepEqual(handover.subject, { objectId: 'milky-way' });
  assert.equal(changes(), 1, 'the world is told');
  assert.deepEqual([fetched, swaps, timers.size], [[], [], 0], 'while a hand drives the camera nothing is read and nothing waits');
  motion(true, true);
  assert.deepEqual([fetched, timers.size], [[], 0], 'nor while it coasts');
  motion(false);
  assert.deepEqual(fetched, ['milky-way'], 'at rest the scene the camera frames is read');
  assert.equal(timers.size, 1);
  settle();
  assert.deepEqual(swaps, [{ objectId: 'milky-way' }]);
  assert.deepEqual(fetched, ['milky-way'], 'read once');
  assert.deepEqual(handover.subject, { objectId: 'milky-way' }, 'the world keeps showing it until the scene has changed');
  handover.clear();
  assert.equal(handover.subject, null);
});

test('a zoom that crosses several scenes without resting mounts the last one only', () => {
  const { handover, motion, settle, fetched, swaps, changes } = fixture();
  motion(true);
  for (const id of ['milky-way', 'local-group', 'nearby-universe']) handover.cross({ objectId: id }, 'zoom-scope');
  handover.cross({ objectId: 'nearby-universe' }, 'zoom-scope');
  assert.equal(changes(), 3, 'the world follows each crossing, once');
  motion(false); settle();
  assert.deepEqual(fetched, ['nearby-universe']);
  assert.deepEqual(swaps, [{ objectId: 'nearby-universe' }]);
});

test('a camera that comes back before it rests leaves the mounted scene, and one that moves again waits again', () => {
  const { handover, motion, settle, timers, swaps, changes } = fixture();
  motion(true);
  handover.cross({ objectId: 'milky-way' }, 'zoom-scope');
  motion(false);
  motion(true);
  assert.equal(timers.size, 0, 'moving again withdraws the wait');
  handover.back();
  assert.equal(handover.subject, null);
  assert.equal(changes(), 2, 'the world is told of the return');
  motion(false); settle();
  assert.deepEqual(swaps, []);
  handover.back();
  assert.equal(changes(), 2, 'a return with nothing pending tells nobody');
});

test('a crossing with the camera at rest waits the settle time; a scene that cannot be replaced is left', () => {
  const still = fixture();
  still.handover.cross({ objectId: 'milky-way' }, 'overview-watcher');
  assert.deepEqual(still.fetched, ['milky-way']);
  still.settle();
  assert.deepEqual(still.swaps, [{ objectId: 'milky-way' }]);
  const busy = fixture({ canSwap: () => false });
  busy.handover.cross({ objectId: 'milky-way' }, 'zoom-scope');
  busy.settle();
  assert.deepEqual(busy.swaps, [], 'a navigation or a flight owns the camera');
  busy.handover.destroy();
  busy.motion(false);
  assert.equal(busy.timers.size, 0, 'and a destroyed owner hears nothing');
});
