#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const mode = process.argv[2];
assert.ok(["baseline", "candidate"].includes(mode));
const baseUrl = process.argv[3] ?? "http://127.0.0.1:4211";
const root = resolve("output/playwright/object-contract");
await mkdir(root, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const samples = [];
try {
  for (const dpr of [1, 2]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr });
    await page.goto(`${baseUrl}/saturn/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__saturn?.ready && window.__cssEarth?.ready);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Performance.enable");
    await page.evaluate(() => document.querySelector(".planet-motion-setting").click());
    assert.equal(await page.evaluate(() => document.documentElement.dataset.playing), "true");
    for (let trial = 0; trial < 3; trial++) {
      const before = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(({ name, value }) => [name, value]));
      const result = await page.evaluate(async () => {
        const stage = document.querySelector(".planet-stage"), original = [...stage.querySelectorAll("*")];
        const animations = stage.getAnimations({ subtree: true });
        const initialTimes = animations.map((animation) => animation.currentTime);
        const frames = []; let previous = performance.now(); const start = previous;
        await new Promise((resolve) => {
          const frame = (now) => { frames.push(now - previous); previous = now; if (now - start < 2000) requestAnimationFrame(frame); else resolve(); };
          requestAnimationFrame(frame);
        });
        const current = [...stage.querySelectorAll("*")];
        const sorted = frames.slice(1).sort((a, b) => a - b);
        return { nodes: current.length, stable: original.length === current.length && original.every((node, i) => node === current[i]), animations: animations.length, playing: animations.length > 0 && animations.every((animation, i) => animation.playState === "running" && animation.currentTime > initialTimes[i]), frameCount: sorted.length, frameP95Ms: sorted[Math.floor(sorted.length * 0.95)] };
      });
      const after = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(({ name, value }) => [name, value]));
      assert.equal(result.stable, true);
      assert.equal(result.playing, true);
      samples.push({ dpr, trial, ...result, taskDurationMs: (after.TaskDuration - before.TaskDuration) * 1000, layoutCount: after.LayoutCount - before.LayoutCount, recalcStyleCount: after.RecalcStyleCount - before.RecalcStyleCount });
    }
    await page.close();
  }
} finally { await browser.close(); }
const report = { mode, baseUrl, browser: browser.version(), assetManifestSha256: createHash("sha256").update(await readFile("src/planets/saturn/runtime-assets.json")).digest("hex"), qualification: "Matched retained playback and rAF/CDP samples; not compositor frame-drop or power measurement", samples };
if (mode === "candidate") {
  const baseline = JSON.parse(await readFile(resolve(root, "baseline-playback.json")));
  assert.equal(report.browser, baseline.browser);
  assert.equal(report.assetManifestSha256, baseline.assetManifestSha256);
  assert.deepEqual(samples.map(({ nodes, animations }) => [nodes, animations]), baseline.samples.map(({ nodes, animations }) => [nodes, animations]));
}
await writeFile(resolve(root, `${mode}-playback.json`), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
