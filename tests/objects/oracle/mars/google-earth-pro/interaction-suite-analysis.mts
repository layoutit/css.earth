import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import sharp from "sharp";
import { decodeNativeMotionTrace } from "./native-motion-trace-reader.mts";
import { sampleCalibrationTile } from "./calibration-tile-address.mts";
import { multiply3, relativeOrientation3, orientationErrorDegrees } from
  "../../../../../site/test/interaction-orientation.mts";

const identity = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const flip = [[1, 0, 0], [0, -1, 0], [0, 0, 1]];
const matrix = value => value.slice(9, -1).split(",").map(Number);
export const hash = bytes => createHash("sha256").update(bytes).digest("hex");
export const json = async path => JSON.parse(await readFile(path, "utf8"));

export function assertMotionOnlyReference(report) {
  const firstInput = Math.min(...report.inputs.filter(event =>
    event.event === "native-input-accepted").map(event => event.acceptedMonotonicSeconds));
  assert.ok(Number.isFinite(firstInput), "Reference contains no accepted input");
  assert.equal(report.captureConfiguration?.captureUntilRest, false,
    "Motion-only timing requires a native reference without gesture readback");
  assert.ok(report.frames.length > 0 && report.frames.every(frame =>
    frame.monotonicSeconds < firstInput),
  "Native pixel capture overlaps the measured input interval");
}

export async function readNativeRun(path, { frameSource = "pixels" } = {}) {
  assert.ok(["pixels", "motion"].includes(frameSource));
  const report = await json(path);
  if (frameSource === "motion") assertMotionOnlyReference(report);
  assert.equal(report.before.visibleWindowCount, 0);
  assert.equal(report.after.visibleWindowCount, 0);
  assert.notEqual(report.before.frontmostApplication?.pid, report.pid);
  assert.notEqual(report.after.frontmostApplication?.pid, report.pid);
  assert.ok(report.frames.length > 1 && !report.dropped.length);
  assert.ok(report.stopObservation, "Native tail was not observed through rest");
  const receipts = report.inputs.filter(e => e.event === "native-input-accepted");
  assert.deepEqual(receipts.map(e => e.id), report.gesture.map(e => e.id), "Native input receipts differ from the requested scenario");
  const start = report.inputs.find(e => e.event === "native-input-batch-accepted" &&
    e.revision === (report.revision ?? 100)).acceptedMonotonicSeconds;
  const tracePath = report.nativeMotionTrace ?? resolve(dirname(path), "motion.bin");
  const traceBytes = await readFile(tracePath);
  const decoded = decodeNativeMotionTrace(traceBytes);
  const bySequence = new Map(decoded.frames.map(f => [f.frameSequence, f]));
  const first = bySequence.get(report.frames[0].presentIndex);
  assert.ok(first?.matricesCaptured);
  const traceClockOffsetSeconds = report.frames[0].monotonicSeconds -
    first.monotonicNanoseconds / 1e9;
  const capturedPaths = new Map(report.frames.map(frame => [frame.presentIndex, frame.path]));
  const observations = frameSource === "motion"
    ? decoded.frames.filter(frame => frame.matricesCaptured &&
      frame.frameSequence >= first.frameSequence &&
      frame.frameSequence <= report.stopObservation.lastPresentedSequence).map(frame => ({
        monotonicSeconds: frame.monotonicNanoseconds / 1e9 + traceClockOffsetSeconds,
        presentIndex: frame.frameSequence,
        path: capturedPaths.get(frame.frameSequence) ?? null,
      }))
    : report.frames;
  assert.ok(observations.length > 1, "Reference motion interval is empty");
  const frames = observations.map(f => {
    const pose = bySequence.get(f.presentIndex);
    assert.ok(pose?.matricesCaptured, "Rendered frame lacks its native camera record");
    return { time: (f.monotonicSeconds - start) * 1000,
      rotation: relativeOrientation3(pose.modelViewMatrix, first.modelViewMatrix),
      distanceRatio: pose.modelViewMatrix[14] / first.modelViewMatrix[14],
      instrumentationMilliseconds: pose.instrumentationNanoseconds / 1e6,
      path: f.path, presentIndex: f.presentIndex };
  });
  assertIncreasing(frames.map(f => f.time));
  const inputs = report.consumedGesture
    ? report.consumedGesture.map(event => ({ ...event, time: event.atMilliseconds }))
    : receipts.map(e => ({ ...report.gesture.find(g => g.id === e.id),
      time: (e.acceptedMonotonicSeconds - start) * 1000 }));
  const eventRecords = (await readFile(report.eventLog ?? resolve(dirname(path), "events.jsonl"), "utf8"))
    .trim().split("\n").filter(Boolean).map(JSON.parse);
  const wheelReceipts = verifyWheelReceipts(report, eventRecords);
  const mouseReceipts = verifyMouseReceipts(report, eventRecords);
  return { report, frames, inputs, wheelReceipts, mouseReceipts, focalLength: first.projectionMatrix[5] * report.viewport.height / 2,
    traceSha256: hash(traceBytes), maximumInstrumentationMilliseconds: Math.max(...frames.map(f => f.instrumentationMilliseconds)),
    startMatrix: first.modelViewMatrix, startProjection: first.projectionMatrix };
}

export function verifyWheelReceipts(report, records) {
  let buttons = 0;
  const result = [];
  for (const event of report.gesture) {
    if (event.kind === "down") buttons = 1;
    if (event.kind === "up") buttons = 0;
    if (event.kind !== "wheel") continue;
    assert.equal(event.qtWheelTarget, "RenderWidget", "Native wheel must reach the renderer's Qt input path");
    assert.equal(event.qtButtons ?? 0, buttons, "Native wheel lost the held mouse button");
    const accepted = report.inputs.find(e => e.event === "native-input-accepted" && e.id === event.id);
    const delivered = records.find(e => e.event === "qt-wheel-delivered" && e.id === event.id &&
      e.before >= accepted.acceptedMonotonicSeconds && e.before < accepted.acceptedMonotonicSeconds + .5);
    assert.ok(delivered?.accepted, "Native renderer did not accept the Qt wheel event");
    assert.equal(delivered.buttons ?? 0, buttons, "Delivered Qt wheel button state differs");
    for (const [actual, expected] of [["target", "qtWheelTarget"], ["x", "qtX"], ["y", "qtY"], ["delta", "qtDelta"]]) {
      assert.equal(delivered[actual], event[expected], `Delivered Qt wheel ${actual} differs`);
    }
    result.push(delivered);
  }
  return result;
}

export function verifyMouseReceipts(report, records) {
  return report.gesture.filter(e => e.qtMouseTarget).map(event => {
    const accepted = report.inputs.find(e => e.event === "native-input-accepted" && e.id === event.id);
    const receipt = records.find(e => e.event === "qt-mouse-delivered" && e.id === event.id &&
      e.before >= accepted.acceptedMonotonicSeconds && e.before < accepted.acceptedMonotonicSeconds + .5);
    assert.ok(receipt?.accepted, "Native renderer did not accept the Qt mouse event");
    assert.equal(receipt.target, "RenderWidget");
    assert.equal(receipt.x, event.qtX); assert.equal(receipt.y, event.qtY);
    assert.equal(receipt.type, event.kind === "down" ? (event.clickCount === 2 ? 4 : 2) : event.kind === "up" ? 3 : 5);
    assert.equal(receipt.button, ["down", "up"].includes(event.kind) ? 1 : 0);
    assert.equal(receipt.buttons, ["down", "drag"].includes(event.kind) ? 1 : 0);
    return receipt;
  });
}

export async function readBrowserRun(path) {
  const report = await json(path);
  assert.ok(["normal", "motion-only"].includes(report.timingMode),
    "Suite timing evidence requires the natural browser clock");
  if (report.timingMode === "motion-only") assert.equal(report.readbackDuringGesture, false);
  assert.ok(report.stopObservation && !report.failures.length);
  assert.equal(report.finalNodes, report.state.nodes);
  const first = matrix(report.state.pose.scene);
  const frames = report.motionSamples.map(f => ({
    time: f.timestamp - report.epoch,
    rotation: multiply3(multiply3(flip, relativeOrientation3(matrix(f.pose.scene), first)), flip),
    zoomRatio: f.zoom / report.zoom,
    activeMode: f.interaction.activeMode,
    activeMotionCount: f.interaction.activeMotionCount,
    wheelActive: f.interaction.wheelZoom.active,
  })).sort((a, b) => a.time - b.time);
  assert.ok(frames.length > 1);
  return { report, frames, focalLength: report.state.trackball.focalLength,
    inputs: report.inputs.map(e => ({ ...e, time: e.receivedAt + report.clock.timeOrigin - report.epoch })) };
}

export function assertRegisteredProjection(native, browser) {
  const m = native.startMatrix, focal = native.focalLength, viewport = native.report.viewport;
  const x = viewport.sceneLeft + viewport.width/2 - m[12]/m[14]*focal;
  const y = viewport.height/2 + m[13]/m[14]*focal;
  assert.ok(Math.abs(browser.state.trackball.centerX-x)<.05 &&
    Math.abs(browser.state.trackball.centerY-y)<.05,
  "INVALID: browser body position differs from the recorded native viewport");
  assert.ok(Math.abs(browser.state.trackball.focalLength-focal)<.01,
    "INVALID: interaction projection differs from the native reference");
}

export function compareFrameBoundMotion(native, browser) {
  assertRegisteredProjection(native, browser);
  assert.equal(browser.timingMode, "frame-locked");
  assert.equal(browser.frameBinding, "native-present-step-and-verified-pixel-marker");
  assert.equal(browser.failures.length, 0);
  assert.equal(browser.frames.length, native.frames.length);
  assert.ok(browser.captureToolSha256 && browser.codeResources?.length);
  if (browser.finalNodesScope === "stage") assert.equal(browser.finalNodes, browser.state.nodes);
  const first = matrix(browser.state.pose.scene);
  const startDistance = -native.startMatrix[14];
  const startZoom = browser.frames[0].zoom;
  const rows = browser.frames.map((frame, i) => {
    assert.equal(frame.nativePresentIndex, native.frames[i].presentIndex);
    assert.equal(frame.marker, i + 1);
    const rotation = multiply3(multiply3(flip,
      relativeOrientation3(matrix(frame.pose.scene), first)), flip);
    const reference = native.frames[i];
    const distance = startDistance * reference.distanceRatio;
    const nativeRadiusRatio = Math.sqrt((startDistance*startDistance-1)/(distance*distance-1));
    const browserRadiusRatio = frame.zoom/startZoom;
    return { index:i, time:reference.time,
      rotationErrorDegrees:orientationErrorDegrees(reference.rotation,rotation),
      referenceAngleDegrees:orientationErrorDegrees(reference.rotation,identity),
      candidateAngleDegrees:orientationErrorDegrees(rotation,identity),
      nativeRadiusRatio,browserRadiusRatio,
      relativeRadiusError:browserRadiusRatio/nativeRadiusRatio-1 };
  });
  return { qualification:"Same observed native frame steps and consumed inputs; no camera pose replay; not real-time timing proof",
    maximumRotationErrorDegrees:Math.max(...rows.map(r=>r.rotationErrorDegrees)),
    finalRotationErrorDegrees:rows.at(-1).rotationErrorDegrees,
    maximumRelativeRadiusError:Math.max(...rows.map(r=>Math.abs(r.relativeRadiusError))),
    finalRelativeRadiusError:rows.at(-1).relativeRadiusError,rows };
}

// Latest observation only. A missing early sample is excluded, never replaced
// by a future pose. Keep the full tail of the slower run.
export function compareTrajectories(reference, candidate, { referenceOffset = 0, candidateOffset = 0 } = {}) {
  const a = reference.map(f => ({ ...f, time: f.time - referenceOffset }));
  const b = candidate.map(f => ({ ...f, time: f.time - candidateOffset }));
  const start = Math.max(a[0].time, b[0].time);
  const times = [...new Set([...a, ...b].map(f => f.time).filter(t => t >= start))].sort((x, y) => x - y);
  let ai = 0, bi = 0;
  const rows = times.map(time => {
    while (ai + 1 < a.length && a[ai + 1].time <= time) ai++;
    while (bi + 1 < b.length && b[bi + 1].time <= time) bi++;
    return { time, rotationErrorDegrees: orientationErrorDegrees(a[ai].rotation, b[bi].rotation),
      referenceAngleDegrees: orientationErrorDegrees(a[ai].rotation, identity),
      candidateAngleDegrees: orientationErrorDegrees(b[bi].rotation, identity),
      referenceAgeMilliseconds: time - a[ai].time, candidateAgeMilliseconds: time - b[bi].time,
      referenceFinalHeld: time > a.at(-1).time, candidateFinalHeld: time > b.at(-1).time };
  });
  const worst = rows.reduce((a, b) => a.rotationErrorDegrees >= b.rotationErrorDegrees ? a : b);
  return { pairing: "union of observed clocks, latest past observation held; no time warp or future samples",
    maximumRotationErrorDegrees: worst.rotationErrorDegrees,
    finalRotationErrorDegrees: rows.at(-1).rotationErrorDegrees, worst,
    firstAboveDegrees: Object.fromEntries([.1, 1, 5].map(threshold => [threshold,
      rows.find(r => r.rotationErrorDegrees > threshold)?.time ?? null])),
    thresholdScope: "descriptive crossing times only; these are not acceptance thresholds", rows };
}

export function summarizeMotion(run) {
  const frames = run.frames;
  return { maximumAngleDegrees: Math.max(...frames.map(f => orientationErrorDegrees(f.rotation, identity))),
    finalAngleDegrees: orientationErrorDegrees(frames.at(-1).rotation, identity),
    firstPresentedMilliseconds: frames[0].time, lastPresentedMilliseconds: frames.at(-1).time,
    observations: frames.length };
}

export function interruptionObservations(native, browser) {
  const events = native.inputs.filter(e => e.kind === "wheel" || e.id === "stop-down");
  const bindings = bindInputReceipts(native, browser);
  return events.map(event => {
    const next = native.inputs.find(e => e.time > event.time && ["down", "drag", "wheel"].includes(e.kind));
    const end = next?.time ?? Infinity;
    const nf = native.frames.filter(f => f.time >= event.time && f.time < end);
    const binding = bindings.find(e => e.id === event.id);
    const browserStart = binding?.browserMilliseconds ?? event.time;
    const browserEnd = next ? bindings.find(e => e.id === next.id).browserMilliseconds : Infinity;
    const bf = browser.frames.filter(f => f.time >= browserStart && f.time < browserEnd);
    const span = values => values.length < 2 ? null : Math.max(...values.map(f =>
      orientationErrorDegrees(f.rotation, values[0].rotation)));
    return { id: event.id, atMilliseconds: event.time,
      browserReceiptMilliseconds: browserStart,
      browserDeliveryDelayMilliseconds: browserStart - event.time,
      nativeRotationAfterInputDegrees: span(nf), browserRotationAfterInputDegrees: span(bf),
      browserModesAfterInput: [...new Set(bf.map(f => f.activeMode))],
      scope: "observed interval until the next gesture; delivery and first-frame latency remain recorded separately" };
  });
}

export function bindInputReceipts(native, browser) {
  const types = { move: "pointermove", drag: "pointermove", down: "pointerdown", up: "pointerup", wheel: "wheel" };
  const received = browser.inputs.filter(e => e.type !== "dblclick");
  assert.deepEqual(received.map(e => e.type), native.inputs.map(e => types[e.kind]),
    "Browser input count or order differs from the native scenario");
  return native.inputs.map((event, i) => ({ id: event.id, kind: event.kind,
    nativeMilliseconds: event.time, browserMilliseconds: received[i].time,
    browserDeliveryDelayMilliseconds: received[i].time - event.time }));
}

export async function verifyProvenance(nativePath, browserPath, calibrationRoot) {
  const n = await json(nativePath), b = browserPath ? await json(browserPath) : null;
  const nativeDirectory = dirname(n.sourceReport ?? nativePath);
  const source = (await json(resolve(calibrationRoot, "manifest.json"))).source;
  const sourceBytes = await readFile(resolve(calibrationRoot, source.path));
  assert.equal(hash(sourceBytes), source.encodedSha256);
  const raster = await sharp(sourceBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(hash(raster.data), source.decodedRgbaSha256);
  assert.equal(n.calibrationSha256, source.decodedRgbaSha256);
  const mapping = await json(resolve(nativeDirectory, "mapping/texture-map.json"));
  assert.ok(n.bindings.length > 0, "Native capture has no audited texture bindings");
  const tiles = new Map();
  for (const binding of n.bindings) {
    assert.equal(binding.mapped, true);
    const entry = mapping.mappings.find(m => m.googleCacheAddress.level === binding.level &&
      m.googleCacheAddress.col === binding.x && m.googleCacheAddress.row === binding.y);
    assert.ok(entry, "Native binding lacks its capture-specific tile mapping");
    const tile = entry.calibrationTile;
    assert.equal(tile.sourceDecodedRgbaSha256, source.decodedRgbaSha256);
    assert.equal(tile.uploadRgbaSha256, binding.decodedRgbaSha256);
    if (!tiles.has(tile.uploadPath)) {
      const bytes = await readFile(tile.uploadPath);
      assert.equal(hash(bytes), binding.decodedRgbaSha256);
      const { topDown } = sampleCalibrationTile(raster, entry.googleCacheAddress);
      const regenerated = await sharp(topDown, { raw: { width: 256, height: 256, channels: 4 } }).flip().raw().toBuffer();
      assert.equal(hash(regenerated), binding.decodedRgbaSha256);
      tiles.set(tile.uploadPath, binding.decodedRgbaSha256);
    }
  }
  const process = await json(resolve(nativeDirectory, "process.json"));
  assert.equal(hash(await readFile(process.executable)), process.executableSha256);
  const nativeFrames = [];
  for (const frame of n.frames) nativeFrames.push({ path: frame.path, sha256: hash(await readFile(frame.path)) });
  const browserFrames = [];
  if (b) {
    assert.equal(b.calibrationSha256, source.decodedRgbaSha256);
    for (const resource of b.resources) {
      assert.equal(resource.sourceDecodedRgbaSha256, source.decodedRgbaSha256);
      const bytes = await readFile(resolve(calibrationRoot, resource.path));
      assert.equal(hash(bytes), resource.encodedSha256);
      assert.equal(hash(await sharp(bytes).ensureAlpha().raw().toBuffer()), resource.decodedRgbaSha256);
    }
    assert.equal(new Set(b.frames.map(f => f.path)).size, b.frames.length);
    for (const frame of b.frames) {
      assert.equal(hash(await readFile(frame.path)), frame.sha256);
      browserFrames.push({ path: frame.path, sha256: frame.sha256 });
    }
  }
  return { verified: true, sourceSha256: source.decodedRgbaSha256, executable: process,
    nativeBindings: n.bindings.length, regeneratedTiles: tiles.size, nativeFrames, browserFrames,
    browserResources: b?.resources ?? [],
    scope: "exact source, capture-specific uploaded native RGBA, browser preparation bytes, and frame hashes verified" };
}

function assertIncreasing(times) {
  assert.ok(times.every((t, i) => Number.isFinite(t) && (i === 0 || t > times[i - 1])),
    "Native frame clocks must be strictly increasing");
}
