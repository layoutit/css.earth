import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import { objectControls } from "../site/control-content.mjs";

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
  let previous = PNG.sync.read(await page.screenshot({ path: `${output}/normal.png` }));
  const changes = {};
  // Visit every declared lens, then restore the initial photographic material.
  for (const lens of [...objectControls.lenses.controls.slice(1), objectControls.lenses.controls[0]]) {
    await page.locator(`button[name="lens"][value="${lens.id}"]`).click();
    await page.waitForFunction(id => window.__ceres.lenses.state().id === id, lens.id);
    await paint();
    if (lens.legend) await page.locator(`[data-lens-legend="${lens.id}"]`).waitFor({ state: "visible" });
    const overlay = await page.locator('.ceres-material').evaluate(element => element.style.backgroundImage);
    assert.equal(overlay === "none", Boolean(lens.legend), `${lens.id}: scientific maps preserve legend colors; photographs restore lighting`);
    assert.equal(await page.evaluate(() => window.__ceres.assertStableDomIdentity()), true);
    const current = PNG.sync.read(await page.screenshot({ path: `${output}/${lens.id}.png` }));
    let changed = 0;
    // Count the body region, excluding the sidebar and navigation labels.
    for (let y = 300; y < 1450; y++) for (let x = 1100; x < 2100; x++) {
      const i = (y * previous.width + x) * 4;
      if (Math.abs(previous.data[i] - current.data[i]) + Math.abs(previous.data[i + 1] - current.data[i + 1]) +
          Math.abs(previous.data[i + 2] - current.data[i + 2]) > 30) changed++;
    }
    assert.ok(changed > 50_000, `${lens.id} must change the painted body: ${changed} pixels`);
    changes[lens.id] = changed;
    previous = current;
  }
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
  console.log(JSON.stringify({ ok: true, changedBodyPixels: changes, wide, screenshots: output }));
} finally { await browser.close(); }
