import assert from "node:assert/strict";
import type { Page } from "playwright";
import { PREPARED_WHEEL_ZOOM } from "../../src/platform/prepared-wheel-zoom.mts";
import { WHEEL_ZOOM_SPEED_MULTIPLIER, WHEEL_ZOOM_DISCRETE_SPEED_MULTIPLIER } from "../runtime-policy.mts";
import type { CameraBounds, CameraState, ObjectBrowserProfile } from "./browser-profile-types.mts";

interface PlanetReference { readonly id: string; }
interface WheelZoomStats { readonly active: boolean; readonly events: number; readonly inputKind: string; }
interface DragInertiaStats { readonly active: boolean; readonly wheelZoom: WheelZoomStats; }
interface DollyPlan { readonly minimumDistance: number; readonly wheelStepPerDelta: number; }
interface CameraStats {
  readonly projection?: { readonly model?: string };
  readonly dolly: DollyPlan;
  readonly dragInertia: DragInertiaStats;
}
interface CameraRuntime {
  state(): CameraState & { readonly distance?: number; readonly distanceKilometers?: number };
  setState(state: Partial<CameraState> & { readonly distance?: number }): void;
  stats(): CameraStats;
}
interface ObjectRuntime { readonly camera: CameraRuntime; }
interface WheelReceipt { readonly deltaY: number; readonly deltaMode: number; }

declare global {
  interface Window {
    __wheelDistanceReceipt?: Promise<WheelReceipt>;
  }
}

export async function proveWheelZoomDistance(page: Page, planet: PlanetReference, profile: ObjectBrowserProfile) {
  const original = await profile.camera(page), bounds = await profile.bounds(page);
  // A perspective dolly (Mercury's prepared camera) moves the eye by
  // exp(deltaY * stepPerDelta * inputGain) per event, using the shared
  // discrete-wheel or precision-input response.
  const dolly = await page.evaluate((id: string): DollyPlan | null => {
    const runtime = Reflect.get(window, `__${id}`) as ObjectRuntime | undefined;
    if (!runtime) throw new Error(`${id}: camera runtime is unavailable`);
    const stats = runtime.camera.stats();
    return stats.projection?.model === "css-perspective-shared-with-sky" ? stats.dolly : null;
  }, planet.id);
  if (dolly) return proveWheelDollyDistance(page, planet, profile, dolly, original, bounds);
  const fullStepRatio = Math.exp(PREPARED_WHEEL_ZOOM.screenLogScalePerMillisecond *
    PREPARED_WHEEL_ZOOM.intervalMilliseconds * WHEEL_ZOOM_SPEED_MULTIPLIER);
  const startZoom = Math.max(bounds.minimumZoom,
    Math.min(bounds.defaultZoom, bounds.maximumZoom / fullStepRatio * .95));
  const results: { name: string; kind: string; scrollPixels: number; before: number; after: number; ratio: number }[] = [];
  const journeys: readonly (readonly [string, readonly number[], string])[] = [["wheel-notch", [-100], "wheel"],
    ["trackpad-stream", Array<number>(20).fill(-5), "trackpad"],
    ["trackpad-accelerated", [-2, -98], "trackpad"], ["trackpad-fine", [-1], "trackpad"]];
  try {
    for (const [name, deltas, kind] of journeys) {
      await profile.setCamera(page, { pitch: bounds.defaultPitch, zoom: startZoom });
      await page.waitForTimeout(410);
      const box = await page.locator(".polycss-camera").boundingBox();
      assert.ok(box, `${planet.id}: camera must be visible`);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      const events = await page.evaluate((id: string): number => {
        const runtime = Reflect.get(window, `__${id}`) as ObjectRuntime | undefined;
        if (!runtime) throw new Error(`${id}: camera runtime is unavailable`);
        return runtime.camera.stats().dragInertia.wheelZoom.events;
      }, planet.id);
      const before = requiredNumber((await profile.camera(page)).zoom, `${planet.id}: camera zoom`);
      let scrollPixels = 0;
      for (const delta of deltas) {
        const received = await wheelWithReceipt(page, delta);
        scrollPixels += received;
        assert.equal(await page.evaluate((id: string): string => {
          const runtime = Reflect.get(window, `__${id}`) as ObjectRuntime | undefined;
          if (!runtime) throw new Error(`${id}: camera runtime is unavailable`);
          return runtime.camera.stats().dragInertia.wheelZoom.inputKind;
        }, planet.id), kind,
        `${planet.id}: ${name} must use the ${kind} response`);
        if (deltas.length > 1) await page.waitForTimeout(8);
      }
      await page.waitForFunction(({ id, events }: { readonly id: string; readonly events: number }) => {
        const runtime = Reflect.get(window, `__${id}`) as ObjectRuntime | undefined;
        if (!runtime) return false;
        const stats = runtime.camera.stats().dragInertia.wheelZoom;
        return stats.events >= events && !stats.active;
      }, { id: planet.id, events: events + deltas.length });
      const after = requiredNumber((await profile.camera(page)).zoom, `${planet.id}: camera zoom`);
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
    await profile.setCamera(page, { ...original, zoom: requiredNumber(original.zoom, `${planet.id}: original zoom`) });
  }
}

async function proveWheelDollyDistance(page: Page, planet: PlanetReference, profile: ObjectBrowserProfile, dolly: DollyPlan, original: Partial<CameraState>, bounds: CameraBounds) {
  const results: { name: string; kind: string; scrollPixels: number; before: number; after: number; ratio: number; expected: number }[] = [];
  const journeys: readonly (readonly [string, readonly number[], string])[] = [["wheel-notch", [-100], "wheel"],
    ["trackpad-stream", Array<number>(20).fill(-5), "trackpad"],
    ["trackpad-accelerated", [-2, -98], "trackpad"], ["trackpad-fine", [-1], "trackpad"]];
  const distance = () => page.evaluate((id: string): number => {
    const runtime = Reflect.get(window, `__${id}`) as ObjectRuntime | undefined;
    if (!runtime) throw new Error(`${id}: camera runtime is unavailable`);
    const measuredDistance = runtime.camera.state().distance;
    if (typeof measuredDistance !== "number" || !Number.isFinite(measuredDistance)) throw new Error(`${id}: camera distance must be a finite number`);
    return measuredDistance;
  }, planet.id);
  try {
    for (const [name, deltas, kind] of journeys) {
      await profile.setCamera(page, { pitch: bounds.defaultPitch, zoom: bounds.defaultZoom });
      // Keep the full precision-input gesture above the prepared near bound.
      await page.evaluate(({ id, distance }: { readonly id: string; readonly distance: number }) => {
        const runtime = Reflect.get(window, `__${id}`) as ObjectRuntime | undefined;
        if (!runtime) throw new Error(`${id}: camera runtime is unavailable`);
        runtime.camera.setState({ distance });
      },
        { id: planet.id, distance: dolly.minimumDistance * Math.exp(100 * dolly.wheelStepPerDelta * WHEEL_ZOOM_SPEED_MULTIPLIER) * 1.1 });
      await page.waitForTimeout(410);
      const box = await page.locator(".polycss-camera").boundingBox();
      assert.ok(box, `${planet.id}: camera must be visible`);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      const events = await page.evaluate((id: string): number => {
        const runtime = Reflect.get(window, `__${id}`) as ObjectRuntime | undefined;
        if (!runtime) throw new Error(`${id}: camera runtime is unavailable`);
        return runtime.camera.stats().dragInertia.wheelZoom.events;
      }, planet.id);
      const before = await distance();
      let scrollPixels = 0;
      for (const delta of deltas) {
        scrollPixels += await wheelWithReceipt(page, delta);
        assert.equal(await page.evaluate((id: string): string => {
          const runtime = Reflect.get(window, `__${id}`) as ObjectRuntime | undefined;
          if (!runtime) throw new Error(`${id}: camera runtime is unavailable`);
          return runtime.camera.stats().dragInertia.wheelZoom.inputKind;
        }, planet.id), kind,
        `${planet.id}: ${name} must classify the ${kind} input`);
        if (deltas.length > 1) await page.waitForTimeout(8);
      }
      await page.waitForFunction(({ id, events }: { readonly id: string; readonly events: number }) => {
        const runtime = Reflect.get(window, `__${id}`) as ObjectRuntime | undefined;
        if (!runtime) return false;
        const stats = runtime.camera.stats().dragInertia.wheelZoom;
        return stats.events >= events && !stats.active;
      }, { id: planet.id, events: events + deltas.length });
      const after = await distance();
      results.push({ name, kind, scrollPixels, before, after, ratio: after / before,
        expected: Math.exp(scrollPixels * dolly.wheelStepPerDelta *
          (kind === "wheel" ? WHEEL_ZOOM_DISCRETE_SPEED_MULTIPLIER : WHEEL_ZOOM_SPEED_MULTIPLIER)) });
    }
    for (const item of results) {
      assert.ok(Math.abs(item.ratio - item.expected) < 1e-6,
        `${planet.id}: ${item.name} must dolly by the prepared step per received pixel (${item.ratio} vs ${item.expected})`);
    }
    assert.equal(results[0].scrollPixels, results[1].scrollPixels);
    assert.ok(results[1].ratio < results[0].ratio,
      `${planet.id}: precision dolly retains the stronger shared input response`);
    assert.ok(results[3].ratio < 1 && results[3].ratio > 0.97,
      `${planet.id}: a fine trackpad adjustment must remain small`);
    assert.equal(await profile.stable(page), true);
    return results;
  } finally {
    await profile.setCamera(page, { ...original, zoom: requiredNumber(original.zoom, `${planet.id}: original zoom`) });
  }
}

export async function wheelWithReceipt(page: Page, deltaY: number): Promise<number> {
  // Browser automation can scale wheel transport with device density. Measure
  // the actual CSS-pixel receipt rather than changing production input by DPR.
  await page.evaluate(() => {
    window.__wheelDistanceReceipt = new Promise<WheelReceipt>(resolve => document.addEventListener("wheel",
      event => resolve({ deltaY: event.deltaY, deltaMode: event.deltaMode }), { capture: true, once: true }));
  });
  await page.mouse.wheel(0, deltaY);
  const receipt = await page.evaluate(async (): Promise<WheelReceipt> => {
    const pending = window.__wheelDistanceReceipt;
    if (!pending) throw new Error("wheel receipt was not armed");
    const value = await pending; delete window.__wheelDistanceReceipt; return value;
  });
  assert.equal(receipt.deltaMode, 0, "the browser probe must deliver pixel-mode wheel input");
  return receipt.deltaY;
}

// Native wheel journeys use the same shared input policy as manual navigation.
// Coarse steps approach the target; sub-notch corrections are precision input.
// Read the active camera each time because overview can recenter on the Sun.
export async function scrollToDistance(page: Page, targetKilometers: number): Promise<void> {
  const box = await page.locator(".planet-stage").boundingBox();
  assert.ok(box, "planet stage must be visible");
  await page.mouse.move(box.x + box.width * .72, box.y + box.height * .6);
  let previousDistance: number | null = null, stalled = 0;
  for (let attempt = 0; attempt < 60; attempt++) {
    const { distance, step, kind } = await page.evaluate((): { readonly distance: number; readonly step: number; readonly kind: string } => {
      const app = Reflect.get(window, "__cssEarth") as { readonly activeObjectId?: unknown } | undefined;
      if (typeof app?.activeObjectId !== "string") throw new Error("active object id is unavailable");
      const id = app.activeObjectId;
      const runtime = Reflect.get(window, `__${id}`) as ObjectRuntime | undefined;
      if (!runtime) throw new Error(`${id}: camera runtime is unavailable`);
      const camera = runtime.camera;
      const distance = camera.state().distanceKilometers;
      if (typeof distance !== "number" || !Number.isFinite(distance)) throw new Error(`${id}: camera distanceKilometers must be a finite number`);
      return { distance,
        step: camera.stats().dolly.wheelStepPerDelta,
        kind: camera.stats().dragInertia.wheelZoom.inputKind };
    });
    if (Math.abs(distance / targetKilometers - 1) < 1e-6) return;
    // A camera clamped at its own limit never reaches the target; say so at once
    // instead of spending sixty gestures discovering it.
    if (previousDistance !== null && Math.abs(distance / previousDistance - 1) < 1e-9 && ++stalled >= 2) {
      throw new Error(`Native wheel stalled at ${distance} km while reaching ${targetKilometers} km; the camera will not travel further.`);
    }
    if (previousDistance === null || Math.abs(distance / previousDistance - 1) >= 1e-9) stalled = 0;
    previousDistance = distance;
    const coarse = Math.log(targetKilometers / distance) / step / WHEEL_ZOOM_DISCRETE_SPEED_MULTIPLIER;
    let delta: number;
    if (Math.abs(coarse) >= 100) {
      // Let an earlier precision gesture end before sending discrete notches.
      if (kind === "trackpad") await page.waitForTimeout(410);
      delta = Math.sign(coarse) * Math.min(300, Math.floor(Math.abs(coarse) / 100) * 100);
    } else {
      // The discrete and precision multipliers are equal today, so the remainder
      // after the coarse notches can still exceed one precision gesture. Send at
      // most a gesture's worth and let the loop close the rest.
      const correction = Math.log(targetKilometers / distance) / step / WHEEL_ZOOM_SPEED_MULTIPLIER;
      delta = Math.max(-39, Math.min(39, correction));
    }
    await wheelWithReceipt(page, delta);
    await page.waitForFunction((): boolean => {
      const app = Reflect.get(window, "__cssEarth") as { readonly activeObjectId?: unknown } | undefined;
      if (typeof app?.activeObjectId !== "string") return false;
      const runtime = Reflect.get(window, `__${app.activeObjectId}`) as ObjectRuntime | undefined;
      if (!runtime) return false;
      const state = runtime.camera.stats().dragInertia;
      return state && !state.active && !state.wheelZoom.active;
    }, null, { timeout: 6000 });
    await page.waitForTimeout(200);
  }
  throw new Error(`Native wheel failed to reach ${targetKilometers} km.`);
}

function requiredNumber(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
  return value;
}
