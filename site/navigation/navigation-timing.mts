import { isRecord } from '@cssearth/core';
let sequence = 0;

/** Named User Timing entries for DevTools traces; retain only the latest of each phase. */
// Disposing a settled navigation's scene still aborts its request, which used to add a late cancellation.
const SETTLED_PHASES = ['finished', 'failed', 'cancelled'];

/** What a hand-over's entry says: which owner saw the camera cross (a body's overview watcher or the zoom's own scopes), from
 * which object to which, the camera's range from the object it is leaving, and, once settled, how long the crossing held. */
export interface HandoverDetail { source: 'overview-watcher' | 'zoom-scope'; from: string; to: string; rangeM?: number; waitedMs?: number }

/** Named User Timing entries for a scene hand-over the camera causes by crossing a threshold: `crossed` when an owner
 * first sees it, `settled` when it asks for the navigation, `cancelled` when the camera came back first, and `warmed`
 * when the camera came near enough to a crossing for the next scene's files to be fetched ahead. Only the latest
 * of each phase is kept. A capture reads them beside `cssEarth:navigation:*` to see where a zoom's hold comes from. */
export function markHandover(windowTarget: Window, phase: 'warmed' | 'crossed' | 'settled' | 'cancelled', detail: HandoverDetail) {
  const clock = windowTarget?.performance;
  if (typeof clock?.mark !== 'function' || typeof clock?.clearMarks !== 'function') return;
  const name = `cssEarth:handover:${phase}`;
  clock.clearMarks(name);
  clock.mark(name, { detail: { ...detail, phase } });
}

export function createNavigationTiming(windowTarget: Window, from: string, to: string) {
  const clock = windowTarget?.performance;
  if (typeof clock?.mark !== 'function' || typeof clock?.measure !== 'function') return { mark(_phase: string) {} };
  const started = clock.now(), id = ++sequence, seen = new Set();
  const mark = (phase: string) => {
    if (seen.has(phase) || SETTLED_PHASES.some(settled => seen.has(settled))) return;
    seen.add(phase);
    const name = `cssEarth:navigation:${phase}`, detail: { id: number; from: string; to: string; phase: string; recordingId?: string } = { id, from, to, phase };
    const recordingId = ('__cssEarthRecorder' in windowTarget && isRecord(windowTarget.__cssEarthRecorder) && typeof windowTarget.__cssEarthRecorder.id === 'string') ? windowTarget.__cssEarthRecorder.id : undefined;
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
