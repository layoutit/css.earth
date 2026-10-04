#!/usr/bin/env node
/**
 * Frame times the page records itself on the connected iPad, with the capture tools detached.
 *
 * A capture with the native recorder attached spends 16 to 17 ms of the device's CPU a frame on its own processes,
 * three times the page's main thread, and some of the late frames it shows are its own (2026-10-04). This command
 * starts a wheel program in the page after a delay, leaves, and comes back for what the page recorded: every frame's
 * time, the time its frame callbacks ran, the hand-overs, the files that arrived and the slow timers. Count late
 * frames with it; name what runs in them with `ios-capture.mts`.
 *
 *   pnpm ipad:timed --open /earth/ --origin http://192.168.0.8:4293 [--name far-zoom] [--program '<json>']
 */
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isRecord, requireArray, requireFiniteNumber, requireRecord } from '@cssearth/core';
import { captureIosMoment } from './ios-capture.mts';

/** A step of the page's own driver: `frames` wheel events of `deltaY`, one a frame, or `frames` frames of nothing. */
export type SelfTimedStep = readonly ['wheel', number, number] | readonly ['wait', number];
/** Out of the page's subject and back, twice: the zoom the late-frame counts of this lab are quoted for. */
export const FAR_ZOOM: readonly SelfTimedStep[] = [['wheel', 330, 20], ['wait', 150], ['wheel', 330, -20], ['wait', 150], ['wheel', 330, 20], ['wait', 150], ['wheel', 330, -20], ['wait', 240]];
/** The run starts this long after the script is installed, so the Inspector session that installed it has gone. */
const START_DELAY_MS = 9000;

/** The page script that records a run of `program`. */
export const selfTimedStart = (program: readonly SelfTimedStep[]) => `(() => { const w = window;
  const state = w.__selfTimed = { done: false, t0: 0, frames: [], work: [], objects: [], files: [], slow: [] };
  const label = fn => (fn && fn.name ? fn.name : '') + ':' + String(fn).replace(/\\s+/g, ' ').slice(0, 70);
  let inFrame = 0;
  const timer = w.setTimeout; w.setTimeout = (fn, ms, ...rest) => timer(typeof fn === 'function' ? function (...args) { const before = performance.now();
    try { return fn.apply(this, args); } finally { const took = performance.now() - before; if (took > 8) state.slow.push([before, took, label(fn)]); } } : fn, ms, ...rest);
  const frame = w.requestAnimationFrame; w.requestAnimationFrame = fn => frame(function (t) { const before = performance.now(); try { return fn(t); } finally { inFrame += performance.now() - before; } });
  new PerformanceObserver(list => { for (const entry of list.getEntries()) state.files.push([entry.responseEnd, entry.name.split('/').slice(3).join('/').split('?')[0].slice(-48), entry.transferSize || entry.encodedBodySize || 0]); }).observe({ type: 'resource' });
  const cx = innerWidth / 2, cy = innerHeight / 2, program = ${JSON.stringify(program)};
  let target = null, age = 0, step = 0, left = 0, last = null;
  const wheel = deltaY => { if (age++ % 30 === 0 || !target || !target.isConnected) target = document.elementFromPoint(cx, cy) || document.body;
    target.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: cx, clientY: cy, deltaY, deltaMode: 0 })); };
  // The driver's own callback is not wrapped: what it adds to a frame is the work of the frame callbacks before it.
  const tick = t => { state.frames.push(t); state.work.push(inFrame); inFrame = 0;
    const id = w.__cssEarth && w.__cssEarth.activeObjectId; if (id !== last) { state.objects.push([t, id]); last = id; }
    while (step < program.length && left === 0) left = program[step][1];
    if (step >= program.length) { state.done = true; return; }
    if (program[step][0] === 'wheel') wheel(program[step][2]);
    if (--left === 0) step++;
    frame(tick); };
  timer(() => { state.t0 = performance.now(); frame(tick); }, ${START_DELAY_MS});
  return 'self-timed run in ${START_DELAY_MS} ms'; })()`;

/** The page script that hands the record back. */
export const SELF_TIMED_READ = `(() => { const s = window.__selfTimed; if (!s) return 'no self-timed run on this page';
  const tenth = value => Math.round(value * 10) / 10;
  return JSON.stringify({ done: s.done, t0: tenth(s.t0), frames: s.frames.map(tenth), work: s.work.map(tenth), objects: s.objects.map(o => [tenth(o[0]), o[1]]),
    files: s.files.map(f => [tenth(f[0]), f[1], f[2]]), slow: s.slow.map(c => [tenth(c[0]), tenth(c[1]), c[2]]) }); })()`;

export interface SelfTimedRecord { readonly done: boolean; readonly t0: number; readonly frames: readonly number[]; readonly work: readonly number[];
  readonly objects: readonly (readonly [number, string | null])[]; readonly files: readonly (readonly [number, string, number])[]; readonly slow: readonly (readonly [number, number, string])[] }

/** What a record says: the frames over each limit, each late frame with the hand-over, the files and the slow timers
 * in it, and how long the page's frame callbacks ran a frame. */
export function summariseSelfTimed(record: SelfTimedRecord, lateMs = 25) {
  const seconds = (time: number) => Math.round((time - record.t0) / 10) / 100;
  const gaps = record.frames.slice(1).map((time, index) => ({ start: record.frames[index]!, ms: time - record.frames[index]! }));
  const work = record.work.slice(1).sort((a, b) => a - b), at = (share: number) => work[Math.min(work.length - 1, Math.floor(work.length * share))] ?? 0;
  const late = gaps.filter(gap => gap.ms > lateMs).map(gap => ({ ms: Math.round(gap.ms), at: seconds(gap.start),
    handover: record.objects.filter(([time]) => time > gap.start - 400 && time <= gap.start + gap.ms + 400).map(([time, id]) => `${id} at ${seconds(time)} s`),
    arrived: record.files.filter(([time]) => time > gap.start - 120 && time <= gap.start + gap.ms).map(([, name, bytes]) => `${name} ${Math.round(bytes / 1024)} KB`),
    slow: record.slow.filter(([time, took]) => time + took > gap.start && time < gap.start + gap.ms).map(([, took, name]) => `${Math.round(took)} ms ${name}`) }));
  return { done: record.done, frames: gaps.length, over20: gaps.filter(gap => gap.ms > 20).length, over25: gaps.filter(gap => gap.ms > 25).length,
    over33: gaps.filter(gap => gap.ms > 33).length, longestMs: Math.round(Math.max(0, ...gaps.map(gap => gap.ms))),
    frameCallbacksMs: { mean: Math.round(work.reduce((sum, value) => sum + value, 0) / Math.max(1, work.length) * 100) / 100, p99: at(.99), longest: work.at(-1) ?? 0 },
    handovers: record.objects.map(([time, id]) => `${id} at ${seconds(time)} s`), late };
}

function parseRecord(value: unknown): SelfTimedRecord {
  if (typeof value !== 'string' || !value.startsWith('{')) throw new TypeError(`The page holds no self-timed run: ${JSON.stringify(value).slice(0, 200)}. Was it reloaded, or is another tab in front?`);
  const record = requireRecord(JSON.parse(value), 'self-timed record');
  const numbers = (name: string) => requireArray(record[name], `self-timed ${name}`).map(entry => requireFiniteNumber(entry, `self-timed ${name}`));
  const rows = (name: string) => requireArray(record[name], `self-timed ${name}`).map(entry => requireArray(entry, `self-timed ${name} row`));
  return { done: record.done === true, t0: requireFiniteNumber(record.t0, 'self-timed start'), frames: numbers('frames'), work: numbers('work'),
    objects: rows('objects').map(([time, id]) => [requireFiniteNumber(time, 'hand-over time'), typeof id === 'string' ? id : null] as const),
    files: rows('files').map(([time, name, bytes]) => [requireFiniteNumber(time, 'file time'), String(name), requireFiniteNumber(bytes, 'file bytes')] as const),
    slow: rows('slow').map(([time, took, name]) => [requireFiniteNumber(time, 'timer time'), requireFiniteNumber(took, 'timer duration'), String(name)] as const) };
}

async function main() {
  const args = process.argv.slice(2), value = (name: string) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
  const open = value('--open'), origin = value('--origin'), name = value('--name') ?? 'self-timed';
  if (!open) throw new TypeError('ipad-self-timed needs --open <path or URL>: the run starts from a fresh load of that page.');
  const program: readonly SelfTimedStep[] = value('--program') ? requireArray(JSON.parse(value('--program')!), '--program').map(step => {
    const [kind, frames, deltaY] = requireArray(step, 'program step');
    if (kind !== 'wheel' && kind !== 'wait') throw new TypeError(`A program step is ["wheel", frames, deltaY] or ["wait", frames], got ${JSON.stringify(step)}.`);
    return kind === 'wheel' ? ['wheel', requireFiniteNumber(frames, 'wheel frames'), requireFiniteNumber(deltaY, 'wheel deltaY')] as const : ['wait', requireFiniteNumber(frames, 'wait frames')] as const;
  }) : FAR_ZOOM;
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-self-timed-'));
  const steps = async (file: string, script: string) => { const path = join(directory, file); await writeFile(path, JSON.stringify([{ script }])); return path; };
  // The lean capture: no native recorder, no script sampler, no device sampler. It installs the run and leaves.
  await captureIosMoment(['--device', '--name', `${name}-start`, '--open', open, ...(origin ? ['--origin', origin] : []), '--steps', await steps('start.json', selfTimedStart(program)), '--no-js-samples']);
  const runMs = START_DELAY_MS + program.reduce((frames, step) => frames + step[1], 0) * 1000 / 60 + 3000;
  console.error(`The page runs alone for ${Math.round(runMs / 1000)} s.`);
  await new Promise(done => setTimeout(done, runMs));
  const { out, report } = await captureIosMoment(['--device', '--name', `${name}-read`, '--steps', await steps('read.json', SELF_TIMED_READ), '--no-js-samples']);
  const read = report.steps.at(-1);
  const summary = summariseSelfTimed(parseRecord(isRecord(read) ? read.value : null));
  await writeFile(resolve(out, 'self-timed.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Saved ${resolve(out, 'self-timed.json')}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main().then(() => process.exit(0), (error: unknown) => {
  console.error(`ipad-self-timed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
