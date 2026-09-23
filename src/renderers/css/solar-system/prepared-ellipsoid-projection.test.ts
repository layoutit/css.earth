import assert from "node:assert/strict";
import { test } from "vitest";
import { createPreparedEllipsoidProjection, readPreparedMatrix4, readPreparedCounterMatrix } from "../prepared-data/prepared-ellipsoid-projection.js";

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const translate = (x: number, y: number) => [...identity.slice(0, 12), x, y, 0, 1];
function fixture({ equatorialRadius = 20, polarRadius = 10, coverageScale = 1, width = 100, height = 100 } = {}) {
  const projection = { equatorialRadius, polarRadius, coverageScale,
    bodySystemMatrix: identity, bodyMeshMatrix: identity, materialSystemMatrix: identity, materialMeshMatrix: identity,
    baseProjection: translate(-width / 2, -height / 2), centerTranslation: translate(width / 2, height / 2),
    inverseCenterTranslation: translate(-width / 2, -height / 2) };
  return { projection, width, height, publish: createPreparedEllipsoidProjection({ projection, width, height }) };
}
const physical = { focalPixels: 800, principalOffsetPixels: [0, 0] as const,
  eyeFromScene: [...identity.slice(0, 12), 0, 0, -100, 1] };

test("prepared ellipsoid publication has no DOM dependency and snapshots immutable preparation inputs", () => {
  const f = fixture(), view = { degrees: 40, projection: physical, counterMatrix: identity };
  const first = f.publish(view);
  f.projection.baseProjection[12] = 9999;
  assert.equal(f.publish(view), first);
  assert.equal(f.publish({ ...view, counterMatrix: `matrix3d(${identity})` }), first);
});

test("incompatible dimensions, views, and singular projection fail before returning a CSS transform", () => {
  for (const shape of [{ equatorialRadius: 0 }, { polarRadius: Infinity }, { coverageScale: -1 }, { width: 0 }]) {
    assert.throws(() => fixture(shape), /positive and finite/);
  }
  const f = fixture();
  assert.throws(() => f.publish({ degrees: NaN, projection: physical, counterMatrix: identity }), /finite/);
  assert.throws(() => f.publish({ degrees: 0, projection: physical, counterMatrix: "rotateX(30deg)" }), /matrix3d/);
  assert.throws(() => f.publish({ degrees: 0, projection: physical, counterMatrix: [1] }), /finite matrix/);
  assert.throws(() => f.publish({ degrees: 0, projection: physical, counterMatrix: new Array(16).fill(0) }), /singular/);
});

test("prepared numeric transport preserves native counter receipts including signs, small values and exponent fallback", () => {
  const transport = { counterPrecision: 6, counterFractionDigits: 7, counterFractionScale: 0.000000100000000000000009 };
  const cases = [[-0.060290289894, -0.0602902], [0.282708976004, 0.282709], [0.06821008429402178, 0.06821],
    [-0.483003530411, -0.483004], [0.00000199999, 0.0000019], [1e-8, 1e-8], [-1e-12, -1e-12]];
  for (const [input, expected] of cases) {
    const matrix = [...identity]; matrix[0] = input;
    assert.equal(readPreparedCounterMatrix(`matrix3d(${matrix})`, transport)[0], expected);
  }
  const mixed = [...identity]; mixed[0] = 0.060290299999; mixed[1] = 1e-8;
  assert.equal(readPreparedCounterMatrix(`matrix3d(${mixed})`, transport)[0], 0.0602903);
  assert.deepEqual(readPreparedCounterMatrix(mixed, {}), mixed);
});
