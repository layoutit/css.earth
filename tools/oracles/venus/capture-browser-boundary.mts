import type { Page } from "playwright";
import type { BrowserCamera } from "./profile.mts";
import { boolean, finite, record, text } from "./input-validation.mts";

// This callback is serialized by Playwright; every diagnostic access is checked
// in the browser, and every returned state is decoded again on the Node side.
export async function diagnostic(page: Page, path: readonly string[], args?: readonly unknown[]): Promise<unknown> {
  return page.evaluate(({ path, args }) => {
    let current: unknown = Reflect.get(window, "__venus");
    let owner: object | undefined;
    for (const key of path) {
      if (!current || (typeof current !== "object" && typeof current !== "function")) throw new TypeError(`Missing Venus diagnostic ${key}.`);
      owner = current;
      current = Reflect.get(current, key);
    }
    if (args !== undefined) {
      if (typeof current !== "function") throw new TypeError("Venus diagnostic is not callable.");
      const result: unknown = Reflect.apply(current, owner, args);
      return result;
    }
    return current;
  }, { path: [...path], args: args === undefined ? undefined : [...args] });
}

export async function waitForVenus(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const value: unknown = Reflect.get(window, "__venus");
    return document.documentElement.dataset.ready === "true" && value !== null && typeof value === "object" && Reflect.get(value, "ready") === true;
  }, null, { timeout: 60_000 });
}

export async function selectCamera(page: Page, camera: BrowserCamera, lens: string): Promise<void> {
  await diagnostic(page, ["lenses", "select"], [lens]);
  await diagnostic(page, ["camera", "setState"], [{ ...camera, lens }]);
  await page.evaluate(() => {
    const motion = document.querySelector('input[name="motion"]');
    if (!(motion instanceof HTMLInputElement)) throw new Error("Venus motion control is missing.");
    if (motion.checked) motion.click();
    for (const animation of document.getAnimations()) { animation.pause(); animation.currentTime = 0; }
  });
  await page.waitForFunction((lens) => {
    const root: unknown = Reflect.get(window, "__venus");
    if (!root || typeof root !== "object") return false;
    const lenses: unknown = Reflect.get(root, "lenses");
    if (!lenses || typeof lenses !== "object") return false;
    const state: unknown = Reflect.get(lenses, "state");
    if (typeof state !== "function") return false;
    const value: unknown = Reflect.apply(state, lenses, []);
    return value !== null && typeof value === "object" && Reflect.get(value, "id") === lens && Reflect.get(value, "ready") === true && document.documentElement.dataset.playing === "false";
  }, lens);
}

export const SCENE_ONLY_STYLE = `
  body > *:not(.object-viewport):not(script),
  .object-viewport > *:not(.object-stage) { visibility: hidden !important; }
`;
export async function hideShell(page: Page): Promise<string[]> {
  await page.addStyleTag({ content: SCENE_ONLY_STYLE });
  await settlePaint(page);
  return page.evaluate(() => [...document.body.children]
    .filter((element) => !element.matches(".object-viewport, script") &&
      getComputedStyle(element).visibility !== "hidden" && getComputedStyle(element).display !== "none" &&
      element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0)
    .map((element) => element.tagName.toLowerCase()));
}
export async function settlePaint(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
}
export async function readRuntime(page: Page) {
  const camera = record(await diagnostic(page, ["camera", "state"], []), "Runtime camera");
  const stats = record(await diagnostic(page, ["camera", "stats"], []), "Camera stats");
  const dom = record(await diagnostic(page, ["dom"]), "Runtime DOM");
  const animations = await page.evaluate(() => ({
    canvasCount: document.querySelectorAll(".object-stage canvas").length,
    svgCount: document.querySelectorAll(".object-stage svg").length,
    animations: document.getAnimations().map((animation) => ({ playState: animation.playState, currentTime: typeof animation.currentTime === "number" || animation.currentTime === null ? animation.currentTime : String(animation.currentTime) })),
  }));
  return {
    camera: { ...camera, controlPitch: finite(camera.controlPitch, "Control pitch"), controlYaw: finite(camera.controlYaw, "Control yaw"), zoom: finite(camera.zoom, "Zoom") },
    cameraStats: { ...stats, pitchBounded: boolean(stats.pitchBounded, "Pitch bounded"), yawBounded: boolean(stats.yawBounded, "Yaw bounded"), cameraModel: text(stats.cameraModel, "Camera model") },
    material: await diagnostic(page, ["material", "state"], []),
    lens: await diagnostic(page, ["lenses", "state"], []),
    stableDomIdentity: boolean(await diagnostic(page, ["assertStableDomIdentity"], []), "Stable DOM"),
    retainedLeafCount: finite(dom.retainedLeafCount, "Retained leaves"), ...animations,
  };
}
