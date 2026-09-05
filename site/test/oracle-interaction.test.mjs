import test from "node:test";
import assert from "node:assert/strict";
import { compareTrajectories, bindInputReceipts, verifyWheelReceipts, interruptionObservations } from
  "../../src/planets/mars/tools/oracle/google-earth-pro/interaction-suite-analysis.mjs";

const pose = (time, degrees) => {
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
  assert.equal(result.rows.at(-1).referenceFinalHeld, true);
  assert.ok(Math.abs(result.finalRotationErrorDegrees - 10) < 1e-10);
});

test("a wheel comparison rejects a lost held button and validates the delivered Qt event", () => {
  const event = { id: "wheel", kind: "wheel", qtWheelTarget: "RenderWidget", qtButtons: 1,
    qtX: 200, qtY: 300, qtDelta: 120 };
  const report = { gesture: [{ kind: "down" }, event],
    inputs: [{ event: "native-input-accepted", id: "wheel", acceptedMonotonicSeconds: 10 }] };
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
  assert.ok(Math.abs(interruptionObservations(native, browser)[0].browserRotationAfterInputDegrees - 5) < 1e-9);
});

test("oracle registration rejects an independent CSS translation of the scene", async () => {
  const {assertRegisteredProjection}=await import('../../src/planets/mars/tools/oracle/google-earth-pro/interaction-suite-analysis.mjs');
  const native={startMatrix:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,-4,1],focalLength:600,
    report:{viewport:{sceneLeft:207,width:693,height:600}}};
  const browser={state:{trackball:{centerX:553.5,centerY:300,focalLength:600}}};
  assert.doesNotThrow(()=>assertRegisteredProjection(native,browser));
  browser.state.trackball.centerX+=170;
  assert.throws(()=>assertRegisteredProjection(native,browser),/body position differs/);
});
