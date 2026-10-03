/** Safari reports frame times in whole milliseconds. On a 60 Hz display successive frames then read 16, 17 and 17 ms
 * apart, and motion paced by those intervals changes speed by 6% every third frame: on the iPad a steady zoom stepped
 * 0.1127, 0.1127, 0.1072 of its range (2026-10-03). While frames arrive one display interval apart, this returns times
 * one interval apart, the interval being the run's own mean; it stays within a millisecond of the reported time. A time
 * with a fractional part is already precise and passes through, as does a frame that is late, early or after a pause,
 * which starts a new run. A frame that skipped whole intervals advances by that many. */
const LEARNING_FRAMES = 3, ROUNDING_MS = 1.5, FOLLOW = .1, MOST_SKIPPED = 4;

export function createSteadyFrameTime(): (reported: number) => number {
  // The run: its first reported time, the intervals it spans, and the last reported and returned times.
  let start = 0, intervals = -1, last = 0, steady = 0;
  return reported => {
    if (!Number.isInteger(reported)) { intervals = -1; return reported; }
    if (intervals < 0) { start = last = steady = reported; intervals = 0; return reported; }
    const delta = reported - last, interval = intervals > 0 ? (last - start) / intervals : delta;
    last = reported;
    const skipped = interval > 0 ? Math.round(delta / interval) : 0;
    if (!(delta > 0) || skipped < 1 || skipped > MOST_SKIPPED || Math.abs(delta - skipped * interval) > ROUNDING_MS) {
      start = steady = reported; intervals = 0;
      return reported;
    }
    intervals += skipped;
    if (intervals < LEARNING_FRAMES) { steady = reported; return reported; }
    // One mean interval on from the last time, drawn a little toward the reported time so the two never part.
    const predicted = steady + skipped * (reported - start) / intervals;
    steady = Math.min(reported + 1, Math.max(reported - 1, predicted + (reported - predicted) * FOLLOW));
    return steady;
  };
}
