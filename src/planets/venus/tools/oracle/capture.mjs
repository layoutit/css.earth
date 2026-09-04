import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium } from "playwright";
import sharp from "sharp";

import {
  comparePngBuffers,
  sha256,
} from "./image-analysis.mjs";
import {
  GOOGLE_MAPS_VENUS_URL,
  deriveBrowserCamera,
  intersectsSceneClip,
  ORACLE_CAMERA_MODEL,
  ORACLE_CAMERA_TOLERANCE,
  ORACLE_LENS,
  ORACLE_POSES,
  ORACLE_QUALIFICATION,
  ORACLE_SCENE_CLIP,
  ORACLE_STABILITY,
  ORACLE_VIEWPORT,
  parseGoogleCameraUrl,
} from "./profile.mjs";

const GOOGLE_ACTIONS = Object.freeze({
  "rotate-clockwise": Object.freeze({
    kind: "click",
    role: "button",
    name: "Rotate the view clockwise",
  }),
  "rotate-counterclockwise": Object.freeze({
    kind: "click",
    role: "button",
    name: "Rotate the view counterclockwise",
  }),
  "pan-right": Object.freeze({
    kind: "press",
    role: "application",
    key: "ArrowRight",
  }),
  "pan-up": Object.freeze({
    kind: "press",
    role: "application",
    key: "ArrowUp",
  }),
  "pan-down": Object.freeze({
    kind: "press",
    role: "application",
    key: "ArrowDown",
  }),
  "zoom-in": Object.freeze({
    kind: "click",
    role: "button",
    name: "Zoom in",
  }),
  "zoom-out": Object.freeze({
    kind: "click",
    role: "button",
    name: "Zoom out",
  }),
});

export async function captureGoogleMapsReference({
  outputRoot,
  browserChannel = process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
}) {
  const referenceRoot = resolve(outputRoot, "reference");
  const rawRoot = resolve(outputRoot, "raw", "google-maps");
  await Promise.all([
    mkdir(referenceRoot, { recursive: true }),
    mkdir(rawRoot, { recursive: true }),
  ]);
  const browser = await chromium.launch({ channel: browserChannel, headless: true });
  const browserVersion = browser.version();
  const poses = [];
  try {
    for (const pose of ORACLE_POSES) {
      const context = await browser.newContext({
        viewport: ORACLE_VIEWPORT,
        deviceScaleFactor: ORACLE_VIEWPORT.deviceScaleFactor,
        colorScheme: "dark",
        locale: "en-US",
        reducedMotion: "reduce",
      });
      try {
        const page = await context.newPage();
        const pageErrors = [];
        page.on("pageerror", (error) => pageErrors.push(error.message));
        const response = await page.goto(GOOGLE_MAPS_VENUS_URL, {
          waitUntil: "domcontentloaded",
          timeout: 60_000,
        });
        if (!response?.ok()) {
          throw new Error(
            `Google Maps Venus returned HTTP ${response?.status() ?? "unknown"}.`,
          );
        }
        await dismissCookiePrompt(page);
        const venusButton = page.getByRole("button", {
          name: /^Venus Second planet from the Sun$/u,
        });
        try {
          await venusButton.waitFor({ state: "visible", timeout: 60_000 });
        } catch (cause) {
          throw new Error(
            "Google Maps did not expose Space/Venus in the clean browser " +
            "session. Capture a canonical authenticated reference packet " +
            "and pass it with --reference-input.",
            { cause },
          );
        }
        await venusButton.click();
        await page.waitForURL(/\/maps\/space\/venus\//u, { timeout: 30_000 });

        const collapseButton = page.getByRole("button", {
          name: "Collapse side panel",
        });
        await collapseButton.waitFor({ state: "visible", timeout: 30_000 });
        await collapseButton.click();
        await page.getByRole("button", { name: "Expand side panel" })
          .waitFor({ state: "visible", timeout: 30_000 });

        await applyGoogleActions(page, pose.googleActions);
        await page.mouse.move(8, 8);
        await page.evaluate(() => {
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
        });
        const stable = await captureStableScene(page);
        const uiBoxes = await visibleGoogleUiBoxes(page);
        const intrudingUi = uiBoxes.filter(({ box }) => intersectsSceneClip(box));
        if (intrudingUi.length > 0) {
          throw new Error(
            `Google UI intrudes into the scene-only crop: ` +
            intrudingUi.map(({ label }) => label).join(", "),
          );
        }

        const scenePath = resolve(referenceRoot, `${pose.id}.png`);
        const fullPath = resolve(rawRoot, `${pose.id}-full-attributed.png`);
        const fullBytes = await page.screenshot({ type: "png", fullPage: false });
        await Promise.all([
          writeFile(scenePath, stable.bytes),
          writeFile(fullPath, fullBytes),
        ]);
        const currentUrl = page.url();
        poses.push(Object.freeze({
          id: pose.id,
          label: pose.label,
          actions: pose.googleActions,
          requestedUrl: GOOGLE_MAPS_VENUS_URL,
          finalUrl: currentUrl,
          camera: parseGoogleCameraUrl(currentUrl),
          scene: Object.freeze({
            path: scenePath,
            sha256: sha256(stable.bytes),
          }),
          rawAttributedCapture: Object.freeze({
            path: fullPath,
            sha256: sha256(fullBytes),
          }),
          stability: stable.stability,
          uiChrome: Object.freeze({
            excluded: true,
            checkedBoxes: uiBoxes,
            intrudingBoxes: intrudingUi,
          }),
          pageErrorCount: pageErrors.length,
        }));
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  const manifest = Object.freeze({
    schema: "cssvenus-google-maps-reference@3",
    capturedAt: new Date().toISOString(),
    canonicalUrl: GOOGLE_MAPS_VENUS_URL,
    browser: Object.freeze({
      name: "Google Chrome",
      channel: browserChannel,
      version: browserVersion,
      headless: true,
    }),
    viewport: ORACLE_VIEWPORT,
    sceneClip: ORACLE_SCENE_CLIP,
    cameraModel: ORACLE_CAMERA_MODEL,
    animation: "settled-endpoints-only",
    rawAttributedCapturesRetainedLocally: true,
    referenceAssetObservation: null,
    comparisonImagesContainUiChrome: false,
    qualification: ORACLE_QUALIFICATION,
    poses,
  });
  const manifestPath = resolve(referenceRoot, "manifest.json");
  await writeJson(manifestPath, manifest);
  return Object.freeze({ manifest, manifestPath });
}

export async function importGoogleMapsReference({
  inputManifestPath,
  outputRoot,
}) {
  const input = JSON.parse(await readFile(inputManifestPath, "utf8"));
  if (input.schema !== "cssvenus-google-maps-reference-input@3" ||
      input.canonicalUrl !== GOOGLE_MAPS_VENUS_URL) {
    throw new TypeError("Google Maps reference input packet is incompatible.");
  }
  if (input.viewport.width !== ORACLE_VIEWPORT.width ||
      input.viewport.height !== ORACLE_VIEWPORT.height ||
      input.viewport.dpr !== ORACLE_VIEWPORT.deviceScaleFactor) {
    throw new Error("Google Maps reference input viewport is not canonical.");
  }
  const referenceRoot = resolve(outputRoot, "reference");
  const rawRoot = resolve(outputRoot, "raw", "google-maps");
  await Promise.all([
    mkdir(referenceRoot, { recursive: true }),
    mkdir(rawRoot, { recursive: true }),
  ]);
  const poses = [];
  for (const pose of ORACLE_POSES) {
    const source = input.poses.find(({ id }) => id === pose.id);
    if (!source) throw new Error(`Reference input is missing pose ${pose.id}.`);
    if (JSON.stringify(source.actions) !== JSON.stringify(pose.googleActions)) {
      throw new Error(`Reference input actions changed for pose ${pose.id}.`);
    }
    const rawBytes = await readFile(source.path);
    if (sha256(rawBytes) !== source.sha256) {
      throw new Error(`Reference input hash changed for pose ${pose.id}.`);
    }
    const metadata = await sharp(rawBytes).metadata();
    if (metadata.width !== ORACLE_VIEWPORT.width ||
        metadata.height !== ORACLE_VIEWPORT.height) {
      throw new Error(`Reference input dimensions changed for pose ${pose.id}.`);
    }
    const scenePath = resolve(referenceRoot, `${pose.id}.png`);
    const rawPath = resolve(rawRoot, `${pose.id}-full-attributed.png`);
    await sharp(rawBytes).extract({
      left: ORACLE_SCENE_CLIP.x,
      top: ORACLE_SCENE_CLIP.y,
      width: ORACLE_SCENE_CLIP.width,
      height: ORACLE_SCENE_CLIP.height,
    }).png().toFile(scenePath);
    await writeFile(rawPath, rawBytes);
    const sceneBytes = await readFile(scenePath);
    poses.push(Object.freeze({
      id: pose.id,
      label: pose.label,
      actions: pose.googleActions,
      requestedUrl: source.requestedUrl,
      finalUrl: source.finalUrl,
      camera: parseGoogleCameraUrl(source.finalUrl),
      scene: Object.freeze({
        path: scenePath,
        sha256: sha256(sceneBytes),
      }),
      rawAttributedCapture: Object.freeze({
        path: rawPath,
        sha256: source.sha256,
        attribution: source.attribution,
      }),
      stability: Object.freeze({
        attempts: source.stability.attempts,
        comparisons: source.stability.comparisons,
        finalChangedPixelRatio: source.stability.exactConsecutive ? 0 : 1,
        maximumAllowedChangedPixelRatio:
          ORACLE_STABILITY.maximumChangedPixelRatio,
      }),
      uiChrome: Object.freeze({
        excluded: true,
        method: "fixed-scene-clip-after-sidebar-collapse",
        intrudingBoxes: Object.freeze([]),
      }),
      pageErrorCount: null,
    }));
  }
  const manifest = Object.freeze({
    schema: "cssvenus-google-maps-reference@3",
    capturedAt: input.capturedAt,
    importedAt: new Date().toISOString(),
    canonicalUrl: GOOGLE_MAPS_VENUS_URL,
    browser: input.browser,
    viewport: ORACLE_VIEWPORT,
    sceneClip: ORACLE_SCENE_CLIP,
    cameraModel: ORACLE_CAMERA_MODEL,
    animation: "settled-endpoints-only",
    rawAttributedCapturesRetainedLocally: true,
    referenceAssetObservation: input.referenceAssetObservation ?? null,
    exploratorySunSearch: input.exploratorySunSearch ?? null,
    comparisonImagesContainUiChrome: false,
    qualification: ORACLE_QUALIFICATION,
    poses,
  });
  const manifestPath = resolve(referenceRoot, "manifest.json");
  await writeJson(manifestPath, manifest);
  return Object.freeze({ manifest, manifestPath });
}

export async function captureCssEarthBrowser({
  outputRoot,
  baseUrl,
  referenceManifest,
  browserChannel = process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
}) {
  const browserRoot = resolve(outputRoot, "browser");
  const rawRoot = resolve(outputRoot, "raw", "css-earth");
  await Promise.all([
    mkdir(browserRoot, { recursive: true }),
    mkdir(rawRoot, { recursive: true }),
  ]);
  const browser = await chromium.launch({ channel: browserChannel, headless: true });
  const browserVersion = browser.version();
  const poses = [];
  const defaultReference = referenceManifest.poses.find(({ id }) =>
    id === "default");
  if (!defaultReference) {
    throw new Error("Google Maps reference is missing the default camera.");
  }
  try {
    for (const pose of ORACLE_POSES) {
      const referencePose = referenceManifest.poses.find(({ id }) =>
        id === pose.id);
      if (!referencePose) {
        throw new Error(`Google Maps reference is missing pose ${pose.id}.`);
      }
      const browserCamera = deriveBrowserCamera(
        referencePose.camera,
        defaultReference.camera,
      );
      const context = await browser.newContext({
        viewport: ORACLE_VIEWPORT,
        deviceScaleFactor: ORACLE_VIEWPORT.deviceScaleFactor,
        colorScheme: "dark",
        reducedMotion: "reduce",
      });
      try {
        const page = await context.newPage();
        const browserProblems = [];
        const externalRequests = [];
        page.on("pageerror", (error) => browserProblems.push(error.message));
        page.on("console", (message) => {
          if (["error", "warning"].includes(message.type())) {
            browserProblems.push(`${message.type()}: ${message.text()}`);
          }
        });
        page.on("request", (request) => {
          const url = new URL(request.url());
          if (["http:", "https:"].includes(url.protocol) &&
              !["127.0.0.1", "localhost"].includes(url.hostname)) {
            externalRequests.push(request.url());
          }
        });
        const route = new URL("/venus/", baseUrl).href;
        const response = await page.goto(route, {
          waitUntil: "networkidle",
          timeout: 60_000,
        });
        if (!response?.ok()) {
          throw new Error(`cssEarth Venus returned HTTP ${response?.status()}.`);
        }
        await page.waitForFunction(() =>
          document.documentElement.dataset.ready === "true" &&
          window.__venus?.ready === true, null, { timeout: 60_000 });
        const collapse = page.getByRole("button", {
          name: "Collapse information sidebar",
        });
        await collapse.click();
        await page.waitForFunction(() =>
          document.body.dataset.sidebarCollapsed === "true");
        await page.evaluate(async (camera) => {
          await window.__venus.lenses.select(camera.lens);
          window.__venus.camera.setState(camera);
          window.__venus.pause();
          for (const animation of document.getAnimations()) {
            animation.pause();
            animation.currentTime = 0;
          }
        }, { ...browserCamera, lens: ORACLE_LENS });
        await page.waitForFunction((lens) =>
          window.__venus.lenses.state().id === lens &&
          window.__venus.lenses.state().ready === true &&
          document.documentElement.dataset.playing === "false", ORACLE_LENS);
        await page.evaluate(() => new Promise((resolvePromise) =>
          requestAnimationFrame(() => requestAnimationFrame(resolvePromise))));

        const fullBytes = await page.screenshot({ type: "png", fullPage: false });
        await page.addStyleTag({ content: `
          body > *:not(.planet-stage):not(script) {
            visibility: hidden !important;
          }
        ` });
        await page.evaluate(() => new Promise((resolvePromise) =>
          requestAnimationFrame(() => requestAnimationFrame(resolvePromise))));
        const visibleNonStageElements = await page.evaluate(() =>
          [...document.body.children]
            .filter((element) =>
              !element.matches(".planet-stage, script") &&
              getComputedStyle(element).visibility !== "hidden" &&
              getComputedStyle(element).display !== "none" &&
              element.getBoundingClientRect().width > 0 &&
              element.getBoundingClientRect().height > 0)
            .map((element) => element.tagName.toLowerCase()));
        if (visibleNonStageElements.length > 0) {
          throw new Error(
            `cssEarth UI remained visible: ${visibleNonStageElements.join(", ")}.`,
          );
        }
        const stable = await captureStableScene(page);
        const runtime = await page.evaluate(() => ({
          camera: window.__venus.camera.state(),
          cameraStats: window.__venus.camera.stats(),
          material: window.__venus.material.state(),
          lens: window.__venus.lenses.state(),
          stableDomIdentity: window.__venus.assertStableDomIdentity(),
          retainedLeafCount: window.__venus.dom.retainedLeafCount,
          canvasCount: document.querySelectorAll(".planet-stage canvas").length,
          svgCount: document.querySelectorAll(".planet-stage svg").length,
          animations: document.getAnimations().map((animation) => ({
            playState: animation.playState,
            currentTime: animation.currentTime,
          })),
        }));
        const cameraStateChanged = ORACLE_CAMERA_MODEL.browserCoordinates
          .some((coordinate) =>
            Math.abs(runtime.camera[coordinate] -
              browserCamera[coordinate]) > ORACLE_CAMERA_TOLERANCE);
        if (browserProblems.length > 0 || externalRequests.length > 0 ||
            cameraStateChanged || runtime.cameraStats.pitchBounded ||
            runtime.cameraStats.yawBounded ||
            runtime.cameraStats.cameraModel !== "accumulated-matrix3d" ||
            !runtime.stableDomIdentity || runtime.canvasCount !== 0 ||
            runtime.svgCount !== 0 || runtime.animations.some(({ playState }) =>
              playState !== "paused")) {
          throw new Error(
            `cssEarth browser capture failed its runtime closure at ${pose.id}: ` +
            JSON.stringify({
              browserProblems,
              externalRequests,
              cameraStateChanged,
              camera: runtime.camera,
              requestedCamera: browserCamera,
              cameraStats: runtime.cameraStats,
              stableDomIdentity: runtime.stableDomIdentity,
              canvasCount: runtime.canvasCount,
              svgCount: runtime.svgCount,
              animations: runtime.animations,
            }),
          );
        }
        const scenePath = resolve(browserRoot, `${pose.id}.png`);
        const fullPath = resolve(rawRoot, `${pose.id}-full.png`);
        await Promise.all([
          writeFile(scenePath, stable.bytes),
          writeFile(fullPath, fullBytes),
        ]);
        poses.push(Object.freeze({
          id: pose.id,
          label: pose.label,
          route,
          mappingQualification: pose.mappingQualification,
          requestedCamera: browserCamera,
          cameraMapping: Object.freeze({
            model: ORACLE_CAMERA_MODEL.mapping,
            referenceCamera: referencePose.camera,
            defaultReferenceCamera: defaultReference.camera,
          }),
          runtime,
          scene: Object.freeze({
            path: scenePath,
            sha256: sha256(stable.bytes),
          }),
          rawCapture: Object.freeze({
            path: fullPath,
            sha256: sha256(fullBytes),
          }),
          stability: stable.stability,
          uiChrome: Object.freeze({
            excluded: true,
            visibleNonStageElements,
          }),
          externalRequestCount: externalRequests.length,
          browserProblemCount: browserProblems.length,
        }));
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  const manifest = Object.freeze({
    schema: "cssvenus-browser-oracle-capture@3",
    capturedAt: new Date().toISOString(),
    route: new URL("/venus/", baseUrl).href,
    lens: ORACLE_LENS,
    browser: Object.freeze({
      name: "Google Chrome",
      channel: browserChannel,
      version: browserVersion,
      headless: true,
    }),
    viewport: ORACLE_VIEWPORT,
    sceneClip: ORACLE_SCENE_CLIP,
    cameraModel: ORACLE_CAMERA_MODEL,
    animation: "paused-at-zero-settled-endpoints-only",
    comparisonImagesContainUiChrome: false,
    qualification: ORACLE_QUALIFICATION,
    poses,
  });
  const manifestPath = resolve(browserRoot, "manifest.json");
  await writeJson(manifestPath, manifest);
  return Object.freeze({ manifest, manifestPath });
}

async function applyGoogleActions(page, requestedActions) {
  for (const requested of requestedActions) {
    const action = GOOGLE_ACTIONS[requested.id];
    if (!action || !Number.isSafeInteger(requested.count) ||
        requested.count < 1) {
      throw new TypeError(`Invalid Google action: ${JSON.stringify(requested)}`);
    }
    const control = page.getByRole(action.role,
      action.name ? { name: action.name } : {});
    await control.waitFor({ state: "visible", timeout: 30_000 });
    for (let index = 0; index < requested.count; index += 1) {
      if (action.kind === "click") {
        await control.click();
      } else if (action.kind === "press") {
        await control.press(action.key);
      } else {
        throw new TypeError(`Unsupported Google action kind: ${action.kind}`);
      }
      await page.waitForTimeout(ORACLE_STABILITY.actionSettleMilliseconds);
    }
  }
}

async function captureStableScene(page) {
  let previous = null;
  let stableComparisons = 0;
  const comparisons = [];
  for (let attempt = 1; attempt <= ORACLE_STABILITY.maximumAttempts; attempt += 1) {
    const bytes = await page.screenshot({
      type: "png",
      clip: ORACLE_SCENE_CLIP,
      caret: "hide",
      scale: "css",
    });
    if (previous) {
      const comparison = comparePngBuffers(previous, bytes, {
        pixelmatchThreshold: ORACLE_STABILITY.pixelmatchThreshold,
      });
      comparisons.push(comparison.changedPixelRatio);
      if (comparison.changedPixelRatio <=
          ORACLE_STABILITY.maximumChangedPixelRatio) {
        stableComparisons += 1;
      } else {
        stableComparisons = 0;
      }
      if (stableComparisons >= ORACLE_STABILITY.requiredStableComparisons) {
        return Object.freeze({
          bytes,
          stability: Object.freeze({
            attempts: attempt,
            comparisons,
            finalChangedPixelRatio: comparison.changedPixelRatio,
            maximumAllowedChangedPixelRatio:
              ORACLE_STABILITY.maximumChangedPixelRatio,
          }),
        });
      }
    }
    previous = bytes;
    await page.waitForTimeout(ORACLE_STABILITY.intervalMilliseconds);
  }
  throw new Error(
    `Scene did not settle within ${ORACLE_STABILITY.maximumAttempts} captures.`,
  );
}

async function visibleGoogleUiBoxes(page) {
  const queries = [
    ["expand-side-panel", page.getByRole("button", { name: "Expand side panel" })],
    ["google-apps", page.getByRole("button", { name: "Google apps" })],
    ["rotate-counterclockwise", page.getByRole("button", {
      name: "Rotate the view counterclockwise",
    })],
    ["reset-view", page.getByRole("slider", { name: "Reset the view" })],
    ["rotate-clockwise", page.getByRole("button", {
      name: "Rotate the view clockwise",
    })],
    ["tilt", page.getByRole("switch", { name: "Tilt the view" })],
    ["zoom-in", page.getByRole("button", { name: "Zoom in" })],
    ["zoom-out", page.getByRole("button", { name: "Zoom out" })],
    ["contentinfo", page.getByRole("contentinfo")],
    ["tooltip", page.locator('[role="tooltip"]')],
  ];
  const boxes = [];
  for (const [label, locator] of queries) {
    for (const [index, element] of (await locator.all()).entries()) {
      if (!await element.isVisible()) continue;
      const box = await element.boundingBox();
      if (box) boxes.push(Object.freeze({ label: `${label}-${index}`, box }));
    }
  }
  return boxes;
}

async function dismissCookiePrompt(page) {
  for (const name of [/^Accept all$/u, /^I agree$/u]) {
    const button = page.getByRole("button", { name }).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click();
      return;
    }
  }
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}
