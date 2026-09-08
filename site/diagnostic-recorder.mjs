const SAMPLE_MS = 125;
const MAX_SAMPLES = 2400;
const MAX_EVENTS = 10000;

/** Opt-in application state, correlated with the native browser trace. */
export function createDiagnosticRecorder({ windowTarget: w, button, capture, download }) {
  const clock = w.performance;
  let active = null, observer = null, timer = null, frame = null, previousFrame = null;
  let lastRecording = null;
  const append = (entry, kind = entry.entryType) => {
    if (!active || active.events.length >= MAX_EVENTS) return;
    if (kind === 'mark' && !entry.name.startsWith('cssEarth:')) return;
    active.events.push(kind === 'resource'
      ? { type: kind, time: entry.startTime, url: entry.name, duration: entry.duration,
        transferSize: entry.transferSize, decodedBodySize: entry.decodedBodySize }
      : { type: kind, time: entry.startTime, name: entry.name, detail: entry.detail ?? null });
  };
  const collect = entries => { for (const entry of entries) append(entry); };
  const mark = phase => {
    const name = `cssEarth:recording:${phase}`;
    clock.clearMarks(name);
    clock.mark(name, { detail: { recordingId: active.id } });
  };
  const sample = reason => {
    if (!active) return;
    const time = clock.now();
    let state;
    try { state = JSON.parse(JSON.stringify(capture())); }
    catch (error) { state = { captureError: String(error?.stack ?? error) }; }
    active.samples.push({ time, reason, captureMs: clock.now() - time, state });
    if (active.samples.length >= MAX_SAMPLES && reason === 'sample') stop('limit');
  };
  const tick = time => {
    if (!active) return;
    if (previousFrame !== null && active.frames.length < 36000) active.frames.push([time, time - previousFrame]);
    previousFrame = time;
    frame = w.requestAnimationFrame(tick);
  };
  const error = event => append({ startTime: clock.now(), name: event.type,
    detail: String(event.error?.stack ?? event.reason?.stack ?? event.reason ?? event.message) }, 'error');
  function start() {
    if (active) return;
    active = { schema: 'cssearth-diagnostics@1', id: w.crypto.randomUUID(),
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
    w.clearInterval(timer); w.cancelAnimationFrame(frame); timer = frame = null;
    sample(reason); mark('stopped'); collect(observer.takeRecords()); observer.disconnect(); observer = null;
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

export function mountDiagnosticRecorder({ documentTarget: d, windowTarget: w, readCamera }) {
  const button = d.querySelector('[data-diagnostic-record]');
  if (!button) return { destroy() {} };
  let owner = null;
  let geometry = () => ({ retainedNodes: 0, retainedLeaves: 0, directlyHiddenLeaves: 0 });
  const capture = () => {
    const app = w.__cssEarth, id = app?.activeObjectId, runtime = w[`__${id}`];
    if (runtime !== owner) {
      owner = runtime;
      // Prefer the renderer's retained membership snapshot. Keep compatibility
      // with owners that do not publish pool counters. Neither path measures layout.
      if (runtime?.runtime.geometry) geometry = runtime.runtime.geometry;
      else {
        const leaves = (runtime?.stableNodes ?? []).filter(node => node.tagName === 'S');
        const retainedNodes = runtime?.stableNodes?.length ?? 0;
        geometry = () => ({ retainedNodes, retainedLeaves: leaves.length,
          directlyHiddenLeaves: leaves.reduce((sum, leaf) => sum + Number(leaf.style.visibility === 'hidden'), 0) });
      }
    }
    const camera = readCamera();
    return {
      active: id ?? null, selected: app?.selectedObjectId ?? null, overview: app?.overview ?? null,
      mountedObjects: app?.mountedObjectCount ?? null, lifecycle: app?.lifecycle ?? null,
      playback: app?.playback ?? null, documentVisibility: d.visibilityState,
      camera: camera?.navigation?.capture() ?? null, optics: camera?.navigation?.optics() ?? null,
      view: runtime?.runtime.view() ?? null, selection: runtime?.runtime.selection() ?? null,
      resources: runtime?.runtime.resources() ?? null, materials: runtime?.material.state() ?? null,
      geometry: geometry(),
    };
  };
  const api = createDiagnosticRecorder({ windowTarget: w, button, capture,
    download(recording) {
      const url = w.URL.createObjectURL(new w.Blob([JSON.stringify(recording)], { type: 'application/json' }));
      const link = d.createElement('a'); link.href = url;
      link.download = `cssearth-diagnostics-${recording.id}.json`; link.click();
      w.setTimeout(() => w.URL.revokeObjectURL(url), 1000);
    } });
  w.__cssEarthRecorder = api;
  return { destroy() { api.destroy(); if (w.__cssEarthRecorder === api) delete w.__cssEarthRecorder; } };
}
