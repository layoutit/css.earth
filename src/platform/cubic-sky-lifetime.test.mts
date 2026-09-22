import * as runtimePolicy from "../../site/runtime-policy.mts";
import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { Surface, orbitFixture } from "./test/orbit-fixture.mts";
import { createUnboundedMatrixDragControls } from "../renderers/css/dist/platform/camera-input.js";
import { errorMessage, type TrackballMetrics } from "../renderers/css/navigation/types.ts";

const trackball = (): TrackballMetrics => ({ centerX: 0, centerY: 0, radius: 200, surfaceRadius: 200, focalLength: 600, viewportWidth: 400 });
// This test fixture only implements the native input surface methods consumed by the controls.
const nativeSurface = (surface: Surface): HTMLElement => surface.asElement();
const nativeConstructor = Surface as unknown as typeof HTMLElement;


test("drag constructor removes partially attached listeners if initial style publication fails", () => {
  const previous = globalThis.HTMLElement;
  globalThis.HTMLElement = nativeConstructor;
  try {
    const surface = new Surface();
    Object.defineProperty(surface.style, "cursor", {
      configurable: true,
      set() { throw new Error("style failure"); },
    });
    assert.throws(() => createUnboundedMatrixDragControls({ runtimePolicy,
      inputSurface: nativeSurface(surface),
      trackballMetrics: trackball,
      rotate() {},
    }), /style failure/);
    assert.equal(surface.listenerCount(), 0);
    assert.equal(surface.frames.size, 0);
  } finally { globalThis.HTMLElement = previous; }
});

test("drag destruction releases listeners and capture even if interaction completion throws", () => {
  const previous = globalThis.HTMLElement;
  globalThis.HTMLElement = nativeConstructor;
  try {
    const surface = new Surface();
    let updates = 0;
    const controls = createUnboundedMatrixDragControls({ runtimePolicy,
      inputSurface: nativeSurface(surface),
      trackballMetrics: trackball,
      rotate() { updates += 1; },
      onEnd() { throw new Error("completion failure"); },
    });
    surface.dispatch("pointerdown");
    surface.dispatch("pointermove", { clientX: 50, timeStamp: 16 });
    surface.tick(16);
    assert.ok(updates > 0);
    assert.throws(() => controls.destroy(), /cleanup failed/);
    assert.equal(surface.listenerCount(), 0);
    assert.equal(surface.frames.size, 0);
    assert.equal(surface.captured.size, 0);
    controls.destroy();
    controls.update({ drag: true });
    // The fixture exposes only style mutation methods; this reads its tested cursor field.
    assert.equal(surface.style.cursor, undefined);
  } finally { globalThis.HTMLElement = previous; }
});


test("live cubic publication failure retires every owner once before reporting fatal", () => {
  const fixture = orbitFixture(null);
  let fail = false;
  const errors: unknown[] = [];
  fixture.arguments.onPublish = () => { if (fail) throw new Error("live publication"); };
  fixture.arguments.onError = (error) => {
    assert.equal(fixture.owners.size, 0);
    errors.push(error);
  };
  const orbit = fixture.create(fixture.arguments);
  fail = true;
  assert.throws(() => orbit.refresh(), /live publication/);
  orbit.refresh();
  orbit.setState({ zoom: 3 });
  assert.equal(errors.length, 1);
  assert.match(errorMessage(errors[0]), /live publication/);
  assert.equal(orbit.stats().publications, 1);
  assert.equal(fixture.stage.listenerCount(), 0);
});

test("native drag publication failure releases capture/listeners and reports instead of escaping", () => {
  const previous = globalThis.HTMLElement;
  globalThis.HTMLElement = nativeConstructor;
  try {
  const surface = new Surface(), errors: unknown[] = [];
  const controls = createUnboundedMatrixDragControls({ runtimePolicy, inputSurface: nativeSurface(surface),
      trackballMetrics: trackball,
      rotate() { throw new Error("drag publication"); }, onError: (error) => errors.push(error) });
    surface.dispatch("pointerdown");
    surface.dispatch("pointermove", { clientX: 50, timeStamp: 16 });
    surface.tick(16);
    assert.equal(errors.length, 1);
    assert.equal(surface.listenerCount(), 0);
    assert.equal(surface.frames.size, 0);
    assert.equal(surface.captured.size, 0);
    controls.destroy();
  } finally { globalThis.HTMLElement = previous; }
});

for (const failure of ["wheel", "policy", "fit", "publish"] as const) {
  test(`cubic orbit constructor releases earlier owners when ${failure} fails`, () => {
    const fixture = orbitFixture(failure);
    assert.throws(() => fixture.create(fixture.arguments), new RegExp(`${failure} failure`));
    assert.deepEqual([...fixture.owners], []);
    assert.equal(fixture.stage.listenerCount(), 0);
  });
}

test("cubic orbit completes independent cleanup and preserves construction error when cleanup also fails", () => {
  const fixture = orbitFixture("publish", true);
  assert.throws(() => fixture.create(fixture.arguments), (error) => {
    assert.ok(error instanceof AggregateError); assert.ok(error.cause instanceof Error);
    assert.equal(error.cause.message, "publish failure");
    assert.equal(error.errors[0], error.cause);
    return true;
  });
  assert.deepEqual([...fixture.owners], []);
  assert.equal(fixture.stage.listenerCount(), 0);
});

test("cubic orbit destruction is idempotent and disables later camera publication", () => {
  const fixture = orbitFixture(null, true);
  const orbit = fixture.create(fixture.arguments);
  const publications = orbit.stats().publications;
  assert.throws(() => orbit.destroy(), /cleanup failed/);
  assert.deepEqual([...fixture.owners], []);
  assert.equal(fixture.stage.listenerCount(), 0);
  orbit.destroy();
  orbit.refresh();
  orbit.setState({ zoom: 9 });
  assert.equal(orbit.stats().publications, publications);
  assert.equal(orbit.state().zoom, 1);
});

test("disposing during a release publication cannot restart the coast", t => {
  const previous = globalThis.HTMLElement;
  globalThis.HTMLElement = nativeConstructor;
  t.after(() => { globalThis.HTMLElement = previous; });
  const surface = new Surface();
  let disposeOnPublish = false;
  const controls = createUnboundedMatrixDragControls({ runtimePolicy,
    inputSurface: nativeSurface(surface),
    trackballMetrics: trackball,
    rotate() { if (disposeOnPublish) controls.destroy(); },
  });
  surface.dispatch("pointerdown");
  for (let step=1; step<=4; step++) {
    surface.dispatch("pointermove", { clientX:[10,25,45,80][step-1], timeStamp:step*16 });
    surface.tick(step*16);
  }
  disposeOnPublish = true;
  surface.dispatch("pointerup", { clientX:80, timeStamp:72 });
  assert.equal(surface.listenerCount(), 0);
  assert.equal(surface.frames.size, 0);
  assert.equal(surface.captured.size, 0);
  assert.equal(controls.stats().active, false);
});

for (const action of ["complete", "wheel", "destroy", "failure"]) {
  test(`destination flight settles and releases its frame on ${action}`, async () => {
    const previous = globalThis.HTMLElement;
    globalThis.HTMLElement = nativeConstructor;
    const surface = new Surface(), samples = [], errors = [];
    const controls = createUnboundedMatrixDragControls({ runtimePolicy, inputSurface: nativeSurface(surface),
      trackballMetrics: trackball,
      rotate() {}, onError: error => errors.push(error) });
    try {
      const completion = controls.flyTo({ durationMilliseconds: 100, sample(progress) {
        samples.push(progress);
        if (action === "failure") throw new Error("destination publication");
      } });
      surface.tick(0);
      if (action === "complete") surface.tick(100);
      if (action === "wheel") {
        surface.dispatch("wheel", { deltaY: 100 });
        assert.equal(controls.stats().destinationFlyTo.active, true, "wheel accelerates the active destination flight");
        surface.tick(100 / runtimePolicy.FLIGHT_WHEEL_SPEEDUP);
      }
      if (action === "destroy") controls.destroy();
      assert.deepEqual(await completion, { completed: action === "complete" || action === "wheel" });
      const count = samples.length;
      surface.tick(200);
      assert.equal(samples.length, count);
      assert.equal(surface.frames.size, 0);
      assert.equal(controls.stats().destinationFlyTo.active, false);
      assert.equal(errors.length, action === "failure" ? 1 : 0);
      controls.destroy();
      assert.deepEqual(await controls.flyTo({ sample() {} }), { completed: false });
      assert.equal(surface.listenerCount(), 0);
    } finally { controls.destroy(); globalThis.HTMLElement = previous; }
  });
}

test("a fresh accelerating drag after interrupting flight owns its own release", t => {
  const previous = globalThis.HTMLElement;
  globalThis.HTMLElement = nativeConstructor;
  t.after(() => { globalThis.HTMLElement = previous; });
  const surface = new Surface();
  const controls = createUnboundedMatrixDragControls({ runtimePolicy, inputSurface:nativeSurface(surface),
    trackballMetrics:() => ({ centerX:0, centerY:0, radius:200,
      surfaceRadius:200, focalLength:600, viewportWidth:400,
      sceneMatrix:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1] }),
    surfaceFlyToState:() => ({ zoom:1, minimumZoom:0.5, maximumZoom:4 }),
    rotate() {},
  });
  t.after(() => controls.destroy());
  surface.dispatch("mousedown", { detail:2, clientX:30, clientY:20 });
  surface.tick(0); surface.tick(100);
  assert.equal(controls.stats().activeMode, "fly-to");
  surface.dispatch("pointerdown", { timeStamp:110 });
  surface.tick(110);
  for (const [index, clientX] of [10, 25, 45, 80].entries()) {
    const timeStamp = 130 + index * 20;
    surface.dispatch("pointermove", { clientX, timeStamp }); surface.tick(timeStamp);
  }
  surface.dispatch("pointerup", { clientX:80, timeStamp:195 });
  assert.equal(controls.stats().surfaceFlyTo.cancels, 1);
  assert.equal(controls.stats().activeMode, "inertia");
  assert.equal(controls.stats().starts, 1);
  assert.equal(surface.frames.size, 1);
});
