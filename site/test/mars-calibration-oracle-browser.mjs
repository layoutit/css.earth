import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium } from "playwright";
import sharp from "sharp";

if (process.argv.includes("--set")) {
  const { captureMarsBrowserInteractionCorpus } = await import(
    "./mars-calibration-interaction-browser.mjs"
  );
  await captureMarsBrowserInteractionCorpus(process.argv.slice(2));
  process.exit(process.exitCode ?? 0);
}

const ROOT = resolve(import.meta.dirname, "../..");
const CALIBRATION_ROOT = resolve(
  ROOT,
  ".local/oracles/google-earth-pro/calibration",
);
const NATIVE_REPORT_PATH = resolve(
  ROOT,
  "output/playwright/google-earth-pro-mars-interaction-video-v1/" +
    "native-registration/registration.json",
);
const options = parseArguments(process.argv.slice(2));
const outputRoot = resolve(ROOT, options.output);
const reportPath = resolve(outputRoot, "registration.json");
const contactSheetPath = resolve(outputRoot, "contact-sheet.png");
const virtualSurfaceUrl = "/__cssmars_oracle/mars-calibration-surface@2x.png";
const virtualPolesUrl = "/__cssmars_oracle/mars-calibration-poles@2x.png";

if (!options.registrationOnly) {
  throw new Error("This harness currently requires --registration-only.");
}
if (options.densities.some((density) => ![1, 2].includes(density))) {
  throw new Error("--dpr must contain only 1 and 2.");
}
if (!outputRoot.startsWith(resolve(ROOT, "output/playwright") + "/")) {
  throw new Error("Browser calibration output must stay under output/playwright.");
}

const [nativeReport, calibrationManifest, browserAtlasManifest] =
  await Promise.all([
    readJson(NATIVE_REPORT_PATH),
    readJson(resolve(CALIBRATION_ROOT, "manifest.json")),
    readJson(resolve(CALIBRATION_ROOT, "css-earth/manifest.json")),
  ]);
assert.equal(
  nativeReport.qualification,
  "NATIVE_GOOGLE_GEOMETRY_CALIBRATION_REGISTRATION_PROVEN",
);
assert.equal(nativeReport.captures.length, 12);
assert.equal(
  calibrationManifest.source.decodedRgbaSha256,
  browserAtlasManifest.sourceDecodedRgbaSha256,
);
const sourceDecodedRgbaSha256 =
  calibrationManifest.source.decodedRgbaSha256;
const surfaceAtlas = atlas("projective-surface-2x");
const polesAtlas = atlas("polar-atlas-2x");
const [surfaceBytes, polesBytes] = await Promise.all([
  readFile(resolve(CALIBRATION_ROOT, surfaceAtlas.path)),
  readFile(resolve(CALIBRATION_ROOT, polesAtlas.path)),
]);
assert.equal(sha256(surfaceBytes), surfaceAtlas.encodedSha256);
assert.equal(sha256(polesBytes), polesAtlas.encodedSha256);

const nativeRawMetadata = await sharp(
  nativeReport.captures[0].final.raw.path,
).metadata();
const nativeCrop = nativeReport.captures[0].final.crop;
const viewport = Object.freeze({
  width: nativeRawMetadata.width,
  height: nativeRawMetadata.height,
});
assert.deepEqual(
  nativeReport.captures.map(({ final }) => final.crop),
  Array.from({ length: 12 }, () => nativeCrop),
);
assert.equal(viewport.width, nativeCrop.width);
assert.equal(viewport.height, nativeCrop.top + nativeCrop.height + 145);
const nativePoses = await Promise.all(nativeReport.captures.map(
  async (capture) => Object.freeze({
    id: capture.id,
    camera: capture.camera,
    coverage: capture.coverage,
    path: capture.final.path,
    disc: await measureCalibrationDisc(await readFile(capture.final.path), 1),
  }),
));

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
});
const densityReports = [];
try {
  for (const density of options.densities) {
    densityReports.push(await captureDensity(browser, density));
  }
} finally {
  await browser.close();
}

const gates = Object.freeze({
  sourceHashMatchesNative:
    sourceDecodedRgbaSha256 ===
      nativeReport.calibration.sourceDecodedRgbaSha256,
  allDensitiesCaptured:
    densityReports.length === options.densities.length,
  allPosesCaptured: densityReports.every(({ captures }) =>
    captures.length === nativePoses.length),
  allRetainedIdentitiesStable: densityReports.every(({ captures }) =>
    captures.every(({ retainedIdentityStable }) => retainedIdentityStable)),
  noRuntimeDomGrowth: densityReports.every(({ captures }) =>
    captures.every(({ domGrowth }) => domGrowth === 0)),
  normalRouteUnchanged: densityReports.every(({ normalRoute }) =>
    normalRoute.unchanged),
  noBrowserProblems: densityReports.every(({ browserProblems }) =>
    browserProblems.length === 0),
  noExternalRequests: densityReports.every(({ externalRequests }) =>
    externalRequests.length === 0),
  noProductionOracleRequests: densityReports.every(({ normalRoute }) =>
    normalRoute.oracleRequests === 0),
  allDiscSizesPaired: densityReports.every(({ captures }) =>
    captures.every(({ discResidualCssPixels }) =>
      discResidualCssPixels <= 1.5)),
  allCenterAddressesPaired: densityReports.every(({ captures }) =>
    captures.every(({ centerAddressMatches }) => centerAddressMatches)),
  allGeographicSolvesConverged: densityReports.every(({ captures }) =>
    captures.every(({ browserEndpoint }) =>
      browserEndpoint.angularResidualDegrees < 0.001)),
});
if (Object.values(gates).some((value) => value !== true)) {
  throw new Error(`Browser calibration gates failed: ${JSON.stringify(gates)}`);
}

await createContactSheet(
  densityReports.find(({ density }) => density === 1)?.captures ??
    densityReports[0].captures,
  contactSheetPath,
);
const report = Object.freeze({
  schema: "cssmars-browser-calibration-registration@1",
  qualification: "BROWSER_RETAINED_CALIBRATION_REGISTRATION_PROVEN",
  generatedAt: new Date().toISOString(),
  renderer: "cssEarth retained CSS in headless Google Chrome",
  baseUrl: options.baseUrl,
  registrationOnly: true,
  viewport,
  crop: nativeCrop,
  calibration: Object.freeze({
    sourceDecodedRgbaSha256,
    surfaceAtlas: descriptor(surfaceAtlas),
    polesAtlas: descriptor(polesAtlas),
    binding:
      "oracle-only CDP stylesheet and intercepted prepared atlas responses",
    productionUrlParameter: false,
    runtimeTextureGeneration: false,
    newSceneRenderer: false,
  }),
  nativeRegistration: Object.freeze({
    path: NATIVE_REPORT_PATH,
    qualification: nativeReport.qualification,
  }),
  gates,
  densities: densityReports,
  contactSheet: contactSheetPath,
});
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({
  qualification: report.qualification,
  reportPath,
  contactSheetPath,
  gates,
}, null, 2)}\n`);

async function captureDensity(browserInstance, density) {
  const context = await browserInstance.newContext({
    viewport,
    deviceScaleFactor: density,
    colorScheme: "dark",
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const browserProblems = [];
  const externalRequests = [];
  const requestedUrls = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      browserProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => browserProblems.push(
    `pageerror: ${error.message}`,
  ));
  page.on("request", (request) => {
    requestedUrls.push(request.url());
    const { hostname } = new URL(request.url());
    if (!["127.0.0.1", "localhost"].includes(hostname)) {
      externalRequests.push(request.url());
    }
  });
  try {
    const response = await page.goto(options.baseUrl, {
      waitUntil: "networkidle",
    });
    assert.equal(response?.status(), 200);
    const routeBytesBefore = await response.body();
    await waitForMars(page);
    const baseline = await retainBaseline(page);
    const requestBoundary = requestedUrls.length;
    await page.route(`**${virtualSurfaceUrl}`, (route) => route.fulfill({
      status: 200,
      contentType: "image/png",
      body: surfaceBytes,
    }));
    await page.route(`**${virtualPolesUrl}`, (route) => route.fulfill({
      status: 200,
      contentType: "image/png",
      body: polesBytes,
    }));
    await installOracleStyleSheet(cdp);
    await page.evaluate(async ({ surfaceUrl, polesUrl }) => {
      const decode = (source) => {
        const image = new Image();
        image.decoding = "sync";
        image.src = source;
        return image.decode();
      };
      await Promise.all([decode(surfaceUrl), decode(polesUrl)]);
      window.__mars.pause();
      for (const animation of document.getAnimations()) {
        animation.currentTime = 0;
        animation.pause();
      }
    }, { surfaceUrl: virtualSurfaceUrl, polesUrl: virtualPolesUrl });
    await twoFrames(page);

    const densityRoot = resolve(outputRoot, `dpr${density}`);
    await mkdir(densityRoot, { recursive: true });
    const captures = [];
    for (let index = 0; index < nativePoses.length; index += 1) {
      const nativePose = nativePoses[index];
      const endpoint = await solveBrowserEndpoint(page, nativePose.camera);
      let zoom = initialZoom(nativePose.camera.distance);
      let finalBytes = null;
      let disc = null;
      let screenRollDegrees = 0;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        screenRollDegrees = await setCaptureView(
          page,
          endpoint,
          zoom,
          nativePose.camera,
        );
        const fullBytes = await page.screenshot({ type: "png" });
        finalBytes = await cropForDensity(fullBytes, nativeCrop, density);
        disc = await measureCalibrationDisc(finalBytes, density);
        const targetWidth = nativePose.disc.width * density;
        zoom *= targetWidth / disc.width;
      }
      screenRollDegrees = await setCaptureView(
        page,
        endpoint,
        zoom,
        nativePose.camera,
      );
      const fullBytes = await page.screenshot({ type: "png" });
      finalBytes = await cropForDensity(fullBytes, nativeCrop, density);
      disc = await measureCalibrationDisc(finalBytes, density);
      const capturePath = resolve(
        densityRoot,
        `${pad(index + 1)}-${nativePose.id}.png`,
      );
      await writeFile(capturePath, finalBytes);
      const state = await page.evaluate(() => {
        const retained = window.__marsCalibrationRetained;
        const stage = document.querySelector(".planet-stage");
        return {
          camera: window.__mars.view(),
          stageElementCount: stage.querySelectorAll("*").length,
          retainedIdentityStable: retained.nodes.every((node, index) =>
            node.isConnected && node.parentNode === retained.parents[index]),
          activeAnimations: document.getAnimations().filter(
            ({ playState }) => playState === "running",
          ).length,
          surfaceImage: getComputedStyle(stage.querySelector(
            ".mars-body > s:not(.mars-pole)",
          )).backgroundImage,
          polesImage: getComputedStyle(stage.querySelector(
            ".mars-body > .mars-pole",
          )).backgroundImage,
          materialDisplay: getComputedStyle(stage.querySelector(
            ".mars-material-counter",
          )).display,
          sunDisplay: getComputedStyle(stage.querySelector(
            ".planet-directional-sun",
          )).display,
          centerLeaves: (() => {
            const leaves = [...stage.querySelectorAll(".mars-body > s")];
            return document.elementsFromPoint(innerWidth / 2, innerHeight / 2)
              .filter((element) => element.matches?.(".mars-body > s"))
              .map((element) => {
                const leafIndex = leaves.indexOf(element);
                return {
                  leafIndex,
                  latitudeIndex: leafIndex < 512
                    ? Math.floor(leafIndex / 32) + 1
                    : null,
                  longitudeIndex: leafIndex < 512
                    ? leafIndex % 32
                    : null,
                  className: element.className,
                };
              });
          })(),
        };
      });
      assert.equal(state.activeAnimations, 0);
      assert.equal(state.materialDisplay, "none");
      assert.equal(state.sunDisplay, "none");
      assert.match(state.surfaceImage, /__cssmars_oracle/u);
      assert.match(state.polesImage, /__cssmars_oracle/u);
      const centerAddressMatches = centerMatches(
        nativePose.camera,
        state.centerLeaves,
      );
      captures.push(Object.freeze({
        index: index + 1,
        id: nativePose.id,
        coverage: nativePose.coverage,
        nativeCamera: nativePose.camera,
        browserEndpoint: Object.freeze({
          ...endpoint,
          screenRollDegrees,
        }),
        zoom,
        path: capturePath,
        sha256: sha256(finalBytes),
        nativeDisc: nativePose.disc,
        browserDisc: disc,
        discResidualCssPixels:
          Math.abs(disc.width / density - nativePose.disc.width),
        centerAddressMatches,
        retainedIdentityStable: state.retainedIdentityStable,
        domGrowth: state.stageElementCount - baseline.stageElementCount,
        state,
      }));
    }

    const verificationPage = await context.newPage();
    const verificationRequests = [];
    verificationPage.on("request", (request) =>
      verificationRequests.push(request.url()));
    const verificationResponse = await verificationPage.goto(options.baseUrl, {
      waitUntil: "networkidle",
    });
    assert.equal(verificationResponse?.status(), 200);
    const routeBytesAfter = await verificationResponse.body();
    await waitForMars(verificationPage);
    const verification = await routeSignature(verificationPage);
    await verificationPage.close();
    const normalRoute = Object.freeze({
      responseSha256Before: sha256(routeBytesBefore),
      responseSha256After: sha256(routeBytesAfter),
      baseline: baseline.signature,
      verification,
      oracleRequests: verificationRequests.filter((url) =>
        url.includes("/__cssmars_oracle/")).length,
      unchanged:
        sha256(routeBytesBefore) === sha256(routeBytesAfter) &&
        JSON.stringify(baseline.signature) === JSON.stringify(verification),
    });
    return Object.freeze({
      density,
      browserProblems,
      externalRequests,
      oracleRequests: requestedUrls.slice(requestBoundary).filter((url) =>
        url.includes("/__cssmars_oracle/")).length,
      normalRoute,
      captures,
    });
  } finally {
    await cdp.detach();
    await context.close();
  }
}

async function installOracleStyleSheet(cdp) {
  await Promise.all([
    cdp.send("DOM.enable"),
    cdp.send("CSS.enable"),
    cdp.send("Page.enable"),
  ]);
  const frameTree = await cdp.send("Page.getFrameTree");
  const { styleSheetId } = await cdp.send("CSS.createStyleSheet", {
    frameId: frameTree.frameTree.frame.id,
  });
  await cdp.send("CSS.setStyleSheetText", {
    styleSheetId,
    text: `
      body > :not(.planet-stage) { display: none !important; }
      .planet-stage { inset: 0 !important; }
      .planet-stage > .planet-render-root {
        translate: 0 0 !important;
      }
      .mars-body > s:not(.mars-pole) {
        background-image: url("${virtualSurfaceUrl}") !important;
      }
      .mars-body > .mars-pole {
        background-image: url("${virtualPolesUrl}") !important;
      }
      .mars-material-counter,
      .mars-moon-orbit,
      .planet-directional-sun { display: none !important; }
      .planet-render-root,
      .polycss-scene,
      .mars-system,
      .mars-body,
      .mars-body > s { pointer-events: auto !important; }
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
      }
    `,
  });
}

async function solveBrowserEndpoint(page, camera) {
  return page.evaluate(({ latitude, longitude }) => {
    const body = new DOMMatrix(getComputedStyle(
      document.querySelector(".mars-body"),
    ).transform);
    const system = new DOMMatrix(getComputedStyle(
      document.querySelector(".mars-body").parentElement,
    ).transform);
    const defaultPitch = 34.230769230769226;
    const maximumPitch = 89;
    const initialScenePitch = 40;
    const anchor = Object.freeze({ pitch: 170, yaw: -67.5 });
    const normalize = (vector) => {
      const length = Math.hypot(...vector);
      return vector.map((value) => value / length);
    };
    const localPoint = (lat, lon) => {
      const latRad = lat * Math.PI / 180;
      const lonRad = lon * Math.PI / 180;
      return normalize([
        -230 * Math.cos(latRad) * Math.sin(lonRad),
        -230 * Math.cos(latRad) * Math.cos(lonRad),
        228.646218 * Math.sin(latRad),
      ]);
    };
    const transformed = (pitch, yaw, point) => {
      const progress = (pitch - defaultPitch) /
        (maximumPitch - defaultPitch);
      const scenePitch = initialScenePitch * (1 - progress);
      const scene = new DOMMatrix()
        .scale(0.022, 0.022, 1)
        .rotateAxisAngle(1, 0, 0, scenePitch)
        .rotateAxisAngle(0, 1, 0, yaw);
      const matrix = scene.multiply(system).multiply(body);
      const result = new DOMPoint(...point, 0).matrixTransform(matrix);
      return [result.x, result.y, result.z];
    };
    // PolyCSS's prepared leaf basis swaps the source x/y axes. This function
    // therefore receives geographic longitude directly.
    const target = localPoint(latitude, longitude);
    const error = (pitch, yaw) => {
      const direction = transformed(pitch, yaw, target);
      const lengthSquared = direction.reduce(
        (sum, value) => sum + value * value,
        0,
      );
      const screenOffset = (direction[0] ** 2 + direction[1] ** 2) /
        lengthSquared;
      return screenOffset + (direction[2] <= 0 ? 2 : 0);
    };
    let best = { pitch: anchor.pitch, yaw: anchor.yaw, error: Infinity };
    for (let pitch = anchor.pitch - 250; pitch <= anchor.pitch + 250;
      pitch += 10) {
      for (let yaw = anchor.yaw - 180; yaw <= anchor.yaw + 180; yaw += 10) {
        const candidateError = error(pitch, yaw);
        if (candidateError < best.error) {
          best = { pitch, yaw, error: candidateError };
        }
      }
    }
    for (const step of [5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01,
      0.005, 0.001]) {
      let improved = true;
      while (improved) {
        improved = false;
        for (const pitchDelta of [-step, 0, step]) {
          for (const yawDelta of [-step, 0, step]) {
            const pitch = best.pitch + pitchDelta;
            const yaw = best.yaw + yawDelta;
            const candidateError = error(pitch, yaw);
            if (candidateError + 1e-15 < best.error) {
              best = { pitch, yaw, error: candidateError };
              improved = true;
            }
          }
        }
      }
    }
    return Object.freeze({
      controlPitch: best.pitch,
      controlYaw: best.yaw,
      angularResidualDegrees:
        Math.asin(Math.min(1, Math.sqrt(best.error))) * 180 / Math.PI,
      qualification:
        "geographic center solved against retained PolyCSS leaf matrices",
    });
  }, camera);
}

async function setCaptureView(page, endpoint, zoom, nativeCamera) {
  const screenRollDegrees = await page.evaluate(({
    endpoint,
    zoom,
    nativeCamera,
  }) => {
    window.__mars.setView({
      controlPitch: endpoint.controlPitch,
      controlYaw: endpoint.controlYaw,
      zoom,
    });
    const latitude = nativeCamera.latitude * Math.PI / 180;
    const longitude = nativeCamera.longitude * Math.PI / 180;
    const northTangent = new DOMPoint(
      230 * Math.sin(latitude) * Math.sin(longitude),
      230 * Math.sin(latitude) * Math.cos(longitude),
      228.646218 * Math.cos(latitude),
      0,
    );
    const scene = new DOMMatrix(getComputedStyle(
      document.querySelector(".polycss-scene"),
    ).transform);
    const bodyElement = document.querySelector(".mars-body");
    const system = new DOMMatrix(getComputedStyle(
      bodyElement.parentElement,
    ).transform);
    const body = new DOMMatrix(getComputedStyle(bodyElement).transform);
    const projectedNorth = northTangent.matrixTransform(
      scene.multiply(system).multiply(body),
    );
    const currentAngleDegrees = Math.atan2(
      projectedNorth.y,
      projectedNorth.x,
    ) * 180 / Math.PI;
    const roll = ((-90 - currentAngleDegrees + 540) % 360) - 180;
    document.querySelector(".polycss-camera").style.rotate = `${roll}deg`;
    document.querySelector(".planet-cubic-sky-orientation").style.rotate =
      `${roll}deg`;
    for (const animation of document.getAnimations()) {
      animation.currentTime = 0;
      animation.pause();
    }
    return roll;
  }, { endpoint, zoom, nativeCamera });
  await twoFrames(page);
  return screenRollDegrees;
}

async function retainBaseline(page) {
  return page.evaluate(() => {
    const stage = document.querySelector(".planet-stage");
    const nodes = [...stage.querySelectorAll("*")];
    window.__marsCalibrationRetained = Object.freeze({
      nodes,
      parents: nodes.map((node) => node.parentNode),
    });
    return {
      stageElementCount: nodes.length,
      signature: {
        stageElementCount: nodes.length,
        surfaceLeafCount: stage.querySelectorAll(".mars-body > s").length,
        retainedLeafCount: stage.querySelectorAll("b, s, u").length,
        canvasCount: stage.querySelectorAll("canvas").length,
        svgCount: stage.querySelectorAll("svg").length,
        surfaceImage: getComputedStyle(stage.querySelector(
          ".mars-body > s:not(.mars-pole)",
        )).backgroundImage,
        polesImage: getComputedStyle(stage.querySelector(
          ".mars-body > .mars-pole",
        )).backgroundImage,
      },
    };
  });
}

async function routeSignature(page) {
  return page.evaluate(() => {
    const stage = document.querySelector(".planet-stage");
    const nodes = [...stage.querySelectorAll("*")];
    return {
      stageElementCount: nodes.length,
      surfaceLeafCount: stage.querySelectorAll(".mars-body > s").length,
      retainedLeafCount: stage.querySelectorAll("b, s, u").length,
      canvasCount: stage.querySelectorAll("canvas").length,
      svgCount: stage.querySelectorAll("svg").length,
      surfaceImage: getComputedStyle(stage.querySelector(
        ".mars-body > s:not(.mars-pole)",
      )).backgroundImage,
      polesImage: getComputedStyle(stage.querySelector(
        ".mars-body > .mars-pole",
      )).backgroundImage,
    };
  });
}

async function measureCalibrationDisc(bytes, density) {
  const { data, info } = await sharp(bytes).removeAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const rows = new Uint32Array(info.height);
  const columns = new Uint32Array(info.width);
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const maximum = Math.max(red, green, blue);
      const minimum = Math.min(red, green, blue);
      if (maximum > 35 && maximum - minimum > 18) {
        rows[y] += 1;
        columns[x] += 1;
      }
    }
  }
  const minimumDenseCount = 20 * density;
  const xs = [...columns].flatMap((count, index) =>
    count > minimumDenseCount ? [index] : []);
  const ys = [...rows].flatMap((count, index) =>
    count > minimumDenseCount ? [index] : []);
  if (xs.length === 0 || ys.length === 0) {
    throw new Error("Calibration disc is not visible in the capture.");
  }
  return Object.freeze({
    minX: xs[0],
    maxX: xs.at(-1),
    minY: ys[0],
    maxY: ys.at(-1),
    width: xs.at(-1) - xs[0] + 1,
    height: ys.at(-1) - ys[0] + 1,
    centerX: (xs[0] + xs.at(-1)) / 2,
    centerY: (ys[0] + ys.at(-1)) / 2,
    classifier:
      "dense saturated calibration pixels; max channel >35 and range >18",
  });
}

async function cropForDensity(bytes, crop, density) {
  return sharp(bytes).extract({
    left: crop.left * density,
    top: crop.top * density,
    width: crop.width * density,
    height: crop.height * density,
  }).png().toBuffer();
}

async function createContactSheet(captures, path) {
  const columns = 3;
  const rows = 4;
  const tileWidth = 469;
  const imageHeight = 245;
  const labelHeight = 40;
  const tileHeight = imageHeight + labelHeight;
  const composites = [];
  for (let index = 0; index < captures.length; index += 1) {
    const capture = captures[index];
    const image = await sharp(capture.path).resize(tileWidth, imageHeight, {
      fit: "cover",
    }).png().toBuffer();
    const label = await sharp({
      create: {
        width: tileWidth,
        height: labelHeight,
        channels: 4,
        background: "#080b11",
      },
    }).composite([{ input: Buffer.from(`
      <svg width="${tileWidth}" height="${labelHeight}"
        xmlns="http://www.w3.org/2000/svg">
        <text x="14" y="27" fill="#f4f6fa" font-size="18"
          font-family="ui-monospace, SFMono-Regular, Menlo, monospace">
          ${escapeXml(`${pad(index + 1)} ${capture.id}`)}
        </text>
      </svg>
    `) }]).png().toBuffer();
    const left = (index % columns) * tileWidth;
    const top = Math.floor(index / columns) * tileHeight;
    composites.push({ input: image, left, top });
    composites.push({ input: label, left, top: top + imageHeight });
  }
  await sharp({
    create: {
      width: columns * tileWidth,
      height: rows * tileHeight,
      channels: 4,
      background: "#000",
    },
  }).composite(composites).png().toFile(path);
}

async function waitForMars(page) {
  await page.waitForFunction(() =>
    window.__mars?.ready === true &&
    document.documentElement.dataset.ready === "true" &&
    document.querySelector(".planet-stage")?.getAttribute("aria-busy") ===
      "false",
  );
}

async function twoFrames(page) {
  await page.evaluate(() => new Promise((resolveFrame) =>
    requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
}

function initialZoom(distance) {
  if (distance < 10_000_000) return 1.7;
  if (distance > 13_000_000) return 1;
  return 1.45;
}

function centerMatches(camera, leaves) {
  if (Math.abs(camera.latitude) >= 87) {
    const pole = camera.latitude > 0 ? "north" : "south";
    return leaves.some(({ className }) =>
      className.includes(`mars-pole-${pole}`));
  }
  const latitudeBounds = [
    -87.1875,
    ...Array.from({ length: 15 }, (_, index) => -78.75 + index * 11.25),
    87.1875,
  ];
  const longitude = ((camera.longitude + 180) % 360 + 360) % 360 - 180;
  return leaves.some(({ latitudeIndex, longitudeIndex }) => {
    if (latitudeIndex === null || longitudeIndex === null) return false;
    const south = latitudeBounds[latitudeIndex - 1];
    const north = latitudeBounds[latitudeIndex];
    const west = -180 + longitudeIndex * 11.25;
    const east = west + 11.25;
    return camera.latitude >= south - 0.001 &&
      camera.latitude <= north + 0.001 &&
      longitude >= west - 0.001 && longitude <= east + 0.001;
  });
}

function atlas(id) {
  const entry = browserAtlasManifest.atlases.find((candidate) =>
    candidate.id === id);
  if (!entry) throw new Error(`Missing browser calibration atlas ${id}.`);
  return entry;
}

function descriptor(entry) {
  return Object.freeze({
    id: entry.id,
    path: resolve(CALIBRATION_ROOT, entry.path),
    width: entry.width,
    height: entry.height,
    encodedSha256: entry.encodedSha256,
    decodedRgbaSha256: entry.decodedRgbaSha256,
    sourceDecodedRgbaSha256: entry.sourceDecodedRgbaSha256,
  });
}

function parseArguments(args) {
  const parsed = {
    registrationOnly: false,
    densities: [1, 2],
    output:
      "output/playwright/google-earth-pro-mars-interaction-video-v1/" +
      "browser-registration",
    baseUrl: "http://127.0.0.1:4210/mars/",
  };
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--registration-only") parsed.registrationOnly = true;
    else if (value === "--dpr") {
      parsed.densities = args[++index].split(",").map(Number);
    } else if (value === "--output") parsed.output = args[++index];
    else if (value === "--base-url") parsed.baseUrl = args[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return Object.freeze(parsed);
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
