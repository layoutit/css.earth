import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { OBJECTS } from "../objects.mjs";
import { loadPlanetBrowserProfile, assertRenderedObjectControls } from "./load-browser-profile.mjs";
import { installObjectRuntimeProbe, instrumentObjectRuntime } from "./object-runtime-instrumentation.mjs";
import { objectCycleStates } from "../../src/platform/object-runtime-contract.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const objectArgument = process.argv.indexOf("--object");
const selected = objectArgument < 0 ? OBJECTS : OBJECTS.filter(object => object.id === process.argv[objectArgument + 1]);
assert.ok(selected.length, "Select an existing registry object");
const outputArgument = process.argv.indexOf("--output");
const output = resolve(outputArgument < 0 ? `output/playwright/object-runtime-${Date.now()}` : process.argv[outputArgument + 1]);
await mkdir(output, { recursive: true });
const hash = source => createHash("sha256").update(source).digest("hex");
const local = await readFile("src/platform/object-runtime.mjs", "utf8");
const report = { source: hash(local), baseUrl, cases: [], complete: false };
const browser = await chromium.launch({ channel: "chrome", headless: true });
report.browser = browser.version();
try {
  for (const object of selected) for (const deviceScaleFactor of [1, 2]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor });
    const page = await context.newPage();
    const record = { id: object.id, deviceScaleFactor, responses: [], errors: [] };
    report.cases.push(record);
    page.on("pageerror", error => record.errors.push(error.message));
    await context.addInitScript(installObjectRuntimeProbe);
    await page.route("**/src/platform/object-runtime.mjs*", async route => {
      const response = await route.fetch();
      const original = await response.text();
      const instrumented = instrumentObjectRuntime(original);
      record.responses.push({ url: route.request().url(), original: hash(original), instrumented: hash(instrumented) });
      await route.fulfill({ response, body: instrumented });
    });
    try {
      await page.goto(new URL(object.route, baseUrl).href);
      await page.waitForFunction(id => window.__cssEarth?.ready && window[`__${id}`]?.ready === true, object.id);
      const profile = await loadPlanetBrowserProfile(object);
      await assertRenderedObjectControls(page, profile);
      record.ready = await page.evaluate(() => window.__objectRuntimeProbe.inspect());
      for (const kind of ["session", "resources", "playback", "camera", "selection", "controls"]) {
        assert.equal(record.ready.filter(owner => owner.kind === kind && owner.id === object.id).length, 1, `${object.id} actual ${kind} owner`);
      }
      const owned = kind => record.ready.find(owner => owner.kind === kind);
      assert.equal(owned("session").state.disposed, false);
      assert.ok(owned("resources").calls.prepareStartup === 1 && owned("resources").calls.commit >= 1);
      assert.ok(owned("playback").calls.register >= 1 && owned("playback").calls.setReady === 1);
      record.observations = { density: await profile.selectedDensity(page), bounds: await profile.bounds(page),
        camera: await profile.camera(page), stable: await profile.stable(page), retained: await profile.retainedReport(page) };
      assert.equal(record.observations.density, 2);
      assert.equal(record.observations.bounds.defaultZoom, owned("camera").state.defaultZoom);
      assert.equal(record.observations.stable, true);
      assert.equal(record.observations.retained.initialNodeCount, record.observations.retained.stableNodeCount);
      const reads = await page.evaluate(id => {
        const runtime = window[`__${id}`], probe = window.__objectRuntimeProbe;
        const before = probe.inspect().find(owner => owner.kind === "playback").calls;
        const view = runtime.runtime.view(), sky = runtime.sky.state();
        runtime.runtime.resources(); runtime.runtime.selection(); runtime.runtime.controls();
        runtime.runtime.playback(); runtime.settings.state(); runtime.camera.stats(); runtime.material.state();
        const after = probe.inspect().find(owner => owner.kind === "playback").calls;
        delete before.stats; delete after.stats;
        return { before, after, materialSun: view.sunViewDirection, skySun: view.skySunViewDirection,
          observedMaterialSun: sky.sunViewDirection, observedSkySun: sky.skySunViewDirection };
      }, object.id);
      assert.deepEqual(reads.before, reads.after, "Diagnostic reads cannot change playback permission or owners");
      assert.deepEqual(reads.observedMaterialSun, reads.materialSun);
      assert.deepEqual(reads.observedSkySun, reads.skySun);
      record.observations.sun = reads;
      const motion = page.locator('input[name="motion"]');
      await motion.evaluate(input => { if (!input.checked) input.click(); });
      await page.waitForFunction(() => window.__cssEarth.lifecycle === "mounted");
      await page.evaluate(id => {
        window.__lateRuntimeAnimation = new Animation(new KeyframeEffect(document.querySelector(".planet-stage"),
          [{ opacity: 1 }, { opacity: 1 }], { duration: 1000, iterations: Infinity }), document.timeline);
        window.__objectRuntimeProbe.registerNativeAnimation(window.__lateRuntimeAnimation, id);
      }, object.id);
      assert.equal(await page.evaluate(() => window.__lateRuntimeAnimation.playState), "running");
      const beforeGesture = await page.evaluate(id => window[`__${id}`].camera.state(), object.id);
      await page.mouse.move(1000, 450); await page.mouse.down();
      await page.mouse.move(1140, 510, { steps: 8 }); await page.mouse.up();
      await page.waitForFunction(({ id, before }) => {
        const state = window[`__${id}`].camera.state();
        return state.controlPitch !== before.controlPitch || state.controlYaw !== before.controlYaw;
      }, { id: object.id, before: beforeGesture });
      const beforeWheel = await profile.camera(page);
      await page.mouse.wheel(0, -80);
      await page.waitForFunction(({ id, zoom }) => window[`__${id}`].camera.state().zoom !== zoom,
        { id: object.id, zoom: beforeWheel.zoom });
      record.gestures = { before: beforeGesture, after: await page.evaluate(id => window[`__${id}`].camera.state(), object.id) };
      record.actions = [];
      async function action(input, value) {
        const before = await page.evaluate(() => window.__objectRuntimeProbe.inspect().find(owner => owner.kind === "selection").state.commits);
        await input.evaluate((element, selected) => {
          if (element.type === "range") {
            if (element.disabled) throw new Error("Ready speed input must be enabled by the shell.");
            element.value = String(selected);
            element.dispatchEvent(new Event("input", { bubbles: true }));
          } else element.click();
        }, value);
        await page.waitForFunction(previous => {
          const state = window.__objectRuntimeProbe.inspect().find(owner => owner.kind === "selection").state;
          return state.commits > previous && state.pending === false;
        }, before);
        record.actions.push(await page.evaluate(() => window.__objectRuntimeProbe.inspect().find(owner => owner.kind === "selection").state));
      }
      for (const lens of profile.objectControls.lenses?.controls ?? []) {
        await action(page.locator(`button[name="lens"][value="${lens.id}"]`));
      }
      // Destination lenses can legitimately turn shared Motion off. Speed
      // controls require that user intent to be restored before exercising them.
      await motion.evaluate(input => { if (!input.checked) input.click(); });
      await page.waitForFunction(() => window.__cssEarth.lifecycle === "mounted");
      for (const control of profile.objectControls.settings?.controls ?? []) {
        const input = page.locator(`.planet-settings [name="${control.name}"]`);
        if (control.kind === "toggle") await action(input);
        else for (const { value } of objectCycleStates(control)) await action(input, value);
      }
      await motion.evaluate(input => input.click());
      await page.waitForFunction(() => window.__cssEarth.lifecycle === "paused");
      record.playback = await page.evaluate(() => window.__objectRuntimeProbe.inspect());
      assert.ok(record.playback.find(owner => owner.kind === "playback").calls.setAllowed >= 2);
      // The retained document's pagehide path exercises disposal without losing
      // the probe receipts needed to inspect the actual retired owners.
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
      record.retired = await page.evaluate(() => window.__objectRuntimeProbe.inspect());
      assert.equal(await page.evaluate(() => window.__lateRuntimeAnimation.playState), "idle");
      assert.equal(record.retired.find(owner => owner.kind === "resources").state.images.entries.length, 0);
      assert.equal(record.retired.find(owner => owner.kind === "playback").state.registeredCount, 0);
      assert.equal(await profile.runtimePresent(page), false);
      await page.evaluate(id => window.__objectRuntimeProbe.registerNativeAnimation(window.__lateRuntimeAnimation, id), object.id);
      assert.equal(await page.evaluate(() => window.__lateRuntimeAnimation.playState), "idle");
      for (const owner of record.retired) if (["session", "resources", "playback", "camera", "selection", "controls"].includes(owner.kind)) {
        assert.equal(owner.calls.destroy, 1, `${object.id}: one ${owner.kind} disposal`);
      }
      assert.equal(record.retired.find(owner => owner.kind === "session").state.disposed, true);
      assert.deepEqual(record.errors, []);
      record.passed = true;
    } finally { await context.close(); }
  }
  report.complete = true;
} finally {
  await browser.close();
  await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify({ output, cases: report.cases.length, complete: report.complete }));
