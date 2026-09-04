import assert from "node:assert/strict";

import { chromium } from "playwright";
import { GOOGLE_EARTH_DRAG_INERTIA } from
  "../../../platform/google-earth-drag-inertia.mjs";
import { PREPARED_VENUS_SCENE } from "../runtime/preparedScene.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const browserProblems = [];
  const externalRequests = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
      externalRequests.push(request.url());
    }
  });
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      browserProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => browserProblems.push(`pageerror: ${error.message}`));

  const response = await page.goto(new URL("/venus/", baseUrl).href, {
    waitUntil: "networkidle",
  });
  assert.equal(response?.status(), 200);
  await page.waitForFunction(() =>
    window.__cssEarth?.ready === true &&
    window.__venus?.ready === true &&
    document.documentElement.dataset.ready === "true");

  const baseline = await runtimeState(page);
  assert.deepEqual(baseline, {
    title: "Venus - Powered by PolyCSS",
    activeObjectId: "venus",
    mountedObjectCount: 1,
    stageCount: 1,
    cameraCount: 1,
    stageChildCount: 4,
    stageElementCount: 914,
    skyboxCount: 1,
    skyboxFaceCount: 6,
    sunBillboardCount: 1,
    sunCubemapBakeCount: 0,
    materialCompositeRootCount: 1,
    cameraMaterialCount: 0,
    retainedLeafCount: 450,
    stableDomIdentity: true,
    animationCount: 1,
    canvasCount: 0,
    sceneSvgCount: 0,
    lens: { id: "clouds", ready: true },
    features: { atmosphere: true, shadows: false, stars: true },
    options: { speed: 1 },
  });
  assert.deepEqual(await page.evaluate(() => ({
    ...window.__venus.camera.state(),
    renderedPitch: Number(document.querySelector(".polycss-camera")
      ?.dataset.polycssCameraRotX),
  })), {
    controlPitch: 34.230769230769226,
    controlYaw: -105,
    zoom: 1.6196,
    renderedPitch: 40,
  });
  const defaultLight = await page.evaluate(() => window.__venus.material.state());
  assert.equal(defaultLight.frame, 31);
  assert.equal(defaultLight.shadowsEnabled, false);
  assert.ok((defaultLight.sunViewDirection[2] + 1) / 2 > 0.9);

  assert.equal(await page.locator("#venus-surface-photographs").count(), 0);
  assert.equal(await page.evaluate(() => window.__venus.assertStableDomIdentity()), true);
  assert.equal((await runtimeState(page)).stageElementCount,
    baseline.stageElementCount);
  for (const [controlPitch, renderedPitch] of [[0, 65], [89, 0],
    [34.230769230769226, 40]]) {
    await page.evaluate(({ pitch, zoom }) => window.__venus.camera.setState({
      controlPitch: pitch,
      zoom,
    }), { pitch: controlPitch, zoom: 1.1 });
    assert.equal(await page.locator(".polycss-camera").evaluate(
      (element) => Number(element.dataset.polycssCameraRotX)), renderedPitch);
  }
  const initialSkyboxTransform = await page.locator(".venus-skybox-orientation")
    .evaluate((element) => element.style.transform ||
      getComputedStyle(element).transform);
  await page.evaluate(() => window.__venus.camera.setState({ controlYaw: 37 }));
  assert.equal(await page.locator(".polycss-camera").evaluate(
    (element) => Number(element.dataset.polycssCameraRotY)), 37);
  assert.notEqual(await page.locator(".venus-skybox-orientation").evaluate(
    (element) => element.style.transform || getComputedStyle(element).transform),
  initialSkyboxTransform);
  await page.evaluate(() => window.__venus.camera.setState({ controlYaw: 0 }));
  assert.deepEqual(await page.evaluate(() => {
    const stats = window.__venus.camera.stats();
    return {
      minimumPitchDegrees: stats.minimumPitchDegrees,
      maximumPitchDegrees: stats.maximumPitchDegrees,
      defaultControlPitchDegrees: stats.defaultControlPitchDegrees,
      defaultControlYawDegrees: stats.defaultControlYawDegrees,
      pitchBounded: stats.pitchBounded,
      yawBounded: stats.yawBounded,
      cameraModel: stats.cameraModel,
      responsiveFitModel: stats.responsiveFitModel,
      responsiveWidthShare: Number(stats.responsiveWidthShare.toFixed(4)),
      responsiveBaseZoom: Number(stats.responsiveBaseZoom.toFixed(4)),
    };
  }), {
    minimumPitchDegrees: 0,
    maximumPitchDegrees: 89,
    defaultControlPitchDegrees: 34.230769230769226,
    defaultControlYawDegrees: -105,
    pitchBounded: false,
    yawBounded: false,
    cameraModel: "accumulated-matrix3d",
    responsiveFitModel: "continuous-aspect-smoothstep",
    responsiveWidthShare: 0.36,
    responsiveBaseZoom: 1.6196,
  });
  assert.match(await page.locator(".polycss-scene").evaluate(
    (element) => element.style.transform), /^scale\([^)]*\) matrix3d\(/u);
  assert.match(await page.locator(".venus-skybox-cube").evaluate(
    (element) => element.style.getPropertyValue("--venus-skybox-orientation")),
  /^matrix3d\(/u);
  assert.equal(await page.locator(".venus-sun-billboard").count(), 0);
  assert.equal(await page.locator(".venus-sun-layer").count(), 0);
  assert.equal(await page.locator(".planet-stage > .planet-render-root").count(), 2);
  assert.equal(await page.locator(".venus-fixed-material").evaluate(
    (element) => element.parentElement?.classList.contains(
      "venus-material-composite")), true);
  assert.equal(await page.locator(".venus-fixed-material").evaluate(
    (element) => element.closest(".planet-render-root") ===
      document.querySelector(".venus-material-composite")), true);
  assert.equal((await page.locator(".venus-skybox-face").evaluateAll(
    (elements) => elements.every((element) =>
      getComputedStyle(element).backgroundImage.includes("venus-starfield")))),
  true);
  const skyboxZoomProof = await page.evaluate(() => {
    const skybox = document.querySelector(".venus-skybox");
    window.__venus.camera.setState({ zoom: 1.9 });
    const initial = Number(skybox.style.getPropertyValue("--venus-skybox-zoom"));
    window.__venus.camera.setState({ zoom: 3.8 });
    const doubled = Number(skybox.style.getPropertyValue("--venus-skybox-zoom"));
    window.__venus.camera.setState({ zoom: 1.9 });
    return { initial, doubled };
  });
  assert.deepEqual(skyboxZoomProof, { initial: 1, doubled: 1 });
  for (const [controlPitch, controlYaw] of [[240, 540], [-240, -540]]) {
    const freeOrbit = await page.evaluate(({ pitch, yaw }) => {
      window.__venus.camera.setState({ controlPitch: pitch, controlYaw: yaw });
      return {
        ...window.__venus.camera.state(),
        renderedPitch: Number(document.querySelector(".polycss-camera")
          ?.dataset.polycssCameraRotX),
        renderedYaw: Number(document.querySelector(".polycss-camera")
          ?.dataset.polycssCameraRotY),
      };
    }, { pitch: controlPitch, yaw: controlYaw });
    assert.equal(freeOrbit.controlPitch, controlPitch);
    assert.equal(freeOrbit.controlYaw, controlYaw);
    assert.equal(freeOrbit.renderedYaw, controlYaw);
    assert.ok(Math.abs(freeOrbit.renderedPitch - expectedRenderedPitch(controlPitch)) <
      0.001);
  }
  await page.evaluate(() => window.__venus.camera.setState({
    controlPitch: 34.230769230769226,
    controlYaw: 0,
  }));
  await page.locator('.planet-settings input[name="shadows"]').evaluate(
    (element) => element.click());
  const wrappedPitchSun = await page.evaluate(() => {
    window.__venus.camera.setState({
      controlPitch: -360,
      controlYaw: 0,
      zoom: 1.1,
    });
    return {
      material: window.__venus.material.state(),
    };
  });
  const materialPlan = PREPARED_VENUS_SCENE.material;
  assert.equal(wrappedPitchSun.material.frame, Math.round(
    (wrappedPitchSun.material.sunViewDirection[2] -
      materialPlan.minimumLightViewZ) /
      (materialPlan.maximumLightViewZ - materialPlan.minimumLightViewZ) *
      (materialPlan.directionalFrameCount - 1),
  ));
  assert.ok(wrappedPitchSun.material.sunViewDirection[0] > 0);
  assert.ok(wrappedPitchSun.material.sunViewDirection[2] < 0);
  const shadowMotionContinuity = await page.evaluate(() => {
    const samples = [];
    for (let controlPitch = -360; controlPitch <= 360; controlPitch += 2) {
      window.__venus.camera.setState({ controlPitch, controlYaw: 0 });
      samples.push(window.__venus.material.state());
    }
    let maximumDirectionDelta = 0;
    let maximumRollDelta = 0;
    for (let index = 1; index < samples.length; index += 1) {
      const previous = samples[index - 1];
      const current = samples[index];
      maximumDirectionDelta = Math.max(
        maximumDirectionDelta,
        Math.hypot(...current.sunViewDirection.map((value, axis) =>
          value - previous.sunViewDirection[axis])),
      );
      const rollDelta = (current.lightRollDegrees -
        previous.lightRollDegrees + 540) % 360 - 180;
      maximumRollDelta = Math.max(maximumRollDelta, Math.abs(rollDelta));
    }
    return { maximumDirectionDelta, maximumRollDelta };
  });
  assert.ok(shadowMotionContinuity.maximumDirectionDelta < 0.04);
  assert.ok(shadowMotionContinuity.maximumRollDelta < 3.2);
  const horizontalShadowMotion = await page.evaluate(() => {
    window.__venus.camera.setState({
      controlPitch: 34.230769230769226,
      controlYaw: 0,
    });
    const initial = window.__venus.material.state();
    window.__venus.camera.setState({ controlYaw: 30 });
    return { initial, moved: window.__venus.material.state() };
  });
  assert.ok(horizontalShadowMotion.moved.frame <
    horizontalShadowMotion.initial.frame);
  assert.ok(horizontalShadowMotion.moved.sunViewDirection[2] <
    horizontalShadowMotion.initial.sunViewDirection[2]);
  await page.evaluate(() => window.__venus.camera.setState({
    controlPitch: 34.230769230769226,
    controlYaw: 0,
  }));

  assert.deepEqual(await page.locator('button[name="lens"]').evaluateAll(
    (buttons) => buttons.map((button) => button.value)),
  ["clouds", "radar", "elevation"]);
  for (const lens of ["radar", "elevation", "clouds"]) {
    await page.locator(`button[name="lens"][value="${lens}"]`)
      .evaluate((button) => button.click());
    await page.waitForFunction((id) =>
      document.querySelector(".planet-stage")?.dataset.lens === id, lens);
    assert.equal(await page.locator(".planet-stage").getAttribute("data-lens"), lens);
    const materialAsset = await page.locator(".venus-fixed-material").evaluate(
      (element) => getComputedStyle(element).backgroundImage,
    );
    assert.match(materialAsset, lens === "clouds"
      ? /venus-material/u
      : /venus-observation-material/u);
    assert.equal(await page.evaluate(() =>
      window.__venus.renderStats.textureStats.retainedInteractiveImageCount), 3);
    assert.equal(await page.evaluate(() => window.__venus.assertStableDomIdentity()), true);
    assert.equal((await runtimeState(page)).stageElementCount,
      baseline.stageElementCount);
  }

  const settings = page.locator(".planet-settings");
  for (const [name, className] of [
    ["atmosphere", "venus-hide-atmosphere"],
    ["stars", "venus-hide-stars"],
  ]) {
    const input = settings.locator(`input[name="${name}"]`);
    await input.evaluate((element) => element.click());
    assert.equal(await page.locator(".planet-stage").evaluate(
      (stage, hiddenClass) => stage.classList.contains(hiddenClass), className), true);
    if (name === "atmosphere") {
      assert.match(await page.locator(".venus-fixed-material").evaluate(
        (element) => getComputedStyle(element).backgroundImage),
      /venus-lighting/u);
    } else {
      assert.equal(await page.locator(".venus-skybox").evaluate(
        (element) => getComputedStyle(element).visibility), "hidden");
    }
    await input.evaluate((element) => element.click());
    if (name === "atmosphere") {
      assert.match(await page.locator(".venus-fixed-material").evaluate(
        (element) => getComputedStyle(element).backgroundImage),
      /venus-material/u);
    }
  }

  const speed = settings.locator('button[name="speed"]');
  for (const [value, label] of [[2, "fast"], [3, "fastest"], [4, "superfast"],
    [0, "off"], [1, "normal"]]) {
    await speed.evaluate((element) => element.click());
    assert.deepEqual(await page.evaluate(() => window.__venus.options.state()),
      { speed: value });
    assert.equal(await speed.getAttribute("data-state"), label);
  }

  await page.evaluate(() => window.__venus.camera.setState({
    controlPitch: 34.230769230769226,
    controlYaw: -105,
    zoom: 1,
  }));
  assert.equal(await page.evaluate(() => window.__venus.features.state().shadows),
    true);
  const initialMaterialState = await page.evaluate(() =>
    window.__venus.material.state());
  assert.equal(initialMaterialState.frame, Math.round(
    (initialMaterialState.sunViewDirection[2] -
      materialPlan.minimumLightViewZ) /
      (materialPlan.maximumLightViewZ - materialPlan.minimumLightViewZ) *
      (materialPlan.directionalFrameCount - 1),
  ));
  assert.ok(Math.abs(Math.hypot(...initialMaterialState.sunViewDirection) - 1) <
    1e-9);
  assert.ok(Number.isFinite(initialMaterialState.lightRollDegrees));
  // At zoom 1, 150 px turns about 44.5 degrees and is not a short pitch.
  // Keep this local-lighting check below 9 degrees; wide drags follow below.
  await drag(page, 0, 30);
  assert.ok((await page.evaluate(() => window.__venus.camera.state().controlPitch)) >
    34.230769230769226);
  const materialAfterShortPitch = await page.evaluate(() =>
    window.__venus.material.state());
  assert.ok(Math.abs(
    materialAfterShortPitch.frame - initialMaterialState.frame,
  ) <= 1);
  assert.notDeepEqual(
    materialAfterShortPitch.sunViewDirection,
    initialMaterialState.sunViewDirection,
  );
  await drag(page, 0, 300);
  await drag(page, 0, 300);
  const pointerPitchAboveReference = await page.evaluate(() =>
    window.__venus.camera.state().controlPitch);
  assert.ok(pointerPitchAboveReference > 89);
  assert.notEqual(await page.evaluate(() => window.__venus.material.state().frame),
    initialMaterialState.frame);
  await page.evaluate(() => window.__venus.camera.setState({
    controlPitch: 34.230769230769226,
  }));
  await drag(page, 0, -300);
  await drag(page, 0, -300);
  const pointerPitchBelowReference = await page.evaluate(() =>
    window.__venus.camera.state().controlPitch);
  assert.ok(pointerPitchBelowReference < 0);
  await settings.locator('input[name="shadows"]').evaluate(
    (element) => element.click());
  assert.deepEqual(await page.locator(".venus-fixed-material").evaluate(
    (element) => ({
      visibility: getComputedStyle(element).visibility,
      display: getComputedStyle(element).display,
    })), { visibility: "visible", display: "block" });
  assert.equal(await page.evaluate(() => window.__venus.material.state().frame), 31);

  await page.evaluate(() => window.__venus.pause());
  assert.equal(await page.locator(".planet-stage").evaluate((stage) =>
    stage.getAnimations({ subtree: true }).every(({ playState }) => playState === "paused")),
  true);

  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
  assert.equal(await page.locator(".venus-input-surface").evaluate((node) =>
    getComputedStyle(node).touchAction), "pan-y");
  await page.setViewportSize({ width: 1440, height: 900 });
  assert.equal(await page.evaluate(() => window.__venus.assertStableDomIdentity()), true);

  assert.deepEqual(externalRequests, []);
  assert.deepEqual(browserProblems, []);
  assert.deepEqual(await provePreparedDensity(browser), [
    {
      density: 1,
      selectedDensity: 2,
      requestedMaterial: "/scenes/venus/venus-observation-material@2x.webp",
      requestedStarfield: "/scenes/venus/venus-starfield-front@2x.webp",
    },
    {
      density: 2,
      selectedDensity: 2,
      requestedMaterial: "/scenes/venus/venus-observation-material@2x.webp",
      requestedStarfield: "/scenes/venus/venus-starfield-front@2x.webp",
    },
  ]);
  const responsiveZoomReports = await proveResponsiveZoomProfiles(browser);
  assert.deepEqual(responsiveZoomReports.map(({ width, height, fitModel }) => ({
    width,
    height,
    fitModel,
  })), [
    { width: 1200, height: 800,
      fitModel: "continuous-aspect-smoothstep" },
    { width: 1280, height: 720,
      fitModel: "continuous-aspect-smoothstep" },
    { width: 1414, height: 1237,
      fitModel: "continuous-aspect-smoothstep" },
    { width: 960, height: 720,
      fitModel: "continuous-aspect-smoothstep" },
    { width: 680, height: 900,
      fitModel: "continuous-aspect-smoothstep" },
    { width: 390, height: 844,
      fitModel: "continuous-aspect-smoothstep" },
  ]);
  assert.ok(between(responsiveZoomReports[0].widthShare, 0.359, 0.361));
  assert.ok(between(responsiveZoomReports[1].heightShare, 0.609, 0.611));
  assert.ok(between(responsiveZoomReports[2].widthShare, 0.359, 0.361));
  assert.ok(between(responsiveZoomReports[3].widthShare, 0.359, 0.361));
  assert.ok(Math.abs(responsiveZoomReports[3].sceneCenterOffset) <= 6);
  assert.ok(between(responsiveZoomReports[4].widthShare, 0.339, 0.341));
  assert.ok(between(responsiveZoomReports[5].widthShare, 0.41, 0.43));
  assert.deepEqual(await proveResponsiveFitContinuity(browser), {
    maximumDiameterStep: 0.4,
    mobileModes: [true, true, true],
    stableDomIdentity: true,
  });
  assert.deepEqual(await proveMobilePreviewFit(browser), [
    { width: 681, height: 720, clearance: 9.5 },
    { width: 820, height: 768, clearance: 10.1 },
    { width: 820, height: 650, clearance: 8.5 },
  ]);
  assert.deepEqual(await proveResponsiveZoomResize(browser), {
    fitModel: "continuous-aspect-smoothstep",
    initialRatio: 1,
    preservedUserRatio: 1.051,
    stableDomIdentity: true,
  });
  assert.deepEqual(await proveStartupFailureCleanup(browser), {
    lifecycle: "error",
    mountedObjectCount: 0,
    stageChildCount: 0,
    stageClassName: "planet-stage example-stage",
    stageLens: null,
    lensesLoading: false,
    playing: null,
  });
  console.log(JSON.stringify({
    ok: true,
    route: "/venus/",
    freeOrbit: {
      pointerPitchAboveReference,
      pointerPitchBelowReference,
    },
    retainedLeafCount: baseline.retainedLeafCount,
    stageElementCount: baseline.stageElementCount,
    externalRequests: 0,
    browserProblems: 0,
  }));
} finally {
  await browser.close();
}

function expectedRenderedPitch(controlPitch) {
  const defaultControlPitch = 34.230769230769226;
  return 40 * (1 - (controlPitch - defaultControlPitch) /
    (89 - defaultControlPitch));
}

async function provePreparedDensity(browser) {
  const reports = [];
  for (const density of [1, 2]) {
    const context = await browser.newContext({
      viewport: { width: 960, height: 720 },
      deviceScaleFactor: density,
    });
    const page = await context.newPage();
    const requests = [];
    page.on("request", (request) => requests.push(new URL(request.url()).pathname));
    await page.goto(new URL("/venus/", baseUrl).href, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__venus?.ready === true);
    await page.evaluate(() => window.__venus.lenses.select("radar"));
    const expectedMaterial =
      "/scenes/venus/venus-observation-material@2x.webp";
    const rejectedMaterial = "/scenes/venus/venus-observation-material.webp";
    const expectedStarfield =
      "/scenes/venus/venus-starfield-front@2x.webp";
    const rejectedStarfield = "/scenes/venus/venus-starfield-front.webp";
    assert.ok(requests.includes(expectedMaterial));
    assert.equal(requests.includes(rejectedMaterial), false);
    assert.ok(requests.includes(expectedStarfield));
    assert.equal(requests.includes(rejectedStarfield), false);
    reports.push({
      density,
      selectedDensity: await page.evaluate(() =>
        window.__venus.renderStats.textureStats.selectedPreparedDensity),
      requestedMaterial: expectedMaterial,
      requestedStarfield: expectedStarfield,
    });
    await context.close();
  }
  return reports;
}

async function proveResponsiveZoomProfiles(browser) {
  const reports = [];
  for (const [width, height] of [
    [1200, 800],
    [1280, 720],
    [1414, 1237],
    [960, 720],
    [680, 900],
    [390, 844],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(new URL("/venus/", baseUrl).href, {
      waitUntil: "networkidle",
    });
    await page.waitForFunction(() => window.__venus?.ready === true);
    reports.push(await page.evaluate(({ viewportWidth, viewportHeight }) => {
      const root = document.querySelector(".polycss-camera");
      const stage = document.querySelector(".planet-stage");
      const sidebar = document.querySelector(".planet-sidebar");
      const zoom = window.__venus.camera.state().zoom;
      const cameraStats = window.__venus.camera.stats();
      const rootBounds = root.getBoundingClientRect();
      const stageBounds = stage.getBoundingClientRect();
      const sidebarBounds = sidebar?.getBoundingClientRect();
      const rootScale = rootBounds.width / stageBounds.width;
      const bodyDiameter = 496 * zoom * rootScale;
      const sidePanel = sidebarBounds?.width < viewportWidth * 0.75;
      const sidebarRight = sidePanel ? sidebarBounds?.right ?? 0 : 0;
      const unobstructedSceneWidth = viewportWidth - sidebarRight;
      const sceneCenter = rootBounds.left + rootBounds.width / 2;
      const availableCenter = sidePanel
        ? (sidebarRight + viewportWidth) / 2
        : viewportWidth / 2;
      return {
        width: viewportWidth,
        height: viewportHeight,
        zoom,
        fitModel: cameraStats.responsiveFitModel,
        widthShare: Number((bodyDiameter / viewportWidth).toFixed(3)),
        heightShare: Number((bodyDiameter / viewportHeight).toFixed(3)),
        unobstructedSceneShare: Number((bodyDiameter /
          unobstructedSceneWidth).toFixed(3)),
        sceneCenterOffset: Number((sceneCenter - availableCenter).toFixed(3)),
      };
    }, { viewportWidth: width, viewportHeight: height }));
    await page.close();
  }
  return reports;
}

async function proveResponsiveFitContinuity(browser) {
  const page = await browser.newPage({ viewport: { width: 819, height: 900 } });
  await page.goto(new URL("/venus/", baseUrl).href, {
    waitUntil: "networkidle",
  });
  await page.waitForFunction(() => window.__venus?.ready === true);
  const diameters = [];
  const mobileModes = [];
  for (const width of [819, 820, 821]) {
    if (width !== 819) {
      const previousBaseZoom = await page.evaluate(() =>
        window.__venus.camera.stats().responsiveBaseZoom);
      await page.setViewportSize({ width, height: 900 });
      await page.waitForFunction((previous) =>
        window.__venus.camera.stats().responsiveBaseZoom !== previous,
      previousBaseZoom);
    }
    const sample = await page.evaluate(() => {
      const root = document.querySelector(".polycss-camera");
      const stage = document.querySelector(".planet-stage");
      const sidebar = document.querySelector(".planet-sidebar");
      const input = document.querySelector(".venus-input-surface");
      const rootScale = root.getBoundingClientRect().width /
        stage.getBoundingClientRect().width;
      return {
        diameter: 496 * window.__venus.camera.state().zoom * rootScale,
        mobile: getComputedStyle(sidebar).position === "relative" &&
          getComputedStyle(input).position === "absolute" &&
          getComputedStyle(input).touchAction === "pan-y",
      };
    });
    diameters.push(sample.diameter);
    mobileModes.push(sample.mobile);
  }
  const result = {
    maximumDiameterStep: Number(Math.max(
      Math.abs(diameters[1] - diameters[0]),
      Math.abs(diameters[2] - diameters[1]),
    ).toFixed(1)),
    mobileModes,
    stableDomIdentity: await page.evaluate(() =>
      window.__venus.assertStableDomIdentity()),
  };
  await page.close();
  return result;
}

async function proveMobilePreviewFit(browser) {
  const reports = [];
  for (const [width, height] of [
    [681, 720],
    [820, 768],
    [820, 650],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(new URL("/venus/", baseUrl).href, {
      waitUntil: "networkidle",
    });
    await page.waitForFunction(() => window.__venus?.ready === true);
    reports.push(await page.evaluate(({ viewportWidth, viewportHeight }) => {
      const rootBounds = document.querySelector(".polycss-camera")
        .getBoundingClientRect();
      const stageBounds = document.querySelector(".planet-stage")
        .getBoundingClientRect();
      const sheetBounds = document.querySelector(".planet-sidebar")
        .getBoundingClientRect();
      const shellScale = rootBounds.width / stageBounds.width;
      const diameter = 496 * window.__venus.camera.state().zoom * shellScale;
      return {
        width: viewportWidth,
        height: viewportHeight,
        clearance: Number(((sheetBounds.top - diameter) / 2).toFixed(1)),
      };
    }, { viewportWidth: width, viewportHeight: height }));
    await page.close();
  }
  return reports;
}

async function proveResponsiveZoomResize(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(new URL("/venus/", baseUrl).href, {
    waitUntil: "networkidle",
  });
  await page.waitForFunction(() => window.__venus?.ready === true);
  const initial = await page.evaluate(() => ({
    zoom: window.__venus.camera.state().zoom,
    baseZoom: window.__venus.camera.stats().responsiveBaseZoom,
  }));
  await page.evaluate((zoom) => window.__venus.camera.setState({ zoom }),
    initial.baseZoom * 1.1);
  await page.setViewportSize({ width: 1414, height: 1237 });
  await page.waitForFunction((previousBaseZoom) =>
    window.__venus.camera.stats().responsiveBaseZoom !== previousBaseZoom,
  initial.baseZoom);
  const result = await page.evaluate(({ initialZoom, initialBaseZoom }) => {
    const stats = window.__venus.camera.stats();
    return {
      fitModel: stats.responsiveFitModel,
      initialRatio: Number((initialZoom / initialBaseZoom).toFixed(3)),
      preservedUserRatio: Number((window.__venus.camera.state().zoom /
        stats.responsiveBaseZoom).toFixed(3)),
      stableDomIdentity: window.__venus.assertStableDomIdentity(),
    };
  }, { initialZoom: initial.zoom, initialBaseZoom: initial.baseZoom });
  await page.close();
  return result;
}

function between(value, minimum, maximum) {
  return value >= minimum && value <= maximum;
}

async function proveStartupFailureCleanup(browser) {
  const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
  await page.route(
    "**/scenes/venus/venus-lighting@2x.webp",
    (route) => route.abort(),
  );
  await page.goto(new URL("/venus/", baseUrl).href);
  await page.waitForFunction(() =>
    window.__cssEarth?.lifecycle === "error" &&
    document.documentElement.dataset.ready === "error");
  const state = await page.evaluate(() => {
    const stage = document.querySelector(".planet-stage");
    return {
      lifecycle: window.__cssEarth.lifecycle,
      mountedObjectCount: window.__cssEarth.mountedObjectCount,
      stageChildCount: stage.childElementCount,
      stageClassName: stage.className,
      stageLens: stage.getAttribute("data-lens"),
      lensesLoading: document.querySelector(".planet-lenses")
        .classList.contains("is-loading"),
      playing: document.documentElement.getAttribute("data-playing"),
    };
  });
  await page.close();
  return state;
}

function runtimeState(page) {
  return page.evaluate(() => ({
    title: document.title,
    activeObjectId: window.__cssEarth?.activeObjectId,
    mountedObjectCount: window.__cssEarth?.mountedObjectCount,
    stageCount: document.querySelectorAll(".planet-stage").length,
    cameraCount: document.querySelectorAll(".polycss-camera").length,
    stageChildCount: document.querySelector(".planet-stage").childElementCount,
    stageElementCount: document.querySelector(".planet-stage")
      .querySelectorAll("*").length,
    retainedLeafCount: window.__venus.dom.retainedLeafCount,
    stableDomIdentity: window.__venus.assertStableDomIdentity(),
    animationCount: document.querySelector(".planet-stage")
      .getAnimations({ subtree: true }).length,
    canvasCount: document.querySelectorAll("canvas").length,
    sceneSvgCount: document.querySelectorAll(".planet-stage svg").length,
    skyboxCount: document.querySelectorAll(".venus-skybox").length,
    skyboxFaceCount: document.querySelectorAll(".venus-skybox-face").length,
    sunBillboardCount: document.querySelectorAll(".venus-directional-sun").length,
    sunCubemapBakeCount: window.__venus.dom.retainedSunCubemapBakeCount,
    materialCompositeRootCount:
      window.__venus.dom.retainedMaterialCompositeRootCount,
    cameraMaterialCount: window.__venus.dom.retainedCameraMaterialCount,
    lens: window.__venus.lenses.state(),
    features: window.__venus.features.state(),
    options: window.__venus.options.state(),
  }));
}

async function drag(page, deltaX, deltaY) {
  const box = await page.locator(".venus-input-surface").boundingBox();
  assert.ok(box);
  const x = box.x + box.width * 0.72;
  const y = box.y + box.height * 0.5;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + deltaX, y + deltaY, { steps: 12 });
  await page.waitForTimeout(
    GOOGLE_EARTH_DRAG_INERTIA.releaseFreshnessMilliseconds + 20,
  );
  await page.mouse.up();
}
