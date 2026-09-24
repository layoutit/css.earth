// Wheel zoom scenarios for `jankmonster oracle`: a fake surface, window and frame clock, the site's runtime policy,
// and a camera clamped between two distances. Every rotation, prevented event and stats snapshot is recorded.
import * as runtimePolicy from '../../site/runtime-policy.mts';

type Controls = { stop(): void; update(options: { wheel?: boolean }): void; destroy(): void; stats(): unknown };
type Subject = { createPreparedWheelZoomControls(options: Record<string, unknown>): Controls };
type Record = (...values: unknown[]) => void;

function world(subject: Subject, record: Record, { distance = 10, minimum = 1, maximum = 100 } = {}) {
  let now = 0, next = 0;
  const frames = new Map<number, (time: number) => void>();
  const win = Object.assign(new EventTarget(), {
    requestAnimationFrame(callback: (time: number) => void) { frames.set(++next, callback); return next; },
    cancelAnimationFrame(id: number) { frames.delete(id); },
    performance: { now: () => now }, innerHeight: 800,
  });
  class Surface extends EventTarget { ownerDocument = { defaultView: win }; clientHeight = 600; }
  Object.defineProperty(globalThis, 'HTMLElement', { configurable: true, value: Surface });
  const surface = new Surface();
  const camera = { state: { distance } };
  const controls = subject.createPreparedWheelZoomControls({ inputSurface: surface, runtimePolicy, camera, dolly: { stepPerDelta: 0.002 },
    rotate(delta: { distance: number }) {
      camera.state.distance = Math.min(maximum, Math.max(minimum, delta.distance));
      record('rotate', now, delta.distance, camera.state.distance);
    } });
  const w = {
    controls,
    tick(ms = 16) { now += ms; const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(now); },
    ticks(count: number, ms = 16) { for (let i = 0; i < count; i++) w.tick(ms); },
    wheel(deltaY: number, { deltaMode = 0, ctrlKey = false, deltaX = 0, prevented = false } = {}) {
      const event = new Event('wheel', { cancelable: true });
      for (const [key, value] of Object.entries({ deltaY, deltaMode, ctrlKey, deltaX, timeStamp: now })) Object.defineProperty(event, key, { value });
      if (prevented) event.preventDefault();
      surface.dispatchEvent(event);
      record('wheel', now, deltaY, event.defaultPrevented);
    },
    snapshot(label: string) { record('stats', label, controls.stats(), camera.state.distance, frames.size); },
  };
  return w;
}
const scenario = (script: (w: ReturnType<typeof world>) => void, options?: Parameters<typeof world>[2]) =>
  async ({ subject, record }: { subject: Subject; record: Record }) => { const w = world(subject, record, options); script(w); w.snapshot('end'); w.controls.destroy(); w.snapshot('destroyed'); };

export const scenarios = {
  'one wheel notch dollies, then glides to rest': scenario(w => { w.wheel(100); w.snapshot('notch'); w.ticks(14); w.snapshot('interval spent'); w.ticks(60); w.snapshot('rested'); }),
  'a notch in lines and in pages': scenario(w => { w.wheel(3, { deltaMode: 1 }); w.ticks(40); w.wheel(-1, { deltaMode: 2 }); w.ticks(60); }),
  'notches in a row extend one dolly': scenario(w => { for (let i = 0; i < 4; i++) { w.wheel(-100); w.ticks(3); } w.snapshot('four notches'); w.ticks(80); }),
  'trackpad swipes keep their measured speed across gestures': scenario(w => {
    for (let i = 0; i < 6; i++) { w.wheel(-7.5); w.ticks(1); } w.ticks(20); w.snapshot('first swipe spent');
    w.ticks(10); for (let i = 0; i < 6; i++) { w.wheel(-7.5); w.ticks(1); } w.ticks(30); w.snapshot('second swipe spent');
    for (let i = 0; i < 4; i++) { w.wheel(9.25); w.ticks(1); } w.ticks(30); w.snapshot('reversed swipe spent');
  }),
  'a wheel notch after a trackpad swipe releases from the travelled speed': scenario(w => {
    for (let i = 0; i < 6; i++) { w.wheel(-7.5); w.ticks(1); } w.ticks(20); w.snapshot('swipe spent');
    w.ticks(30); w.wheel(-100); w.snapshot('notch'); w.ticks(14); w.snapshot('released'); w.ticks(60);
  }),
  'a pinch is a trackpad gesture with its own gain': scenario(w => { for (let i = 0; i < 10; i++) { w.wheel(-2.5, { ctrlKey: true }); w.ticks(1); } w.ticks(40); }),
  'a reversal mid-dolly starts from the camera': scenario(w => { w.wheel(100); w.ticks(3); w.wheel(-100); w.snapshot('reversed'); w.ticks(80); }),
  'a new notch ends a glide where it stands': scenario(w => { w.wheel(-100); w.ticks(14); w.snapshot('gliding'); w.ticks(2); w.wheel(-100); w.snapshot('new notch'); w.ticks(80); }),
  'a bound clamps the dolly and stops the glide': scenario(w => { w.wheel(-400); w.ticks(80); w.snapshot('at the bound'); w.wheel(-100); w.ticks(40); }, { distance: 1.4 }),
  'a glide into the far bound stops': scenario(w => { w.wheel(150); w.ticks(14); w.snapshot('gliding out'); w.ticks(60); }, { distance: 60 }),
  'frames that straddle the interval hand their leftover to the glide': scenario(w => { w.wheel(-100); w.ticks(7, 33); w.snapshot('handed over'); w.ticks(20, 33); }),
  'stop, disable and re-enable': scenario(w => {
    w.wheel(-100); w.ticks(14); w.controls.stop(); w.snapshot('stopped mid-glide'); w.ticks(5);
    w.wheel(100); w.ticks(3); w.controls.update({ wheel: false }); w.snapshot('disabled mid-dolly'); w.wheel(100); w.ticks(5);
    w.controls.update({ wheel: true }); w.wheel(100); w.ticks(40);
  }),
  'ignored events': scenario(w => { w.wheel(0); w.wheel(Number.NaN); w.wheel(100, { prevented: true }); w.snapshot('nothing'); w.ticks(3); }),
  'destroy mid-dolly': scenario(w => { w.wheel(-100); w.ticks(3); w.controls.destroy(); w.snapshot('destroyed early'); w.ticks(5); w.wheel(-100); w.ticks(3); }),
};
