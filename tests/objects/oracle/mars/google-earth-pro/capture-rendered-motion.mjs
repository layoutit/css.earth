// Real-renderer capture, optionally continuing until the native camera rests.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn, execFile } from "node:child_process";
import { mkdir, readFile, writeFile, rename, open } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import sharp from "sharp";
import { getViewInfo, setViewInfo } from "./controller.mjs";
import { decodeNativeMotionTrace } from "./native-motion-trace-reader.mjs";
import { resolveScenarioEvents } from "./interaction-corpus.mjs";

const exec = promisify(execFile);
const root = resolve(import.meta.dirname, "../../../../..");
const evidenceRoot = resolve(process.env.CSS_EARTH_EVIDENCE_ROOT ?? root);
const [appRootArgument, outputArgument, densityArgument = "2", scenarioArgument] = process.argv.slice(2);
const scenario = scenarioArgument ? JSON.parse(await readFile(resolve(scenarioArgument))) : {};
const seedArguments = scenario.seedAudit ? ["--seed-audit", resolve(scenario.seedAudit)] : [];
const captureMilliseconds = scenario.captureMilliseconds ?? 4000;
assert.ok(captureMilliseconds >= 4000 && captureMilliseconds <= 24000);
assert.ok(appRootArgument && outputArgument, "Provide isolated app root and fresh output directory.");
const deviceScaleFactor = Number(densityArgument);
assert.ok([1, 2].includes(deviceScaleFactor), "Capture density must be one or two.");
const captureSize = scenario.captureSize ?? 350;
assert.ok(Number.isInteger(captureSize) && captureSize > 0 && captureSize <= 600);
const crop = { left:Math.round((693 - captureSize) * deviceScaleFactor / 2),
  top:Math.round((600 - captureSize) * deviceScaleFactor / 2),
  width:captureSize * deviceScaleFactor, height:captureSize * deviceScaleFactor };
const appRoot = resolve(appRootArgument), out = resolve(outputArgument);
const captureToolSha256 = hash(await readFile(new URL(import.meta.url)));
assert.ok(appRoot.startsWith(resolve(evidenceRoot, ".local/oracles") + "/"));
assert.ok(out.startsWith(resolve(root, "output/playwright") + "/"));
const build = JSON.parse(await readFile(resolve(appRoot, "headless-oracle-manifest.json")));
const app = resolve(build.embeddedDylibPath, "../../../../../src/planets/mars");
const executableName = (await exec("/usr/bin/plutil", ["-extract", "CFBundleExecutable",
  "raw", resolve(app, "Contents/Info.plist")])).stdout.trim();
const executablePath = resolve(app, "Contents/MacOS", executableName);
const input = resolve(out, "input.json"), log = resolve(out, "events.jsonl");
const frameDir = resolve(out, "frames");
await mkdir(frameDir, { recursive: true });
await mkdir(resolve(out, "texture-audit"), { recursive: true });
await mkdir(resolve(out, "mapping"), { recursive: true });
await writeFile(resolve(out, "mapping/texture-map.tsv"), "");
const provenMap = JSON.parse(await readFile(resolve(evidenceRoot,
  "output/playwright/google-earth-pro-mars-interaction-video-v1/native-registration/mapping/texture-map.json")));
const mappingKey = await readFile(provenMap.cacheTransform.keyPath);
assert.equal(hash(mappingKey), provenMap.cacheTransform.keySha256);
await writeFile(resolve(out, "mapping/cache-transform-key.bin"), mappingKey);
const processes = (await exec("/bin/ps", ["-axo", "pid=,command="])).stdout;
assert.ok(!processes.split("\n").some(line => line.includes("/Contents/MacOS/" + executableName)),
  "A native reference process already exists; do not start another.");
const calibration = JSON.parse(await readFile(resolve(evidenceRoot,
  ".local/oracles/google-earth-pro/calibration/manifest.json")));
const rgba = await sharp(resolve(evidenceRoot, ".local/oracles/google-earth-pro/calibration",
  calibration.source.path)).toColorspace("srgb").ensureAlpha().raw().toBuffer();
assert.equal(hash(rgba), calibration.source.decodedRgbaSha256);
await writeFile(resolve(out, "master.rgba"), rgba);
const mode = Buffer.alloc(32); mode.write("cal-audit"); mode.writeUInt32LE(1, 20);
await writeFile(resolve(out, "mode.bin"), mode);
const processLog = await open(resolve(out, "process.log"), "wx");
const child = spawn(executablePath, ["-multiple"], {
  cwd: resolve(executablePath, ".."),
  env: { ...process.env,
    CSSMARS_ORACLE_EVENT_LOG: log,
    CSSMARS_ORACLE_INPUT_FILE: input,
    CSSMARS_ORACLE_MOTION_TRACE: resolve(out, "motion.bin"),
    CSSMARS_ORACLE_CONTENT_WIDTH: "900", CSSMARS_ORACLE_CONTENT_HEIGHT: "600",
    CSSMARS_ORACLE_ATMOSPHERE: "off", CSSMARS_ORACLE_SUN: "off",
    CSSMARS_ORACLE_LAYER_MODE_FILE: resolve(out, "mode.bin"),
    CSSMARS_ORACLE_LAYER_INSTALL_LOG: resolve(out, "layer-install.log"),
    CSSMARS_ORACLE_LAYER_CONTROL_LOG: resolve(out, "layer-control.log"),
    CSSMARS_ORACLE_CALIBRATION_AUDIT_LOG: resolve(out, "draws.jsonl"),
    CSSMARS_ORACLE_CALIBRATION_DUMP_DIR: resolve(out, "texture-audit"),
    CSSMARS_ORACLE_CALIBRATION_MAP: resolve(out, "mapping/texture-map.tsv"),
    CSSMARS_ORACLE_CALIBRATION_MASTER_RAW: resolve(out, "master.rgba"),
    CSSMARS_ORACLE_CALIBRATION_MASTER_RGBA_SHA256: hash(rgba),
    CSSMARS_ORACLE_CALIBRATION_BINDING_LOG: resolve(out, "bindings.jsonl"),
    CSSEARTH_ORACLE_RENDER_HOOK: scenario.renderHook ? resolve(scenario.renderHook) : resolve(appRoot, "render-layer-hook.dylib"),
    ...([30,60].includes(scenario.presentHz) ? {CSSEARTH_ORACLE_PRESENT_HZ:String(scenario.presentHz),
      CSSEARTH_ORACLE_FRAME_TIMING_LOG:resolve(out,"frame-timing.tsv"),
      CSSEARTH_ORACLE_INPUT_HISTORY_LOG:resolve(out,"input-history.jsonl"),
      ...(scenario.untilNativeStops ? {CSSEARTH_ORACLE_CAPTURE_UNTIL_REST:"1"} : {})} : {}),
    CSSEARTH_ORACLE_FRAME_DIRECTORY: frameDir,
    CSSEARTH_ORACLE_FRAME_CROP: [crop.left,crop.top,crop.width,crop.height].join(","),
    CSSEARTH_ORACLE_CALIBRATION_ONLY: "1",
    ...(scenario.synchronousReadback ? {CSSEARTH_ORACLE_SYNCHRONOUS_FRAMES:"1"} : {}),
  }, stdio: ["ignore", processLog.fd, processLog.fd],
});
await processLog.close();
await writeFile(resolve(out, "process.json"), JSON.stringify({ pid: child.pid,
  executable: executablePath, executableSha256: hash(await readFile(executablePath)) }));
let exited = false;
child.once("exit", () => { exited = true; });
const audit = async () => {
  const result = JSON.parse((await exec(resolve(appRoot, "window-audit"), [String(child.pid)])).stdout);
  assert.equal(result.visibleWindowCount, 0);
  assert.notEqual(result.frontmostApplication?.pid, child.pid);
  return result;
};
try {
  await until(async () => (await events()).some(e => e.event === "injected"), 20000);
  const before = await audit();
  await until(async () => (await events()).some(e => e.event === "native-input-control-ready"), 60000);
  assert.ok((await events()).some(e => e.event === "render-hook-loaded" && e.loaded));
  const startCamera = { latitude: 20, longitude: 45, distance: 11000000, tilt: 0, azimuth: 0,
    ...scenario.startCamera };
  await setViewInfo({ ...startCamera, appName: app });
  await delay(1800);
  const observedStart = await getViewInfo({ appName: app });
  const resolvedStart = scenario.normalizeStart ? observedStart : startCamera;
  const resetStart = async () => {
    await setViewInfo({ ...resolvedStart, appName: app });
    await delay(1000);
  };
  let startVerification = null;
  let gesture = scenario.gesture ?? [
    { id: "press", kind: "down", atMilliseconds: 500, x: 0.52, y: 0.48, button: 0, clickCount: 1 },
    ...Array.from({ length: 12 }, (_, i) => ({ id: `drag-${i}`, kind: "drag",
      atMilliseconds: 540 + i * 25, x: 0.52 + (i + 1) * 0.005,
      y: 0.48 + (i + 1) * 0.002, button: 0, clickCount: 1 })),
    { id: "release", kind: "up", atMilliseconds: 830, x: 0.58, y: 0.504, button: 0, clickCount: 1 },
  ];
  let inputGeometry = null;
  if (scenario.events) {
    const pose = decodeNativeMotionTrace(await readFile(resolve(out, "motion.bin"))).frames
      .findLast(frame => frame.currentContext && frame.matricesCaptured);
    assert.ok(pose, "Disc-relative input needs a measured native projection");
    const m = pose.modelViewMatrix, p = pose.projectionMatrix;
    assert.ok(Math.abs(m[12]) < 1e-6 && Math.abs(m[13]) < 1e-6,
      "Disc-relative corpus currently requires a centered native sphere");
    const distance = -m[14];
    assert.ok(distance > 1);
    const radiusX = p[0] * 693 / 2 / Math.sqrt(distance * distance - 1);
    const radiusY = p[5] * 600 / 2 / Math.sqrt(distance * distance - 1);
    inputGeometry = {
      method: "projected unit-sphere silhouette from the observed native model-view and projection; CSS pixels",
      viewport: { width: 900, height: 600 },
      crop: { left: 207, top: 0 },
      disc: { centerX: 693 / 2, centerY: 300, width: radiusX * 2, height: radiusY * 2 },
      modelViewMatrix: m, projectionMatrix: p,
    };
    let buttons = 0;
    gesture = resolveScenarioEvents(scenario, inputGeometry).map(event => {
      if (event.kind === "down") buttons = 1;
      if (event.kind === "up") buttons = 0;
      return {
      id: event.id, kind: event.kind, atMilliseconds: event.atMilliseconds + 500,
      x: event.normalizedViewportX, y: event.normalizedViewportY,
      ...(event.button === undefined ? {} : { button: event.button }),
      ...(event.clickCount === undefined ? {} : { clickCount: event.clickCount }),
      ...(scenario.pointerTransport === "qt" && event.kind !== "wheel" ? {
        qtMouseTarget: "RenderWidget", qtX: event.clientX - 207, qtY: event.clientY,
      } : {}),
      ...(event.deltaY === undefined ? {} : { deltaY: event.deltaY,
        qtWheelTarget: "RenderWidget", qtX: event.clientX - 207,
        qtY: event.clientY, qtDelta: Math.sign(event.deltaY) * 120, qtButtons: buttons }),
    }; });
  }
  const captureGesture = gesture.map(event => ({ ...event, atMilliseconds: event.atMilliseconds + 1000 }));
  assert.ok(Math.max(...captureGesture.map(e => e.atMilliseconds)) < captureMilliseconds);
  if (scenario.normalizeStart) {
    assert.equal(scenario.cases?.length ?? 0, 0, "Verify each normalized starting state independently");
    await resetStart();
    const prior = decodeNativeMotionTrace(await readFile(resolve(out,"motion.bin"))).frames
      .findLast(f=>f.currentContext && f.matricesCaptured);
    await control({revision:40,events:[
      {...gesture[0],id:"start-check-down",kind:"down",atMilliseconds:0},
      {...gesture[0],id:"start-check-up",kind:"up",atMilliseconds:350},
    ]});
    await until(async()=>(await events()).some(e=>e.id==="start-check-up" && e.event==="native-input-accepted"),5000);
    await delay(400);
    const accepted=(await events()).find(e=>e.id==="start-check-down" && e.event==="native-input-accepted");
    const held=decodeNativeMotionTrace(await readFile(resolve(out,"motion.bin"))).frames
      .findLast(f=>f.inputSerial===accepted.acceptedInputSerial && f.matricesCaptured);
    assert.ok(prior && held,"Stationary press needs both rendered camera states");
    const a=[...prior.modelViewMatrix,...prior.projectionMatrix],b=[...held.modelViewMatrix,...held.projectionMatrix];
    const maximumMatrixElementDelta=Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
    // Projection row Z controls near/far clipping, not screen X/Y or W.
    // Keep it in the evidence but do not mistake its updates for view motion.
    const maximumViewElementDelta=Math.max(...a.map((v,i)=>i>=16 && i%4===2 ? 0 : Math.abs(v-b[i])));
    startVerification={method:"set the API-returned state, then verify a stationary press before capture",
      requested:startCamera,resolved:resolvedStart,prior,held,maximumMatrixElementDelta,maximumViewElementDelta,
      matrixRoundingAllowance:1e-6,scope:"model-view and projection X/Y/W stability; depth clipping recorded separately; not an image-match tolerance"};
    await writeFile(resolve(out,"start-state.json"),JSON.stringify(startVerification,null,2));
    assert.ok(maximumViewElementDelta<=1e-6,"Reference starting state still jumps on press");
    await resetStart();
  }
  // Audit beyond the recorded tail so every tile reached during coast is bound.
  await control({ revision: 50, events: captureGesture });
  if (scenario.untilNativeStops) await observeRest(50, captureGesture);
  else await delay(Math.max(5000, captureMilliseconds + 1000));
  const extraScenarios = scenario.cases ?? [];
  assert.ok(extraScenarios.length <= 16, "Keep the capture suite bounded.");
  for (const [index, entry] of (scenario.warmCases===false && scenario.seedAudit ? [] : extraScenarios).entries()) {
    await setViewInfo({ ...startCamera, ...entry.startCamera, appName: app });
    await delay(600);
    await control({ revision: 51 + index, events: entry.gesture });
    if (scenario.untilNativeStops) await observeRest(51 + index, entry.gesture);
    else await delay(Math.max(...entry.gesture.map(e => e.atMilliseconds)) + 1000);
  }
  if (!(scenario.normalizeStart && scenario.singleWarmup)) await resetStart();
  const mapping = await exec(process.execPath, [resolve(import.meta.dirname,
    "prepare-google-calibration-map.mjs"), ...seedArguments, "--audit", resolve(out, "draws.jsonl"),
    "--output", resolve(out, "mapping"), "--cache-index", resolve(evidenceRoot,
      ".local/oracles/google-earth-pro/calibration/google-cache-index.json"), "--revision", "1"],
    { maxBuffer: 4 * 1024 * 1024, timeout: 60000 });
  await writeFile(resolve(out, "mapping-result.json"), mapping.stdout);
  mode.fill(0); mode.write("cal"); mode.writeUInt32LE(2, 20);
  await writeFile(resolve(out, "mode.bin"), mode);
  if (!scenario.singleWarmup) {
  await control({ revision: 75, events: gesture });
  if (scenario.untilNativeStops) await observeRest(75, gesture);
  else await delay(Math.max(2500, captureMilliseconds - 500));
  await resetStart();
  if (captureMilliseconds > 8000) {
    // Warmed draws include bindings first encountered while the injected atlas
    // is active. Bind their exact audited bytes before starting the recording.
    await exec(process.execPath, [resolve(import.meta.dirname,
      "prepare-google-calibration-map.mjs"), ...seedArguments, "--audit", resolve(out,"draws.jsonl"),
      "--output", resolve(out,"mapping"), "--cache-index", resolve(evidenceRoot,
        ".local/oracles/google-earth-pro/calibration/google-cache-index.json"), "--revision", "2"],
      { maxBuffer:4*1024*1024, timeout:60000 });
    mode.fill(0); mode.write("cal"); mode.writeUInt32LE(3,20);
    await writeFile(resolve(out,"mode.bin"),mode);
  }
  // A warmed, unrecorded repeat separates first-use work from recorder impact.
  await control({ revision: 90, events: captureGesture });
  await until(async () => (await events()).some(e => e.event === "native-input-batch-accepted" && e.revision === 90), 5000);
  if (scenario.untilNativeStops) await observeRest(90, captureGesture);
  else await delay(captureMilliseconds + 400);
  if (scenario.untilNativeStops) {
    const auditedRevision = mode.readUInt32LE(20);
    await exec(process.execPath, [resolve(import.meta.dirname,
      "prepare-google-calibration-map.mjs"), ...seedArguments, "--audit", resolve(out,"draws.jsonl"),
      "--output", resolve(out,"mapping"), "--cache-index", resolve(evidenceRoot,
        ".local/oracles/google-earth-pro/calibration/google-cache-index.json"), "--revision", String(auditedRevision)],
      { maxBuffer:4*1024*1024, timeout:60000 });
    mode.writeUInt32LE(auditedRevision+1,20);
    await writeFile(resolve(out,"mode.bin"),mode);
  }
  }
  if (!scenario.normalizeStart) await resetStart();
  const warmTrace = decodeNativeMotionTrace(await readFile(resolve(out, "motion.bin")));
  const drawable = warmTrace.frames.findLast(frame => frame.currentContext && frame.matricesCaptured)?.viewport;
  assert.deepEqual(drawable?.slice(2), [693 * deviceScaleFactor, 600 * deviceScaleFactor],
    "Measured native drawable does not match the requested capture density.");
  if (scenario.normalizeStart) {
    // An identical SetViewInfo can omit redraw entirely (notably sky gestures).
    // Move during setup, then record the return to the verified target below.
    // The stable pre-press suffix excludes setup frames, never gesture frames.
    await setViewInfo({ ...resolvedStart, distance: resolvedStart.distance * 1.01, appName: app });
  }
  await control({ revision: 100, events: captureGesture, captureMilliseconds: Math.min(8000,captureMilliseconds) });
  await until(async () => (await events()).some(e => e.event === "native-input-batch-accepted" && e.revision === 100), 5000);
  if (scenario.normalizeStart) {
    // Record the reset as setup, then retain its stable pre-press suffix.
    // An identical state does not necessarily trigger a native redraw.
    await setViewInfo({ ...resolvedStart, appName: app });
    assert.ok(!(await events()).some(e=>e.revision===100 && e.event==="native-input-accepted"),
      "Initial-state redraw must finish before the gesture starts");
  }
  // The installed readback hook accepts bounded eight-second windows. Rearm
  // it without injecting input, resetting the camera, or restarting the app.
  const armedAt = Date.now();
  const captureRevisions = [100];
  let stopObservation = null;
  if (scenario.untilNativeStops) {
    stopObservation = await observeRest(100, captureGesture);
  } else {
    for (let elapsed = 7000; elapsed < captureMilliseconds; elapsed += 7000) {
      await delay(Math.max(0,armedAt + elapsed - Date.now()));
      const revision = 100 + elapsed / 7000;
      captureRevisions.push(revision);
      await control({revision,events:[],captureMilliseconds:Math.min(8000,captureMilliseconds-elapsed)});
    }
    await delay(Math.max(0,armedAt + captureMilliseconds + 400-Date.now()));
  }
  const extraCaptures = [];
  for (const [index, entry] of extraScenarios.entries()) {
    const revision = 110 + index;
    const camera = { ...startCamera, ...entry.startCamera };
    const scheduled = entry.gesture.map(e => ({ ...e, atMilliseconds: e.atMilliseconds + 1000 }));
    await setViewInfo({ ...camera, appName: app });
    await delay(800);
    await control({ revision, events: scheduled, captureMilliseconds: 8000 });
    await until(async () => (await events()).some(e => e.event === "native-input-batch-accepted" && e.revision === revision), 5000);
    const stopped = scenario.untilNativeStops ? await observeRest(revision, scheduled) : null;
    if (!stopped) await delay(8100);
    extraCaptures.push({ scenario:entry.id, revision, startCamera:camera, gesture:scheduled,
      stopObservation:stopped, captureRevisions:[revision] });
    console.log(JSON.stringify({scenario:entry.id,revision,stopObservation:stopped}));
  }
  const after = await audit();
  await writeFile(resolve(out,"capture-session.json"),JSON.stringify({
    startCamera,observedStart,resolvedStart,startVerification,captureGesture,
    before,after,stopObservation,captureRevisions,drawable,crop,
  },null,2));
  const records = await events();
  const capturedFrames = records.filter(e => e.event === "rendered-frame" && captureRevisions.includes(e.revision) &&
    (!stopObservation || e.presentIndex <= stopObservation.lastPresentedSequence));
  let frames = capturedFrames, initializationFrames = [];
  const dropped = records.filter(e => e.event.startsWith("rendered-frame-") && e.event !== "rendered-frame");
  const bindings = (await readFile(resolve(out, "bindings.jsonl"), "utf8")).trim().split("\n").filter(Boolean).map(JSON.parse)
    .filter(binding => binding.revision === mode.readUInt32LE(20));
  const inputs = records.filter(e => e.event.startsWith("native-input-") && e.revision === 100);
  if (scenario.normalizeStart) {
    const press=inputs.find(e=>e.event==="native-input-accepted" && e.kind==="down");
    const poses=new Map(decodeNativeMotionTrace(await readFile(resolve(out,"motion.bin"))).frames.map(f=>[f.frameSequence,f]));
    const prePress=frames.filter(f=>f.monotonicSeconds<press.acceptedMonotonicSeconds);
    assert.ok(prePress.length,"The capture must contain a real frame before press");
    const settled=poses.get(prePress.at(-1).presentIndex);
    const initial=[...settled.modelViewMatrix,...settled.projectionMatrix];
    assert.ok(settled.modelViewMatrix.slice(0,12).every((v,i)=>
      Math.abs(v-startVerification.prior.modelViewMatrix[i])<=startVerification.matrixRoundingAllowance),
      "Settled capture orientation must match the verified starting orientation");
    let firstStable = prePress.length;
    for(let i=prePress.length-1;i>=0;i--) {
      const pose=poses.get(prePress[i].presentIndex);
      const values=[...pose.modelViewMatrix,...pose.projectionMatrix];
      const delta=Math.max(...values.map((v,j)=>j>=16&&j%4===2?0:Math.abs(v-initial[j])));
      if(delta>startVerification.matrixRoundingAllowance) break;
      firstStable=i;
    }
    assert.ok(firstStable<prePress.length,"The capture must contain a verified stationary frame before press");
    initializationFrames=frames.slice(0,firstStable);
    frames=frames.slice(firstStable);
    startVerification.captureStart={method:"stationary pre-press suffix after recorded API initialization; no gesture frames excluded",
      firstPresentIndex:frames[0].presentIndex,prePressFrames:prePress.length-firstStable,
      initializationFrameCount:initializationFrames.length,rawFrameCount:capturedFrames.length,
      settledModelView:settled.modelViewMatrix,settledProjection:settled.projectionMatrix};
  }
  const report = { capturedAt: new Date().toISOString(), qualification: "RAW_RENDERER_CAPTURE_REQUIRES_PAIRING",
    captureToolSha256,
    pid: child.pid, calibrationSha256: hash(rgba), startCamera, observedStart, resolvedStart, startVerification,
    gesture: captureGesture, inputGeometry, inputs, before, after, bindings, frames, initializationFrames, dropped,
    nativeMotionTrace: resolve(out, "motion.bin"),
    eventLog: resolve(out, "events.jsonl"),
    captureConfiguration: scenario,
    scenario:scenario.id ?? "constant-diagonal",
    presentHz:scenario.presentHz ?? null,
    readbackMode:scenario.synchronousReadback?"synchronous same-context offline capture":"asynchronous PBO readback",
    captureMilliseconds:stopObservation?.elapsedMilliseconds ?? captureMilliseconds, stopObservation,
    captureRevisions,
    viewport: { width: 693, height: 600, deviceScaleFactor, contentWidth: 900, sceneLeft: 207 },
    drawable, crop };
  await writeFile(resolve(out, "report.json"), JSON.stringify(report, null, 2));
  for (const entry of extraCaptures) {
    assert.match(entry.scenario, /^[a-z0-9-]+$/);
    const caseRoot = resolve(out, entry.scenario);
    await mkdir(caseRoot);
    await writeFile(resolve(caseRoot, "report.json"), JSON.stringify({
      ...report, ...entry, nativeMotionTrace:resolve(out,"motion.bin"),
      inputHistoryPath:resolve(out,"input-history.jsonl"), frameTimingPath:resolve(out,"frame-timing.tsv"),
      frames:records.filter(e => e.event === "rendered-frame" && e.revision === entry.revision &&
        (!entry.stopObservation || e.presentIndex <= entry.stopObservation.lastPresentedSequence)),
      inputs:records.filter(e => e.event.startsWith("native-input-") && e.revision === entry.revision),
    }, null, 2));
  }
  console.log(JSON.stringify({ out, frames: frames.length, dropped: dropped.length,
    bindings: bindings.length, allBindingsMapped: bindings.every(b => b.mapped),
    firstFrame: frames[0]?.path, dimensions: frames[0] && [frames[0].width, frames[0].height] }));
  // A short or stationary gesture can legitimately present fewer than twenty
  // frames. Qualify the recorded boundaries instead of requiring extra redraws.
  assert.ok(frames.length >= 2, "The sequence needs a starting and ending renderer frame");
  assert.equal(dropped.length, 0, "Native rendered frames were dropped");
  assert.deepEqual(inputs.filter(e => e.event === "native-input-accepted").map(e => e.id),
    captureGesture.map(e => e.id), "The native recorder did not receive the complete gesture");
} catch (error) {
  if (!exited) {
    await exec("/usr/bin/sample", [String(child.pid), "1", "-file", resolve(out, "failure-sample.txt")],
      { timeout: 10000 }).catch(() => {});
  }
  throw error;
} finally {
  await control({ revision: 999999, events: [], terminate: true });
  try { await until(() => exited, 2000); }
  catch (error) {
    const status = (await exec("/bin/ps", ["-p", String(child.pid), "-o", "pid=,state=,command="])).stdout;
    console.error("Closing the owned native process after graceful termination timed out.", status);
    child.kill("SIGTERM");
    await until(() => exited, 5000);
    await writeFile(resolve(out,"cleanup.json"),JSON.stringify({pid:child.pid,exited:true,method:"owned-process SIGTERM after graceful timeout"}));
  }
  await writeFile(resolve(out, "process-complete.json"), JSON.stringify({ pid: child.pid, exited: true }));
  console.log(JSON.stringify({ nativePid: child.pid, exited: true }));
}

async function observeRest(revision, scheduled) {
  const started = Date.now();
  let previous = null, lastChange = Date.now(), matrixChanges = 0;
  const finalId = scheduled.at(-1).id;
  let apiView = null, apiStableSince = null;
  for (;;) {
    await delay(100);
    assert.ok(Date.now() - started < captureMilliseconds + 5000,
      `Native revision ${revision} did not reach rest within its capture budget`);
    assert.ok(!exited, "Native exited before its camera reached rest.");
    const bytes = await readFile(resolve(out,"motion.bin"));
    const end = 40 + Math.floor((bytes.length-40)/220)*220;
    const tail = Buffer.concat([bytes.subarray(0,40),bytes.subarray(Math.max(40,end-256*220),end)]);
    const current = decodeNativeMotionTrace(tail).frames.findLast(f=>f.inputRevision===revision&&f.matricesCaptured);
    if (!current) continue;
    const matrix = [...current.modelViewMatrix, ...current.projectionMatrix];
    if (!previous || matrix.some((v,i)=>v!==previous[i])) {
      previous=matrix;lastChange=Date.now();matrixChanges++;
    }
    const records = await events();
    const finalInput = records.findLast(e=>e.revision===revision&&e.event==="native-input-accepted"&&e.id===finalId);
    if (finalInput &&
        Date.now()-started > scheduled.at(-1).atMilliseconds+500 && Date.now()-lastChange>=500) {
      // A stationary release need not present another frame. Read the native
      // camera after its handler receipt instead of requiring a fabricated draw.
      const view = await getViewInfo({ appName: app });
      const fields = ["latitude", "longitude", "distance", "tilt", "azimuth"];
      if (!apiView || fields.some(key => view[key] !== apiView[key])) {
        apiView = view; apiStableSince = Date.now();
      }
      if (Date.now() - apiStableSince < 500) continue;
      return { method:"last presented camera matrices and native API view unchanged for 500 ms after final input; no redraw required for stationary input",
        elapsedMilliseconds:Date.now()-started,stableMilliseconds:Date.now()-lastChange,
        apiStableMilliseconds: Date.now() - apiStableSince, apiView,
        finalInputSerial: finalInput.acceptedInputSerial, lastPresentedInputSerial: current.inputSerial,
        lastPresentedSequence:current.frameSequence,matrixChanges,matrix:previous };
    }
  }
}

async function events() {
  try { const text = await readFile(log, "utf8"); return text.slice(0, text.lastIndexOf("\n")).split("\n").filter(Boolean).map(JSON.parse); }
  catch (e) { if (e.code === "ENOENT") return []; throw e; }
}
async function control(value) {
  await writeFile(`${input}.next`, JSON.stringify({ schema: "cssmars-google-earth-pro-native-input@1", ...value }));
  await rename(`${input}.next`, input);
}
async function until(test, milliseconds) {
  const end = Date.now() + milliseconds;
  while (Date.now() < end) { if (await test()) return; await delay(50); }
  throw new Error("Timed out waiting for bounded native capture state.");
}
function hash(bytes) { return createHash("sha256").update(bytes).digest("hex"); }

