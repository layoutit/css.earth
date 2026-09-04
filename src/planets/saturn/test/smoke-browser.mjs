import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const deviceScaleFactor = Number(process.argv[3] ?? 1);
assert.ok(deviceScaleFactor === 1 || deviceScaleFactor === 2);
const browserChannel = process.env.PLAYWRIGHT_CHANNEL ?? "chrome";
const browser = await chromium.launch({
  headless: true,
  channel: browserChannel,
});

try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor,
    hasTouch: true,
  });
  const browserProblems = [];
  const nasaRuntimeRequests = [];
  const interiorAtmosphereRuntimeRequests = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname.endsWith("nasa.gov")) {
      nasaRuntimeRequests.push(request.url());
    }
    if (url.pathname.includes("saturn-interior-atmosphere")) {
      interiorAtmosphereRuntimeRequests.push(url.pathname);
    }
  });
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      browserProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    browserProblems.push(`pageerror: ${error.message}`);
  });

  const response = await page.goto(new URL("/saturn/", baseUrl).href, {
    waitUntil: "networkidle",
  });
  assert.equal(response?.status(), 200);
  await waitForSaturn(page);
  await assertDefaultMotionOff(page);
  await enableMotion(page);
  assertRuntimeState(await runtimeState(page));
  await assertPreparedInformation(page);
  await assertLensBehavior(page, interiorAtmosphereRuntimeRequests);
  await assertFeatureBehavior(page);
  await assertSpeedBehavior(page);
  await assertCameraBehavior(page);
  await assertUnboundedCameraBehavior(page);
  await assertReducedMotionBehavior(page);
  await assertMobileBounds(page);

  assert.deepEqual(nasaRuntimeRequests, [],
    "The browser must not contact NASA at runtime.");
  assert.deepEqual(browserProblems, []);
  console.log(JSON.stringify({
    ok: true,
    route: "/saturn/",
    deviceScaleFactor,
    mountedObjectCount: 1,
    browserProblems: 0,
  }));
} finally {
  await browser.close();
}

async function waitForSaturn(page) {
  await page.waitForFunction(() =>
    window.__cssEarth?.ready === true &&
    window.__saturn?.ready === true &&
    document.documentElement.dataset.ready === "true");
}

async function assertDefaultMotionOff(page) {
  assert.equal(await page.locator(".planet-motion-setting").isChecked(), false);
  assert.equal(await page.evaluate(() =>
    document.documentElement.dataset.playing), "false");
  assert.equal(await page.evaluate(() =>
    window.__saturn.animation.playback.stats().running), false);
}

async function enableMotion(page) {
  const settings = page.locator(".planet-settings-panel");
  const action = page.locator(".planet-settings-action");
  await action.click();
  assert.equal(await settings.getAttribute("open"), "");
  await page.locator(".planet-motion-setting-control").click();
  await page.waitForFunction(() =>
    document.documentElement.dataset.playing === "true" &&
    window.__saturn.animation.playback.stats().running);
  await action.click();
}

async function runtimeState(page) {
  return page.evaluate(() => ({
    title: document.title,
    mountedObjectCount: window.__cssEarth?.mountedObjectCount,
    activeObjectId: window.__cssEarth?.activeObjectId,
    stageCount: document.querySelectorAll(".planet-stage").length,
    cameraCount: document.querySelectorAll(".polycss-camera").length,
    stageBusy: document.querySelector(".planet-stage")
      ?.getAttribute("aria-busy"),
    retainedLeafCount: window.__saturn.dom.retainedLeafCount,
    maximumRetainedLeafCount: window.__saturn.dom.maximumRetainedLeafCount,
    onDemandPreparedLeafCount: window.__saturn.dom.onDemandPreparedLeafCount,
    retainedTransformGroupCount:
      window.__saturn.dom.retainedTransformGroupCount,
    stableDomIdentity: window.__saturn.assertStableDomIdentity(),
    runtimeDomGrowthPolicy: window.__saturn.dom.runtimeDomGrowthPolicy,
    animationCount: document.getAnimations().length,
    playbackAnimationCount: document.getAnimations().filter(
      ({ id }) => !id.startsWith("saturn-camera-orbit-"),
    ).length,
    cameraOrbitAnimationCount: document.getAnimations().filter(
      ({ id }) => id.startsWith("saturn-camera-orbit-"),
    ).length,
    playbackAnimationsRunning: document.getAnimations().filter(
      ({ id }) => !id.startsWith("saturn-camera-orbit-"),
    ).every((animation) => animation.playState === "running"),
    cameraOrbitAnimationsPaused: document.getAnimations().filter(
      ({ id }) => id.startsWith("saturn-camera-orbit-"),
    ).every((animation) => animation.playState === "paused"),
    canvasCount: document.querySelectorAll("canvas").length,
    sceneSvgCount: document.querySelectorAll(".planet-stage svg").length,
    featureState: window.__saturn.features.state(),
    optionsState: window.__saturn.options.state(),
    playbackState: window.__saturn.animation.playback.stats(),
    bankState: window.__saturn.preparedBanks.state(),
    cameraStats: window.__saturn.animation.stats(),
  }));
}

function assertRuntimeState(state) {
  assert.equal(state.title, "Saturn - Powered by PolyCSS");
  assert.equal(state.mountedObjectCount, 1);
  assert.equal(state.activeObjectId, "saturn");
  assert.equal(state.stageCount, 1);
  assert.equal(state.cameraCount, 1);
  assert.equal(state.stageBusy, "false");
  assert.equal(state.retainedLeafCount, 938);
  assert.equal(state.maximumRetainedLeafCount, 938);
  assert.equal(state.onDemandPreparedLeafCount, 0);
  assert.equal(state.retainedTransformGroupCount, 32);
  assert.equal(state.stableDomIdentity, true);
  assert.equal(state.runtimeDomGrowthPolicy,
    "none-retained-scene-complete-at-mount");
  assert.equal(state.animationCount, 6);
  assert.equal(state.playbackAnimationCount, 6);
  assert.equal(state.cameraOrbitAnimationCount, 0);
  assert.equal(state.playbackAnimationsRunning, true);
  assert.equal(state.cameraOrbitAnimationsPaused, true);
  assert.equal(state.playbackState.animationCount, 6);
  assert.equal(state.playbackState.model,
    "native-compositor-playback");
  assert.equal(state.playbackState.running, true);
  assert.equal(state.playbackState.speed, 1);
  assert.equal(state.playbackState.timerCount, 0);
  assert.equal(state.playbackState.updatesPerSecond, 0);
  assert.equal(state.playbackState.timerCallbackCount, 0);
  assert.equal(state.playbackState.currentTimeWrites, 6);
  assert.equal(state.canvasCount, 0);
  assert.equal(state.sceneSvgCount, 0);
  assert.deepEqual(state.featureState, {
    rings: true,
    shadows: false,
  });
  assert.deepEqual(state.optionsState, { speed: 1 });
  assert.deepEqual(state.bankState.interior, {
    interiorMounted: true,
    interiorLeafCount: 478,
  });
  assert.equal(state.cameraStats.owner, "shared-retained-cubic-sky-orbit");
  assert.equal(state.cameraStats.runtimeGeometryPreparation, false);
  assert.equal(state.cameraStats.pitchBounded, false);
  assert.equal(state.cameraStats.yawBounded, false);
}

async function assertPreparedInformation(page) {
  assert.equal(await page.locator(
    '.planet-chart-panel:has(img[src="/scenes/saturn/saturn-atmosphere-spectrum.svg"]) h2',
  )
    .textContent(),
    "Reflectance spectrum");
  assert.equal(await page.locator(
    '.planet-chart[src="/scenes/saturn/saturn-atmosphere-spectrum.svg"]',
  )
    .getAttribute("src"), "/scenes/saturn/saturn-atmosphere-spectrum.svg");
  assert.equal(await page.locator(
    '.planet-chart[src="/scenes/saturn/saturn-temperature-pressure-profile.svg"]',
  )
    .getAttribute("src"),
  "/scenes/saturn/saturn-temperature-pressure-profile.svg");
}

async function assertLensBehavior(page, interiorRequests) {
  const controls = page.locator('.planet-observation-control[name="lens"]');
  assert.deepEqual(await controls.evaluateAll((buttons) => buttons.map(
    (button) => button.value,
  )), ["normal", "ultraviolet", "methane", "thermal", "cross-section"]);

  const initialLeafCount = await sceneLeafCount(page);
  for (const id of ["ultraviolet", "methane", "thermal", "normal"]) {
    await selectLens(page, id);
    assert.equal(await sceneLeafCount(page), initialLeafCount);
    assert.equal(await page.evaluate(() =>
      window.__saturn.assertStableDomIdentity()), true);
  }

  assert.deepEqual(interiorRequests, []);
  await toggleCrossSection(page, true);
  assert.deepEqual(interiorRequests, [
    "/scenes/saturn/saturn-interior-atmosphere-normal-no-shadows.webp",
  ]);
  const mounted = await page.evaluate(() => ({
    view: document.querySelector(".planet-stage").dataset.view,
    cutawayCount: document.querySelectorAll(".saturn-cutaway").length,
    leafCount: window.__saturn.preparedBanks.state().interior.interiorLeafCount,
  }));
  assert.deepEqual(mounted, {
    view: "interior",
    cutawayCount: 1,
    leafCount: 478,
  });
  const retainedCutaway = await page.locator(".saturn-cutaway").elementHandle();
  await selectLens(page, "ultraviolet");
  assert.equal(await page.locator(".planet-stage").getAttribute("data-view"),
    "interior");
  assert.deepEqual(interiorRequests, [
    "/scenes/saturn/saturn-interior-atmosphere-normal-no-shadows.webp",
    "/scenes/saturn/saturn-interior-atmosphere-ultraviolet-no-shadows.webp",
  ]);
  await toggleCrossSection(page, false);
  assert.equal(await retainedCutaway.evaluate((node) =>
    node === document.querySelector(".saturn-cutaway")), true);
  await selectLens(page, "normal");
}

async function selectLens(page, id) {
  await page.evaluate(async (lensId) => {
    await window.__saturn.lenses.select(lensId);
  }, id);
  await page.waitForFunction((lensId) =>
    window.__saturn.lenses.state().id === lensId, id);
}

async function toggleCrossSection(page, interior) {
  await page.evaluate(async () => {
    await window.__saturn.lenses.select("cross-section");
  });
  await page.waitForFunction((expected) =>
    window.__saturn.lenses.state().interior === expected, interior);
}

async function assertFeatureBehavior(page) {
  const material = page.locator(".saturn-exterior-material");
  for (const [name, selector, assetPart] of [
    ["rings", ".saturn-ring-plane", "normal-ringless-no-shadows"],
  ]) {
    const input = page.locator(`.planet-settings input[name="${name}"]`);
    await input.evaluate((element) => element.click());
    await page.waitForFunction((part) => getComputedStyle(
      document.querySelector(".saturn-exterior-material"),
    ).backgroundImage.includes(part), assetPart);
    assert.equal(await page.evaluate((key) =>
      window.__saturn.features.state()[key], name), false);
    assert.equal(await page.locator(selector).first().evaluate((node) =>
      getComputedStyle(node).visibility), "hidden");
    assert.equal(await material.evaluate((node) =>
      getComputedStyle(node).visibility), "visible");
    await input.evaluate((element) => element.click());
    await page.waitForFunction(() => !getComputedStyle(
      document.querySelector(".saturn-exterior-material"),
    ).backgroundImage.includes("normal-ringless-no-shadows") && getComputedStyle(
      document.querySelector(".saturn-exterior-material"),
    ).backgroundImage.includes("normal-no-shadows"));
    assert.equal(await page.evaluate((key) =>
      window.__saturn.features.state()[key], name), true);
  }

  const shadows = page.locator('.planet-settings input[name="shadows"]');
  assert.equal(await shadows.isChecked(), false);
  assert.match(await material.evaluate((node) =>
    getComputedStyle(node).backgroundImage), /normal-no-shadows/u);
  assert.equal(await page.locator(".saturn-ring-shadow").first().evaluate(
    (node) => getComputedStyle(node).visibility), "hidden");
  assert.equal(await material.evaluate((node) =>
    getComputedStyle(node).visibility), "visible");
  await shadows.evaluate((element) => element.click());
  await page.waitForFunction(() => !getComputedStyle(
    document.querySelector(".saturn-exterior-material"),
  ).backgroundImage.includes("normal-no-shadows"));
  assert.equal(await page.evaluate(() =>
    window.__saturn.features.state().shadows), true);
  assert.equal(await page.locator(".saturn-ring-shadow").first().evaluate(
    (node) => getComputedStyle(node).visibility), "visible");
  await shadows.evaluate((element) => element.click());
  await page.waitForFunction(() => getComputedStyle(
    document.querySelector(".saturn-exterior-material"),
  ).backgroundImage.includes("normal-no-shadows"));

}

async function assertSpeedBehavior(page) {
  const control = page.locator('.planet-settings button[name="speed"]');
  for (const [speed, state] of [
    [2, "fast"],
    [3, "fastest"],
    [4, "superfast"],
    [0, "off"],
    [1, "normal"],
  ]) {
    await control.evaluate((element) => element.click());
    assert.equal(await page.evaluate(() =>
      window.__saturn.options.state().speed), speed);
    assert.equal(await control.getAttribute("data-state"), state);
    assert.ok((await page.locator(".planet-stage").evaluate((stage, rate) =>
      stage.getAnimations({ subtree: true })
        .filter(({ id }) => !id.startsWith("saturn-camera-orbit-"))
        .every(
        (animation) => animation.playbackRate === rate &&
          animation.playState === (rate === 0 ? "paused" : "running"),
      ), speed)));
    assert.equal(await page.evaluate(() =>
      window.__saturn.animation.playback.stats().running), speed > 0);
  }
}

async function assertCameraBehavior(page) {
  const scene = page.locator(".polycss-camera > .polycss-scene");
  const transformBefore = await scene.evaluate((node) => {
    const style = getComputedStyle(node);
    return `${style.transform}|${style.scale}`;
  });
  const zoomBefore = await page.evaluate(() => window.__saturn.camera.state().zoom);
  await page.mouse.move(900, 540);
  await page.mouse.wheel(0, -240);
  await page.waitForFunction((zoom) =>
    window.__saturn.camera.state().zoom !== zoom, zoomBefore);
  await page.mouse.down();
  await page.mouse.move(900, 520);
  const exteriorBodyLeaves = page.locator(
    ".polycss-camera .saturn-system > .saturn-body:not(.saturn-cutaway-body) > s",
  );
  assert.equal(await exteriorBodyLeaves.count(), 452);
  await page.mouse.move(900, 340, { steps: 11 });
  assert.equal(await exteriorBodyLeaves.evaluateAll((leaves) =>
    leaves.filter((leaf) => getComputedStyle(leaf).visibility === "hidden")
      .length), 0);
  await page.mouse.up();
  assert.equal(await exteriorBodyLeaves.evaluateAll((leaves) =>
    leaves.filter((leaf) => getComputedStyle(leaf).visibility === "hidden")
      .length), 0);
  assert.notEqual(await scene.evaluate((node) => {
    const style = getComputedStyle(node);
    return `${style.transform}|${style.scale}`;
  }), transformBefore);
  assert.equal(await page.evaluate(() =>
    window.__saturn.assertStableDomIdentity()), true);
}

async function assertUnboundedCameraBehavior(page) {
  const initialLeafCount = await sceneLeafCount(page);
  const initial = await page.evaluate(() => window.__saturn.camera.state());
  const stressed = await page.evaluate(() => window.__saturn.camera.setState({
    controlPitch: 200,
    controlYaw: -240,
  }));
  assert.equal(stressed.controlPitch, 200);
  assert.equal(stressed.controlYaw, -240);
  assert.equal(await sceneLeafCount(page), initialLeafCount);
  assert.equal(await page.evaluate(() =>
    window.__saturn.assertStableDomIdentity()), true);
  await page.evaluate((state) => window.__saturn.camera.setState(state), initial);
}

async function assertReducedMotionBehavior(page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(() =>
    document.documentElement.dataset.playing === "false" &&
    !window.__saturn.animation.playback.stats().running);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.waitForFunction(() =>
    document.documentElement.dataset.playing === "true" &&
    window.__saturn.animation.playback.stats().running);
}

async function assertMobileBounds(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  await waitForSaturn(page);
  const state = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth,
    mountedObjectCount: window.__cssEarth?.mountedObjectCount,
    stageCount: document.querySelectorAll(".planet-stage").length,
  }));
  assert.equal(state.scrollWidth, state.innerWidth);
  assert.equal(state.mountedObjectCount, 1);
  assert.equal(state.stageCount, 1);
}

function sceneLeafCount(page) {
  return page.locator(".planet-stage").evaluate((stage) =>
    stage.querySelectorAll("b, s, u").length);
}
