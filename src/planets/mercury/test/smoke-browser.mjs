import assert from "node:assert/strict";
import { chromium } from "playwright";
import sharp from "sharp";

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
    const requestUrl = new URL(request.url());
    if (requestUrl.origin !== new URL(baseUrl).origin) {
      externalRequests.push(request.url());
    }
  });

  const response = await page.goto(new URL("/mercury/", baseUrl).href, {
    waitUntil: "networkidle",
  });
  assert.equal(response?.status(), 200);
  await page.waitForFunction(() =>
    window.__cssEarth?.ready === true &&
    window.__mercury?.ready === true &&
    document.documentElement.dataset.ready === "true");

  const baseline = await page.evaluate(() => ({
    title: document.title,
    mountedObjectCount: window.__cssEarth.mountedObjectCount,
    activeObjectId: window.__cssEarth.activeObjectId,
    stageCount: document.querySelectorAll(".planet-stage").length,
    stageChildren: document.querySelector(".planet-stage").childElementCount,
    stageElements: document.querySelector(".planet-stage")
      .querySelectorAll("*").length,
    cameraCount: document.querySelectorAll(".polycss-camera").length,
    skyboxFaceCount: document.querySelectorAll(".mercury-skybox-face").length,
    sunCount: document.querySelectorAll(".mercury-sun").length,
    bodyLeafCount: document.querySelectorAll(".mercury-body > s").length,
    interiorLeafCount: document.querySelectorAll(
      ".mercury-cutaway s",
    ).length,
    canvasCount: document.querySelectorAll("canvas").length,
    sceneSvgCount: document.querySelectorAll(".planet-stage svg").length,
    stable: window.__mercury.assertStableDomIdentity(),
    density: window.__mercury.renderStats.textureStats.selectedPreparedDensity,
    interiorMounted: window.__mercury.dom.viewBank().interiorMounted,
    sunBillboardCount: window.__mercury.dom.retainedSunBillboardCount,
    sunCubemapBakeCount: window.__mercury.dom.retainedSunCubemapBakeCount,
  }));
  assert.deepEqual(baseline, {
    title: "Mercury - Powered by PolyCSS",
    mountedObjectCount: 1,
    activeObjectId: "mercury",
    stageCount: 1,
    stageChildren: 4,
    stageElements: 1814,
    cameraCount: 1,
    skyboxFaceCount: 6,
    sunCount: 0,
    bodyLeafCount: 452,
    interiorLeafCount: 446,
    canvasCount: 0,
    sceneSvgCount: 0,
    stable: true,
    density: 2,
    interiorMounted: true,
    sunBillboardCount: 1,
    sunCubemapBakeCount: 0,
  });
  const startupMercuryResources = await page.evaluate(() =>
    performance.getEntriesByType("resource")
      .map(({ name }) => name)
      .filter((name) => name.includes("/scenes/mercury/")));
  assert.equal(startupMercuryResources.some((name) =>
    name.includes("mercury-interior-")), true);
  assert.equal(startupMercuryResources.filter((name) =>
    /mercury-starfield-(?:front|right|back|left|top|bottom)@2x\.webp$/u.test(name)
  ).length, 6);
  assert.equal(startupMercuryResources.some((name) =>
    name.includes("mercury-starfield.webp")), false);

  for (const id of ["enhanced", "topography", "interior", "normal"]) {
    await page.evaluate((lensId) => window.__mercury.lenses.select(lensId), id);
    assert.equal(await page.locator(".planet-stage").evaluate((stage) =>
      stage.dataset.view === "interior"
        ? "interior"
        : stage.dataset.lens || "normal"), id);
    assert.equal(await page.locator(
      'button[name="lens"][aria-pressed="true"]',
    ).getAttribute("value"), id);
    assert.equal(await page.evaluate(() =>
      window.__mercury.assertStableDomIdentity()), true);
  }
  assert.deepEqual(await page.evaluate(() => ({
    elements: document.querySelector(".planet-stage").querySelectorAll("*").length,
    interiorLeaves: document.querySelectorAll(".mercury-cutaway s").length,
    viewBank: window.__mercury.dom.viewBank(),
  })), {
    elements: 1814,
    interiorLeaves: 446,
    viewBank: {
      interiorMounted: true,
      retainedInteriorNodeCount: 894,
    },
  });

  await page.evaluate(() => {
    document.querySelector(".mercury-material-root").style.visibility = "hidden";
    window.__mercury.lenses.select("enhanced");
  });
  for (const controlPitch of [0, 89]) {
    await page.evaluate((pitch) => window.__mercury.camera.setState({
      controlPitch: pitch,
      zoom: 1.1,
    }), controlPitch);
    await nextPaint(page);
    const disc = await page.locator(".mercury-material").boundingBox();
    assert.ok(disc);
    const image = await page.screenshot({ clip: disc });
    assert.ok(await neutralDarkDiscFraction(image) < 0.005);
  }
  await page.evaluate(() => {
    document.querySelector(".mercury-material-root")
      .style.removeProperty("visibility");
  });

  const matrixStates = [];
  for (const [controlPitch, controlYaw] of [
    [34.1, 0],
    [34.11, 17.5],
    [-120, 433],
  ]) {
    matrixStates.push(await page.evaluate(([pitch, yaw]) => {
      window.__mercury.camera.setState({
        controlPitch: pitch,
        controlYaw: yaw,
      });
      return {
        scene: document.querySelector(".mercury-scene").style.transform,
        sky: document.querySelector(".mercury-skybox-orientation")
          .style.transform,
        state: window.__mercury.camera.state(),
      };
    }, [controlPitch, controlYaw]));
  }
  assert.equal(new Set(matrixStates.map(({ scene }) => scene)).size, 3);
  assert.equal(new Set(matrixStates.map(({ sky }) => sky)).size, 3);
  assert.equal(matrixStates[2].state.controlPitch, -120);
  assert.equal(matrixStates[2].state.controlYaw, 433);
  assert.deepEqual(await page.evaluate(() => ({
    pitchBounded: window.__mercury.camera.stats().pitchBounded,
    yawBounded: window.__mercury.camera.stats().yawBounded,
    cameraModel: window.__mercury.camera.stats().cameraModel,
  })), {
    pitchBounded: false,
    yawBounded: false,
    cameraModel: "accumulated-matrix3d",
  });
  const stress = await page.evaluate(() => {
    let poses = 0;
    for (const controlPitch of [-240, -120, -45, 0, 89, 180, 315]) {
      for (let controlYaw = -360; controlYaw <= 360; controlYaw += 30) {
        for (const zoom of [0.55, 1.1, 2.6]) {
          window.__mercury.camera.setState({
            controlPitch,
            controlYaw,
            zoom,
          });
          const scene = document.querySelector(".mercury-scene")
            .style.transform;
          const sky = document.querySelector(".mercury-skybox-orientation")
            .style.transform;
          if (!scene.includes("matrix3d(") || !sky.includes("matrix3d(") ||
              /NaN|Infinity/u.test(`${scene}${sky}`)) {
            throw new Error(
              `Mercury camera matrix failed at ${controlPitch}/${controlYaw}.`,
            );
          }
          poses += 1;
        }
      }
    }
    return {
      poses,
      stable: window.__mercury.assertStableDomIdentity(),
    };
  });
  assert.deepEqual(stress, { poses: 525, stable: true });
  const skyboxZoomBefore = await page.locator(".mercury-skybox").evaluate(
    (element) => element.style.getPropertyValue("--mercury-skybox-zoom"),
  );
  await page.evaluate(() => window.__mercury.camera.setState({ zoom: 2.2 }));
  const skyboxZoomAfter = await page.locator(".mercury-skybox").evaluate(
    (element) => element.style.getPropertyValue("--mercury-skybox-zoom"),
  );
  assert.equal(
    skyboxZoomAfter,
    skyboxZoomBefore,
    "Planet dolly zoom must not resize the sky at infinity.",
  );

  const shadowlessState = await page.evaluate(() => ({
    checked: document.querySelector('input[name="shadows"]').checked,
    overlayVisibility: getComputedStyle(
      document.querySelector(".mercury-material-root"),
    ).visibility,
    ...window.__mercury.sky.state(),
  }));
  assert.equal(shadowlessState.checked, false);
  assert.equal(shadowlessState.overlayVisibility, "visible");
  assert.equal(shadowlessState.materialMode, "full-phase-curvature");
  assert.equal(shadowlessState.materialFrame, 255);

  await page.locator('input[name="shadows"]').evaluate((control) => {
    control.checked = true;
    control.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const sunSweep = await page.evaluate(() => {
    const pitch = window.__mercury.camera.stats().defaultControlPitchDegrees;
    const samples = [];
    for (let yaw = -105; yaw <= 255; yaw += 15) {
      window.__mercury.camera.setState({ controlPitch: pitch, controlYaw: yaw });
      samples.push({ yaw, ...window.__mercury.sky.state() });
    }
    return samples;
  });
  assert.equal(sunSweep.length, 25);
  assert.ok(Math.min(...sunSweep.map(({ sunViewDirection }) =>
    sunViewDirection[2])) < -0.75);
  assert.ok(Math.max(...sunSweep.map(({ sunViewDirection }) =>
    sunViewDirection[2])) > 0.75);
  assert.ok(sunSweep.some(({ sunVisible }) => sunVisible));
  assert.ok(sunSweep.some(({ sunVisible }) => !sunVisible));
  assert.ok(Math.min(...sunSweep.map(({ materialFrame }) => materialFrame)) < 40);
  assert.ok(Math.max(...sunSweep.map(({ materialFrame }) => materialFrame)) > 215);
  for (const sample of sunSweep) {
    const expectedFrame = Math.round(
      (sample.sunViewDirection[2] + 1) / 2 * 255,
    );
    assert.equal(sample.materialFrame, expectedFrame);
    assert.ok(Number.isFinite(sample.materialLightRollDegrees));
  }
  await page.locator('input[name="shadows"]').evaluate((control) => {
    control.checked = false;
    control.dispatchEvent(new Event("change", { bubbles: true }));
  });
  assert.equal(await page.locator(".mercury-material-root").evaluate(
    (element) => getComputedStyle(element).visibility,
  ), "visible");

  await page.evaluate(() => window.__mercury.lenses.select("interior"));
  await page.evaluate(() => window.__mercury.camera.setState({
    controlPitch: window.__mercury.camera.stats().defaultControlPitchDegrees,
    controlYaw: window.__mercury.camera.stats().defaultControlYawDegrees,
    zoom: 1.1,
  }));
  await nextPaint(page);
  const interiorDisc = await page.locator(".mercury-material").boundingBox();
  assert.ok(interiorDisc);
  const interiorMetrics = await interiorContinuity(await page.screenshot({
    clip: interiorDisc,
  }));
  assert.ok(interiorMetrics.orangePixels > 15_000);
  assert.ok(interiorMetrics.shellPixels > 5_000);
  assert.ok(interiorMetrics.orangeGapFraction < 0.01);
  await page.evaluate(() => window.__mercury.camera.setState({ controlPitch: 0 }));
  await nextPaint(page);
  const interiorLowMetrics = await interiorContinuity(await page.screenshot({
    clip: interiorDisc,
  }));
  await page.evaluate(() => window.__mercury.camera.setState({ controlPitch: 89 }));
  await nextPaint(page);
  const interiorHighMetrics = await interiorContinuity(await page.screenshot({
    clip: interiorDisc,
  }));
  assert.ok(interiorLowMetrics.orangePixels > 15_000);
  assert.ok(interiorHighMetrics.orangePixels > 15_000);
  assert.ok(interiorHighMetrics.orangePixels >
    interiorLowMetrics.orangePixels * 0.35);
  await page.evaluate(() => window.__mercury.lenses.select("normal"));
  await page.evaluate(() => window.__mercury.camera.setState({
    controlPitch: window.__mercury.camera.stats().defaultControlPitchDegrees,
    controlYaw: window.__mercury.camera.stats().defaultControlYawDegrees,
    zoom: 1.1,
  }));

  const originalCamera = await page.evaluate(() => window.__mercury.camera.state());
  await drag(page, ".mercury-input-surface", 0, 150);
  const draggedCamera = await page.evaluate(() => window.__mercury.camera.state());
  assert.ok(draggedCamera.controlPitch > originalCamera.controlPitch);
  await page.evaluate((state) => window.__mercury.camera.setState(state),
    originalCamera);
  await drag(page, ".mercury-input-surface", 220, -80);
  const diagonalCamera = await page.evaluate(() =>
    window.__mercury.camera.state());
  assert.notEqual(diagonalCamera.controlPitch, originalCamera.controlPitch);
  assert.notEqual(diagonalCamera.controlYaw, originalCamera.controlYaw);
  await page.evaluate((state) => window.__mercury.camera.setState(state),
    originalCamera);
  await wheel(page, ".mercury-input-surface", -240);
  assert.ok((await page.evaluate(() => window.__mercury.camera.state())).zoom >
    originalCamera.zoom);

  assert.equal(await page.locator(".planet-stage").evaluate((stage) =>
    stage.childElementCount), baseline.stageChildren);
  assert.equal(await page.locator(".planet-stage").evaluate((stage) =>
    stage.querySelectorAll("*").length), 1814);
  assert.equal(await page.evaluate(() =>
    window.__mercury.assertStableDomIdentity()), true);
  assert.deepEqual(externalRequests, []);
  assert.deepEqual(problems, []);

  const dpr2Context = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    deviceScaleFactor: 2,
  });
  try {
    const dpr2Page = await dpr2Context.newPage();
    await dpr2Page.goto(new URL("/mercury/", baseUrl).href, {
      waitUntil: "networkidle",
    });
    await dpr2Page.waitForFunction(() =>
      window.__mercury?.ready === true &&
      document.documentElement.dataset.ready === "true");
    assert.equal(await dpr2Page.evaluate(() =>
      window.__mercury.renderStats.textureStats.selectedPreparedDensity), 2);
    assert.equal(await dpr2Page.evaluate(() => performance
      .getEntriesByType("resource")
      .map(({ name }) => name)
      .filter((name) =>
        /mercury-starfield-(?:front|right|back|left|top|bottom)@2x\.webp$/u
          .test(name)).length), 6);
    assert.equal(await dpr2Page.evaluate(() =>
      window.__mercury.assertStableDomIdentity()), true);
  } finally {
    await dpr2Context.close();
  }

  console.log(JSON.stringify({
    ok: true,
    route: "/mercury/",
    retainedNodes: baseline.stageElements,
    stressedCameraPoses: stress.poses,
    provenPreparedDensities: [1, 2],
    externalRequests: 0,
    browserProblems: 0,
  }));
} finally {
  await browser.close();
}

async function drag(page, selector, deltaX, deltaY) {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box);
  const x = box.x + box.width * 0.72;
  const y = box.y + box.height * 0.5;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + deltaX, y + deltaY, { steps: 12 });
  await page.mouse.up();
}

async function wheel(page, selector, deltaY) {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box);
  await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.5);
  await page.mouse.wheel(0, deltaY);
  await nextPaint(page);
}

async function nextPaint(page) {
  await page.evaluate(() => new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function neutralDarkDiscFraction(image) {
  const { data, info } = await sharp(image).raw().toBuffer({
    resolveWithObject: true,
  });
  const centerX = info.width / 2;
  const centerY = info.height / 2;
  // The prepared lighting plane includes transparent registration padding.
  // Inspect the retained globe's inner disc, where a dark neutral pixel is a
  // real surface-mesh gap rather than the photographic sky behind the plane.
  const radius = Math.min(centerX, centerY) * 0.74;
  let samples = 0;
  let neutralDark = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (Math.hypot(x - centerX, y - centerY) > radius) continue;
      const offset = (y * info.width + x) * info.channels;
      const maximum = Math.max(data[offset], data[offset + 1], data[offset + 2]);
      const minimum = Math.min(data[offset], data[offset + 1], data[offset + 2]);
      samples += 1;
      if (maximum <= 18 && maximum - minimum <= 6) neutralDark += 1;
    }
  }
  return neutralDark / samples;
}

async function interiorContinuity(image) {
  const { data, info } = await sharp(image).raw().toBuffer({
    resolveWithObject: true,
  });
  const orange = new Uint8Array(info.width * info.height);
  let orangePixels = 0;
  let shellPixels = 0;
  let minimumX = info.width;
  let maximumX = -1;
  let minimumY = info.height;
  let maximumY = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      if (red > 70 && red > green * 1.2 && green > blue * 1.15) {
        orange[y * info.width + x] = 1;
        orangePixels += 1;
        minimumX = Math.min(minimumX, x);
        maximumX = Math.max(maximumX, x);
        minimumY = Math.min(minimumY, y);
        maximumY = Math.max(maximumY, y);
      }
      if (Math.max(red, green, blue) - Math.min(red, green, blue) < 22 &&
          (red + green + blue) / 3 > 35) {
        shellPixels += 1;
      }
    }
  }
  let orangeSpanPixels = 0;
  let orangeGapPixels = 0;
  for (let y = minimumY; y <= maximumY; y += 1) {
    let first = -1;
    let last = -1;
    for (let x = minimumX; x <= maximumX; x += 1) {
      if (!orange[y * info.width + x]) continue;
      if (first < 0) first = x;
      last = x;
    }
    if (first < 0 || last - first <= 30) continue;
    for (let x = first; x <= last; x += 1) {
      orangeSpanPixels += 1;
      if (!orange[y * info.width + x]) orangeGapPixels += 1;
    }
  }
  return {
    orangePixels,
    shellPixels,
    orangeGapFraction: orangeGapPixels / orangeSpanPixels,
  };
}
