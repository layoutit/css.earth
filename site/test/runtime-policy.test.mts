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
} from "../runtime-policy.mts";

test("automatic playback has one complete readiness, intent and environment policy", () => {
  for (const sceneState of ["loading", "ready", "error", "destroyed"] as const) {
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

type WheelInput = Parameters<typeof wheelZoomInputKind>[0];
const wheelEvent = (input: Partial<WheelInput> & Pick<WheelInput, 'deltaY'>): WheelInput => ({
  deltaMode: 0, ctrlKey: false, deltaX: 0, timeStamp: 0, ...input,
});

test("scroll input classification preserves accelerated precision gestures and permits device changes", () => {
  for (const deltaMode of [1, 2]) assert.equal(wheelZoomInputKind(wheelEvent({ deltaY: 1, deltaMode })), "wheel");
  for (const deltaY of [40, 50, 100, 120, 4.000244140625, 8.00048828125]) {
    assert.equal(wheelZoomInputKind(wheelEvent({ deltaY, timeStamp: 0 })), "wheel");
  }
  for (const deltaY of [1, 5, 10, 25, 38, 41.5]) {
    assert.equal(wheelZoomInputKind(wheelEvent({ deltaY, timeStamp: 0 })), "trackpad");
  }
  assert.equal(wheelZoomInputKind(wheelEvent({ deltaY: 100, timeStamp: 8 }), "trackpad", 0), "trackpad");
  assert.equal(wheelZoomInputKind(wheelEvent({ deltaY: 100, timeStamp: 408 }), "trackpad", 0), "wheel");
  assert.equal(wheelZoomInputKind(wheelEvent({ deltaY: 2, timeStamp: 8 }), "wheel", 0), "trackpad");
  assert.equal(wheelZoomInputKind(wheelEvent({ deltaY: 3, deltaMode: 1, timeStamp: 8 }), "trackpad", 0), "wheel");
  assert.equal(wheelZoomInputKind(wheelEvent({ deltaY: 100, deltaX: 1 })), "trackpad");
  assert.equal(wheelZoomInputKind(wheelEvent({ deltaY: 100, ctrlKey: true })), "trackpad");
});

// The responsive-policy seam reads only style and MediaQueryList events; these native EventTarget
// doubles deliberately expose that same observable subset at the injection boundary.
test("updates wheel and touch policy without replacing controls", () => {
  const mediaQuery = new FakeMediaQuery(false);
  const updates: Parameters<Parameters<typeof bindResponsiveOrbitPolicy>[0]["controls"]["update"]>[0][] = [];
  const removed: string[] = [];
  const inputSurface = {
    style: {
      touchAction: "",
      removeProperty(name: string) {
        removed.push(name);
        if (name === "touch-action") this.touchAction = "";
        return "";
      },
    },
  };
  const policy = bindResponsiveOrbitPolicy({
    controls: { update(value) { updates.push(value); } },
    inputSurface: inputSurface as unknown as HTMLElement,
    mediaQuery: mediaQuery as unknown as MediaQueryList,
  });
  assert.deepEqual(updates, [{ wheel: true }]);
  assert.equal(policy.mobile, false);
  mediaQuery.setMatches(true);
  assert.deepEqual(updates.at(-1), { wheel: true });
  assert.equal(inputSurface.style.touchAction, "none");
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
  assert.throws(() => bindResponsiveOrbitPolicy({ mediaQuery: mediaQuery as unknown as MediaQueryList,
    inputSurface: { style: { touchAction: "", removeProperty() { return ""; } } } as unknown as HTMLElement,
    controls: { update() { throw failure; } }, onError: (error: unknown) => assert.fail(String(error)),
  }), (error) => error === failure);
  assert.equal(mediaQuery.listenerCount, 0);
});

test("live responsive failure retires the subscription before reporting fatal", () => {
  const mediaQuery = new FakeMediaQuery(false), errors: unknown[] = [];
  let fail = false;
  const policy = bindResponsiveOrbitPolicy({ mediaQuery: mediaQuery as unknown as MediaQueryList,
    inputSurface: { style: { touchAction: "", removeProperty() { return ""; } } } as unknown as HTMLElement,
    controls: { update() { if (fail) throw new Error("live update"); } },
    onError(error) { assert.equal(mediaQuery.listenerCount, 0); errors.push(error); },
  });
  fail = true;
  mediaQuery.setMatches(true); mediaQuery.setMatches(false);
  assert.equal(errors.length, 1);
  policy.destroy();
});

test("responsive cleanup preserves a non-Error startup failure as the aggregate cause", () => {
  const mediaQuery = new FakeMediaQuery(false);
  const cleanupFailure = new Error("remove touch action");
  assert.throws(() => bindResponsiveOrbitPolicy({
    mediaQuery: mediaQuery as unknown as MediaQueryList,
    inputSurface: { style: { touchAction: "", removeProperty() { throw cleanupFailure; } } } as unknown as HTMLElement,
    controls: { update() { throw null; } },
  }), (error) => {
    assert.ok(error instanceof AggregateError);
    assert.equal(error.cause, null);
    assert.equal(error.message, "null");
    assert.deepEqual(error.errors, [null, cleanupFailure]);
    return true;
  });
  assert.equal(mediaQuery.listenerCount, 0);
});

class FakeMediaQuery extends EventTarget {
  matches: boolean;
  listenerCount: number;
  constructor(matches: boolean) {
    super();
    this.matches = matches;
    this.listenerCount = 0;
  }

  override addEventListener(...[type, listener, options]: Parameters<EventTarget["addEventListener"]>) {
    super.addEventListener(type, listener, options);
    if (type === "change") this.listenerCount += 1;
  }

  override removeEventListener(...[type, listener, options]: Parameters<EventTarget["removeEventListener"]>) {
    super.removeEventListener(type, listener, options);
    if (type === "change") this.listenerCount -= 1;
  }

  setMatches(matches: boolean) {
    this.matches = matches;
    this.dispatchEvent(new Event("change"));
  }
}
