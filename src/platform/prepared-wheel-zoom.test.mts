import * as applicationPolicy from "../../site/runtime-policy.mts";
// These timing and anchoring cases isolate the bounded wheel response; renderer
// wheel tests separately exercise the application policy with release inertia.
const runtimePolicy = { ...applicationPolicy, WHEEL_ZOOM_INERTIA: null };
import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import type { CameraDelta, CameraUpdate } from '../renderers/css/navigation/types.ts';
function cameraFixture(distance = 1) {
  const state = { zoom: 1, distance, rotX: 0, rotY: 0 };
  return { state, update(value: CameraUpdate) { Object.assign(state, value); } };
}
import { WHEEL_ZOOM_SPEED_MULTIPLIER, WHEEL_ZOOM_DISCRETE_SPEED_MULTIPLIER } from "../../site/runtime-policy.mts";

import {
  createPreparedWheelZoomControls,
  PREPARED_WHEEL_ZOOM,
  zoomOutRayRotation,
} from "../renderers/css/dist/platform/prepared-wheel-zoom.js";

for (const speedMultiplier of [1, WHEEL_ZOOM_SPEED_MULTIPLIER]) test(
`wheel zoom retains its timing, anchoring and cancellation at speed ${speedMultiplier}`, (t) => {
  const original = globalThis.HTMLElement;
  t.after(() => {
    if (original === undefined) Reflect.deleteProperty(globalThis, 'HTMLElement');
    else globalThis.HTMLElement = original;
  });
  const pending = new Map<number, FrameRequestCallback>(); let id = 0;
  class Surface {
    listeners = new Map<string, (event: Pick<WheelEvent, "deltaY" | "timeStamp" | "clientX" | "clientY" | "preventDefault">) => void>();
    ownerDocument = { defaultView: {
      requestAnimationFrame: (callback: FrameRequestCallback) => (pending.set(++id, callback), id),
      cancelAnimationFrame: (key: number) => pending.delete(key),
    } };
    addEventListener(type: string, listener: (event: Pick<WheelEvent, "deltaY" | "timeStamp" | "clientX" | "clientY" | "preventDefault">) => void) { this.listeners.set(type, listener); }
    removeEventListener(type: string) { this.listeners.delete(type); }
  }
  Reflect.set(globalThis, 'HTMLElement', Surface);
  const surface = new Surface();
  const camera = cameraFixture();
  const published: CameraDelta[] = [];
  const controls = createPreparedWheelZoomControls({ runtimePolicy,
    inputSurface:surface as unknown as HTMLElement, camera,
    minimumZoom:.4, maximumZoom:4, speedMultiplier, useScrollDistance: false,
    trackballMetrics:() => ({ centerX:300, centerY:300,
      opticalCenterX:300, opticalCenterY:300, radius:120, viewportWidth:600,
      surfaceRadius:120, focalLength:600 }),
    rotate:value => { assert.ok(value.zoom !== undefined); camera.state.zoom=value.zoom; published.push(value); },
  });
  const emit = (deltaY: number, timeStamp: number, clientX=300) => {
    const listener = surface.listeners.get('wheel'); assert.ok(listener);
    listener({ deltaY, timeStamp, clientX, clientY:300, preventDefault() {} });
  };
  const tick = (timestamp: number) => {
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
  const rotation = published.at(-1)?.rotation; assert.ok(rotation);
  assert.ok(rotation.some((value,index) =>
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

test("wheel steps use a gentler gain without clipping precision gestures", async t => {
  const { Surface } = await import("./test/orbit-fixture.mts");
  const prior = globalThis.HTMLElement; Reflect.set(globalThis, 'HTMLElement', Surface);
  t.after(() => { globalThis.HTMLElement = prior; });
  function fixture() {
    const surface = new Surface(), camera = cameraFixture();
    const controls = createPreparedWheelZoomControls({ runtimePolicy, inputSurface: surface.asElement(), camera,
      minimumZoom: .4, maximumZoom: 4,
      trackballMetrics: () => ({ centerX: 0, centerY: 0, radius: 120, viewportWidth: 600, surfaceRadius: 120, focalLength: 600 }),
      rotate(value) { assert.ok(value.zoom !== undefined); camera.state.zoom = value.zoom; },
    });
    return { surface, camera, controls };
  }
  function replay(events: (Partial<WheelEvent> & { timeStamp: number })[]) {
    const f = fixture();
    try {
      for (const event of events) {
        f.surface.tick(event.timeStamp);
        f.surface.dispatch("wheel", event);
      }
      const last = events.at(-1); assert.ok(last);
      f.surface.tick(last.timeStamp + PREPARED_WHEEL_ZOOM.intervalMilliseconds);
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
  assert.ok(Math.abs(notch - Math.exp(.216 * WHEEL_ZOOM_DISCRETE_SPEED_MULTIPLIER)) < 1e-12);
  assert.ok(notch > 1.2 && notch < 1.25, "a coarse notch must be a modest zoom step");
  for (const zoom of [stream, slowStream]) {
    assert.ok(Math.abs(zoom - Math.exp(.216 * WHEEL_ZOOM_SPEED_MULTIPLIER)) < 1e-12,
      "small trackpad events retain the exact previous response regardless of cadence");
  }
  for (const zoom of [lineUnits, pageUnits]) assert.ok(Math.abs(zoom - notch) < 1e-12);
  for (const pixels of [1, 5, 10, 20, 25]) {
    assert.ok(Math.abs(replay([{ deltaY: -pixels, timeStamp: 0 }]) -
      Math.exp(.216 * WHEEL_ZOOM_SPEED_MULTIPLIER * pixels / 100)) < 1e-12);
  }
  assert.ok(Math.abs(replay([{ deltaY: -2, timeStamp: 0 }, { deltaY: -98, timeStamp: 8 }]) - stream) < 1e-12,
    "a large accelerated trackpad packet retains the full precision gain, not a per-event cap");
  assert.ok(Math.abs(replay([{ deltaY: -100, ctrlKey: true, timeStamp: 0 }]) - stream) < 1e-12,
    "pinch-wheel input keeps the precision gain");
  assert.ok(Math.abs(replay([{ deltaY: -100, timeStamp: 0 }, { deltaY: -100, timeStamp: 8 }]) - notch ** 2) < 1e-12,
    "rapid mouse notches do not switch to trackpad gain");
  assert.ok(Math.abs(replay([{ deltaY: -2, timeStamp: 0 }, { deltaY: -100, timeStamp: 500 }]) -
    Math.exp(.216 * (WHEEL_ZOOM_SPEED_MULTIPLIER * .02 + WHEEL_ZOOM_DISCRETE_SPEED_MULTIPLIER))) < 1e-12,
    "a new mouse gesture does not inherit the preceding trackpad classification");
  assert.ok(Math.abs(replay([{ deltaY: -100, timeStamp: 0 }, { deltaY: -2, timeStamp: 8 }]) -
    Math.exp(.216 * (WHEEL_ZOOM_DISCRETE_SPEED_MULTIPLIER + WHEEL_ZOOM_SPEED_MULTIPLIER * .02))) < 1e-12,
    "switching to a precision device takes effect immediately");
  assert.equal(replay(Array.from({ length: 10 }, (_, i) => ({ deltaY: -100, timeStamp: i * 20 }))), 4);
  assert.equal(replay(Array.from({ length: 10 }, (_, i) => ({ deltaY: 100, timeStamp: i * 20 }))), .4);
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
  const q = zoomOutRayRotation({centerX:0,centerY:0,focalLength,radius,viewportWidth:600,surfaceRadius:radius},
    {x:14.5,y:-8.7},nextRadius/radius);
  const degrees = 2*Math.atan2(Math.hypot(...q.slice(0,3)),q[3])*180/Math.PI;
  assert.ok(Math.abs(degrees-.286323837) < .01);
  assert.ok(q[0] > 0 && q[1] > 0);
});

test("a wheel publication failure removes its listener and pending camera frame", async t => {
  const {Surface}=await import('./test/orbit-fixture.mts');
  const prior=globalThis.HTMLElement;Reflect.set(globalThis, 'HTMLElement', Surface);
  t.after(()=>{globalThis.HTMLElement=prior});
  const inputSurface=new Surface(), errors: unknown[]=[];
  const controls=createPreparedWheelZoomControls({ runtimePolicy,inputSurface:inputSurface.asElement(),camera:cameraFixture(),
    minimumZoom:.5,maximumZoom:4,
    trackballMetrics:()=>({centerX:0,centerY:0,radius:100,viewportWidth:600,surfaceRadius:100,focalLength:600}),
    rotate(){throw Error('failed publication')},onError:error=>errors.push(error)});
  inputSurface.dispatch('wheel',{deltaY:-40,timeStamp:0});
  inputSurface.tick(16);
  assert.equal(errors.length,1);assert.ok(errors[0] instanceof Error); assert.match(errors[0].message,/failed publication/);
  assert.equal(inputSurface.frames.size,0);assert.equal(inputSurface.listenerCount(),0);
  controls.update({wheel:true});inputSurface.dispatch('wheel',{deltaY:-40,timeStamp:32});
  inputSurface.tick(48);assert.equal(errors.length,1);controls.destroy();
});

test("a perspective dolly scales the distance by the wheel magnitude and never turns the scene", async t => {
  const { Surface } = await import("./test/orbit-fixture.mts");
  const prior = globalThis.HTMLElement; Reflect.set(globalThis, 'HTMLElement', Surface);
  t.after(() => { globalThis.HTMLElement = prior; });
  const surface = new Surface();
  const camera = cameraFixture(1000);
  const published: CameraDelta[] = [];
  const controls = createPreparedWheelZoomControls({ runtimePolicy,
    inputSurface: surface.asElement(), camera, minimumZoom: 0.001, maximumZoom: 4,
    dolly: { stepPerDelta: 0.006 },
    trackballMetrics: () => ({ centerX: 300, centerY: 300, opticalCenterX: 300,
      opticalCenterY: 300, radius: 120, viewportWidth: 600, surfaceRadius: 120, focalLength: 600 }),
    // The camera clamps the distance like the perspective dolly does.
    rotate: value => {
      if (value.distance !== undefined) camera.state.distance = Math.min(100000, Math.max(500, value.distance));
      camera.state.zoom = 1000 / camera.state.distance;
      published.push(value);
    },
  });
  const near = (actual: number, expected: number) => Math.abs(actual - expected) < 1e-9 * expected;
  // One notch, off the trackball centre: consumed evenly over the interval.
  surface.dispatch("wheel", { deltaY: 100, timeStamp: 0, clientX: 370, clientY: 300 });
  surface.tick(50);
  assert.ok(near(camera.state.distance, 1000 * Math.exp(0.15)), "a quarter of the interval dollies a quarter of the notch");
  surface.tick(120); surface.tick(200);
  assert.ok(near(camera.state.distance, 1000 * Math.exp(0.6)), "a 100-delta notch dollies exp(100 * step)");
  assert.equal(surface.frames.size, 0, "the interval ends the motion");
  assert.equal(controls.stats().active, false);
  // A second event inside the interval adds its own share and extends it.
  surface.dispatch("wheel", { deltaY: 100, timeStamp: 300, clientX: 370, clientY: 300 });
  surface.tick(400);
  surface.dispatch("wheel", { deltaY: 100, timeStamp: 400, clientX: 200, clientY: 250 });
  surface.tick(500); surface.tick(600);
  assert.ok(near(camera.state.distance, 1000 * Math.exp(1.8)), "notches add up");
  assert.equal(surface.frames.size, 0);
  // Trackpad-sized deltas sum like the notch they add up to.
  for (let i = 0; i < 4; i += 1) surface.dispatch("wheel", { deltaY: -75, timeStamp: 1000 + i * 16, clientX: 370, clientY: 300 });
  surface.tick(1100); surface.tick(1200); surface.tick(1248); surface.tick(1300);
  assert.ok(near(camera.state.distance, 1000), "four 75-delta events undo three notches exactly");
  assert.equal(surface.frames.size, 0);
  assert.ok(published.length > 6 && published.every(value =>
    value.rotation === undefined && value.zoom === undefined && value.distance !== undefined &&
    value.controlPitchDelta === 0 && value.controlYawDelta === 0),
  "a dolly publishes distances only: no zoom alias and no anchor rotation");
  // What the camera's bound refuses is dropped, not carried.
  surface.dispatch("wheel", { deltaY: 1000, timeStamp: 2000 });
  surface.tick(2100);
  assert.ok(near(camera.state.distance, 1000 * Math.exp(3)), "half the interval dollies half the event");
  surface.tick(2200);
  assert.equal(camera.state.distance, 100000, "the camera clamps the dolly");
  assert.equal(surface.frames.size, 0, "a clamped dolly ends the motion");
  // Taking control cancels what is pending.
  surface.dispatch("wheel", { deltaY: -100, timeStamp: 3000 });
  controls.stop();
  surface.tick(3100);
  assert.equal(camera.state.distance, 100000, "stop drops the pending dolly");
  assert.equal(controls.stats().active, false);
  surface.dispatch("wheel", { deltaY: -100, timeStamp: 4000 });
  surface.tick(4200);
  assert.ok(near(camera.state.distance, 100000 * Math.exp(-0.6)), "the next gesture dollies again");
  assert.throws(() => Reflect.apply(createPreparedWheelZoomControls, undefined, [{ runtimePolicy,
    inputSurface: surface.asElement(), camera, minimumZoom: 0.001, maximumZoom: 4,
    dolly: { stepPerDelta: 0 }, trackballMetrics: () => ({}), rotate() {},
  }]), /invalid/u);
  controls.destroy();
  assert.equal(surface.listenerCount(), 0);
});
