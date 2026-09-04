import assert from "node:assert/strict";
import { chromium } from "playwright";
import { PREPARED_EARTH_SCENE } from "../runtime/preparedScene.mjs";
import { PREPARED_EARTH_STARFIELD } from "../runtime/preparedStarfield.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const deviceScaleFactor = Number(process.argv[3] ?? 1);
assert.ok(deviceScaleFactor === 1 || deviceScaleFactor === 2);
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome" });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor,
  });
  const page = await context.newPage();
  const problems = [];
  const external = [];
  const requestedAssets = [];
  page.on("console", (message) => { if (["error", "warning"].includes(message.type())) problems.push(`${message.type()}: ${message.text()}`); });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== new URL(baseUrl).origin) {
      external.push(request.url());
    } else {
      requestedAssets.push(new URL(request.url()).pathname);
    }
  });
  const response = await page.goto(new URL("/earth/", baseUrl).href, { waitUntil: "networkidle" });
  assert.equal(response?.status(), 200);
  await page.waitForFunction(() => window.__cssEarth?.ready === true && window.__earth?.ready === true);
  const initial = await page.evaluate(() => ({
    title: document.title,
    active: window.__cssEarth.activeObjectId,
    mounted: window.__cssEarth.mountedObjectCount,
    cameraCount: document.querySelectorAll(".polycss-camera").length,
    canvasCount: document.querySelectorAll("canvas").length,
    sceneSvgCount: document.querySelectorAll(".planet-stage svg").length,
    retainedLeafCount: window.__earth.dom.retainedLeafCount,
    stageElementCount: document.querySelector(".planet-stage")
      .querySelectorAll("*").length,
    sceneTransform: getComputedStyle(document.querySelector(
      ".planet-stage .polycss-scene",
    )).transform,
    cameraAnimationTime: document.getAnimations().find(({ id }) =>
      id === "earth-camera-orbit")?.currentTime,
    normalSurfaceImage: getComputedStyle(document.querySelector(
      ".earth-body:not(.earth-body-polar) > s > " +
      ".polycss-projective-texture",
    )).backgroundImage,
    normalPolesImage: getComputedStyle(document.querySelector(
      ".earth-body-polar > s",
    )).backgroundImage,
    retainedInteractiveImageCount:
      window.__earth.renderStats.textureStats.retainedInteractiveImageCount,
    stable: window.__earth.assertStableDomIdentity(),
  }));
  assert.equal(initial.title, "Earth - Powered by PolyCSS");
  assert.equal(initial.active, "earth");
  assert.equal(initial.mounted, 1);
  assert.equal(initial.cameraCount, 1);
  assert.equal(initial.canvasCount, 0);
  assert.equal(initial.sceneSvgCount, 0);
  assert.equal(initial.retainedLeafCount,
    PREPARED_EARTH_SCENE.counts.maximumRetainedLeafCount);
  assert.equal(initial.stable, true);
  assert.equal(initial.normalSurfaceImage.endsWith(
    '/scenes/earth/earth-surface.webp")'), true);
  assert.equal(initial.normalPolesImage.endsWith(
    '/scenes/earth/earth-surface-poles.webp")'), true);
  assert.equal(
    initial.retainedInteractiveImageCount,
    2 + PREPARED_EARTH_STARFIELD.faces.length * 2 + 1 + 1 +
      PREPARED_EARTH_SCENE.material.atmosphere.transport.initialWarmRows.length,
  );
  const startupAssets = [...requestedAssets];
  assert.equal(startupAssets.some((pathname) =>
    pathname.includes("earth-interior-")), true);
  assert.equal(await page.locator('[class*="earth-moon"]').count(), 0);
  assert.equal(await page.locator('input[name="moons"]').count(), 0);
  const initialCamera = await page.evaluate(() => window.__earth.camera.state());
  const cameraTransforms = await page.evaluate(async ({ initialCamera }) => {
    const scene = document.querySelector(".planet-stage .polycss-scene");
    const sky = document.querySelector(".earth-skybox-orientation");
    const before = getComputedStyle(scene).transform;
    const beforeSky = getComputedStyle(sky).transform;
    window.__earth.camera.setState({
      controlPitch: 129,
      controlYaw: 137,
      zoom: 0.8,
    });
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    const stressed = getComputedStyle(scene).transform;
    const stressedSky = getComputedStyle(sky).transform;
    const stressedCamera = window.__earth.camera.state();
    const stable = window.__earth.assertStableDomIdentity();
    window.__earth.camera.setState(initialCamera);
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    return {
      before,
      beforeSky,
      stressed,
      stressedSky,
      stressedCamera,
      restored: getComputedStyle(scene).transform,
      restoredSky: getComputedStyle(sky).transform,
      restoredCamera: window.__earth.camera.state(),
      stable,
    };
  }, { initialCamera });
  assert.notEqual(cameraTransforms.before, cameraTransforms.stressed);
  assert.notEqual(cameraTransforms.beforeSky, cameraTransforms.stressedSky);
  assert.equal(cameraTransforms.stressedCamera.controlPitch, 129);
  assert.equal(cameraTransforms.stressedCamera.controlYaw, 137);
  assert.notEqual(cameraTransforms.restored, cameraTransforms.stressed);
  assert.notEqual(cameraTransforms.restoredSky, cameraTransforms.stressedSky);
  assert.ok(Math.abs(
    cameraTransforms.restoredCamera.controlPitch - initialCamera.controlPitch,
  ) < 0.01);
  assert.ok(Math.abs(
    cameraTransforms.restoredCamera.zoom - initialCamera.zoom,
  ) < 0.01);
  assert.equal(cameraTransforms.stable, true);
  for (const id of ["topography", "night-lights", "cross-section", "normal"]) {
    await page.evaluate((lens) => window.__earth.lenses.select(lens), id);
    assert.equal(await page.evaluate(() => window.__earth.assertStableDomIdentity()), true);
    if (["normal", "topography"].includes(id)) {
      const textures = await page.evaluate(() => ({
        surface: getComputedStyle(document.querySelector(
          ".earth-body:not(.earth-body-polar) > s",
        ), "::before").backgroundImage,
        poles: getComputedStyle(document.querySelector(
          ".earth-body-polar > s",
        )).backgroundImage,
      }));
      assert.equal(textures.surface.includes("@2x"), false);
      assert.equal(textures.poles.includes("@2x"), false);
    }
  }
  await page.waitForFunction(() => {
    const caches = window.__earth.renderStats.textureStats.materialCaches;
    return [caches.lighting(), caches.atmosphere()].every((cache) =>
      cache.pendingRowCount === 0);
  });
  await page.evaluate(() => window.__earth.lenses.select("cross-section"));
  const hiddenMaterialBefore = await page.evaluate(() => ({
    lighting: window.__earth.renderStats.textureStats.materialCaches
      .lighting(),
    atmosphere: window.__earth.renderStats.textureStats.materialCaches
      .atmosphere(),
  }));
  await page.evaluate(() => window.__earth.camera.setState({
    controlPitch: 89,
  }));
  await page.evaluate(() => new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const cutaway = await page.evaluate(() => ({
    leafCount: document.querySelectorAll(".earth-cutaway s").length,
    rootCount: document.querySelectorAll(".earth-cutaway").length,
    presentationTransform: getComputedStyle(document.querySelector(
      ".earth-cutaway-presentation",
    )).transform,
    counterTransform: getComputedStyle(document.querySelector(
      ".earth-cutaway-counter",
    )).transform,
    stageElementCount: document.querySelector(".planet-stage")
      .querySelectorAll("*").length,
    viewBank: window.__earth.viewBank.state(),
    rasterCircleCount: document.querySelectorAll(".earth-interior-material").length,
    materialCaches: {
      lighting: window.__earth.renderStats.textureStats.materialCaches
        .lighting(),
      atmosphere: window.__earth.renderStats.textureStats.materialCaches
        .atmosphere(),
    },
  }));
  assert.equal(cutaway.leafCount, PREPARED_EARTH_SCENE.interior.leafCount);
  assert.equal(cutaway.rootCount, 1);
  assert.notEqual(cutaway.presentationTransform, "none");
  assert.notEqual(cutaway.counterTransform, "none");
  assert.equal(cutaway.stageElementCount, initial.stageElementCount);
  assert.deepEqual(cutaway.viewBank, {
    interiorMounted: true,
    interiorLeafCount: PREPARED_EARTH_SCENE.interior.leafCount,
  });
  assert.equal(cutaway.rasterCircleCount, 0);
  for (const role of ["lighting", "atmosphere"]) {
    assert.equal(cutaway.materialCaches[role].enabled, false);
    assert.equal(
      cutaway.materialCaches[role].runtimeDecodeCount,
      hiddenMaterialBefore[role].runtimeDecodeCount,
    );
  }
  await page.evaluate(() => window.__earth.lenses.select("normal"));
  await page.evaluate(() => window.__earth.lenses.select("cross-section"));
  assert.equal(await page.locator(".earth-cutaway").count(), 1);
  const runtimeStats = await page.evaluate(() => ({
    camera: window.__earth.camera.stats(),
    lighting: window.__earth.renderStats.textureStats.materialCaches
      .lighting(),
    atmosphere: window.__earth.renderStats.textureStats.materialCaches
      .atmosphere(),
  }));
  assert.equal(runtimeStats.camera.owner, "shared-retained-cubic-sky-orbit");
  assert.equal(runtimeStats.camera.runtimeGeometryPreparation, false);
  assert.equal(runtimeStats.camera.pitchBounded, false);
  assert.equal(runtimeStats.camera.yawBounded, false);
  assert.ok(runtimeStats.camera.publications > 0);
  for (const cache of [runtimeStats.lighting, runtimeStats.atmosphere]) {
    assert.equal(cache.model, "row-shard-cache");
    assert.ok(cache.retainedRowCount <= 3, JSON.stringify(cache));
    assert.equal(cache.maximumRetainedRowCount, 3);
  }
  for (const name of ["atmosphere"]) {
    await page.locator(`input[name="${name}"]`).evaluate((input) => input.click());
    await page.locator(`input[name="${name}"]`).evaluate((input) => input.click());
  }
  await page.locator("#earth-settings").evaluate((panel) => { panel.open = true; });
  const speedStates = [];
  for (let index = 0; index < 5; index += 1) {
    await page.locator('button[name="speed"]')
      .evaluate((button) => button.click());
    speedStates.push(await page.locator('button[name="speed"]')
      .getAttribute("data-state"));
  }
  assert.deepEqual(speedStates,
    ["fast", "fastest", "superfast", "off", "normal"]);
  assert.deepEqual(external, []);
  assert.equal(requestedAssets.some((pathname) =>
    pathname.includes("earth-moon-")), false);
  assert.deepEqual(problems, []);
  if (process.env.EARTH_SCREENSHOT) {
    await page.evaluate(() => window.__earth.pause());
    await page.screenshot({ path: process.env.EARTH_SCREENSHOT });
  }
  for (const name of ["atmosphere"]) {
    await page.locator(`input[name="${name}"]`).evaluate((input) => {
      if (input.checked) input.click();
    });
  }
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent(
    "pagehide",
  )));
  assert.deepEqual(await page.evaluate(() => ({
    stageChildren: document.querySelector(".planet-stage").childElementCount,
    hiddenClasses: [...document.querySelector(".planet-stage").classList]
      .filter((className) => className.startsWith("earth-hide-")),
    playing: document.documentElement.dataset.playing ?? null,
  })), {
    stageChildren: 0,
    hiddenClasses: [],
    playing: null,
  });
  console.log(JSON.stringify({
    ok: true,
    route: "/earth/",
    deviceScaleFactor,
    retainedLeafCount: initial.retainedLeafCount,
  }));
} finally {
  await browser.close();
}
