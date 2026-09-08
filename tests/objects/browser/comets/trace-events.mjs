/** Chrome emits both complete spans (X) and nested begin/end events (B/E).
 * Recover both forms before clipping durations to the measured window. */
export function traceDurationEvents(events, start, end) {
  const stacks = new Map(), spans = [];
  for (const event of [...events].sort((a, b) => a.ts - b.ts)) {
    const key = `${event.pid}:${event.tid}`;
    if (event.ph === 'X' && Number.isFinite(event.dur)) spans.push(event);
    else if (event.ph === 'B') {
      if (!stacks.has(key)) stacks.set(key, []);
      stacks.get(key).push(event);
    } else if (event.ph === 'E') {
      const begin = stacks.get(key)?.pop();
      if (begin) spans.push({ ...begin, ph: 'X', dur: event.ts - begin.ts });
    }
  }
  // Unpaired events at capture boundaries provide no measured duration.
  return spans.flatMap(event => {
    const ts = Math.max(start, event.ts), stop = Math.min(end, event.ts + event.dur);
    return stop > ts ? [{ ...event, ts, dur: stop - ts }] : [];
  });
}
