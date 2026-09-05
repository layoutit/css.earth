import assert from "node:assert/strict";
import { PREPARED_WHEEL_ZOOM } from "../../src/platform/prepared-wheel-zoom.mjs";
import { WHEEL_ZOOM_SPEED_MULTIPLIER, WHEEL_ZOOM_DISCRETE_SPEED_MULTIPLIER } from "../runtime-policy.mjs";

export async function proveWheelZoomDistance(page, planet, profile) {
  const original = await profile.camera(page), bounds = await profile.bounds(page);
  const fullStepRatio = Math.exp(PREPARED_WHEEL_ZOOM.screenLogScalePerMillisecond *
    PREPARED_WHEEL_ZOOM.intervalMilliseconds * WHEEL_ZOOM_SPEED_MULTIPLIER);
  const startZoom = Math.max(bounds.minimumZoom,
    Math.min(bounds.defaultZoom, bounds.maximumZoom / fullStepRatio * .95));
  const results = [];
  try {
    for (const [name, deltas, kind] of [["wheel-notch", [-100], "wheel"],
      ["trackpad-stream", Array(20).fill(-5), "trackpad"],
      ["trackpad-accelerated", [-2, -98], "trackpad"], ["trackpad-fine", [-1], "trackpad"]]) {
      await profile.setCamera(page, { pitch: bounds.defaultPitch, zoom: startZoom });
      await page.waitForTimeout(410);
      const box = await page.locator(".polycss-camera").boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      const events = await page.evaluate(id => window[`__${id}`].camera.stats().dragInertia.wheelZoom.events, planet.id);
      const before = (await profile.camera(page)).zoom;
      let scrollPixels = 0;
      for (const delta of deltas) {
        const received = await wheelWithReceipt(page, delta);
        scrollPixels += received;
        assert.equal(await page.evaluate(id =>
          window[`__${id}`].camera.stats().dragInertia.wheelZoom.inputKind, planet.id), kind,
        `${planet.id}: ${name} must use the ${kind} response`);
        if (deltas.length > 1) await page.waitForTimeout(8);
      }
      await page.waitForFunction(({ id, events }) => {
        const stats = window[`__${id}`].camera.stats().dragInertia.wheelZoom;
        return stats.events >= events && !stats.active;
      }, { id: planet.id, events: events + deltas.length });
      const after = (await profile.camera(page)).zoom;
      results.push({ name, kind, scrollPixels, before, after, ratio: after / before });
    }
    for (const item of results) {
      const speed = item.kind === "wheel" ? WHEEL_ZOOM_DISCRETE_SPEED_MULTIPLIER : WHEEL_ZOOM_SPEED_MULTIPLIER;
      const expected = Math.exp(PREPARED_WHEEL_ZOOM.screenLogScalePerMillisecond *
        PREPARED_WHEEL_ZOOM.intervalMilliseconds * speed * -item.scrollPixels / 100);
      assert.ok(Math.abs(item.ratio - expected) < .005,
        `${planet.id}: ${item.name} must follow received scroll distance (${item.ratio})`);
    }
    assert.equal(results[0].scrollPixels, results[1].scrollPixels);
    assert.ok(results[0].ratio > 1 && results[0].ratio < 1.25,
      `${planet.id}: a coarse wheel step must stay modest`);
    assert.ok(results[1].ratio > results[0].ratio,
      `${planet.id}: the continuous trackpad stream must retain its stronger response`);
    assert.ok(Math.abs(results[1].ratio - results[2].ratio) < .005,
      `${planet.id}: large precision packets must retain the same total scroll response`);
    assert.ok(results[3].ratio > 1 && results[3].ratio < 1.01,
      `${planet.id}: a fine trackpad adjustment must remain small`);
    assert.equal(await profile.stable(page), true);
    return results;
  } finally {
    await profile.setCamera(page, original);
  }
}

export async function wheelWithReceipt(page, deltaY) {
  // Browser automation can scale wheel transport with device density. Measure
  // the actual CSS-pixel receipt rather than changing production input by DPR.
  await page.evaluate(() => {
    window.__wheelDistanceReceipt = new Promise(resolve => document.addEventListener("wheel",
      event => resolve({ deltaY: event.deltaY, deltaMode: event.deltaMode }), { capture: true, once: true }));
  });
  await page.mouse.wheel(0, deltaY);
  const receipt = await page.evaluate(async () => {
    const value = await window.__wheelDistanceReceipt; delete window.__wheelDistanceReceipt; return value;
  });
  assert.equal(receipt.deltaMode, 0, "the browser probe must deliver pixel-mode wheel input");
  return receipt.deltaY;
}
