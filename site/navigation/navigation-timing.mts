import { record } from '../browser-types.mts';
let sequence = 0;

/** Named User Timing entries for DevTools traces; retain only the latest of each phase. */
// Disposing a settled navigation's scene still aborts its request, which used to add a late cancellation.
const SETTLED_PHASES = ['finished', 'failed', 'cancelled'];

export function createNavigationTiming(windowTarget: Window, from: string, to: string) {
  const clock = windowTarget?.performance;
  if (typeof clock?.mark !== 'function' || typeof clock?.measure !== 'function') return { mark(_phase: string) {} };
  const started = clock.now(), id = ++sequence, seen = new Set();
  const mark = (phase: string) => {
    if (seen.has(phase) || SETTLED_PHASES.some(settled => seen.has(settled))) return;
    seen.add(phase);
    const name = `cssEarth:navigation:${phase}`, detail: { id: number; from: string; to: string; phase: string; recordingId?: string } = { id, from, to, phase };
    const recordingId = ('__cssEarthRecorder' in windowTarget && record(windowTarget.__cssEarthRecorder) && typeof windowTarget.__cssEarthRecorder.id === 'string') ? windowTarget.__cssEarthRecorder.id : undefined;
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
