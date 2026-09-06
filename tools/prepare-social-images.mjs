import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { OBJECTS } from "../site/objects.mjs";
import { previewSite } from "./preview.mjs";
import { setupObjectIds } from "./runtime-assets.mjs";

// Plain captures of the built CSS scenes: no added artwork, text, or branding.
// Only the shell visibility and its reserved horizontal space are overridden.
const ids = setupObjectIds(process.argv.slice(2));
await mkdir("public/social", { recursive: true });
const server = await previewSite({ port: 4266 });
let browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const object of OBJECTS.filter(({ id }) => ids.includes(id))) {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1,
      reducedMotion: "reduce",
    });
    const problems = [];
    page.on("pageerror", (error) => problems.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`);
    });
    const response = await page.goto(`http://127.0.0.1:4266${object.route}`, {
      waitUntil: "networkidle", timeout: 60000,
    });
    assert.equal(response.status(), 200);
    await page.waitForFunction(() => document.documentElement.dataset.ready === "true", null, { timeout: 60000 });
    assert.equal(await page.locator(".polycss-camera").count(), 1);
    await page.addStyleTag({ content: `
      body { --explorer-scene-offset: 0px !important; }
      body > :not(.planet-stage) { display: none !important; }
    ` });
    await page.evaluate(() => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }));
    assert.deepEqual(problems, [], `${object.id} must load without errors`);
    await page.screenshot({ path: resolve(`public/social/${object.id}.jpg`),
      type: "jpeg", quality: 90, animations: "disabled" });
    console.log(`Captured ${object.id}: 1200 × 630`);
    await page.close();
  }
} finally {
  await browser?.close();
  await server.close();
}
