declare global {interface Window {__cacheEvidence:{token:string;shows:boolean[]};}}
import { createTestPage } from './browser-observations.mts';
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { SCENE_OBJECTS } from "../objects.mts";
import { browserObjects } from './browser-objects.mts';

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
// Playwright normally disables BFCache. Allow Chrome to make a real admission
// decision; do not present synthetic pageshow events as cache admission.
const browser = await chromium.launch({ channel: "chrome", headless: true,
  ignoreDefaultArgs: ["--disable-back-forward-cache"] });
const report:{browser:string;capturedAt:string;cases:unknown[]} = { browser: browser.version(), capturedAt: new Date().toISOString(), cases: [] };
try {
  for (const object of browserObjects()) {
    const context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
    try {
      const page = await createTestPage(context);
      const errors:string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript(() => {
        window.__cacheEvidence = { token: Math.random().toString(36), shows: [] };
        addEventListener("pageshow", (event) => window.__cacheEvidence.shows.push(event.persisted));
      });
      await page.goto(new URL(object.route, baseUrl).href);
      await page.waitForFunction(() => window.__cssEarth?.ready);
      await page.locator('input[name="motion"]').evaluate((input) => { if(!(input instanceof HTMLInputElement))throw new Error("Motion input is missing");if (!input.checked) input.click(); });
      const token = await page.evaluate(() => window.__cacheEvidence.token);
      // A same-origin document with no runtime is sufficient to test leaving
      // and returning. It is intercepted locally, not a fake catalog object.
      await page.route("**/runtime-cache-probe", (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Cache probe</title>Back navigation probe" }));
      await page.goto(new URL("/runtime-cache-probe", baseUrl).href);
      await page.goBack({ waitUntil: "commit" });
      await page.waitForFunction(() => window.__cssEarth?.ready);
      const state = await page.evaluate(() => ({
        ...window.__cacheEvidence,
        lifecycle: window.__cssearthTest.scene().lifecycle,
        motion: window.__cssearthTest.input('input[name="motion"]').checked,
        sceneCount: document.querySelectorAll(".planet-stage").length,
        cameraCount: document.querySelectorAll(".polycss-camera").length,
        notRestoredReasons: (()=>{const navigation=performance.getEntriesByType("navigation")[0];const reasons=navigation&&Reflect.get(navigation,"notRestoredReasons");if(!reasons||typeof reasons!=="object")return null;const toJSON=Reflect.get(reasons,"toJSON");return typeof toJSON==="function"?Reflect.apply(toJSON,reasons,[]):null;})(),
      }));
      const admitted = state.shows.at(-1) === true;
      assert.equal(state.sceneCount, 1);
      assert.equal(state.cameraCount, 1);
      if (admitted) {
        assert.equal(state.token, token);
        assert.equal(state.motion, true, `${object.id}: persisted intent`);
        assert.equal(state.lifecycle, "mounted");
      } else {
        assert.notEqual(state.token, token, "An ordinary reload must not be reported as restoration");
        assert.ok(state.notRestoredReasons, "Record Chrome's concrete non-admission reason");
      }
      assert.deepEqual(errors, []);
      report.cases.push({ id: object.id, admitted, ...state });
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
console.log(JSON.stringify(report, null, 2));
