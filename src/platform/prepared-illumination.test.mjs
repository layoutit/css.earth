import assert from "node:assert/strict";
import test from "node:test";
import { preparedIlluminationState, publishPreparedIllumination } from "./prepared-illumination.mjs";

const plan = { frameCount: 128, minimumLightViewZ: -1, maximumLightViewZ: 1,
  baseLightAzimuthDegrees: 0, shadowlessFrameOffset: 128 };
test("prepared illumination covers the full phase sphere independently of shadows", () => {
  for (const [direction, frame, angle] of [[[0, 0, -1], 0, 0], [[0, 0, 1], 127, 0],
    [[1, 0, 0], 64, 0], [[0, 1, 0], 64, 90], [[-1, 0, 0], 64, -180], [[0, -1, 0], 64, -90]]) {
    const on = preparedIlluminationState(plan, direction, true);
    const off = preparedIlluminationState(plan, direction, false);
    assert.deepEqual(on, { phaseFrame: frame, frame, rollDegrees: angle });
    assert.deepEqual(off, { ...on, frame: frame + 128 });
    assert.deepEqual(preparedIlluminationState({ ...plan, shadowlessFrameOffset: undefined }, direction, false), on);
  }
});
test("missing decoded material retains the applied image and rotation together", () => {
  const element = { style: {} }, p = { url: "prepared.webp", backgroundPosition: "0px 0px", backgroundSize: "512px 512px" };
  assert.equal(publishPreparedIllumination(element, p, 20).writes, 3);
  const before = { ...element.style };
  assert.equal(publishPreparedIllumination(element, null, 80), false);
  assert.deepEqual(element.style, before);
  assert.equal(publishPreparedIllumination(element, p, 20).writes, 0);
  let angle;
  publishPreparedIllumination(element, p, 90, value => angle = value);
  assert.equal(angle, 90);
});
test("prepared illumination rejects malformed directions and overlapping modes", () => {
  assert.throws(() => preparedIlluminationState(plan, [1, 0, 1]), /Invalid/);
  assert.throws(() => preparedIlluminationState({ ...plan, shadowlessFrameOffset: 1 }, [1, 0, 0], false), /offset/);
});
