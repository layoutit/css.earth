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
    hasTouch: true,
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

  const response = await page.goto(new URL("/sun/", baseUrl).href, {
    waitUntil: "networkidle",
  });
  assert.equal(response?.status(), 200);
  await page.waitForFunction(() =>
    window.__cssEarth?.ready === true &&
    window.__sun?.ready === true &&
    document.documentElement.dataset.ready === "true");

  const baseline = await page.evaluate(() => ({
    title: document.title,
    mountedObjectCount: window.__cssEarth.mountedObjectCount,
    activeObjectId: window.__cssEarth.activeObjectId,
    stageCount: document.querySelectorAll(".planet-stage").length,
    cameraCount: document.querySelectorAll(".polycss-camera").length,
    bodyLeafCount: document.querySelectorAll(".sun-body > s").length,
    skyboxFaceCount:
      document.querySelectorAll(".planet-cubic-sky-face").length,
    canvasCount: document.querySelectorAll("canvas").length,
    sceneSvgCount: document.querySelectorAll(".planet-stage svg").length,
    stable: window.__sun.assertStableDomIdentity(),
    density: window.__sun.renderStats.textureStats.selectedPreparedDensity,
    bodyOpacity: getComputedStyle(document.querySelector(".sun-body")).opacity,
    materialCompositeCount: document.querySelectorAll(".sun-material-composite").length,
    limbCount: document.querySelectorAll(".sun-limb-layer").length,
    sunCubemapBakeCount: window.__sun.dom.retainedSunCubemapBakeCount,
  }));
  assert.deepEqual(baseline, {
    title: "Sun - Powered by PolyCSS",
    mountedObjectCount: 1,
    activeObjectId: "sun",
    stageCount: 1,
    cameraCount: 1,
    bodyLeafCount: 514,
    skyboxFaceCount: 6,
    canvasCount: 0,
    sceneSvgCount: 0,
    stable: true,
    density: 2,
    bodyOpacity: "1",
    materialCompositeCount: 0,
    limbCount: 1,
    sunCubemapBakeCount: 0,
  });

  const cameraContract = await page.evaluate(() => ({
    ...window.__sun.camera.state(),
    ...window.__sun.camera.stats(),
    sky: window.__sun.sky.state(),
  }));
  assert.equal(cameraContract.cameraModel, "accumulated-matrix3d");
  assert.equal(cameraContract.pitchBounded, false);
  assert.equal(cameraContract.yawBounded, false);
  assert.equal(cameraContract.sky.sunViewDirection, null);
  assert.equal(cameraContract.sky.sunVisible, false);

  await page.evaluate(() => window.__sun.camera.setState({
    controlPitch: 157,
    controlYaw: 412,
  }));
  assert.deepEqual(
    await page.evaluate(() => window.__sun.camera.state()),
    {
      pitch: 157,
      controlPitch: 157,
      controlYaw: 412,
      zoom: cameraContract.zoom,
    },
  );

  for (const id of ["magnetic", "chromosphere", "corona", "photosphere"]) {
    await page.evaluate((lensId) => window.__sun.lenses.select(lensId), id);
    assert.equal(await page.locator(".planet-stage").getAttribute("data-lens"), id);
    assert.equal(await page.evaluate(() => window.__sun.assertStableDomIdentity()), true);
  }

  await page.evaluate(() => {
    window.__sun.pause();
    const animation = document.querySelector(".sun-body").getAnimations()[0];
    animation.pause();
    animation.currentTime = 0;
    window.__sun.camera.setState({ controlPitch: 0, controlYaw: -105 });
  });
  await waitForPaint(page);
  const pitchZero = await page.locator(".example-stage").screenshot();
  await page.evaluate(() => window.__sun.camera.setState({ controlPitch: 65 }));
  await waitForPaint(page);
  const pitchSixtyFive = await page.locator(".example-stage").screenshot();
  const pitchDelta = visiblePixelDelta(pitchZero, pitchSixtyFive);
  assert.ok(pitchDelta.changedPixels > 20_000, JSON.stringify(pitchDelta));

  await page.evaluate(() => {
    window.__sun.camera.setState({ controlPitch: 49 });
    const animation = document.querySelector(".sun-body").getAnimations()[0];
    animation.currentTime = 0;
  });
  await waitForPaint(page);
  const rotationZero = await page.locator(".example-stage").screenshot();
  await page.evaluate(() => {
    document.querySelector(".sun-body").getAnimations()[0].currentTime = 36_000;
  });
  await waitForPaint(page);
  const rotationHalf = await page.locator(".example-stage").screenshot();
  const rotationDelta = visiblePixelDelta(rotationZero, rotationHalf);
  assert.ok(rotationDelta.changedPixels > 20_000, JSON.stringify(rotationDelta));

  assert.deepEqual(externalRequests, []);
  assert.deepEqual(problems, []);
  console.log(JSON.stringify({
    ok: true,
    route: "/sun/",
    retainedNodes: await page.locator(".planet-stage").evaluate((stage) =>
      stage.querySelectorAll("*").length),
    externalRequests: 0,
    browserProblems: 0,
    pitchDelta,
    rotationDelta,
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
    changedPercent: Number((changedPixels / (left.width * left.height) * 100).toFixed(3)),
    meanAbsoluteChannelDelta: Number((
      channelDelta / (left.width * left.height * 3)
    ).toFixed(3)),
  });
}
