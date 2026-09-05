import assert from "node:assert/strict";
import test from "node:test";
import { WHEEL_ZOOM_SPEED_MULTIPLIER } from "../../site/runtime-policy.mjs";

import {
  createPreparedWheelZoomControls,
  PREPARED_WHEEL_ZOOM,
  zoomOutRayRotation,
} from "./prepared-wheel-zoom.mjs";

for (const speedMultiplier of [1, WHEEL_ZOOM_SPEED_MULTIPLIER]) test(
`wheel zoom retains its timing, anchoring and cancellation at speed ${speedMultiplier}`, (t) => {
  const original = globalThis.HTMLElement;
  t.after(() => {
    if (original === undefined) delete globalThis.HTMLElement;
    else globalThis.HTMLElement = original;
  });
  const pending = new Map(); let id = 0;
  class Surface {
    listeners = new Map();
    ownerDocument = { defaultView: {
      requestAnimationFrame: callback => (pending.set(++id, callback), id),
      cancelAnimationFrame: key => pending.delete(key),
    } };
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    removeEventListener(type) { this.listeners.delete(type); }
  }
  globalThis.HTMLElement = Surface;
  const surface = new Surface();
  const camera = { state:{ zoom:1 } };
  const published = [];
  const controls = createPreparedWheelZoomControls({
    inputSurface:surface, camera,
    minimumZoom:.4, maximumZoom:4, speedMultiplier, useScrollDistance: false,
    trackballMetrics:() => ({ centerX:300, centerY:300,
      opticalCenterX:300, opticalCenterY:300, radius:120,
      surfaceRadius:120, focalLength:600 }),
    rotate:value => { camera.state.zoom=value.zoom; published.push(value); },
  });
  const emit = (deltaY, timeStamp, clientX=300) =>
    surface.listeners.get("wheel")({ deltaY, timeStamp, clientX,
      clientY:300, preventDefault() {} });
  const tick = timestamp => {
    const callbacks=[...pending.values()]; pending.clear();
    callbacks.forEach(callback=>callback(timestamp));
  };
  emit(-1, 0); tick(100); tick(200);
  assert.ok(Math.abs(camera.state.zoom - Math.exp(
    PREPARED_WHEEL_ZOOM.screenLogScalePerMillisecond * speedMultiplier * 200)) < 1e-12);
  const first = camera.state.zoom;
  emit(999, 300); tick(400); tick(500);
  assert.ok(Math.abs(camera.state.zoom - 1) < 1e-12,
    "equal intervals in opposite directions cancel regardless of magnitude");
  emit(-1, 600, 370); tick(700);
  assert.ok(published.at(-1).rotation.some((value,index) =>
    Math.abs(value - [0,0,0,1][index]) > 1e-9));
  const stoppedZoom = camera.state.zoom;
  controls.stop();
  tick(750);
  assert.equal(camera.state.zoom, stoppedZoom,
    "taking control cancels every pending wheel publication");
  assert.equal(controls.stats().active, false);
  emit(-1, 800); tick(900);
  assert.ok(camera.state.zoom > stoppedZoom,
    "stopping a gesture must keep the next wheel gesture available");
  controls.destroy();
  assert.equal(surface.listeners.size, 0);
  assert.equal(pending.size, 0);
});

test("scroll distance stays precise across wheel notches, trackpad streams and browser units", async t => {
  const { Surface } = await import("./test/orbit-fixture.mjs");
  const prior = globalThis.HTMLElement; globalThis.HTMLElement = Surface;
  t.after(() => { globalThis.HTMLElement = prior; });
  function fixture() {
    const surface = new Surface(), camera = { state: { zoom: 1 } };
    const controls = createPreparedWheelZoomControls({ inputSurface: surface, camera,
      minimumZoom: .4, maximumZoom: 4,
      trackballMetrics: () => ({ centerX: 0, centerY: 0, surfaceRadius: 120, focalLength: 600 }),
      rotate(value) { camera.state.zoom = value.zoom; },
    });
    return { surface, camera, controls };
  }
  function replay(events) {
    const f = fixture();
    try {
      for (const event of events) {
        f.surface.tick(event.timeStamp);
        f.surface.dispatch("wheel", event);
      }
      f.surface.tick(events.at(-1).timeStamp + PREPARED_WHEEL_ZOOM.intervalMilliseconds);
      assert.equal(f.controls.stats().active, false);
      assert.equal(f.surface.frames.size, 0);
      return f.camera.state.zoom;
    } finally { f.controls.destroy(); }
  }
  const notch = replay([{ deltaY: -100, timeStamp: 0 }]);
  const stream = replay(Array.from({ length: 50 }, (_, i) => ({ deltaY: -2, timeStamp: i * 8 })));
  const slowStream = replay(Array.from({ length: 50 }, (_, i) => ({ deltaY: -2, timeStamp: i * 240 })));
  const lineUnits = replay([{ deltaY: -6.25, deltaMode: 1, timeStamp: 0 }]);
  const pageUnits = replay([{ deltaY: -.125, deltaMode: 2, timeStamp: 0 }]);
  const tiny = replay([{ deltaY: -1, timeStamp: 0 }]);
  assert.ok(tiny > 1 && tiny < 1.01, "a one-pixel movement must not behave like a full notch");
  assert.ok(Math.abs(notch - Math.exp(.216 * WHEEL_ZOOM_SPEED_MULTIPLIER)) < 1e-12);
  for (const zoom of [stream, slowStream, lineUnits, pageUnits]) {
    assert.ok(Math.abs(zoom - notch) < 1e-12, "equal scroll travel must produce equal zoom, independent of event cadence");
  }
  assert.equal(replay([{ deltaY: -1000000, timeStamp: 0 }]), 4);
  assert.equal(replay([{ deltaY: 1000000, timeStamp: 0 }]), .4);
  const f = fixture();
  try {
    f.surface.dispatch("wheel", { deltaY: -100, timeStamp: 0 }); f.surface.tick(80);
    const before = f.camera.state.zoom;
    f.surface.dispatch("wheel", { deltaY: 1, timeStamp: 80 }); f.surface.tick(100);
    assert.ok(f.camera.state.zoom < before, "reversal must drop the unfinished opposite-direction target");
    f.controls.stop();
    const stopped = f.camera.state.zoom; f.surface.tick(300);
    assert.equal(f.camera.state.zoom, stopped);
    assert.equal(f.surface.frames.size, 0);
  } finally { f.controls.destroy(); }
});

test("zoom-out follows the native viewing-ray scale instead of a surface grab", () => {
  // Native isolated wheel segment: 14.5 x -8.7 px from center, 600.1556 px
  // focal length and camera distance ratio 1.210796. Rotation is 0.2863 deg.
  const focalLength = 600.1556396484375, distance = 4.25855016708374;
  const radius = focalLength / Math.sqrt(distance*distance-1);
  const nextRadius = focalLength / Math.sqrt((distance*1.2107961558319291)**2-1);
  const q = zoomOutRayRotation({centerX:0,centerY:0,focalLength,surfaceRadius:radius},
    {x:14.5,y:-8.7},nextRadius/radius);
  const degrees = 2*Math.atan2(Math.hypot(...q.slice(0,3)),q[3])*180/Math.PI;
  assert.ok(Math.abs(degrees-.286323837) < .01);
  assert.ok(q[0] > 0 && q[1] > 0);
});

test("a wheel publication failure removes its listener and pending camera frame", async t => {
  const {Surface}=await import('./test/orbit-fixture.mjs');
  const prior=globalThis.HTMLElement;globalThis.HTMLElement=Surface;
  t.after(()=>{globalThis.HTMLElement=prior});
  const inputSurface=new Surface(), errors=[];
  const controls=createPreparedWheelZoomControls({inputSurface,camera:{state:{zoom:1}},
    minimumZoom:.5,maximumZoom:4,
    trackballMetrics:()=>({centerX:0,centerY:0,surfaceRadius:100,focalLength:600}),
    rotate(){throw Error('failed publication')},onError:error=>errors.push(error)});
  inputSurface.dispatch('wheel',{deltaY:-40,timeStamp:0});
  inputSurface.tick(16);
  assert.equal(errors.length,1);assert.match(errors[0].message,/failed publication/);
  assert.equal(inputSurface.frames.size,0);assert.equal(inputSurface.listenerCount(),0);
  controls.update({wheel:true});inputSurface.dispatch('wheel',{deltaY:-40,timeStamp:32});
  inputSurface.tick(48);assert.equal(errors.length,1);controls.destroy();
});
