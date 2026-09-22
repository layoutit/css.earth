import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import sharp from "sharp";
import { SCENE_OBJECTS } from "../../site/objects.mts";
import { previewSite } from "../cli/preview.mts";
import { inventoriedObjectIds } from "../assets/runtime-assets.mts";

// Plain captures of the built CSS scenes: no added artwork, text, or branding.
// Card captures use the shared sidebar background and omit the surrounding sky.
const { values } = parseArgs({ options: {
  card: { type: "boolean", default: false },
  "base-url": { type: "string" },
  object: { type: "string", multiple: true, default: [] },
} });
const ids = inventoriedObjectIds((values.object ?? []).map(id => `--object=${id}`));
const outputDirectory = values.card ? "public/overview" : "public/social";
await mkdir(outputDirectory, { recursive: true });
const server = values["base-url"] ? null : await previewSite({ port: 4266 });
const baseUrl = values["base-url"] ?? "http://127.0.0.1:4266";
let browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const object of SCENE_OBJECTS.filter(({ id }) => ids.includes(id))) {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1,
      reducedMotion: "reduce",
    });
    const problems: string[] = [];
    page.on("pageerror", (error) => problems.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`);
    });
    const response = await page.goto(new URL(object.route, baseUrl).href, {
      waitUntil: "networkidle", timeout: 60000,
    });
    assert.ok(response, "Scene navigation returned no HTTP response");
    assert.equal(response.status(), 200);
    await page.waitForFunction(() => document.documentElement.dataset.ready === "true", null, { timeout: 60000 });
    assert.equal(await page.locator(".polycss-camera").count(), 1);
    const cardBackground = values.card ? await page.locator(".planet-card").first()
      .evaluate(element => getComputedStyle(element).backgroundColor) : null;
    if (values.card) assert.match(cardBackground ?? "", /^rgb\(\d+, \d+, \d+\)$/, "Card background must be opaque");
    await page.addStyleTag({ content: `
      body { --explorer-scene-offset: 0px !important; }
      body > :not(.planet-stage, .planet-viewport) { display: none !important; }
      ${values.card ? `
        html, body, .planet-viewport, .planet-stage { background: ${cardBackground} !important; }
        .planet-stage > :not(.planet-render-root) { display: none !important; }
        .prepared-world-context, .catalogue-moon-labels { display: none !important; }
        .space-minimap { display: none !important; }
      ` : ""}
    ` });
    await page.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
    assert.deepEqual(problems, [], `${object.id} must load without errors`);
    if (values.card) {
      // The card displays this capture at 1/4 scale, shifted 40px right and
      // cropped to 134px high. Fit overflow from the actual rendered silhouette
      // during preparation; ordinary globes retain their existing size.
      const safe = { left: 8, right: 1032, top: 55, bottom: 575 };
      assert.ok(cardBackground);
      const channels = cardBackground.match(/\d+/g);
      assert.ok(channels);
      const background = channels.map(Number);
      let capture, fitted = false;
      for (let attempt = 0; attempt < 8; attempt++) {
        capture = await page.screenshot({ type: "png", animations: "disabled" });
        const { data, info } = await sharp(capture).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        const bounds = { left: info.width, right: 0, top: info.height, bottom: 0 };
        for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
          const offset = (y * info.width + x) * info.channels;
          if (background.some((value, channel) => Math.abs(data[offset + channel] - value) > 5)) {
            bounds.left = Math.min(bounds.left, x); bounds.right = Math.max(bounds.right, x);
            bounds.top = Math.min(bounds.top, y); bounds.bottom = Math.max(bounds.bottom, y);
          }
        }
        assert.ok(bounds.right > bounds.left, `${object.id}: empty portrait`);
        if (bounds.left >= safe.left && bounds.right <= safe.right && bounds.top >= safe.top && bounds.bottom <= safe.bottom) {
          fitted = true; break;
        }
        const scale = Math.min(.9, (600 - safe.left) / (600 - bounds.left),
          (safe.right - 600) / (bounds.right - 600), (315 - safe.top) / (315 - bounds.top),
          (safe.bottom - 315) / (bounds.bottom - 315)) * .97;
        await page.evaluate(({ id, scale }) => {
          const debug: unknown = Reflect.get(window, `__${id}`);
          const camera: unknown = debug && typeof debug === 'object' && 'camera' in debug ? debug.camera : null;
          if (!camera || typeof camera !== 'object' || !('state' in camera) || typeof camera.state !== 'function' || !('setState' in camera) || typeof camera.setState !== 'function') throw new Error('Portrait fitting requires a development or performance server.');
          const state: unknown = camera.state();
          if (!state || typeof state !== 'object' || !('zoom' in state) || typeof state.zoom !== 'number') throw new Error('Portrait camera did not publish a numeric zoom.');
          camera.setState({ zoom: state.zoom * scale });
        }, { id: object.id, scale });
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      }
      assert.ok(fitted, `${object.id}: portrait still exceeds the card crop`);
      assert.ok(capture, "Portrait capture is missing");
      await sharp(capture).webp({ lossless: true }).toFile(resolve(outputDirectory, `${object.id}.webp`));
    } else {
      await page.screenshot({ path: resolve(outputDirectory, `${object.id}.jpg`),
        type: "jpeg", quality: 90, animations: "disabled" });
    }
    console.log(`Captured ${object.id}: 1200 × 630${values.card ? ` on ${cardBackground}` : ""}`);
    await page.close();
  }
} finally {
  await browser?.close();
  await server?.close();
}
