// Compare an explicitly pinned earlier atlas with the current prepared scene.
// Reference bytes are injected only into an isolated browser context.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, basename } from "node:path";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const base = process.argv[2], reference = resolve(process.argv[3]);
const output = resolve(`output/playwright/earth-surface-comparison-${Date.now()}`);
await mkdir(output, { recursive: true });
const manifest = JSON.parse(await readFile(resolve(reference, "manifest.json")));
const pinned = new Map();
for (const item of [...manifest.assets, ...manifest.modules]) {
  const bytes = await readFile(resolve(reference, item.name ?? basename(item.url)));
  assert.equal(bytes.length, item.bytes);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), item.sha256);
  pinned.set(item.url ?? `/src/planets/earth/runtime/${item.name}`, bytes);
}
const report = { base, referenceCommit: manifest.commit, output, cases: [] };
const cases = [
  ["normal-globe", "normal", 50, 128, 1],
  ["normal-close", "normal", 30, 52, 8],
  ["topography", "topography", -40, 310, 1],
  ["night-lights", "night-lights", 20, 200, 1],
  ["cross-section", "cross-section", 50, 128, 1],
];
const browser = await chromium.launch({ channel: "chrome", headless: true });
report.browser = browser.version();
try {
  for (const dpr of [1, 2]) {
    for (const version of ["reference", "current"]) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: dpr });
      const served = new Set(), errors = [];
      if (version === "reference") await context.route("**/*", route => {
        const path = new URL(route.request().url()).pathname, bytes = pinned.get(path);
        if (!bytes) return route.continue();
        served.add(path);
        return route.fulfill({ body: bytes, contentType: path.endsWith(".mjs") ? "text/javascript" : "image/webp" });
      });
      try {
        const page = await context.newPage();
        page.on("pageerror", error => errors.push(error.message));
        await page.goto(`${base}/earth/`);
        await page.waitForFunction(() => window.__earth?.ready && window.__cssEarth?.ready);
        await page.evaluate(() => {
          const motion = document.querySelector('input[name="motion"]'); if (motion.checked) motion.click();
        });
        for (const [name, lens, controlPitch, controlYaw, zoom] of cases) {
          await page.evaluate(lens => window.__earth.lenses.select(lens), lens);
          await page.evaluate(({ controlPitch, controlYaw, zoom }) => {
            for (const animation of document.getAnimations()) { animation.pause(); animation.currentTime = 0; }
            window.__earth.camera.setState({ controlPitch, controlYaw, zoom });
          }, { controlPitch, controlYaw, zoom });
          await page.waitForLoadState("networkidle");
          await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
          const state = await page.evaluate(() => ({ camera: window.__earth.camera.state(), stable: window.__earth.assertStableDomIdentity() }));
          assert.ok(state.stable);
          const path = resolve(output, `dpr${dpr}-${name}-${version}.png`);
          await page.screenshot({ path });
          if (version === "reference") report.cases.push({ dpr, name, reference: path, referenceState: state });
          else {
            const item = report.cases.find(item => item.dpr === dpr && item.name === name);
            item.current = path; item.currentState = state;
            assert.deepEqual(item.currentState, item.referenceState);
            const a = PNG.sync.read(await readFile(item.reference)), b = PNG.sync.read(await readFile(path));
            const diff = new PNG({ width: a.width, height: a.height });
            item.differentPixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0, includeAA: true });
            item.pixels = a.width * a.height;
            item.maxChannelDelta = 0;
            for (let index = 0; index < a.data.length; index++) item.maxChannelDelta = Math.max(item.maxChannelDelta, Math.abs(a.data[index] - b.data[index]));
            item.diff = resolve(output, `dpr${dpr}-${name}-diff.png`);
            await writeFile(item.diff, PNG.sync.write(diff));
            // Exact source RGBA is checked during preparation. Browser image
            // sampling may round a channel by one; retain the full diff.
            assert.ok(item.maxChannelDelta <= 1 && item.differentPixels / item.pixels <= 0.0001,
              `${name} at DPR ${dpr} changed beyond the measured browser rounding bound`);
            console.log(JSON.stringify({ dpr, name, differentPixels: item.differentPixels, pixels: item.pixels }));
          }
        }
        if (version === "reference") for (const path of pinned.keys()) {
          // Scene/lens staging modules are compiled into preparedPresentation;
          // the runtime imports only that final payload.
          if (path.endsWith("preparedScene.mjs") || path.endsWith("preparedLenses.mjs")) continue;
          if (path.includes("earth-interior-outer") && !path.includes("@2x")) continue;
          assert.ok(served.has(path), `canonical reference bytes did not reach the browser: ${path}`);
        }
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
  }
} finally {
  await browser.close();
  await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(output);
}
