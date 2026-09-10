import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performance, PerformanceObserver } from 'node:perf_hooks';
import { webcrypto } from 'node:crypto';
import { createDiagnosticRecorder } from '../diagnostic-recorder.mts';
import { createNavigationTiming } from '../navigation-timing.mts';

function host() {
  const w = new EventTarget(), button = new EventTarget(), timers = new Map(), frames = new Map();
  Object.assign(w, { performance, PerformanceObserver, crypto: webcrypto,
    location: { href: 'http://localhost/sun/' }, navigator: { userAgent: 'Test Browser' },
    innerWidth: 1200, innerHeight: 800, devicePixelRatio: 2,
    setInterval(fn) { timers.set(1, fn); return 1; }, clearInterval(id) { timers.delete(id); },
    requestAnimationFrame(fn) { frames.set(1, fn); return 1; }, cancelAnimationFrame(id) { frames.delete(id); } });
  button.attributes = {}; button.setAttribute = (name, value) => { button.attributes[name] = value; };
  return { w, button, timers, frames };
}

test('records one correlated run, copies changing camera state, and is idle after stop', () => {
  const { w, button, timers, frames } = host(), downloads = [], camera = { x: 1 };
  const recorder = createDiagnosticRecorder({ windowTarget: w, button, capture: () => ({ camera }), download: result => downloads.push(result) });
  w.__cssEarthRecorder = recorder;
  assert.equal(timers.size + frames.size, 0);
  button.dispatchEvent(new Event('click'));
  const id = recorder.id;
  createNavigationTiming(w, 'sun', 'makemake').mark('mounted');
  frames.get(1)(100); frames.get(1)(120);
  camera.x = 7; timers.get(1)();
  button.dispatchEvent(new Event('click'));
  assert.equal(downloads.length, 1);
  const recording = downloads[0];
  assert.equal(recording.id, id);
  assert.equal(recording.samples[0].state.camera.x, 1);
  assert.equal(recording.samples[1].state.camera.x, 7);
  assert.deepEqual(recording.frames, [[120, 20]]);
  const mounted = recording.events.find(event => event.name === 'cssEarth:navigation:mounted');
  assert.equal(mounted.detail.recordingId, id);
  assert.equal(mounted.detail.to, 'makemake');
  assert.ok(recording.events.some(event => event.name === 'cssEarth:recording:stopped'));
  assert.equal(timers.size + frames.size, 0);
  assert.equal(recorder.id, null);
  assert.equal(button.attributes['aria-pressed'], 'false');
  recorder.start(); assert.notEqual(recorder.id, id);
  recorder.destroy(); assert.equal(downloads.length, 1);
  assert.equal(timers.size + frames.size, 0);
  button.dispatchEvent(new Event('click')); assert.equal(recorder.id, null);
});

test('a failed diagnostic read is captured without interrupting the application', () => {
  const { w, button } = host();
  const recorder = createDiagnosticRecorder({ windowTarget: w, button, capture() { throw new Error('unavailable owner'); }, download() {} });
  assert.doesNotThrow(() => recorder.start());
  assert.match(recorder.stop().samples[0].state.captureError, /unavailable owner/);
  recorder.destroy();
});
