// View readout scenarios for `jankmonster oracle`: a linkedom sidebar, a fake window with timers and frames, and a
// fake camera looking at a prepared focus. After every step the readout's visible facts and pending work are recorded.
import { parseHTML } from 'linkedom';

type Readout = { setPreparedFocus(r: unknown): void; setCamera(c: unknown): void; setOverviewScope(s: string): void;
  setPlaybackState(s: { allowed: boolean; reason: string }): void; setNavigationInFlight(a: boolean): void; destroy(): void };
type Subject = { createViewReadout(options: Record<string, unknown>): Readout };
type Record = (...values: unknown[]) => void;

const markup = `<div class="drawer"></div><div class="object-view-readout">
  <span class="object-view-date"><time data-view-date></time></span>
  <span class="object-view-coordinates"><span data-view-latitude></span><span data-view-longitude></span></span>
  <span class="object-view-altitude"><span data-view-distance-label></span><span data-view-altitude></span></span>
  <span class="object-view-scale"><span data-view-scale-label></span><span class="object-view-ruler"></span><span class="object-view-measure"></span></span>
</div><div class="polycss-scene"></div>`;

function world(subject: Subject, record: Record) {
  const { document, Event: DomEvent } = parseHTML(`<!doctype html><html><body>${markup}</body></html>`) as unknown as { document: Document; Event: typeof Event };
  let hidden = false, now = 0, nextId = 0, renders = 0;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  const timers = new Map<number, { at: number; run: () => void }>(), frames = new Map<number, (t: number) => void>();
  const win = Object.assign(new EventTarget(), {
    performance: { now: () => now },
    setTimeout: (run: () => void, wait: number) => { timers.set(++nextId, { at: now + wait, run }); return nextId; },
    clearTimeout: (id: number) => { timers.delete(id); },
    requestAnimationFrame: (run: (t: number) => void) => { frames.set(++nextId, () => { renders++; run(now); }); return nextId; },
    cancelAnimationFrame: (id: number) => { frames.delete(id); },
  });
  let listener: (() => void) | null = null, position = [0, 0, 5e6];
  const navigation = {
    frame: { originM: [0, 0, 0], bodyRadiusM: 1e6, metersPerUnit: 1 },
    capture: () => ({ epochJdTt: 2461000.25, pose: { positionM: [...position], orientationXyzw: [0, 0, 0, 1] } }),
    optics: () => ({ focalPixels: 1000 }),
    subscribe(next: () => void) { listener = next; return () => { listener = null; }; },
  };
  const camera = { navigation, sharedView: null };
  const q = (s: string) => document.querySelector(s) as HTMLElement;
  const readout = subject.createViewReadout({ drawer: q('.drawer'), documentTarget: document, windowTarget: win });
  const w = {
    readout, camera,
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        now = Math.max(now, due[1].at); timers.delete(due[0]); due[1].run();
      }
      now = end;
    },
    paint() { const pending = [...frames.values()]; frames.clear(); for (const run of pending) run(now); },
    tick(ms = 16) { w.advance(ms); w.paint(); },
    move(z: number) { position = [0, 0, z]; listener?.(); },
    setHidden(value: boolean) { hidden = value; document.dispatchEvent(new DomEvent('visibilitychange')); },
    resize() { win.dispatchEvent(new Event('resize')); },
    removeScene() { q('.polycss-scene')?.remove(); },
    snap(label: string) {
      record(label, {
        dateHidden: q('.object-view-date').hidden, date: q('[data-view-date]').textContent,
        coordinatesHidden: q('.object-view-coordinates').hidden, latitude: q('[data-view-latitude]').textContent,
        altitude: q('[data-view-altitude]').textContent, distanceLabel: q('[data-view-distance-label]').textContent,
        distanceTitle: q('.object-view-altitude').title,
        scaleHidden: q('.object-view-scale').hidden, scaleLabel: q('[data-view-scale-label]').textContent,
        ruler: q('.object-view-ruler').style.width, measure: q('.object-view-measure').style.width, scaleTitle: q('.object-view-scale').title,
        timers: timers.size, frames: frames.size, renders, subscribed: listener !== null,
      });
    },
  };
  return w;
}
const focus = { name: 'M42', positionM: [0, 0, -4e18] };
const scenario = (script: (w: ReturnType<typeof world>) => void) =>
  async ({ subject, record }: { subject: Subject; record: Record }) => { const w = world(subject, record); script(w); w.snap('end'); };

export const scenarios = {
  'no camera clears the whole reading, date included': scenario(w => { w.snap('created'); w.tick(); w.snap('first frame'); }),
  'a focus reading, then camera moves throttled to one render per 100 ms': scenario(w => {
    w.readout.setPreparedFocus(focus); w.readout.setCamera(w.camera); w.snap('camera set'); w.tick(); w.snap('rendered');
    w.move(6e6); w.snap('moved at once'); w.tick(); w.snap('after one frame'); w.advance(90); w.paint(); w.snap('after the interval');
    w.move(7e6); w.move(8e6); w.snap('two moves'); w.advance(120); w.paint(); w.snap('one render for both');
  }),
  'a flight blanks the reading but keeps the date, holds still, and arrival refreshes once': scenario(w => {
    w.readout.setPreparedFocus(focus); w.readout.setCamera(w.camera); w.tick(); w.snap('before flight');
    w.move(9e6); w.snap('move pending'); w.readout.setNavigationInFlight(true); w.snap('flight began');
    w.move(1e7); w.tick(200); w.snap('moves during flight'); w.readout.setNavigationInFlight(true); w.snap('flight again');
    w.readout.setNavigationInFlight(false); w.snap('arrived'); w.tick(); w.snap('arrival rendered');
  }),
  'a flight that begins while a throttled render waits on its timer': scenario(w => {
    w.readout.setPreparedFocus(focus); w.readout.setCamera(w.camera); w.tick(); w.move(2e6); w.advance(10); w.snap('timer pending');
    w.readout.setNavigationInFlight(true); w.snap('flight began'); w.advance(200); w.paint(); w.snap('timer never fires');
  }),
  'a hidden page drops pending work and a visible one refreshes': scenario(w => {
    w.readout.setPreparedFocus(focus); w.readout.setCamera(w.camera); w.snap('frame pending'); w.setHidden(true); w.snap('hidden');
    w.tick(); w.move(3e6); w.tick(200); w.snap('hidden moves'); w.setHidden(false); w.snap('visible'); w.tick(); w.snap('visible rendered');
    w.move(4e6); w.advance(20); w.setHidden(true); w.snap('hidden with timer'); w.advance(200); w.paint(); w.snap('timer dropped');
  }),
  'playback keeps rendering, and stopping it does not': scenario(w => {
    w.readout.setPreparedFocus(focus); w.readout.setCamera(w.camera); w.tick();
    w.readout.setPlaybackState({ allowed: true, reason: 'playing' }); w.tick(); w.advance(100); w.paint(); w.snap('playing');
    w.readout.setPlaybackState({ allowed: true, reason: 'playing' }); w.snap('same state');
    w.readout.setPlaybackState({ allowed: false, reason: 'paused' }); w.tick(); w.advance(300); w.paint(); w.snap('paused');
  }),
  'the scene element leaving clears the reading; resize refreshes': scenario(w => {
    w.readout.setPreparedFocus(focus); w.readout.setCamera(w.camera); w.tick(); w.snap('rendered');
    w.removeScene(); w.resize(); w.snap('resized'); w.tick(); w.snap('no scene');
    w.readout.setOverviewScope('local-group'); w.tick(); w.snap('scope set');
  }),
  'destroy with a frame pending, then with a timer pending': scenario(w => {
    w.readout.setPreparedFocus(focus); w.readout.setCamera(w.camera); w.snap('frame pending'); w.readout.destroy(); w.snap('destroyed');
    w.tick(); w.move(5e6); w.resize(); w.setHidden(false); w.tick(200); w.snap('nothing after destroy');
  }),
  'destroy with a timer pending': scenario(w => {
    w.readout.setPreparedFocus(focus); w.readout.setCamera(w.camera); w.tick(); w.move(6e6); w.advance(10); w.snap('timer pending');
    w.readout.destroy(); w.snap('destroyed'); w.advance(300); w.paint(); w.snap('timer dropped');
    w.readout.destroy(); w.snap('destroyed twice');
  }),
  'a flight that begins while a frame is pending, then arrives': scenario(w => {
    w.readout.setPreparedFocus(focus); w.readout.setCamera(w.camera); w.snap('frame pending'); w.readout.setNavigationInFlight(true); w.snap('flight began');
    w.tick(); w.readout.setNavigationInFlight(false); w.snap('arrived'); w.tick(); w.snap('arrival rendered');
  }),
  'setters after destroy and while hidden schedule nothing': scenario(w => {
    w.readout.setPreparedFocus(focus); w.readout.setCamera(w.camera); w.tick(); w.setHidden(true);
    w.readout.setPreparedFocus(null); w.readout.setOverviewScope('milky-way'); w.readout.setPlaybackState({ allowed: true, reason: 'x' }); w.snap('hidden setters');
    w.setHidden(false); w.tick(); w.snap('visible again'); w.readout.destroy();
    w.readout.setPreparedFocus(focus); w.readout.setCamera(w.camera); w.readout.setNavigationInFlight(true); w.readout.setNavigationInFlight(false); w.snap('setters after destroy'); w.tick(200); w.snap('still nothing');
  }),
  'switching cameras unsubscribes the old one': scenario(w => {
    w.readout.setPreparedFocus(focus); w.readout.setCamera(w.camera); w.tick(); w.readout.setCamera(null); w.snap('camera cleared'); w.tick(); w.snap('cleared rendered');
  }),
};
