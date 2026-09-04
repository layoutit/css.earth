import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
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

  await loadMars(page);
  const baseline = await runtimeState(page);
  assertRuntimeState(baseline);
  assertSharedDepthContext(baseline);
  assertRegisteredMaterial(baseline);
  await assertDirectionalSunContract(page);
  await page.evaluate(() => {
    window.__marsSmokeRetained = Object.freeze({
      camera: document.querySelector(".polycss-camera"),
      body: document.querySelector(".mars-body"),
      material: document.querySelector(".mars-material"),
    });
  });
  await assertVerticalDragDirection(page);
  await beginContinuitySampling(page);

  for (let pass = 0; pass < 3; pass += 1) {
    for (const lens of ["elevation", "thermal", "normal"]) {
      await page.evaluate((id) => window.__mars.selectLens(id), lens);
    }
    await page.locator('.planet-settings button[name="speed"]')
      .evaluate((element) => element.click());
    await page.locator('.planet-settings input[name="shadows"]')
      .evaluate((element) => element.click());
    const controlState = await page.evaluate(() => ({
      shadowsChecked:
        document.querySelector('.planet-settings input[name="shadows"]').checked,
      shadowsEnabled: window.__mars.sky.state().shadowsEnabled,
    }));
    assert.equal(controlState.shadowsEnabled, controlState.shadowsChecked);
    await page.mouse.move(930, 520);
    await page.mouse.down();
    await page.mouse.move(930, 300 + pass * 40, { steps: 10 });
    await page.mouse.up();
    await page.mouse.wheel(0, pass % 2 === 0 ? -220 : 160);
    const state = await runtimeState(page);
    assert.equal(state.stageElementCount, baseline.stageElementCount);
    assert.equal(state.retainedLeafCount, baseline.retainedLeafCount);
    assert.equal(state.stableDomIdentity, true);
    assertSharedDepthContext(state);
    assertRegisteredMaterial(state);
    assertMaterialPresentation(await materialPresentation(page));
  }

  for (let pitch = 0; pitch <= 89; pitch += 2.5) {
    await page.evaluate((nextPitch) => window.__mars.setView({ pitch: nextPitch }), pitch);
  }
  for (const [controlPitch, controlYaw, zoom] of [
    [-180, -465, 0.58],
    [-75, -285, 1.1],
    [34.2307692308, -105, 1.7],
    [155, 75, 0.8],
    [270, 255, 1.35],
    [405, 615, 1.1],
  ]) {
    await page.evaluate(([nextPitch, nextYaw, nextZoom]) =>
      window.__mars.setView({
        controlPitch: nextPitch,
        controlYaw: nextYaw,
        zoom: nextZoom,
      }), [controlPitch, controlYaw, zoom]);
    const stressed = await runtimeState(page);
    assert.equal(stressed.stageElementCount, baseline.stageElementCount);
    assert.equal(stressed.stableDomIdentity, true);
    assertSharedDepthContext(stressed);
    assertRegisteredMaterial(stressed);
  }
  await page.evaluate(() => window.__mars.setView({
    controlPitch: 34.23076923076923,
    controlYaw: -105,
    zoom: 1.1,
  }));
  await page.waitForFunction(() =>
    window.__mars.renderStats.materialCache().pendingCount === 0);
  const continuity = await endContinuitySampling(page);
  assert.ok(continuity.samples > 0);
  assert.equal(continuity.blankSamples, 0);
  assertMaterialPresentation(await materialPresentation(page));
  const materialCache = await page.evaluate(() =>
    window.__mars.renderStats.materialCache());
  assert.ok(materialCache.retainedImageCount <= materialCache.maximumRetainedRowCount);
  assert.ok(materialCache.imageAllocations <= materialCache.maximumRetainedRowCount);

  assert.equal(await page.evaluate(() =>
    window.__marsSmokeRetained.camera === document.querySelector(".polycss-camera") &&
    window.__marsSmokeRetained.body === document.querySelector(".mars-body") &&
    window.__marsSmokeRetained.material === document.querySelector(".mars-material")), true);

  await page.evaluate(() => window.__mars.pause());
  assert.ok(await page.locator(".planet-stage").evaluate((stage) =>
    stage.getAnimations({ subtree: true }).every(({ playState }) => playState === "paused")));
  await page.evaluate(() => window.__mars.resume());

  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
  await page.setViewportSize({ width: 1440, height: 900 });
  assert.equal((await runtimeState(page)).stableDomIdentity, true);

  await page.evaluate(() => {
    const speed = document.querySelector('.planet-settings button[name="speed"]');
    window.__marsSmokeDestroyedControls = Object.freeze({
      speed,
      speedState: speed?.dataset.state,
    });
    const runtime = window.__mars;
    runtime.destroy();
    runtime.destroy();
    window.__marsSmokeDestroyedControls.speed?.click();
  });
  assert.deepEqual(await page.evaluate(() => ({
    stageChildren: document.querySelector(".planet-stage").childElementCount,
    marsClass: document.querySelector(".planet-stage").classList.contains("mars-stage"),
    runtime: typeof window.__mars,
    speedStateUnchanged:
      window.__marsSmokeDestroyedControls.speed?.dataset.state ===
      window.__marsSmokeDestroyedControls.speedState,
  })), {
    stageChildren: 0,
    marsClass: false,
    runtime: "undefined",
    speedStateUnchanged: true,
  });

  await loadMars(page);
  assertRuntimeState(await runtimeState(page));
  assert.deepEqual(externalAuthorityRequests, []);
  assert.deepEqual(browserProblems, []);
  console.log(JSON.stringify({
    ok: true,
    route: "/mars/",
    retainedLeafCount: baseline.retainedLeafCount,
    stageElementCount: baseline.stageElementCount,
    animationCount: baseline.animationCount,
    externalAuthorityRequests: 0,
    browserProblems: 0,
  }));
} finally {
  await browser.close();
}

async function loadMars(page) {
  const response = await page.goto(new URL("/mars/", baseUrl).href, {
    waitUntil: "networkidle",
  });
  assert.equal(response?.status(), 200);
  await page.waitForFunction(() =>
    window.__cssEarth?.ready === true &&
    window.__mars?.ready === true &&
    document.documentElement.dataset.ready === "true");
}

async function assertVerticalDragDirection(page) {
  const defaultPitch = 34.23076923076923;
  await page.evaluate((pitch) => window.__mars.setView({ pitch }), defaultPitch);
  await page.mouse.move(900, 450);
  await page.mouse.down();
  await page.mouse.move(900, 600, { steps: 10 });
  await page.mouse.up();
  const downwardPitch = await page.evaluate(() => window.__mars.view().pitch);
  assert.ok(downwardPitch > defaultPitch,
    `dragging down must move Mars toward top-down: ${downwardPitch}`);

  await page.evaluate((pitch) => window.__mars.setView({ pitch }), defaultPitch);
  await page.mouse.move(900, 450);
  await page.mouse.down();
  await page.mouse.move(900, 300, { steps: 10 });
  await page.mouse.up();
  const upwardPitch = await page.evaluate(() => window.__mars.view().pitch);
  assert.ok(upwardPitch < defaultPitch,
    `dragging up must move Mars toward the lower view: ${upwardPitch}`);
  await page.evaluate((pitch) => window.__mars.setView({ pitch }), defaultPitch);
}

async function assertDirectionalSunContract(page) {
  const samples = [];
  for (let controlYaw = -360; controlYaw <= 360; controlYaw += 15) {
    const sample = await page.evaluate((yaw) => {
      window.__mars.setView({
        controlPitch: 34.23076923076923,
        controlYaw: yaw,
        zoom: 0.58,
      });
      const sun = document.querySelector(".mars-directional-sun");
      const rect = sun.getBoundingClientRect();
      return {
        yaw,
        presentation: window.__mars.sky.state().sunPresentation,
        rect: [rect.x, rect.y, rect.width, rect.height],
      };
    }, controlYaw);
    samples.push(sample);
    if (sample.presentation.classification === "fully-visible") break;
  }
  const visible = samples.at(-1);
  assert.equal(visible.presentation.classification, "fully-visible",
    `no fully visible Sun pose found: ${JSON.stringify(samples)}`);
  const zoomed = await page.evaluate((yaw) => {
    window.__mars.setView({
      controlPitch: 34.23076923076923,
      controlYaw: yaw,
      zoom: 1.7,
    });
    const rect = document.querySelector(".mars-directional-sun")
      .getBoundingClientRect();
    return {
      presentation: window.__mars.sky.state().sunPresentation,
      rect: [rect.x, rect.y, rect.width, rect.height],
    };
  }, visible.yaw);
  assert.deepEqual(zoomed.presentation.centerNdc,
    visible.presentation.centerNdc);
  assert.ok(Math.abs(zoomed.rect[2] - visible.rect[2]) <= 0.01);
  assert.ok(Math.abs(zoomed.rect[3] - visible.rect[3]) <= 0.01);
  const rotated = await page.evaluate((yaw) => {
    window.__mars.setView({
      controlPitch: 34.23076923076923,
      controlYaw: yaw + 5,
      zoom: 1.7,
    });
    return window.__mars.sky.state().sunPresentation;
  }, visible.yaw);
  assert.notDeepEqual(rotated.centerNdc, visible.presentation.centerNdc);
  await page.evaluate(() => window.__mars.setView({
    controlPitch: 34.23076923076923,
    controlYaw: -105,
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
    stageChildCount: document.querySelector(".planet-stage").childElementCount,
    stageElementCount: document.querySelector(".planet-stage").querySelectorAll("*").length,
    retainedLeafCount: window.__mars.dom.retainedLeafCount,
    stableDomIdentity: window.__mars.assertStableDomIdentity(),
    runtimeDomGrowthPolicy: window.__mars.dom.runtimeDomGrowthPolicy,
    selectedPreparedDensity: window.__mars.renderStats.selectedPreparedDensity,
    visibleAssetsDecodedBeforeMount: window.__mars.renderStats.visibleAssetsDecodedBeforeMount,
    idleJavaScriptLoops: window.__mars.renderStats.idleJavaScriptLoops,
    animationCount: document.querySelector(".planet-stage").getAnimations({ subtree: true }).length,
    canvasCount: document.querySelectorAll("canvas").length,
    sceneSvgCount: document.querySelectorAll(".planet-stage svg").length,
    renderRootCount: document.querySelectorAll(
      ".planet-stage > .planet-render-root",
    ).length,
    materialRegistration: (() => {
      const body = document.querySelector(".mars-body")
        .getBoundingClientRect();
      const material = document.querySelector(".mars-material-plane > s")
        .getBoundingClientRect();
      return {
        bodyOrigin: [body.x, body.y],
        materialCenter: [
          material.x + material.width / 2,
          material.y + material.height / 2,
        ],
      };
    })(),
  }));
}

function assertSharedDepthContext(state) {
  assert.equal(state.renderRootCount, 1);
}

function assertRegisteredMaterial(state) {
  for (let axis = 0; axis < 2; axis += 1) {
    assert.ok(Math.abs(
      state.materialRegistration.materialCenter[axis] -
        state.materialRegistration.bodyOrigin[axis],
    ) <= 1.5,
    `Mars material center left the body origin on axis ${axis}: ` +
      JSON.stringify(state.materialRegistration));
  }
}

function beginContinuitySampling(page) {
  return page.evaluate(() => {
    const state = { active: true, blankSamples: 0, samples: 0 };
    window.__marsContinuity = state;
    const sample = () => {
      if (!state.active) return;
      const leaf = document.querySelector(".mars-material-plane > s");
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
    window.__marsContinuity.active = false;
    return { ...window.__marsContinuity };
  });
}

function materialPresentation(page) {
  return page.locator(".mars-material-plane > s").evaluate((leaf) => ({
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
  assert.equal(state.title, "Mars - Powered by PolyCSS");
  assert.equal(state.activeObjectId, "mars");
  assert.equal(state.mountedObjectCount, 1);
  assert.equal(state.stageCount, 1);
  assert.equal(state.cameraCount, 1);
  assert.equal(state.stageChildCount, 3);
  assert.equal(state.stageElementCount, 1047);
  assert.equal(state.retainedLeafCount, 518);
  assert.equal(state.stableDomIdentity, true);
  assert.equal(state.runtimeDomGrowthPolicy, "fixed-single-object-scene");
  assert.equal(state.selectedPreparedDensity, 2);
  assert.equal(state.visibleAssetsDecodedBeforeMount, 18);
  assert.equal(state.idleJavaScriptLoops, 0);
  assert.equal(state.animationCount, 1);
  assert.equal(state.canvasCount, 0);
  assert.equal(state.sceneSvgCount, 0);
}
