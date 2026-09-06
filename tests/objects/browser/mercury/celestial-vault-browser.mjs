// Native composition proof: real retained text and planet points must paint
// over the sky, and disappear under the focused body's existing pixels.
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const baseUrl = process.argv.find(argument => /^https?:/u.test(argument)) ?? "http://127.0.0.1:4210";
const output = resolve(process.env.CELESTIAL_VAULT_DUMP ?? ".local/celestial-vault-browser");
await mkdir(output, { recursive: true });
const checks = [], errors = [], samples = [];
const check = (id, ok, detail = {}) => {
  checks.push({ id, ok: Boolean(ok), ...detail });
  if (!ok) console.error(`FAIL ${id}: ${JSON.stringify(detail)}`);
};
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome", timeout: 20000 });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(new URL("/mercury/", baseUrl).href, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForFunction(() => window.__mercury?.ready === true, null, { timeout: 20000 });
  await page.evaluate(() => {
    const motion = document.querySelector('input[name="motion"]');
    if (motion?.checked) motion.click();
    window.__vaultNodes = [...document.querySelector(".planet-stage").querySelectorAll("*")];
  });
  const nearCamera = await page.evaluate(() => window.__mercury.camera.state());
  let chosen = null;
  for (const controlPitch of [nearCamera.controlPitch, 5, 70, -30]) {
    for (const controlYaw of [0, 45, 90, 135, 180, 225, 270, 315]) {
      await page.evaluate(next => window.__mercury.camera.setState(next), { controlPitch, controlYaw });
      await settled(page);
      const sample = await page.evaluate(() => {
        const sky = window.__mercury.sky.state(), camera = window.__mercury.camera.state();
        const markers = [...document.querySelectorAll(".mercury-system-marker")].filter(element => {
          const css = getComputedStyle(element), box = element.getBoundingClientRect();
          return css.visibility !== "hidden" && Number(css.opacity) > 0 && box.x > 440 && box.right < innerWidth &&
            box.y > 100 && box.bottom < innerHeight - 70;
        }).map(element => ({ id: element.dataset.body, alpha: Number(getComputedStyle(element).opacity) }));
        return { camera, orbitOpacity: sky.orbitOpacity, systemOpacity: sky.planetarySystem.opacity,
          systemPieces: sky.planetarySystem.orbitPieceCount,
          candidates: sky.planetarySystem.bodies.length, markers, star: sky.captions.stars };
      });
      samples.push({ pitch: controlPitch, yaw: controlYaw, visible: sample.markers.map(marker => marker.id) });
      if (sample.markers.length && sample.star.accepted) { chosen = sample; break; }
    }
    if (chosen) break;
  }
  check("near-view-exercises-real-planet-points", chosen !== null, { samples });
  if (chosen) {
    check("near-points-do-not-enable-orbit-work", chosen.orbitOpacity === 0 && chosen.systemOpacity === 0 &&
      chosen.systemPieces === 0 && chosen.candidates === 12 &&
      Math.abs(chosen.camera.distanceKilometers - nearCamera.distanceKilometers) < .001,
    { orbitOpacity: chosen.orbitOpacity, systemOpacity: chosen.systemOpacity,
      systemPieces: chosen.systemPieces, candidates: chosen.candidates, distanceKilometers: chosen.camera.distanceKilometers });
    const bodyId = chosen.markers.sort((a, b) => b.alpha - a.alpha)[0].id;
    const markerSelector = `.mercury-system-marker[data-body="${bodyId}"]`;
    const naturalPoint = await changedPixels(page, markerSelector);
    check("near-planet-point-paints-at-its-projected-location", naturalPoint.changed > 0 && naturalPoint.maximumDelta > 5,
      { bodyId, ...naturalPoint });
    const native = await page.evaluate(() => {
      const root = document.querySelector(".mercury-celestial-vault"), camera = document.querySelector(".mercury-camera");
      const parents = [document.querySelector(".mercury-star-caption"), ...document.querySelectorAll(".mercury-system-marker")];
      return { beforeCamera: Boolean(root.compareDocumentPosition(camera) & Node.DOCUMENT_POSITION_FOLLOWING),
        samePlane: getComputedStyle(root).zIndex === getComputedStyle(camera).zIndex,
        containsAll: parents.every(element => root.contains(element)), opacity: Number(getComputedStyle(root).opacity) };
    });
    check("celestial-content-uses-native-background-composition", native.beforeCamera && native.samePlane &&
      native.containsAll && native.opacity === 1, native);

    // Move existing retained nodes within their unchanged production layer.
    // This isolates native occlusion from the astronomical position selector.
    for (const [kind, selector] of [["star-caption", ".mercury-star-caption"], ["planet-point", markerSelector]]) {
      const original = await page.locator(selector).getAttribute("style");
      for (const covered of [true, false]) {
        await page.locator(selector).evaluate((element, { covered, kind }) => {
          const body = document.querySelector(".mercury-material").getBoundingClientRect();
          const offset = covered ? 0 : body.width / 2 + 100;
          if (kind === "star-caption") element.style.transform = `translate(${offset}px, 0px) translate(-50%, -50%)`;
          else {
            const scale = /scale\(([^)]+)\)/u.exec(element.style.transform)?.[1];
            if (!scale) throw new Error("The retained planet point has no projected scale.");
            element.style.transform = `translate(${offset}px, 0px) scale(${scale})`;
          }
        }, { covered, kind });
        const pixels = await changedPixels(page, selector);
        check(`${kind}-${covered ? "occluded-by-focused-body" : "visible-over-sky"}`,
          covered ? pixels.changed === 0 : pixels.changed > (kind === "star-caption" ? 20 : 0), pixels);
        if (covered) {
          // Negative control: putting this same retained layer in front must
          // break the zero-pixel occlusion claim, or the probe is vacuous.
          const root = page.locator(".mercury-celestial-vault");
          await root.evaluate(element => { element.style.zIndex = "4"; });
          let foreground;
          try { foreground = await changedPixels(page, selector); }
          finally { await root.evaluate(element => { element.style.removeProperty("z-index"); }); }
          check(`${kind}-foreground-mutation-breaks-occlusion`, foreground.changed > 0, foreground);
        }
      }
      await page.locator(selector).evaluate((element, style) => element.setAttribute("style", style), original);
    }
    await page.evaluate(() => window.__mercury.starExposure({ exposureScale: .000001 }));
    await settled(page);
    const bodyFade = await page.evaluate(async () => {
      const read = () => window.__mercury.sky.state().captions.slots.map(slot => ({ ...slot }));
      const before = read();
      window.__mercury.camera.setState({ controlYaw: 0 });
      const samples = [read()];
      const publications = window.__mercury.camera.stats().publications;
      for (let frame = 0; frame < 20; frame++) {
        await new Promise(requestAnimationFrame);
        samples.push(read());
      }
      return { before, samples, publications, afterPublications: window.__mercury.camera.stats().publications,
        star: window.__mercury.sky.state().captions.stars.slots[0] };
    });
    const retiring = bodyFade.samples[0].filter(slot => slot.occupant?.startsWith("2:") && slot.alpha > slot.target);
    const maxStep = Math.max(...bodyFade.samples.slice(1).flatMap((slots, frame) =>
      slots.map((slot, index) => Math.abs(slot.alpha - bodyFade.samples[frame][index].alpha))));
    check("body-caption-fade-finishes-at-rest-with-no-star-work", retiring.length > 0 &&
      bodyFade.before.some(slot => slot.occupant?.startsWith("2:") && slot.alpha === .72) &&
      bodyFade.samples.at(-1).every(slot => slot.alpha === slot.target && slot.occupant === null) &&
      bodyFade.star.alpha === 0 && bodyFade.star.target === 0 && maxStep <= .1 + 1e-9 &&
      bodyFade.publications === bodyFade.afterPublications,
    { retiring: retiring.length, maxStep, initial: bodyFade.samples[0].map(slot => slot.alpha),
      final: bodyFade.samples.at(-1).map(slot => slot.alpha), publications: bodyFade.publications,
      afterPublications: bodyFade.afterPublications });
    await page.evaluate(() => window.__mercury.starExposure(null));
    await settled(page);
  }
  const retained = await page.evaluate(() => {
    const current = [...document.querySelector(".planet-stage").querySelectorAll("*")];
    return current.length === window.__vaultNodes.length && current.every((element, index) => element === window.__vaultNodes[index]);
  });
  check("orientation-and-composition-retain-one-scene", retained);
  check("no-browser-errors", errors.length === 0, { errors });
} finally { await browser.close(); }
const failed = checks.filter(check => !check.ok).map(check => check.id);
const report = { suite: "mercury-celestial-vault", ok: failed.length === 0, failed, checks };
await writeFile(resolve(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
process.exitCode = failed.length ? 1 : 0;

async function settled(page) {
  await page.waitForFunction(() => {
    const slot = window.__mercury.sky.state().captions.stars.slots[0];
    return slot.alpha === slot.target;
  }, null, { timeout: 3000 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function changedPixels(page, selector) {
  const element = page.locator(selector), box = await element.boundingBox(), viewport = page.viewportSize();
  if (!box) return { changed: 0, maximumDelta: 0, missing: true };
  const x = Math.max(0, Math.floor(box.x - 4)), y = Math.max(0, Math.floor(box.y - 4));
  const clip = { x, y, width: Math.min(viewport.width, Math.ceil(box.x + box.width + 4)) - x,
    height: Math.min(viewport.height, Math.ceil(box.y + box.height + 4)) - y };
  const shown = await page.screenshot({ clip });
  const previous = await element.evaluate(element => { const previous = element.style.visibility; element.style.visibility = "hidden"; return previous; });
  let hidden;
  try { hidden = await page.screenshot({ clip }); }
  finally { await element.evaluate((element, previous) => { element.style.visibility = previous; }, previous); }
  const a = await sharp(shown).ensureAlpha().raw().toBuffer(), b = await sharp(hidden).ensureAlpha().raw().toBuffer();
  let changed = 0, maximumDelta = 0;
  for (let pixel = 0; pixel < a.length; pixel += 4) {
    const delta = Math.max(...[0, 1, 2].map(channel => Math.abs(a[pixel + channel] - b[pixel + channel])));
    maximumDelta = Math.max(maximumDelta, delta);
    if (delta > 3) changed++;
  }
  return { changed, maximumDelta, clip };
}
