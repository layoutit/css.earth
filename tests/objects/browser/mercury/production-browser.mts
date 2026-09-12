declare global { interface Window { __mercuryProductionNodes: Element[]; } }
import assert from "node:assert/strict";
import { chromium, type Page } from "playwright";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4310";
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
});
const reports = [];

try {
  for (const deviceScaleFactor of [1, 2]) {
    const context = await browser.newContext({
      deviceScaleFactor,
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    const externalRequests: string[] = [];
    const problems: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).origin !== new URL(baseUrl).origin) {
        externalRequests.push(request.url());
      }
    });
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        problems.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));

    const response = await page.goto(new URL("/mercury/", baseUrl).href, {
      waitUntil: "networkidle",
    });
    assert.equal(response?.status(), 200);
    await page.waitForFunction(() =>
      document.documentElement.dataset.ready === "true" &&
      document.documentElement.dataset.playing === "false");

    const stage = page.locator(".planet-stage");
    const initial = await stage.evaluate((element) => {
      function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }
      function requiredInput(value: Element | null): HTMLInputElement { if (!(value instanceof HTMLInputElement)) throw new Error("Expected required HTMLInputElement"); return value; }

      window.__mercuryProductionNodes = [element, ...element.querySelectorAll<HTMLElement>("*")];
      return {
        retainedNodes: window.__mercuryProductionNodes.length,
        canvas: element.querySelectorAll<HTMLElement>("canvas").length,
        svg: element.querySelectorAll<HTMLElement>("svg").length,
        shadows: requiredInput(document.querySelector('input[name="shadows"]')).checked,
        materialMode: requiredElement(element.querySelector(".mercury-material")).getAttribute("data-material-mode"),
      };
    });
    assert.equal(initial.canvas, 0);
    assert.equal(initial.svg, 0);
    const assertRetained = async () => assert.equal(await stage.evaluate((element) => {
      const nodes = [element, ...element.querySelectorAll<HTMLElement>("*")];
      return nodes.length === window.__mercuryProductionNodes.length &&
        nodes.every((node, index) => node === window.__mercuryProductionNodes[index]);
    }), true, "Interaction preserves the original scene nodes");
    const startupResources = await page.evaluate(() =>
      performance.getEntriesByType("resource").filter((entry): entry is PerformanceResourceTiming => entry instanceof PerformanceResourceTiming).map(({ name }) => name));
    assert.equal(startupResources.some((url) =>
      url.includes("/scenes/mercury/mercury-interior-")), true);
    assert.equal(await page.evaluate(() => window.__cssEarth), undefined);
    assert.equal(await page.evaluate(() => window.__mercury), undefined);

    assert.equal(await page.locator("#mercury-charts")
      .getAttribute("data-active-chart"), "reflectance");
    await page.locator("#mercury-charts .planet-chart-next").click();
    assert.equal(await page.locator("#mercury-charts")
      .getAttribute("data-active-chart"), "photometric-phase");
    assert.equal(await page.locator("#mercury-temperature-pressure").count(), 0);
    assert.equal(await page.locator(
      'img[src="/scenes/mercury/mercury-no-atmosphere-profile.svg"]',
    ).count(), 0);
    assert.equal(await page.locator("#mercury-lenses").evaluate((details) =>
      {
if (!(details instanceof HTMLDetailsElement)) throw new Error("Expected HTMLDetailsElement observation");
return details.open; }), true);
    for (const lens of ["enhanced", "topography", "interior", "normal"]) {
      await page.locator(`button[name="lens"][value="${lens}"]`).click();
      await page.waitForFunction((id) =>
        document.querySelector<HTMLElement>(".planet-stage")?.dataset.view === "interior"
          ? id === "interior"
          : (document.querySelector<HTMLElement>(".planet-stage")?.dataset.lens || "normal") ===
            id, lens);
      assert.equal(await page.locator(
        `button[name="lens"][value="${lens}"]`,
      ).getAttribute("aria-pressed"), "true");
      await assertRetained();
    }

    const beforeDrag = await page.locator(".mercury-scene")
      .evaluate((element) => element.style.transform);
    const beforeSkyDrag = await page.locator(".mercury-skybox-orientation")
      .evaluate((element) => element.style.transform);
    await drag(page, ".planet-input-surface", 170, 150);
    assert.notEqual(await page.locator(".mercury-scene")
      .evaluate((element) => element.style.transform), beforeDrag);
    assert.notEqual(await page.locator(".mercury-skybox-orientation")
      .evaluate((element) => element.style.transform), beforeSkyDrag);

    await page.mouse.down();
    await page.mouse.up();
    const distance = () => page.locator(".mercury-camera").evaluate((camera) =>
      {
      function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }
return parseFloat(getComputedStyle(camera).perspective) -
      new DOMMatrix(getComputedStyle(requiredElement(camera.querySelector(".mercury-scene"))).transform).m43; });
    const beforeWheel = await distance();
    assert.ok(Number.isFinite(beforeWheel) && beforeWheel > 0);
    await wheel(page, ".planet-input-surface", -240);
    await page.waitForFunction((before) => {
      function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }

      const camera = requiredElement(document.querySelector(".mercury-camera"));
      const depth = parseFloat(getComputedStyle(camera).perspective) -
        new DOMMatrix(getComputedStyle(requiredElement(camera.querySelector(".mercury-scene"))).transform).m43;
      return depth > 0 && depth < before;
    }, beforeWheel);
    assert.ok(await distance() < beforeWheel, "Wheel zoom moves the physical camera closer");
    await assertRetained();

    const speed = page.locator('input[name="speed"][type="range"]');
    assert.equal(await speed.getAttribute("data-state"), "normal");
    await speed.evaluate((input) => {
if (!(input instanceof HTMLInputElement)) throw new Error("Expected HTMLInputElement observation");

      input.value = "2";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    assert.equal(await speed.getAttribute("data-state"), "fast");
    const shadows = page.locator('input[name="shadows"]');
    await shadows.evaluate((input) => {
if (!(input instanceof HTMLInputElement)) throw new Error("Expected HTMLInputElement observation");

      input.checked = false;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    assert.equal(await stage.evaluate((element) =>
      element.classList.contains("mercury-hide-shadows")), true);
    const shadowlessMaterial = page.locator(".mercury-material");
    assert.equal(await shadowlessMaterial.evaluate((element) =>
      getComputedStyle((() => { const parent = element.parentElement; if (!parent) throw new Error("Material parent missing"); return parent; })()).visibility), "visible");
    assert.equal(await shadowlessMaterial.getAttribute("data-material-mode"),
      "full-phase-curvature");
    assert.match(await shadowlessMaterial.evaluate((element) =>
      getComputedStyle(element).backgroundImage),
    /mercury-lighting-2x-row-31/u);
    assert.equal(await shadowlessMaterial.evaluate((element) =>
      getComputedStyle(element).transform), "none");
    const shadowlessBackground = await shadowlessMaterial.evaluate((element) =>
      getComputedStyle(element).backgroundImage);
    for (const [deltaX, deltaY] of [[240, -110], [-360, 190], [510, 260]]) {
      await drag(page, ".planet-input-surface", deltaX, deltaY);
      assert.equal(await shadowlessMaterial.getAttribute("data-material-mode"),
        "full-phase-curvature");
      assert.equal(await shadowlessMaterial.evaluate((element) =>
        getComputedStyle(element).backgroundImage), shadowlessBackground);
      await assertRetained();
    }
    assert.match(await page.locator(
      ".mercury-cutaway-body > .mercury-cutaway-outer-pole",
    ).first().evaluate((element) => getComputedStyle(element).backgroundImage),
    /mercury-interior-outer-poles/u);

    await page.evaluate(() => {
      for (const type of ["pagehide", "pageshow"]) {
        const event = new Event(type);
        Object.defineProperty(event, "persisted", { value: true });
        window.dispatchEvent(event);
      }
    });
    await page.waitForFunction(() =>
      document.documentElement.dataset.ready === "true" &&
      document.documentElement.dataset.playing === "false");
    await page.waitForFunction((mode) =>
      document.querySelector<HTMLElement>(".mercury-material")?.getAttribute("data-material-mode") === mode,
    initial.materialMode);
    assert.equal(await page.locator(".polycss-camera").count(), 1);
    assert.equal(await speed.getAttribute("data-state"), "normal");
    assert.equal(await shadows.isChecked(), initial.shadows);
    assert.equal(await stage.evaluate((element) =>
      element.classList.contains("mercury-hide-shadows")), !initial.shadows);
    assert.equal(await shadowlessMaterial.getAttribute("data-material-mode"),
      initial.materialMode);

    const resources = await page.evaluate(() =>
      performance.getEntriesByType("resource").filter((entry): entry is PerformanceResourceTiming => entry instanceof PerformanceResourceTiming).map((entry) => entry.name));
    // Mount decodes the prepared level-0 surface; @2x follows only when the
    // projected silhouette needs it.
    assert.ok(resources.some((url) =>
      url.endsWith("/scenes/mercury/mercury-surface-normal.jpg")));
    const expectedLightingDensity = "/scenes/mercury/mercury-lighting-2x-row-";
    const wrongLightingDensity = "/scenes/mercury/mercury-lighting-1x-row-";
    assert.ok(resources.some((url) => url.includes(expectedLightingDensity)));
    assert.equal(resources.some((url) => url.includes(wrongLightingDensity)), false);
    assert.equal(resources.filter((url) => url.endsWith(
      "/scenes/mercury/mercury-starfield-front@2x.webp") ||
      url.endsWith("/scenes/mercury/mercury-starfield-right@2x.webp") ||
      url.endsWith("/scenes/mercury/mercury-starfield-back@2x.webp") ||
      url.endsWith("/scenes/mercury/mercury-starfield-left@2x.webp") ||
      url.endsWith("/scenes/mercury/mercury-starfield-top@2x.webp") ||
      url.endsWith("/scenes/mercury/mercury-starfield-bottom@2x.webp")
    ).length, 6);
    assert.deepEqual(externalRequests, []);
    assert.deepEqual(problems, []);
    reports.push({
      deviceScaleFactor,
      retainedNodes: initial.retainedNodes,
      selectedPreparedDensity: 2,
      externalRequests: externalRequests.length,
      browserProblems: problems.length,
    });
    await context.close();
  }

  console.log(JSON.stringify({
    ok: true,
    route: "/mercury/",
    mode: "production-build-without-development-diagnostics",
    reports,
  }, null, 2));
} finally {
  await browser.close();
}

async function drag(page: Page, selector: string, deltaX: number, deltaY: number) {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box);
  const x = box.x + box.width * 0.72;
  const y = box.y + box.height * 0.5;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + deltaX, y + deltaY, { steps: 12 });
  await page.mouse.up();
  await page.evaluate(() => new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function wheel(page: Page, selector: string, deltaY: number) {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box);
  await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.5);
  await page.mouse.wheel(0, deltaY);
  await page.evaluate(() => new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
