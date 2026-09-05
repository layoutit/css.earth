import assert from "node:assert/strict";
import { chromium } from "playwright";
import sharp from "sharp";

import {
  ICRS_TO_GALACTIC,
  directionFromDegrees,
  transformDirection,
  transposeMatrix,
} from "../../../platform/galactic-frame.mjs";
import { PREPARED_MERCURY_SCENE } from "../runtime/preparedScene.mjs";

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
    interiorMounted: window.__mercury.dom.interiorMounted,
    sunBillboardCount: document.querySelectorAll(".mercury-directional-sun").length,
    sunCubemapBakeCount: Number(document.querySelectorAll(".planet-cubic-sky-face .mercury-directional-sun").length),
    // The planetary system: a retained piece pool for the seven other
    // orbits, one marker per planet and one for the Sun, mounted once.
    systemOrbitPieceCount: window.__mercury.dom.retainedSystemOrbitPieceCount,
    systemMarkerCount: document.querySelectorAll(".mercury-system-marker").length,
    sunMarkerCount: document.querySelectorAll(".mercury-sun-marker").length,
    systemGroupCount: document.querySelectorAll(".planet-heliocentric-system").length,
  }));
  assert.deepEqual(baseline, {
    title: "Mercury - Powered by PolyCSS",
    mountedObjectCount: 1,
    activeObjectId: "mercury",
    stageCount: 1,
    // Sky, Sun root, body camera, material overlay, orbit overlay.
    stageChildren: 5,
    // Sky faces, the Sun billboard, the perspective camera with its body and
    // interior, the billboard disc and the material overlay, and the orbit
    // overlay's piece pool and body marker (2242), plus the planetary
    // system's group, its 1536 orbit pieces (twelve rings), twelve markers
    // with their phase overlays, and the Sun marker (1562).
    stageElements: 3804,
    cameraCount: 1,
    skyboxFaceCount: 6,
    sunCount: 1,
    bodyLeafCount: 452,
    interiorLeafCount: 446,
    canvasCount: 0,
    sceneSvgCount: 0,
    stable: true,
    density: 2,
    interiorMounted: true,
    sunBillboardCount: 1,
    sunCubemapBakeCount: 0,
    systemOrbitPieceCount: 1536,
    systemMarkerCount: 12,
    sunMarkerCount: 1,
    systemGroupCount: 1,
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
    viewBank: { interiorMounted: window.__mercury.dom.interiorMounted, retainedInteriorNodeCount: window.__mercury.dom.retainedInteriorNodeCount },
  })), {
    elements: 3804,
    interiorLeaves: 446,
    viewBank: {
      interiorMounted: true,
      retainedInteriorNodeCount: 894,
    },
  });

  // Await the lens switch: the gap probe below relies on the enhanced
  // colour map, where a neutral dark pixel cannot be surface content.
  await page.evaluate(async () => {
    document.querySelector(".mercury-material-root").style.visibility = "hidden";
    await window.__mercury.lenses.select("enhanced");
  });
  // Probe the equatorial view and a steep southern view. Steeper still and the
  // south polar cap enters the inner disc, whose permanently shadowed craters
  // are legitimately black in the source mosaic.
  for (const controlPitch of [50, 89]) {
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
  await page.waitForFunction(() => window.__mercury.runtime.selection().committed.shadows === true);
  // Default framing: the Sun stands on screen left (half phase) and the
  // terminator is vertical up to the Sun's ecliptic latitude, north up.
  await page.evaluate(() => window.__mercury.camera.setState({
    controlPitch: window.__mercury.camera.stats().defaultControlPitchDegrees,
    controlYaw: window.__mercury.camera.stats().defaultControlYawDegrees,
    zoom: 1.1,
  }));
  await nextPaint(page);
  const defaultFraming = await page.evaluate(() => ({
    ...window.__mercury.sky.state(),
    sunHidden: document.querySelector(".mercury-directional-sun").hidden,
  }));
  assert.ok(defaultFraming.skySunViewDirection[0] < -0.98);
  assert.ok(Math.abs(defaultFraming.skySunViewDirection[1]) < 0.1);
  assert.ok(Math.abs(defaultFraming.skySunViewDirection[2]) < 0.1);
  assert.ok(Math.abs(defaultFraming.materialFrame - 128) < 16);
  assert.equal(defaultFraming.sunHidden, true);
  await page.evaluate(() => {
    document.querySelector(".mercury-skybox").style.visibility = "hidden";
  });
  await nextPaint(page);
  const framingDisc = await page.locator(".mercury-material").boundingBox();
  assert.ok(framingDisc);
  const framing = await litDirection(await page.screenshot({
    clip: framingDisc,
  }));
  await page.evaluate(() => {
    document.querySelector(".mercury-skybox").style.removeProperty("visibility");
  });
  // Lit direction measured from the disc luminance: 180 degrees is screen
  // left; the terminator is perpendicular to it.
  assert.ok(Math.abs(framing.litDirectionDegrees - 180) < 8,
    `lit direction ${framing.litDirectionDegrees}`);
  // Half phase: the luminance centroid sits well off centre, toward the Sun.
  assert.ok(framing.centroidRadiusShare > 0.2,
    `centroid offset ${framing.centroidRadiusShare}`);

  // The sky rides the scene matrix through the prepared registration, in
  // both the reset (setState) and the accumulated (drag) camera paths, so
  // stars and Sun cross the screen identically.
  const skyLock = await page.evaluate(() => {
    const registration = new DOMMatrix(
      window.__mercury.sky.sceneRegistration,
    );
    const compare = () => {
      // The scene transform is the camera's dolly and the uniform scene
      // scale ahead of the accumulated rotation; only the rotation is
      // compared.
      const scene = new DOMMatrix(
        document.querySelector(".mercury-scene").style.transform
          .replace(/^(?:translate3d\([^)]*\)\s*)?scale(?:3d)?\([^)]*\)\s*/u, ""),
      );
      const sky = new DOMMatrix(
        document.querySelector(".mercury-skybox-orientation").style.transform,
      );
      const expected = scene.multiply(registration);
      let maximumError = 0;
      for (const key of ["m11", "m12", "m13", "m21", "m22", "m23", "m31",
        "m32", "m33"]) {
        maximumError = Math.max(maximumError, Math.abs(sky[key] - expected[key]));
      }
      return maximumError;
    };
    const errors = [];
    for (const [controlPitch, controlYaw] of [[34.23, 0], [10, 140], [80, -300]]) {
      window.__mercury.camera.setState({ controlPitch, controlYaw });
      errors.push(compare());
    }
    return errors;
  });
  // The scene matrix is read back from the specified style, which Chrome
  // serialises to six decimals: a 3x3 product of such values carries a few
  // 1e-6 of rounding. A sky off the scene by any real amount is 1e-2 or more.
  const SKY_LOCK_TOLERANCE = 1e-5;
  assert.ok(skyLock.every((error) => error < SKY_LOCK_TOLERANCE), `sky lock ${skyLock}`);
  await page.evaluate(() => window.__mercury.camera.setState({
    controlPitch: window.__mercury.camera.stats().defaultControlPitchDegrees,
    controlYaw: window.__mercury.camera.stats().defaultControlYawDegrees,
    zoom: 1.1,
  }));
  await drag(page, ".mercury-input-surface", 90, 40);
  const draggedSkyLock = await page.evaluate(() => {
    window.__mercury.camera.setState({ zoom: 1.1 });
    const registration = new DOMMatrix(
      window.__mercury.sky.sceneRegistration,
    );
    const scene = new DOMMatrix(
      document.querySelector(".mercury-scene").style.transform
        .replace(/^(?:translate3d\([^)]*\)\s*)?scale(?:3d)?\([^)]*\)\s*/u, ""),
    );
    const sky = new DOMMatrix(
      document.querySelector(".mercury-skybox-orientation").style.transform,
    );
    const expected = scene.multiply(registration);
    const sunDirection = window.__mercury.sky.state().skySunViewDirection;
    const sunLocal = window.__mercury.sky.sunLocalDirection;
    const sunExpected = [
      scene.m11 * sunLocal[0] + scene.m21 * sunLocal[1] + scene.m31 * sunLocal[2],
      -(scene.m12 * sunLocal[0] + scene.m22 * sunLocal[1] + scene.m32 * sunLocal[2]),
      scene.m13 * sunLocal[0] + scene.m23 * sunLocal[1] + scene.m33 * sunLocal[2],
    ];
    let maximumError = 0;
    for (const key of ["m11", "m12", "m13", "m21", "m22", "m23", "m31", "m32",
      "m33"]) {
      maximumError = Math.max(maximumError, Math.abs(sky[key] - expected[key]));
    }
    return {
      skyError: maximumError,
      sunError: Math.max(...sunExpected.map((value, axis) =>
        Math.abs(value - sunDirection[axis]))),
      moved: window.__mercury.camera.state().controlYaw !== 0,
    };
  });
  assert.ok(draggedSkyLock.moved);
  assert.ok(draggedSkyLock.skyError < SKY_LOCK_TOLERANCE, `dragged sky ${draggedSkyLock.skyError}`);
  assert.ok(draggedSkyLock.sunError < SKY_LOCK_TOLERANCE, `dragged sun ${draggedSkyLock.sunError}`);

  // Astrometric sky: the Milky Way must cross the screen where the J2000
  // galactic frame, Mercury's pole and the ecliptic presentation frame put
  // it. Measured on the rendered high-contrast faces with the body hidden,
  // against a prediction that projects the galactic equator through the
  // published registration and the live scene matrix.
  await page.evaluate(() => {
    document.body.dataset.skyContrast = "high";
  });
  await page.waitForFunction(() => performance.getEntriesByType("resource")
    .filter(({ name }) =>
      /mercury-starfield-(?:front|right|back|left|top|bottom)@2x\.webp$/u
        .test(name)).length >= 6);
  const galacticToIcrs = transposeMatrix(ICRS_TO_GALACTIC);
  const skyRegistration = parseCssMatrix(
    PREPARED_MERCURY_SCENE.starfield.sceneRegistration,
  );
  for (const [controlPitch, controlYaw, expectedInclination] of [
    // Scene pitch 0 looking away from the centre: the plane's 60.2 degree
    // inclination shows as 180 - 60.2 from the horizontal.
    [89, 0, 119.8],
    // The same pose turned onto the galactic centre: 60.2 degrees.
    [89, 176, 60.2],
  ]) {
    await page.evaluate(([pitch, yaw]) => window.__mercury.camera.setState({
      controlPitch: pitch,
      controlYaw: yaw,
      zoom: 1.1,
    }), [controlPitch, controlYaw]);
    await nextPaint(page);
    const view = await page.evaluate(() => {
      const sky = document.querySelector(".mercury-skybox");
      const box = sky.getBoundingClientRect();
      const scene = new DOMMatrix(document.querySelector(".mercury-scene")
        .style.transform.replace(/^scale\([^)]*\)\s*/u, ""));
      return {
        scene: [scene.m11, scene.m21, scene.m31, scene.m12, scene.m22,
          scene.m32, scene.m13, scene.m23, scene.m33],
        perspective: parseFloat(getComputedStyle(sky).perspective),
        box: { x: box.x, y: box.y, width: box.width, height: box.height },
      };
    });
    const skyMatrix = multiplyMatrices(view.scene, skyRegistration);
    const project = (direction) => {
      const [x, y, z] = transformDirection(skyMatrix, direction);
      return z < 0
        ? [view.box.width / 2 + view.perspective * x / -z,
          view.box.height / 2 + view.perspective * y / -z]
        : null;
    };
    const planePoints = [];
    for (let longitude = 0; longitude < 360; longitude += 0.25) {
      const point = project(transformDirection(
        galacticToIcrs,
        directionFromDegrees(longitude, 0),
      ));
      if (point && point[0] >= 0 && point[0] < view.box.width &&
          point[1] >= 0 && point[1] < view.box.height) {
        planePoints.push([point[0], point[1], 1]);
      }
    }
    const predictedAngle = principalAxisDegrees(planePoints);
    assert.ok(Math.abs(predictedAngle - expectedInclination) < 1,
      `predicted band angle ${predictedAngle} at ${controlPitch}/${controlYaw}`);
    // Sky only: hide every sibling along the skybox's ancestor chain (body,
    // Sun sprite, lighting overlay, shell chrome) for the shot.
    await page.evaluate(() => {
      const hidden = [];
      let node = document.querySelector(".mercury-skybox");
      while (node && node !== document.body) {
        for (const sibling of node.parentElement.children) {
          if (sibling === node) continue;
          hidden.push([sibling, sibling.style.visibility]);
          sibling.style.visibility = "hidden";
        }
        node = node.parentElement;
      }
      window.__mercurySkyShotRestore = () => {
        for (const [element, visibility] of hidden) {
          element.style.visibility = visibility;
        }
        delete window.__mercurySkyShotRestore;
      };
    });
    await nextPaint(page);
    const band = await milkyWayBand(await page.screenshot({ clip: view.box }));
    await page.evaluate(() => window.__mercurySkyShotRestore());
    await nextPaint(page);
    assert.ok(Math.abs(band.angleDegrees - predictedAngle) < 6,
      `Milky Way band ${band.angleDegrees} vs predicted ${predictedAngle} ` +
      `at ${controlPitch}/${controlYaw}`);
    if (controlYaw === 176) {
      // The bulge is the brightest sky region and must sit on the predicted
      // galactic centre (within 6 degrees: the photographic peak is not the
      // dynamical centre).
      const centre = project(transformDirection(galacticToIcrs, [1, 0, 0]));
      assert.ok(centre);
      const separation = Math.hypot(band.peak[0] - centre[0],
        band.peak[1] - centre[1]);
      assert.ok(separation < view.perspective * Math.tan(6 * Math.PI / 180),
        `bulge peak ${band.peak} vs galactic centre ${centre}`);
    }
  }
  await page.evaluate(() => {
    delete document.body.dataset.skyContrast;
  });

  const sunSweep = await page.evaluate(() => {
    const stats = window.__mercury.camera.stats();
    const samples = [];
    // The observed Sun rides the body, so covering the full phase range needs
    // the pitch axis too: at the default scene pitch the Sun never stands far
    // behind the camera for any yaw.
    for (const pitch of [
      stats.defaultControlPitchDegrees,
      stats.maximumPitchDegrees,
    ]) {
      for (let yaw = -105; yaw <= 255; yaw += 15) {
        window.__mercury.camera.setState({
          controlPitch: pitch,
          controlYaw: yaw,
        });
        samples.push({ pitch, yaw, ...window.__mercury.sky.state(),
          sunViewDirection: window.__mercury.runtime.view().sunViewDirection });
      }
    }
    return samples;
  });
  assert.equal(sunSweep.length, 50);
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
  await page.waitForFunction(() => window.__mercury.runtime.selection().committed.shadows === false);
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
  // The default camera stands south of the ecliptic and sees both section
  // faces: their axis seam and the hollow shell at the south end are not
  // mesh gaps, so allow a few percent; a missing or misaligned section leaf
  // would leave far more of the span unpainted.
  assert.ok(interiorMetrics.orangeGapFraction < 0.05,
    `interior gap fraction ${interiorMetrics.orangeGapFraction}`);
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

  // Level of detail: dolly out through the three retained stages. The
  // coarser stage fades in over the finer one, which hides only once it is
  // covered; the overlay keeps the same frame (the phase) throughout and
  // draws from the billboard atlas, so the row cache stops streaming; the
  // marker is the shell's own navigation sprite; nothing mounts or unmounts.
  await page.locator('input[name="shadows"]').evaluate((control) => {
    control.checked = true;
    control.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(() => window.__mercury.runtime.selection().committed.shadows === true);
  const lodLadder = await page.evaluate(() => {
    const stats = window.__mercury.camera.stats();
    const stage = document.querySelector(".planet-stage");
    const samples = [];
    for (const diameter of [40, 20, 17, 13, 10, 7, 5.5, 4.4, 3]) {
      window.__mercury.camera.setState({
        controlPitch: stats.defaultControlPitchDegrees,
        controlYaw: stats.defaultControlYawDegrees,
        zoom: 1.1 * diameter / 460,
      });
      const sky = window.__mercury.sky.state();
      const marker = document.querySelector(".mercury-body-marker");
      samples.push({
        diameter,
        stage: sky.lod.stage,
        datasetLod: stage.dataset.lod,
        billboardOpacity: sky.lod.billboardOpacity,
        billboardStyleOpacity: Number(getComputedStyle(
          document.querySelector(".mercury-billboard"),
        ).opacity),
        markerOpacity: Number(getComputedStyle(marker).opacity),
        markerImage: getComputedStyle(marker).backgroundImage,
        markerSize: marker.getBoundingClientRect().width,
        sceneVisibility: getComputedStyle(
          document.querySelector(".mercury-scene"),
        ).visibility,
        overlayVisibility: getComputedStyle(
          document.querySelector(".mercury-material-root"),
        ).visibility,
        discVisibility: getComputedStyle(
          document.querySelector(".mercury-billboard"),
        ).visibility,
        materialImage: document.querySelector(".mercury-material")
          .style.backgroundImage,
        materialFrame: sky.materialFrame,
        rowStreaming: sky.lod.rowStreaming,
        stable: window.__mercury.assertStableDomIdentity(),
        elements: stage.querySelectorAll("*").length,
      });
    }
    window.__mercury.camera.setState({ zoom: 1.1 });
    return samples;
  });
  assert.deepEqual(lodLadder.map(({ stage }) => stage), [
    "geometry", "geometry", "crossfade", "billboard", "billboard", "billboard",
    "billboard", "marker", "marker",
  ]);
  for (const sample of lodLadder) {
    assert.equal(sample.datasetLod, sample.stage);
    assert.equal(sample.stable, true);
    assert.equal(sample.elements, 3804);
    assert.equal(sample.materialFrame, lodLadder[0].materialFrame);
    assert.ok(Math.abs(sample.billboardStyleOpacity - sample.billboardOpacity) <
      1e-6);
    assert.equal(sample.sceneVisibility,
      ["billboard", "marker"].includes(sample.stage) ? "hidden" : "visible");
    // The lighting overlay stays alive at every stage (over the marker at
    // the far stage, floored to its size); the flat disc hides there.
    assert.equal(sample.overlayVisibility, "visible");
    assert.equal(sample.discVisibility,
      sample.stage === "marker" ? "hidden" : "visible");
    assert.equal(sample.rowStreaming, sample.stage === "geometry");
    assert.match(sample.materialImage, sample.stage === "geometry"
      ? /mercury-lighting-2x-row-\d+\.webp/u
      : /mercury-lighting-2x-billboard\.webp/u);
    assert.match(sample.markerImage, /\/navigation\/planet-markers@2x\.webp/u);
    assert.equal(sample.markerSize, 5);
  }
  assert.deepEqual(lodLadder.map(({ billboardOpacity }) => billboardOpacity > 0),
    [false, false, true, true, true, true, true, true, true]);
  assert.deepEqual(lodLadder.map(({ markerOpacity }) => Math.round(markerOpacity * 100) / 100),
    [0, 0, 0, 0, 0, 0.29, 0.71, 1, 1]);
  assert.ok(lodLadder[2].billboardOpacity > 0.4 &&
    lodLadder[2].billboardOpacity < 0.6);
  // The planetary system: hidden at the close framings above, opaque at the
  // dolly's far bound with every planet and the Sun marker on screen when
  // looking down on the ecliptic, and nothing mounts or unmounts on the way.
  const farSystem = await page.evaluate(() => {
    const stats = window.__mercury.camera.stats();
    const near = window.__mercury.sky.state().planetarySystem;
    // Scene pitch is affine in the control pitch: 89 is 0 degrees, the
    // default is 40, so this control pitch looks straight down the pole.
    const poleOn = 89 - (89 - stats.defaultControlPitchDegrees) * 90 / 40;
    window.__mercury.camera.setState({ controlPitch: poleOn, controlYaw: 0,
      distanceKilometers: stats.dolly.maximumDistanceKilometers });
    const far = window.__mercury.sky.state().planetarySystem;
    const group = document.querySelector(".planet-heliocentric-system");
    const result = {
      nearOpacity: near.opacity, nearPieces: near.orbitPieceCount,
      farOpacity: far.opacity, farPieces: far.orbitPieceCount, farMarkers: far.markerVisibleCount,
      farBodies: far.bodies.map(({ id, visible }) => `${id}:${visible}`),
      farSunMarker: far.sunMarkerVisible && far.sunMarkerOpacity === 1,
      groupOpacity: getComputedStyle(group).opacity,
      maximumDistanceAu: stats.dolly.maximumDistanceKilometers / 149597870.7,
      wheelNotches: stats.dolly.wheelNotchesEndToEnd,
      stable: window.__mercury.assertStableDomIdentity(),
      elements: document.querySelector(".planet-stage").querySelectorAll("*").length,
    };
    window.__mercury.camera.setState({ controlPitch: stats.defaultControlPitchDegrees,
      controlYaw: stats.defaultControlYawDegrees, zoom: 1.1 });
    return result;
  });
  assert.equal(farSystem.nearOpacity, 0);
  assert.equal(farSystem.nearPieces, 0);
  assert.equal(farSystem.farOpacity, 1);
  assert.equal(farSystem.groupOpacity, "1");
  // Trails: five eighths of each of the twelve rings' chords (900), minus
  // those clipped away.
  assert.ok(farSystem.farPieces > 600 && farSystem.farPieces <= 900, `system pieces ${farSystem.farPieces}`);
  assert.equal(farSystem.farMarkers, 12);
  assert.deepEqual(farSystem.farBodies, ["venus:true", "earth:true", "mars:true",
    "jupiter:true", "saturn:true", "uranus:true", "neptune:true",
    "ceres:true", "pluto:true", "haumea:true", "makemake:true", "eris:true"]);
  assert.equal(farSystem.farSunMarker, true);
  assert.ok(farSystem.maximumDistanceAu > 280 && farSystem.maximumDistanceAu < 310,
    `far bound ${farSystem.maximumDistanceAu} au`);
  assert.ok(farSystem.wheelNotches > 20 && farSystem.wheelNotches < 40);
  assert.equal(farSystem.stable, true);
  assert.equal(farSystem.elements, 3804);

  // Back in close: the row cache resumes on the retained rows.
  assert.equal(await page.evaluate(() => {
    const { stage, rowStreaming } = window.__mercury.sky.state().lod;
    return `${stage}/${rowStreaming}`;
  }), "geometry/true");
  await page.locator('input[name="shadows"]').evaluate((control) => {
    control.checked = false;
    control.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(() => window.__mercury.runtime.selection().committed.shadows === false);

  assert.equal(await page.locator(".planet-stage").evaluate((stage) =>
    stage.childElementCount), baseline.stageChildren);
  assert.equal(await page.locator(".planet-stage").evaluate((stage) =>
    stage.querySelectorAll("*").length), 3804);
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
    // The phase survives both crossfades: at the default framing the Sun
    // stands on screen left, and the painted lit direction of the geometry,
    // of the billboard fading in over it, and of the billboard alone all
    // point there, with the same off-centre luminance of a half phase.
    await dpr2Page.locator('input[name="shadows"]').evaluate((control) => {
      control.checked = true;
      control.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await dpr2Page.waitForFunction(() => window.__mercury.runtime.selection().committed.shadows === true);
    await dpr2Page.evaluate(() => {
      document.querySelector(".mercury-skybox").style.visibility = "hidden";
      const orbit = document.querySelector('input[name="orbit"]');
      orbit.checked = false;
      orbit.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await dpr2Page.waitForFunction(() => window.__mercury.runtime.selection().committed.orbit === false);
    const lodPhases = [];
    for (const diameter of [40, 17, 12]) {
      const shot = await dpr2Page.evaluate((nextDiameter) => {
        const stats = window.__mercury.camera.stats();
        window.__mercury.camera.setState({
          controlPitch: stats.defaultControlPitchDegrees,
          controlYaw: stats.defaultControlYawDegrees,
          zoom: 1.1 * nextDiameter / 460,
        });
        const box = document.querySelector(".mercury-camera")
          .getBoundingClientRect();
        return {
          stage: window.__mercury.sky.state().lod.stage,
          clip: {
            x: box.x + box.width / 2 - nextDiameter,
            y: box.y + box.height / 2 - nextDiameter,
            width: 2 * nextDiameter,
            height: 2 * nextDiameter,
          },
        };
      }, diameter);
      await nextPaint(dpr2Page);
      lodPhases.push({
        diameter,
        stage: shot.stage,
        ...await litDirection(await dpr2Page.screenshot({ clip: shot.clip })),
      });
    }
    assert.deepEqual(lodPhases.map(({ stage }) => stage),
      ["geometry", "crossfade", "billboard"]);
    for (const phase of lodPhases) {
      assert.ok(Math.abs(phase.litDirectionDegrees - 180) < 15,
        `lit direction ${phase.litDirectionDegrees} at ${phase.diameter}px`);
      assert.ok(phase.centroidRadiusShare > 0.15,
        `centroid offset ${phase.centroidRadiusShare} at ${phase.diameter}px`);
    }
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

function parseCssMatrix(cssTransform) {
  const values = cssTransform.slice("matrix3d(".length, -1).split(",")
    .map(Number);
  assert.equal(values.length, 16);
  return [
    values[0], values[4], values[8],
    values[1], values[5], values[9],
    values[2], values[6], values[10],
  ];
}

function multiplyMatrices(a, b) {
  const result = new Array(9);
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      result[row * 3 + column] = a[row * 3] * b[column] +
        a[row * 3 + 1] * b[3 + column] + a[row * 3 + 2] * b[6 + column];
    }
  }
  return result;
}

// Orientation of the principal axis of weighted screen samples, degrees from
// the horizontal with y up, in [0, 180).
function principalAxisDegrees(samples) {
  let weight = 0;
  let meanX = 0;
  let meanY = 0;
  for (const [x, y, k] of samples) {
    weight += k;
    meanX += k * x;
    meanY += k * y;
  }
  meanX /= weight;
  meanY /= weight;
  let xx = 0;
  let yy = 0;
  let xy = 0;
  for (const [x, y, k] of samples) {
    const dx = x - meanX;
    const dy = -(y - meanY);
    xx += k * dx * dx;
    yy += k * dy * dy;
    xy += k * dx * dy;
  }
  return (0.5 * Math.atan2(2 * xy, xx - yy) * 180 / Math.PI + 180) % 180;
}

// The diffuse band: blurred luminance above its 90th percentile, weighted by
// the excess, plus the brightest blurred pixel.
async function milkyWayBand(image) {
  const { data, info } = await sharp(image).raw().toBuffer({
    resolveWithObject: true,
  });
  const width = info.width;
  const height = info.height;
  const luminance = new Uint8Array(width * height);
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * info.channels;
    luminance[index] = Math.min(255, Math.round(
      0.2126 * data[offset] + 0.7152 * data[offset + 1] +
        0.0722 * data[offset + 2],
    ));
  }
  const { data: blurredRaw, info: blurredInfo } = await sharp(
    Buffer.from(luminance),
    { raw: { width, height, channels: 1 } },
  ).blur(12).raw().toBuffer({ resolveWithObject: true });
  const blurred = new Uint8Array(width * height);
  for (let index = 0; index < width * height; index += 1) {
    blurred[index] = blurredRaw[index * blurredInfo.channels];
  }
  const sorted = Array.from(blurred).sort((a, b) => a - b);
  const threshold = sorted[Math.floor(sorted.length * 0.9)];
  const samples = [];
  let peakValue = -1;
  let peak = null;
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const value = blurred[y * width + x];
      if (value > peakValue) {
        peakValue = value;
        peak = [x, y];
      }
      if (value > threshold) samples.push([x, y, value - threshold]);
    }
  }
  assert.ok(samples.length > 1_000, "sky too dark to measure");
  return { angleDegrees: principalAxisDegrees(samples), peak, threshold };
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

// Luminance-weighted centroid of the disc, in screen coordinates. The lit
// direction is its angle (0 right, 90 up, 180 left); the terminator is
// perpendicular to it.
async function litDirection(image) {
  const { data, info } = await sharp(image).raw().toBuffer({
    resolveWithObject: true,
  });
  const centerX = info.width / 2;
  const centerY = info.height / 2;
  const radius = Math.min(centerX, centerY) * 0.95;
  let weight = 0;
  let momentX = 0;
  let momentY = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (Math.hypot(x - centerX, y - centerY) > radius) continue;
      const offset = (y * info.width + x) * info.channels;
      const luminance = 0.2126 * data[offset] + 0.7152 * data[offset + 1] +
        0.0722 * data[offset + 2];
      weight += luminance;
      momentX += luminance * (x - centerX);
      momentY += luminance * (y - centerY);
    }
  }
  return {
    litDirectionDegrees: Math.atan2(-momentY / weight, momentX / weight) *
      180 / Math.PI,
    centroidRadiusShare: Math.hypot(momentX / weight, momentY / weight) / radius,
  };
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
