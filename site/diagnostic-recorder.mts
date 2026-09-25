import type { BrowserWindow, ShellCamera } from './browser-types.mts';
import { isRecord } from '@cssearth/core';
interface RecordedEvent { type: string; time: number; name?: string; url?: string; duration?: number; transferSize?: number; decodedBodySize?: number; detail?: unknown; }
interface Recording {
  schema: string; id: string; metadata: { startedAt: string; performanceTimeOrigin: number; sampleIntervalMs: number; frameClock: string; startTime: number; url: string; userAgent: string; viewport: { width: number; height: number; dpr: number }; loadedResources: string[] };
  samples: { time: number; reason: string; captureMs: number; state: unknown }[]; frames: [number, number][]; events: RecordedEvent[];
  stoppedAt?: number; stopReason?: string; durationMs?: number; summary?: { samples: number; events: number; maxCaptureMs: number; meanCaptureMs: number };
}
interface DiagnosticEntry { entryType?: string; name: string; startTime: number; duration?: number; transferSize?: number; decodedBodySize?: number; detail?: unknown; }
const property = (value: unknown, key: string): unknown => isRecord(value) ? value[key] : undefined;
const call = (value: unknown, key: string): unknown => { const action = property(value, key); return typeof action === 'function' ? action.call(value) : null; };
const stack = (error: unknown) => error instanceof Error ? error.stack ?? error.message : String(error);
const SAMPLE_MS = 125;
const MAX_SAMPLES = 2400;
const MAX_EVENTS = 10000;

/** Opt-in application state, correlated with the native browser trace. */
export function createDiagnosticRecorder({ windowTarget: w, button, capture, download }: { windowTarget: BrowserWindow; button: HTMLElement; capture(): unknown; download(recording: Recording): void }) {
  const clock = w.performance;
  let active: Recording | null = null, observer: PerformanceObserver | null = null, timer: number | null = null, frame: number | null = null, previousFrame: number | null = null;
  let lastRecording: Recording | null = null;
  const append = (entry: DiagnosticEntry, kind = entry.entryType ?? 'unknown') => {
    if (!active || active.events.length >= MAX_EVENTS) return;
    if (kind === 'mark' && !entry.name.startsWith('cssEarth:')) return;
    active.events.push(kind === 'resource'
      ? { type: kind, time: entry.startTime, url: entry.name, duration: entry.duration,
        transferSize: entry.transferSize, decodedBodySize: entry.decodedBodySize }
      : { type: kind, time: entry.startTime, name: entry.name, detail: entry.detail ?? null });
  };
  const collect = (entries: PerformanceEntry[]) => { for (const entry of entries) append(entry); };
  const mark = (phase: string) => {
    const name = `cssEarth:recording:${phase}`;
    clock.clearMarks(name);
    clock.mark(name, { detail: { recordingId: active?.id } });
  };
  const sample = (reason: string) => {
    if (!active) return;
    const time = clock.now();
    let state: unknown;
    try { state = JSON.parse(JSON.stringify(capture())); }
    catch (error) { state = { captureError: stack(error) }; }
    active.samples.push({ time, reason, captureMs: clock.now() - time, state });
    if (active.samples.length >= MAX_SAMPLES && reason === 'sample') stop('limit');
  };
  const tick = (time: number) => {
    if (!active) return;
    if (previousFrame !== null && active.frames.length < 36000) active.frames.push([time, time - previousFrame]);
    previousFrame = time;
    frame = w.requestAnimationFrame(tick);
  };
  const error = (event: ErrorEvent | PromiseRejectionEvent) => append({ startTime: clock.now(), name: event.type,
    detail: event instanceof w.ErrorEvent ? stack(event.error ?? event.message) : stack(event.reason) }, 'error');
  function start() {
    if (active) return;
    // Not randomUUID: it exists only in secure contexts, and a device on the network loads the dev server over plain http.
    active = { schema: 'cssearth-diagnostics@1', id: Array.from(w.crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join(''),
      metadata: { startedAt: new Date().toISOString(), performanceTimeOrigin: clock.timeOrigin,
        sampleIntervalMs: SAMPLE_MS, frameClock: 'requestAnimationFrame',
        startTime: clock.now(), url: w.location.href, userAgent: w.navigator.userAgent,
        viewport: { width: w.innerWidth, height: w.innerHeight, dpr: w.devicePixelRatio },
        // URLs are identities observed by this page, not hashes of a later refetch.
        loadedResources: clock.getEntriesByType('resource').map(entry => entry.name) },
      samples: [], frames: [], events: [] };
    observer = new w.PerformanceObserver(list => collect(list.getEntries()));
    observer.observe({ entryTypes: ['mark', 'resource'] });
    mark('started'); sample('start');
    previousFrame = null;
    frame = w.requestAnimationFrame(tick);
    timer = w.setInterval(() => sample('sample'), SAMPLE_MS);
    w.addEventListener('error', error); w.addEventListener('unhandledrejection', error);
    button.textContent = 'Stop'; button.setAttribute('aria-pressed', 'true');
    button.setAttribute('aria-label', 'Stop and save diagnostic recording');
  }
  function stop(reason = 'stop') {
    if (!active) return null;
    if (timer !== null) w.clearInterval(timer); if (frame !== null) w.cancelAnimationFrame(frame); timer = frame = null;
    sample(reason); mark('stopped'); if (observer) { collect(observer.takeRecords()); observer.disconnect(); } observer = null;
    w.removeEventListener('error', error); w.removeEventListener('unhandledrejection', error);
    const result = active; active = null;
    result.stoppedAt = clock.now(); result.stopReason = reason;
    result.durationMs = result.stoppedAt - result.metadata.startTime;
    result.summary = { samples: result.samples.length, events: result.events.length,
      maxCaptureMs: Math.max(...result.samples.map(s => s.captureMs)),
      meanCaptureMs: result.samples.reduce((sum, s) => sum + s.captureMs, 0) / result.samples.length };
    lastRecording = result;
    button.textContent = 'Record'; button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', 'Record diagnostic data');
    if (reason !== 'dispose') download(result);
    return result;
  }
  const click = () => active ? stop() : start();
  button.addEventListener('click', click);
  const api = Object.freeze({ get id() { return active?.id ?? null; }, get lastRecording() { return lastRecording; }, start, stop,
    destroy() { stop('dispose'); button.removeEventListener('click', click); } });
  return api;
}

export function mountDiagnosticRecorder({ documentTarget: d, windowTarget: w, readCamera }: { documentTarget: Document; windowTarget: BrowserWindow; readCamera(): ShellCamera | null }) {
  const button = d.querySelector<HTMLElement>('[data-diagnostic-record]');
  if (!button) return { destroy() {} };
  let owner: unknown = null;
  let geometry: () => unknown = () => ({ retainedNodes: 0, retainedLeaves: 0, directlyHiddenLeaves: 0 });
  const capture = () => {
    const app: unknown = Reflect.get(w, '__cssEarth'), id = property(app, 'activeObjectId'), runtime: unknown = typeof id === 'string' ? Reflect.get(w, `__${id}`) : undefined;
    if (runtime !== owner) {
      owner = runtime;
      const renderer = property(runtime, 'runtime');
      const counters = property(renderer, 'geometry');
      if (typeof counters === 'function') geometry = () => counters.call(renderer);
      else {
        const nodes = property(runtime, 'stableNodes');
        const leaves = Array.isArray(nodes) ? nodes.filter((node): node is HTMLElement => node instanceof w.HTMLElement && node.tagName === 'S') : [];
        const retainedNodes = Array.isArray(nodes) ? nodes.length : 0;
        geometry = () => ({ retainedNodes, retainedLeaves: leaves.length,
          directlyHiddenLeaves: leaves.reduce((sum, leaf) => sum + Number(leaf.style.visibility === 'hidden'), 0) });
      }
    }
    const camera = readCamera();
    const view = call(property(runtime, 'runtime'), 'view');
    const requestedCamera = camera?.navigation?.capture() ?? null;
    // The shared world presents outside the detail stage; report both owners.
    const detailGeometry = geometry();
    const worldGeometry: unknown = call(Reflect.get(w, '__cssEarthUniverse'), 'geometry');
    return {
      active: id ?? null, selected: property(app, 'selectedObjectId') ?? null, overview: property(app, 'overview') ?? null,
      mountedObjects: property(app, 'mountedObjectCount') ?? null, lifecycle: property(app, 'lifecycle') ?? null,
      playback: property(app, 'playback') ?? null, documentVisibility: d.visibilityState,
      camera: property(view, 'worldCamera') ?? requestedCamera, requestedCamera, optics: camera?.navigation?.optics() ?? null,
      framePublication: call(property(runtime, 'camera'), 'publication'), worldFrames: call(Reflect.get(w, '__cssEarthUniverse'), 'frames'),
      view, selection: call(property(runtime, 'runtime'), 'selection') ?? null,
      resources: call(property(runtime, 'runtime'), 'resources') ?? null, materials: call(property(runtime, 'material'), 'state') ?? null,
      geometry: sumGeometry(detailGeometry, worldGeometry),
      geometryOwners: { detail: detailGeometry, world: worldGeometry ?? null },
    };
  };
  const api = createDiagnosticRecorder({ windowTarget: w, button, capture,
    download(recording) {
      const url = w.URL.createObjectURL(new w.Blob([JSON.stringify(recording)], { type: 'application/json' }));
      const link = d.createElement('a'); link.href = url;
      link.download = `cssearth-diagnostics-${recording.id}.json`; link.click();
      w.setTimeout(() => w.URL.revokeObjectURL(url), 1000);
    } });
  Reflect.set(w, '__cssEarthRecorder', api);
  return { destroy() { api.destroy(); if (Reflect.get(w, '__cssEarthRecorder') === api) Reflect.deleteProperty(w, '__cssEarthRecorder'); } };
}

/** Detail and world counters share keys; a missing owner passes through. */
function sumGeometry(detail: unknown, world: unknown): unknown {
  if (typeof detail !== 'object' || detail === null || typeof world !== 'object' || world === null) return detail;
  return Object.fromEntries(Object.entries(detail).map(([key, value]) => {
    const other: unknown = Reflect.get(world, key);
    return [key, typeof value === 'number' && typeof other === 'number' ? value + other : value];
  }));
}
