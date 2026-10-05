import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSharedView } from '@cssearth/renderer/navigation';
import type { ObjectSharedView } from '@cssearth/renderer/runtime/object-scene.ts';
import { bindViewUrl } from '../view-url-runtime.mts';

// Two Venus views recorded on the iPad (rest, then a deep zoom), 2026-09-30.
const REST = 'UcM-I2wcRENV2b3fvnbItDlXwOej1wo9cZ5BQsczQAAAAEAFN-vvz-Gyv9XjqHSKGu0AAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAA';
const DEEP = 'UcM-Ei1af2mOcL3NtXwV-EjrwNYf3Nv5WthBQsczQAAAAEAFN-vvz-Gyv9XjqHSKGu0AAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAA';

function fixture({ motion = false } = {}) {
  let now = 0, id = 0, href = 'http://example.test/venus/', current = REST;
  const timers = new Map<number, { at: number; callback: () => void }>(), writes: string[] = [], listeners = new Set<() => void>();
  const documentTarget = new EventTarget();
  const windowTarget = {
    document: documentTarget,
    location: { get href() { return href; } },
    setTimeout(callback: () => void, delay: number) { timers.set(++id, { at: now + delay, callback }); return id; },
    clearTimeout(timer: number) { timers.delete(timer); },
  } as unknown as Window;
  const view: ObjectSharedView = {
    capture: () => parseSharedView(`v=${current}`),
    restore: async () => true,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
  const owner = bindViewUrl({ windowTarget, view, getMotion: () => motion, replace(url) { writes.push(url); href = url; } });
  return {
    owner, writes, timers: () => timers.size,
    /** The camera publishes a new view. */
    move(token: string) { current = token; for (const listener of listeners) listener(); },
    motion(active: boolean) { documentTarget.dispatchEvent(new CustomEvent('objectmotionchange', { detail: { active, coasting: false } })); },
    advance(ms: number) {
      now += ms;
      for (const [key, timer] of [...timers].sort((a, b) => a[1].at - b[1].at)) if (timer.at <= now) { timers.delete(key); timer.callback(); }
    },
  };
}

test('a gesture writes the URL once, after the camera has rested a quiet period, and runs no timer while it moves', () => {
  const f = fixture();
  f.owner.start();
  f.advance(200);
  assert.equal(f.writes.length, 1, 'the arrival view is written once');
  f.motion(true);
  for (let frame = 0; frame < 60; frame++) { f.move(frame % 2 ? REST : DEEP); f.advance(16); }
  f.move(DEEP);
  assert.equal(f.timers(), 0, 'no timer runs while the camera moves');
  assert.equal(f.writes.length, 1, 'nothing is written during the gesture');
  f.motion(false);
  assert.equal(f.writes.length, 1, 'rest waits a quiet period');
  // A second wheel notch inside the quiet period joins the same interaction.
  f.advance(100); f.motion(true); f.move(REST); f.move(DEEP); f.motion(false);
  f.advance(149);
  assert.equal(f.writes.length, 1);
  f.advance(1);
  assert.equal(f.writes.length, 2, 'the run of notches writes once, at its end');
  assert.match(f.writes.at(-1)!, new RegExp(`v=${DEEP}`));
  f.motion(true); f.motion(false); f.advance(200);
  assert.equal(f.writes.length, 2, 'a gesture that changed nothing writes nothing');
});

test('a change at rest writes once after a quiet period; playback rotation writes nothing', () => {
  const f = fixture();
  f.owner.start(); f.advance(200);
  f.move(REST); f.advance(100); f.move(DEEP); f.advance(100);
  assert.equal(f.writes.length, 1, 'the quiet period restarts with each change');
  f.advance(100);
  assert.equal(f.writes.length, 2);
  const playing = fixture({ motion: true });
  playing.owner.start(); playing.advance(200);
  for (let frame = 0; frame < 120; frame++) { playing.move(frame % 2 ? REST : DEEP); playing.advance(16); }
  assert.equal(playing.writes.length, 1, 'rotation is not an interaction');
  assert.equal(playing.timers(), 0);
});
