import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { OBJECTS } from "../objects.mjs";
import { loadPlanetBrowserProfile, assertRenderedObjectControls } from "./load-browser-profile.mjs";
import { installObjectRuntimeProbe, instrumentObjectRuntime } from "./object-runtime-instrumentation.mjs";
import { objectCycleStates } from "../../src/platform/object-runtime-contract.mjs";
import { installNativeCameraProbe, instrumentNativeCameraModule, instrumentPreparedMaterialModule, observeNativeCameraWrites } from "../../tools/native-camera-probe.mjs";
import { waitForAuditPreparedReadiness } from "../../tools/audit-prepared-readiness.mjs";

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
    const {runtimeDefinition:definition}=await import(`../../src/planets/${object.id}/runtime/definition.mjs`);
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor });
    const page = await context.newPage();
    const record = { id: object.id, deviceScaleFactor, responses: [], errors: [] };
    report.cases.push(record);
    page.on("pageerror", error => record.errors.push(error.message));
    await context.addInitScript(installObjectRuntimeProbe);
    await context.addInitScript(installNativeCameraProbe);
    for(const [pattern,instrument] of [["**/@layoutit_polycss.js*",instrumentNativeCameraModule],["**/src/platform/prepared-material.mjs*",instrumentPreparedMaterialModule]]) {
      await page.route(pattern,async route=>{
        const response=await route.fetch(),original=await response.text(),body=instrument(original);
        record.responses.push({url:route.request().url(),original:hash(original),instrumented:hash(body)});
        await route.fulfill({response,body});
      });
    }
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
      record.native=await page.evaluate(()=>window.__nativeCameraProbe.inspect());
      assert.equal(record.native.nativeCameraCount,1,"One actual native camera factory call");
      assert.deepEqual(record.native.materials,definition.materials.map(({id,target})=>({id,target})),"Actual shared publishers own every prepared material target");
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
      // Debugger pauses prove write ownership, not real-time performance.
      // Pause autonomous playback before installing native breakpoints.
      await motion.evaluate(input => { if (input.checked) input.click(); });
      await page.waitForFunction(() => window.__cssEarth.lifecycle === "paused");
      const beforeGesture = await page.evaluate(id => window[`__${id}`].camera.state(), object.id);
      let nativeWrites=null,nativeProbeOpen=false;
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
      record.actionRequests=[];
      async function action(input, value) {
        if(nativeProbeOpen)await nativeWrites.drain();
        const before = await page.evaluate(() => window.__objectRuntimeProbe.inspect().find(owner => owner.kind === "selection").state);
        const requested=await input.evaluate(element=>({name:element.name,type:element.type,value:element.value,checked:element.checked}));
        const expected={...before.desired,[requested.name==="lens"?"lensId":requested.name]:
          requested.name==="lens"?requested.value:requested.type==="checkbox"?!requested.checked:value};
        record.actionRequests.push({requested,expected});
        // Native input queues the handler after any paused application task.
        // Runtime.callFunctionOn(element.click) could re-enter a paused commit.
        if(requested.type!=="range"){
          // The shell hides checkbox hit targets and lets their retained labels
          // receive pointer input. Clicking that label follows the native path.
          if(requested.type==="checkbox")await input.locator("xpath=..").click();
          else await input.click();
        }
        else {
          assert.equal(nativeProbeOpen,false,"Range mutation requires a closed native debugger window");
          await input.evaluate((element, selected) => {
            if (element.disabled) throw new Error("Ready speed input must be enabled by the shell.");
            element.value = String(selected);
            element.dispatchEvent(new Event("input", { bubbles: true }));
          }, value);
        }
        if(nativeProbeOpen)await nativeWrites.drain();
        await page.waitForFunction(({previous, expected}) => {
          const state = window.__objectRuntimeProbe.inspect().find(owner => owner.kind === "selection").state;
          return state.commits > previous && state.pending === false &&
            Object.entries(expected).every(([key,value]) => state.committed?.[key] === value);
        }, {previous:before.commits,expected});
        record.actions.push(await page.evaluate(() => window.__objectRuntimeProbe.inspect().find(owner => owner.kind === "selection").state));
      }
      for (const lens of profile.objectControls.lenses?.controls ?? []) {
        await profile.enterLensContext(page, lens.id);
        await action(page.locator(`button[name="lens"][value="${lens.id}"]`));
        assert.deepEqual(await page.locator('button[name="lens"][aria-pressed="true"]').evaluateAll(nodes=>nodes.map(node=>node.value)),[lens.id]);
        await waitForAuditPreparedReadiness(page,object.id);
      }
      record.native.writes=[];record.native.failures=[];record.native.windows=[];
      const everyMaterialObserved=()=>definition.materials.every((_,index)=>
        record.native.writes.some(write=>write.target===`material:${index}`));
      // Lens behavior above runs without Debugger pauses. Native ownership uses
      // bounded gesture windows after the real prepared selection and any
      // destination flight have settled. Select witnesses from actual variants;
      // declarations alone never satisfy an observed material target.
      for(const variant of definition.variants){
        if(record.native.windows.length&&everyMaterialObserved())break;
        if(record.native.windows.length&&!variant.materials.some(material=>material.enabled&&
          !record.native.writes.some(write=>write.target===`material:${definition.materials.findIndex(track=>track.id===material.track)}`)))continue;
        if(variant.when.lensId!==undefined){
          await page.locator(".explorer-rail-explore").click();
          await profile.enterLensContext(page, variant.when.lensId);
          await action(page.locator(`button[name="lens"][value="${variant.when.lensId}"]`));
        }
        for(const [name,value] of Object.entries(variant.when)){
          if(name==="lensId")continue;
          await page.locator(".planet-settings-action").click();
          const control=profile.objectControls.settings.controls.find(control=>control.name===name);
          assert.ok(control,"Native material witness uses an actual declared control");
          const input=page.locator(`.planet-settings [name="${name}"]`);
          if(control.kind==="toggle"){
            if(await input.isChecked()!==value)await action(input);
          }else{
            await motion.evaluate(input=>{if(!input.checked)input.click();});
            await action(input,value);
            await motion.evaluate(input=>{if(input.checked)input.click();});
          }
        }
        await waitForAuditPreparedReadiness(page,object.id);
        await profile.setCamera(page,beforeGesture);
        await waitForAuditPreparedReadiness(page,object.id);
        const windowRecord={selection:variant.when,before:await profile.camera(page)};
        record.native.windows.push(windowRecord);
        nativeWrites=await observeNativeCameraWrites(page,{materials:true});
        nativeProbeOpen=true;
        windowRecord.writes=nativeWrites.records;windowRecord.failures=nativeWrites.failures;
        try{
          await page.mouse.move(1000,450);await page.mouse.down();
          await page.mouse.move(1140,510,{steps:8});await page.mouse.up();
          await page.waitForFunction(({id,before})=>{
            const state=window[`__${id}`].camera.state();
            return state.controlPitch!==before.controlPitch||state.controlYaw!==before.controlYaw;
          },{id:object.id,before:windowRecord.before});
          await nativeWrites.drain();
          windowRecord.after=await profile.camera(page);
        }finally{
          await nativeWrites.close();nativeProbeOpen=false;
          record.native.writes.push(...nativeWrites.records);
          record.native.failures.push(...nativeWrites.failures);
        }
      }
      assert.deepEqual(record.native.failures,[]);
      assert.ok(record.native.writes.some(write=>write.target===".polycss-scene"),"Observe actual camera transform publication");
      for(const write of record.native.writes) {
        if(write.target.startsWith("material:"))assert.ok(["prepared-material","prepared-planar-rotation","prepared-presentation"].some(name=>write.stack[0]?.url.includes(`/src/platform/${name}.mjs`)),"The native material setter must execute in a common publisher");
        else {
          const target=write.target===".polycss-camera"?definition.tree.camera:definition.tree.scene;
          const declaredObservation=write.stack[0]?.url.includes("/src/platform/prepared-presentation.mjs") &&
            write.stack[0]?.name==="writeAttribute" && definition.viewBindings.some(binding =>
              binding.kind==="view-attribute" && binding.target===target && binding.property===write.attributeName);
          assert.ok(declaredObservation || write.stack[0]?.url.includes("/src/platform/prepared-camera-runtime.mjs"),
            "The native camera setter must execute in the common publisher; camera attributes must match declared observation bindings");
        }
      }
      for(let index=0;index<definition.materials.length;index++)assert.ok(record.native.writes.some(write=>write.target===`material:${index}`),"Observe every material target after camera movement");
      record.observations.presentation=await page.evaluate(id=>window[`__${id}`].runtime.presentation(),object.id);
      // Destination lenses can legitimately turn shared Motion off. Speed
      // controls require that user intent to be restored before exercising them.
      await motion.evaluate(input => { if (!input.checked) input.click(); });
      await page.waitForFunction(() => window.__cssEarth.lifecycle === "mounted");
      await page.locator(".planet-settings-action").click();
      for (const control of profile.objectControls.settings?.controls ?? []) {
        const input = page.locator(`.planet-settings [name="${control.name}"]`);
        if (control.kind === "toggle") await action(input);
        else for (const { value } of objectCycleStates(control)) await action(input, value);
      }
      record.native.after=await page.evaluate(()=>window.__nativeCameraProbe.inspect());
      assert.equal(record.native.after.nativeCameraCount,1,"One actual native camera for the full mounted session");
      assert.deepEqual(record.native.after.materials,definition.materials.map(({id,target})=>({id,target})));
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
    } catch (error) {
      record.failure = {message:error.message, state:await page.evaluate(id => ({
        selection:window[`__${id}`]?.runtime?.selection(),
        resources:window[`__${id}`]?.runtime?.resources(),
        pressed:[...document.querySelectorAll('button[name="lens"][aria-pressed="true"]')].map(node=>node.value),
      }),object.id).catch(()=>null)};
      throw error;
    } finally { await context.close(); }
  }
  report.complete = true;
} finally {
  await browser.close();
  await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify({ output, cases: report.cases.length, complete: report.complete }));
