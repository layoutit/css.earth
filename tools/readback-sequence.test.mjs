import assert from "node:assert/strict";
import test from "node:test";
import { captureFixedReadbacks } from "./readback-sequence.mjs";

function fixture(overrides = {}) {
  const persisted = [], events = [];
  let snapshotIndex = 0;
  return {
    persisted, events,
    options: {
      snapshot: async () => { events.push(`snapshot:${snapshotIndex++}`); return { camera: { yaw: 0 }, paused: true }; },
      capture: async (index) => { events.push(`capture:${index}`); return Buffer.from([index]); },
      validate: async (image, index) => { events.push(`validate:${index}`); assert.equal(image[0], index); },
      onFrame: async (frame) => { events.push(`persist:${frame.index}`); persisted.push(frame); },
      ...overrides,
    },
  };
}

test("persists all six differing frames, sequentially, without a favorable-frame search", async () => {
  const { options, persisted, events } = fixture();
  const result = await captureFixedReadbacks(options);
  assert.deepEqual(result.frames.map((image) => image[0]), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(persisted.map(({ index }) => index), [0, 1, 2, 3, 4, 5]);
  assert.equal(result.repeatablePairs, false);
  assert.deepEqual(result.state, { camera: { yaw: 0 }, paused: true });
  assert.deepEqual(events, Array.from({ length: 6 }, (_, index) => [
    `snapshot:${index * 2}`, `capture:${index}`, `snapshot:${index * 2 + 1}`,
    `persist:${index}`, `validate:${index}`,
  ]).flat());
  for (const frame of persisted) assert.deepEqual(frame.before, frame.after);
});

test("reports all three equal ordered A/B pairs without requiring A equal B", async () => {
  const { options, persisted } = fixture({ capture: (index) => Buffer.from([index % 2]), validate: () => {} });
  const result = await captureFixedReadbacks(options);
  assert.equal(result.repeatablePairs, true);
  assert.equal(persisted.length, 6);
  assert.equal(result.frames[0].equals(result.frames[1]), false);
});

test("checks every ordered pair, including the last pair and longer fixed sequences", async () => {
  for (const changedIndex of [2, 3, 4, 5, 6, 7]) {
    const { options } = fixture({ frames: 8,
      capture: (index) => Buffer.from([index === changedIndex ? 9 : index % 2]), validate: () => {} });
    const result = await captureFixedReadbacks(options);
    assert.equal(result.frames.length, 8);
    assert.equal(result.repeatablePairs, false, `Changed frame ${changedIndex}`);
  }
});

test("rejects a changed pre-capture state without capturing or persisting another frame", async () => {
  let snapshots = 0, captures = 0;
  const { options, persisted } = fixture({
    snapshot: () => ({ yaw: ++snapshots > 2 ? 1 : 0 }),
    capture: (index) => { captures++; return Buffer.from([index]); },
  });
  await assert.rejects(captureFixedReadbacks(options), /State changed before/);
  assert.equal(captures, 1); assert.equal(persisted.length, 1);
});

test("detects mutations during capture even when snapshot reuses the same object", async () => {
  const state = { yaw: 0 };
  const { options, persisted } = fixture({ snapshot: () => state,
    capture: () => { state.yaw = 1; return Buffer.from([0]); } });
  await assert.rejects(captureFixedReadbacks(options), /State changed during/);
  assert.equal(persisted.length, 1);
});

test("persists the failing frame and prior frames, then stops without another capture", async () => {
  const state = { yaw: 0 };
  let captures = 0;
  const { options, persisted } = fixture({ snapshot: () => state,
    capture: (index) => { captures++; if (index === 2) state.yaw = 1; return Buffer.from([index]); } });
  await assert.rejects(captureFixedReadbacks(options), /State changed during/);
  assert.deepEqual(persisted.map(({ index }) => index), [0, 1, 2]);
  assert.equal(persisted[2].before.yaw, 0); assert.equal(persisted[2].after.yaw, 1);
  assert.equal(captures, 3);
});

test("retains original frame bytes when capture reuses a mutable Buffer", async () => {
  const buffer = Buffer.alloc(1);
  const { options } = fixture({ capture: (index) => { buffer[0] = index; return buffer; } });
  const result = await captureFixedReadbacks(options);
  assert.deepEqual(result.frames.map((image) => image[0]), [0, 1, 2, 3, 4, 5]);
  assert.equal(result.repeatablePairs, false);
});

test("rejects invalid counts before invoking callbacks", async () => {
  for (const frames of [0, -2, 2, 4, 5, 7, 6.5, NaN, Infinity, "6", null]) {
    const { options, events } = fixture({ frames });
    await assert.rejects(captureFixedReadbacks(options), RangeError);
    assert.deepEqual(events, []);
  }
});

test("requires callbacks and rejects non-Buffer captures and lossy snapshots", async () => {
  for (const name of ["capture", "snapshot", "validate", "onFrame"]) {
    await assert.rejects(captureFixedReadbacks(fixture({ [name]: null }).options), TypeError);
  }
  await assert.rejects(captureFixedReadbacks(fixture({ capture: () => "image" }).options), /Buffer/);
  for (const state of [{ time: NaN }, { time: undefined }, { fn() {} }, new Date()]) {
    await assert.rejects(captureFixedReadbacks(fixture({ snapshot: () => state }).options));
  }
});

for (const name of ["capture", "snapshot", "validate", "onFrame"]) {
  test(`propagates ${name} failure without retrying or continuing`, async () => {
    const failure = new Error(`${name} failed`);
    let calls = 0;
    const { options, persisted } = fixture({ [name]: async () => { calls++; throw failure; } });
    await assert.rejects(captureFixedReadbacks(options), (error) => error === failure);
    assert.equal(calls, 1); assert.equal(persisted.length, name === "validate" ? 1 : 0);
  });
}

test("awaits persistence before starting the next capture", async () => {
  let finishPersistence;
  const gate = new Promise((resolve) => { finishPersistence = resolve; });
  let captures = 0, persisted = 0;
  const { options } = fixture({
    capture: (index) => { captures++; return Buffer.from([index]); },
    onFrame: async () => { if (!persisted) await gate; persisted++; },
  });
  const task = captureFixedReadbacks(options);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(captures, 1); assert.equal(persisted, 0);
  finishPersistence();
  await task;
  assert.equal(captures, 6); assert.equal(persisted, 6);
});
