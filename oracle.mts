// Replay oracle: main's camera input and the refactor receive identical scripted events.
// Every rotate() call, start/end callback, dispatched event, pointer capture, cursor write
// and stats() snapshot is recorded; the two traces must be identical.
import * as runtimePolicy from '../../site/runtime-policy.mts';
import { writeFileSync } from 'node:fs';

type Trace = unknown[][];
type Controls = { update(options: { drag?: boolean; wheel?: boolean }): void; stop(): void; invalidateTrackball(): void; stats(): unknown; destroy(): void };
type Module = { createUnboundedMatrixDragControls(options: Record<string, unknown>): Controls; createCameraMotion(): unknown };
const variants: Record<string, Module> = {
  main: await import('./controls-main.mjs') as Module,
  change: await import('./controls-change.mjs') as Module,
};
const trackball = { centerX: 346.5, centerY: 300, radius: 127.82, opticalCenterX: 326.5, opticalCenterY: 280,
  surfaceRadius: 144.65263161811257, focalLength: 598.73636504, viewportWidth: 693,
  sceneMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] };

function run(variant: Module, script: (world: World) => void): Trace {
  const trace: Trace = [];
  let now = 0, next = 0;
  const frames = new Map<number, (time: number) => void>();
  class FakeWheelEvent extends Event {
    constructor(type: string, init: Record<string, unknown>) { super(type, init as EventInit); for (const [key, value] of Object.entries(init)) Object.defineProperty(this, key, { value }); }
  }
  const win = Object.assign(new EventTarget(), {
    requestAnimationFrame(callback: (time: number) => void) { frames.set(++next, callback); return next; },
    cancelAnimationFrame(id: number) { frames.delete(id); },
    performance: { now: () => now },
    WheelEvent: FakeWheelEvent,
  });
  const document = Object.assign(new EventTarget(), { defaultView: win, hidden: false });
  class Surface extends EventTarget {
    ownerDocument = document;
    captures = new Set<number>();
    style = new Proxy({ userSelect: '', cursor: '' } as Record<string, unknown>, {
      set(target, key, value) { if (key === 'cursor' && target[key as string] !== value) trace.push(['cursor', value]); target[key as string] = value; return true; },
    });
    setPointerCapture(id: number) { this.captures.add(id); trace.push(['capture', id]); }
    hasPointerCapture(id: number) { return this.captures.has(id); }
    releasePointerCapture(id: number) { this.captures.delete(id); trace.push(['release', id]); }
    override dispatchEvent(event: Event) {
      const e = event as Event & { detail?: unknown; deltaY?: number; clientX?: number; clientY?: number; ctrlKey?: boolean };
      if (!['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'mousedown', 'dblclick', 'lostpointercapture'].includes(e.type)
          && !(e.type === 'wheel' && !(event instanceof FakeWheelEvent))) {
        trace.push(['event', e.type, e.detail ?? null, e.deltaY ?? null, e.clientX ?? null, e.clientY ?? null, e.ctrlKey ?? null]);
      }
      return super.dispatchEvent(event);
    }
  }
  Object.defineProperty(globalThis, 'HTMLElement', { configurable: true, value: Surface });
  const surface = new Surface();
  const counts = { start: 0, end: 0, pointerStart: 0 };
  const controls = variant.createUnboundedMatrixDragControls({
    inputSurface: surface, cameraMotion: variant.createCameraMotion(), runtimePolicy,
    trackballMetrics: () => ({ ...trackball }),
    rotate: (delta: unknown) => { trace.push(['rotate', JSON.stringify(delta)]); },
    surfaceFlyToState: () => ({ zoom: 1, minimumZoom: 0.5, maximumZoom: 8 }),
    onPointerStart: () => { counts.pointerStart++; }, onStart: () => { counts.start++; trace.push(['start']); }, onEnd: () => { counts.end++; trace.push(['end']); },
    onError: (error: unknown) => { trace.push(['error', String(error)]); },
  });
  const fire = (target: EventTarget, type: string, props: Record<string, unknown>) => {
    const event = new Event(type, { cancelable: true, bubbles: true });
    for (const [key, value] of Object.entries({ timeStamp: now, ...props })) Object.defineProperty(event, key, { value });
    target.dispatchEvent(event);
    trace.push(['prevented', type, event.defaultPrevented]);
  };
  const pointer = (type: string, id: number, x: number, y: number, extra: Record<string, unknown> = {}) =>
    fire(surface, type, { pointerId: id, clientX: x, clientY: y, isPrimary: id === 1, button: 0, pointerType: 'mouse', ...extra });
  const world = {
    controls, surface,
    at(ms: number) { now = ms; },
    now: () => now,
    tick(ms = 16) { now += ms; const callbacks = [...frames.values()]; frames.clear(); for (const callback of callbacks) callback(now); },
    ticks(count: number, ms = 16) { for (let i = 0; i < count; i++) world.tick(ms); },
    down: (id: number, x: number, y: number, extra?: Record<string, unknown>) => pointer('pointerdown', id, x, y, extra),
    move: (id: number, x: number, y: number, extra?: Record<string, unknown>) => pointer('pointermove', id, x, y, extra),
    up: (id: number, x: number, y: number, extra?: Record<string, unknown>) => pointer('pointerup', id, x, y, extra),
    cancel: (id: number, x: number, y: number, extra?: Record<string, unknown>) => pointer('pointercancel', id, x, y, extra),
    mousedown: (x: number, y: number, detail: number) => fire(surface, 'mousedown', { clientX: x, clientY: y, button: 0, detail }),
    dblclick: (x: number, y: number) => fire(surface, 'dblclick', { clientX: x, clientY: y, button: 0, detail: 2 }),
    wheel: (deltaY: number) => fire(surface, 'wheel', { deltaY, clientX: 346, clientY: 300, deltaMode: 0 }),
    key: (key: string) => fire(win, 'keydown', { key }),
    hide() { document.hidden = true; fire(document, 'visibilitychange', {}); },
    snapshot(label: string) { trace.push(['stats', label, JSON.stringify(controls.stats()), JSON.stringify(counts), frames.size]); },
  };
  // An accelerating drag of `steps` samples from (x, y), one per frame: step i moves i times (dx, dy), a flick.
  (world as World).drag = (id, x, y, steps, dx, dy, extra = {}) => {
    world.down(id, x, y, extra); world.snapshot('down');
    const at = (i: number) => [x + dx * i * (i + 1) / 2, y + dy * i * (i + 1) / 2] as const;
    for (let i = 1; i <= steps; i++) { world.tick(); world.move(id, ...at(i), extra); }
    world.snapshot('dragged');
    return [...at(steps)] as [number, number];
  };
  script(world as World);
  world.snapshot('end');
  try { controls.destroy(); } catch (error) { trace.push(['destroy-error', String(error)]); }
  trace.push(['after-destroy', JSON.stringify(counts), frames.size]);
  return trace;
}
type World = {
  controls: Controls; surface: EventTarget; at(ms: number): void; now(): number; tick(ms?: number): void; ticks(count: number, ms?: number): void;
  down(id: number, x: number, y: number, extra?: Record<string, unknown>): void; move(id: number, x: number, y: number, extra?: Record<string, unknown>): void;
  up(id: number, x: number, y: number, extra?: Record<string, unknown>): void; cancel(id: number, x: number, y: number, extra?: Record<string, unknown>): void;
  mousedown(x: number, y: number, detail: number): void; dblclick(x: number, y: number): void; wheel(deltaY: number): void; key(key: string): void; hide(): void;
  snapshot(label: string): void; drag(id: number, x: number, y: number, steps: number, dx: number, dy: number, extra?: Record<string, unknown>): [number, number];
};

const throwDrag = (w: World, x = 330, y = 300, extra: Record<string, unknown> = {}) => {
  const [ex, ey] = w.drag(1, x, y, 6, 3, 1, extra); w.at(w.now() + 0.1); w.up(1, ex, ey, extra); w.snapshot('released'); return [ex, ey];
};
const flyTo = (w: World) => { w.mousedown(350, 300, 2); w.dblclick(350, 300); w.snapshot('fly-to'); };
const scenarios: Record<string, (w: World) => void> = {
  'surface throw runs inertia to rest': w => { throwDrag(w); w.ticks(120); w.snapshot('rested'); },
  'slow release has no inertia': w => { const [x, y] = w.drag(1, 330, 300, 8, 12, 3); w.tick(200); w.up(1, x, y); w.snapshot('released'); w.ticks(10); },
  'sky drag and throw': w => { throwDrag(w, 20, 30); w.ticks(120); w.snapshot('rested'); },
  'pointercancel ends the drag': w => { const [x, y] = w.drag(1, 330, 300, 6, 10, 0); w.cancel(1, x, y); w.snapshot('cancelled'); w.ticks(5); },
  'press interrupts inertia and drags again': w => { throwDrag(w); w.ticks(4); throwDrag(w, 300, 320); w.ticks(120); },
  'wheel interrupts inertia': w => { throwDrag(w); w.ticks(3); w.wheel(-40); w.snapshot('wheeled'); w.ticks(5); },
  'wheel during a press': w => { w.drag(1, 330, 300, 3, 10, 0); w.wheel(30); w.snapshot('wheeled'); w.up(1, 360, 300); w.ticks(5); },
  'double-click fly-to completes': w => { flyTo(w); w.ticks(400); w.snapshot('landed'); },
  'press interrupts fly-to': w => { flyTo(w); w.ticks(10); throwDrag(w); w.ticks(120); },
  'wheel interrupts fly-to': w => { flyTo(w); w.ticks(10); w.wheel(50); w.snapshot('wheeled'); w.ticks(10); },
  'Escape and hidden page during fly-to': w => { flyTo(w); w.ticks(5); w.key('Escape'); w.ticks(3); w.hide(); w.snapshot('hidden'); w.ticks(10); },
  'pinch zooms and abandons the orbit': w => {
    const touch = { pointerType: 'touch' };
    w.down(1, 300, 300, touch); w.tick(); w.move(1, 310, 300, touch); w.tick(); w.move(1, 320, 300, touch); w.snapshot('orbiting');
    w.down(2, 420, 300, { ...touch, isPrimary: false }); w.snapshot('pinch');
    for (let i = 1; i <= 5; i++) { w.tick(); w.move(2, 420 + i * 15, 300, { ...touch, isPrimary: false }); }
    w.up(2, 495, 300, { ...touch, isPrimary: false }); w.up(1, 320, 300, touch); w.snapshot('lifted'); w.ticks(5);
  },
  'vertical sky flick': w => { const [x, y] = w.drag(1, 20, 60, 6, 0, 4); w.at(w.now() + 0.1); w.up(1, x, y); w.snapshot('released'); w.ticks(120); },
  'vertical globe flick': w => { const [x, y] = w.drag(1, 346, 230, 6, 0, 3); w.at(w.now() + 0.1); w.up(1, x, y); w.snapshot('released'); w.ticks(120); },
  // Gentle flicks clear the 2.5 px throw gate while staying under the 30°/s pitch and 90°/s yaw caps.
  'gentle globe flick': w => { let x = 330; w.down(1, x, 300); for (const step of [1, 1, 1, 1, 1, 4]) { w.tick(); x += step; w.move(1, x, 300); }
    w.at(w.now() + 0.1); w.up(1, x, 300); w.snapshot('released'); w.ticks(120); },
  'gentle sky flick': w => { let y = 60; w.down(1, 20, y); for (const step of [0.5, 0.5, 0.5, 0.5, 0.5, 3.1]) { w.tick(); y += step; w.move(1, 20, y); }
    w.at(w.now() + 0.1); w.up(1, 20, y); w.snapshot('released'); w.ticks(120); },
  'touch throw': w => { throwDrag(w, 330, 300, { pointerType: 'touch' }); w.ticks(120); },
  'disable, re-enable, stop and invalidate': w => {
    w.drag(1, 330, 300, 3, 10, 0); w.controls.update({ drag: false }); w.snapshot('disabled'); w.move(1, 380, 300); w.controls.update({ drag: true });
    w.drag(1, 330, 300, 3, 10, 0); w.controls.invalidateTrackball(); w.tick(); w.move(1, 380, 310); w.snapshot('invalidated');
    w.up(1, 380, 310); w.ticks(2); w.controls.stop(); w.snapshot('stopped'); w.ticks(5);
  },
  'destroy during inertia': w => { throwDrag(w); w.ticks(3); },
  'coalesced samples': w => {
    w.down(1, 330, 300); w.tick();
    const samples = [340, 352, 365].map((x, i) => Object.assign(new Event('pointermove'), { clientX: x, clientY: 300 + i, pointerId: 1 }));
    for (const [i, sample] of samples.entries()) Object.defineProperty(sample, 'timeStamp', { value: 16 + i * 5 });
    w.move(1, 365, 302, { getCoalescedEvents: () => samples }); w.tick(); w.move(1, 380, 305); w.up(1, 380, 305); w.ticks(60);
  },
};
let identical = 0;
const report: Record<string, { steps: number; rotates: number; identical: boolean; exercised?: string; firstDifference?: { index: number; main: unknown; change: unknown } }> = {};
for (const [name, script] of Object.entries(scenarios)) {
  const main = run(variants.main, script), change = run(variants.change, script);
  const index = main.findIndex((entry, i) => JSON.stringify(entry) !== JSON.stringify(change[i]));
  const same = index === -1 && main.length === change.length;
  if (same) identical++;
  report[name] = { steps: main.length, rotates: main.filter(entry => entry[0] === 'rotate').length, identical: same,
    ...(same ? {} : { firstDifference: { index: index === -1 ? Math.min(main.length, change.length) : index, main: main[index] ?? null, change: change[index] ?? null } }) };
  const last = JSON.parse(String([...main].reverse().find(entry => entry[0] === 'stats')![2]));
  const exercised = `inertia ${last.starts} starts/${last.frames} frames, fly-to ${last.surfaceFlyTo.starts} starts/${last.surfaceFlyTo.frames} frames/${last.surfaceFlyTo.completions} landed`;
  report[name] = { ...report[name], exercised } as typeof report[string];
  console.log(`${same ? 'same' : 'DIFF'}  ${name}  (${main.length} records, ${report[name].rotates} rotations; ${exercised})`);
  if (!same) console.log('   main:  ', JSON.stringify(report[name].firstDifference!.main).slice(0, 300), '\n   change:', JSON.stringify(report[name].firstDifference!.change).slice(0, 300));
}
writeFileSync(new URL('./oracle-report.json', import.meta.url), JSON.stringify(report, null, 1));
console.log(`${identical}/${Object.keys(scenarios).length} scenarios identical`);
