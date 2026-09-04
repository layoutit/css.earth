import assert from "node:assert/strict";
import { chromium } from "playwright";

import { objectAdapter } from "../object-adapter.mjs";
import { OBJECTS } from "../objects.mjs";
import { loadPlanetBrowserProfile } from "./load-browser-profile.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const browserChannel = process.env.PLAYWRIGHT_CHANNEL ?? "chrome";
const routes = ["/", ...objectAdapter.routes()];
const implemented = OBJECTS;

const browser = await chromium.launch({
  headless: true,
  channel: browserChannel,
});

try {
  for (const route of routes) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const browserProblems = [];
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        browserProblems.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      browserProblems.push(`pageerror: ${error.message}`);
    });

    const response = await page.goto(new URL(route, baseUrl).href, {
      waitUntil: "networkidle",
    });
    assert.equal(response?.status(), 200, `${route} must return 200`);
    await waitForScene(page);
    assertSceneState(await readSceneState(page), route);
    await proveHeaderFeatures(page, route);
    const persistedPanel = await toggleFirstPanel(page);

    await page.evaluate(() => {
      for (const type of ["pagehide", "pageshow"]) {
        const event = new Event(type);
        Object.defineProperty(event, "persisted", { value: true });
        window.dispatchEvent(event);
      }
    });
    await waitForScene(page);
    assertSceneState(await readSceneState(page), `${route} after cache restore`);
    assert.equal(
      await page.locator(`[id="${persistedPanel.id}"]`).evaluate((panel) => panel.open),
      persistedPanel.open,
      `${route} must restore panel state by semantic id`,
    );
    assert.deepEqual(browserProblems, [], `${route} must not report browser problems`);
    await page.close();
  }
  for (const planet of implemented) {
    await provePlanetLifecycleRaces(browser, planet);
  }
} finally {
  await browser.close();
}

async function provePlanetLifecycleRaces(browser, planet) {
  await proveInterruptedImport(browser, planet.id);
  await proveInterruptedDecode(browser, planet.id);
  await proveRepeatedMountedDestroy(browser, planet);
}

async function proveInterruptedImport(browser, planetId) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const problems = captureProblems(page);
  let releaseImport;
  let importStarted;
  const importGate = new Promise((resolve) => { releaseImport = resolve; });
  const started = new Promise((resolve) => { importStarted = resolve; });
  await page.route(new RegExp(`/src/planets/${planetId}/runtime/client\\.mjs`),
    async (route) => {
      importStarted();
      await importGate;
      await route.continue();
    });
  const navigation = page.goto(new URL(`/${planetId}/`, baseUrl).href, {
    waitUntil: "domcontentloaded",
  });
  await started;
  await dispatchPersisted(page, "pagehide");
  assert.equal(await page.locator(".polycss-camera").count(), 0,
    "destroy before object renderer import must not mount a camera");
  await dispatchPersisted(page, "pageshow");
  releaseImport();
  await navigation;
  await waitForScene(page);
  assertSceneState(
    await readSceneState(page),
    `${planetId} after interrupted import`,
  );
  assert.deepEqual(problems, [], "interrupted import must report no browser problems");
  await page.close();
}

async function proveInterruptedDecode(browser, planetId) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const problems = captureProblems(page);
  let releaseBank;
  let bankStarted;
  const bankGate = new Promise((resolve) => { releaseBank = resolve; });
  const started = new Promise((resolve) => { bankStarted = resolve; });
  await page.route(new RegExp(`/scenes/${planetId}/`),
    async (route) => {
      bankStarted();
      await bankGate;
      await route.continue();
    });
  await page.goto(new URL(`/${planetId}/`, baseUrl).href, {
    waitUntil: "domcontentloaded",
  });
  await started;
  await dispatchPersisted(page, "pagehide");
  assert.equal(await page.locator(".polycss-camera").count(), 0,
    "destroy during decode must not retain a camera");
  await dispatchPersisted(page, "pageshow");
  releaseBank();
  await waitForScene(page);
  assertSceneState(
    await readSceneState(page),
    `${planetId} after interrupted decode`,
  );
  assert.deepEqual(problems, [], "interrupted decode must report no browser problems");
  await page.close();
}

async function proveRepeatedMountedDestroy(browser, planet) {
  const { id: planetId } = planet;
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const problems = captureProblems(page);
  await page.goto(new URL(`/${planetId}/`, baseUrl).href, { waitUntil: "networkidle" });
  await waitForScene(page);
  const profile = await loadPlanetBrowserProfile(planet);
  const retainedBefore = await profile.retainedImages(page);
  const baseline = await retainedSceneCounts(page);
  await page.evaluate(() => {
    for (const type of ["pagehide", "pageshow", "pagehide", "pageshow"]) {
      const event = new Event(type);
      Object.defineProperty(event, "persisted", { value: true });
      window.dispatchEvent(event);
    }
  });
  await waitForScene(page);
  for (let cycle = 0; cycle < 2; cycle += 1) {
    await dispatchPersisted(page, "pagehide");
    await dispatchPersisted(page, "pagehide");
    assert.equal(await page.locator(".polycss-camera").count(), 0,
      "repeated destroy must leave no camera");
    await dispatchPersisted(page, "pageshow");
    await dispatchPersisted(page, "pageshow");
    await waitForScene(page);
  }
  assertSceneState(
    await readSceneState(page),
    `${planetId} after repeated destroy`,
  );
  assert.deepEqual(await retainedSceneCounts(page), baseline,
    "rapid remount and BFCache cycles must preserve scene and animation ownership");
  assert.equal(await profile.stable(page), true,
    "rapid remount and BFCache cycles must preserve retained identity");
  const retainedAfter = await profile.retainedImages(page);
  if (retainedBefore !== null && retainedAfter !== null) {
    assert.equal(retainedAfter, retainedBefore,
      "persisted restore must not grow the retained image pool");
  }
  assert.deepEqual(problems, [], "repeated destroy must report no browser problems");
  await page.close();
}

function retainedSceneCounts(page) {
  return page.locator(".planet-stage").evaluate((stage) => ({
    children: stage.childElementCount,
    elements: stage.querySelectorAll("*").length,
    animations: stage.getAnimations({ subtree: true }).length,
  }));
}

function captureProblems(page) {
  const problems = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      problems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    problems.push(`pageerror: ${error.message}`);
  });
  return problems;
}

function dispatchPersisted(page, type) {
  return page.evaluate((eventType) => {
    const event = new Event(eventType);
    Object.defineProperty(event, "persisted", { value: true });
    window.dispatchEvent(event);
  }, type);
}

async function toggleFirstPanel(page) {
  const panel = page.locator(".planet-information-panel > details").first();
  const state = await panel.evaluate((element) => {
    if (!element.id) throw new Error("Planet shell panel identity is missing.");
    element.open = !element.open;
    return { id: element.id, open: element.open };
  });
  await page.waitForFunction(({ id, open }) => {
    const objectId = document.body.dataset.objectShell;
    const saved = JSON.parse(localStorage.getItem(`css.earth:${objectId}:panels`));
    return Array.isArray(saved) && saved.includes(id) === open;
  }, state);
  return state;
}

async function waitForScene(page) {
  await page.waitForFunction(() =>
    window.__cssEarth?.ready === true ||
    window.__cssEarth?.lifecycle === "error");
}

async function readSceneState(page) {
  return page.evaluate(() => {
    const stage = document.querySelector(".planet-stage");
    return {
      activeObjectId: window.__cssEarth?.activeObjectId,
      error: window.__cssEarth?.error,
      lifecycle: window.__cssEarth?.lifecycle,
      mountedObjectCount: window.__cssEarth?.mountedObjectCount,
      ready: window.__cssEarth?.ready,
      stageBusy: stage?.getAttribute("aria-busy"),
      stageCount: document.querySelectorAll(".planet-stage").length,
      stageObjectId: stage?.dataset.objectId,
    };
  });
}

function assertSceneState(state, route) {
  assert.equal(state.error, null, `${route} must not report a scene error`);
  assert.equal(state.ready, true, `${route} must reach ready`);
  assert.equal(state.lifecycle, "paused", `${route} must start with motion off`);
  assert.equal(state.mountedObjectCount, 1, `${route} must mount one object`);
  assert.equal(state.stageCount, 1, `${route} must publish one stage`);
  assert.equal(state.stageBusy, "false", `${route} must settle the stage`);
  assert.equal(state.activeObjectId, state.stageObjectId,
    `${route} must mount the requested object`);
}

async function proveHeaderFeatures(page, route) {
  const panel = page.locator(".planet-settings-panel");
  const settings = panel.locator(".planet-settings");
  const motion = page.locator(".planet-motion-setting");
  const motionControl = page.locator(".planet-motion-setting-control");
  const skyContrast = page.locator(".planet-sky-contrast-setting");
  const skyContrastControl = page.locator(
    ".planet-sky-contrast-setting-control",
  );
  const action = page.locator(".planet-settings-action");
  assert.equal(await action.count(), 1,
    `${route} must provide one settings action`);
  assert.equal(await page.locator(".planet-settings-sidebar").count(), 0,
    `${route} must not provide a separate settings sidebar`);
  assert.equal(await panel.count(), 1,
    `${route} must provide one settings panel`);
  assert.equal(await panel.getAttribute("open"), null,
    `${route} settings panel must be collapsed by default`);
  assert.equal(await settings.isHidden(), true,
    `${route} collapsed settings panel must hide its controls`);

  await action.click();
  assert.equal(await panel.getAttribute("open"), "",
    `${route} settings action must open the settings panel`);
  assert.equal(await action.getAttribute("aria-expanded"), "true",
    `${route} settings action must publish its expanded state`);
  assert.equal(await settings.isVisible(), true,
    `${route} open settings panel must show its controls`);
  const [actionBox, panelBox] = await Promise.all([
    action.boundingBox(),
    panel.boundingBox(),
  ]);
  assert.ok(actionBox && panelBox,
    `${route} settings action and panel must have layout boxes`);
  assert.ok(Math.abs((panelBox.x + panelBox.width) -
    (actionBox.x + actionBox.width)) < 1,
  `${route} settings panel must align with the action's right edge`);
  assert.ok(panelBox.y >= actionBox.y + actionBox.height,
    `${route} settings panel must open below the action`);
  assert.equal(await motion.isChecked(), false,
    `${route} motion setting must be off by default`);
  assert.equal(await skyContrast.isChecked(), false,
    `${route} high-contrast sky must be off by default`);
  assert.equal(await page.locator("body").getAttribute("data-sky-contrast"),
    "standard", `${route} must start with the standard sky`);
  const skyFaces = page.locator(".planet-cubic-sky-face");
  const frontSkyFace = page.locator(".planet-cubic-sky-front");
  const faceCount = await skyFaces.count();
  assert.equal(faceCount, 6, `${route} must retain six sky faces`);
  const activeObjectId = await page.evaluate(() =>
    window.__cssEarth?.activeObjectId);
  assert.equal(
    await page.locator(".planet-directional-sun").count(),
    activeObjectId === "sun" ? 0 : 1,
    `${route} must retain the generic directional Sun when applicable`,
  );
  assert.match(
    await frontSkyFace.evaluate((face) =>
      getComputedStyle(face).backgroundImage),
    /-standard(?:@2x)?\.webp/u,
    `${route} must render the subdued prepared sky by default`,
  );

  await skyContrastControl.click();
  assert.equal(await skyContrast.isChecked(), true,
    `${route} high-contrast sky setting must turn on`);
  assert.equal(await page.locator("body").getAttribute("data-sky-contrast"),
    "high", `${route} must publish the high-contrast sky state`);
  const highContrastBackground = await frontSkyFace.evaluate((face) =>
    getComputedStyle(face).backgroundImage);
  assert.match(highContrastBackground, /-starfield-front(?:@2x)?\.webp/u,
    `${route} must render the prepared high-contrast sky`);
  assert.doesNotMatch(highContrastBackground, /-standard/u,
    `${route} high-contrast sky must not reuse the standard bank`);
  assert.equal(await skyFaces.count(), faceCount,
    `${route} sky contrast must not remount retained faces`);
  await skyContrastControl.click();
  assert.equal(await skyContrast.isChecked(), false,
    `${route} high-contrast sky setting must turn off`);

  await motionControl.click();
  await page.waitForFunction(() => window.__cssEarth?.lifecycle === "mounted");
  assert.equal(await motion.isChecked(), true,
    `${route} motion setting must resume the mounted scene`);
  await motionControl.click();
  await page.waitForFunction(() => window.__cssEarth?.lifecycle === "paused");
  assert.equal(await motion.isChecked(), false,
    `${route} motion setting must pause the mounted scene`);

  const shadowInput = page.locator(
    '.planet-settings input[name="shadows"][type="checkbox"]',
  );
  if (await shadowInput.count() > 0) {
    const initial = await shadowInput.isChecked();
    const shadowControl = shadowInput.locator("..");
    await shadowControl.click();
    assert.equal(await shadowInput.isChecked(), !initial,
      `${route} settings panel must update the object shadow setting`);
    await shadowControl.click();
    assert.equal(await shadowInput.isChecked(), initial,
      `${route} settings panel must restore the object shadow setting`);
  }

  await action.click();
  assert.equal(await panel.getAttribute("open"), null,
    `${route} settings action must close the settings panel`);
  assert.equal(await action.getAttribute("aria-expanded"), "false",
    `${route} settings action must publish its collapsed state`);
}
