// Real compositor frames with the prepared diagnostic atlas, never pose replay.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import sharp from "sharp";
import { BASE_TILE } from "@layoutit/polycss";
import { PREPARED_MARS_SCENE } from "../../src/planets/mars/runtime/preparedScene.mjs";
import { PREPARED_MARS_CAMERA } from "../../src/planets/mars/runtime/preparedCamera.mjs";
import { decodeNativeMotionTrace } from "../../src/planets/mars/tools/oracle/google-earth-pro/native-motion-trace-reader.mjs";
import { renderedMotionSteps } from "./rendered-motion-steps.mjs";
import { assertMotionOnlyReference } from "../../src/planets/mars/tools/oracle/google-earth-pro/interaction-suite-analysis.mjs";

const root = resolve(import.meta.dirname, "../..");
const browserUrl = process.env.CSS_EARTH_CAPTURE_URL ??
  "http://127.0.0.1:4210/mars/";
const evidenceRoot = process.env.CSS_EARTH_EVIDENCE_ROOT
  ? resolve(process.env.CSS_EARTH_EVIDENCE_ROOT)
  : root;
const [nativeArgument, outputArgument, timingMode = "paired"] = process.argv.slice(2);
assert.ok(["paired", "normal", "motion-only", "frame-locked"].includes(timingMode));
const motionOnly = timingMode === "motion-only";
const naturalClock = timingMode === "normal" || motionOnly;
assert.ok(nativeArgument && outputArgument, "Provide native report and fresh output directory.");
const native = JSON.parse(await readFile(resolve(nativeArgument)));
const nativeInputStart = native.inputs.find(event =>
  event.event === "native-input-batch-accepted" &&
  event.revision === (native.revision ?? 100)).acceptedMonotonicSeconds;
const nativeEndMilliseconds = (Math.max(...native.frames.map(frame =>
  frame.monotonicSeconds)) - nativeInputStart) * 1000;
const gesture = native.consumedGesture ?? native.gesture.map(event => {
  const accepted = native.inputs.find(input => input.event === "native-input-accepted" &&
    input.id === event.id);
  assert.ok(accepted, `Missing native delivery time for ${event.id}.`);
  return {...event, atMilliseconds:(accepted.acceptedMonotonicSeconds-nativeInputStart)*1000};
});
if (motionOnly) assertMotionOnlyReference(native);
const nativeTrace = decodeNativeMotionTrace(await readFile(native.nativeMotionTrace ?? resolve(nativeArgument, "../motion.bin")));
const nativeStart = nativeTrace.frames.find(f => f.frameSequence === native.frames[0].presentIndex);
assert.ok(nativeStart?.matricesCaptured);
const nativeStartPerspective = -nativeStart.modelViewMatrix[14] *
  PREPARED_MARS_SCENE.geometry.equatorialRadius * BASE_TILE;
const out = resolve(outputArgument);
const browserViewport={width:native.viewport.contentWidth,height:native.viewport.height};
const browserCrop={...native.crop,left:native.crop.left+native.viewport.sceneLeft*native.viewport.deviceScaleFactor};
const focalLength=nativeStart.projectionMatrix[5]*native.viewport.height/2;
const cameraOffset={x:-nativeStart.modelViewMatrix[12]/nativeStart.modelViewMatrix[14]*focalLength,
  y:nativeStart.modelViewMatrix[13]/nativeStart.modelViewMatrix[14]*focalLength};
// An off-center body does not move the optical center. Bind both once from
// the initial native view, rather than translating its projected image alone.
const bodyRadius=PREPARED_MARS_SCENE.geometry.equatorialRadius*BASE_TILE;
// Scene scale affects XY before perspective; prepared depth is unscaled.
const modelPerspectiveOriginOffset={x:-nativeStart.modelViewMatrix[12]*bodyRadius*PREPARED_MARS_CAMERA.sceneScale,
  y:nativeStart.modelViewMatrix[13]*bodyRadius*PREPARED_MARS_CAMERA.sceneScale};
assert.ok(out.startsWith(resolve(root, "output/playwright") + "/"));
await mkdir(resolve(out, "frames"), { recursive: true });
const calRoot = resolve(evidenceRoot,
  ".local/oracles/google-earth-pro/calibration");
const atlasManifest = JSON.parse(await readFile(resolve(calRoot, "css-earth/manifest.json")));
assert.equal(native.calibrationSha256, atlasManifest.sourceDecodedRgbaSha256);
const registration = JSON.parse(await readFile(resolve(evidenceRoot,
  "output/playwright/google-earth-pro-mars-interaction-video-v1/browser-registration/registration.json")));
const endpoint = registration.densities[0].captures.find(c =>
  c.nativeCamera.latitude === native.startCamera.latitude &&
  c.nativeCamera.longitude === native.startCamera.longitude).browserEndpoint;
const surface = "/__cssmars_oracle/mars-calibration-surface@2x.png";
const poles = "/__cssmars_oracle/mars-calibration-poles@2x.png";
const resources = [];
for (const [id, url] of [["projective-surface-2x", surface], ["polar-atlas-2x", poles]]) {
  const descriptor = atlasManifest.atlases.find(a => a.id === id);
  const bytes = await readFile(resolve(calRoot, descriptor.path));
  assert.equal(hash(bytes), descriptor.encodedSha256);
  resources.push({ descriptor, url, bytes });
}
const frames = [], dispatches = [], writes = [], failures = [];
const codeResources = [], codeWrites = [];
const captureToolSha256 = hash(await readFile(new URL(import.meta.url)));
const browser = await chromium.launch({ headless: true, channel: "chrome",
  args:[`--force-device-scale-factor=${native.viewport.deviceScaleFactor}`] });
let recording = false;
try {
  const context = await browser.newContext({
    viewport: browserViewport,
    deviceScaleFactor: native.viewport.deviceScaleFactor,
    colorScheme: "dark",
  });
  if (["paired", "frame-locked"].includes(timingMode) && native.nativeFrameClock?.length) await context.addInitScript(() => {
    const request=window.requestAnimationFrame.bind(window);
    const cancel=window.cancelAnimationFrame.bind(window);
    const pending=new Map();let id=0,handle=null,replaying=false;
    const pump=time=>{handle=null;const callbacks=[...pending.values()];pending.clear();for(const callback of callbacks)callback(time);window.__motionFrameObserved?.(time);schedule();};
    const schedule=()=>{if(!replaying&&handle===null&&pending.size)handle=request(pump);};
    window.requestAnimationFrame=callback=>{const key=++id;pending.set(key,callback);schedule();return key;};
    window.cancelAnimationFrame=key=>{pending.delete(key);if(!pending.size&&handle!==null){cancel(handle);handle=null;}};
    window.__lockMotionFrames=()=>{replaying=true;if(handle!==null)cancel(handle);handle=null;};
    window.__pumpMotionFrame=timestamp=>pump(timestamp);
    // Replay only the observed clock and input stream, never camera poses.
    window.__beginMotionClock=(frames,events,epoch,viewport)=>new Promise(resolve=>{
      replaying=true;if(handle!==null)cancel(handle);handle=null;
      let callbackMilliseconds=frames[0].atMilliseconds-frames[0].periodMilliseconds;
      const queue=[...frames.map(frame=>({...frame,tick:true,
        callbackMilliseconds:callbackMilliseconds+=frame.periodMilliseconds})),...events].sort((a,b)=>a.atMilliseconds-b.atMilliseconds);
      const log=[];let cursor=0;
      const advance=()=>{
        const due=performance.timeOrigin+performance.now()-epoch;
        while(cursor<queue.length&&queue[cursor].atMilliseconds<=due+.1){
          const event=queue[cursor++];
          if(event.tick){
            window.__motionClockTimestamp=epoch+event.atMilliseconds;
            pump(epoch+event.callbackMilliseconds-performance.timeOrigin);continue;
          }
          const x=event.x*viewport.contentWidth,y=event.y*viewport.height;
          const input=event.kind==='wheel'?new WheelEvent('wheel',{
            bubbles:true,cancelable:true,clientX:x,clientY:y,deltaY:-event.deltaY,deltaMode:0}):new PointerEvent(event.kind==='up'?'pointerup':event.kind==='down'?'pointerdown':'pointermove',{
            bubbles:true,cancelable:true,pointerId:1,isPrimary:true,pointerType:'mouse',
            clientX:x,clientY:y,button:['up','down'].includes(event.kind)?0:-1,buttons:event.kind==='up'?0:1});
          Object.defineProperty(input,'timeStamp',{value:epoch+event.atMilliseconds-performance.timeOrigin});
          const before=performance.timeOrigin+performance.now()-epoch;
          document.querySelector('.planet-stage').dispatchEvent(input);
          if(event.kind==='up'&&event.clickCount===2)document.querySelector('.planet-stage').dispatchEvent(new MouseEvent('dblclick',{
            bubbles:true,cancelable:true,clientX:x,clientY:y,button:0,detail:2}));
          log.push({...event,x,y,before,returned:performance.timeOrigin+performance.now()-epoch});
        }
        if(cursor<queue.length)setTimeout(advance,Math.max(0,epoch+queue[cursor].atMilliseconds-performance.timeOrigin-performance.now()));
        else{replaying=false;delete window.__motionClockTimestamp;schedule();resolve(log);}
      };
      advance();
    });
  });
  else if (timingMode === "paired" && native.presentHz === 30) await context.addInitScript(() => {
    // Controlled comparison cadence; inputs still drive the normal camera.
    const request=window.requestAnimationFrame.bind(window);
    const cancel=window.cancelAnimationFrame.bind(window);
    const pending=new Map();let id=0,handle=null,last=-Infinity;
    const schedule=()=>{if(handle===null&&pending.size)handle=request(pump);};
    const pump=time=>{
      handle=null;
      if(time-last>=1000/30-.5){last=time;const callbacks=[...pending.values()];pending.clear();for(const callback of callbacks)callback(time);}
      schedule();
    };
    window.requestAnimationFrame=callback=>{const key=++id;pending.set(key,callback);schedule();return key;};
    window.cancelAnimationFrame=key=>{pending.delete(key);if(!pending.size&&handle!==null){cancel(handle);handle=null;}};
  });
  const page = await context.newPage();
  page.on("response", response => {
    if (!/javascript/.test(response.headers()["content-type"] ?? "")) return;
    codeWrites.push(response.body().then(bytes => codeResources.push({
      url: response.url(), sha256: hash(bytes), bytes: bytes.length,
    })).catch(error => failures.push(`Code response unavailable: ${response.url()}: ${error.message}`)));
  });
  // A dev-server hot reload is not part of the captured interaction.
  await page.routeWebSocket(/.*/, socket=>socket.close());
  page.on("pageerror", error => failures.push(error.message));
  const preparedSceneRoot = resolve(evidenceRoot, "public/scenes");
  await page.route("**/scenes/**", async route => {
    const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
    const preparedPath = resolve(evidenceRoot, "public", `.${pathname}`);
    assert.ok(preparedPath.startsWith(`${preparedSceneRoot}/`),
      "Prepared scene request escaped its evidence root.");
    const contentType = pathname.endsWith(".webp") ? "image/webp"
      : pathname.endsWith(".png") ? "image/png"
        : pathname.endsWith(".svg") ? "image/svg+xml"
          : "application/octet-stream";
    await route.fulfill({ contentType, body:await readFile(preparedPath) });
  });
  for (const { url, bytes } of resources) await page.route(`**${url}`,
    route => route.fulfill({ contentType: "image/png", body: bytes }));
  await page.goto(browserUrl, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__mars?.ready === true);
  const cameraPresentationScale = await page.evaluate(() => {
    const camera = document.querySelector(".polycss-camera");
    const bounds = camera.getBoundingClientRect();
    return bounds.width / camera.offsetWidth;
  });
  assert.ok(Number.isFinite(cameraPresentationScale) &&
    cameraPresentationScale > 0);
  const cameraPresentationOffset = {
    x: cameraOffset.x,
    y: cameraOffset.y,
  };
  const inputPerspectiveOriginOffset = {
    x: -cameraOffset.x / cameraPresentationScale,
    y: -cameraOffset.y / cameraPresentationScale,
  };
  const cdp = await context.newCDPSession(page);
  await cdp.send("DOM.enable"); await cdp.send("CSS.enable"); await cdp.send("Page.enable");
  const tree = await cdp.send("Page.getFrameTree");
  const { styleSheetId } = await cdp.send("CSS.createStyleSheet", { frameId: tree.frameTree.frame.id });
  await cdp.send("CSS.setStyleSheetText", { styleSheetId, text: `
    body > :not(.planet-stage) { display:none!important; }
    .planet-stage { inset:0 0 0 ${native.viewport.sceneLeft}px!important; position:fixed!important; width:${native.viewport.width}px!important; height:100%!important; transform:none!important; translate:none!important; rotate:none!important; scale:none!important; }
    .planet-stage > .planet-render-root { translate:${cameraPresentationOffset.x}px ${cameraPresentationOffset.y}px!important; }
    .polycss-camera { translate:${cameraPresentationOffset.x}px ${cameraPresentationOffset.y}px!important;
      perspective-origin:calc(50% + ${inputPerspectiveOriginOffset.x}px) calc(50% + ${inputPerspectiveOriginOffset.y}px)!important; }
    .mars-body > s:not(.mars-pole) { background-image:url("${surface}")!important; }
    .mars-body > .mars-pole { background-image:url("${poles}")!important; }
    .mars-material-counter,.mars-moon-orbit,.planet-directional-sun,
    .planet-cubic-sky { display:none!important; }
    .planet-render-root,.polycss-scene,.mars-system,.mars-body,.mars-body > s { pointer-events:auto!important; }
    *,*::before,*::after { animation:none!important; transition:none!important; }
  ` });
  await page.evaluate(async ({ surface, poles }) => {
    await Promise.all([surface, poles].map(url => { const im = new Image(); im.src = url; return im.decode(); }));
    const motion = document.querySelector('.planet-motion-setting');
    if (motion?.checked) {
      motion.checked = false;
      motion.dispatchEvent(new Event('change', { bubbles:true }));
    }
    for (const animation of document.getAnimations()) { animation.currentTime = 0; animation.pause(); }
  }, { surface, poles });
  const setView = async zoom => {
    await page.evaluate(({ endpoint, zoom }) => {
      window.__mars.setView({ controlPitch: endpoint.controlPitch, controlYaw: endpoint.controlYaw, zoom });
      const original = window.__mars.view().pose;
      const roll = new DOMMatrix().rotateAxisAngle(0, 0, 1, endpoint.screenRollDegrees);
      const pose = { schema:original.schema };
      for (const key of ["scene", "skybox", "sunView"]) pose[key] =
        roll.multiply(new DOMMatrix(original[key])).toString();
      window.__mars.setView({ pose });
    }, { endpoint, zoom });
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  };
  const nativeInitial = await readRaster(native.initialFrame ?? native.frames[0].path);
  const nativeDisc = disc(nativeInitial);
  const nativeReferenceRadius = focalLength / Math.sqrt(nativeStart.modelViewMatrix[14] ** 2 - 1);
  let zoom = 1;
  const calibration = [];
  for (let i = 0; i < 6; i++) {
    await setView(zoom);
    const measured = await page.evaluate(async plan => {
      const { measureRetainedPlanetTrackball } = await import('/src/platform/camera-layout.mjs');
      return measureRetainedPlanetTrackball({ stage:document.querySelector('.planet-stage'),
        cameraElement:document.querySelector('.polycss-camera'),
        logicalBodyDiameter:plan.logicalBodyDiameter,sceneScale:plan.sceneScale });
    }, PREPARED_MARS_CAMERA);
    calibration.push({ zoom, surfaceRadius: measured.surfaceRadius, nativeReferenceRadius,
      method: "analytic unit-sphere projection from the native starting matrices; no raster-edge fit" });
    if (Math.abs(measured.surfaceRadius - nativeReferenceRadius) < .005) break;
    zoom *= nativeReferenceRadius / measured.surfaceRadius;
  }
  const initial = await page.screenshot();
  await sharp(initial).extract(browserCrop).png().toFile(resolve(out, "initial.png"));
  const state = await page.evaluate(() => ({
    camera: window.__mars.view(), stats: window.__mars.camera.stats(),
    projection: {
      perspective: Number.parseFloat(getComputedStyle(
        document.querySelector(".polycss-camera")
      ).perspective),
      sceneTransform: getComputedStyle(
        document.querySelector(".polycss-scene")
      ).transform,
    },
    pose: window.__mars.view().pose,
    surface: getComputedStyle(document.querySelector(".mars-body > s")).backgroundImage,
    poles: getComputedStyle(document.querySelector(".mars-pole")).backgroundImage,
    nodes: document.querySelector(".planet-stage").querySelectorAll("*").length,
    projectiveFrames: [...document.querySelectorAll(".mars-body > s")].map(leaf => ({
      transformStyle: getComputedStyle(leaf).transformStyle,
      nestedTexture: Boolean(leaf.querySelector(".polycss-projective-texture")) })),
  }));
  state.trackball = await page.evaluate(async plan => {
    const { measureRetainedPlanetTrackball } = await import('/src/platform/camera-layout.mjs');
    const { googleEarthInteractionTrackball } = await import('/src/platform/google-earth-drag-inertia.mjs');
    return googleEarthInteractionTrackball(measureRetainedPlanetTrackball({stage:document.querySelector('.planet-stage'),
      cameraElement:document.querySelector('.polycss-camera'),
      logicalBodyDiameter:plan.logicalBodyDiameter,sceneScale:plan.sceneScale,
      zoom:window.__mars.view().zoom,defaultZoom:plan.defaultZoom}));
  }, PREPARED_MARS_CAMERA);
  assert.ok(state.projectiveFrames.length > 0);
  assert.ok(state.projectiveFrames.every(frame => frame.transformStyle === "preserve-3d" && !frame.nestedTexture),
    "Prepared surface pixels must use a single retained projection plane.");
  assert.ok(Math.abs(state.trackball.centerX - (native.viewport.sceneLeft + native.viewport.width/2 + cameraOffset.x)) < .05,
    "Comparison body center drifted horizontally from the native viewport");
  assert.ok(Math.abs(state.trackball.centerY - (native.viewport.height/2 + cameraOffset.y)) < .05,
    "Comparison body center drifted vertically from the native viewport");
  if (timingMode === "frame-locked") {
    const steps = renderedMotionSteps(native,
      (await readFile(native.consumedInputEvidence.historyPath,"utf8")).trim().split("\n").map(JSON.parse),
      (await readFile(native.consumedInputEvidence.timingPath,"utf8")).trim().split("\n").map(l=>l.split("\t").map(Number)));
    const epoch = Date.now();
    const base = await page.evaluate(() => {
      window.__lockMotionFrames();
      const marker=document.createElement("div");
      marker.style.cssText="display:block!important;position:fixed;left:0;top:0;width:64px;height:4px;z-index:2147483647;pointer-events:none";
      for(let bit=0;bit<16;bit++) { const cell=document.createElement("span");
        cell.style.cssText=`position:absolute;left:${bit*4}px;top:0;width:4px;height:4px;background:black`;
        marker.append(cell); }
      document.body.append(marker);
      window.__frameMarker=marker;
      window.__frameReceivedInputs=[];
      for(const type of ['pointerdown','pointerup','pointermove','mousedown','dblclick'])
        document.querySelector('.planet-stage').addEventListener(type,e=>{
          if(e.isTrusted && window.__frameInputTimestamp!==undefined)
            Object.defineProperty(e,'timeStamp',{value:window.__frameInputTimestamp});
          window.__frameReceivedInputs.push({type:e.type,x:e.clientX,y:e.clientY,timestamp:e.timeStamp,trusted:e.isTrusted});
        },true);
      return performance.now();
    });
    const dispatchInput = async (event,step) => {
        const x=event.x*native.viewport.contentWidth,y=event.y*native.viewport.height;
        if(event.kind==='down'||event.kind==='up') {
          await page.evaluate(t=>window.__frameInputTimestamp=t,base+event.atMilliseconds);
          await cdp.send('Input.dispatchMouseEvent',{type:event.kind==='down'?'mousePressed':'mouseReleased',
            x,y,button:'left',buttons:event.kind==='down'?1:0,clickCount:event.clickCount??1});
        } else await page.evaluate(({x,y,timestamp,event})=>{
          const input=event.kind==='wheel'?new WheelEvent('wheel',{
            bubbles:true,cancelable:true,clientX:x,clientY:y,
            deltaY:-event.deltaY,deltaMode:event.deltaMode??0}):new PointerEvent('pointermove',{
            bubbles:true,cancelable:true,pointerId:1,isPrimary:true,pointerType:'mouse',
            clientX:x,clientY:y,button:-1,buttons:1});
          Object.defineProperty(input,'timeStamp',{value:timestamp});
          document.querySelector('.planet-stage').dispatchEvent(input);
        },{x,y,timestamp:base+(event.callbackMilliseconds??event.atMilliseconds),event});
        dispatches.push({...event,x,y,presentSeconds:step.presentSeconds});
    };
    for(const step of steps) {
      // History-bound drag presses precede their recorded camera update;
      // receipt-only pointer edges can follow it. Both retain the measured
      // source frame period.
      for(const event of step.events.filter(e=>e.beforeTick||
        (!e.afterTick&&e.kind==='down'))) await dispatchInput(event,step);
      if(step.tick) await page.evaluate(t=>window.__pumpMotionFrame(t),base+step.callbackMilliseconds);
      for(const event of step.events.filter(e=>e.afterTick||
        (!e.beforeTick&&e.kind!=='down'))) await dispatchInput(event,step);
      for(const sourceFrame of step.captures) {
        const id=frames.length+1;
        const before=await page.evaluate(id=>{
          for(let bit=0;bit<16;bit++)window.__frameMarker.children[bit].style.background=(id>>bit)&1?'white':'black';
          const view=window.__mars.view();return{pose:view.pose,zoom:view.zoom,
            interaction:window.__mars.camera.stats().dragInertia};
        },id);
        const bytes=await page.screenshot();
        const after=await page.evaluate(()=>({pose:window.__mars.view().pose,zoom:window.__mars.view().zoom}));
        assert.deepEqual(after,{pose:before.pose,zoom:before.zoom},'Camera changed during capture');
        const raster=await sharp(bytes).removeAlpha().raw().toBuffer({resolveWithObject:true});
        const dpr=native.viewport.deviceScaleFactor;
        let observed=0;
        for(let bit=0;bit<16;bit++) {
          const p=(Math.floor(2*dpr)*raster.info.width+Math.floor((bit*4+2)*dpr))*3;
          const value=raster.data[p];assert.ok(value===0||value===255,'Frame marker is not exact');
          if(value===255)observed|=1<<bit;
        }
        assert.equal(observed,id,'Screenshot contains an older compositor frame');
        const path=resolve(out,'frames',`frame_${String(frames.length).padStart(6,'0')}.png`);
        await writeFile(path,bytes);
        frames.push({index:frames.length,nativeIndex:sourceFrame.index,nativePresentIndex:sourceFrame.presentIndex,
          timestamp:(epoch+(sourceFrame.monotonicSeconds-nativeInputStart)*1000)/1000,path,sha256:hash(bytes),
          marker:id,pose:before.pose,zoom:before.zoom,interaction:before.interaction,
          historyLength:step.historyLength,launched:step.launched});
      }
    }
    assert.equal(frames.length,native.frames.length);
    await Promise.all(codeWrites);
    await writeFile(resolve(out,'report.json'),JSON.stringify({
      qualification:'INPUT_STEP_PAIRED_RENDERING_NOT_REALTIME_PRESENTATION_PARITY',
      captureToolSha256,codeResources,finalNodesScope:'stage',
      finalNodes:await page.locator('.planet-stage *').count(),
      nativeReport:resolve(nativeArgument),calibrationSha256:native.calibrationSha256,
      resources:resources.map(({descriptor})=>descriptor),browser:{version:browser.version(),channel:'chrome',headless:true},
      inputTiming:native.consumedInputEvidence.qualification,
      frameBinding:'native-present-step-and-verified-pixel-marker',timingMode,frameClock:'native frame periods, stepped offline',
      state,epoch,frames,dispatches,failures,endpoint,zoom,
      perspective:state.projection.perspective,nativeStartPerspective,
      receivedPointerEdges:await page.evaluate(()=>window.__frameReceivedInputs),
      viewport:browserViewport,crop:browserCrop,cameraOffset,
      cameraPresentationOffset,cameraPresentationScale,
      modelPerspectiveOriginOffset,inputPerspectiveOriginOffset,
      calibration,nativeDisc,
      projectionBinding:{nativeModelView:nativeStart.modelViewMatrix,nativeProjection:nativeStart.projectionMatrix,
        scope:'native reference matrices; body size, offset and orientation registered; browser retains its prepared lens; no pose replay'},
      final:await page.evaluate(()=>{const v=window.__mars.view();return{...v,pose:v.pose};}),
    },null,2));
    console.log(JSON.stringify({out,frames:frames.length,failures,qualification:'input-step rendering, not realtime timing'}));
    assert.deepEqual(failures, [], "Browser capture contains runtime errors");
  } else {
  await page.evaluate(() => {
    window.__renderedMotionEvents = [];
    for (const type of ["pointerdown", "pointermove", "pointerup", "wheel", "dblclick"]) document.querySelector(".planet-stage").addEventListener(type,
      e => {
        const before = window.__mars.view();
        const record = { type, x:e.clientX, y:e.clientY,
          receivedAt:performance.now(), eventTimestamp:e.timeStamp,
          before: { scene: before.pose.scene, zoom: before.zoom } };
        window.__renderedMotionEvents.push(record);
        queueMicrotask(() => {
          const after = window.__mars.view();
          record.after = { scene: after.pose.scene, zoom: after.zoom };
        });
      }, true);
  });
  cdp.on("Page.screencastFrame", event => {
    void cdp.send("Page.screencastFrameAck", { sessionId: event.sessionId }).catch(() => {});
    if (!recording) return;
    const path = resolve(out, "frames", `frame_${String(frames.length).padStart(6, "0")}.png`);
    frames.push({ index:frames.length, timestamp:event.metadata.timestamp, metadata:event.metadata, path });
    writes.push(writeFile(path, Buffer.from(event.data, "base64")));
  });
  const clock = await page.evaluate(() => ({ timeOrigin:performance.timeOrigin, now:performance.now() }));
  const started = process.hrtime.bigint(), epoch = Date.now();
  await page.evaluate(recordedClock => {
    window.__motionSamples = [];
    window.__motionSampling = true;
    if(recordedClock) {
      window.__motionFrameObserved=timestamp=>{
        if(!window.__motionSampling)return;
        const view=window.__mars.view();
        window.__motionSamples.push({timestamp:window.__motionClockTimestamp??performance.timeOrigin+timestamp,
          callbackTimestamp:timestamp,sampleKind:'animation',pose:view.pose,zoom:view.zoom,
          interaction:window.__mars.camera.stats().dragInertia});
      };
      return;
    }
    const sample = timestamp => {
      if (!window.__motionSampling) return;
      // Observe the published pose after the animation callbacks, not the
      // previous pose from a sampler queued ahead of the inertia callback.
      setTimeout(()=>{
        if(window.__motionSampling) {
          const view=window.__mars.view();
          const observedTimestamp = window.__motionClockTimestamp ??
            performance.timeOrigin + performance.now();
          window.__motionSamples.push({timestamp:observedTimestamp,callbackTimestamp:timestamp,
            sampleKind:'animation',pose:view.pose,zoom:view.zoom,
            interaction:window.__mars.camera.stats().dragInertia});
        }
      },0);
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }, timingMode === "paired" && Boolean(native.nativeFrameClock?.length));
  recording = !motionOnly;
  if (!motionOnly) await cdp.send("Page.startScreencast", { format:"png", everyNthFrame:1,
    maxWidth:browserViewport.width * native.viewport.deviceScaleFactor,
    maxHeight:native.viewport.height * native.viewport.deviceScaleFactor });
  let buttons = 0;
  const replayClock = timingMode === "paired" && native.nativeFrameClock?.length;
  // Natural-clock captures use real browser input for every event, including
  // consumed wheel receipts. Pointer replay is only an offline pairing aid.
  const replayPointer = !naturalClock && Boolean(native.consumedGesture);
  for (const event of replayClock || replayPointer ? gesture.slice(0,1) : gesture) {
    const elapsed = Number(process.hrtime.bigint() - started) / 1e6;
    if (elapsed < event.atMilliseconds) await delay(event.atMilliseconds - elapsed);
    if (event.kind === "down") buttons = 1;
    if (event.kind === "up") buttons = 0;
    const x = event.x * native.viewport.contentWidth;
    const y = event.y * native.viewport.height;
    const before = Number(process.hrtime.bigint() - started) / 1e6;
    await cdp.send("Input.dispatchMouseEvent", {
      type: event.kind === "wheel" ? "mouseWheel" : event.kind === "down" ? "mousePressed" : event.kind === "up" ? "mouseReleased" : "mouseMoved",
      x, y, buttons, button: event.kind === "drag" || event.kind === "move" ? "none" : "left",
      clickCount:event.clickCount ?? 1, timestamp:(epoch + event.atMilliseconds) / 1000,
      ...(event.kind === "wheel" ? {deltaX:0,deltaY:-event.deltaY} : {}),
    });
    dispatches.push({ ...event, x, y, before, returned:Number(process.hrtime.bigint() - started) / 1e6 });
  }
  if (replayClock) {
    const delivered=await page.evaluate(({frames,events,epoch,viewport})=>
      window.__beginMotionClock(frames,events,epoch,viewport),{
        frames:native.nativeFrameClock.filter(f=>f.atMilliseconds>gesture[0].atMilliseconds),
        events:gesture.slice(1),epoch,viewport:native.viewport});
    dispatches.push(...delivered);
  } else if (replayPointer) {
    const delivered = await page.evaluate(({events,epoch,contentWidth,sceneLeft,height}) =>
      new Promise(resolve => {
        const log=[];
        for(const [index,event] of events.entries()) setTimeout(()=>{
          const x=event.x*contentWidth,y=event.y*height;
          const type=event.kind==='up'?'pointerup':event.kind==='down'?'pointerdown':'pointermove';
          const input=event.kind==='wheel' ? new WheelEvent('wheel',{
            bubbles:true,cancelable:true,clientX:x,clientY:y,deltaX:0,deltaY:-event.deltaY,
          }) : new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:1,
            isPrimary:true,pointerType:'mouse',clientX:x,clientY:y,
            button:['up','down'].includes(event.kind)?0:-1,
            buttons:event.kind==='up'?0:1});
          Object.defineProperty(input,'timeStamp',{value:epoch+event.atMilliseconds-performance.timeOrigin});
          const before=performance.timeOrigin+performance.now()-epoch;
          document.querySelector('.planet-stage').dispatchEvent(input);
          if(event.kind==='up'&&event.clickCount===2)
            document.querySelector('.planet-stage').dispatchEvent(new MouseEvent('dblclick',{
              bubbles:true,cancelable:true,clientX:x,clientY:y,button:0,detail:2}));
          if(window.__motionSampling) {
            const view=window.__mars.view();
            window.__motionSamples.push({
              timestamp:performance.timeOrigin+performance.now(),
              callbackTimestamp:null,sampleKind:'input',pose:view.pose,
              zoom:view.zoom,
              interaction:window.__mars.camera.stats().dragInertia,
            });
          }
          log.push({...event,x,y,before,returned:performance.timeOrigin+performance.now()-epoch});
          if(index===events.length-1)resolve(log);
        },Math.max(0,epoch+event.atMilliseconds-performance.timeOrigin-performance.now()));
      }),{events:gesture.slice(1),epoch,contentWidth:native.viewport.contentWidth,
        sceneLeft:native.viewport.sceneLeft,height:native.viewport.height});
    dispatches.push(...delivered);
  }
  await delay(Math.max(0, nativeEndMilliseconds - Number(process.hrtime.bigint() - started) / 1e6));
  let stopObservation = null;
  if (naturalClock) {
    await page.waitForFunction(() => {
      const samples = window.__motionSamples;
      const last = samples.at(-1);
      if (!last || last.interaction.activeMotionCount || last.interaction.wheelZoom.active) return false;
      const stable = samples.filter(sample => sample.timestamp >= last.timestamp - 550);
      return stable.length > 1 && last.timestamp - stable[0].timestamp >= 500 &&
        stable.every(sample => sample.pose.scene === last.pose.scene && sample.zoom === last.zoom);
    }, null, { timeout:20000 });
    stopObservation = await page.evaluate(epoch => ({
      method:"published camera unchanged for at least 500 ms with both controllers idle",
      elapsedMilliseconds:performance.timeOrigin+performance.now()-epoch,
      finalSample:window.__motionSamples.at(-1),
    }), epoch);
    // Screencast emits only on damage. Capture an actual resting frame so the
    // video includes the measured quiet interval, even without new damage.
    recording = false;
    const path = resolve(out, "frames", `frame_${String(frames.length).padStart(6, "0")}.png`);
    const before = Date.now();
    await page.screenshot({ path });
    frames.push({ index:frames.length, timestamp:before/1000, path,
      sampleKind:"verified-rest-screenshot", screenshotCompletedAt:Date.now() });
  }
  recording = false;
  const motionSamples = await page.evaluate(() => {
    window.__motionSampling = false;
    return window.__motionSamples;
  });
  if (!motionOnly) await cdp.send("Page.stopScreencast");
  await Promise.all(writes);
  assert.ok(frames.length > 0, "No compositor image was captured.");
  for (const frame of frames) {
    const bytes = await readFile(frame.path), metadata = await sharp(bytes).metadata();
    assert.equal(metadata.width, browserViewport.width * native.viewport.deviceScaleFactor);
    assert.equal(metadata.height, native.viewport.height * native.viewport.deviceScaleFactor);
    frame.sha256 = hash(bytes);
  }
  const inputs = await page.evaluate(() => window.__renderedMotionEvents);
  const finalNodes = await page.locator(".planet-stage *").count();
  assert.equal(finalNodes, state.nodes, "The scene DOM must stay retained during motion.");
  await Promise.all(codeWrites);
  await writeFile(resolve(out, "report.json"), JSON.stringify({
    captureToolSha256, codeResources,
    qualification:motionOnly ? "MOTION_TRACE_WITH_BOUNDARY_IMAGES_NOT_VIDEO" : "RAW_COMPOSITOR_CAPTURE_REQUIRES_PAIRING", nativeReport:resolve(nativeArgument),
    readbackDuringGesture:!motionOnly,
    calibrationSha256:native.calibrationSha256, resources:resources.map(({ descriptor })=>descriptor),
    inputTiming:native.consumedInputEvidence?.qualification ?? "native accepted event timestamps",
    inputTransport:replayPointer
      ? "first pointer edge through CDP; remaining consumed pointer history scheduled in-page on the source clock"
      : "CDP mouse input on the source clock",
    browser:{version:browser.version(),channel:"chrome",headless:true},timingMode,
    controlledCadenceHz:timingMode==="paired"&&!native.nativeFrameClock?.length&&native.presentHz===30?30:null,
    frameClock:replayClock?"recorded native frame durations for callbacks; elapsed clock for input delivery":"browser animation clock",
    nativeEndMilliseconds, stopObservation, endpoint, zoom,
    perspective:state.projection.perspective,nativeStartPerspective,
    projectionBinding:{ nativeModelView:nativeStart.modelViewMatrix,
      nativeProjection:nativeStart.projectionMatrix,
      scope:"native reference matrices; body size, offset and orientation registered; browser retains its prepared lens; no pose replay" },
    calibration, nativeDisc, state, clock, epoch, dispatches, inputs, frames, failures, motionSamples,
    viewport:browserViewport,crop:browserCrop,cameraOffset,
    final:await page.evaluate(() => { const view=window.__mars.view();return {...view,pose:view.pose}; }), finalNodes,
  }, null, 2));
  console.log(JSON.stringify({ out, frames:frames.length, zoom, failures }));
  }
} finally { await browser.close(); }

function hash(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
async function readRaster(path) {
  const b = await readFile(path);
  if (!path.endsWith(".ppm")) return sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject:true });
  const header = /^P6\n(\d+) (\d+)\n255\n/.exec(b.toString("ascii", 0, 64));
  assert.ok(header);
  return { data:b.subarray(header[0].length), info:{ width:+header[1], height:+header[2], channels:3 } };
}
function disc({ data, info:{ width, height, channels } }) {
  let x0=width,x1=-1,y0=height,y1=-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    const i=(y*width+x)*channels, r=data[i],g=data[i+1],b=data[i+2];
    if(Math.max(r,g,b)>35&&Math.max(r,g,b)-Math.min(r,g,b)>18) {
      x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
    }
  }
  assert.ok(x1>=x0,"Calibration disc was not visible.");
  return { x:x0,y:y0,width:x1-x0+1,height:y1-y0+1,cx:(x0+x1)/2,cy:(y0+y1)/2 };
}
