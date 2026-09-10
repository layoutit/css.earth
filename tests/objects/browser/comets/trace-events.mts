/** Chrome emits both complete spans (X) and nested begin/end events (B/E).
 * Recover both forms before clipping durations to the measured window. */
export interface TraceEvent {
  name: string;
  ph: string;
  ts: number;
  pid: number;
  tid: number;
  dur?: number;
  args?: Record<string, unknown>;
}

export interface TraceDurationEvent extends TraceEvent {
  dur: number;
}

export function traceDurationEvents(events: readonly TraceEvent[], start: number, end: number): TraceDurationEvent[] {
  const stacks = new Map<string, TraceEvent[]>(), spans: TraceDurationEvent[] = [];
  for (const event of [...events].sort((a, b) => a.ts - b.ts)) {
    const key = `${event.pid}:${event.tid}`;
    const duration = event.dur;
    if (event.ph === 'X' && duration !== undefined && Number.isFinite(duration)) spans.push({...event, dur: duration});
    else if (event.ph === 'B') {
      const stack = stacks.get(key) ?? [];
      stack.push(event);
      stacks.set(key, stack);
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
