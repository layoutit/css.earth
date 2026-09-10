import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compareTrajectories, bindInputReceipts, verifyWheelReceipts, interruptionObservations,
  assertMotionOnlyReference, readBrowserRun } from
  "../../tests/objects/oracle/mars/google-earth-pro/interaction-suite-analysis.mts";

import type { MotionFrame } from '../../tests/objects/oracle/mars/google-earth-pro/interaction-suite-analysis.mts';
import { object, array, finite, text } from '../../tests/objects/oracle/mars/google-earth-pro/oracle-values.mts';

const pose = (time: number, degrees: number): MotionFrame => {
  const angle = degrees * Math.PI / 180;
  return { time, rotation: [[Math.cos(angle), -Math.sin(angle), 0],
    [Math.sin(angle), Math.cos(angle), 0], [0, 0, 1]] };
};

test("oracle comparison never borrows a future pose and retains the slower tail", () => {
  const result = compareTrajectories([pose(10, 0), pose(20, 10)],
    [pose(5, 0), pose(15, 0), pose(30, 20)]);
  assert.deepEqual(result.rows.map(r => r.time), [10, 15, 20, 30]);
  assert.equal(result.rows[2].candidateAngleDegrees, 0);
  assert.equal(result.rows[2].candidateAgeMilliseconds, 5);
  assert.equal(result.rows.at(-1)!.referenceFinalHeld, true);
  assert.ok(Math.abs(result.finalRotationErrorDegrees - 10) < 1e-10);
});

test("a wheel comparison rejects a lost held button and validates the delivered Qt event", () => {
  const event = { id: "wheel", kind: "wheel", qtWheelTarget: "RenderWidget", qtButtons: 1,
    qtX: 200, qtY: 300, qtDelta: 120 };
  const report = { gesture: [{ kind: "down" }, event],
    inputs: [{ event: "native-input-accepted", id: "wheel", acceptedMonotonicSeconds: 10 },
      { event: "native-input-posted", id: "wheel", postedMonotonicSeconds: 10.01 }] };
  const delivered = { event: "qt-wheel-delivered", id: "wheel", before: 10.001, accepted: true,
    target: "RenderWidget", buttons: 1, x: 200, y: 300, delta: 120 };
  assert.equal(verifyWheelReceipts(report, [delivered]).length, 1);
  assert.throws(() => verifyWheelReceipts(report, [{ ...delivered, buttons: 0 }]), /button state differs/);
  assert.throws(() => verifyWheelReceipts({ ...report, gesture: [{ kind: "down" }, { ...event, qtButtons: 0 }] },
    [delivered]), /lost the held mouse button/);
  assert.throws(() => verifyWheelReceipts(report, [{ ...delivered, delta: -120 }]), /delta differs/);
});

test("native repeat alignment preserves later event and pose timing", () => {
  const result = compareTrajectories([pose(100, 0), pose(200, 10)],
    [pose(300, 0), pose(450, 10)], { referenceOffset: 100, candidateOffset: 300 });
  assert.deepEqual(result.rows.map(r => r.time), [0, 100, 150]);
  assert.ok(result.maximumRotationErrorDegrees > 9.99);
  assert.equal(result.finalRotationErrorDegrees, 0);
});

test("input qualification records delivery lag and rejects missing input", () => {
  const native = { inputs: [{ id: "press", kind: "down", time: 100 },
    { id: "release", kind: "up", time: 150 }, { id: "wheel", kind: "wheel", time: 200 }] };
  const browser = { inputs: [{ type: "pointerdown", time: 104 },
    { type: "pointerup", time: 157 }, { type: "dblclick", time: 157 },
    { type: "wheel", time: 224 }] };
  assert.deepEqual(bindInputReceipts(native, browser).map(e => e.browserDeliveryDelayMilliseconds), [4, 7, 24]);
  assert.throws(() => bindInputReceipts(native, { inputs: browser.inputs.slice(0, -1) }), /input count or order/);
});

test("an interruption interval ends at each renderer's next actual input receipt", () => {
  const native = { inputs: [{ id: "wheel", kind: "wheel", time: 100 },
    { id: "press", kind: "down", time: 150 }], frames: [pose(101, 0), pose(149, 2)] };
  const browser = { inputs: [{ type: "wheel", time: 120 }, { type: "pointerdown", time: 180 }],
    frames: [pose(121, 0), pose(170, 5), pose(181, 30)] };
  assert.ok(Math.abs(interruptionObservations(native, browser)[0].browserRotationAfterInputDegrees! - 5) < 1e-9);
});

test("oracle registration rejects an independent CSS translation of the scene", async () => {
  const {assertRegisteredProjection}=await import('../../tests/objects/oracle/mars/google-earth-pro/interaction-suite-analysis.mts');
  const native={startMatrix:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,-4,1],focalLength:600,
    report:{viewport:{sceneLeft:207,width:693,height:600}}};
  const browser={state:{trackball:{centerX:553.5,centerY:300,focalLength:600}}};
  assert.doesNotThrow(()=>assertRegisteredProjection(native,browser));
  browser.state.trackball.centerX+=170;
  assert.throws(()=>assertRegisteredProjection(native,browser),/body position differs/);
});

test("motion-only timing rejects reference readback overlapping the gesture", () => {
  const report = { captureConfiguration: { captureUntilRest: false },
    inputs: [{ event: "native-input-accepted", acceptedMonotonicSeconds: 10 }],
    frames: [{ monotonicSeconds: 9 }, { monotonicSeconds: 9.5 }] };
  assert.doesNotThrow(() => assertMotionOnlyReference(report));
  assert.throws(() => assertMotionOnlyReference({ ...report,
    captureConfiguration: { captureUntilRest: true } }), /without gesture readback/);
  assert.throws(() => assertMotionOnlyReference({ ...report,
    frames: [{ monotonicSeconds: 10.1 }, ...report.frames] }), /overlaps/);
  assert.throws(() => assertMotionOnlyReference({ ...report, inputs: [] }), /no accepted input/);
});

test("natural motion reports retain the observed clock and reject hidden readback", async t => {
  const directory = await mkdtemp(join(tmpdir(), "cssearth-motion-report-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "report.json");
  const scene = "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)";
  const sample = (timestamp: number) => ({ timestamp, pose: { scene }, zoom: 1,
    interaction: { activeMode: "idle", activeMotionCount: 0, wheelZoom: { active: false } } });
  const report = { timingMode: "motion-only", readbackDuringGesture: false,
    stopObservation: { elapsedMilliseconds: 550 }, failures: [], finalNodes: 12,
    state: { nodes: 12, pose: { scene }, trackball: { focalLength: 600 } },
    epoch: 1000, zoom: 1, clock: { timeOrigin: 500 },
    inputs: [{ type: "pointerup", receivedAt: 525 }],
    motionSamples: [sample(1010), sample(1030)] };
  const read = async (patch: Record<string, unknown>) => {
    await writeFile(path, JSON.stringify({ ...report, ...patch }));
    return readBrowserRun(path);
  };
  const result = await read({});
  assert.deepEqual(result.frames.map(frame => frame.time), [10, 30]);
  assert.equal(result.inputs[0].time, 25);
  await assert.rejects(read({ readbackDuringGesture: true }));
  await assert.rejects(read({ timingMode: "frame-locked" }), /natural browser clock/);
  assert.equal((await read({ timingMode: "normal", readbackDuringGesture: true })).frames.length, 2);
});

test("input pairing retains the final consumed release position even without a throw", async t => {
  const directory = await mkdtemp(join(tmpdir(), "cssearth-release-pairing-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const gesture = ["down", "drag", "drag", "up"].map((kind, index) => ({
    id:`input-${index}`, kind, x:[.5, .51, .53, .55][index], y:.5,
  }));
  const history = [[0, 0, 1], [.02, 0, 1.02], [.04, 0, 1.04], [.04, 0, 1.06]];
  const records = [3, 4].map(length => ({ t:100 + (length - 1) * .02 + .01,
    clock:1 + (length - 1) * .02 + .01, point:[length === 3 ? .06 : .1, 0],
    history:history.slice(0, length), average:[0, 0], window:0 }));
  await writeFile(join(directory, "input-history.jsonl"), records.map(row => JSON.stringify(row)).join("\n"));
  await writeFile(join(directory, "frame-timing.tsv"), "100\t0.016\t1\n100.05\t0.016\t1.05\n");
  await writeFile(join(directory, "report.json"), JSON.stringify({
    gesture: gesture.map(event => ({ ...event, qtMouseTarget: 'RenderWidget', clickCount: 1 })),
    calibrationSha256: 'retained-calibration-hash', captureConfiguration:{captureUntilRest:false, extraCapturePolicy:'retained'},
    frames:[{monotonicSeconds:99.9, presentIndex:7, path:'captured-frame.png'}],
    viewport:{width:100, height:100, sceneLeft:0, contentWidth:100},
    inputs:[{event:"native-input-batch-accepted", acceptedMonotonicSeconds:100},
      {event:"native-input-posted", id:"input-0", postedMonotonicSeconds:100, delivered:true},
      ...gesture.map((event, index) => ({event:"native-input-accepted", id:event.id,
        acceptedMonotonicSeconds:100 + index * .02}))],
  }));
  execFileSync(process.execPath, [new URL(
    "../../tests/objects/oracle/mars/google-earth-pro/pair-rendered-motion-inputs.mts",
    import.meta.url).pathname, directory]);
  const result = object(JSON.parse(await readFile(join(directory, "paired-input-report.json"), 'utf8')));
  const launch = object(object(result.consumedInputEvidence).launch);
  const consumed = array(result.consumedGesture).map(entry => {
    const event = object(entry); return { kind: text(event.kind), id: text(event.id), x: finite(event.x) };
  });
  assert.equal(result.calibrationSha256, 'retained-calibration-hash');
  assert.equal(object(array(result.inputs).find(entry => object(entry).event === 'native-input-posted')).postedMonotonicSeconds, 100);
  assert.equal(object(result.captureConfiguration).captureUntilRest, false);
  assert.equal(object(result.captureConfiguration).extraCapturePolicy, 'retained');
  assert.equal(object(array(result.frames)[0]).presentIndex, 7);
  assert.equal(object(array(result.frames)[0]).path, 'captured-frame.png');
  const finalInput = object(array(result.consumedGesture).at(-1));
  assert.equal(finalInput.qtMouseTarget, 'RenderWidget');
  assert.equal(finalInput.clickCount, 1);
  assert.ok(finite(finalInput.atMilliseconds) < 100, 'Release clock must stay relative to the batch');
  assert.equal(array(launch.history).length, 4);
  assert.deepEqual(consumed.map(event => event.kind), ["down", "drag", "drag", "drag", "up"]);
  assert.equal(consumed.at(-2)!.id, "input-3:position");
  assert.ok(Math.abs(consumed.at(-2)!.x - .55) < 1e-12);
  assert.equal(consumed.at(-1)!.x, consumed.at(-2)!.x);
});
