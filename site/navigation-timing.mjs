let sequence = 0;

/** Named User Timing entries for DevTools traces; retain only the latest of each phase. */
export function createNavigationTiming(windowTarget, from, to) {
  const clock = windowTarget?.performance;
  if (typeof clock?.mark !== 'function' || typeof clock?.measure !== 'function') return { mark() {} };
  const started = clock.now(), id = ++sequence, seen = new Set();
  const mark = phase => {
    if (seen.has(phase)) return;
    seen.add(phase);
    const name = `cssEarth:navigation:${phase}`, detail = { id, from, to, phase };
    const recordingId = windowTarget.__cssEarthRecorder?.id;
    if (recordingId) detail.recordingId = recordingId;
    clock.clearMarks(name);
    clock.mark(name, { detail });
    if (phase !== 'requested') {
      clock.clearMeasures(name);
      clock.measure(name, { start: started, end: clock.now(), detail });
    }
  };
  mark('requested');
  return { mark };
}
