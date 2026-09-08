// Summarize the actual drag interval from prepared-depth-browser.mjs. Event
// durations describe browser stages, never physical FPS or input latency.
import { createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import assert from 'node:assert/strict';

const names = new Set(['DirectRenderer::DrawRenderPass', 'ThreadControllerImpl::RunTask',
  'FireAnimationFrame', 'UpdateLayoutTree', 'Layout', 'PrePaint', 'Paint']);
function metric(values) {
  values.sort((a, b) => a - b);
  return { count: values.length, totalMs: values.reduce((sum, value) => sum + value, 0),
    p95Ms: values[Math.floor(values.length * .95)] ?? null, maxMs: values.at(-1) ?? null };
}
for (const path of process.argv.slice(2)) {
  const file = createReadStream(path), stream = path.endsWith('.gz') ? file.pipe(createGunzip()) : file;
  const events = [], reports = [], marks = new Map();
  let main;
  // Chrome's ReturnAsStream trace puts one event on each line. Reject traces
  // without our phase marks instead of silently summarizing an empty interval.
  for await (const line of createInterface({ input: stream })) {
    let event;
    try { event = JSON.parse(line.trimEnd().replace(/,$/, '')); } catch { continue; }
    if (event.name?.startsWith('depth-drag-')) {
      marks.set(event.name, event.ts); main = [event.pid, event.tid];
    }
    if (names.has(event.name) && event.ph === 'X') events.push(event);
    if (event.name === 'PipelineReporter' && event.ph === 'b') reports.push(event);
  }
  const start = marks.get('depth-drag-start'), end = marks.get('depth-drag-end');
  assert.ok(Number.isFinite(start) && end > start && main, `${path}: missing marked drag interval`);
  const within = event => event.ts >= start && event.ts < end;
  const stages = {};
  for (const name of names) stages[name] = metric(events.filter(event => within(event) && event.name === name &&
    (name === 'DirectRenderer::DrawRenderPass' ? event.args?.NumberOfQuads > 200 :
      event.pid === main[0] && event.tid === main[1])).map(event => event.dur / 1000));
  const sequences = new Map();
  for (const event of reports.filter(within)) {
    const frame = event.args.frame_reporter, key = `${frame.frame_source}:${frame.frame_sequence}`;
    if (!sequences.has(key)) sequences.set(key, new Set());
    sequences.get(key).add(frame.state);
  }
  const states = [...sequences.values()];
  console.log(JSON.stringify({ path, durationMs: (end - start) / 1000, stages,
    droppedOnly: states.filter(state => state.size === 1 && state.has('STATE_DROPPED')).length,
    mixedReports: states.filter(state => state.size > 1).length, sequences: states.length }));
}
