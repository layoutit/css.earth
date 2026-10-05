// A clock stepped by hand, installed before CesiumJS loads when the page is opened with ?virtual: animation frames and
// the time advance only on step(), so thousands of frames run without waiting for the display and both controllers read
// the same time. Cesium times its inertia with Date, cssEarth with event and frame timestamps; all three come from here.
const RealDate = Date, base = RealDate.now();
let now = 0, queue: [number, FrameRequestCallback][] = [], next = 0;
window.requestAnimationFrame = callback => { queue.push([++next, callback]); return next; };
window.cancelAnimationFrame = id => { queue = queue.filter(([queued]) => queued !== id); };
performance.now = () => now;
class VirtualDate extends RealDate {
  constructor(...value: [] | [string | number | Date]) { if (value.length) super(value[0]); else super(base + now); }
  static override now() { return base + now; }
}
Reflect.set(window, 'Date', VirtualDate);
Reflect.set(window, 'dragOracleClock', { step(milliseconds: number) { now += milliseconds; const run = queue; queue = []; for (const [, callback] of run) callback(now); } });
