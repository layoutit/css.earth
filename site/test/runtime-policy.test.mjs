import assert from "node:assert/strict";
import test from "node:test";

import {
  bindResponsiveOrbitPolicy,
  automaticPlaybackPolicy,
  CANONICAL_PREPARED_IMAGE_DENSITY,
  DESKTOP_VIEWPORT_MIN,
  MOBILE_VIEWPORT_MAX,
  MOBILE_VIEWPORT_QUERY,
  SKYBOX_DRAG_ENABLED,
  WHEEL_ZOOM_SPEED_MULTIPLIER,
  WHEEL_ZOOM_USE_SCROLL_DISTANCE,
  WHEEL_ZOOM_DISCRETE_SPEED_MULTIPLIER,
  wheelZoomInputKind,
} from "../runtime-policy.mjs";

test("automatic playback has one complete readiness, intent and environment policy", () => {
  for (const sceneState of ["loading", "ready", "error", "destroyed"]) {
    for (const motionRequested of [false, true]) {
      for (const documentHidden of [false, true]) {
        for (const reducedMotion of [false, true]) {
          const reason = sceneState !== "ready" ? "unavailable"
            : !motionRequested ? "motion-off" : documentHidden ? "hidden"
              : reducedMotion ? "reduced-motion" : "allowed";
          assert.deepEqual(automaticPlaybackPolicy({
            sceneState, motionRequested, documentHidden, reducedMotion,
          }), { allowed: reason === "allowed", reason });
        }
      }
    }
  }
});

test("keeps one shared orientation-aware responsive shell boundary", () => {
  assert.equal(MOBILE_VIEWPORT_MAX, 820);
  assert.equal(DESKTOP_VIEWPORT_MIN, 821);
  assert.equal(
    MOBILE_VIEWPORT_QUERY,
    "(max-width: 820px), (orientation: portrait)",
  );
});

test("uses one canonical high-density image bank for every mount", () => {
  assert.equal(CANONICAL_PREPARED_IMAGE_DENSITY, 2);
});

test("skybox orbit dragging is enabled by the shared input policy", () => {
  assert.equal(SKYBOX_DRAG_ENABLED, true);
});

test("discrete wheels and precision scroll gestures have separate shared gains", () => {
  assert.equal(WHEEL_ZOOM_SPEED_MULTIPLIER, 4);
  assert.equal(WHEEL_ZOOM_USE_SCROLL_DISTANCE, true);
  assert.equal(WHEEL_ZOOM_DISCRETE_SPEED_MULTIPLIER, 1);
});

test("scroll input classification preserves accelerated precision gestures and permits device changes", () => {
  for (const deltaMode of [1, 2]) assert.equal(wheelZoomInputKind({ deltaY: 1, deltaMode }), "wheel");
  for (const deltaY of [40, 50, 100, 120, 4.000244140625, 8.00048828125]) {
    assert.equal(wheelZoomInputKind({ deltaY, timeStamp: 0 }), "wheel");
  }
  for (const deltaY of [1, 5, 10, 25, 38, 41.5]) {
    assert.equal(wheelZoomInputKind({ deltaY, timeStamp: 0 }), "trackpad");
  }
  assert.equal(wheelZoomInputKind({ deltaY: 100, timeStamp: 8 }, "trackpad", 0), "trackpad");
  assert.equal(wheelZoomInputKind({ deltaY: 100, timeStamp: 408 }, "trackpad", 0), "wheel");
  assert.equal(wheelZoomInputKind({ deltaY: 2, timeStamp: 8 }, "wheel", 0), "trackpad");
  assert.equal(wheelZoomInputKind({ deltaY: 3, deltaMode: 1, timeStamp: 8 }, "trackpad", 0), "wheel");
  assert.equal(wheelZoomInputKind({ deltaY: 100, deltaX: 1 }), "trackpad");
  assert.equal(wheelZoomInputKind({ deltaY: 100, ctrlKey: true }), "trackpad");
});

test("updates wheel and touch policy without replacing controls", () => {
  const mediaQuery = new FakeMediaQuery(false);
  const updates = [];
  const removed = [];
  const inputSurface = {
    style: {
      touchAction: "",
      removeProperty(name) {
        removed.push(name);
        if (name === "touch-action") this.touchAction = "";
      },
    },
  };
  const policy = bindResponsiveOrbitPolicy({
    controls: { update(value) { updates.push(value); } },
    inputSurface,
    mediaQuery,
  });
  assert.deepEqual(updates, [{ wheel: true }]);
  assert.equal(policy.mobile, false);
  mediaQuery.setMatches(true);
  assert.deepEqual(updates.at(-1), { wheel: false });
  assert.equal(inputSurface.style.touchAction, "pan-y");
  mediaQuery.setMatches(false);
  assert.deepEqual(updates.at(-1), { wheel: true });
  assert.equal(inputSurface.style.touchAction, "");
  policy.destroy();
  policy.destroy();
  assert.equal(mediaQuery.listenerCount, 0);
  mediaQuery.setMatches(true);
  assert.equal(updates.length, 3);
  assert.ok(removed.length >= 2);
});

test("initial responsive failure removes its subscription and preserves startup rejection", () => {
  const mediaQuery = new FakeMediaQuery(false), failure = new Error("initial update");
  assert.throws(() => bindResponsiveOrbitPolicy({ mediaQuery,
    inputSurface: { style: { removeProperty() {} } },
    controls: { update() { throw failure; } }, onError: assert.fail,
  }), (error) => error === failure);
  assert.equal(mediaQuery.listenerCount, 0);
});

test("live responsive failure retires the subscription before reporting fatal", () => {
  const mediaQuery = new FakeMediaQuery(false), errors = [];
  let fail = false;
  const policy = bindResponsiveOrbitPolicy({ mediaQuery,
    inputSurface: { style: { removeProperty() {} } },
    controls: { update() { if (fail) throw new Error("live update"); } },
    onError(error) { assert.equal(mediaQuery.listenerCount, 0); errors.push(error); },
  });
  fail = true;
  mediaQuery.setMatches(true); mediaQuery.setMatches(false);
  assert.equal(errors.length, 1);
  policy.destroy();
});

class FakeMediaQuery extends EventTarget {
  constructor(matches) {
    super();
    this.matches = matches;
    this.listenerCount = 0;
  }

  addEventListener(type, listener, options) {
    super.addEventListener(type, listener, options);
    if (type === "change") this.listenerCount += 1;
  }

  removeEventListener(type, listener, options) {
    super.removeEventListener(type, listener, options);
    if (type === "change") this.listenerCount -= 1;
  }

  setMatches(matches) {
    this.matches = matches;
    this.dispatchEvent(new Event("change"));
  }
}
