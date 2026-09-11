// Summarize the actual drag interval from prepared-depth-browser.mts. Event
// durations describe browser stages, never physical FPS or input latency.
import { createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import assert from 'node:assert/strict';
import { isRecord, requireRecord, requireFiniteNumber, requireString } from '../../tools/source-values.mts';

const names = new Set(['DirectRenderer::DrawRenderPass', 'ThreadControllerImpl::RunTask',
  'FireAnimationFrame', 'UpdateLayoutTree', 'Layout', 'PrePaint', 'Paint']);
interface StageEvent { name: string; ts: number; dur: number; pid: number; tid: number; quads?: number; }
interface FrameReport { ts: number; key: string; state: string; }
function metric(values: number[]) {
  values.sort((a, b) => a - b);
  return { count: values.length, totalMs: values.reduce((sum, value) => sum + value, 0),
    p95Ms: values[Math.floor(values.length * .95)] ?? null, maxMs: values.at(-1) ?? null };
}
function frameIdentity(value: unknown): string | number {
  return typeof value === 'string' ? value : requireFiniteNumber(value, 'Frame identity');
}
for (const path of process.argv.slice(2)) {
  const file = createReadStream(path), stream = path.endsWith('.gz') ? file.pipe(createGunzip()) : file;
  const events: StageEvent[] = [], reports: FrameReport[] = [], marks = new Map<string, number>();
  let main: [number, number] | undefined;
  // Chrome's ReturnAsStream trace puts one event on each line. Reject traces
  // without our phase marks instead of silently summarizing an empty interval.
  for await (const line of createInterface({ input: stream })) {
    let event: unknown;
    try { event = JSON.parse(line.trimEnd().replace(/,$/, '')); } catch { continue; }
    if (!isRecord(event) || typeof event.name !== 'string') continue;
    if (event.name.startsWith('depth-drag-')) {
      marks.set(event.name, requireFiniteNumber(event.ts, 'Drag mark timestamp'));
      main = [requireFiniteNumber(event.pid, 'Drag process'), requireFiniteNumber(event.tid, 'Drag thread')];
    }
    if (names.has(event.name) && event.ph === 'X') {
      const args = event.args === undefined ? {} : requireRecord(event.args, 'Stage arguments');
      events.push({ name: event.name, ts: requireFiniteNumber(event.ts, 'Stage timestamp'),
        dur: requireFiniteNumber(event.dur, 'Stage duration'), pid: requireFiniteNumber(event.pid, 'Stage process'),
        tid: requireFiniteNumber(event.tid, 'Stage thread'),
        ...(args.NumberOfQuads === undefined ? {} : {quads: requireFiniteNumber(args.NumberOfQuads, 'Quad count')}) });
    }
    if (event.name === 'PipelineReporter' && event.ph === 'b') {
      const frame = requireRecord(requireRecord(event.args, 'Pipeline arguments').frame_reporter, 'Frame report');
      reports.push({ ts: requireFiniteNumber(event.ts, 'Frame timestamp'),
        key: `${frameIdentity(frame.frame_source)}:${frameIdentity(frame.frame_sequence)}`,
        state: requireString(frame.state, 'Frame state') });
    }
  }
  const start = marks.get('depth-drag-start'), end = marks.get('depth-drag-end');
  assert.ok(start !== undefined && end !== undefined && end > start && main, `${path}: missing marked drag interval`);
  const within = (event: {ts: number}) => event.ts >= start && event.ts < end;
  const stages: Record<string, ReturnType<typeof metric>> = {};
  for (const name of names) stages[name] = metric(events.filter(event => within(event) && event.name === name &&
    (name === 'DirectRenderer::DrawRenderPass' ? event.quads !== undefined && event.quads > 200 :
      event.pid === main[0] && event.tid === main[1])).map(event => event.dur / 1000));
  const sequences = new Map<string, Set<string>>();
  for (const event of reports.filter(within)) {
    const states = sequences.get(event.key) ?? new Set<string>();
    states.add(event.state);
    sequences.set(event.key, states);
  }
  const states = [...sequences.values()];
  console.log(JSON.stringify({ path, durationMs: (end - start) / 1000, stages,
    droppedOnly: states.filter(state => state.size === 1 && state.has('STATE_DROPPED')).length,
    mixedReports: states.filter(state => state.size > 1).length, sequences: states.length }));
}
