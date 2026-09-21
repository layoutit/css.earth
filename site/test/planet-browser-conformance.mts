import { required } from '../../tools/test-values.mts';
import { parsePreparedObjectRuntime } from '../../src/renderers/css/dist/index.js';
import { shape, array, text, number, optional } from '../../tools/objects/terrestrial-layers/source-records.mts';
import type { PreparedSurfaceHit } from '../../src/renderers/css/navigation/prepared-surface-hit.js';
type SceneState = Awaited<ReturnType<typeof sceneState>>;
type LensRace = NonNullable<BrowserProfileAudit['lensRace']>;
interface DecodeGate {pathname:string;holding:boolean;started:boolean;pending:(()=>void)[];}
interface RetainedProbe {
 stage:Element;initialNodes:Element[];initialParents:(ParentNode|null)[];shellTextNodes:ChildNode[];
 shellTextParents:(ParentNode|null)[];addedRoots:Element[];removedRoots:Element[];observer:MutationObserver;maximumNodeCount():number;
}
interface ZoomProbe {observer:MutationObserver;consume(records:MutationRecord[]):void;counts:Record<string,number>;}
declare global {
 interface Window {
  __datasetGeometryProbe:Element[];
  __preparedImageDecodes:Record<string,number>;
  __preparedDecodeGate:DecodeGate;
  __conformanceDeselects:number;
  __conformanceDeselectProbe:EventListener;
  __retainedConformance?:RetainedProbe;
  __zoomPublicationProbe?:ZoomProbe;
 }
 interface HTMLElement {__testPointerId?:number;}
}
import { createTestPage } from './browser-observations.mts';
import type { Page, Browser, Response } from 'playwright';
import type { ObjectBrowserProfile, CameraBounds, BrowserProfileAudit } from './browser-profile-types.mts';
import type { ObjectEntry } from '../object-schema.mts';
import assert from "node:assert/strict";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { stripTypeScriptTypes } from "node:module";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import sharp from "sharp";
import { conformanceBrowserLaunch } from "./conformance-browser-launch.mts";

import { SCENE_OBJECTS } from "../objects.mts";
import { MOBILE_TOUCH_ACTION, WHEEL_ZOOM_SPEED_MULTIPLIER, WHEEL_ZOOM_DISCRETE_SPEED_MULTIPLIER,
  WHEEL_ZOOM_USE_SCROLL_DISTANCE } from "../runtime-policy.mts";
import { loadPlanetBrowserProfile, assertRenderedObjectControls } from "./load-browser-profile.mts";
import { proveSkyboxPointerBoundary } from "./skybox-pointer-boundary.mts";
import { proveWheelZoomDistance, wheelWithReceipt } from "./wheel-zoom-distance.mts";
import { SURFACE_FLY_TO } from
  "../../src/platform/surface-fly-to.mts";
import { TRACKBALL_DRAG_INERTIA } from
  "../../src/platform/trackball-drag-inertia.mts";
import { PREPARED_WHEEL_ZOOM } from "../../src/renderers/css/dist/platform/prepared-wheel-zoom.js";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const requestedId = process.argv[3] ?? null;
const densityOnly = process.env.CSSEARTH_DENSITY_ONLY === "1";
const requestedCases = new Set((process.env.CSSEARTH_CONFORMANCE_CASES ?? "").split(",").filter(Boolean));
// The coordinate oracle is the current source picker, also when the tested
// server is an immutable production build without Vite's /src module routes.
const surfaceHitModuleUrl = `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(
  await readFile(resolve('src/renderers/css/navigation/prepared-surface-hit.ts'), 'utf8'),
)).toString('base64')}`;
const CASE_TIMEOUT_MS = 120_000;
const REQUEST_START_TIMEOUT_MS = 30_000;
const evidenceDirectory = process.env.CSSEARTH_CONFORMANCE_OUTPUT
  ? resolve(process.env.CSSEARTH_CONFORMANCE_OUTPUT)
  : null;
if (evidenceDirectory) {
  assert.ok(evidenceDirectory.startsWith(resolve("output/playwright") + "/"),
    "Browser evidence must stay under output/playwright.");
  await mkdir(evidenceDirectory, { recursive: true });
}
const implemented = SCENE_OBJECTS;
const selected = requestedId
  ? implemented.filter(({ id }) => id === requestedId)
  : implemented;
assert.ok(selected.length > 0, `No implemented planet selected: ${requestedId}.`);

const channel = process.env.PLAYWRIGHT_CHANNEL ?? "chrome";
assert.ok(channel === "chrome" || channel === "chromium" || channel === "msedge", "Unsupported browser channel");
const browserLaunch = await conformanceBrowserLaunch({
  channel,
  evidenceDirectory: evidenceDirectory ?? undefined,
});
const browser = await chromium.launch(browserLaunch.options);
const reports = [];
const surfaceHitPlans = new Map<string, PreparedSurfaceHit | null>();
try {
  for (const planet of selected) {
    const profile = await loadPlanetBrowserProfile(planet);
    if (densityOnly) {
      reports.push(await runCase(planet, "dpr-1", () => provePreparedDensity(browser, planet, profile, 1)));
      reports.push(await runCase(planet, "dpr-2", () => provePreparedDensity(browser, planet, profile, 2)));
      continue;
    }
    reports.push(await runCase(planet, "initial-shell", () => proveInitialShell(browser, planet, profile)));
    reports.push(await runCase(planet, "desktop", () => proveDesktop(browser, planet, profile)));
    reports.push(await runCase(planet, "mobile", () => proveMobile(browser, planet, profile)));
    reports.push(await runCase(planet, "dataset-interactions", () => proveDatasetInteractions(browser, planet, profile)));
    reports.push(await runCase(planet, "dataset-interactions-dpr-2", () => proveDatasetInteractions(browser, planet, profile, 2)));
    for (const motionRequested of [false, true]) {
      for (const hidden of [true, false]) {
        reports.push(await runCase(planet, `pre-ready-${hidden ? "hidden" : "visible"}-motion-${motionRequested ? "on" : "off"}`,
          () => provePreReadyTarget(browser, planet, profile, hidden, motionRequested)));
      }
    }
    reports.push(await runCase(planet, "dpr-1", () => provePreparedDensity(browser, planet, profile, 1)));
    reports.push(await runCase(planet, "dpr-2", () => provePreparedDensity(browser, planet, profile, 2)));
    reports.push(await runCase(planet, "surface-features", () => proveSurfaceFeatures(browser, planet, profile)));
    if ((profile.objectControls.lenses?.controls.length ?? 0) > 1) {
      reports.push(await runCase(planet, "lens-race", () => proveLensRace(browser, planet, profile)));
      reports.push(await runCase(planet, "lens-reacquire", () => proveLensReacquire(browser, planet, profile)));
      reports.push(await runCase(planet, "lens-rejection", () => proveLensRejection(browser, planet, profile)));
      reports.push(await runCase(planet, "lens-destroy", () => proveLensDestroy(browser, planet, profile)));
    }
  }
} finally {
  await browser.close();
}

async function runCase<T>(planet: ObjectEntry, name: string, prove: ()=>Promise<T>) {
  if (requestedCases.size && !requestedCases.has(name)) return { id: planet.id, case: name, skipped: true };
  const label = `${planet.id}/${name}`;
  const startedAt = performance.now();
  console.error(`[conformance] START ${label}`);
  try {
    const report = await within(prove(), CASE_TIMEOUT_MS, `${label}: case exceeded ${CASE_TIMEOUT_MS}ms`);
    console.error(`[conformance] PASS ${label} (${Math.round(performance.now() - startedAt)}ms)`);
    return report;
  } catch (error) {
    console.error(`[conformance] FAIL ${label}: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function within<T>(promise:Promise<T>, milliseconds:number, message:string):Promise<T> {
  let timer:ReturnType<typeof setTimeout>|undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

function observed<T>(promise:Promise<T>) {
  // A parallel gated selection can reject before its eventual joined await,
  // especially when a timeout closes the page. Keep that outcome observed.
  promise.catch(() => {});
  return promise;
}

async function proveInitialShell(browser: Browser, planet: ObjectEntry, profile: ObjectBrowserProfile) {
  // With scripting disabled, no object binder can mask an enabled SSR control.
  const page = await createTestPage(browser, { javaScriptEnabled: false });
  try {
    const response = await page.goto(new URL(planet.route, baseUrl).href, {
      waitUntil: "domcontentloaded",
    });
    assert.ok(response?.ok(), `${planet.id}: initial shell must load successfully`);
    const speed = page.locator('input[name="speed"][type="range"]');
    const supportsSpeed = profile.objectControls.settings?.controls.some(
      ({ name }) => name === "speed",
    ) ?? false;
    assert.equal(await speed.count(), Number(supportsSpeed),
      `${planet.id}: initial shell must render only supported speed controls`);
    if (supportsSpeed) {
      assert.equal(await speed.isDisabled(), true,
        `${planet.id}: initial HTML must disable speed before object binding`);
    }
    return { id: planet.id, viewport: "initial-shell", speedDisabled: supportsSpeed };
  } finally { await page.close(); }
}

async function proveDatasetInteractions(browser: Browser, planet: ObjectEntry, profile: ObjectBrowserProfile, deviceScaleFactor = 1) {
  const page = await createTestPage(browser, { viewport: { width: 1440, height: 1000 }, deviceScaleFactor });
  const evidence = observePage(page, baseUrl), datasets = [];
  try {
    await loadPlanet(page, planet, profile);
    await profile.pause(page);
    const baseline = await sceneState(page, profile);
    const geometry = ({id,interior}:{id:string;interior:boolean}) => {
      const root=window.__cssearthTest.element(interior?`.${id}-cutaway`:'.planet-stage .polycss-camera');
      const nodes=[...root.querySelectorAll('s,u')].filter(node=>getComputedStyle(node).visibility==='visible'&&node.getBoundingClientRect().width>0);
      window.__datasetGeometryProbe=nodes;
      return nodes.map(node=>{const r=node.getBoundingClientRect();return [r.x,r.y,r.width,r.height];});
    };
    for (const lens of profile.objectControls.lenses?.controls ?? []) {
      await page.locator(`button[name="dataset"][value="${lens.id}"]`).click();
      await page.waitForFunction(({id,lens}) => window.__cssearthTest.required(window.__cssearthTest.required(window.__cssearthTest.object(id).runtime.selection(),'object selection').committed,'committed selection').lensId === lens,
        {id:planet.id,lens:lens.id});
      // Let the authored entry flight finish before measuring a user's drag.
      await page.waitForTimeout(750);
      await assertLensConsistency(page, planet, profile, lens.id);
      const isInterior = await page.locator('.planet-stage').getAttribute('data-view') === 'interior';
      const captureName = `${planet.id}-${lens.id}-dpr-${deviceScaleFactor}`;
      if (evidenceDirectory) await page.screenshot({path:resolve(evidenceDirectory, `${captureName}.png`)});
      const before = await page.evaluate(geometry,{id:planet.id,interior:isInterior});
      assert.ok(before.length,`${planet.id}/${lens.id}: rendered geometry must exist`);
      await page.mouse.move(770,500); await page.mouse.down();
      await page.mouse.move(880,540,{steps:20}); await page.mouse.up();
      await page.waitForTimeout(300);
      assert.equal(await page.evaluate(() => window.__datasetGeometryProbe.every(node => node.isConnected)), true,
        `${planet.id}/${lens.id}: dragging retains the original geometry nodes`);
      const after = await page.evaluate(()=>window.__datasetGeometryProbe.map(node=>{const r=node.getBoundingClientRect();return [r.x,r.y,r.width,r.height];}));
      assert.equal(after.length,before.length,`${planet.id}/${lens.id}: dragging preserves the rendered geometry`);
      const displacement = Math.max(...after.map((r,i)=>Math.hypot(r[0]-before[i][0],r[1]-before[i][1])));
      assert.ok(displacement>1,`${planet.id}/${lens.id}: rendered geometry must follow camera input`);
      let shadowPixels = null;
      if (isInterior) {
        const images=[];
        for (const shadows of [false,true]) {
          await page.evaluate(value=>{const input=window.__cssearthTest.input('input[name="shadows"]');if(input.checked!==value)window.__cssearthTest.htmlElement(input).click();},shadows);
          await page.waitForFunction(({id,value})=>window.__cssearthTest.required(window.__cssearthTest.required(window.__cssearthTest.object(id).runtime.selection(),'object selection').committed,'committed selection').shadows===value,{id:planet.id,value:shadows});
          await page.waitForTimeout(250);
          const bytes=await page.screenshot({clip:{x:470,y:250,width:500,height:500}});
          images.push(await sharp(bytes).ensureAlpha().raw().toBuffer());
          if(evidenceDirectory) await page.screenshot({path:resolve(evidenceDirectory,`${captureName}-shadows-${shadows}.png`)});
        }
        shadowPixels=0;
        for(let i=0;i<images[0].length;i+=4) if(images[0][i]!==images[1][i]||images[0][i+1]!==images[1][i+1]||images[0][i+2]!==images[1][i+2])shadowPixels++;
        assert.ok(shadowPixels>200,`${planet.id}/${lens.id}: Shadows must change the rendered cutaway`);
      }
      const state=await sceneState(page,profile);assertSceneStructure(state,planet.id);
      assert.equal(state.stageElements,baseline.stageElements,`${planet.id}/${lens.id}: lens and lighting preserve DOM`);
      datasets.push({id:lens.id,interior:isInterior,geometryDisplacement:displacement,shadowPixels});
    }
    assertEvidence(evidence,planet.id);
    return {id:planet.id,case:'dataset-interactions',deviceScaleFactor,datasets};
  } finally {await page.close();}
}

async function provePreReadyTarget(browser: Browser, planet: ObjectEntry, profile: ObjectBrowserProfile, finalHidden:boolean, motionRequested:boolean) {
  const page = await createTestPage(browser, { viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });
  const evidence = observePage(page, baseUrl);
  let releaseAssets:()=>void=()=>{throw new Error("Gate is uninitialized");};
  let markStarted:()=>void=()=>{throw new Error("Start gate is uninitialized");};
  const gate=new Promise<void>(resolve=>{releaseAssets=resolve;});
  const started=new Promise<void>(resolve=>{markStarted=resolve;});
  let intercepted = false;
  await page.route(new RegExp(`/scenes/${planet.id}/`), async (route) => {
    if (!intercepted) {
      intercepted = true;
      markStarted();
    }
    await gate;
    await route.continue();
  });
  try {
    await page.goto(new URL(planet.route, baseUrl).href, {
      waitUntil: "domcontentloaded",
    });
    await within(started, REQUEST_START_TIMEOUT_MS,
      `${planet.id}: no startup request reached /scenes/${planet.id}/`);
    await assertRenderedObjectControls(page, profile);
    assert.equal(await page.evaluate(() => window.__cssEarth?.lifecycle), "loading",
      `${planet.id}: gated preparation must remain loading`);
    if (profile.objectControls.lenses?.controls.length) {
      assert.equal(await page.locator('button[name="dataset"]').evaluateAll(buttons => buttons.every(button =>
        button instanceof HTMLButtonElement && !button.disabled && button.type === 'submit' && button.form?.method === 'get')), true,
      `${planet.id}: native dataset selection must remain usable before runtime readiness`);
    }
    if (profile.objectControls.settings?.controls.some(({ name }) => name === "speed")) {
      assert.equal(await page.locator('input[name="speed"][type="range"]').isDisabled(), true,
        `${planet.id}: speed must be disabled until runtime binding`);
    }
    await page.locator('input[name="motion"]').evaluate((input, requested) => {
      if (!(input instanceof HTMLInputElement)) throw new Error("Expected motion input");
      if (input.checked !== requested) input.click();
    }, motionRequested);
    await setDocumentVisibility(page, true);
    if (!finalHidden) await setDocumentVisibility(page, false);
    assert.notEqual(await page.evaluate(() =>
      document.documentElement.dataset.playing), "true",
    `${planet.id}: pre-ready resume must not publish mounted playback state`);
    releaseAssets();
    await page.waitForFunction(() => window.__cssEarth?.ready === true);
    await profile.waitForRuntime(page);
    const expectedPlaying = motionRequested && !finalHidden;
    const lifecycle = await page.evaluate(() => window.__cssearthTest.scene().lifecycle);
    assert.equal(lifecycle, expectedPlaying ? "mounted" : "paused",
      `${planet.id}: readiness must apply the latest shared Motion and visibility`);
    assert.equal(await page.locator('input[name="motion"]').isChecked(), motionRequested,
      `${planet.id}: visibility changes must preserve Motion intent`);
    // Motion permission owns the prepared object; context hover/fade transitions
    // can run independently and are not planetary playback.
    const animationStates = await page.locator(".planet-stage").evaluate((stage) =>
      stage.getAnimations({ subtree: true }).filter(({ effect }) => effect instanceof KeyframeEffect && effect.target instanceof Element && effect.target.closest(".planet-render-root")).map(({ playState }) => playState));
    assert.ok(expectedPlaying
      ? animationStates.length === 0 || animationStates.includes("running")
      : animationStates.every((state) => state === "paused"),
    `${planet.id}: actual animations must obey the latest ready playback permission`);
    assert.equal(await profile.stable(page), true,
      `${planet.id}: pre-ready lifecycle must preserve retained identity`);
    assertEvidence(evidence, planet.id);
    return {
      id: planet.id,
      viewport: `pre-ready-${finalHidden ? "hidden" : "visible"}-motion-${motionRequested ? "on" : "off"}`,
      animationCount: animationStates.length,
    };
  } finally {
    releaseAssets?.();
    await page.close();
  }
}

async function installDecodeGate(page: Page, assetPath:string) {
  await page.addInitScript((pathname) => {
    const decode = Image.prototype.decode;
    window.__preparedImageDecodes = Object.create(null);
    const probe:DecodeGate = window.__preparedDecodeGate = {
      pathname, holding: true, started: false, pending: [],
    };
    Image.prototype.decode = function preparedDecode(this:HTMLImageElement, ...arguments_:Parameters<HTMLImageElement["decode"]>) {
      const path = new URL(this.currentSrc || this.src, location.href).pathname;
      window.__preparedImageDecodes[path] =
        (window.__preparedImageDecodes[path] ?? 0) + 1;
      // Decode the actual prepared bytes first. Holding HTTP itself while an
      // owner clears src can leave Chrome's canceled decode unsettled forever.
      // This gate controls completion and can always release retired work.
      return decode.apply(this, arguments_).then((value:void) => {
        if (path !== probe.pathname || !probe.holding) return value;
        probe.started = true;
        return new Promise<void>((resolve) => probe.pending.push(() => resolve(value)));
      });
    };
  }, new URL(assetPath, baseUrl).pathname);
}

async function waitForDecodeGate(page: Page, planet: ObjectEntry, race:LensRace) {
  try {
    await page.waitForFunction(() => window.__preparedDecodeGate?.started,
      undefined, { timeout: REQUEST_START_TIMEOUT_MS });
  } catch (cause) {
    throw new Error(`${planet.id}: ${race.slowId} did not reach prepared decode gate ${race.slowAsset}`, { cause });
  }
}

async function releaseDecodeGate(page: Page) {
  if (page.isClosed()) return;
  await page.evaluate(() => {
    const probe = window.__preparedDecodeGate;
    if (!probe) return;
    probe.holding = false;
    for (const release of probe.pending.splice(0)) release();
  });
}

async function proveLensRace(browser: Browser, planet: ObjectEntry, profile: ObjectBrowserProfile) {
  const page = await createTestPage(browser, { viewport: { width: 1200, height: 800 } });
  const evidence = observePage(page, baseUrl);
  const race = required(profile.audit?.lensRace, `${planet.id}: lens race profile must exist`);
  await installDecodeGate(page, race.slowAsset);
  try {
    await loadPlanet(page, planet, profile);
    const slowSelection = observed(profile.selectLens(page, race.slowId));
    await waitForDecodeGate(page, planet, race);
    const repeatedSlowSelection = observed(profile.selectLens(page, race.slowId));
    // Both A requests overlap the same live entry. A later committed winner
    // may retire it; coalescing does not imply reusing a retired decode.
    await within(profile.selectLens(page, race.winnerId), REQUEST_START_TIMEOUT_MS,
      `${planet.id}: winning lens ${race.winnerId} did not settle while ${race.slowId} was gated`);
    await releaseDecodeGate(page);
    await within(Promise.all([slowSelection, repeatedSlowSelection]), REQUEST_START_TIMEOUT_MS,
      `${planet.id}: retired ${race.slowId} selections did not settle after releasing ${race.slowAsset}`);
    await assertLensConsistency(page, planet, profile, race.winnerId);
    const slowPath = new URL(race.slowAsset, baseUrl).pathname;
    const slowDecodeCount = await page.evaluate((pathname) =>
      window.__preparedImageDecodes[pathname] ?? 0, slowPath);
    assert.equal(slowDecodeCount, 1,
      `${planet.id}: repeated pending selection must share one image decode`);
    assert.equal(await profile.stable(page), true,
      `${planet.id}: a lens race must preserve retained nodes`);
    assertEvidence(evidence, planet.id);
    return {
      id: planet.id,
      viewport: "lens-race",
      lens: race.winnerId,
      slowDecodeCount,
    };
  } finally {
    await releaseDecodeGate(page);
    await page.close();
  }
}

async function proveLensReacquire(browser: Browser, planet: ObjectEntry, profile: ObjectBrowserProfile) {
  const page = await createTestPage(browser, { viewport: { width: 1200, height: 800 } });
  const evidence = observePage(page, baseUrl);
  const race = required(profile.audit?.lensRace, `${planet.id}: lens race profile must exist`);
  await installDecodeGate(page, race.slowAsset);
  try {
    await loadPlanet(page, planet, profile);
    const first = observed(profile.selectLens(page, race.slowId));
    await waitForDecodeGate(page, planet, race);
    await profile.selectLens(page, race.winnerId);
    await assertLensConsistency(page, planet, profile, race.winnerId);
    const reacquired = observed(profile.selectLens(page, race.slowId));
    await page.waitForFunction(id => {
      const root = document.getElementById(`${id}-lenses`);
      return root?.getAttribute("aria-busy") === "true" || root?.classList.contains("is-loading");
    }, planet.id);
    await releaseDecodeGate(page);
    await Promise.all([first, reacquired]);
    await assertLensConsistency(page, planet, profile, race.slowId);
    assert.equal(await profile.stable(page), true,
      `${planet.id}: A/B/A reacquisition must preserve retained nodes`);
    assertEvidence(evidence, planet.id);
    return { id: planet.id, viewport: "lens-reacquire", lens: race.slowId };
  } finally { await releaseDecodeGate(page); await page.close(); }
}

async function proveLensRejection(browser: Browser, planet: ObjectEntry, profile: ObjectBrowserProfile) {
  const page = await createTestPage(browser, { viewport: { width: 1200, height: 800 } });
  const evidence = observePage(page, baseUrl);
  const race = required(profile.audit?.lensRace, `${planet.id}: lens race profile must exist`);
  await page.route(`**${race.slowAsset}`, (route) => route.fulfill({
    status: 200,
    contentType: "image/webp",
    headers: { "cache-control": "no-store" },
    body: "invalid prepared image",
  }));
  try {
    await loadPlanet(page, planet, profile);
    await assert.rejects(profile.selectLens(page, race.slowId));
    await assertLensConsistency(page, planet, profile, race.defaultId);
    await page.unroute(`**${race.slowAsset}`);
    await profile.selectLens(page, race.slowId);
    await assertLensConsistency(page, planet, profile, race.slowId);
    assert.equal(await profile.stable(page), true,
      `${planet.id}: rejection and same-URL retry must preserve retained nodes`);
    assertEvidence(evidence, planet.id);
    return { id: planet.id, viewport: "lens-rejection-retry", lens: race.slowId };
  } finally {
    await page.close();
  }
}

async function proveLensDestroy(browser: Browser, planet: ObjectEntry, profile: ObjectBrowserProfile) {
  const page = await createTestPage(browser, { viewport: { width: 1200, height: 800 } });
  const evidence = observePage(page, baseUrl);
  const race = required(profile.audit?.lensRace, `${planet.id}: lens race profile must exist`);
  await installDecodeGate(page, race.slowAsset);
  try {
    await loadPlanet(page, planet, profile);
    const selection = observed(profile.selectLens(page, race.slowId));
    await waitForDecodeGate(page, planet, race);
    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    await releaseDecodeGate(page);
    await selection;
    await waitFrames(page);
    assert.equal(await page.locator(".planet-stage").evaluate((stage) =>
      stage.childElementCount), 0,
    `${planet.id}: destroy during lens preparation must empty the stage`);
    assert.equal(await profile.runtimePresent(page), false,
      `${planet.id}: destroy during lens preparation must remove diagnostics`);
    assert.equal(await page.locator(".planet-stage").evaluate((stage) =>
      stage.hasAttribute("data-lens") || stage.hasAttribute("data-view")), false,
    `${planet.id}: destroyed lens work must not publish presentation state`);
    assert.equal(await page.locator(`#${planet.id}-lenses`).evaluate((root) =>
      root.classList.contains("is-loading")), false,
    `${planet.id}: destroy must clear lens loading state`);
    assert.equal(await page.locator('button[name="dataset"]').evaluateAll((buttons) =>
      buttons.every((button) => {if(!(button instanceof HTMLButtonElement))throw new Error("Expected button");return !button.disabled && button.type === 'submit';})), true,
    `${planet.id}: destroy must retain native dataset submits`);
    assert.equal(await page.locator(".planet-stage").evaluate((stage) =>
      stage.style.length), 0,
    `${planet.id}: destroy must clear object-owned inline stage presentation`);
    assert.equal(await page.evaluate(() =>
      document.documentElement.hasAttribute("data-playing")), false,
    `${planet.id}: destroy must clear playback publication`);
    assertEvidence(evidence, planet.id);
    return { id: planet.id, viewport: "lens-destroy" };
  } finally {
    await releaseDecodeGate(page);
    await page.close();
  }
}

async function assertLensConsistency(page: Page, planet: ObjectEntry, profile: ObjectBrowserProfile, expectedId:string) {
  const state = await profile.lens(page);
  assert.equal(state.id, expectedId,
    `${planet.id}: runtime lens state must match the winning request`);
  assert.equal(state.ready, true,
    `${planet.id}: winning lens state must be ready`);
  assert.equal(await profile.visibleLens(page), expectedId,
    `${planet.id}: visible material must match runtime lens state`);
  assert.equal(await profile.pressedLens(page), expectedId,
    `${planet.id}: selected control must match the visible material`);
}
console.log(JSON.stringify({ ok: true, reports }, null, 2));
if (evidenceDirectory) {
  await writeFile(resolve(evidenceDirectory, "report.json"), JSON.stringify({
    ok: true, browser: browser.version(), baseUrl,
    ...(browserLaunch.diagnostics ? { browserLaunch: browserLaunch.diagnostics } : {}),
    capturedAt: new Date().toISOString(),
    qualification: "Natural-clock browser interaction checks; no native parity claim.",
    reports,
  }, null, 2));
}

async function proveDesktop(browser: Browser, planet: ObjectEntry, profile: ObjectBrowserProfile) {
  const page = await createTestPage(browser, { viewport: { width: 1440, height: 900 } });
  const evidence = observePage(page, baseUrl);
  try {
    await loadPlanet(page, planet, profile);
    const motionActivation = await enableMotion(page, planet.id);
    const projectiveTextureReport = await page.locator(".planet-stage")
      .evaluate((stage) => {
        // All detail leaves belong to the one object camera. Prepared paint
        // groups need not descend from its reference transform node.
        const leaves = [...stage.querySelectorAll(":scope > .polycss-camera :is(s,u)")]
          .filter(leaf => getComputedStyle(leaf).backgroundImage !== "none");
        return {
          texturedLeafCount: leaves.length,
          nestedProjectiveTextureCount: stage.querySelectorAll(".polycss-projective-texture").length,
          finiteTextureBounds: leaves.every(leaf => {
            const bounds = leaf.getBoundingClientRect();
            return [bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite);
          }),
        };
      });
    assert.ok(projectiveTextureReport.texturedLeafCount > 0,
      `${planet.id}: actual prepared surface pixels must be mounted`);
    assert.equal(projectiveTextureReport.nestedProjectiveTextureCount, 0,
      `${planet.id}: surface pixels must use a single prepared projection plane`);
    assert.equal(projectiveTextureReport.finiteTextureBounds, true,
      `${planet.id}: prepared texture bounds must remain finite`);
    const baseline = await sceneState(page, profile);
    assertSceneStructure(baseline, planet.id);
    const retainedReport = await profile.retainedReport(page);
    assert.equal(retainedReport.initialNodeCount, baseline.stageElements,
      `${planet.id}: object package must report every initially mounted scene node`);
    assert.equal(retainedReport.stableNodeCount, baseline.stageElements,
      `${planet.id}: object stability set must contain every initial node`);
    await beginRetainedProbe(page);
    const bounds = await profile.bounds(page);
    await profile.setCamera(page, {
      pitch: bounds.defaultPitch,
      zoom: bounds.defaultZoom,
    });

    await drag(page, profile.inputSelector, 0, 150);
    const downward = await profile.camera(page);
    assert.ok(downward.pitch > bounds.defaultPitch,
      `${planet.id}: dragging down must move toward top-down`);
    await waitFrames(page);
    const downwardThrow = await profile.camera(page);
    assert.ok(downwardThrow.pitch > downward.pitch,
      `${planet.id}: a fast release must continue with Google Earth drag inertia`);

    await profile.setCamera(page, {
      pitch: bounds.defaultPitch,
      zoom: bounds.defaultZoom,
    });
    await drag(page, profile.inputSelector, 0, -150);
    const upward = await profile.camera(page);
    assert.ok(upward.pitch < bounds.defaultPitch,
      `${planet.id}: dragging up must move toward the lower view`);

    await profile.setCamera(page, {
      pitch: bounds.defaultPitch,
      zoom: bounds.defaultZoom,
    });
    await drag(page, profile.inputSelector, 180, 0);
    const horizontal = await profile.camera(page);
    assert.ok(Math.abs(horizontal.pitch - bounds.defaultPitch) < 0.001,
      `${planet.id}: horizontal drag must not change vertical orbit`);

    await profile.setCamera(page, {
      pitch: bounds.defaultPitch,
      zoom: bounds.defaultZoom,
    });
    const dolly = await wheelDolly(page, planet.id);
    // Exclude the preceding camera reset's queued publication from the wheel probe.
    await waitFrames(page);
    await beginZoomPublicationProbe(page);
    await wheel(page, profile.inputSelector, -240);
    const zoomPublication = await finishZoomPublicationProbe(page);
    const zoomed = await profile.camera(page);
    assert.ok(zoomed.zoom > bounds.defaultZoom,
      `${planet.id}: wheel toward the user must zoom in`);
    if (dolly) {
      assert.ok(["skyCube", "skyOrientation"].every((key) =>
        (zoomPublication[key] ?? 0) === 0),
      `${planet.id}: a wheel dolly must not turn the sky at infinity`);
    } else {
      assert.ok(Object.values(zoomPublication).every((count) => count > 0),
        `${planet.id}: off-centre wheel zoom must preserve its surface anchor`);
    }

    await profile.setCamera(page, {
      pitch: bounds.defaultPitch,
      zoom: bounds.defaultZoom,
    });
    const flyCoordinates = await surfaceFlyCoordinates(page);
    const beforeFlyTo = await profile.camera(page);
    await page.mouse.move(flyCoordinates.surface.x, flyCoordinates.surface.y);
    await page.mouse.down({ clickCount:1 });
    await page.mouse.up({ clickCount:1 });
    await page.mouse.down({ clickCount:2 });
    const secondPressFlight = await interactionStats(page, planet.id);
    assert.equal(secondPressFlight.surfaceFlyTo.active, true,
      `${planet.id}: the second press must launch flight before mouse-up`);
    await page.mouse.up({ clickCount:2 });
    assert.equal((await interactionStats(page, planet.id)).surfaceFlyTo.starts,
      secondPressFlight.surfaceFlyTo.starts, `${planet.id}: double-click release must not restart flight`);
    await page.waitForTimeout(
      SURFACE_FLY_TO.durationMilliseconds + 100,
    );
    const afterFlyTo = await profile.camera(page);
    assert.ok(Math.abs(afterFlyTo.pitch - beforeFlyTo.pitch) > 0.01,
      `${planet.id}: off-centre surface double click must recenter the camera`);
    assert.ok(afterFlyTo.zoom > beforeFlyTo.zoom,
      `${planet.id}: surface double click must fly toward the body`);

    await profile.setCamera(page, {
      pitch: bounds.defaultPitch,
      zoom: bounds.defaultZoom,
    });
    // Empty sky leaves the current selection and camera unchanged.
    await page.evaluate(() => {
      window.__conformanceDeselects = 0;
      window.__conformanceDeselectProbe = event => { window.__conformanceDeselects++; event.preventDefault(); };
      window.addEventListener('objectdeselect', window.__conformanceDeselectProbe, { capture: true });
    });
    const beforeEmptyDoubleClick = await profile.camera(page);
    await page.mouse.dblclick(
      flyCoordinates.empty.x,
      flyCoordinates.empty.y,
      { delay: 45 },
    );
    await waitFrames(page);
    assert.deepEqual(
      await profile.camera(page),
      beforeEmptyDoubleClick,
      `${planet.id}: empty sky must not trigger a surface flight`,
    );

    assert.equal(await page.evaluate(() => window.__conformanceDeselects), 0,
      `${planet.id}: empty sky must not request deselection`);
    await page.evaluate(() => window.removeEventListener('objectdeselect', window.__conformanceDeselectProbe, { capture: true }));

    // Probe both setter limits in one task, then restore the selected view.
    // Holding the maximum dolly distance intentionally enters overview; that
    // handoff must not race the following retained-comet/planet assertions.
    const { maximum, minimum } = await page.evaluate(({ id, bounds }) => {
      const camera = window.__cssearthTest.object(id).camera, before = camera.state();
      const sample = () => { const state = camera.state(); return { pitch: state.pitch, zoom: state.zoom }; };
      try {
        camera.setState({ controlPitch: bounds.maximumPitch + 100, zoom: bounds.maximumZoom + 100 });
        const maximum = sample();
        camera.setState({ controlPitch: bounds.minimumPitch - 100, zoom: bounds.minimumZoom - 100 });
        return { maximum, minimum: sample() };
      } finally {
        camera.setState({ controlPitch: before.controlPitch, controlYaw: before.controlYaw, zoom: before.zoom });
      }
    }, { id: planet.id, bounds });
    assert.equal(maximum.pitch, bounds.pitchBounded === false
      ? bounds.maximumPitch + 100
      : bounds.maximumPitch, bounds.pitchBounded === false
      ? `${planet.id}: free pitch must cross the prepared reference maximum`
      : `${planet.id}: pitch must clamp at the prepared maximum`);
    assert.equal(maximum.zoom, bounds.maximumZoom,
      `${planet.id}: zoom must clamp at the prepared maximum`);
    assert.equal(minimum.pitch, bounds.pitchBounded === false
      ? bounds.minimumPitch - 100
      : bounds.minimumPitch, bounds.pitchBounded === false
      ? `${planet.id}: free pitch must cross the prepared reference minimum`
      : `${planet.id}: pitch must clamp at the prepared minimum`);
    assert.equal(minimum.zoom, bounds.minimumZoom,
      `${planet.id}: zoom must clamp at the prepared minimum`);

    const afterInteraction = await sceneState(page, profile);
    assert.equal(afterInteraction.stageElements, baseline.stageElements,
      `${planet.id}: interaction must not grow the retained DOM`);
    assert.equal(afterInteraction.stageChildren, baseline.stageChildren,
      `${planet.id}: interaction must not remount scene roots`);
    assert.equal(afterInteraction.stable, true,
      `${planet.id}: retained node identity must remain stable`);

    await proveBreakpointCrossings(page, planet, profile, bounds, baseline);
    await exerciseRetainedInteractions(page, planet, profile);

    const runningBeforePause = await page.locator(".planet-stage").evaluate((stage) =>
      stage.getAnimations({ subtree: true }).filter(({ effect }) => effect instanceof KeyframeEffect && effect.target instanceof Element && effect.target.closest(".planet-render-root")).filter(({ playState }) => playState === "running").length);
    await setDocumentVisibility(page, true);
    assert.equal(await page.locator(".planet-stage").evaluate((stage) =>
      stage.getAnimations({ subtree: true }).filter(({ effect }) => effect instanceof KeyframeEffect && effect.target instanceof Element && effect.target.closest(".planet-render-root")).every(
        ({ playState }) => playState === "paused",
      )), true, `${planet.id}: pause must stop every scene animation`);
    await setDocumentVisibility(page, false);
    assert.equal(await page.locator(".planet-stage").evaluate((stage) =>
      stage.getAnimations({ subtree: true }).filter(({ effect }) => effect instanceof KeyframeEffect && effect.target instanceof Element && effect.target.closest(".planet-render-root")).filter(({ playState }) => playState === "running").length),
      runningBeforePause, `${planet.id}: resume must restore the previously running animations`);

    const retainedProof = await finishRetainedProbe(
      page,
      required(profile.audit).retained.allowedMountSelectors,
    );
    assert.equal(retainedProof.initialNodesIntact, true,
      `${planet.id}: independent observation must retain every initial node`);
    assert.equal(retainedProof.shellTextNodesIntact, true,
      `${planet.id}: camera debug output must retain its text nodes`);
    assert.deepEqual(retainedProof.undeclaredAddedRoots, [],
      `${planet.id}: interactions must not add undeclared scene roots`);
    assert.deepEqual(retainedProof.undeclaredRemovedRoots, [],
      `${planet.id}: interactions must not remove undeclared scene roots`);
    for (const mount of retainedProof.allowedMounts) {
      assert.equal(mount.uniqueRootCount, 1,
        `${planet.id}: ${mount.selector} must reuse one prepared root`);
    }

    await page.evaluate(() => {
      window.dispatchEvent(new Event("pagehide"));
      window.dispatchEvent(new Event("pagehide"));
    });
    assert.equal(await page.locator(".planet-stage").evaluate((stage) =>
      stage.childElementCount), 0, `${planet.id}: destroy must empty the stage`);
    assert.equal(await profile.runtimePresent(page), false,
      `${planet.id}: destroy must remove the diagnostic handle`);
    assertEvidence(evidence, planet.id);
    return {
      id: planet.id,
      viewport: "desktop",
      motionActivation,
      surfaceFlyTo: {
        pitchDelta: afterFlyTo.pitch - beforeFlyTo.pitch,
        zoomRatio: afterFlyTo.zoom / beforeFlyTo.zoom,
      },
      zoomPublication,
      projectiveTextureReport,
      ...baseline,
      retainedProof,
    };
  } finally {
    await page.close();
  }
}

// Prepared nomenclature labels: every object that declares a feature catalogue
// must label the visible hemisphere, expose the prepared caption on hover through
// the shared input surface, follow the prepared spin, and stay retained.
async function proveSurfaceFeatures(browser: Browser, planet: ObjectEntry, profile: ObjectBrowserProfile) {
  const definition = parsePreparedObjectRuntime(JSON.parse(await readFile(resolve("src/objects", planet.id, "prepared/runtime.json"), "utf8")));
  const plan = definition.features;
  if (!plan) return { id: planet.id, case: "surface-features", skipped: true, reason: "no prepared feature catalogue" };
  const page = await createTestPage(browser, { viewport: { width: 1440, height: 900 } });
  const evidence = observePage(page, baseUrl);
  try {
    await loadPlanet(page, planet, profile);
    const stats = (id: string) => page.evaluate(objectId => required(window.__cssearthTest.object(objectId).runtime.surfaceFeatures()), id);
    await page.waitForFunction(id => { const state = window.__cssearthTest.object(id).runtime.surfaceFeatures(); return state?.loaded === true && state.error === null; }, planet.id, { timeout: 30000 });
    if (plan.policy.minimumZoomShare > 0) {
      // Labels belong to the closest zoom: the overview stays clean until the camera reaches it.
      await page.waitForTimeout(400);
      const overview = await stats(planet.id);
      assert.equal(overview.visible, 0, `${planet.id}: the overview shows no feature labels`);
      assert.equal(overview.zoomGate, false);
      await page.evaluate(({ id, zoom }) => window.__cssearthTest.object(id).camera.setState({ zoom }), { id: planet.id, zoom: definition.camera.maximumZoom });
    }
    await page.waitForFunction(id => { const state = window.__cssearthTest.object(id).runtime.surfaceFeatures(); return state?.zoomGate === true && state.visible > 0; }, planet.id, { timeout: 30000 });
    const initial = await stats(planet.id);
    assert.equal(initial.count, plan.catalog.count, `${planet.id}: the layer reports the prepared catalogue size`);
    assert.equal(initial.enabled, true, `${planet.id}: the default lens shows feature labels`);
    const read = () => page.evaluate(() => {
      const stage = window.__cssearthTest.element(".planet-stage").getBoundingClientRect();
      const labels = [...document.querySelectorAll("[data-feature-label]")];
      const visible = labels.filter(label => { const style = getComputedStyle(label); return style.visibility !== "hidden" && Number(style.opacity) > .5; });
      return { total: labels.length, stage: { left: stage.left, top: stage.top, right: stage.right, bottom: stage.bottom },
        visible: visible.map(label => { const rect = label.getBoundingClientRect(); const element = window.__cssearthTest.htmlElement(label);
          return { id: element.dataset.featureLabel ?? "", kind: element.dataset.featureKind ?? "", text: element.textContent ?? "", transform: element.style.transform,
            left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }; }) };
    });
    assert.equal(await page.locator('.planet-surface-labels-setting').isChecked(), false, `${planet.id}: Surface labels defaults off`);
    assert.equal((await read()).visible.length, 0, `${planet.id}: prepared surface labels stay hidden by default`);
    await page.locator('.planet-surface-labels-setting').check();
    const labels = await read();
    assert.equal(labels.total, plan.catalog.count, `${planet.id}: one retained span per prepared feature`);
    assert.ok(labels.visible.length > 0 && labels.visible.length <= plan.policy.maximumVisible, `${planet.id}: visible labels stay within the prepared cap`);
    for (const label of labels.visible) {
      assert.ok(label.text.length > 0 && ["point", "linear", "region"].includes(label.kind), `${planet.id}: ${label.id} carries its prepared caption and kind`);
      assert.ok(label.left >= labels.stage.left && label.right <= labels.stage.right && label.top >= labels.stage.top && label.bottom <= labels.stage.bottom,
        `${planet.id}: ${label.text} stays inside the stage`);
    }
    for (let i = 0; i < labels.visible.length; i++) for (let j = i + 1; j < labels.visible.length; j++) {
      const a = labels.visible[i]!, b = labels.visible[j]!;
      assert.ok(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top, `${planet.id}: ${a.text} overlaps ${b.text}`);
    }
    // Hover through the retained transparent input surface shows the prepared caption card.
    const target = required(labels.visible[0]);
    await page.mouse.move((target.left + target.right) / 2, (target.top + target.bottom) / 2);
    await page.waitForFunction(id => {
      const tooltip = document.querySelector("[data-feature-tooltip]");
      return tooltip instanceof HTMLElement && !tooltip.hidden && tooltip.dataset.featureTooltipFor === id;
    }, target.id, { timeout: 5000 });
    const tooltip = await page.evaluate(() => {
      const card = window.__cssearthTest.element("[data-feature-tooltip]"), rect = card.getBoundingClientRect();
      return { name: window.__cssearthTest.element("[data-feature-tooltip-name]").textContent, detail: window.__cssearthTest.element("[data-feature-tooltip-detail]").textContent,
        origin: window.__cssearthTest.element("[data-feature-tooltip-origin]").textContent, width: rect.width, height: rect.height };
    });
    assert.equal(tooltip.name, target.text, `${planet.id}: the caption names the hovered feature`);
    assert.match(tooltip.detail ?? "", /km$/u, `${planet.id}: the caption reports the prepared type and diameter`);
    assert.ok((tooltip.origin ?? "").length > 0 && tooltip.width > 0 && tooltip.height > 0, `${planet.id}: the caption shows the name origin`);
    assert.equal((await stats(planet.id)).hovered, target.id);
    const outline = await page.evaluate(() => {
      const pieces = [...document.querySelectorAll("[data-feature-outline-piece]")];
      const shown = pieces.filter(piece => getComputedStyle(piece).visibility !== "hidden");
      const box = shown.map(piece => piece.getBoundingClientRect());
      return { total: pieces.length, shown: shown.length, forId: window.__cssearthTest.htmlElement(document.querySelector(".prepared-surface-features")).dataset.featureOutlineFor,
        thickness: shown.length ? Math.max(...box.map(rect => Math.min(rect.width, rect.height))) : 0 };
    });
    assert.equal(outline.total, plan.outline.pieces, `${planet.id}: the outline pool is retained at the prepared size`);
    assert.ok(outline.shown > 0 && outline.forId === target.id, `${planet.id}: hover traces the feature's published diameter as retained chords`);
    assert.ok(outline.thickness > 0 && outline.thickness < 6, `${planet.id}: the outline stroke stays a shell pixel size`);
    await page.mouse.move(labels.stage.left + 8, labels.stage.top + 8);
    await page.waitForFunction(() => { const tooltip = document.querySelector("[data-feature-tooltip]"); return tooltip instanceof HTMLElement && tooltip.hidden; }, null, { timeout: 5000 });
    assert.equal((await stats(planet.id)).outlinePieces, 0, `${planet.id}: leaving the label retires the outline`);
    // Clicking a label through the input surface pins it and flies the camera over it; the pin survives the density gate.
    await page.mouse.click((target.left + target.right) / 2, (target.top + target.bottom) / 2);
    await page.waitForFunction(id => { const state = window.__cssearthTest.object(id).runtime.surfaceFeatures(); return state?.pinned === id && state.flying === false; }, target.id, { timeout: 15000 });
    const pinned = await stats(planet.id);
    assert.ok(pinned.visible >= 1 && pinned.outlinePieces > 0, `${planet.id}: the selected feature keeps its label and outline`);
    // The sidebar search lists named features and selecting a row flies to it.
    await page.locator(".planet-sidebar-search").fill(target.text);
    const row = page.locator(".planet-feature-results li:not([hidden]) a").first();
    await row.waitFor({ timeout: 10000 });
    assert.ok((await row.innerText()).includes(target.text), `${planet.id}: the search lists the named feature`);
    await row.click();
    await page.waitForFunction(id => { const state = window.__cssearthTest.object(id).runtime.surfaceFeatures(); return state?.pinned === id && state.flying === false; }, target.id, { timeout: 15000 });
    await page.locator(".planet-sidebar-search").fill("");
    await page.keyboard.press("Escape");
    // A plain click on the surface that picks no label clears the selection.
    const clear = await page.evaluate(() => { const stage = window.__cssearthTest.element(".planet-stage").getBoundingClientRect(); return { x: stage.left + stage.width * 0.62, y: stage.bottom - 60 }; });
    await page.mouse.click(clear.x, clear.y);
    await page.waitForFunction(id => window.__cssearthTest.object(id).runtime.surfaceFeatures()?.pinned === null, planet.id, { timeout: 5000 });
    await page.evaluate(({ id, zoom }) => window.__cssearthTest.object(id).camera.setState({ zoom }), { id: planet.id, zoom: definition.camera.maximumZoom });
    // Labels follow the prepared spin without adding DOM.
    await enableMotion(page, planet.id);
    await page.waitForTimeout(600);
    const moving = await read();
    const beforeById = new Map(labels.visible.map(label => [label.id, label.transform]));
    assert.ok(moving.visible.some(label => beforeById.has(label.id) && beforeById.get(label.id) !== label.transform),
      `${planet.id}: labels move with the spinning surface`);
    assert.equal(moving.total, plan.catalog.count);
    // Lenses outside the prepared declaration hide the layer; declared lenses restore it.
    const other = definition.controls.lenses?.controls.find(lens => !plan.lensIds.includes(lens.id));
    if (other) {
      assert.equal(await page.evaluate(({ id, lens }) => window.__cssearthTest.object(id).selectLens(lens), { id: planet.id, lens: other.id }), true);
      await page.waitForFunction(id => { const state = window.__cssearthTest.object(id).runtime.surfaceFeatures(); return state?.enabled === false && state.visible === 0; }, planet.id, { timeout: 10000 });
      assert.equal(await page.evaluate(({ id, lens }) => window.__cssearthTest.object(id).selectLens(lens), { id: planet.id, lens: required(plan.lensIds[0]) }), true);
      await page.waitForFunction(id => { const state = window.__cssearthTest.object(id).runtime.surfaceFeatures(); return state?.enabled === true && state.visible > 0; }, planet.id, { timeout: 10000 });
    }
    assert.equal(await page.evaluate(id => window.__cssearthTest.object(id).assertStableDomIdentity(), planet.id), true, `${planet.id}: feature labels keep the retained DOM`);
    assertEvidence(evidence, planet.id);
    return { id: planet.id, case: "surface-features", count: plan.catalog.count, visible: labels.visible.length, hovered: target.text, lensGate: other?.id ?? null };
  } finally { await page.close(); }
}

async function surfaceFlyCoordinates(page: Page) {
  const bounds = await page.locator(".polycss-camera").boundingBox();
  assert.ok(bounds, "retained camera bounds must be measurable");
  const size = Math.min(bounds.width, bounds.height);
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const viewport = required(page.viewportSize());
  const outsideOffset = size * 0.4;
  const direction = viewport.width - centerX > outsideOffset + 2 ? 1 : -1;
  const coordinates = {
    surface: Object.freeze({
      x: centerX + direction * size * 0.11,
      y: centerY + size * 0.11,
    }),
    empty: Object.freeze({
      x: centerX + direction * outsideOffset,
      y: centerY,
    }),
  };
  const id = required(await page.locator('.planet-stage').getAttribute('data-object-id'));
  if (!surfaceHitPlans.has(id)) {
    const prepared = parsePreparedObjectRuntime(JSON.parse(await readFile(resolve(`src/objects/${id}/prepared/runtime.json`), 'utf8')));
    surfaceHitPlans.set(id, prepared.surfaceHit ?? null);
  }
  const surfaceHit = surfaceHitPlans.get(id);
  if (surfaceHit) {
    // An irregular silhouette can leave the old fixed disc sample in empty
    // space. Use the same prepared-triangle picker as native input.
    coordinates.surface = await page.evaluate(async ({ id, hit, preferred, moduleUrl }) => {
      const { bindPreparedSurfaceHit } = await import(moduleUrl);
      const camera = window.__cssearthTest.html('.planet-stage > .polycss-camera');
      const scene = camera?.querySelector('.polycss-scene');
      // Prepared depth groups repeat transform wrappers beneath one camera.
      // Surface picking uses the first, retained reference body transform.
      if (!scene || scene.querySelectorAll(`.${id}-body`).length !== 1 || document.querySelectorAll('.planet-stage > .polycss-camera').length !== 1) {
        throw new Error('Surface qualification requires one retained camera and reference body');
      }
      const pick = bindPreparedSurfaceHit(hit, scene.querySelector(`.${id}-body`), scene, camera,
        () => window.__cssearthTest.html('.planet-stage').dataset.lens);
      const box = camera.getBoundingClientRect(), size = Math.min(box.width, box.height);
      const candidates = [preferred];
      for (const y of [.06, -.06, .12, -.12, .2, -.2, 0]) for (const x of [.06, -.06, .12, -.12, .2, -.2, 0]) {
        candidates.push({ x: box.x + box.width / 2 + size * x, y: box.y + box.height / 2 + size * y });
      }
      const point = candidates.find(p => p.x > 0 && p.x < innerWidth && p.y > 0 && p.y < innerHeight &&
        !document.elementFromPoint(p.x, p.y)?.closest('.planet-sidebar,button,a,input,summary') &&
        [[0, 0], [-4, 0], [4, 0], [0, -4], [0, 4]].every(([x, y]) => pick(p.x + x, p.y + y)));
      if (!point) throw new Error(`No visible prepared surface point for ${id}`);
      return point;
    }, { id, hit: surfaceHit, preferred: coordinates.surface, moduleUrl: surfaceHitModuleUrl });
  }
  return Object.freeze(coordinates);
}

async function beginRetainedProbe(page: Page) {
  await page.evaluate(() => {
    const stage = window.__cssearthTest.element(".planet-stage");
    const initialNodes = [...stage.querySelectorAll("*")];
    const initialParents = initialNodes.map((node) => node.parentNode);
    const addedRoots:Element[] = [];
    const removedRoots:Element[] = [];
    const shellTextNodes = [
      document.querySelector(".planet-camera-coordinates")?.firstChild,
      document.querySelector(".planet-camera-copy")?.firstChild,
    ].filter((node):node is ChildNode=>node!==null&&node!==undefined);
    const shellTextParents = shellTextNodes.map((node) => node.parentNode);
    let maximumNodeCount = initialNodes.length;
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof Element) addedRoots.push(node);
        }
        for (const node of record.removedNodes) {
          if (node instanceof Element) removedRoots.push(node);
        }
      }
      maximumNodeCount = Math.max(
        maximumNodeCount,
        stage.querySelectorAll("*").length,
      );
    });
    observer.observe(stage, { childList: true, subtree: true });
    window.__retainedConformance = {
      stage,
      initialNodes,
      initialParents,
      shellTextNodes,
      shellTextParents,
      addedRoots,
      removedRoots,
      observer,
      maximumNodeCount: () => maximumNodeCount,
    };
  });
}

async function exerciseRetainedInteractions(page: Page, planet: ObjectEntry, profile: ObjectBrowserProfile) {
  const retained = required(profile.audit).retained;
  await assertRenderedObjectControls(page, profile);
  const lensIds = profile.objectControls.lenses?.controls.length ? required(retained.lensIds) : [];
  for (const id of lensIds) {
    await page.locator(`button[name="dataset"][value="${id}"]`).evaluate((button) => window.__cssearthTest.htmlElement(button).click());
    await page.waitForFunction(id => {
      const root = document.getElementById(`${id}-lenses`);
      return root?.getAttribute("aria-busy") !== "true" && !root?.classList.contains("is-loading");
    }, planet.id);
    await assertLensConsistency(page, planet, profile, id);
  }
  if (lensIds.length) {
    await profile.selectLens(page, lensIds[0]);
    await assertLensConsistency(page, planet, profile, lensIds[0]);
  }

  if (!profile.objectControls.settings?.controls.some(({ name }) => name === "speed")) return;

  // A destination lens can deliberately pause motion. Re-establish the speed
  // scenario's playback precondition through the shared control.
  if (!await page.locator(".planet-motion-setting").isChecked()) await enableMotion(page, planet.id);
  const speed = page.locator('input[name="speed"][type="range"]');
  assert.equal(await speed.count(), 1, `${planet.id}: speed control must exist`);
  const speedStates = Object.freeze([
    Object.freeze({ label: "fast", rate: 2 }),
    Object.freeze({ label: "fastest", rate: 3 }),
    Object.freeze({ label: "superfast", rate: 4 }),
    Object.freeze({ label: "off", rate: 0 }),
    Object.freeze({ label: "normal", rate: 1 }),
  ]);
  assert.equal(retained.speedClicks, speedStates.length,
    `${planet.id}: speed proof must exercise the complete Saturn cycle`);
  assert.equal(await speed.getAttribute("data-state"), "normal",
    `${planet.id}: speed control must begin at normal`);
  for (const state of speedStates) {
    await speed.evaluate((input, value) => {
      if (!(input instanceof HTMLInputElement)) throw new Error("Expected speed input");
      input.value = String(value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, state.rate);
    await waitFrames(page);
    assert.equal(await speed.getAttribute("data-state"), state.label,
      `${planet.id}: speed control must publish ${state.label}`);
    const animations = await page.locator(".planet-stage").evaluate((stage) =>
      stage.getAnimations({ subtree: true }).filter(({ effect }) => effect instanceof KeyframeEffect && effect.target instanceof Element && effect.target.closest(".planet-render-root")).map((animation) => ({
        currentTime: animation.currentTime,
        playbackRate: animation.playbackRate,
        playState: animation.playState,
      })));
    assert.ok(animations.length > 0,
      `${planet.id}: speed control must own scene animations`);
    if (state.rate === 0) {
      assert.ok(animations.every(({ playbackRate, playState }) =>
        playbackRate === 0 || playState === "paused"),
      `${planet.id}: off must make every animation stationary`);
      await setDocumentVisibility(page, true);
      await setDocumentVisibility(page, false);
      await waitFrames(page);
      const afterResume = await page.locator(".planet-stage").evaluate((stage) =>
        stage.getAnimations({ subtree: true }).filter(({ effect }) => effect instanceof KeyframeEffect && effect.target instanceof Element && effect.target.closest(".planet-render-root")).map((animation) => ({
          currentTime: animation.currentTime,
          playbackRate: animation.playbackRate,
          playState: animation.playState,
        })));
      assert.equal(afterResume.length, animations.length,
        `${planet.id}: pause and resume must preserve animation ownership`);
      for (let index = 0; index < animations.length; index += 1) {
        assert.ok(Math.abs(
          Number(afterResume[index].currentTime) -
          Number(animations[index].currentTime),
        ) < 0.1, `${planet.id}: off must survive pause and resume`);
        assert.ok(afterResume[index].playbackRate === 0 ||
          afterResume[index].playState === "paused",
        `${planet.id}: resumed off state must remain stationary`);
      }
    } else {
      assert.ok(animations.some(({ playbackRate, playState }) =>
        playbackRate === state.rate && playState === "running"),
      `${planet.id}: ${state.label} must keep scene motion running`);
      assert.ok(animations.every(({ playbackRate, playState }) =>
        playState === "paused" || playbackRate === state.rate),
      `${planet.id}: ${state.label} must use effective rate ${state.rate}`);
    }
  }

  await waitFrames(page);
}

async function finishRetainedProbe(page: Page, allowedSelectors:readonly string[]) {
  return page.evaluate((selectors) => {
    const probe = window.__cssearthTest.required(window.__retainedConformance,"retained probe");
    probe.observer.takeRecords();
    probe.observer.disconnect();
    const rootFor = (node:Element, selector:string) => node.matches(selector)
      ? node
      : node.closest(selector);
    const allowedRoot = (node:Element) => selectors.some((selector) =>
      Boolean(rootFor(node, selector)));
    const describe = (node:Element) => node.className || node.localName;
    const allowedMounts = selectors.map((selector) => {
      const roots = [
        ...probe.addedRoots,
        ...probe.removedRoots,
      ].map((node) => rootFor(node, selector)).filter(Boolean);
      return {
        selector,
        uniqueRootCount: new Set(roots).size,
        addEvents: probe.addedRoots.filter((node) =>
          Boolean(rootFor(node, selector))).length,
        removeEvents: probe.removedRoots.filter((node) =>
          Boolean(rootFor(node, selector))).length,
      };
    });
    const result = {
      initialNodeCount: probe.initialNodes.length,
      currentNodeCount: probe.stage.querySelectorAll("*").length,
      maximumNodeCount: probe.maximumNodeCount(),
      initialNodesIntact: probe.initialNodes.every((node, index) =>
        node.isConnected && node.parentNode === probe.initialParents[index]),
      shellTextNodesIntact: probe.shellTextNodes.every((node, index) =>
        node.isConnected && node.parentNode === probe.shellTextParents[index]),
      undeclaredAddedRoots: probe.addedRoots.filter((node) =>
        !allowedRoot(node)).map(describe),
      undeclaredRemovedRoots: probe.removedRoots.filter((node) =>
        !allowedRoot(node)).map(describe),
      allowedMounts,
    };
    delete window.__retainedConformance;
    return result;
  }, allowedSelectors);
}

async function provePreparedDensity(browser: Browser, planet: ObjectEntry, profile: ObjectBrowserProfile, density:number) {
  const context = await browser.newContext({
    viewport: { width: 1200, height: 800 },
    deviceScaleFactor: density,
    ...(evidenceDirectory ? { recordVideo: {
      dir: evidenceDirectory, size: { width: 1200, height: 800 },
    } } : {}),
  });
  const page = await createTestPage(context);
  const evidence = observePage(page, baseUrl);
  const requestedPaths = new Set<string>();
  const responses = new Map<string,Response>();
  page.on("response", response => responses.set(new URL(response.url()).pathname, response));
  page.on("request", (request) => {
    requestedPaths.add(new URL(request.url()).pathname);
  });
  try {
    await loadPlanet(page, planet, profile);
    await profile.pause(page);
    if (evidenceDirectory) await page.evaluate(() => {
      const label = document.createElement("div");
      label.id = "camera-conformance-label";
      label.style.cssText = "position:fixed;right:20px;bottom:48px;padding:10px 16px;" +
        "background:#17191b;color:white;font:16px sans-serif;pointer-events:none;z-index:9999";
      label.textContent = "Sky and planet input boundaries";
      document.body.append(label);
      const pointer = document.createElement("div");
      pointer.style.cssText = "position:fixed;width:16px;height:16px;border:2px solid white;" +
        "border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:9999";
      document.body.append(pointer);
      document.addEventListener("pointermove", event => {
        pointer.style.left = `${event.clientX}px`;
        pointer.style.top = `${event.clientY}px`;
      }, true);
      document.addEventListener("pointerdown", () => pointer.style.background = "#ffb14e", true);
      document.addEventListener("pointerup", () => pointer.style.background = "transparent", true);
    });
    assert.equal(await profile.selectedDensity(page), 2,
      `${planet.id}: DPR ${density} must select the canonical high-density bank`);
    // The application owns the shared universe: no object mounts sky faces, stars or a Sun of its own.
    const sharedSky = await proveSharedPreparedSky(page, requestedPaths, responses);
    assert.equal(await page.locator('.planet-cubic-sky-cube s').count(), 0,
      `${planet.id}: the application owns all rendered sky content`);
    const canonicalAssets = required(profile.audit).canonicalPreparedAssets ?? [];
    assert.ok(Array.isArray(canonicalAssets));
    for (const url of canonicalAssets) {
      assert.ok(requestedPaths.has(url),
        `${planet.id}: DPR ${density} must request canonical ${url}`);
    }
    for (const pair of required(profile.audit).preparedAssetPairs ?? []) {
      assert.ok(requestedPaths.has(pair.two),
        `${planet.id}: DPR ${density} must request canonical ${pair.two}`);
      assert.equal(requestedPaths.has(pair.one), false,
        `${planet.id}: DPR ${density} must not request low-density ${pair.one}`);
    }
    const skyboxPointerBoundary = await proveSkyboxPointerBoundary(
      page,
      planet,
      profile,
    );
    if (WHEEL_ZOOM_USE_SCROLL_DISTANCE) await proveWheelZoomDistance(page, planet, profile);
    const interactionInterruptions = await proveInteractionInterruptions(
      page,
      planet,
      profile,
    );
    const wheelTakeover = await proveWheelTakeover(page, planet, profile);
    const releasePosition = await proveReleasePosition(page, planet, profile);
    assert.equal(await profile.stable(page), true,
      `${planet.id}: the full interaction sequence must preserve retained nodes`);
    if (densityOnly) {
      assert.deepEqual(evidence.externalRequests, [],
        `${planet.id}: browser must make no external requests`);
      assert.deepEqual(evidence.problems.filter(problem => problem.startsWith("pageerror:")), [],
        `${planet.id}: interaction proof must have no runtime exceptions`);
    } else {
      assertEvidence(evidence, planet.id);
    }
    if (evidenceDirectory) console.error(`${planet.id} DPR ${density}: interactions passed`);
    return {
      id: planet.id,
      viewport: `dpr-${density}`,
      selectedDensity: 2,
      requestedCanonicalAssets: [...canonicalAssets].sort(),
      sharedSky,
      skyboxPointerBoundary,
      interactionInterruptions,
      wheelTakeover,
      releasePosition,
      ...(evidenceDirectory ? { video: `${planet.id}-dpr-${density}.webm` } : {}),
      ...(densityOnly
        ? { browserProblemsOutsideDensityProof: evidence.problems }
        : {}),
    };
  } finally {
    const video = page.video();
    await context.close();
    if (video && evidenceDirectory) await rename(await video.path(),
      resolve(evidenceDirectory, `${planet.id}-dpr-${density}.webm`));
  }
}

async function proveSharedPreparedSky(page: Page, requestedPaths:ReadonlySet<string>, responses:ReadonlyMap<string,Response>) {
  const context = JSON.parse(await readFile(resolve('src/objects/sun/prepared/world-context.json'), 'utf8'));
  const root = resolve('src/objects', context.volume.objectId);
  const descriptor = JSON.parse(await readFile(resolve(root, 'object.json'), 'utf8'));
  const bytes = await readFile(resolve(root, descriptor.prepared.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), descriptor.prepared.sha256);
  const faceSchema = shape({id:text,texturePath:text});
  const payload = shape({sky:shape({faces:array(faceSchema),nearFaces:optional(array(faceSchema))}),resources:array(shape({path:text,bytes:number,sha256:text}))})(JSON.parse(bytes.toString('utf8')).data);
  assert.equal(await page.locator('.prepared-universe').count(), 1);
  assert.equal(await page.locator('.prepared-celestial-sky').count(), 1);
  const rendered = await page.locator('.prepared-celestial-sky [data-sky-face]').evaluateAll(nodes => nodes.map(node => ({
    id: window.__cssearthTest.htmlElement(node).dataset.skyFace, url: new URL(window.__cssearthTest.required(window.__cssearthTest.htmlElement(node).style.backgroundImage.match(/^url\(["']?(.*?)["']?\)$/),'sky image URL')[1], location.href).href,
  })));
  assert.deepEqual(rendered.map(face => face.id), payload.sky.faces.map(face => face.id));
  const receipt = [];
  for (const face of payload.sky.faces) {
    const path = new URL(required(rendered.find(value => value.id === face.id)).url).pathname;
    const candidates = [face, ...(payload.sky.nearFaces ?? []).filter(near => near.id === face.id)];
    const selected = candidates.find(candidate => path.endsWith(`/${candidate.texturePath}`));
    assert.ok(selected, `Shared sky ${face.id} must use its prepared near or distant face`);
    const resource = payload.resources.find(resource => resource.path === selected.texturePath);
    assert.ok(resource, `Prepared sky face ${face.id} requires a pinned resource`);
    assert.ok(requestedPaths.has(path), `Shared sky must request ${face.id}`);
    const response = responses.get(path);
    assert.ok(response?.ok(), `Shared sky must load ${face.id}`);
    const image = await required(response).body();
    const sha256 = createHash('sha256').update(image).digest('hex');
    assert.equal(image.length, resource.bytes, `${face.id}: shared sky byte count`);
    assert.equal(sha256, resource.sha256, `${face.id}: exact prepared sky bytes`);
    receipt.push({ id: face.id, bytes: image.length, sha256 });
  }
  return receipt;
}

async function proveReleasePosition(page: Page, planet: ObjectEntry, profile: ObjectBrowserProfile) {
  await showInteractionPhase(page, "Release without an extra drag step");
  const bounds = await profile.bounds(page);
  await profile.setCamera(page, { pitch: bounds.defaultPitch, zoom: bounds.defaultZoom });
  const coordinates = await surfaceFlyCoordinates(page);
  const { x, y } = coordinates.surface;
  const cdp = await page.context().newCDPSession(page);
  try {
    for (const paused of [false, true]) {
      await page.mouse.move(x, y);
      await page.mouse.down();
      for (const offset of paused ? [8, 20, 38] : [10, 20, 30]) {
        await page.waitForTimeout(35);
        await page.mouse.move(x + offset, y);
      }
      if (paused) await page.waitForTimeout(160);
      else await page.waitForTimeout(35);
      const before = await cameraPose(page, planet.id);
      const starts = (await interactionStats(page, planet.id)).starts;
      // A moved mouse-up is a distinct input, not another mouse-move event.
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased",
        x: x + (paused ? 64 : 40), y, button: "left", buttons: 0, clickCount: 1 });
      await page.mouse.up();
      await waitFrames(page);
      assert.deepEqual(await cameraPose(page, planet.id), before,
        `${planet.id}: ${paused ? "paused" : "constant-speed"} release must retain the last drag pose`);
      assert.equal((await interactionStats(page, planet.id)).starts, starts,
        `${planet.id}: release must not manufacture an inertial throw`);
      assert.equal((await interactionStats(page, planet.id)).activeMode, "idle");
    }
  } finally { await cdp.detach(); }
  return { nonLaunchingReleaseRetainsDragPose: true, pausedReleaseCannotRestartMotion: true };
}

async function proveWheelTakeover(page: Page, planet: ObjectEntry, profile: ObjectBrowserProfile) {
  const bounds = await profile.bounds(page);
  const reset = () => profile.setCamera(page, {
    pitch: bounds.defaultPitch, zoom: bounds.defaultZoom,
  });
  await reset();
  const coordinates = await surfaceFlyCoordinates(page);
  const startWheel = async () => {
    await page.mouse.move(coordinates.surface.x, coordinates.surface.y);
    await page.mouse.wheel(0, -40);
    await page.waitForTimeout(35);
    assert.equal((await interactionStats(page, planet.id)).wheelZoom.active, true,
      `${planet.id}: takeover must begin during the shared wheel interval`);
  };
  await showInteractionPhase(page, "Grab during wheel zoom: the camera must stop");
  await startWheel();
  await page.mouse.down();
  const pressed = await cameraPose(page, planet.id);
  await page.waitForTimeout(PREPARED_WHEEL_ZOOM.intervalMilliseconds + 50);
  assert.deepEqual(await cameraPose(page, planet.id), pressed,
    `${planet.id}: grabbing the body must stop wheel zoom and anchor rotation immediately`);
  assert.equal((await interactionStats(page, planet.id)).wheelZoom.active, false,
    `${planet.id}: grabbing must cancel the pending wheel frame`);
  await page.mouse.up();

  await showInteractionPhase(page, "Sky press must stop wheel motion");
  await reset();
  await startWheel();
  // Use the viewport corner: zoom can expand a large body's limb over the
  // point that was just outside its disc before the wheel gesture began.
  await page.mouse.move(required(page.viewportSize()).width - 32, 96);
  await page.mouse.down();
  assert.equal((await interactionStats(page, planet.id)).pendingPointer, true,
    `${planet.id}: the sky press must reserve an orbit drag`);
  const skyPress = await cameraPose(page, planet.id);
  await page.waitForTimeout(PREPARED_WHEEL_ZOOM.intervalMilliseconds + 50);
  assert.deepEqual(await cameraPose(page, planet.id), skyPress,
    `${planet.id}: a sky press must stop wheel motion immediately`);
  await page.mouse.up();

  await showInteractionPhase(page, "Reset during wheel zoom: no delayed motion");
  await reset();
  await startWheel();
  await reset();
  const resetPose = await cameraPose(page, planet.id);
  await page.waitForTimeout(PREPARED_WHEEL_ZOOM.intervalMilliseconds + 50);
  assert.deepEqual(await cameraPose(page, planet.id), resetPose,
    `${planet.id}: resetting the camera must cancel pending wheel publications`);
  assert.equal((await interactionStats(page, planet.id)).wheelZoom.active, false,
    `${planet.id}: reset must cancel the pending wheel frame`);
  await showInteractionPhase(page, "Held-button wheel cancels the grab");
  await reset();
  const cameraBounds = await page.locator(".planet-stage .polycss-camera").boundingBox();
  assert.ok(cameraBounds,"Camera bounds must exist");
  const x = cameraBounds.x + cameraBounds.width / 2;
  const y = cameraBounds.y + cameraBounds.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  const heldPose = await cameraPose(page, planet.id);
  await page.mouse.wheel(0, -40);
  await page.waitForTimeout(PREPARED_WHEEL_ZOOM.intervalMilliseconds + 50);
  const zoomedWhileHeld = await cameraPose(page, planet.id);
  assert.deepEqual(zoomedWhileHeld, heldPose,
    `${planet.id}: scrolling while held must not zoom`);
  assert.equal((await interactionStats(page, planet.id)).pendingPointer, false);
  await page.mouse.move(x + 40, y);
  const heldDrag = await cameraPose(page, planet.id);
  assert.deepEqual(heldDrag, heldPose,
    `${planet.id}: movement after held-wheel cancellation must wait for a new press`);
  await page.waitForTimeout(TRACKBALL_DRAG_INERTIA.releaseFreshnessMilliseconds + 20);
  await page.mouse.up();
  await page.evaluate(({ id, state }) => window.__cssearthTest.object(id).camera.setState(state),
    { id:planet.id, state:zoomedWhileHeld });
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 40, y);
  const freshDrag = await cameraPose(page, planet.id);
  assert.notDeepEqual(freshDrag.pose, heldPose.pose,
    `${planet.id}: a new press must restore dragging after wheel cancellation`);
  await page.waitForTimeout(TRACKBALL_DRAG_INERTIA.releaseFreshnessMilliseconds + 20);
  await page.mouse.up();
  return { bodyPressStopsWheel: true, skyPressStopsWheel: true,
    resetStopsWheel: true, heldWheelCancelsGrab: true };
}

async function proveInteractionInterruptions(page: Page, planet: ObjectEntry, profile: ObjectBrowserProfile) {
  await showInteractionPhase(page, "Drag, coast, then wheel interruption");
  const bounds = await profile.bounds(page);
  await profile.setCamera(page, {
    pitch: bounds.defaultPitch,
    zoom: bounds.defaultZoom,
  });

  await drag(page, profile.inputSelector, 90, 150);
  const inertiaBeforeWheel = await interactionStats(page, planet.id);
  assert.equal(inertiaBeforeWheel.activeMode, "inertia",
    `${planet.id}: fast release must enter inertia before wheel interruption`);
  assert.equal(inertiaBeforeWheel.activeMotionCount, 1,
    `${planet.id}: inertia must be the only active camera motion`);
  await wheel(page, profile.inputSelector, -40);
  const inertiaAfterWheel = await interactionStats(page, planet.id);
  assert.equal(inertiaAfterWheel.activeMode, "idle",
    `${planet.id}: wheel zoom must interrupt rotational inertia`);
  assert.equal(inertiaAfterWheel.activeMotionCount, 0,
    `${planet.id}: wheel interruption must leave no rotational motion owner`);
  assert.equal(
    inertiaAfterWheel.interruptions.wheel,
    inertiaBeforeWheel.interruptions.wheel + 1,
    `${planet.id}: wheel interruption must be recorded once`,
  );
  assert.equal(inertiaAfterWheel.cancels, inertiaBeforeWheel.cancels + 1,
    `${planet.id}: wheel input must cancel inertia exactly once`);
  await page.waitForTimeout(PREPARED_WHEEL_ZOOM.intervalMilliseconds + 30);
  const poseAfterWheel = await cameraPose(page, planet.id);
  await waitFrames(page);
  assert.deepEqual(await cameraPose(page, planet.id), poseAfterWheel,
    `${planet.id}: camera must stay still after the wheel interval ends`);

  await profile.setCamera(page, {
    pitch: bounds.defaultPitch,
    zoom: bounds.defaultZoom,
  });
  const anchorCoordinates = await surfaceFlyCoordinates(page);
  const dolly = await wheelDolly(page, planet.id);
  const beforeAnchorWheel = await cameraPose(page, planet.id);
  const distanceBefore = dolly ? await cameraDistance(page, planet.id) : null;
  await page.mouse.move(anchorCoordinates.surface.x, anchorCoordinates.surface.y);
  const anchorScrollPixels = await wheelWithReceipt(page, -40);
  await page.waitForTimeout(PREPARED_WHEEL_ZOOM.intervalMilliseconds + 80);
  const afterAnchorWheel = await cameraPose(page, planet.id);
  const wheelZoomRatio = afterAnchorWheel.zoom / beforeAnchorWheel.zoom;
  if (dolly) {
    // A perspective dolly: the prepared step per wheel delta moves the eye
    // along its axis, and there is no surface anchor to hold.
    const distanceRatio = required(await cameraDistance(page, planet.id)) / required(distanceBefore);
    const kind = await page.evaluate(id => window.__cssearthTest.object(id).camera.stats().dragInertia.wheelZoom.inputKind, planet.id);
    const gain = kind === "wheel" ? WHEEL_ZOOM_DISCRETE_SPEED_MULTIPLIER : WHEEL_ZOOM_SPEED_MULTIPLIER;
    assert.ok(Math.abs(distanceRatio - Math.exp(anchorScrollPixels * dolly.wheelStepPerDelta * gain)) < 1e-6,
      `${planet.id}: prepared wheel dolly step drifted (ratio ${distanceRatio})`);
    assert.equal(afterAnchorWheel.pose.scene, beforeAnchorWheel.pose.scene,
      `${planet.id}: a wheel dolly must not turn the scene`);
  } else {
    const anchorInputKind = await page.evaluate(id =>
      window.__cssearthTest.object(id).camera.stats().dragInertia.wheelZoom.inputKind, planet.id);
    const anchorSpeed = WHEEL_ZOOM_USE_SCROLL_DISTANCE && anchorInputKind === "wheel"
      ? WHEEL_ZOOM_DISCRETE_SPEED_MULTIPLIER : WHEEL_ZOOM_SPEED_MULTIPLIER;
    // Camera publication rounds zoom to four decimal places on each frame.
    assert.ok(Math.abs(wheelZoomRatio - Math.exp(
      PREPARED_WHEEL_ZOOM.screenLogScalePerMillisecond *
        anchorSpeed * PREPARED_WHEEL_ZOOM.intervalMilliseconds *
        (WHEEL_ZOOM_USE_SCROLL_DISTANCE
          ? -anchorScrollPixels / 100 : 1))) < 0.002,
    `${planet.id}: shared wheel response drifted (ratio ${wheelZoomRatio})`);
    assert.notEqual(afterAnchorWheel.pose.scene, beforeAnchorWheel.pose.scene,
      `${planet.id}: off-centre wheel zoom must apply anchor rotation`);
  }

  await profile.setCamera(page, {
    pitch: bounds.defaultPitch,
    zoom: bounds.defaultZoom,
  });
  await drag(page, profile.inputSelector, 90, 150);

  await showInteractionPhase(page, "Click to stop, then one-pixel drag");
  const stopCoordinates = await surfaceFlyCoordinates(page);
  const inertiaBeforePointer = await interactionStats(page, planet.id);
  assert.equal(inertiaBeforePointer.activeMode, "inertia",
    `${planet.id}: rotation must still be active before the stop press`);
  await page.mouse.move(
    stopCoordinates.surface.x,
    stopCoordinates.surface.y,
  );
  await page.mouse.down();
  const inertiaAfterPointer = await interactionStats(page, planet.id);
  assert.equal(inertiaAfterPointer.activeMode, "idle",
    `${planet.id}: pointer-down must stop inertia before pointer-up`);
  assert.equal(inertiaAfterPointer.activeMotionCount, 0,
    `${planet.id}: a surface pointer must leave no camera motion owner`);
  assert.equal(inertiaAfterPointer.pendingPointer, true,
    `${planet.id}: the stop press must remain available for a new drag`);
  assert.equal(
    inertiaAfterPointer.cancels,
    inertiaBeforePointer.cancels + 1,
    `${planet.id}: a surface pointer must cancel inertia exactly once`,
  );
  assert.equal(
    inertiaAfterPointer.interruptions.pointer,
    inertiaBeforePointer.interruptions.pointer + 1,
    `${planet.id}: a surface pointer interruption must be recorded once`,
  );
  assert.deepEqual(inertiaAfterPointer.lastInterruption, {
    from: "inertia",
    to: "pointer",
  }, `${planet.id}: a surface pointer must own the inertia interruption`);
  const stoppedPose = await cameraPose(page, planet.id);
  await waitFrames(page);
  assert.deepEqual(await cameraPose(page, planet.id), stoppedPose,
    `${planet.id}: both axes must stay stopped while the pointer is held`);
  await page.mouse.move(
    stopCoordinates.surface.x + 1,
    stopCoordinates.surface.y + 1,
  );
  const tinyDragPose = await cameraPose(page, planet.id);
  assert.notDeepEqual(tinyDragPose, stoppedPose,
    `${planet.id}: a one-pixel drag must respond immediately after stopping coast`);
  await page.mouse.up();
  await waitFrames(page);
  assert.deepEqual(await cameraPose(page, planet.id), tinyDragPose,
    `${planet.id}: releasing a tiny drag must not restart rotation`);
  const releasedPointer = await interactionStats(page, planet.id);
  assert.equal(releasedPointer.pendingPointer, false,
    `${planet.id}: pointer-up must clear the pending press`);
  assert.equal(releasedPointer.activeMotionCount, 0,
    `${planet.id}: pointer-up after a tiny drag must remain idle`);
  assert.equal(releasedPointer.starts, inertiaBeforePointer.starts,
    `${planet.id}: pointer-up after a tiny drag must not launch another throw`);

  const input = page.locator(profile.inputSelector);
  await showInteractionPhase(page, "Release pointer capture outside the planet");
  await input.evaluate((node) => node.addEventListener("pointerdown", (event) => {
    if (!(event instanceof PointerEvent)) throw new Error("Expected pointer event");
    window.__cssearthTest.htmlElement(node).__testPointerId = event.pointerId;
  }, { once: true }));
  await page.mouse.down();
  await page.mouse.move(stopCoordinates.surface.x + 60,
    stopCoordinates.surface.y + 25, { steps: 6 });
  assert.equal((await interactionStats(page, planet.id)).activeMode, "drag",
    `${planet.id}: capture-loss scenario must begin during a drag`);
  const poseAtCaptureLoss = await cameraPose(page, planet.id);
  await input.evaluate((node) => {
    const html=window.__cssearthTest.htmlElement(node);
    html.releasePointerCapture(window.__cssearthTest.required(html.__testPointerId,"captured pointer"));
    delete html.__testPointerId;
  });
  const sidebar = await page.locator(".planet-sidebar").boundingBox();
  assert.ok(sidebar,"Sidebar bounds must exist");
  await page.mouse.move(sidebar.x + 40, sidebar.y + 120);
  await page.mouse.up();
  await page.mouse.move(stopCoordinates.surface.x, stopCoordinates.surface.y);
  await page.mouse.move(stopCoordinates.surface.x + 40,
    stopCoordinates.surface.y + 20, { steps: 4 });
  await waitFrames(page);
  assert.deepEqual(await cameraPose(page, planet.id), poseAtCaptureLoss,
    `${planet.id}: capture loss and release outside must not turn hover into drag`);
  const afterCaptureLoss = await interactionStats(page, planet.id);
  assert.equal(afterCaptureLoss.activeMode, "idle",
    `${planet.id}: capture loss must stop the drag`);
  assert.equal(afterCaptureLoss.pendingPointer, false,
    `${planet.id}: capture loss must clear the pointer`);
  assert.equal(afterCaptureLoss.starts, releasedPointer.starts,
    `${planet.id}: capture loss must not launch inertia`);

  await profile.setCamera(page, {
    pitch: bounds.defaultPitch,
    zoom: bounds.defaultZoom,
  });
  await showInteractionPhase(page, "Drag, coast, then double-click fly-to");
  await drag(page, profile.inputSelector, 90, 150);
  assert.equal((await interactionStats(page, planet.id)).activeMode, "inertia",
    `${planet.id}: the fly-to sequence must begin during coast`);
  const poseBeforeFly = await cameraPose(page, planet.id);
  let flyCoordinates = await surfaceFlyCoordinates(page);
  await page.mouse.move(flyCoordinates.surface.x, flyCoordinates.surface.y);
  await page.mouse.down({ clickCount: 1 });
  await page.mouse.up({ clickCount: 1 });
  await page.mouse.down({ clickCount: 2 });
  await page.mouse.up({ clickCount: 2 });
  await waitFrames(page);
  const activeFly = await interactionStats(page, planet.id);
  assert.equal(activeFly.activeMode, "fly-to",
    `${planet.id}: surface double click must enter fly-to`);
  assert.equal(activeFly.activeMotionCount, 1,
    `${planet.id}: fly-to must be the only active camera motion`);
  await page.waitForTimeout(180);
  const poseDuringFly = await cameraPose(page, planet.id);
  assert.notEqual(poseDuringFly.pose.scene, poseBeforeFly.pose.scene,
    `${planet.id}: surface fly-to must visibly rotate the camera`);
  assert.ok(poseDuringFly.zoom > poseBeforeFly.zoom,
    `${planet.id}: surface fly-to must visibly increase zoom`);
  const zoomBeforeFlyWheel = (await profile.camera(page)).zoom;
  await showInteractionPhase(page, "Wheel zoom during fly-to");
  await wheel(page, profile.inputSelector, -40);
  const flyAfterWheel = await interactionStats(page, planet.id);
  assert.equal(flyAfterWheel.activeMode, "idle",
    `${planet.id}: wheel must cancel fly-to before zooming`);
  assert.equal(flyAfterWheel.activeMotionCount, 0,
    `${planet.id}: wheel must leave no pending fly-to callback`);
  assert.equal(flyAfterWheel.surfaceFlyTo.cancels, activeFly.surfaceFlyTo.cancels + 1,
    `${planet.id}: wheel must cancel exactly one flight`);
  assert.deepEqual(flyAfterWheel.lastInterruption, { from: "fly-to", to: "wheel" });
  await page.waitForTimeout(PREPARED_WHEEL_ZOOM.intervalMilliseconds + 50);
  assert.notEqual((await profile.camera(page)).zoom, zoomBeforeFlyWheel,
    `${planet.id}: wheel must still change zoom after stopping the flight`);
  const wheelRest = await cameraPose(page, planet.id);
  await page.waitForTimeout(250);
  assert.deepEqual(await cameraPose(page, planet.id), wheelRest,
    `${planet.id}: fly-to must not resume after wheel zoom stops`);
  assert.equal((await interactionStats(page, planet.id)).surfaceFlyTo.frames,
    flyAfterWheel.surfaceFlyTo.frames, `${planet.id}: canceled flight cannot publish more frames`);

  // Exercise direct pointer interruption separately from wheel takeover.
  await profile.setCamera(page, { pitch: bounds.defaultPitch, zoom: bounds.defaultZoom });
  flyCoordinates = await surfaceFlyCoordinates(page);
  await page.mouse.dblclick(flyCoordinates.surface.x, flyCoordinates.surface.y, { delay: 45 });
  await page.waitForTimeout(180);
  const flyBeforePointer = await interactionStats(page, planet.id);
  assert.equal(flyBeforePointer.activeMode, "fly-to");
  await page.mouse.move(
    flyCoordinates.surface.x,
    flyCoordinates.surface.y,
  );
  await showInteractionPhase(page, "Grab control during fly-to");
  await page.mouse.down();
  await page.mouse.move(
    flyCoordinates.surface.x + 32,
    flyCoordinates.surface.y,
    { steps: 4 },
  );
  await page.waitForTimeout(
    TRACKBALL_DRAG_INERTIA.releaseFreshnessMilliseconds + 20,
  );
  await page.mouse.up();
  const flyAfterDrag = await interactionStats(page, planet.id);
  assert.equal(flyAfterDrag.activeMode, "idle",
    `${planet.id}: a settled direct drag must replace fly-to`);
  assert.equal(flyAfterDrag.activeMotionCount, 0,
    `${planet.id}: drag interruption must leave no competing fly-to`);
  assert.equal(
    flyAfterDrag.surfaceFlyTo.cancels,
    flyBeforePointer.surfaceFlyTo.cancels + 1,
    `${planet.id}: drag must cancel exactly one active fly-to`,
  );
  assert.deepEqual(flyAfterDrag.lastInterruption, {
    from: "fly-to",
    to: "pointer",
  }, `${planet.id}: pointer-down must own the fly-to interruption`);

  await profile.setCamera(page, {
    pitch: bounds.defaultPitch,
    zoom: bounds.defaultZoom,
  });
  flyCoordinates = await surfaceFlyCoordinates(page);
  await showInteractionPhase(page, "Repeated double-click through full arrival");
  const flyBeforeRepeat = await interactionStats(page, planet.id);
  await page.mouse.dblclick(
    flyCoordinates.surface.x,
    flyCoordinates.surface.y,
    { delay: 45 },
  );
  await waitFrames(page);
  await page.mouse.dblclick(
    flyCoordinates.surface.x,
    flyCoordinates.surface.y,
    { delay: 45 },
  );
  await waitFrames(page);
  const repeatedFly = await interactionStats(page, planet.id);
  assert.equal(
    repeatedFly.surfaceFlyTo.starts,
    flyBeforeRepeat.surfaceFlyTo.starts + 2,
    `${planet.id}: repeated double click must restart fly-to from current state`,
  );
  assert.equal(
    repeatedFly.surfaceFlyTo.cancels,
    flyBeforeRepeat.surfaceFlyTo.cancels + 1,
    `${planet.id}: repeated double click must cancel only the prior fly-to`,
  );
  assert.equal(repeatedFly.activeMode, "fly-to",
    `${planet.id}: the newest repeated double click must own the camera`);
  assert.equal(repeatedFly.activeMotionCount, 1,
    `${planet.id}: repeated double click must keep one fly-to only`);
  await page.waitForFunction(id =>
    !window.__cssearthTest.object(id).camera.stats().dragInertia.surfaceFlyTo.active,
  planet.id, { timeout: SURFACE_FLY_TO.durationMilliseconds + 2000 });
  const completedFly = await interactionStats(page, planet.id);
  assert.equal(completedFly.surfaceFlyTo.completions,
    flyBeforeRepeat.surfaceFlyTo.completions + 1,
  `${planet.id}: the replacement fly-to must run through completion`);
  const completedPose = await cameraPose(page, planet.id);
  await waitFrames(page);
  assert.deepEqual(await cameraPose(page, planet.id), completedPose,
    `${planet.id}: completed fly-to must leave the camera at rest`);
  await profile.setCamera(page, {
    pitch: bounds.defaultPitch,
    zoom: bounds.defaultZoom,
  });
  const settled = await interactionStats(page, planet.id);
  assert.equal(settled.activeMode, "idle",
    `${planet.id}: programmatic reset must interrupt the final fly-to`);
  assert.equal(settled.activeMotionCount, 0,
    `${planet.id}: reset must leave no scheduled camera motion`);

  return {
    wheelInterruptedInertia: true,
    wheelZoomRatio,
    wheelAnchorRotationApplied: true,
    pointerStoppedInertia: true,
    captureLossStoppedDrag: true,
    wheelCoexistedWithFlyTo: true,
    dragInterruptedFlyTo: true,
    repeatedDoubleClickRestartedFlyTo: true,
    flyToCompletedAndRested: true,
    activeMotionCount: settled.activeMotionCount,
  };
}

function showInteractionPhase(page: Page, label:string) {
  if (!evidenceDirectory) return;
  return page.evaluate(text => {
    window.__cssearthTest.element("#camera-conformance-label").textContent = text;
  }, label);
}

function interactionStats(page: Page, objectId:string) {
  return page.evaluate((id) =>
    window.__cssearthTest.object(id).camera.stats().dragInertia, objectId);
}

// The object's prepared wheel dolly when its camera is the shared
// perspective projection; null for the scale camera.
function wheelDolly(page: Page, objectId:string) {
  return page.evaluate((id) => {
    const stats = window.__cssearthTest.object(id).camera.stats();
    return stats.projection?.model === "css-perspective-shared-with-sky"
      ? stats.dolly
      : null;
  }, objectId);
}

function cameraDistance(page: Page, objectId:string) {
  return page.evaluate((id) =>
    window.__cssearthTest.object(id).camera.state().distance, objectId);
}

function cameraPose(page: Page, objectId:string) {
  return page.evaluate((id) => {
    const camera = window.__cssearthTest.object(id).camera.state();
    return {
      controlPitch: camera.controlPitch,
      controlYaw: camera.controlYaw,
      // Anchor reprojection can leave sub-nanounit zoom round-off at rest.
      // Rotation and the rendered pose still require exact equality below.
      zoom: Number(camera.zoom.toFixed(9)),
      pose: camera.pose,
    };
  }, objectId);
}

async function proveBreakpointCrossings(page: Page, planet: ObjectEntry, profile: ObjectBrowserProfile, bounds:CameraBounds, baseline:SceneState) {
  const camera = await page.locator(".polycss-camera").elementHandle();
  assert.ok(camera, `${planet.id}: retained camera must exist`);
  const requestedState = {
    pitch: bounds.defaultPitch +
      (bounds.maximumPitch - bounds.defaultPitch) * 0.2,
    zoom: Math.min(bounds.maximumZoom, bounds.defaultZoom + 0.2),
  };
  await profile.setCamera(page, requestedState);
  await waitFrames(page);
  const expected = await profile.camera(page);
  for (let cycle = 0; cycle < 2; cycle += 1) {
    await page.setViewportSize({ width: 820, height: 900 });
    await waitFrames(page);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false,
      `${planet.id}: 820x900 must not overflow horizontally`);
    assert.deepEqual(await profile.camera(page), expected,
      `${planet.id}: 820px mobile mode must preserve camera state`);
    assert.equal(await page.locator(profile.inputSelector).evaluate((node) =>
      getComputedStyle(node).touchAction), MOBILE_TOUCH_ACTION,
    `${planet.id}: 820px must preserve scene touch gestures`);
    await wheel(page, profile.inputSelector, -240);
    assert.ok((await profile.camera(page)).zoom > expected.zoom,
      `${planet.id}: 820px mobile mode must preserve wheel zoom`);
    await profile.setCamera(page, expected);

    await page.setViewportSize({ width: 864, height: 901 });
    await waitFrames(page);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false,
      `${planet.id}: 864x901 must not overflow horizontally`);
    assert.deepEqual(await profile.camera(page), expected,
      `${planet.id}: portrait mobile mode must preserve camera state`);
    assert.equal(await page.locator(profile.inputSelector).evaluate((node) =>
      getComputedStyle(node).touchAction), MOBILE_TOUCH_ACTION,
    `${planet.id}: portrait viewport must preserve scene touch gestures`);

    await page.setViewportSize({ width: 821, height: 720 });
    await waitFrames(page);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false,
      `${planet.id}: 821x720 must not overflow horizontally`);
    assert.deepEqual(await profile.camera(page), expected,
      `${planet.id}: 821px landscape desktop mode must preserve camera state`);
    assert.equal(await page.locator(profile.inputSelector).evaluate((node) =>
      (node as HTMLElement).style.touchAction), "",
    `${planet.id}: 821px landscape must remove the mobile touch override`);
    await wheel(page, profile.inputSelector, -240);
    assert.ok((await profile.camera(page)).zoom > expected.zoom,
      `${planet.id}: 821px landscape desktop mode must restore wheel zoom`);
    await profile.setCamera(page, expected);
  }
  assert.equal(await page.evaluate(({ node }) =>
    node === document.querySelector(".polycss-camera"), { node: camera }), true,
  `${planet.id}: breakpoint changes must preserve camera identity`);
  const after = await sceneState(page, profile);
  assert.equal(after.stageElements, baseline.stageElements,
    `${planet.id}: breakpoint changes must not grow retained DOM`);
  assert.equal(after.stageChildren, baseline.stageChildren,
    `${planet.id}: breakpoint changes must not remount scene roots`);
  assert.equal(after.stable, true,
    `${planet.id}: breakpoint changes must preserve retained identity`);
}

async function proveMobile(browser: Browser, planet: ObjectEntry, profile: ObjectBrowserProfile) {
  const page = await createTestPage(browser, { viewport: { width: 390, height: 844 } });
  const evidence = observePage(page, baseUrl);
  try {
    await loadPlanet(page, planet, profile);
    const state = await sceneState(page, profile);
    assertSceneStructure(state, planet.id);
    assert.equal(await page.locator(profile.inputSelector).evaluate((node) =>
      getComputedStyle(node).touchAction), MOBILE_TOUCH_ACTION,
    `${planet.id}: narrow screens must preserve scene touch gestures`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390,
      `${planet.id}: narrow screens must not overflow horizontally`);

    const bounds = await profile.bounds(page);
    const current = await profile.camera(page);
    await profile.setCamera(page, {
      pitch: bounds.defaultPitch,
      zoom: current.zoom,
    });
    await wheel(page, profile.inputSelector, -240);
    const afterWheel = await profile.camera(page);
    assert.ok(afterWheel.zoom > current.zoom,
      `${planet.id}: narrow screens must preserve wheel zoom`);
    assert.equal(await profile.stable(page), true,
      `${planet.id}: mobile input policy must preserve retained nodes`);
    assertEvidence(evidence, planet.id);
    return { id: planet.id, viewport: "mobile", ...state };
  } finally {
    await page.close();
  }
}

async function loadPlanet(page: Page, planet: ObjectEntry, profile: ObjectBrowserProfile) {
  const response = await page.goto(new URL(planet.route, baseUrl).href, {
    waitUntil: "networkidle",
  });
  assert.equal(response?.status(), 200, `${planet.id}: route must return 200`);
  await assertRenderedObjectControls(page, profile);
  await page.waitForFunction(() => window.__cssEarth?.ready === true);
  await profile.waitForRuntime(page);
  await assertStandaloneMoonContract(page, planet);
}

async function assertStandaloneMoonContract(page: Page, planet: ObjectEntry) {
  const evidence = await page.evaluate(({ id }) => {
    const stage = window.__cssearthTest.element(".planet-stage");
    return {
      moonControlCount: document.querySelectorAll('input[name="moons"]').length,
      embeddedMoonNodeCount: id === "moon" ? 0 : stage?.querySelectorAll(
        '[class*="moon"], [data-moon-id], [data-moon]',
      ).length ?? 0,
      moonSceneRequests: id === "moon" ? [] : performance
        .getEntriesByType("resource")
        .map(({ name }) => new URL(name).pathname)
        .filter((pathname) =>
          pathname.startsWith(`/scenes/${id}/`) && /moon/iu.test(pathname)),
    };
  }, { id: planet.id });
  assert.equal(evidence.moonControlCount, 0,
    `${planet.id}: satellites are standalone objects, not parent-scene controls`);
  assert.equal(evidence.embeddedMoonNodeCount, 0,
    `${planet.id}: parent scenes must not mount embedded moon DOM`);
  assert.deepEqual(evidence.moonSceneRequests, [],
    `${planet.id}: parent scenes must not request moon presentation assets`);
}

async function enableMotion(page: Page, id:string) {
  const panel = page.locator(".planet-settings-panel");
  const action = page.locator(".planet-settings-action");
  const motion = page.locator(".planet-motion-setting");
  assert.equal(await motion.isChecked(), false,
    `${id}: desktop motion must be off by default`);
  const settingsHidden = await action.evaluate(button => window.__cssearthTest.htmlElement(button).hidden);
  if (settingsHidden) {
    assert.equal(await panel.isVisible(), false,
      `${id}: hidden Settings must leave its panel closed`);
    // Settings is intentionally hidden. Exercise its retained input handler,
    // as the pre-ready cases do, without changing the shell's visibility.
    await motion.evaluate(input => window.__cssearthTest.htmlElement(input).click());
  } else {
    await action.click();
    assert.equal(await panel.isVisible(), true,
      `${id}: settings action must open the settings panel`);
    await page.locator(".planet-motion-setting-control").click();
  }
  await page.waitForFunction(() => window.__cssEarth?.lifecycle === "mounted");
  assert.equal(await motion.isChecked(), true,
    `${id}: motion setting must resume the scene`);
  if (!settingsHidden) {
    await page.keyboard.press("Escape");
    assert.equal(await panel.isVisible(), false, `${id}: Escape must close settings`);
  }
  return settingsHidden ? "retained-input" : "visible-settings";
}

async function sceneState(page: Page, profile: ObjectBrowserProfile) {
  const state = await page.evaluate(() => {
    const stage = window.__cssearthTest.element(".planet-stage");
    return {
      mountedPlanets: window.__cssEarth?.mountedObjectCount,
      stageCount: document.querySelectorAll(".planet-stage").length,
      cameraCount: stage?.querySelectorAll(".polycss-camera").length,
      canvasCount: document.querySelectorAll("canvas").length,
      sceneSvgCount: stage?.querySelectorAll("svg").length,
      stageChildren: stage?.childElementCount,
      stageElements: stage?.querySelectorAll("*").length,
    };
  });
  return { ...state, stable: await profile.stable(page) };
}

function assertSceneStructure(state:SceneState, id:string) {
  assert.equal(state.mountedPlanets, 1, `${id}: exactly one planet must mount`);
  assert.equal(state.stageCount, 1, `${id}: exactly one stage must exist`);
  assert.equal(state.cameraCount, 1, `${id}: exactly one camera must exist`);
  assert.equal(state.canvasCount, 0, `${id}: canvas is forbidden`);
  assert.equal(state.sceneSvgCount, 0, `${id}: scene SVG is forbidden`);
  assert.equal(state.stable, true, `${id}: retained nodes must be stable`);
}

async function drag(page: Page, selector:string, deltaX:number, deltaY:number) {
  assert.ok(await page.locator(selector).isVisible(),
    `Input surface is not visible: ${selector}.`);
  const box = await page.locator(".planet-stage .polycss-camera").boundingBox();
  assert.ok(box, "Retained camera must be visible for a planet drag.");
  const x = box.x + box.width * 0.5;
  const y = box.y + box.height * 0.5;
  await page.mouse.move(x, y);
  await page.mouse.down();
  // A changing final movement launches a throw; uniform steps intentionally do not.
  await page.mouse.move(x + deltaX * .7, y + deltaY * .7, { steps: 10 });
  await page.mouse.move(x + deltaX, y + deltaY);
  await page.mouse.up();
}

async function wheel(page: Page, selector:string, deltaY:number) {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box, `Input surface is not visible: ${selector}.`);
  // A viewport fraction can land in empty sky for a small object. Exercise
  // the surface anchor using the same measured on-disc point as fly-to.
  const { surface } = await surfaceFlyCoordinates(page);
  await page.mouse.move(surface.x, surface.y);
  await page.mouse.wheel(0, deltaY);
  await waitFrames(page);
}

async function beginZoomPublicationProbe(page: Page) {
  await page.evaluate(() => {
    const targets = Object.freeze(Object.fromEntries(Object.entries({
      skyCube: document.querySelector(".planet-cubic-sky-cube"),
      skyOrientation: document.querySelector(
        ".planet-cubic-sky-orientation",
      ),
    }).filter(([, node]) => node !== null)));
    const counts = Object.fromEntries(
      Object.keys(targets).map((key) => [key, 0]),
    );
    const consume = (records:MutationRecord[]) => {
      for (const record of records) {
        const key = Object.entries(targets).find(
          ([, target]) => target === record.target,
        )?.[0];
        if (key) counts[key] += 1;
      }
    };
    const observer = new MutationObserver(consume);
    observer.observe(window.__cssearthTest.element(".planet-stage"), {
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden", "style"],
    });
    window.__zoomPublicationProbe = { observer, consume, counts };
  });
}

async function finishZoomPublicationProbe(page: Page) {
  return page.evaluate(() => {
    const probe = window.__cssearthTest.required(window.__zoomPublicationProbe,"zoom probe");
    probe.consume(probe.observer.takeRecords());
    probe.observer.disconnect();
    delete window.__zoomPublicationProbe;
    return probe.counts;
  });
}

function waitFrames(page: Page) {
  return page.evaluate(() => new Promise<number>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

function observePage(page: Page, localBaseUrl:string) {
  const problems:string[] = [];
  const externalRequests:string[] = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      problems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error instanceof Error ? error.message : String(error)}`));
  page.on("request", (request) => {
    const requestUrl = new URL(request.url());
    const localUrl = new URL(localBaseUrl);
    if (requestUrl.origin !== localUrl.origin) externalRequests.push(request.url());
  });
  return { problems, externalRequests };
}

function assertEvidence({ problems, externalRequests }:ReturnType<typeof observePage>, id:string) {
  assert.deepEqual(problems, [], `${id}: browser must report no problems`);
  assert.deepEqual(externalRequests, [], `${id}: browser must make no external requests`);
}

function setDocumentVisibility(page: Page, hidden:boolean) {
  return page.evaluate((nextHidden) => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: nextHidden,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);
}
