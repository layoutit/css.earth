import * as applicationPolicy from "../../site/runtime-policy.mts";
// These timing cases isolate the bounded wheel response; renderer
// wheel tests separately exercise the application policy with release inertia.
const runtimePolicy = { ...applicationPolicy, WHEEL_ZOOM_INERTIA: null };
import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import type { CameraDelta, CameraUpdate } from '@cssearth/renderer/navigation/types.ts';
function cameraFixture(distance = 1) {
  const state = { zoom: 1, distance, rotX: 0, rotY: 0 };
  return { state, update(value: CameraUpdate) { Object.assign(state, value); } };
}

import {
  createPreparedWheelZoomControls,
} from "@cssearth/renderer/platform/prepared-wheel-zoom";

test("a wheel publication failure removes its listener and pending camera frame", async t => {
  const {Surface}=await import('./test/orbit-fixture.mts');
  const prior=globalThis.HTMLElement;Reflect.set(globalThis, 'HTMLElement', Surface);
  t.after(()=>{globalThis.HTMLElement=prior});
  const inputSurface=new Surface(), errors: unknown[]=[];
  const controls=createPreparedWheelZoomControls({ runtimePolicy,inputSurface:inputSurface.asElement(),camera:cameraFixture(),
    dolly: { stepPerDelta: .006 },
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
    inputSurface: surface.asElement(), camera,
    dolly: { stepPerDelta: 0.006 },
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
    inputSurface: surface.asElement(), camera,
    dolly: { stepPerDelta: 0 }, rotate() {},
  }]), /invalid/u);
  controls.destroy();
  assert.equal(surface.listenerCount(), 0);
});
