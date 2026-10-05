import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSharedView } from '@cssearth/renderer/navigation';
import type { ObjectSharedView } from '@cssearth/renderer/runtime/object-scene.ts';
import { bindViewUrl } from './view-url-runtime.mts';
import { required } from '../test/navigation-test-values.mts';

const token = 'UcM-I2wcRENV2b3fvnbItDlXwOej1wo9cZ5BQsczQAAAAEAFN-vvz-Gyv9XjqHSKGu0AAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAA';
function fixture(initial = 'http://example.test/venus/?other=keep#info') {
  let href = initial, listener = () => {}, fail = false, saved = parseSharedView(`v=${token}`);
  const delays: number[] = [];
  const timers = new Map<number, () => void>(), writes: string[] = [], errors: unknown[] = [];
  const eventOptions: { action: string; type: string; options: unknown }[] = [];
  class DocumentTarget extends EventTarget {
    override addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean) { eventOptions.push({ action: 'add', type, options }); super.addEventListener(type, callback, options); }
    override removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean) { eventOptions.push({ action: 'remove', type, options }); super.removeEventListener(type, callback, options); }
  }
  const document = new DocumentTarget();
  const windowTarget = { document, location: { get href() { return href; } }, setTimeout(fn: () => void, delay: number) { delays.push(delay); timers.set(1, fn); return 1; }, clearTimeout(id: number) { timers.delete(id); } } as unknown as Window;
  const view: ObjectSharedView = { capture() { if (fail) throw new Error('capture failed'); return saved; }, async restore() { return true; }, subscribe(fn) { listener = fn; return () => { listener = () => {}; }; } };
  const owner = bindViewUrl({ windowTarget, view, getMotion: () => false, replace(url) { writes.push(url); href = url; }, onError: error => errors.push(error) });
  return { owner, writes, errors, timers, document, eventOptions, delays, change: () => listener(), fail() { fail = true; }, empty() { saved = null; }, run() { const fn = required(timers.get(1)); timers.delete(1); fn(); } };
}

test('URL start, flush and disposal guard publication while preserving unrelated URL bytes', () => {
  const f = fixture();
  f.owner.schedule(); f.owner.flush(); f.change(); assert.equal(f.timers.size, 0); assert.deepEqual(f.writes, []);
  f.owner.start(); f.owner.start(); assert.deepEqual(f.delays, [150]); assert.equal(f.timers.size, 1); f.run();
  const url = new URL(required(f.writes[0]));
  assert.equal(url.searchParams.get('v'), token); assert.equal(url.searchParams.get('other'), 'keep'); assert.equal(url.hash, '#info');
  f.owner.flush(); assert.equal(f.writes.length, 1);
  f.empty(); f.owner.flush(); assert.equal(f.writes.length, 1); assert.equal(f.owner.capture(), null);
  f.owner.schedule(); f.owner.destroy(); f.owner.destroy(); f.owner.start(); f.owner.schedule(); f.owner.flush(); f.change();
  assert.equal(f.timers.size, 0); assert.equal(f.writes.length, 1);
});

test('incoming token bytes remain pinned to their captured camera and capture failures are reported', () => {
  // The applied camera can differ after an incoming view round-trips through world coordinates.
  const incoming = 'UcM-Ei1af2mOcL3NtXwV-EjrwNYf3Nv5WthBQsczQAAAAEAFN-vvz-Gyv9XjqHSKGu0AAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAA';
  assert.ok(parseSharedView(`v=${incoming}`));
  const f = fixture(`http://example.test/venus/?v=${encodeURIComponent(incoming)}`);
  f.owner.start(incoming); assert.equal(f.owner.capture(), incoming); f.owner.flush(); assert.deepEqual(f.writes, []);
  f.empty(); assert.equal(f.owner.capture(), null);
  f.fail(); f.owner.flush(); assert.equal(f.errors.length, 1); assert.match(String(f.errors[0]), /capture failed/);
  const start = fixture(`http://example.test/venus/?v=${token}`); start.fail(); start.owner.start(token); assert.equal(start.errors.length, 1);
});

test('an absent motion payload ends a moving camera and releases its delayed write', () => {
  const f = fixture(); f.owner.start(); f.run();
  f.document.dispatchEvent(new CustomEvent('objectmotionchange', { detail: { active: true } }));
  f.owner.schedule(); assert.equal(f.timers.size, 0);
  f.document.dispatchEvent(new CustomEvent('objectmotionchange', { detail: { active: true } }));
  f.document.dispatchEvent(new Event('objectmotionchange'));
  assert.equal(f.timers.size, 1); f.run(); assert.equal(f.writes.length, 1);
});

test('motion listener registers and disposes in the capture phase', () => {
  const f = fixture();
  f.owner.destroy();
  assert.deepEqual(f.eventOptions, [
    { action: 'add', type: 'objectmotionchange', options: { capture: true } },
    { action: 'remove', type: 'objectmotionchange', options: { capture: true } },
  ]);
});


test('starting with an already matching URL camera schedules no publication', () => {
  const f = fixture(`http://example.test/venus/?v=${token}`);
  f.owner.start(token);
  assert.deepEqual(f.delays, []);
  assert.equal(f.timers.size, 0);
  assert.deepEqual(f.writes, []);
  assert.equal(f.owner.capture(), token);
  f.owner.destroy();
});
