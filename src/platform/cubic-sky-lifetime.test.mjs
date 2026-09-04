import assert from "node:assert/strict";
import test from "node:test";
import { Surface, orbitFixture } from "./test/orbit-fixture.mjs";
import { createUnboundedMatrixDragControls } from "./cubic-sky-runtime.mjs";


test("drag constructor removes partially attached listeners if initial style publication fails", () => {
  const previous = globalThis.HTMLElement;
  globalThis.HTMLElement = Surface;
  try {
    const surface = new Surface();
    Object.defineProperty(surface.style, "cursor", {
      configurable: true,
      set() { throw new Error("style failure"); },
    });
    assert.throws(() => createUnboundedMatrixDragControls({
      inputSurface: surface,
      trackballMetrics: () => ({ centerX: 0, centerY: 0, radius: 200 }),
      rotate() {},
    }), /style failure/);
    assert.equal(surface.listenerCount(), 0);
    assert.equal(surface.frames.size, 0);
  } finally { globalThis.HTMLElement = previous; }
});

test("drag destruction releases listeners and capture even if interaction completion throws", () => {
  const previous = globalThis.HTMLElement;
  globalThis.HTMLElement = Surface;
  try {
    const surface = new Surface();
    let updates = 0;
    const controls = createUnboundedMatrixDragControls({
      inputSurface: surface,
      trackballMetrics: () => ({ centerX: 0, centerY: 0, radius: 200 }),
      rotate() { updates += 1; },
      onEnd() { throw new Error("completion failure"); },
    });
    surface.dispatch("pointerdown");
    surface.dispatch("pointermove", { clientX: 50, timeStamp: 16 });
    assert.ok(updates > 0);
    assert.throws(() => controls.destroy(), /cleanup failed/);
    assert.equal(surface.listenerCount(), 0);
    assert.equal(surface.frames.size, 0);
    assert.equal(surface.captured.size, 0);
    controls.destroy();
    controls.update({ drag: true });
    assert.equal(surface.style.cursor, undefined);
  } finally { globalThis.HTMLElement = previous; }
});


test("live cubic publication failure retires every owner once before reporting fatal", () => {
  const fixture = orbitFixture(null);
  let fail = false;
  const errors = [];
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
  assert.match(errors[0].message, /live publication/);
  assert.equal(orbit.stats().publications, 1);
  assert.equal(fixture.stage.listenerCount(), 0);
});

test("native drag publication failure releases capture/listeners and reports instead of escaping", () => {
  const previous = globalThis.HTMLElement;
  globalThis.HTMLElement = Surface;
  try {
    const surface = new Surface(), errors = [];
    const controls = createUnboundedMatrixDragControls({ inputSurface: surface,
      trackballMetrics: () => ({ centerX: 0, centerY: 0, radius: 200 }),
      rotate() { throw new Error("drag publication"); }, onError: (error) => errors.push(error) });
    surface.dispatch("pointerdown");
    surface.dispatch("pointermove", { clientX: 50, timeStamp: 16 });
    assert.equal(errors.length, 1);
    assert.equal(surface.listenerCount(), 0);
    assert.equal(surface.frames.size, 0);
    assert.equal(surface.captured.size, 0);
    controls.destroy();
  } finally { globalThis.HTMLElement = previous; }
});

for (const failure of ["wheel", "policy", "fit", "publish"]) {
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
