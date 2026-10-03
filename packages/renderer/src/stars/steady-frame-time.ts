/** Safari reports frame times in whole milliseconds, taken when the frame's callbacks run. On a 60 Hz display successive
 * frames then read 16, 17 and 17 ms apart, and a callback that runs late is followed by an early one (22 ms, then 12).
 * Motion paced by those intervals changed speed by 6% every third frame and by a third on a late pair, though the display
 * showed every frame one interval after the last (iPad, 2026-10-03: a steady zoom stepped 0.1127, 0.1127, 0.1072 of its
 * range, and 0.1489 then 0.0818 on a late pair).
 *
 * This returns each frame's time a whole number of display intervals after the last: one for a frame that came up to
 * an interval and three quarters later (a late callback is still the next frame), two after a skipped frame, and so on
 * through a pause. A callback that runs straight after a late one belongs to the same display frame and gets the
 * reported time. The display interval is the mean of the frames that came on time, "on time" being within the rounding
 * of the median of the last RECENT intervals; it is learned again when nearly all of those sit at another value (the
 * display changed its rate), not when frames are merely late. The returned time follows the reported one slowly, and
 * takes it outright when the two are more than an interval and a half apart. A time with a fractional part is already a
 * display time and passes through, as do the first frames while the interval is unknown. The returned times never go
 * back. */
const RECENT = 15, LEARNED = 5, ON_TIME_MS = 1.5, RATE_CHANGED_MS = 2, RATE_CHANGED_SHARE = .8, FOLLOW = .02, LATE_STILL_ONE = .25, APART_INTERVALS = 1.5;
/** Longer than this between frames is a pause, not a display interval. */
const LONGEST_INTERVAL_MS = 50;

export function createSteadyFrameTime(): (reported: number) => number {
  let recent: number[] = [], sum = 0, count = 0, interval = 0, steady = 0;
  let previous = Number.NaN, latest = Number.NEGATIVE_INFINITY;
  const emit = (time: number) => latest = Math.max(latest, time);
  const forget = () => { recent = []; sum = count = interval = 0; };
  const median = () => { const sorted = [...recent].sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)]!; };
  return reported => {
    const delta = reported - previous;
    previous = reported;
    if (!Number.isInteger(reported)) { forget(); return emit(reported); }
    if (delta > 0 && delta <= LONGEST_INTERVAL_MS) { recent.push(delta); if (recent.length > RECENT) recent.shift(); }
    if (recent.length < LEARNED) return emit(steady = reported);
    const middle = median(), around = recent.filter(value => Math.abs(value - middle) <= ON_TIME_MS);
    // The first interval, or the display's interval moved (another refresh rate): learn it from the recent frames alone.
    if (count === 0 || Math.abs(middle - interval) > RATE_CHANGED_MS && around.length >= RATE_CHANGED_SHARE * recent.length) {
      sum = around.reduce((total, value) => total + value, 0); count = around.length; interval = sum / count;
      return emit(steady = reported);
    }
    if (Math.abs(delta - interval) <= ON_TIME_MS) { sum += delta; count++; interval = sum / count; }
    const whole = Math.floor((reported - steady) / interval + LATE_STILL_ONE);
    // Straight after a late callback: the same display frame, at the reported time.
    if (whole < 1) return emit(steady = Math.max(steady, reported));
    const next = steady + whole * interval, followed = next + (reported - next) * FOLLOW;
    steady = Math.abs(reported - followed) > APART_INTERVALS * interval ? reported : followed;
    return emit(steady);
  };
}
