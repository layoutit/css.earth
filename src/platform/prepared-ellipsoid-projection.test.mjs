import assert from "node:assert/strict";
import test from "node:test";
import { createPreparedEllipsoidProjection, readPreparedMatrix4, readPreparedCounterMatrix } from "./prepared-ellipsoid-projection.mjs";

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const translate = (x, y) => [...identity.slice(0, 12), x, y, 0, 1];
function fixture({ equatorialRadius = 20, polarRadius = 10, coverageScale = 1, width = 100, height = 100 } = {}) {
  const projection = { equatorialRadius, polarRadius, coverageScale,
    bodySystemMatrix: identity, bodyMeshMatrix: identity, materialSystemMatrix: identity, materialMeshMatrix: identity,
    baseProjection: translate(-width / 2, -height / 2), centerTranslation: translate(width / 2, height / 2),
    inverseCenterTranslation: translate(-width / 2, -height / 2) };
  return { projection, width, height, publish: createPreparedEllipsoidProjection({ projection, width, height }) };
}
const rotationX = degrees => {
  const r = degrees * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
};

test("shape parameters project the independent analytic ellipsoid support at all viewing inclinations", () => {
  let samples = 0;
  for (const shape of [{}, { equatorialRadius: 40, polarRadius: 40, width: 256, height: 64 },
    { equatorialRadius: 40, polarRadius: 7, coverageScale: 1.05, width: 192, height: 96 },
    { equatorialRadius: 9, polarRadius: 30, width: 17, height: 51 }]) {
    const f = fixture(shape);
    const a = f.projection.equatorialRadius * f.projection.coverageScale, c = f.projection.polarRadius * f.projection.coverageScale;
    for (const pitch of [0, 13, 40, 89, 90, 112, 180, 271, 360]) for (const roll of [-181, -60, 0, 31, 180]) {
      const matrix = readPreparedMatrix4(f.publish({ degrees: roll, sceneMatrix: rotationX(pitch), counterMatrix: rotationX(-pitch) }));
      // Scene and counter are inverses. Material screen X/Y support follows
      // directly from the two texture-axis vectors, independent of the solver.
      const center = [matrix[0] * f.width / 2 + matrix[4] * f.height / 2 + matrix[12],
        matrix[1] * f.width / 2 + matrix[5] * f.height / 2 + matrix[13]];
      assert.ok(center.every(value => Math.abs(value) < 1e-8), `center ${center}`);
      const sine = Math.sin(pitch * Math.PI / 180), cosine = Math.cos(pitch * Math.PI / 180);
      for (const angle of [0, 0.3, 0.8, 1.7, 2.9]) {
        const x = Math.cos(angle), y = Math.sin(angle);
        const expected = Math.hypot(a * x, Math.sqrt(a * a * cosine * cosine + c * c * sine * sine) * y);
        const actual = Math.hypot((x * matrix[0] + y * matrix[1]) * f.width / 2,
          (x * matrix[4] + y * matrix[5]) * f.height / 2);
        assert.ok(Math.abs(expected - actual) < 1e-8, JSON.stringify({ shape, pitch, roll, angle, expected, actual }));
        samples++;
      }
    }
  }
  assert.equal(samples, 900);
});

test("the approved default preserves the prepared texture basis while applying only light roll", () => {
  const f = fixture();
  assert.deepEqual(readPreparedMatrix4(f.publish({ degrees: 0, preserveDefault: true })), f.projection.baseProjection);
  const rotated = readPreparedMatrix4(f.publish({ degrees: 90, preserveDefault: true }));
  assert.deepEqual(rotated, [0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, 50, -50, 0, 1]);
});

test("prepared ellipsoid publication has no DOM dependency and snapshots immutable preparation inputs", () => {
  const f = fixture(), view = { degrees: 40, sceneMatrix: identity, counterMatrix: identity };
  const first = f.publish(view);
  f.projection.baseProjection[12] = 9999;
  assert.equal(f.publish(view), first);
  assert.equal(f.publish({ ...view, sceneMatrix: `matrix3d(${identity})`, counterMatrix: `matrix3d(${identity})` }), first);
});

test("incompatible dimensions, views, and singular projection fail before returning a CSS transform", () => {
  for (const shape of [{ equatorialRadius: 0 }, { polarRadius: Infinity }, { coverageScale: -1 }, { width: 0 }]) {
    assert.throws(() => fixture(shape), /positive and finite/);
  }
  const f = fixture();
  assert.throws(() => f.publish({ degrees: NaN }), /finite/);
  assert.throws(() => f.publish({ degrees: 0, sceneMatrix: "rotateX(30deg)", counterMatrix: identity }), /matrix3d/);
  assert.throws(() => f.publish({ degrees: 0, sceneMatrix: [1], counterMatrix: identity }), /finite matrix/);
  assert.throws(() => f.publish({ degrees: 0, sceneMatrix: new Array(16).fill(0), counterMatrix: identity }), /singular/);
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
