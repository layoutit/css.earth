import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();

import {
  bindResponsiveOrbitPolicy,
  automaticPlaybackPolicy,
  DESKTOP_VIEWPORT_MIN,
  MOBILE_VIEWPORT_MAX,
  MOBILE_VIEWPORT_QUERY,
  WHEEL_ZOOM_SPEED_MULTIPLIER,
  WHEEL_ZOOM_DISCRETE_SPEED_MULTIPLIER,
  WHEEL_ZOOM_PINCH,
  WHEEL_ZOOM_INERTIA,
  WHEEL_ZOOM_INERTIA_INPUT_KINDS,
  wheelZoomInputKind,
  mobileSheetKeyboardInset,
  MOBILE_SHEET_POLICY,
} from "../runtime-policy.mts";
import { PREPARED_WHEEL_ZOOM, pinchTargetDistance } from "@cssearth/renderer/navigation/prepared-wheel-zoom.ts";

test("only a keyboard-sized covering takes room from the sheet", () => {
  // A phone with nothing over the layout viewport.
  assert.equal(mobileSheetKeyboardInset({ layoutHeight: 844, visualHeight: 844 }), 0);
  // An open keyboard: the layout viewport keeps its height, the visual one loses it.
  assert.equal(mobileSheetKeyboardInset({ layoutHeight: 844, visualHeight: 508 }), 336);
  // A browser toolbar sliding away is not a keyboard.
  assert.equal(mobileSheetKeyboardInset({ layoutHeight: 844, visualHeight: 784 }), 0);
  assert.equal(mobileSheetKeyboardInset({
    layoutHeight: 844, visualHeight: 844 - MOBILE_SHEET_POLICY.keyboardMinimumPixels,
  }), MOBILE_SHEET_POLICY.keyboardMinimumPixels, "the threshold itself counts");
  // A pinch-zoomed page scrolls its visual viewport without a keyboard.
  assert.equal(mobileSheetKeyboardInset({ layoutHeight: 844, visualHeight: 508, offsetTop: 336 }), 0);
  // Partial metrics leave the sheet alone.
  assert.equal(mobileSheetKeyboardInset({ layoutHeight: Number.NaN, visualHeight: 508 }), 0);
  assert.equal(mobileSheetKeyboardInset({ layoutHeight: 844, visualHeight: Number.POSITIVE_INFINITY }), 0);
});

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

// The traced reference response is one commanded interval of travel per 100
// delta units. Both devices report the same units, so both sit on it: a gain
// above 1 makes that device travel further than the trace it was taken from.
test("every scroll device is calibrated to the traced reference response", () => {
  for (const gain of [WHEEL_ZOOM_SPEED_MULTIPLIER, WHEEL_ZOOM_DISCRETE_SPEED_MULTIPLIER]) {
    assert.equal(gain, 1);
  }
});

// Measured with headless trackpad pinches on Earth at 1,400 x 900 (2026-09-25): the default view is 4.914 radii
// out and the closest view 1.930. One pinch at the old 18x reached the closest view; two wheel notches do.
test("a full pinch slows into a body and speeds across open space", () => {
  const full = Math.log(WHEEL_ZOOM_PINCH.fullPinchFingerRatio), notch = .006 * 100, closest = 1.930;
  const once = (distance: number) => pinchTargetDistance(distance, closest, full, WHEEL_ZOOM_PINCH, notch);
  assert.ok(once(4.914) / closest > 1.3, "one full pinch stops well outside Earth's closest view");
  assert.equal(once(once(4.914)), closest, "two full pinches reach it");
  assert.ok(1e21 / once(1e21) > 18, "far out a full pinch zooms further than the old 18x");
});

// The glide decays per frame, so `dampingSeconds` is a time constant and the
// coast travels `dampingSeconds * (1 - stopRateRatio)` seconds at the released
// rate. Keeping that under the commanded interval is what stops a released
// gesture from travelling further than the gesture itself asked for.
test("a released wheel gesture coasts for less than the interval it commanded", () => {
  assert.notEqual(WHEEL_ZOOM_INERTIA, null);
  const coastMilliseconds =
    WHEEL_ZOOM_INERTIA.dampingSeconds * 1000 * (1 - WHEEL_ZOOM_INERTIA.stopRateRatio) * WHEEL_ZOOM_INERTIA.gain;
  assert.ok(coastMilliseconds > 0);
  assert.ok(coastMilliseconds < PREPARED_WHEEL_ZOOM.intervalMilliseconds / 2,
    `coast ${coastMilliseconds} ms must stay well inside the ${PREPARED_WHEEL_ZOOM.intervalMilliseconds} ms interval`);
});

type WheelInput = Parameters<typeof wheelZoomInputKind>[0];
const wheelEvent = (input: Partial<WheelInput> & Pick<WheelInput, 'deltaY'>): WheelInput => ({
  deltaMode: 0, ctrlKey: false, deltaX: 0, timeStamp: 0, ...input,
});

// A precision pointer arrives with the platform's momentum already applied, so
// the shared glide belongs to discrete wheels only.
test("only discrete wheels are released into the shared glide", () => {
  assert.deepEqual([...WHEEL_ZOOM_INERTIA_INPUT_KINDS], ["wheel"]);
  assert.equal(wheelZoomInputKind(wheelEvent({ deltaY: 100 })), "wheel");
  const inertiaKinds: readonly string[] = WHEEL_ZOOM_INERTIA_INPUT_KINDS;
  assert.ok(!inertiaKinds.includes(wheelZoomInputKind(wheelEvent({ deltaY: 4 }))));
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
