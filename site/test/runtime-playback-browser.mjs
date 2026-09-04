import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { OBJECTS } from "../objects.mjs";
import { assertRenderedObjectControls, loadPlanetBrowserProfile } from "./load-browser-profile.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const selected = process.argv[3]
  ? OBJECTS.filter(({ id }) => id === process.argv[3]) : OBJECTS;
assert.ok(selected.length, "Select an implemented object.");
const output = resolve(process.argv[4] ??
  `output/playwright/runtime-playback-${Date.now()}`);
await mkdir(output, { recursive: true });
const report = { capturedAt: new Date().toISOString(), baseUrl, source: {}, cases: [] };
for (const file of ["site/scene-router.mjs", "site/runtime-policy.mjs",
  ...selected.map(({ id }) => `src/planets/${id}/runtime/client.mjs`)]) {
  report.source[file] = createHash("sha256").update(await readFile(file)).digest("hex");
}
const browser = await chromium.launch({ channel: "chrome", headless: true });
report.browser = browser.version();
try {
  for (const object of selected) {
    const profile = await loadPlanetBrowserProfile(object);
    for (const deviceScaleFactor of [1, 2]) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 }, deviceScaleFactor,
        reducedMotion: "no-preference",
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const record = { id: object.id, deviceScaleFactor, samples: [] };
      report.cases.push(record);
      try {
        await page.goto(new URL(object.route, baseUrl).href);
        await page.waitForFunction((id) =>
          window.__cssEarth?.ready && window[`__${id}`]?.ready, object.id);
        await assertRenderedObjectControls(page, profile);
        await paused("default Motion off");
        await pausedSpeedCycle("Motion off", true);
        await page.emulateMedia({ reducedMotion: "reduce" });
        await paused("Motion off; reduced motion on");
        await page.emulateMedia({ reducedMotion: "no-preference" });
        await paused("Motion off; reduced motion cleared");
        await motion(true);
        await running("Motion on");
        await page.emulateMedia({ reducedMotion: "reduce" });
        await paused("Motion on; reduced motion blocks playback");
        await pausedSpeedCycle("Motion on; reduced motion blocks speed changes");
        assert.equal(await page.locator(".planet-motion-setting").isChecked(), true);
        await page.emulateMedia({ reducedMotion: "no-preference" });
        await running("Motion on; reduced motion cleared");
        await visibility(true);
        await paused("hidden");
        await pausedSpeedCycle("hidden; speed changes cannot resume");
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.emulateMedia({ reducedMotion: "no-preference" });
        await paused("hidden; preference cleared");
        await motion(false);
        await visibility(false);
        await paused("visible; Motion now off");
        assert.deepEqual(errors, [], `${object.id}: no page errors`);
        record.passed = true;
      } finally {
        await context.close();
      }

      async function motion(value) {
        await page.locator(".planet-motion-setting").evaluate((input, next) => {
          if (input.checked !== next) input.click();
        }, value);
      }
      async function visibility(hidden) {
        // Synthetic visibility exercises policy ordering, not browser occlusion.
        await page.evaluate((value) => {
          Object.defineProperty(document, "hidden", { configurable: true, value });
          document.dispatchEvent(new Event("visibilitychange"));
        }, hidden);
      }
      async function pausedSpeedCycle(label, fullCycle = false) {
        if (!profile.objectControls.settings?.controls.some(({ name }) => name === "speed")) return;
        const button = page.locator('button[name="speed"]');
        assert.equal(await button.getAttribute("data-state"), "normal");
        for (const state of ["fast", "fastest", "superfast", "off", "normal"]) {
          await button.evaluate((input) => {
            if (input.disabled) throw new Error("Ready speed control must be enabled.");
            input.click();
          });
          assert.equal(await button.getAttribute("data-state"), state);
          if (fullCycle || state === "off" || state === "normal") await paused(`${label}; speed ${state}`);
        }
      }
      async function sample(label) {
        const state = await page.evaluate(() => ({
          lifecycle: window.__cssEarth.lifecycle,
          requested: document.querySelector(".planet-motion-setting").checked,
          playing: document.documentElement.dataset.playing,
          speed: document.querySelector('button[name="speed"]')?.dataset.state ?? null,
          animations: document.querySelector(".planet-stage")
            .getAnimations({ subtree: true }).map((animation) => ({
              state: animation.playState, time: animation.currentTime, rate: animation.playbackRate,
            })),
        }));
        record.samples.push({ label, ...state });
        return state;
      }
      async function paused(label) {
        await page.evaluate(() => new Promise((done) =>
          requestAnimationFrame(() => requestAnimationFrame(done))));
        const before = await sample(label);
        await page.waitForTimeout(140);
        const after = await sample(`${label}: settled`);
        assert.equal(after.lifecycle, "paused", `${object.id}: ${label}: router`);
        assert.equal(after.playing, "false", `${object.id}: ${label}: publication`);
        assert.ok(after.animations.length > 0, `${object.id}: observable animations`);
        assert.ok(after.animations.every(({ state }) => state === "paused"),
          `${object.id}: ${label}: actual animation pause`);
        assert.equal(after.animations.length, before.animations.length);
        after.animations.forEach(({ time }, index) => assert.ok(
          Math.abs((time ?? 0) - (before.animations[index].time ?? 0)) < 0.1,
          `${object.id}: ${label}: no continued clock advancement`));
      }
      async function running(label) {
        const before = await sample(label);
        await page.waitForTimeout(140);
        const after = await sample(`${label}: advancing`);
        assert.equal(after.lifecycle, "mounted", `${object.id}: ${label}: router`);
        assert.equal(after.playing, "true", `${object.id}: ${label}: publication`);
        assert.ok(after.animations.some(({ state, time }, index) =>
          state === "running" && time > before.animations[index].time),
        `${object.id}: ${label}: actual clock advances`);
      }
    }
  }
} catch (error) {
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  await browser.close();
  await writeFile(resolve(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
}
console.log(JSON.stringify({ output, cases: report.cases.length, error: report.error ?? null }));
