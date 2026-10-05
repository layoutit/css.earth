import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { isRecord } from '@cssearth/core';
import { createDiagnosticRecorder, mountDiagnosticRecorder } from './diagnostic-recorder.mts';
import type { BrowserWindow } from './browser/browser-types.mts';
import { required } from './test/navigation-test-values.mts';

function fixture(markup = '<button data-diagnostic-record></button>') {
  const { document, window } = parseHTML(`<html><head></head><body>${markup}</body></html>`);
  let now = 10;
  const intervals = new Map<number, () => void>(), frames = new Map<number, FrameRequestCallback>();
  const pending: { name: string; startTime: number; entryType: string; detail?: unknown }[] = [];
  let deliver: (entries: PerformanceEntry[]) => void = () => {};
  const revoked: string[] = [], downloads: string[] = [], delayed: { fn: () => void; at: number }[] = [];
  class Observer {
    constructor(callback: PerformanceObserverCallback) { deliver = entries => callback({ getEntries: () => entries } as PerformanceObserverEntryList, this as unknown as PerformanceObserver); }
    observe() {}
    takeRecords() { return pending.splice(0); }
    disconnect() {}
  }
  class ErrorEvent extends Event {
    error: unknown;
    message: string;
    constructor(error: unknown, message = '') { super('error'); this.error = error; this.message = message; }
  }
  const createElement = document.createElement.bind(document);
  document.createElement = ((name: string) => {
    const element = createElement(name);
    if (name === 'a') element.click = () => { downloads.push(element.getAttribute('download') ?? ''); };
    return element;
  }) as typeof document.createElement;
  const w = Object.assign(new EventTarget(), {
    HTMLElement: window.HTMLElement, ErrorEvent,
    performance: { now: () => now, timeOrigin: 1000, clearMarks() {}, mark(name: string, options: { detail: unknown }) { pending.push({ name, startTime: now, entryType: 'mark', detail: options.detail }); }, getEntriesByType: () => [{ name: '/loaded.webp' }] },
    PerformanceObserver: Observer, crypto: { getRandomValues: (bytes: Uint8Array) => bytes.fill(17) },
    location: { href: 'http://example.test/earth/' }, navigator: { userAgent: 'fixture' }, innerWidth: 300, innerHeight: 500, devicePixelRatio: 2,
    setInterval(fn: () => void) { intervals.set(1, fn); return 1; }, clearInterval(id: number) { intervals.delete(id); },
    requestAnimationFrame(fn: FrameRequestCallback) { frames.set(1, fn); return 1; }, cancelAnimationFrame(id: number) { frames.delete(id); },
    Blob, URL: { createObjectURL: () => 'blob:recording', revokeObjectURL: (url: string) => revoked.push(url) },
    setTimeout(fn: () => void, delay: number) { delayed.push({ fn, at: now + delay }); return 1; },
  }) as unknown as BrowserWindow;
  return { document, w, intervals, frames, revoked, downloads, delayed, ErrorEvent,
    emit(entries: unknown[]) { deliver(entries as PerformanceEntry[]); }, advance(ms: number) { now += ms; for (const task of delayed.filter(task => task.at <= now)) { delayed.splice(delayed.indexOf(task), 1); task.fn(); } } };
}

test('recorder filters marks, records resource and error payloads, and stops at the sample limit', () => {
  const f = fixture(), button = required(f.document.querySelector<HTMLElement>('button'));
  const saved: unknown[] = [];
  const recorder = createDiagnosticRecorder({ windowTarget: f.w, button, capture: () => ({ value: 1 }), download: result => saved.push(result) });
  assert.equal(recorder.stop(), null);
  f.emit([{ name: 'ignored', startTime: 0 }]);
  recorder.start(); recorder.start();
  assert.equal(button.getAttribute('aria-label'), 'Stop and save diagnostic recording');
  assert.equal(recorder.id, '11'.repeat(16));
  f.emit([{ entryType: 'mark', name: 'other', startTime: 1 }, { entryType: 'mark', name: 'cssEarth:test', startTime: 2 },
    { entryType: 'resource', name: '/new.webp', startTime: 3, duration: 4, transferSize: 5, decodedBodySize: 6 }, { name: 'unknown', startTime: 4 }]);
  f.w.dispatchEvent(new f.ErrorEvent(null, 'missing'));
  f.w.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: 'rejected' }));
  required(f.frames.get(1))(10); required(f.frames.get(1))(30);
  const sample = required(f.intervals.get(1));
  for (let index = 0; index < 2399; index++) { f.advance(125); sample(); }
  const recording = required(recorder.lastRecording);
  assert.equal(recording.schema, 'cssearth-diagnostics@1');
  assert.equal(recording.stopReason, 'limit');
  assert.equal(recording.samples.length, 2401);
  assert.equal(recording.summary?.samples, 2401);
  assert.equal(recording.durationMs, 2399 * 125);
  assert.equal(recording.metadata.sampleIntervalMs, 125);
  assert.deepEqual(recording.metadata.loadedResources, ['/loaded.webp']);
  assert.deepEqual(recording.frames, [[30, 20]]);
  assert.ok(!recording.events.some(entry => entry.name === 'other'));
  assert.ok(recording.events.some(entry => entry.type === 'unknown' && entry.detail === null));
  assert.ok(recording.events.some(entry => entry.type === 'resource' && entry.url === '/new.webp' && entry.transferSize === 5));
  assert.deepEqual(recording.events.filter(entry => entry.type === 'error').map(entry => entry.detail), ['missing', 'rejected']);
  assert.equal(saved.length, 1);
  assert.equal(f.intervals.size + f.frames.size, 0);
  sample(); assert.equal(recording.samples.length, 2401);
  recorder.destroy();
});

test('event cap and non-Error capture failures preserve an exportable recording', () => {
  const f = fixture();
  const recorder = createDiagnosticRecorder({ windowTarget: f.w, button: required(f.document.querySelector<HTMLElement>('button')), capture() { throw 'read failed'; }, download() {} });
  recorder.start();
  f.emit(Array.from({ length: 10010 }, (_, index) => ({ name: `cssEarth:${index}`, startTime: index, entryType: 'mark' })));
  const recording = required(recorder.stop());
  assert.equal(recording.events.length, 10000);
  assert.deepEqual(recording.samples[0].state, { captureError: 'read failed' });
  assert.equal(recording.summary?.events, 10000);
  recorder.destroy();
});

test('mounted recorder samples owner state, merges geometry and saves then revokes its local export', () => {
  const f = fixture('<button data-diagnostic-record></button><s style="visibility:hidden"></s><div></div>');
  const button = required(f.document.querySelector<HTMLElement>('button'));
  Reflect.set(f.w, '__cssEarth', { activeObjectId: 'earth', selectedObjectId: 'moon', overview: true, mountedObjectCount: 1, lifecycle: 'ready', playback: false });
  Reflect.set(f.w, '__earth', { runtime: { geometry() { return { retainedNodes: 2, retainedLeaves: 1, label: 'detail' }; }, view() { return { worldCamera: 'published' }; }, selection() { return 'selected'; }, resources() { return ['texture']; } }, camera: { publication() { return 'frame'; } }, material: { state() { return 'surface'; } } });
  Reflect.set(f.w, '__cssEarthUniverse', { geometry() { return { retainedNodes: 3, retainedLeaves: 4, label: 9 }; }, frames() { return 'world'; } });
  const mounted = mountDiagnosticRecorder({ documentTarget: f.document, windowTarget: f.w, readCamera: () => null });
  button.click();
  Reflect.set(f.w, '__earth', { stableNodes: [...f.document.querySelectorAll('s,div')] });
  required(f.intervals.get(1))();
  button.click();
  const api = f.w.__cssEarthRecorder;
  const recording = required(api?.lastRecording);
  const first = recording.samples[0].state, second = recording.samples[1].state;
  assert.ok(isRecord(first) && isRecord(second));
  assert.deepEqual(first.geometry, { retainedNodes: 5, retainedLeaves: 5, label: 'detail' });
  assert.equal(first.camera, 'published');
  assert.equal(first.selection, 'selected');
  assert.equal(first.framePublication, 'frame');
  assert.equal(first.materials, 'surface');
  assert.deepEqual(second.geometry, { retainedNodes: 5, retainedLeaves: 5, directlyHiddenLeaves: 1 });
  assert.equal(second.requestedCamera, null);
  assert.equal(second.resources, null);
  assert.deepEqual(f.downloads, [`cssearth-diagnostics-${recording.id}.json`]);
  assert.deepEqual(f.revoked, []);
  f.advance(999); assert.deepEqual(f.revoked, []);
  f.advance(1); assert.deepEqual(f.revoked, ['blob:recording']);
  mounted.destroy(); assert.equal(Reflect.get(f.w, '__cssEarthRecorder'), undefined);
  button.click(); assert.equal(f.downloads.length, 1);
});

test('missing owners and recorder buttons are safe; disposal keeps another recorder owner', () => {
  const empty = fixture('');
  assert.doesNotThrow(() => mountDiagnosticRecorder({ documentTarget: empty.document, windowTarget: empty.w, readCamera: () => null }).destroy());
  const f = fixture(), button = required(f.document.querySelector<HTMLElement>('button'));
  const mounted = mountDiagnosticRecorder({ documentTarget: f.document, windowTarget: f.w, readCamera: () => null });
  button.click();
  const api = f.w.__cssEarthRecorder;
  Reflect.set(f.w, '__cssEarthRecorder', 'replacement');
  mounted.destroy();
  const recording = required(api?.lastRecording), state = recording.samples[0].state;
  assert.ok(isRecord(state));
  assert.equal(state.active, null);
  assert.deepEqual(state.geometry, { retainedNodes: 0, retainedLeaves: 0, directlyHiddenLeaves: 0 });
  assert.equal(state.geometryOwners && Reflect.get(state.geometryOwners, 'world'), null);
  assert.equal(recording.stopReason, 'dispose');
  assert.equal(f.downloads.length, 0);
  assert.equal(Reflect.get(f.w, '__cssEarthRecorder'), 'replacement');
});

test('frame history is bounded and Error values without stacks retain their messages', () => {
  const f = fixture();
  const error = new Error('no stack'); delete error.stack;
  const recorder = createDiagnosticRecorder({ windowTarget: f.w, button: required(f.document.querySelector<HTMLElement>('button')), capture() { throw error; }, download() {} });
  recorder.start();
  for (let time = 0; time <= 36002; time++) required(f.frames.get(1))(time);
  f.w.dispatchEvent(new f.ErrorEvent(error));
  const recording = required(recorder.stop());
  assert.equal(recording.frames.length, 36000);
  assert.deepEqual(recording.frames.at(-1), [36000, 1]);
  assert.deepEqual(recording.samples[0].state, { captureError: 'no stack' });
  assert.ok(recording.events.some(entry => entry.type === 'error' && entry.detail === 'no stack'));
});


test('capture summary keeps the maximum and arithmetic mean of varying capture durations', () => {
  const f = fixture();
  const durations = [3, 11, 7];
  const recorder = createDiagnosticRecorder({ windowTarget: f.w, button: required(f.document.querySelector<HTMLElement>('button')),
    capture() { f.advance(required(durations.shift())); return { captured: true }; }, download() {} });
  recorder.start();
  required(f.intervals.get(1))();
  const recording = required(recorder.stop());
  assert.deepEqual(recording.samples.map(sample => sample.captureMs), [3, 11, 7]);
  assert.deepEqual(recording.summary, { samples: 3, events: 2, maxCaptureMs: 11, meanCaptureMs: 7 });
  recorder.destroy();
});
