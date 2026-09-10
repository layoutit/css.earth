import assert from "node:assert/strict";
import type { BrowserPage } from "../../../site/test/browser-profile-types.mts";

type View = { controlPitch: number; controlYaw: number; zoom: number };
type Probe = { id: string } & (
  { action: "original" } |
  { action: "setView"; view: View } |
  { action: "observe"; track: string; phaseKey: string } |
  { action: "restore"; original: { view: View; shadows: boolean } }
);

// Playwright serializes this function. Its guards live inside the callback so
// observations from the browser remain checked values in the Node process.
function probeAtmosphere(command: Probe) {
  function record(value: unknown): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError("Expected atmosphere diagnostics object.");
    return value as Record<string, unknown>;
  }
  function call(target: unknown, method: string, ...args: unknown[]): unknown {
    const owner = record(target), fn = owner[method];
    if (typeof fn !== "function") throw new TypeError(`Missing atmosphere diagnostics method ${method}.`);
    return Reflect.apply(fn, owner, args);
  }
  function number(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError("Expected finite atmosphere observation.");
    return value;
  }
  function shadowsInput(): HTMLInputElement {
    const input = document.querySelector('input[name="shadows"]');
    if (!(input instanceof HTMLInputElement)) throw new TypeError("Missing atmosphere shadows control.");
    return input;
  }
  const api: unknown = Reflect.get(window, `__${command.id}`);
  if (command.action === "original") {
    const view = record(call(api, "view"));
    return { kind: "original" as const, view: {
      controlPitch: number(view.controlPitch), controlYaw: number(view.controlYaw), zoom: number(view.zoom),
    }, shadows: shadowsInput().checked };
  }
  if (command.action === "setView") {
    call(api, "setView", command.view);
    return { kind: "updated" as const };
  }
  if (command.action === "restore") {
    call(api, "setView", command.original.view);
    const input = shadowsInput();
    if (input.checked !== command.original.shadows) input.click();
    return { kind: "updated" as const };
  }
  const material = record(call(record(api).material, "state"));
  const track = record(material[command.track]);
  const resources = record(call(record(api).runtime, "resources"));
  if (!Array.isArray(resources.pools)) throw new TypeError("Missing atmosphere resource pools.");
  const pools = resources.pools.map((value: unknown) => record(value))
    .filter(pool => pool.id === "lighting" || pool.id === "atmosphere")
    .map(pool => ({ nativeSlots: number(pool.nativeSlots) }));
  return { kind: "observed" as const, phase: Number(track[command.phaseKey]),
    roll: number(track.lightRollDegrees), stable: call(api, "assertStableDomIdentity"), pools };
}

function atmosphereSettled(id: string): boolean {
  const api: unknown = Reflect.get(window, `__${id}`);
  if (typeof api !== "object" || api === null || !("runtime" in api)) return false;
  const runtime = api.runtime;
  if (typeof runtime !== "object" || runtime === null || !("selection" in runtime) || typeof runtime.selection !== "function") return false;
  const state: unknown = Reflect.apply(runtime.selection, runtime, []);
  if (typeof state !== "object" || state === null || !("pending" in state) || !("loadingMaterial" in state)) return false;
  return !state.pending && !state.loadingMaterial;
}

// Exercise real package controls and the shared decode/publication boundary.
export async function checkDirectionalAtmosphere(page: BrowserPage, { id, track, phaseKey }: { id: string; track: string; phaseKey: string }) {
  const original = await page.evaluate(probeAtmosphere, { id, action: "original" });
  assert.equal(original.kind, "original");
  const states = [];
  for (const [controlPitch, controlYaw, zoom] of [[34.23, -105, 1.1], [34.23, -15, .7],
    [34.23, 75, 1.3], [-55, 35, .9], [65, 155, 1.1]]) {
    await page.evaluate(probeAtmosphere, { id, action: "setView", view: { controlPitch, controlYaw, zoom } });
    const pair = [];
    for (const shadows of [true, false]) {
      await page.locator('input[name="shadows"]').evaluate((input, shadows) => {
        if (!(input instanceof HTMLInputElement)) throw new TypeError("Missing atmosphere shadows control.");
        if (input.checked !== shadows) input.click();
      }, shadows);
      await page.waitForFunction(atmosphereSettled, id);
      const state = await page.evaluate(probeAtmosphere, { id, action: "observe", track, phaseKey });
      assert.equal(state.kind, "observed");
      assert.equal(state.stable, true);
      for (const pool of state.pools) assert.ok(pool.nativeSlots <= 3);
      pair.push({ phase: state.phase, roll: state.roll });
    }
    assert.ok(Number.isFinite(pair[0].phase) && Number.isFinite(pair[0].roll));
    assert.deepEqual(pair[0], pair[1], `${id}: ground shadows must not freeze or rotate the atmosphere`);
    states.push({ controlPitch, controlYaw, zoom, ...pair[0] });
  }
  assert.ok(new Set(states.map(state => state.phase)).size >= 3);
  await page.evaluate(probeAtmosphere, { id, action: "restore", original });
  await page.waitForFunction(atmosphereSettled, id);
  return states;
}
