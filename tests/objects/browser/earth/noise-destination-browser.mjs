import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = (process.argv.slice(2).find(argument => /^https?:\/\//u.test(argument)) ?? "http://127.0.0.1:4210").replace(/\/$/u, "");
const output = new URL(`../../../../output/playwright/noise-destination-${Date.now()}/`, import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = { base, browser: browser.version(), output: output.pathname, cases: [] };
try {
  for (const playing of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
    const page = await context.newPage(), errors = [];
    page.on("pageerror", error => errors.push(error.message));
    try {
      await page.goto(`${base}/earth/`);
      await page.waitForFunction(() => window.__earth?.ready && window.__cssEarth?.ready);
      await page.locator(".planet-settings-action").click();
      await page.locator(".planet-motion-setting-control").click();
      await page.waitForTimeout(1500);
      if (!playing) await page.locator(".planet-motion-setting-control").click();
      await page.locator(".explorer-rail-explore").click();
      const prior = await page.evaluate(() => ({
        times: document.getAnimations().map(animation => animation.currentTime),
        motion: document.querySelector('input[name="motion"]').checked,
      }));
      assert.equal(prior.motion, playing);
      assert.ok(prior.times.every(time => time > 1000), "Exercise a rotated globe, not the initial pose");
      if (!await page.locator(".planet-lenses").evaluate(panel => panel.open)) {
        await page.locator(".planet-lenses > summary").click();
      }
      await page.locator('button[name="lens"][value="buenos-aires-noise"]').click();
      await page.waitForFunction(() => !window.__earth.camera.stats().dragInertia.destinationFlyTo.active);
      await page.waitForFunction(() => {
        const state = window.__earth.runtime.pages().noise;
        return state.desired.length === 16 && !state.activeLoads &&
          state.desired.every(key => state.retained.some(page => page.key === key && page.published));
      }, null, { timeout: 30000 });
      const after = await page.evaluate(() => ({
        motion: document.querySelector('input[name="motion"]').checked,
        times: document.getAnimations().map(animation => animation.currentTime),
        animationStates: document.getAnimations().map(animation => animation.playState),
        camera: window.__earth.camera.state(), stable: window.__earth.assertStableDomIdentity(),
        noise: window.__earth.runtime.pages().noise,
      }));
      assert.equal(after.motion, false, "The object request updates shared playback intent and its control");
      assert.ok(after.times.every(time => time === 0));
      assert.ok(after.animationStates.every(state => state === "paused"));
      assert.equal(after.stable, true);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: new URL(`${playing ? "playing" : "paused"}-arrival.png`, output).pathname });
      report.cases.push({ playing, prior, after, errors });
    } finally { await context.close(); }
  }
  report.passed = true;
} finally {
  await browser.close();
  await writeFile(new URL("report.json", output), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ output: output.pathname, passed: report.passed ?? false }));
}
