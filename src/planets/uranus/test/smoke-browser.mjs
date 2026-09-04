import assert from "node:assert/strict";
import { chromium } from "playwright";
import sharp from "sharp";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const problems = [];
  const external = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) problems.push(message.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== new URL(baseUrl).origin) external.push(request.url());
  });
  const response = await page.goto(new URL("/uranus/", baseUrl).href, { waitUntil: "networkidle" });
  assert.equal(response?.status(), 200);
  await page.waitForFunction(() => window.__cssEarth?.ready && window.__uranus?.ready);
  const state = await page.evaluate(() => ({
    title: document.title,
    active: window.__cssEarth.activeObjectId,
    mounted: window.__cssEarth.mountedObjectCount,
    cameraCount: document.querySelectorAll(".polycss-camera").length,
    materialRootCount: document.querySelectorAll(".uranus-material-composite").length,
    sceneRootCount: document.querySelectorAll(".polycss-scene").length,
    canvasCount: document.querySelectorAll("canvas").length,
    sceneSvgCount: document.querySelectorAll(".planet-stage svg").length,
    ringCount: document.querySelectorAll(".uranus-rings").length,
    surfaceFaceCount: document.querySelectorAll(".uranus-body > s").length,
    ringShadowPlaneCount: document.querySelectorAll(".uranus-ring-shadow > s").length,
    fixedMaterialCount: document.querySelectorAll(".uranus-fixed-material > s").length,
    stable: window.__uranus.assertStableDomIdentity(),
  }));
  assert.deepEqual(state, {
    title: "Uranus - Powered by PolyCSS",
    active: "uranus",
    mounted: 1,
    cameraCount: 1,
    materialRootCount: 0,
    sceneRootCount: 1,
    canvasCount: 0,
    sceneSvgCount: 0,
    ringCount: 1,
    surfaceFaceCount: 1_060,
    ringShadowPlaneCount: 1,
    fixedMaterialCount: 1,
    stable: true,
  });
  await page.evaluate(() => window.__uranus.pause());
  const shadowControl = page.locator('input[name="shadows"]');
  await shadowControl.evaluate((input) => {
    input.checked = false;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  assert.equal(await page.locator(".uranus-ring-shadow").evaluate(
    (leaf) => getComputedStyle(leaf).visibility,
  ), "hidden");
  await shadowControl.evaluate((input) => {
    input.checked = true;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  assert.equal(await page.locator(".uranus-ring-shadow").evaluate(
    (leaf) => getComputedStyle(leaf).visibility,
  ), "visible");
  await page.evaluate(() => window.__uranus.camera.setState({ zoom: 1 }));
  await page.locator('button[name="lens"][value="methane"]').click();
  await page.waitForFunction(() =>
    document.querySelector(".planet-stage")?.dataset.lens === "methane");
  assert.equal(await page.locator(".planet-stage").getAttribute("data-lens"), "methane");
  assert.deepEqual(problems, []);
  assert.deepEqual(external, []);
  await assertCompleteRingVisibility(browser, baseUrl);
  console.log(JSON.stringify({ ok: true, route: "/uranus/", ...state }));
} finally {
  await browser.close();
}

async function assertCompleteRingVisibility(browser, baseUrl) {
  for (const density of [1, 2]) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: density,
    });
    try {
      const page = await context.newPage();
      await page.goto(new URL("/uranus/", baseUrl).href, {
        waitUntil: "networkidle",
      });
      await page.waitForFunction(() =>
        window.__cssEarth?.ready && window.__uranus?.ready);
      const geometry = await page.evaluate(() => {
        window.__uranus.pause();
        const rect = document.querySelector(
          ".uranus-fixed-material-leaf",
        ).getBoundingClientRect();
        return {
          centerX: rect.left + rect.width / 2,
          centerY: rect.top + rect.height / 2,
          radiusX: rect.width / 2,
          radiusY: rect.height / 2,
        };
      });
      await page.evaluate(() => new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const visible = await page.screenshot();
      await page.locator(".uranus-ring-plane").evaluate((ring) => {
        ring.style.visibility = "hidden";
      });
      const hidden = await page.screenshot();
      const [visibleRaster, hiddenRaster] = await Promise.all(
        [visible, hidden].map((buffer) => sharp(buffer).removeAlpha().raw()
          .toBuffer({ resolveWithObject: true })),
      );
      assert.deepEqual(visibleRaster.info, hiddenRaster.info);
      const centerX = geometry.centerX * density;
      const centerY = geometry.centerY * density;
      const radiusX = geometry.radiusX * density;
      const radiusY = geometry.radiusY * density;
      let upperPixels = 0;
      let lowerPixels = 0;
      for (let y = 0; y < visibleRaster.info.height; y += 1) {
        for (let x = 0; x < visibleRaster.info.width; x += 1) {
          const normalizedRadiusSquared =
            ((x - centerX) / radiusX) ** 2 +
            ((y - centerY) / radiusY) ** 2;
          if (normalizedRadiusSquared <= 1.05) continue;
          const offset = (y * visibleRaster.info.width + x) *
            visibleRaster.info.channels;
          const delta = Math.max(...[0, 1, 2].map((channel) => Math.abs(
            visibleRaster.data[offset + channel] -
            hiddenRaster.data[offset + channel],
          )));
          if (delta < 5) continue;
          if (y < centerY) upperPixels += 1;
          else lowerPixels += 1;
        }
      }
      assert.ok(upperPixels >= 100 * density,
        `Uranus upper ring arc is incomplete at DPR ${density}: ${upperPixels}.`);
      assert.ok(lowerPixels >= 100 * density,
        `Uranus lower ring arc is incomplete at DPR ${density}: ${lowerPixels}.`);
    } finally {
      await context.close();
    }
  }
}
