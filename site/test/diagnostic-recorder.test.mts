import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import { performance, PerformanceObserver } from 'node:perf_hooks';
import { webcrypto } from 'node:crypto';
import { createDiagnosticRecorder } from '../diagnostic-recorder.mts';
import type { BrowserWindow } from '../browser-types.mts';
import { record } from '../browser-types.mts';
import { required } from './navigation-test-values.mts';
import { createNavigationTiming } from '../navigation/navigation-timing.mts';

function host() {
  const timers = new Map<number, () => void>(), frames = new Map<number, FrameRequestCallback>();
  const w = Object.assign(new EventTarget(), { performance, PerformanceObserver, crypto: webcrypto,
    location: { href: 'http://localhost/sun/' }, navigator: { userAgent: 'Test Browser' },
    innerWidth: 1200, innerHeight: 800, devicePixelRatio: 2,
    setInterval(fn: () => void) { timers.set(1, fn); return 1; }, clearInterval(id: number) { timers.delete(id); },
    requestAnimationFrame(fn: FrameRequestCallback) { frames.set(1, fn); return 1; }, cancelAnimationFrame(id: number) { frames.delete(id); } });
  const attributes: Record<string, string> = {};
  const button = Object.assign(new EventTarget(), { attributes, textContent: '', setAttribute(name: string, value: string) { attributes[name] = value; } });
  // Native event dispatch and the exact timer/attribute surface used by this recorder.
  return { w: w as unknown as BrowserWindow, button: button as unknown as HTMLElement, attributes, timers, frames };
}

test('records one correlated run, copies changing camera state, and is idle after stop', () => {
  const { w, button, attributes, timers, frames } = host();
  const downloads: Parameters<Parameters<typeof createDiagnosticRecorder>[0]['download']>[0][] = [], camera = { x: 1 };
  const recorder = createDiagnosticRecorder({ windowTarget: w, button, capture: () => ({ camera }), download: result => downloads.push(result) });
  w.__cssEarthRecorder = recorder;
  assert.equal(timers.size + frames.size, 0);
  button.dispatchEvent(new Event('click'));
  const id = recorder.id;
  createNavigationTiming(w, 'sun', 'makemake').mark('mounted');
  required(frames.get(1))(100); required(frames.get(1))(120);
  camera.x = 7; required(timers.get(1))();
  button.dispatchEvent(new Event('click'));
  assert.equal(downloads.length, 1);
  const recording = downloads[0];
  assert.equal(recording.id, id);
  for (const [index, expected] of [[0, 1], [1, 7]]) {
    const state = recording.samples[index].state;
    assert.ok(record(state) && record(state.camera));
    assert.equal(state.camera.x, expected);
  }
  assert.deepEqual(recording.frames, [[120, 20]]);
  const mounted = recording.events.find(event => event.name === 'cssEarth:navigation:mounted');
  assert.ok(mounted && record(mounted.detail));
  assert.equal(mounted.detail.recordingId, id);
  assert.equal(mounted.detail.to, 'makemake');
  assert.ok(recording.events.some(event => event.name === 'cssEarth:recording:stopped'));
  assert.equal(timers.size + frames.size, 0);
  assert.equal(recorder.id, null);
  assert.equal(attributes['aria-pressed'], 'false');
  recorder.start(); assert.notEqual(recorder.id, id);
  recorder.destroy(); assert.equal(downloads.length, 1);
  assert.equal(timers.size + frames.size, 0);
  button.dispatchEvent(new Event('click')); assert.equal(recorder.id, null);
});

test('a failed diagnostic read is captured without interrupting the application', () => {
  const { w, button } = host();
  const recorder = createDiagnosticRecorder({ windowTarget: w, button, capture() { throw new Error('unavailable owner'); }, download() {} });
  assert.doesNotThrow(() => recorder.start());
  const state = required(recorder.stop()).samples[0].state;
  assert.ok(record(state) && typeof state.captureError === 'string');
  assert.match(state.captureError, /unavailable owner/);
  recorder.destroy();
});
