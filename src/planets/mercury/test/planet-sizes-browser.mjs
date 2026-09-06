// Actual retained marker bounds and painted footprints. Galaxio's far-point
// core is 2 * 0.6 = 1.2 CSS px; navigation icons are measured separately.
// Usage: node src/planets/mercury/test/planet-sizes-browser.mjs [baseUrl]
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import sharp from "sharp";
import { parseSceneRotation, scenePitchYawDegrees } from "./lighting-geometry-oracle.mjs";
import * as oracle from "./planetary-system-oracle.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const dump = process.env.PLANET_SIZES_DUMP ?? "/tmp/cssearth-planet-sizes";
await mkdir(dump, { recursive: true });
const report = { suite: "mercury-planet-sizes", baseUrl, screenshots: [], poses: [], painted: [], problems: [] };
const AU_KILOMETERS = 149597870.7;
const system = oracle.buildSystemOracle(await oracle.loadPlanetStateVectors());
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome" });
try {
  for (const dpr of [1, 2]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    page.on("pageerror", (error) => report.problems.push(error.message));
    const response = await page.goto(new URL("/mercury/", baseUrl).href, { waitUntil: "networkidle", timeout: 30000 });
    assert.equal(response.status(), 200);
    await page.waitForFunction(() => window.__mercury?.ready && window.__cssEarth?.ready && document.documentElement.dataset.ready === "true");
    await page.evaluate(() => { const motion = document.querySelector('input[name="motion"]'); if (motion.checked) motion.click(); });
    const headerBefore = await navigationSizes(page);
    assert.ok(headerBefore.length > 0, "navigation marker baseline is present");
    const maximumDistance = await page.evaluate(() => window.__mercury.camera.stats().dolly.maximumDistanceKilometers);
    const polePitch = await calibratePole(page);
    const defaultPitch = await page.evaluate(() => window.__mercury.camera.stats().defaultControlPitchDegrees);
    const distances = [maximumDistance, 80 * AU_KILOMETERS, 20 * AU_KILOMETERS, 600000000];
    const samples = [];
    for (const [index, distanceKilometers] of distances.entries()) {
      const close = distanceKilometers === 600000000;
      await page.evaluate((pose) => window.__mercury.camera.setState(pose),
        { controlPitch: close ? defaultPitch : polePitch, controlYaw: close ? 90 : 0, distanceKilometers });
      await nextPaint(page);
      const markers = await readMarkers(page);
      const visible = markers.filter((marker) => marker.visible);
      assert.ok(visible.length >= (close ? 3 : 5), "view contains real planet markers");
      const physical = await physicalSizeOracle(page);
      for (const marker of visible) {
        assert.ok(marker.width >= 1.17 && marker.width < 100.1, `${marker.id} bounded width ${marker.width}`);
        assert.ok(Math.abs(marker.height - marker.width) < 0.01, `${marker.id} square marker`);
        assert.ok(Math.abs(marker.width - Math.max(1.2, physical.diameters[marker.id])) < 0.03,
          `${marker.id}: rendered ${marker.width}px versus independent physical diameter ${physical.diameters[marker.id]}px and 1.2px floor`);
      }
      if (close) {
        const venus = visible.find(({ id }) => id === "venus"), earth = visible.find(({ id }) => id === "earth");
        assert.ok(venus && earth, "the user's failing pose shows both Venus and Earth");
        assert.ok(physical.diameters.venus < physical.diameters.earth, "this pose has a smaller physical Venus disc than Earth");
        assert.ok(venus.width <= earth.width + 0.03, "brightness cannot make Venus larger than Earth");
        assert.ok(venus.width < physical.sunPhotospherePixels && earth.width < physical.sunPhotospherePixels,
          "both planet markers are smaller than the Sun's rendered photosphere at the failing pose");
        const screenshot = `${dump}/close-size-regression-dpr${dpr}.png`;
        await page.screenshot({ path: screenshot });
        report.screenshots.push(screenshot);
      }
      if (index === 0) {
        assert.equal(visible.length, 13, "all 12 system bodies and focused Mercury are visible at maximum distance");
        for (const marker of visible) assert.ok(Math.abs(marker.width - 1.2) < 0.03,
          `${marker.id} far core ${marker.width}px must match Galaxio's 1.2px floor`);
        // A shown/hidden screenshot difference isolates actual marker paint
        // from the stars, orbit lines and material behind the point.
        const screenshot = `${dump}/full-system-dpr${dpr}.png`;
        await page.screenshot({ path: screenshot });
        report.screenshots.push(screenshot);
        const targets = visible.filter((marker) => ["jupiter", "saturn", "neptune", "pluto"].includes(marker.id));
        for (const target of targets) {
          const footprint = await paintedFootprint(page, target, dpr);
          assert.ok(footprint.count > 0, `${target.id} paints visible pixels at DPR ${dpr}`);
          assert.ok(footprint.widthCss <= 3 && footprint.heightCss <= 3,
            `${target.id} painted footprint ${footprint.widthCss}×${footprint.heightCss}px`);
          report.painted.push({ dpr, id: target.id, ...footprint });
        }
      }
      const sample = { dpr, distanceKilometers, physical, markers: visible.map(({ id, width, height, opacity }) => ({ id, width, height, opacity })) };
      samples.push(sample);
      report.poses.push(sample);
    }
    let nearVisibleCount = 0;
    let nearMajorPlanetCount = 0;
    const nearPitch = await calibratePole(page, 0);
    for (const controlYaw of [0, 90, 180, 270]) {
      await page.evaluate((pose) => window.__mercury.camera.setState(pose), { controlPitch: nearPitch, controlYaw, zoom: 1.1 });
      await nextPaint(page);
      const markers = (await readMarkers(page)).filter(({ id }) => id !== "mercury");
      const physical = await physicalSizeOracle(page);
      for (const marker of markers) {
        assert.equal(marker.visible, physical.visibility[marker.id], `${marker.id}: near-sky visibility matches independent frustum/occlusion oracle`);
        if (marker.visible) {
          nearVisibleCount += 1;
          if (oracle.PLANETS.includes(marker.id)) nearMajorPlanetCount += 1;
          assert.ok(Math.abs(marker.width - Math.max(1.2, physical.diameters[marker.id])) < 0.03, `${marker.id}: true size in near sky`);
        }
      }
      const visibleMajor = markers.find((marker) => marker.visible && oracle.PLANETS.includes(marker.id));
      if (visibleMajor) {
        const footprint = await paintedFootprint(page, visibleMajor, dpr);
        assert.ok(footprint.count > 0, `${visibleMajor.id} paints in the near vault despite zero orbit opacity`);
        assert.ok(footprint.widthCss <= 3 && footprint.heightCss <= 3, "near-vault point remains physically unresolved");
        report.painted.push({ dpr, near: true, id: visibleMajor.id, ...footprint });
      }
      const sky = await page.evaluate(() => window.__mercury.sky.state().planetarySystem);
      assert.equal(sky.opacity, 0, "near sky does not enable orbit lines");
      assert.equal(sky.orbitPieceCount, 0, "near sky skips system ring projection");
      report.poses.push({ dpr, near: true, controlYaw, visible: markers.filter(({ visible }) => visible).map(({ id }) => id), physical });
    }
    assert.ok(nearVisibleCount > 0, "at least one real planet is shown in the near-body celestial vault");
    assert.ok(nearMajorPlanetCount > 0, "near-vault coverage includes a major planet, not only inclined dwarf planets");
    const nearScreenshot = `${dump}/near-vault-dpr${dpr}.png`;
    await page.screenshot({ path: nearScreenshot });
    report.screenshots.push(nearScreenshot);
    assert.deepEqual(await navigationSizes(page), headerBefore, "scene sizing leaves navigation markers unchanged");
    assert.equal(await page.evaluate(() => window.__mercury.assertStableDomIdentity()), true);
    await context.close();
  }
  assert.deepEqual(report.problems, []);
  report.ok = true;
} catch (error) {
  report.ok = false;
  report.error = error.stack;
} finally {
  await browser.close();
}
await writeFile(`${dump}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
process.exitCode = report.ok ? 0 : 1;

async function navigationSizes(page) {
  return page.locator(".planet-navigation-marker > i").evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { className: element.parentElement.className, width: rect.width, height: rect.height };
  }));
}

async function readMarkers(page) {
  return page.locator(".mercury-system-marker, .mercury-body-marker").evaluateAll((elements) => elements.map((element) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const id = element.dataset.body ?? "mercury";
    return { id, x: box.x, y: box.y, width: box.width, height: box.height, opacity: Number(style.opacity),
      visible: style.visibility !== "hidden" && Number(style.opacity) > 0 && box.x >= 0 && box.y >= 0 &&
        box.x + box.width <= innerWidth && box.y + box.height <= innerHeight };
  }));
}

async function physicalSizeOracle(page) {
  const geometry = await page.evaluate(() => {
    const root = document.querySelector(".mercury-camera"), sky = document.querySelector(".mercury-skybox");
    const box = root.getBoundingClientRect(), skyBox = sky.getBoundingClientRect();
    const [originX, originY] = getComputedStyle(sky).perspectiveOrigin.split(" ").map(parseFloat);
    const sun = document.querySelector(".mercury-sun").getBoundingClientRect();
    return { rootCentre: [box.x + box.width / 2, box.y + box.height / 2], principal: [skyBox.x + originX, skyBox.y + originY],
      focal: parseFloat(getComputedStyle(root).perspective), height: box.height,
      transform: document.querySelector(".mercury-scene").style.transform,
      distanceKm: window.__mercury.camera.state().distanceKilometers,
      sunPhotospherePixels: sun.width * window.__mercury.sky.heliocentricView.sun.sprite.opaqueCoreDiameterShare,
      visible: { left: box.left, top: box.top, right: box.right, bottom: box.bottom } };
  });
  const camera = oracle.createCamera({ ...geometry, rotation: parseSceneRotation(geometry.transform) });
  const radiansPerPixel = 2 * Math.atan(geometry.height / (2 * geometry.focal)) / geometry.height;
  const diameters = {};
  const visibility = {};
  for (const [id, body] of Object.entries(system.bodies)) {
    const distanceKm = Math.hypot(...body.position.map((component, index) => component - camera.eyeScene[index]));
    diameters[id] = 2 * Math.asin(oracle.MEAN_RADIUS_KILOMETERS[id] / distanceKm) / radiansPerPixel;
    const pixel = camera.project(body.position);
    const ray = body.position.map((component, index) => component - camera.eyeScene[index]);
    const toFocus = camera.eyeScene.map((component) => -component);
    const a = ray.reduce((sum, component) => sum + component * component, 0);
    const b = ray.reduce((sum, component, index) => sum + component * toFocus[index], 0);
    const c = toFocus.reduce((sum, component) => sum + component * component, 0) - oracle.MEAN_RADIUS_KILOMETERS.mercury ** 2;
    const discriminant = b * b - a * c;
    const intersection = discriminant >= 0 ? (b - Math.sqrt(discriminant)) / a : -1;
    visibility[id] = pixel !== null && pixel[0] >= Math.max(0, geometry.visible.left) && pixel[0] <= Math.min(1440, geometry.visible.right) &&
      pixel[1] >= Math.max(0, geometry.visible.top) && pixel[1] <= Math.min(900, geometry.visible.bottom) && !(intersection > 0 && intersection < 1);
  }
  return { diameters, visibility, sunPhotospherePixels: geometry.sunPhotospherePixels };
}

async function calibratePole(page, scenePitch = 90) {
  const points = [];
  for (const controlPitch of [89, 34]) {
    await page.evaluate((pitch) => window.__mercury.camera.setState({ controlPitch: pitch, controlYaw: 0, zoom: 1.1 }), controlPitch);
    await nextPaint(page);
    const transform = await page.locator(".mercury-scene").evaluate((element) => element.style.transform);
    points.push([controlPitch, scenePitchYawDegrees(parseSceneRotation(transform)).pitchDegrees]);
  }
  return points[0][0] + (scenePitch - points[0][1]) * (points[1][0] - points[0][0]) / (points[1][1] - points[0][1]);
}

async function paintedFootprint(page, target, dpr) {
  const selector = `.mercury-system-marker[data-body="${target.id}"]`;
  // Freeze unrelated compositor transitions before the subtraction.
  await page.waitForTimeout(200);
  const shown = await page.screenshot();
  const visibility = await page.locator(selector).evaluate((element) => {
    const previous = element.style.visibility;
    element.style.visibility = "hidden";
    return previous;
  });
  await nextPaint(page);
  const hidden = await page.screenshot();
  await page.locator(selector).evaluate((element, previous) => { element.style.visibility = previous; }, visibility);
  const [on, off] = await Promise.all([sharp(shown).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(hidden).ensureAlpha().raw().toBuffer({ resolveWithObject: true })]);
  const cx = (target.x + target.width / 2) * dpr, cy = (target.y + target.height / 2) * dpr;
  let count = 0, left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
  for (let y = Math.max(0, Math.floor(cy - 4 * dpr)); y <= Math.min(on.info.height - 1, Math.ceil(cy + 4 * dpr)); y += 1) {
    for (let x = Math.max(0, Math.floor(cx - 4 * dpr)); x <= Math.min(on.info.width - 1, Math.ceil(cx + 4 * dpr)); x += 1) {
      const offset = (y * on.info.width + x) * 4;
      const delta = Math.max(...[0, 1, 2].map((channel) => Math.abs(on.data[offset + channel] - off.data[offset + channel])));
      if (delta < 2) continue;
      count += 1; left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  return { count, widthCss: count ? (right - left + 1) / dpr : 0, heightCss: count ? (bottom - top + 1) / dpr : 0 };
}

async function nextPaint(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
