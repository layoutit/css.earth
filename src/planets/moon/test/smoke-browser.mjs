import assert from "node:assert/strict";
import { chromium } from "playwright";
import { PNG } from "pngjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
});

try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const problems = [];
  const externalRequests = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      problems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== new URL(baseUrl).origin) {
      externalRequests.push(request.url());
    }
  });

  const response = await page.goto(new URL("/moon/", baseUrl).href, {
    waitUntil: "networkidle",
  });
  assert.equal(response?.status(), 200);
  await page.waitForFunction(() =>
    window.__cssEarth?.ready === true &&
    window.__moon?.ready === true &&
    document.documentElement.dataset.ready === "true");

  const baseline = await page.evaluate(() => ({
    title: document.title,
    mountedObjectCount: window.__cssEarth.mountedObjectCount,
    activeObjectId: window.__cssEarth.activeObjectId,
    stageCount: document.querySelectorAll(".planet-stage").length,
    cameraCount: document.querySelectorAll(".polycss-camera").length,
    bodyLeafCount: document.querySelectorAll(".moon-body > s").length,
    materialLeafCount: document.querySelectorAll(".moon-material").length,
    skyboxFaceCount: document.querySelectorAll(".planet-cubic-sky-face").length,
    directionalSunCount: document.querySelectorAll(".moon-directional-sun").length,
    lensControlCount: document.querySelectorAll('button[name="lens"]').length,
    earthMoonNodeCount: document.querySelectorAll('[class*="earth-moon"]').length,
    canvasCount: document.querySelectorAll("canvas").length,
    sceneSvgCount: document.querySelectorAll(".planet-stage svg").length,
    stable: window.__moon.assertStableDomIdentity(),
    density: window.__moon.renderStats.textureStats.selectedPreparedDensity,
    lens: window.__moon.lenses.state(),
  }));
  assert.deepEqual(baseline, {
    title: "Moon - Powered by PolyCSS",
    mountedObjectCount: 1,
    activeObjectId: "moon",
    stageCount: 1,
    cameraCount: 1,
    bodyLeafCount: 452,
    materialLeafCount: 1,
    skyboxFaceCount: 6,
    directionalSunCount: 1,
    lensControlCount: 3,
    earthMoonNodeCount: 0,
    canvasCount: 0,
    sceneSvgCount: 0,
    stable: true,
    density: 2,
    lens: { id: "surface", ready: true },
  });

  await page.evaluate(() => window.__moon.pause());
  await waitForPaint(page);
  const surface = await page.locator(".example-stage").screenshot();
  await page.evaluate(() => window.__moon.lenses.select("topography"));
  await waitForPaint(page);
  const topography = await page.locator(".example-stage").screenshot();
  await page.evaluate(() => window.__moon.lenses.select("crust"));
  await waitForPaint(page);
  const crust = await page.locator(".example-stage").screenshot();
  const surfaceToTopography = visiblePixelDelta(surface, topography);
  const topographyToCrust = visiblePixelDelta(topography, crust);
  assert.ok(surfaceToTopography.changedPixels > 20_000,
    JSON.stringify(surfaceToTopography));
  assert.ok(topographyToCrust.changedPixels > 20_000,
    JSON.stringify(topographyToCrust));
  assert.equal(await page.locator(".planet-stage").getAttribute("data-lens"),
    "crust");
  assert.equal(await page.locator('button[name="lens"][aria-pressed="true"]')
    .getAttribute("value"), "crust");
  assert.equal(await page.evaluate(() => window.__moon.assertStableDomIdentity()),
    true);

  assert.deepEqual(externalRequests, []);
  assert.deepEqual(problems, []);
  console.log(JSON.stringify({
    ok: true,
    route: "/moon/",
    retainedNodes: await page.locator(".planet-stage").evaluate((stage) =>
      stage.querySelectorAll("*").length),
    externalRequests: 0,
    browserProblems: 0,
    surfaceToTopography,
    topographyToCrust,
  }));
} finally {
  await browser.close();
}

async function waitForPaint(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() =>
    requestAnimationFrame(resolve))));
}

function visiblePixelDelta(leftBytes, rightBytes) {
  const left = PNG.sync.read(leftBytes);
  const right = PNG.sync.read(rightBytes);
  assert.equal(left.width, right.width);
  assert.equal(left.height, right.height);
  let changedPixels = 0;
  let channelDelta = 0;
  for (let offset = 0; offset < left.data.length; offset += 4) {
    const delta = Math.abs(left.data[offset] - right.data[offset]) +
      Math.abs(left.data[offset + 1] - right.data[offset + 1]) +
      Math.abs(left.data[offset + 2] - right.data[offset + 2]);
    if (delta >= 12) changedPixels += 1;
    channelDelta += delta;
  }
  return Object.freeze({
    changedPixels,
    changedPercent: Number((changedPixels /
      (left.width * left.height) * 100).toFixed(3)),
    meanAbsoluteChannelDelta: Number((channelDelta /
      (left.width * left.height * 3)).toFixed(3)),
  });
}
