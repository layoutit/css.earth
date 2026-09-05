import assert from "node:assert/strict";

function copyState(state) {
  const copy = JSON.parse(JSON.stringify(state));
  assert.deepEqual(copy, state, "Readback snapshots must be plain JSON-serializable state.");
  return copy;
}

export async function captureFixedReadbacks({ capture, snapshot, validate, onFrame, frames = 6 }) {
  if (!Number.isSafeInteger(frames) || frames < 6 || frames % 2 !== 0) {
    throw new RangeError("Readback frame count must be an even integer of at least six.");
  }
  for (const callback of [capture, snapshot, validate, onFrame]) {
    if (typeof callback !== "function") throw new TypeError("Every readback callback is required.");
  }
  const images = [];
  let state;
  for (let index = 0; index < frames; index++) {
    const before = copyState(await snapshot());
    if (index === 0) state = copyState(before);
    assert.deepEqual(before, state, "State changed before a fixed readback.");
    const captured = await capture(index);
    assert.ok(Buffer.isBuffer(captured), "Readback captures must return a Buffer.");
    // Capture callbacks may reuse their working buffer; retain each frame's bytes.
    const image = Buffer.from(captured);
    const after = copyState(await snapshot());
    // Keep the evidence even when this frame subsequently fails validation.
    await onFrame({ index, image, before, after });
    assert.deepEqual(after, state, "State changed during a fixed readback.");
    await validate(image, index);
    images.push(image);
  }
  return {
    frames: images,
    state,
    repeatablePairs: images.every((image, index) => image.equals(images[index % 2])),
  };
}
