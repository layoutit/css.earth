#!/usr/bin/env node
/**
 * Frame times the page records itself on the connected iPad, with the capture tools detached.
 *
 * A capture with the native recorder attached spends 16 to 17 ms of the device's CPU a frame on its own processes,
 * three times the page's main thread, and some of the late frames it shows are its own (2026-10-04). This command
 * starts a program of input in the page after a delay, leaves, and comes back for what the page recorded: every frame's
 * time, the time its frame callbacks ran, the hand-overs, the files that arrived and the slow timers. Count late
 * frames with it; name what runs in them with `ios-capture.mts`.
 *
 *   pnpm ipad:timed --open /earth/ --origin http://192.168.0.8:4293 [--program drag|zoom|fly|datasets|far-zoom|'<json>'] [--name x] [--trace]
 *
 * `--trace` runs the program with the Inspector's timeline attached instead, and writes `trace.devtools.json`, which
 * Chrome DevTools' Performance panel opens: cut to the run, a time stamp at each step, every frame in the Frames track
 * and the iPad's screen as the filmstrip. The run to look at, not to count by.
 */
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { isRecord, requireArray, requireFiniteNumber, requireRecord } from '@cssearth/core';
import { captureIosMoment } from './ios-capture.mts';

/** A step of the page's own driver. `wheel`: that many frames of a wheel event of `deltaY` each. `wait`: that many frames
 * of nothing. `drag`: a finger down, moved `dx`, `dy` a frame for that many frames, and lifted at once (`fling`) or
 * after a pause (`hold`, no inertia). `fly`: the app's own navigation to an object. `click`: the n-th element the
 * selector finds, if there is one. `pick`: the n-th option of the first `select` the selector finds, as a reader's
 * choice (its `input` and `change` events). */
export type SelfTimedStep = readonly ['wheel', number, number] | readonly ['wait', number] | readonly ['drag', number, number, number, 'fling' | 'hold']
  | readonly ['fly', string] | readonly ['click', string, number] | readonly ['pick', string, number];
/** Out of the page's subject and back, twice: the zoom the late-frame counts of this lab are quoted for. */
export const FAR_ZOOM: readonly SelfTimedStep[] = [['wheel', 330, 20], ['wait', 150], ['wheel', 330, -20], ['wait', 150], ['wheel', 330, 20], ['wait', 150], ['wheel', 330, -20], ['wait', 240]];
/** The three things a reader does most, a few seconds each. Open `drag` and `zoom` on a body's page, `fly` on Earth's. */
const DRAG: readonly SelfTimedStep[] = [['drag', 60, 6, 0, 'fling'], ['wait', 90], ['drag', 60, -4, 3, 'fling'], ['wait', 90], ['drag', 45, 0, -5, 'hold'], ['wait', 45]];
const ZOOM: readonly SelfTimedStep[] = [['wheel', 90, 20], ['wait', 45], ['wheel', 90, -20], ['wait', 45], ['wheel', 45, -20], ['wait', 30], ['wheel', 45, 20], ['wait', 45]];
const FLY: readonly SelfTimedStep[] = [['fly', 'moon'], ['wait', 210], ['fly', 'mars'], ['wait', 210]];
/** A body's datasets, one after another and back to the first, through the card's dataset list. */
const DATASET_LIST = 'select.object-dataset-native-select';
const DATASETS: readonly SelfTimedStep[] = [['wait', 30], ['pick', DATASET_LIST, 1], ['wait', 120], ['pick', DATASET_LIST, 2], ['wait', 120], ['pick', DATASET_LIST, 0], ['wait', 120]];
export const PROGRAMS: Readonly<Record<string, readonly SelfTimedStep[]>> = { 'far-zoom': FAR_ZOOM, drag: DRAG, zoom: ZOOM, fly: FLY, datasets: DATASETS };
/** How many frames a step takes: a flight, a click or a pick is one event. */
const stepFrames = (step: SelfTimedStep) => step[0] === 'fly' || step[0] === 'click' || step[0] === 'pick' ? 0 : step[1];
export const stepLabel = (step: SelfTimedStep) => step[0] === 'wheel' ? `wheel ${step[2] > 0 ? 'out' : 'in'}, ${step[1]} frames` : step[0] === 'wait' ? `wait, ${step[1]} frames`
  : step[0] === 'drag' ? `drag ${step[2]}, ${step[3]} a frame for ${step[1]} frames, ${step[4]}` : step[0] === 'fly' ? `fly to ${step[1]}` : `${step[0]} ${step[1]} #${step[2]}`;
/** The run starts this long after the script is installed, so the Inspector session that installed it has gone. */
const START_DELAY_MS = 3000;

/** What every time stamp of a run starts with: the DevTools chart of a traced run is cut to them. */
const RUN_MARK = 'self-timed';

/** The page script that records a run of `program`, starting after `delayMs`. It stamps the timeline at each step and at the end. */
export const selfTimedStart = (program: readonly SelfTimedStep[], delayMs = START_DELAY_MS) => `(() => { const w = window;
  const state = w.__selfTimed = { done: false, t0: 0, frames: [], work: [], objects: [], files: [], slow: [], marks: [], skipped: [] };
  const label = fn => (fn && fn.name ? fn.name : '') + ':' + String(fn).replace(/\\s+/g, ' ').slice(0, 70);
  let inFrame = 0;
  const timer = w.setTimeout; w.setTimeout = (fn, ms, ...rest) => timer(typeof fn === 'function' ? function (...args) { const before = performance.now();
    try { return fn.apply(this, args); } finally { const took = performance.now() - before; if (took > 8) state.slow.push([before, took, label(fn)]); } } : fn, ms, ...rest);
  const frame = w.requestAnimationFrame; w.requestAnimationFrame = fn => frame(function (t) { const before = performance.now(); try { return fn(t); } finally { inFrame += performance.now() - before; } });
  new PerformanceObserver(list => { for (const entry of list.getEntries()) state.files.push([entry.responseEnd, entry.name.split('/').slice(3).join('/').split('?')[0].slice(-48), entry.transferSize || entry.encodedBodySize || 0]); }).observe({ type: 'resource' });
  const cx = innerWidth / 2, cy = innerHeight / 2, program = ${JSON.stringify(program)}, labels = ${JSON.stringify(program.map(stepLabel))};
  let target = null, age = 0, step = 0, left = 0, last = null, finger = null, x = cx, y = cy;
  const wheel = deltaY => { if (age++ % 30 === 0 || !target || !target.isConnected) target = document.elementFromPoint(cx, cy) || document.body;
    target.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: cx, clientY: cy, deltaY, deltaMode: 0 })); };
  const pointer = (type, px, py) => finger.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, clientX: px, clientY: py, pointerId: 7, pointerType: 'touch',
    isPrimary: true, button: type === 'pointermove' ? -1 : 0, buttons: type === 'pointerup' ? 0 : 1, width: 10, height: 10, pressure: type === 'pointerup' ? 0 : .5 }));
  const fly = objectId => { document.dispatchEvent(new CustomEvent('objectnavigationquery', { bubbles: true, cancelable: true, detail: { objectId } }));
    const go = new CustomEvent('objectnavigate', { bubbles: true, cancelable: true, detail: { objectId } }); document.dispatchEvent(go); return go.defaultPrevented; };
  // The driver's own callback is not wrapped: what it adds to a frame is the work of the frame callbacks before it.
  const tick = t => { state.frames.push(t); state.work.push(inFrame); inFrame = 0;
    const id = w.__cssEarth && w.__cssEarth.activeObjectId; if (id !== last) { state.objects.push([t, id]); last = id; }
    while (step < program.length && left === 0) { const now = program[step]; state.marks.push([performance.now(), step]); console.timeStamp('${RUN_MARK} ' + labels[step]);
      if (now[0] === 'fly') { if (!fly(now[1])) state.skipped.push(step); step++; continue; }
      if (now[0] === 'click') { const found = document.querySelectorAll(now[1])[now[2]]; if (found) found.click(); else state.skipped.push(step); step++; continue; }
      if (now[0] === 'pick') { const list = document.querySelector(now[1]);
        if (list && list.options && list.options[now[2]]) { list.selectedIndex = now[2]; list.dispatchEvent(new Event('input', { bubbles: true })); list.dispatchEvent(new Event('change', { bubbles: true })); }
        else state.skipped.push(step); step++; continue; }
      left = now[1];
      if (now[0] === 'drag') { x = cx - now[2] * now[1] / 2; y = cy - now[3] * now[1] / 2; finger = document.elementFromPoint(x, y) || document.body; pointer('pointerdown', x, y); } }
    if (step >= program.length) { state.done = true; console.timeStamp('${RUN_MARK} end'); return; }
    const now = program[step];
    if (now[0] === 'wheel') wheel(now[2]);
    if (now[0] === 'drag') { x += now[2]; y += now[3]; pointer('pointermove', x, y);
      if (left === 1) { const ux = x, uy = y; if (now[4] === 'fling') pointer('pointerup', ux, uy); else timer(() => pointer('pointerup', ux, uy), 120); } }
    if (--left === 0) step++;
    frame(tick); };
  timer(() => { state.t0 = performance.now(); frame(tick); }, ${delayMs});
  return 'self-timed run in ${delayMs} ms'; })()`;

/** The page script that hands the record back. */
export const SELF_TIMED_READ = `(() => { const s = window.__selfTimed; if (!s) return 'no self-timed run on this page';
  const tenth = value => Math.round(value * 10) / 10;
  return JSON.stringify({ done: s.done, t0: tenth(s.t0), frames: s.frames.map(tenth), work: s.work.map(tenth), objects: s.objects.map(o => [tenth(o[0]), o[1]]),
    files: s.files.map(f => [tenth(f[0]), f[1], f[2]]), slow: s.slow.map(c => [tenth(c[0]), tenth(c[1]), c[2]]), marks: s.marks.map(m => [tenth(m[0]), m[1]]), skipped: s.skipped }); })()`;

export interface SelfTimedRecord { readonly done: boolean; readonly t0: number; readonly frames: readonly number[]; readonly work: readonly number[];
  readonly objects: readonly (readonly [number, string | null])[]; readonly files: readonly (readonly [number, string, number])[]; readonly slow: readonly (readonly [number, number, string])[];
  /** When each step of the program began, and the flights and clicks the page did not take. */
  readonly marks: readonly (readonly [number, number])[]; readonly skipped: readonly number[] }

/** What a record says: the frames over each limit, each late frame with the step of `program` it fell in, the hand-over,
 * the files and the slow timers in it, and how long the page's frame callbacks ran a frame. */
export function summariseSelfTimed(record: SelfTimedRecord, program: readonly SelfTimedStep[] = [], lateMs = 25) {
  const seconds = (time: number) => Math.round((time - record.t0) / 10) / 100;
  const gaps = record.frames.slice(1).map((time, index) => ({ start: record.frames[index]!, ms: time - record.frames[index]! }));
  const work = record.work.slice(1).sort((a, b) => a - b), at = (share: number) => work[Math.min(work.length - 1, Math.floor(work.length * share))] ?? 0;
  const stepAt = (time: number) => { const mark = record.marks.filter(([began]) => began <= time).at(-1), step = mark && program[mark[1]];
    return mark && step ? `${stepLabel(step)}, ${seconds(time) - seconds(mark[0]) >= 0 ? Math.round((time - mark[0]) / 10) / 100 : 0} s in` : null; };
  const late = gaps.filter(gap => gap.ms > lateMs).map(gap => ({ ms: Math.round(gap.ms), at: seconds(gap.start), step: stepAt(gap.start + gap.ms),
    handover: record.objects.filter(([time]) => time > gap.start - 400 && time <= gap.start + gap.ms + 400).map(([time, id]) => `${id} at ${seconds(time)} s`),
    arrived: record.files.filter(([time]) => time > gap.start - 120 && time <= gap.start + gap.ms).map(([, name, bytes]) => `${name} ${Math.round(bytes / 1024)} KB`),
    slow: record.slow.filter(([time, took]) => time + took > gap.start && time < gap.start + gap.ms).map(([, took, name]) => `${Math.round(took)} ms ${name}`) }));
  return { done: record.done, frames: gaps.length, over20: gaps.filter(gap => gap.ms > 20).length, over25: gaps.filter(gap => gap.ms > 25).length,
    over33: gaps.filter(gap => gap.ms > 33).length, longestMs: Math.round(Math.max(0, ...gaps.map(gap => gap.ms))),
    frameCallbacksMs: { mean: Math.round(work.reduce((sum, value) => sum + value, 0) / Math.max(1, work.length) * 100) / 100, p99: at(.99), longest: work.at(-1) ?? 0 },
    handovers: record.objects.map(([time, id]) => `${id} at ${seconds(time)} s`),
    skipped: record.skipped.flatMap(step => program[step] ? [stepLabel(program[step])] : []), late };
}

function parseRecord(value: unknown): SelfTimedRecord {
  if (typeof value !== 'string' || !value.startsWith('{')) throw new TypeError(`The page holds no self-timed run: ${JSON.stringify(value).slice(0, 200)}. Was it reloaded, or is another tab in front?`);
  const record = requireRecord(JSON.parse(value), 'self-timed record');
  const numbers = (name: string) => requireArray(record[name], `self-timed ${name}`).map(entry => requireFiniteNumber(entry, `self-timed ${name}`));
  const rows = (name: string) => requireArray(record[name], `self-timed ${name}`).map(entry => requireArray(entry, `self-timed ${name} row`));
  return { done: record.done === true, t0: requireFiniteNumber(record.t0, 'self-timed start'), frames: numbers('frames'), work: numbers('work'),
    objects: rows('objects').map(([time, id]) => [requireFiniteNumber(time, 'hand-over time'), typeof id === 'string' ? id : null] as const),
    files: rows('files').map(([time, name, bytes]) => [requireFiniteNumber(time, 'file time'), String(name), requireFiniteNumber(bytes, 'file bytes')] as const),
    slow: rows('slow').map(([time, took, name]) => [requireFiniteNumber(time, 'timer time'), requireFiniteNumber(took, 'timer duration'), String(name)] as const),
    marks: rows('marks').map(([time, step]) => [requireFiniteNumber(time, 'step time'), requireFiniteNumber(step, 'step')] as const),
    skipped: requireArray(record.skipped, 'self-timed skipped').map(step => requireFiniteNumber(step, 'skipped step')) };
}

function parseProgram(value: unknown): SelfTimedStep[] {
  return requireArray(value, '--program').map(step => {
    const [kind, a, b, c, d] = requireArray(step, 'program step');
    if (kind === 'wheel') return ['wheel', requireFiniteNumber(a, 'wheel frames'), requireFiniteNumber(b, 'wheel deltaY')] as const;
    if (kind === 'wait') return ['wait', requireFiniteNumber(a, 'wait frames')] as const;
    if (kind === 'drag' && (d === 'fling' || d === 'hold')) return ['drag', requireFiniteNumber(a, 'drag frames'), requireFiniteNumber(b, 'drag dx'), requireFiniteNumber(c, 'drag dy'), d] as const;
    if (kind === 'fly' && typeof a === 'string') return ['fly', a] as const;
    if (kind === 'click' && typeof a === 'string') return ['click', a, requireFiniteNumber(b ?? 0, 'click index')] as const;
    if (kind === 'pick' && typeof a === 'string') return ['pick', a, requireFiniteNumber(b ?? 0, 'pick index')] as const;
    throw new TypeError(`A program step is ["wheel", frames, deltaY], ["wait", frames], ["drag", frames, dx, dy, "fling"|"hold"], ["fly", id], ["click", selector, n] or ["pick", selector, n], got ${JSON.stringify(step)}.`);
  });
}

async function main() {
  const args = process.argv.slice(2), value = (name: string) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
  const open = value('--open'), origin = value('--origin'), name = value('--name') ?? value('--program') ?? 'self-timed';
  if (!open) throw new TypeError('ipad-self-timed needs --open <path or URL>: the run starts from a fresh load of that page.');
  const asked = value('--program') ?? 'far-zoom';
  const program = PROGRAMS[asked] ?? parseProgram(JSON.parse(asked));
  const frames = program.reduce((sum, step) => sum + stepFrames(step), 0), runMs = frames * 1000 / 60;
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-self-timed-'));
  const steps = async (file: string, list: readonly unknown[]) => { const path = join(directory, file); await writeFile(path, JSON.stringify(list)); return path; };
  const fresh = ['--open', open, ...(origin ? ['--origin', origin] : [])];
  if (args.includes('--trace')) {
    // The run with the Inspector's timeline attached and the iPad's screen recorded as the chart's filmstrip, for
    // Chrome DevTools: to look at, not to count by.
    const traced = await captureIosMoment(['--device', '--name', `${name}-traced`, ...fresh, '--screens',
      '--steps', await steps('traced.json', [{ script: selfTimedStart(program, 0) }, { wait: Math.ceil(runMs / 1000) + 1 }])]);
    await promisify(execFile)(process.execPath, [fileURLToPath(new URL('./webkit-devtools-trace.mts', import.meta.url)), traced.out, '--marks', RUN_MARK]);
    console.log(`DevTools trace: ${resolve(traced.out, 'trace.devtools.json')}`);
    return;
  }
  // The lean capture: no native recorder, no script sampler, no device sampler. It installs the run and leaves.
  await captureIosMoment(['--device', '--name', `${name}-start`, ...fresh, '--steps', await steps('start.json', [{ script: selfTimedStart(program) }]), '--no-js-samples']);
  await new Promise(done => setTimeout(done, START_DELAY_MS + runMs + 1500));
  const { out, report } = await captureIosMoment(['--device', '--name', `${name}-read`, '--steps', await steps('read.json', [{ script: SELF_TIMED_READ }]), '--no-js-samples']);
  const read = report.steps.at(-1);
  const summary = summariseSelfTimed(parseRecord(isRecord(read) ? read.value : null), program);
  await writeFile(resolve(out, 'self-timed.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Saved ${resolve(out, 'self-timed.json')}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main().then(() => process.exit(0), (error: unknown) => {
  console.error(`ipad-self-timed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
