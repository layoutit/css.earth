import assert from "node:assert/strict";
import { chromium } from "playwright";
import sharp from "sharp";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
});
const reports = [];

try {
  for (const density of [1, 2]) {
    const context = await browser.newContext({
      viewport: { width: 1200, height: 900 },
      deviceScaleFactor: density,
    });
    const page = await context.newPage();
    const browserProblems = [];
    const externalRequests = [];
    const requestedPaths = new Set();
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        browserProblems.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      browserProblems.push(`pageerror: ${error.message}`);
    });
    page.on("request", (request) => {
      const requestUrl = new URL(request.url());
      requestedPaths.add(requestUrl.pathname);
      if (requestUrl.origin !== new URL(baseUrl).origin) {
        externalRequests.push(request.url());
      }
    });

    try {
      const response = await page.goto(new URL("/neptune/", baseUrl).href, {
        waitUntil: "networkidle",
      });
      assert.equal(response?.status(), 200);
      await page.waitForFunction(() =>
        window.__cssEarth?.ready === true &&
        window.__neptune?.ready === true &&
        document.documentElement.dataset.ready === "true");

      const state = await page.evaluate(() => ({
        title: document.title,
        mountedObjectCount: window.__cssEarth.mountedObjectCount,
        activeObjectId: window.__cssEarth.activeObjectId,
        stageCount: document.querySelectorAll(".planet-stage").length,
        cameraCount: document.querySelectorAll(".polycss-camera").length,
        sceneCount: document.querySelectorAll(
          ".planet-stage .polycss-scene",
        ).length,
        renderRootCount: document.querySelectorAll(
          ".planet-stage > .planet-render-root",
        ).length,
        bodyLeafCount: document.querySelectorAll(".neptune-body > s").length,
        ringLeafCount: document.querySelectorAll(
          ".neptune-ring-plane > s",
        ).length,
        materialLeafCount: document.querySelectorAll(
          "s.neptune-exterior-material",
        ).length,
        materialTag: document.querySelector(
          ".neptune-exterior-material",
        )?.tagName,
        stageElements: document.querySelector(
          ".planet-stage",
        ).querySelectorAll("*").length,
        selectedDensity:
          window.__neptune.renderStats.textureStats.selectedPreparedDensity,
        stable: window.__neptune.assertStableDomIdentity(),
        canvasCount: document.querySelectorAll("canvas").length,
        sceneSvgCount: document.querySelectorAll(".planet-stage svg").length,
        imageCount: document.querySelectorAll(".planet-stage img").length,
        planetImageDivCount: [...document.querySelectorAll(
          ".planet-stage div",
        )].filter((element) => {
          const bounds = element.getBoundingClientRect();
          return bounds.width > 200 && bounds.height > 200 &&
            getComputedStyle(element).backgroundImage !== "none";
        }).length,
      }));
      assert.deepEqual(state, {
        title: "Neptune - Powered by PolyCSS",
        mountedObjectCount: 1,
        activeObjectId: "neptune",
        stageCount: 1,
        cameraCount: 1,
        sceneCount: 1,
        renderRootCount: 1,
        bodyLeafCount: 724,
        ringLeafCount: 1,
        materialLeafCount: 1,
        materialTag: "S",
        stageElements: 1464,
        selectedDensity: 2,
        stable: true,
        canvasCount: 0,
        sceneSvgCount: 0,
        imageCount: 0,
        planetImageDivCount: 6,
      });

      for (const stem of ["neptune-rings", "neptune-surface-normal"]) {
        assert.ok(requestedPaths.has(`/scenes/neptune/${stem}@2x.webp`));
        assert.equal(
          requestedPaths.has(`/scenes/neptune/${stem}.webp`),
          false,
        );
      }

      await assertRingCompleteness(page, density);
      if (density === 1) await proveInteraction(page, state.stageElements);
      assert.deepEqual(externalRequests, []);
      assert.deepEqual(browserProblems, []);
      reports.push({ density, stageElements: state.stageElements, problems: 0 });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ ok: true, route: "/neptune/", reports }, null, 2));

async function assertRingCompleteness(page, density) {
  const geometry = await page.evaluate(() => {
    window.__neptune.pause();
    const hidden = [
      ...document.querySelectorAll(".planet-sidebar, .planet-topbar"),
    ];
    for (const element of hidden) element.style.visibility = "hidden";
    const planet = document.querySelector(".neptune-exterior-material")
      .getBoundingClientRect();
    return {
      planet: {
        left: planet.left,
        right: planet.right,
        top: planet.top,
        bottom: planet.bottom,
      },
    };
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() =>
    requestAnimationFrame(resolve))));
  const visible = await page.screenshot();
  await page.locator(".neptune-ring-plane").evaluate((ring) => {
    ring.style.visibility = "hidden";
  });
  const hidden = await page.screenshot();
  await page.locator(".neptune-ring-plane").evaluate((ring) => {
    ring.style.removeProperty("visibility");
  });
  await page.evaluate(() => {
    for (const element of document.querySelectorAll(
      ".planet-sidebar, .planet-topbar",
    )) {
      element.style.removeProperty("visibility");
    }
  });
  const [visibleRaster, hiddenRaster] = await Promise.all([
    sharp(visible).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(hidden).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  assert.deepEqual(visibleRaster.info, hiddenRaster.info);
  const planetLeft = Math.floor(geometry.planet.left * density);
  const planetRight = Math.ceil(geometry.planet.right * density);
  const planetTop = Math.floor(geometry.planet.top * density);
  const planetBottom = Math.ceil(geometry.planet.bottom * density);
  const verticalMargin = Math.ceil((planetBottom - planetTop) * 0.65);
  const top = Math.max(0, planetTop - verticalMargin);
  const bottom = Math.min(visibleRaster.info.height, planetBottom + verticalMargin);
  const changed = { left: 0, right: 0 };
  const maximumDifference = { left: 0, right: 0 };
  for (let y = top; y < bottom; y += 1) {
    for (let x = 0; x < visibleRaster.info.width; x += 1) {
      const side = x < planetLeft ? "left" : x >= planetRight ? "right" : null;
      if (!side) continue;
      const offset = (y * visibleRaster.info.width + x) *
        visibleRaster.info.channels;
      const difference = Math.max(
        Math.abs(visibleRaster.data[offset] - hiddenRaster.data[offset]),
        Math.abs(visibleRaster.data[offset + 1] - hiddenRaster.data[offset + 1]),
        Math.abs(visibleRaster.data[offset + 2] - hiddenRaster.data[offset + 2]),
      );
      maximumDifference[side] = Math.max(maximumDifference[side], difference);
      if (difference >= 2) changed[side] += 1;
    }
  }
  for (const side of ["left", "right"]) {
    assert.ok(changed[side] >= 8 * density,
      `Neptune ring is incomplete on the ${side} at DPR ${density}: ` +
        `${changed[side]} changed pixels, maximum delta ` +
        `${maximumDifference[side]}`);
  }
}

async function proveInteraction(page, retainedCount) {
  for (const id of ["methane", "near-infrared", "normal"]) {
    assert.equal(await page.evaluate((lensId) =>
      window.__neptune.lenses.select(lensId), id), true);
    const lens = await page.evaluate(() => ({
      state: window.__neptune.lenses.state(),
      visible: document.querySelector(".planet-stage").dataset.lens,
      bodyTexture: getComputedStyle(document.querySelector(
        ".neptune-body:not(.neptune-body-polar) > s",
      )).backgroundImage,
      count: document.querySelector(".planet-stage").querySelectorAll("*")
        .length,
      stable: window.__neptune.assertStableDomIdentity(),
    }));
    assert.deepEqual(lens.state, { id, ready: true });
    assert.equal(lens.visible, id);
    assert.match(lens.bodyTexture,
      new RegExp(`neptune-surface-${id}@2x\\.webp`, "u"));
    assert.equal(lens.count, retainedCount);
    assert.equal(lens.stable, true);
  }

  const rings = page.locator('.planet-settings input[name="rings"]');
  await rings.evaluate((element) => element.click());
  assert.equal(await page.evaluate(() =>
    window.__neptune.features.state().rings), false);
  assert.equal(await page.locator(".neptune-ring-plane").evaluate((node) =>
    getComputedStyle(node).visibility), "hidden");
  await rings.evaluate((element) => element.click());

  const speed = page.locator('.planet-settings button[name="speed"]');
  await speed.evaluate((element) => element.click());
  assert.equal(await page.evaluate(() =>
    window.__neptune.options.state().speed), 2);

  const before = await page.evaluate(() => window.__neptune.camera.state());
  await page.evaluate(() => window.__neptune.camera.setState({
    controlPitch: 70,
    controlYaw: 137,
    zoom: 1.7,
  }));
  const after = await page.evaluate(() => window.__neptune.camera.state());
  assert.notDeepEqual(after, before);
  assert.deepEqual(after, {
    pitch: 70,
    controlPitch: 70,
    controlYaw: 137,
    zoom: 1.7,
  });
  assert.equal(await page.evaluate(() =>
    window.__neptune.assertStableDomIdentity()), true);

  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  assert.equal(await page.locator(".planet-stage").evaluate((stage) =>
    stage.childElementCount), 0);
  assert.equal(await page.evaluate(() =>
    typeof window.__neptune === "undefined"), true);
}
