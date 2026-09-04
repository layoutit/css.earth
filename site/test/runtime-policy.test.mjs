import assert from "node:assert/strict";
import test from "node:test";

import {
  bindResponsiveOrbitPolicy,
  CANONICAL_PREPARED_IMAGE_DENSITY,
  DESKTOP_VIEWPORT_MIN,
  MOBILE_VIEWPORT_MAX,
  MOBILE_VIEWPORT_QUERY,
} from "../runtime-policy.mjs";

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
