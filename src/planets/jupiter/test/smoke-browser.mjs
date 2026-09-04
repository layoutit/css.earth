import assert from "node:assert/strict";
import { chromium } from "playwright";
import sharp from "sharp";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const deviceScaleFactor = Number(process.argv[3] ?? 1);
assert.ok(deviceScaleFactor === 1 || deviceScaleFactor === 2);
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
});

try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor,
  });
  const browserProblems = [];
  const externalAuthorityRequests = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
      externalAuthorityRequests.push(request.url());
    }
  });
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      browserProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => browserProblems.push(`pageerror: ${error.message}`));

  await loadJupiter(page);
  const baseline = await runtimeState(page);
  assertRuntimeState(baseline);
  await page.evaluate(() => {
    window.__jupiterSmokeRetained = Object.freeze({
      camera: document.querySelector(".polycss-camera"),
      body: document.querySelector(".jupiter-body"),
      rings: document.querySelector(".jupiter-rings"),
      material: document.querySelector(".jupiter-material"),
    });
  });
  await assertVerticalDragDirection(page);
  await assertMaterialProjectionLock(page);
  await assertPreparedRings(page);
  await assertRenderedRingReadable(page);
  await beginContinuitySampling(page);

  for (let pass = 0; pass < 3; pass += 1) {
    for (const lens of ["ultraviolet", "methane", "normal"]) {
      await page.evaluate((id) => window.__jupiter.selectLens(id), lens);
    }
    await page.locator('.planet-settings button[name="speed"]')
      .evaluate((element) => element.click());
    await page.mouse.move(930, 520);
    await page.mouse.down();
    await page.mouse.move(930, 300 + pass * 40, { steps: 10 });
    await page.mouse.up();
    await page.mouse.wheel(0, pass % 2 === 0 ? -220 : 160);
    const state = await runtimeState(page);
    assert.equal(state.stageElementCount, baseline.stageElementCount);
    assert.equal(state.retainedLeafCount, baseline.retainedLeafCount);
    assert.equal(state.stableDomIdentity, true);
    assertMaterialPresentation(await materialPresentation(page));
  }

  for (let pitch = 0; pitch <= 89; pitch += 2.5) {
    await page.evaluate((nextPitch) => window.__jupiter.setView({ pitch: nextPitch }), pitch);
  }
  await page.waitForFunction(() =>
    window.__jupiter.renderStats.materialCache().pendingCount === 0);
  const continuity = await endContinuitySampling(page);
  assert.ok(continuity.samples > 0);
  assert.equal(continuity.blankSamples, 0);
  assertMaterialPresentation(await materialPresentation(page));
  const materialCache = await page.evaluate(() =>
    window.__jupiter.renderStats.materialCache());
  assert.ok(materialCache.retainedImageCount <= materialCache.maximumRetainedRowCount);
  assert.ok(materialCache.imageAllocations <= materialCache.maximumRetainedRowCount);

  assert.equal(await page.evaluate(() =>
    window.__jupiterSmokeRetained.camera === document.querySelector(".polycss-camera") &&
    window.__jupiterSmokeRetained.body === document.querySelector(".jupiter-body") &&
    window.__jupiterSmokeRetained.rings === document.querySelector(".jupiter-rings") &&
    window.__jupiterSmokeRetained.material === document.querySelector(".jupiter-material")), true);

  await page.evaluate(() => window.__jupiter.pause());
  assert.ok(await page.locator(".planet-stage").evaluate((stage) =>
    stage.getAnimations({ subtree: true }).every(({ playState }) => playState === "paused")));
  await page.evaluate(() => window.__jupiter.resume());

  await page.evaluate(() => window.__jupiter.setView({ pitch: 20.9, zoom: 1.1 }));
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
  const mobileFraming = await page.evaluate(() => {
    const union = (selector) => {
      let left = Infinity;
      let top = Infinity;
      let right = -Infinity;
      let bottom = -Infinity;
      for (const element of document.querySelectorAll(selector)) {
        const bounds = element.getBoundingClientRect();
        if (bounds.width === 0 && bounds.height === 0) continue;
        left = Math.min(left, bounds.left);
        top = Math.min(top, bounds.top);
        right = Math.max(right, bounds.right);
        bottom = Math.max(bottom, bounds.bottom);
      }
      return { width: right - left, height: bottom - top };
    };
    const stage = document.querySelector(".planet-stage");
    return {
      renderRootScale: getComputedStyle(
        stage.querySelector(".planet-render-root"),
      ).scale,
      body: union(".jupiter-body > s, .jupiter-body > u"),
    };
  });
  assert.ok(Number.parseFloat(mobileFraming.renderRootScale) < 0.45,
    `Jupiter mobile render root is not container fitted: ${mobileFraming.renderRootScale}`);
  assert.ok(mobileFraming.body.width >= 123 && mobileFraming.body.width <= 126,
    `Jupiter mobile body does not match prepared framing: ${mobileFraming.body.width}`);
  await page.setViewportSize({ width: 1440, height: 900 });
  assert.equal((await runtimeState(page)).stableDomIdentity, true);

  await page.evaluate(() => {
    const speed = document.querySelector('.planet-settings button[name="speed"]');
    window.__jupiterSmokeDestroyedControls = Object.freeze({
      speed,
      speedState: speed?.dataset.state,
    });
    const runtime = window.__jupiter;
    runtime.destroy();
    runtime.destroy();
    window.__jupiterSmokeDestroyedControls.speed?.click();
  });
  assert.deepEqual(await page.evaluate(() => ({
    stageChildren: document.querySelector(".planet-stage").childElementCount,
    jupiterClass: document.querySelector(".planet-stage").classList.contains("jupiter-stage"),
    runtime: typeof window.__jupiter,
    speedStateUnchanged:
      window.__jupiterSmokeDestroyedControls.speed?.dataset.state ===
      window.__jupiterSmokeDestroyedControls.speedState,
  })), {
    stageChildren: 0,
    jupiterClass: false,
    runtime: "undefined",
    speedStateUnchanged: true,
  });

  await loadJupiter(page);
  assertRuntimeState(await runtimeState(page));
  assert.deepEqual(externalAuthorityRequests, []);
  assert.deepEqual(browserProblems, []);
  console.log(JSON.stringify({
    ok: true,
    route: "/jupiter/",
    deviceScaleFactor,
    retainedLeafCount: baseline.retainedLeafCount,
    stageElementCount: baseline.stageElementCount,
    animationCount: baseline.animationCount,
    externalAuthorityRequests: 0,
    browserProblems: 0,
  }));
} finally {
  await browser.close();
}

async function loadJupiter(page) {
  const response = await page.goto(new URL("/jupiter/", baseUrl).href, {
    waitUntil: "networkidle",
  });
  assert.equal(response?.status(), 200);
  await page.waitForFunction(() =>
    window.__cssEarth?.ready === true &&
    window.__jupiter?.ready === true &&
    document.documentElement.dataset.ready === "true");
}

async function assertVerticalDragDirection(page) {
  const defaultPitch = 20.9;
  await page.evaluate((pitch) => window.__jupiter.setView({ pitch }), defaultPitch);
  await page.mouse.move(900, 450);
  await page.mouse.down();
  await page.mouse.move(900, 600, { steps: 10 });
  await page.mouse.up();
  const downwardPitch = await page.evaluate(() => window.__jupiter.view().pitch);
  assert.ok(downwardPitch > defaultPitch,
    `dragging down must move Jupiter toward top-down: ${downwardPitch}`);

  await page.evaluate((pitch) => window.__jupiter.setView({ pitch }), defaultPitch);
  await page.mouse.move(900, 450);
  await page.mouse.down();
  await page.mouse.move(900, 300, { steps: 10 });
  await page.mouse.up();
  const upwardPitch = await page.evaluate(() => window.__jupiter.view().pitch);
  assert.ok(upwardPitch < defaultPitch,
    `dragging up must move Jupiter toward the lower view: ${upwardPitch}`);
  await page.evaluate((pitch) => window.__jupiter.setView({ pitch }), defaultPitch);
}

async function assertMaterialProjectionLock(page) {
  await page.evaluate(() => {
    window.__jupiter.pause();
    window.__jupiter.setView({
      pitch: 45,
      controlYaw: 42,
      zoom: 1.1,
    });
  });
  const shadows = page.locator('.planet-settings input[name="shadows"]');
  if (!(await shadows.isChecked())) {
    await shadows.evaluate((element) => element.click());
  }
  await page.waitForFunction(() =>
    window.__jupiter.renderStats.materialCache().pendingCount === 0);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() =>
    requestAnimationFrame(resolve))));
  const centers = await page.evaluate(() => {
    const material = document.querySelector(".jupiter-material > s")
      .getBoundingClientRect();
    const bodyLeaves = [...document.querySelectorAll(".jupiter-body > s")]
      .map((leaf) => leaf.getBoundingClientRect());
    const body = {
      left: Math.min(...bodyLeaves.map((bounds) => bounds.left)),
      right: Math.max(...bodyLeaves.map((bounds) => bounds.right)),
      top: Math.min(...bodyLeaves.map((bounds) => bounds.top)),
      bottom: Math.max(...bodyLeaves.map((bounds) => bounds.bottom)),
    };
    return {
      material: [
        (material.left + material.right) / 2,
        (material.top + material.bottom) / 2,
      ],
      body: [
        (body.left + body.right) / 2,
        (body.top + body.bottom) / 2,
      ],
    };
  });
  const centerError = Math.hypot(
    centers.material[0] - centers.body[0],
    centers.material[1] - centers.body[1],
  );
  assert.ok(centerError < 2,
    `Jupiter material detached from the body under pitch/yaw: ${centerError}`);
  await page.evaluate(() => window.__jupiter.setView({
    pitch: 20.9,
    controlYaw: 0,
    zoom: 1.1,
  }));
}

async function runtimeState(page) {
  return page.evaluate(() => ({
    title: document.title,
    activeObjectId: window.__cssEarth?.activeObjectId,
    mountedObjectCount: window.__cssEarth?.mountedObjectCount,
    stageCount: document.querySelectorAll(".planet-stage").length,
    cameraCount: document.querySelectorAll(".polycss-camera").length,
    renderRootCount:
      document.querySelectorAll(".planet-stage > .planet-render-root").length,
    stageChildCount: document.querySelector(".planet-stage").childElementCount,
    stageElementCount: document.querySelector(".planet-stage").querySelectorAll("*").length,
    retainedLeafCount: window.__jupiter.dom.retainedLeafCount,
    stableDomIdentity: window.__jupiter.assertStableDomIdentity(),
    runtimeDomGrowthPolicy: window.__jupiter.dom.runtimeDomGrowthPolicy,
    selectedPreparedDensity: window.__jupiter.renderStats.selectedPreparedDensity,
    visibleAssetsDecodedBeforeMount: window.__jupiter.renderStats.visibleAssetsDecodedBeforeMount,
    idleJavaScriptLoops: window.__jupiter.renderStats.idleJavaScriptLoops,
    animationCount: document.querySelector(".planet-stage").getAnimations({ subtree: true }).length,
    canvasCount: document.querySelectorAll("canvas").length,
    sceneSvgCount: document.querySelectorAll(".planet-stage svg").length,
    ringLeafCount: document.querySelectorAll(".jupiter-rings > s").length,
  }));
}

function beginContinuitySampling(page) {
  return page.evaluate(() => {
    const state = { active: true, blankSamples: 0, samples: 0 };
    window.__jupiterContinuity = state;
    const sample = () => {
      if (!state.active) return;
      const leaf = document.querySelector(".jupiter-material > s");
      const image = leaf ? getComputedStyle(leaf).backgroundImage : "none";
      state.samples += 1;
      if (!leaf?.isConnected || image === "none") state.blankSamples += 1;
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

function endContinuitySampling(page) {
  return page.evaluate(() => {
    window.__jupiterContinuity.active = false;
    return { ...window.__jupiterContinuity };
  });
}

function materialPresentation(page) {
  return page.locator(".jupiter-material > s").evaluate((leaf) => ({
    connected: leaf.isConnected,
    backgroundImage: getComputedStyle(leaf).backgroundImage,
    backgroundPosition: getComputedStyle(leaf).backgroundPosition,
  }));
}

function assertMaterialPresentation(presentation) {
  assert.equal(presentation.connected, true);
  assert.notEqual(presentation.backgroundImage, "none");
  assert.notEqual(presentation.backgroundPosition, "");
}

function assertRuntimeState(state) {
  assert.equal(state.title, "Jupiter - Powered by PolyCSS");
  assert.equal(state.activeObjectId, "jupiter");
  assert.equal(state.mountedObjectCount, 1);
  assert.equal(state.stageCount, 1);
  assert.equal(state.cameraCount, 1);
  assert.equal(state.renderRootCount, 1);
  assert.equal(state.stageChildCount, 3);
  assert.equal(state.stageElementCount, 1575);
  assert.equal(state.retainedLeafCount, 789);
  assert.equal(state.stableDomIdentity, true);
  assert.equal(state.runtimeDomGrowthPolicy, "none");
  assert.equal(state.selectedPreparedDensity, 2);
  assert.equal(state.visibleAssetsDecodedBeforeMount, 20);
  assert.equal(state.idleJavaScriptLoops, 0);
  assert.equal(state.animationCount, 1);
  assert.equal(state.canvasCount, 0);
  assert.equal(state.sceneSvgCount, 0);
  assert.equal(state.ringLeafCount, 16);
}

async function assertPreparedRings(page) {
  const state = await page.evaluate(async () => {
    window.__jupiter.setView({ pitch: 20.9, controlYaw: 0 });
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    const bodyLeaves = [...document.querySelectorAll(".jupiter-body > s")]
      .map((leaf) => leaf.getBoundingClientRect());
    const body = {
      width: Math.max(...bodyLeaves.map((bounds) => bounds.right)) -
        Math.min(...bodyLeaves.map((bounds) => bounds.left)),
    };
    const leaves = [...document.querySelectorAll(".jupiter-rings > s")];
    const painted = leaves.filter((leaf) => {
      const style = getComputedStyle(leaf);
      return style.visibility !== "hidden" && style.backgroundImage !== "none";
    });
    return {
      leafCount: leaves.length,
      paintedCount: painted.length,
      widestLeaf: Math.max(...leaves.map((leaf) =>
        leaf.getBoundingClientRect().width)),
      ringSystemWidth: Math.max(...leaves.map((leaf) =>
        leaf.getBoundingClientRect().right)) - Math.min(...leaves.map((leaf) =>
        leaf.getBoundingClientRect().left)),
      bodyWidth: body.width,
    };
  });
  assert.equal(state.leafCount, 16);
  assert.equal(state.paintedCount, 16);
  assert.ok(state.widestLeaf < state.bodyWidth,
    `Jupiter composite ring tiles regressed to stacked full planes: ` +
    `${state.widestLeaf}/${state.bodyWidth}`);
  assert.ok(state.ringSystemWidth > state.bodyWidth,
    `Jupiter rings do not extend beyond the body: ` +
    `${state.ringSystemWidth}/${state.bodyWidth}`);

  const control = page.locator('.planet-settings input[name="rings"]');
  await control.evaluate((element) => element.click());
  assert.equal(await page.locator(".jupiter-rings").evaluate((rings) =>
    getComputedStyle(rings).visibility), "hidden");
  await control.evaluate((element) => element.click());
  assert.notEqual(await page.locator(".jupiter-rings").evaluate((rings) =>
    getComputedStyle(rings).visibility), "hidden");
}

async function assertRenderedRingReadable(page) {
  await page.evaluate(() => {
    window.__jupiter.pause();
    window.__jupiter.setView({ pitch: 89, zoom: 1.1 });
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() =>
    requestAnimationFrame(resolve))));
  const geometry = await page.evaluate(() => {
    const rings = [...document.querySelectorAll(".jupiter-rings > s")]
      .map((leaf) => leaf.getBoundingClientRect());
    const left = Math.min(...rings.map((bounds) => bounds.left));
    const right = Math.max(...rings.map((bounds) => bounds.right));
    const top = Math.min(...rings.map((bounds) => bounds.top));
    const bottom = Math.max(...rings.map((bounds) => bounds.bottom));
    return {
      centerX: (left + right) / 2,
      centerY: (top + bottom) / 2,
      ringRadius: Math.max(right - left, bottom - top) / 2,
    };
  });
  const visible = await page.screenshot();
  const control = page.locator('.planet-settings input[name="rings"]');
  await control.evaluate((element) => element.click());
  const hidden = await page.screenshot();
  await control.evaluate((element) => element.click());
  await page.evaluate(() => {
    window.__jupiter.setView({ pitch: 20.9, yaw: -105, zoom: 1.1 });
    window.__jupiter.resume();
  });

  const [visibleRaster, hiddenRaster] = await Promise.all([
    sharp(visible).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(hidden).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  assert.deepEqual(visibleRaster.info, hiddenRaster.info);
  const rasterScale = visibleRaster.info.width / 1440;
  const centerX = geometry.centerX * rasterScale;
  const centerY = geometry.centerY * rasterScale;
  const innerRadius = geometry.ringRadius * rasterScale * 0.7;
  const outerRadius = geometry.ringRadius * rasterScale * 1.02;
  let changedByEight = 0;
  let changedBySixteen = 0;
  let maximumDifference = 0;
  const changedByAngle = Array.from({ length: 36 }, () => 0);
  for (let y = Math.floor(centerY - outerRadius);
    y <= Math.ceil(centerY + outerRadius); y += 1) {
    for (let x = Math.floor(centerX - outerRadius);
      x <= Math.ceil(centerX + outerRadius); x += 1) {
      const radius = Math.hypot(x - centerX, y - centerY);
      if (radius < innerRadius || radius > outerRadius) continue;
      const offset = (y * visibleRaster.info.width + x) *
        visibleRaster.info.channels;
      const difference = Math.max(
        Math.abs(visibleRaster.data[offset] - hiddenRaster.data[offset]),
        Math.abs(visibleRaster.data[offset + 1] - hiddenRaster.data[offset + 1]),
        Math.abs(visibleRaster.data[offset + 2] - hiddenRaster.data[offset + 2]),
      );
      maximumDifference = Math.max(maximumDifference, difference);
      if (difference >= 8) {
        changedByEight += 1;
        const angle = Math.atan2(y - centerY, x - centerX);
        const angleIndex = Math.min(35, Math.floor(
          (angle + Math.PI) / (Math.PI * 2) * changedByAngle.length,
        ));
        changedByAngle[angleIndex] += 1;
      }
      if (difference >= 16) changedBySixteen += 1;
    }
  }
  assert.ok(maximumDifference >= 100,
    `Jupiter rendered ring contrast disappeared: ${maximumDifference}`);
  assert.ok(changedByEight >= 18_000,
    `Jupiter rendered ring area became illegible: ${changedByEight}`);
  assert.ok(changedBySixteen >= 4_000,
    `Jupiter rendered main ring became illegible: ${changedBySixteen}`);
  assert.ok(Math.min(...changedByAngle) >= 20,
    `Jupiter rendered ring silhouette is incomplete: ${changedByAngle.join(",")}`);
}
