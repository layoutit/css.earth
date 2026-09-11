import { required } from "../../../../tools/test-values.mts";
import { createTestPage } from "../../../../site/test/browser-observations.mts";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium, type Page } from "playwright";
import runtimeDefinition from "../../../../src/planets/mercury/prepared/runtime.json" with { type: "json" };

// Registration evidence for the Mercury nomenclature labels: the prepared
// Caloris Planitia anchor must sit on the basin's bright plains in the
// MESSENGER enhanced-colour lens, and the hovered caption and outline must
// show the prepared IAU facts. Screenshots land under the ignored output directory.
const base = (process.argv.slice(2).find(argument => /^https?:\/\//u.test(argument)) ?? "http://127.0.0.1:4210").replace(/\/$/u, "");
const output = new URL(`../../../../output/playwright/mercury-features-${Date.now()}/`, import.meta.url);
await mkdir(output, { recursive: true });
const plan = required(runtimeDefinition.features);
const catalog = JSON.parse(await readFile(new URL("../../../../public/scenes/mercury/mercury-features.json", import.meta.url), "utf8")) as { features: { id: string; name: string; longitudeDeg: number; latitudeDeg: number }[] };
const landmarks = ["Caloris Planitia", "Rembrandt", "Beethoven", "Tolstoj", "Rachmaninoff"].map(name => required(catalog.features.find(feature => feature.name === name)));
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome", headless: true });
const errors: string[] = [];
const report: Record<string, unknown> = { base, plan: plan.catalog, landmarks: [] as unknown[] };
async function labelBox(page: Page, id: string) {
  return page.evaluate(featureId => {
    const label = document.querySelector(`[data-feature-label="${featureId}"]`);
    if (!(label instanceof HTMLElement)) return null;
    const style = getComputedStyle(label), rect = label.getBoundingClientRect();
    const stage = window.__cssearthTest.element(".planet-stage").getBoundingClientRect();
    return { visible: style.visibility !== "hidden" && Number(style.opacity) > .9, x: (rect.left + rect.right) / 2 - (stage.left + stage.width / 2), y: (rect.top + rect.bottom) / 2 - (stage.top + stage.height / 2),
      left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
  }, id);
}
try {
  const page = await createTestPage(browser, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { assert.ok(!request.url().includes("usgs.gov"), "Gazetteer sources must not be requested at runtime"); });
  await page.goto(`${base}/mercury/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__cssEarth?.ready && window.__mercury?.ready, null, { timeout: 60000 });
  await page.waitForFunction(() => { const state = window.__mercury?.runtime.surfaceFeatures(); return state?.loaded === true; }, null, { timeout: 30000 });
  await page.screenshot({ path: new URL("default-view.png", output).pathname });
  assert.equal((await page.evaluate(() => window.__mercury?.runtime.surfaceFeatures()))?.visible, 0, "the overview shows no labels");
  await page.evaluate(zoom => window.__mercury?.camera.setState({ zoom }), runtimeDefinition.camera.maximumZoom);
  await page.waitForFunction(() => { const state = window.__mercury?.runtime.surfaceFeatures(); return state?.zoomGate === true && state.visible > 0; }, null, { timeout: 30000 });
  await page.screenshot({ path: new URL("last-zoom.png", output).pathname });
  assert.equal(await page.evaluate(() => window.__mercury?.selectLens("enhanced")), true);
  await page.waitForFunction(() => window.__mercury?.lens().id === "enhanced" && window.__mercury.lens().ready, null, { timeout: 30000 });
  // Steer the camera over each landmark through the shell minimap (the same navigation a
  // visitor uses), then return to the closest zoom where labels are admitted.
  const minimap = page.locator(".planet-surface-minimap:visible").first();
  for (const landmark of landmarks) {
    let box: Awaited<ReturnType<typeof labelBox>> = null;
    for (const nudge of [0, -0.01, 0.01, -0.02, 0.02]) {
      const map = required(await minimap.boundingBox());
      const u = (((landmark.longitudeDeg - 180) % 360) + 360) % 360 / 360, v = (90 - landmark.latitudeDeg) / 180;
      await page.mouse.click(map.x + u * map.width, map.y + Math.max(0.01, Math.min(0.99, v + nudge)) * map.height);
      await page.waitForTimeout(300);
      await page.evaluate(zoom => window.__mercury?.camera.setState({ zoom }), runtimeDefinition.camera.maximumZoom);
      await page.waitForTimeout(500);
      box = await labelBox(page, landmark.id);
      if (box?.visible && Math.abs(box.x) < 400 && Math.abs(box.y) < 400) break;
    }
    assert.ok(box?.visible, `${landmark.name} label is admitted near the view centre`);
    await page.mouse.move((box.left + box.right) / 2, (box.top + box.bottom) / 2);
    await page.waitForFunction(id => { const tooltip = document.querySelector("[data-feature-tooltip]"); return tooltip instanceof HTMLElement && !tooltip.hidden && tooltip.dataset.featureTooltipFor === id; }, landmark.id, { timeout: 5000 });
    const file = `${landmark.name.toLowerCase().replace(/[^a-z]+/gu, "-")}.png`;
    await page.screenshot({ path: new URL(file, output).pathname });
    const caption = await page.evaluate(() => ({ name: window.__cssearthTest.element("[data-feature-tooltip-name]").textContent, detail: window.__cssearthTest.element("[data-feature-tooltip-detail]").textContent }));
    const outline = await page.evaluate(() => [...document.querySelectorAll("[data-feature-outline-piece]")].filter(piece => getComputedStyle(piece).visibility !== "hidden").length);
    assert.equal(caption.name, landmark.name);
    assert.ok(outline > 0, `${landmark.name} outline is traced`);
    (report.landmarks as unknown[]).push({ ...landmark, screenshot: file, screen: { x: box.x, y: box.y }, caption, outlinePieces: outline });
    await page.mouse.move(4, 4);
  }
  report.stats = await page.evaluate(() => window.__mercury?.runtime.surfaceFeatures());
  assert.deepEqual(errors, []);
  console.log(`MERCURY_FEATURES_PASSED ${landmarks.length} landmark captions captured under ${output.pathname}`);
} finally {
  await writeFile(new URL("report.json", output), JSON.stringify({ ...report, errors }, null, 2));
  await browser.close();
}
