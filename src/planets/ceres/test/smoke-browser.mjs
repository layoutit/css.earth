import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { PNG } from "pngjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const output = "output/playwright/ceres";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome" });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const problems = [];
  page.on("pageerror", error => problems.push(error.message));
  page.on("response", response => { if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`); });
  await page.goto(new URL("/ceres/", baseUrl).href, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__ceres?.ready === true);
  await page.evaluate(() => {
    const motion = document.querySelector('input[name="motion"]');
    if (motion.checked) motion.click();
  });
  assert.deepEqual(await page.evaluate(() => ({
    id: window.__cssEarth.activeObjectId, mounted: window.__cssEarth.mountedObjectCount,
    leaves: document.querySelectorAll(".ceres-body > s").length,
    forbidden: document.querySelectorAll(".planet-stage canvas, .planet-stage svg").length,
    addressed: [...document.querySelectorAll(".ceres-body > s")].some(leaf => getComputedStyle(leaf).backgroundPosition !== "0% 0%"),
  })), { id: "ceres", mounted: 1, leaves: 452, forbidden: 0, addressed: true });
  const paint = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await paint();
  const normal = PNG.sync.read(await page.screenshot({ path: `${output}/normal.png` }));
  await page.locator('button[name="lens"][value="enhanced"]').click();
  await page.waitForFunction(() => window.__ceres.lenses.state().id === "enhanced");
  await paint();
  const enhanced = PNG.sync.read(await page.screenshot({ path: `${output}/enhanced.png` }));
  let changed = 0;
  // Count the body region, excluding the sidebar and navigation labels.
  for (let y = 300; y < 1450; y++) for (let x = 1100; x < 2100; x++) {
    const i = (y * normal.width + x) * 4;
    if (Math.abs(normal.data[i] - enhanced.data[i]) + Math.abs(normal.data[i + 1] - enhanced.data[i + 1]) +
        Math.abs(normal.data[i + 2] - enhanced.data[i + 2]) > 30) changed++;
  }
  assert.ok(changed > 50_000, `Lens must change the painted body: ${changed} pixels`);
  await page.evaluate(() => window.__ceres.camera.setState({ zoom: window.__ceres.camera.stats().minimumZoom }));
  await paint();
  const wide = await page.evaluate(() => ({ stage: window.__ceres.camera.state().levelOfDetail.stage,
    bodies: window.__ceres.camera.stats().planetarySystem.bodyCount,
    orbits: window.__ceres.camera.stats().systemOrbitPieceCount,
    stable: window.__ceres.assertStableDomIdentity() }));
  assert.equal(wide.stage, "marker");
  assert.equal(wide.bodies, 12);
  assert.ok(wide.orbits > 0);
  assert.equal(wide.stable, true);
  await page.screenshot({ path: `${output}/system.png` });
  assert.deepEqual(problems, []);
  console.log(JSON.stringify({ ok: true, changedBodyPixels: changed, wide, screenshots: output }));
} finally { await browser.close(); }
