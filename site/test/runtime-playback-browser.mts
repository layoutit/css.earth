import { createTestPage } from './browser-observations.mts';
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { OBJECTS } from "../objects.mts";
import { assertRenderedObjectControls, loadPlanetBrowserProfile } from "./load-browser-profile.mts";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const selected = process.argv[3]
  ? OBJECTS.filter(({ id }) => id === process.argv[3]) : OBJECTS;
assert.ok(selected.length, "Select an implemented object.");
const output = resolve(process.argv[4] ??
  `output/playwright/runtime-playback-${Date.now()}`);
await mkdir(output, { recursive: true });
interface PlaybackTiming { label: string; timeoutMilliseconds: number; readinessWaitMilliseconds?: number; advancementWaitMilliseconds?: number; observationMilliseconds?: number; }
interface PlaybackCase { id: string; deviceScaleFactor: number; samples: unknown[]; playbackWaits: PlaybackTiming[]; passed?: boolean; }
const report: { capturedAt: string; baseUrl: string; cases: PlaybackCase[]; browser?: string; error?: string } = { capturedAt: new Date().toISOString(), baseUrl, cases: [] };
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
      const page = await createTestPage(context);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const record: PlaybackCase = { id: object.id, deviceScaleFactor, samples: [], playbackWaits: [] };
      report.cases.push(record);
      try {
        await page.goto(new URL(object.route, baseUrl).href);
        await page.waitForFunction((id) =>
          window.__cssEarth?.ready && window.__cssEarth?.object(id)?.ready, object.id);
        await assertRenderedObjectControls(page, profile);
        await paused("default Motion off");
        await assertSpeedDisabled("Motion off");
        await page.emulateMedia({ reducedMotion: "reduce" });
        await paused("Motion off; reduced motion on");
        await page.emulateMedia({ reducedMotion: "no-preference" });
        await paused("Motion off; reduced motion cleared");
        await motion(true);
        await running("Motion on");
        await pausedSpeedCycle("Motion on", true);
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
        await assertSpeedDisabled("Motion now off");
        assert.deepEqual(errors, [], `${object.id}: no page errors`);
        record.passed = true;
      } finally {
        await context.close();
      }

      async function motion(value: boolean) {
        await page.locator(".planet-motion-setting").evaluate((input, next) => {
          if (!(input instanceof HTMLInputElement)) throw new Error('Motion control must be an input.');
          if (input.checked !== next) input.click();
        }, value);
      }
      async function visibility(hidden: boolean) {
        // Synthetic visibility exercises policy ordering, not browser occlusion.
        await page.evaluate((value) => {
          Object.defineProperty(document, "hidden", { configurable: true, value });
          document.dispatchEvent(new Event("visibilitychange"));
        }, hidden);
      }
      async function pausedSpeedCycle(label: string, fullCycle = false) {
        if (!profile.objectControls.settings?.controls.some(({ name }) => name === "speed")) return;
        const input = page.locator('input[name="speed"][type="range"]');
        assert.equal(await input.getAttribute("data-state"), "normal");
        for (const [state, value] of [["fast", 2], ["fastest", 3], ["superfast", 4], ["off", 0], ["normal", 1]] as const) {
          await input.evaluate((control, nextValue) => {
            if (!(control instanceof HTMLInputElement)) throw new Error('Speed control must be an input.');
            if (control.disabled) throw new Error("Ready speed control must be enabled.");
            control.value = String(nextValue);
            control.dispatchEvent(new Event("input", { bubbles: true }));
          }, value);
          assert.equal(await input.getAttribute("data-state"), state);
          if (fullCycle || state === "off" || state === "normal") {
            const lifecycle = await page.evaluate(() => window.__cssearthTest.scene().lifecycle);
            if (lifecycle === "paused") await paused(`${label}; speed ${state}`);
            else if (state === "off") await stationary(`${label}; speed off`);
            else await running(`${label}; speed ${state}`);
          }
        }
      }
      async function assertSpeedDisabled(label: string) {
        if (!profile.objectControls.settings?.controls.some(({ name }) => name === "speed")) return;
        assert.equal(await page.locator('input[name="speed"][type="range"]').isDisabled(), true,
          `${object.id}: ${label} must disable Speed`);
      }
      async function sample(label: string) {
        const state = await page.evaluate(() => ({
          lifecycle: window.__cssearthTest.scene().lifecycle,
          playback: window.__cssearthTest.scene().playback,
          requested: window.__cssearthTest.input(".planet-motion-setting").checked,
          playing: document.documentElement.dataset.playing,
          speed: document.querySelector<HTMLInputElement>('input[name="speed"][type="range"]')?.dataset.state ?? null,
          animations: window.__cssearthTest.element(".planet-stage")
            .getAnimations({ subtree: true }).map((animation) => ({
              state: animation.playState, pending: animation.pending,
              time: animation.currentTime === null ? null : window.__cssearthTest.number(animation.currentTime, "animation clock"), rate: animation.playbackRate,
            })),
        }));
        record.samples.push({ label, ...state });
        return state;
      }
      async function paused(label: string) {
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
      async function stationary(label: string) {
        await page.waitForFunction(() => window.__cssearthTest.element(".planet-stage")
          .getAnimations({ subtree: true }).every((animation) => !animation.pending));
        const before = await sample(label);
        await page.waitForTimeout(140);
        const after = await sample(`${label}: settled`);
        assert.equal(after.lifecycle, "mounted", `${object.id}: ${label}: router remains mounted`);
        assert.ok(after.animations.length > 0, `${object.id}: observable animations`);
        assert.equal(after.animations.length, before.animations.length);
        assert.ok(after.animations.every(({ rate, state }) => rate === 0 || state === "paused"),
          `${object.id}: ${label}: zero-rate animation state`);
        after.animations.forEach(({ time }, index) => assert.ok(
          Math.abs((time ?? 0) - (before.animations[index].time ?? 0)) < 0.1,
          `${object.id}: ${label}: no continued clock advancement`));
      }
      async function running(label: string) {
        const timeoutMilliseconds = 5_000;
        const timing: PlaybackTiming = { label, timeoutMilliseconds };
        record.playbackWaits.push(timing);
        const readinessStarted = Date.now();
        // Media-query delivery and Animation.play() are asynchronous. Start the
        // observation window only after policy permits playback and a native
        // animation has finished its pending play task, not at emulateMedia().
        try {
          await page.waitForFunction(() => {
            const app = window.__cssEarth;
            return app?.playback.motionRequested && app.playback.allowed &&
              app.lifecycle === "mounted" &&
              window.__cssearthTest.input(".planet-motion-setting").checked &&
              document.documentElement.dataset.playing === "true" &&
              window.__cssearthTest.element(".planet-stage")
                .getAnimations({ subtree: true }).some((animation) =>
                  animation.playState === "running" && !animation.pending &&
                  typeof animation.currentTime === "number" && Number.isFinite(animation.currentTime));
          }, null, { polling: "raf", timeout: timeoutMilliseconds });
        } catch (error) {
          await sample(`${label}: playback did not start`);
          throw error;
        } finally {
          timing.readinessWaitMilliseconds = Date.now() - readinessStarted;
        }
        const before = await sample(label);
        const observationStarted = Date.now();
        await page.waitForTimeout(140);
        const advancementStarted = Date.now();
        try {
          // RAF polling bounds first-frame scheduling delays but cannot pass
          // merely because attributes say "running": a real clock must advance.
          await page.waitForFunction((baseline) => {
            const app = window.__cssEarth;
            const animations = window.__cssearthTest.element(".planet-stage")
              .getAnimations({ subtree: true });
            return app?.playback.motionRequested && app.playback.allowed &&
              app.lifecycle === "mounted" &&
              document.documentElement.dataset.playing === "true" &&
              animations.length === baseline.length &&
              animations.some((animation, index) =>
                animation.playState === "running" && !animation.pending &&
                typeof animation.currentTime === "number" && Number.isFinite(animation.currentTime) &&
                typeof baseline[index].time === "number" &&
                animation.currentTime > window.__cssearthTest.number(baseline[index].time, "baseline animation clock"));
          }, before.animations, { polling: "raf", timeout: timeoutMilliseconds });
        } catch (error) {
          await sample(`${label}: clock did not advance`);
          throw error;
        } finally {
          timing.advancementWaitMilliseconds = Date.now() - advancementStarted;
          timing.observationMilliseconds = Date.now() - observationStarted;
        }
        const after = await sample(`${label}: advancing`);
        assert.equal(after.lifecycle, "mounted", `${object.id}: ${label}: router`);
        assert.equal(after.playing, "true", `${object.id}: ${label}: publication`);
        assert.equal(after.requested, true, `${object.id}: ${label}: Motion intent`);
        assert.equal(after.playback.allowed, true, `${object.id}: ${label}: policy`);
        assert.equal(after.animations.length, before.animations.length);
        assert.ok(after.animations.some(({ state, pending, time }, index) =>
          state === "running" && !pending && typeof time === "number" && Number.isFinite(time) &&
          Number.isFinite(before.animations[index].time) &&
          time > (before.animations[index].time ?? Infinity)),
        `${object.id}: ${label}: actual clock advances`);
      }
    }
  }
} catch (error) {
  report.error = error instanceof Error ? error.stack ?? error.message : String(error);
  process.exitCode = 1;
} finally {
  await browser.close();
  await writeFile(resolve(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
}
console.log(JSON.stringify({ output, cases: report.cases.length, error: report.error ?? null }));
