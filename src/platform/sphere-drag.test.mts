import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { projectSphereDrag, composeDragRotation, rotationFromAngularVelocity } from "@cssearth/engine";

const metrics = { centerX: 704, centerY: 479.5, radius: 295.4867,
  focalLength: 1408 * Math.sqrt(3) / 2 };
type DragGeometry = Omit<Parameters<typeof projectSphereDrag>[0], "previousX" | "previousY" | "currentX" | "currentY">;
const drag = (a: readonly number[], b: readonly number[], geometry: DragGeometry = metrics) => projectSphereDrag({ ...geometry,
  previousX: a[0], previousY: a[1], currentX: b[0], currentY: b[1] });
const close = (a: readonly number[], b: readonly number[]) => a.forEach((value, i) =>
  assert.ok(Math.abs(value - b[i]) < 1e-10, `${a} differs from ${b}`));

test("off-centre vertical drags retain the rotation around the view axis", () => {
  const left = drag([660, 410], [660, 550]);
  const right = drag([748, 410], [748, 550]);
  assert.ok(left[0] < 0 && right[0] < 0);
  assert.ok(left[2] < 0 && right[2] > 0);
  close(drag([704, 410], [704, 550]).slice(1, 3), [0, 0]);
});

test("returning along a drag restores the complete orientation", () => {
  const a = [650, 530], b = [780, 420];
  close(composeDragRotation(drag(b, a), drag(a, b)), [0, 0, 0, 1]);
  close(drag(a, a), [0, 0, 0, 1]);
});

test("coalesced samples preserve their order, including view-axis rotation", () => {
  const a = [680, 530], b = [750, 420], c = [800, 500];
  const ordered = composeDragRotation(drag(b, c), drag(a, b));
  const reversed = composeDragRotation(drag(a, b), drag(b, c));
  assert.ok(Math.abs(ordered[2] - reversed[2]) > 0.01);
  assert.ok(Math.abs(Math.hypot(...ordered) - 1) < 1e-12);
  // A closed curved path has no net X/Y travel but can still rotate the view.
  const loop = composeDragRotation(drag(c, a), ordered);
  assert.ok(Math.abs(loop[2]) > 0.01);
});

test("projection is independent of CSS-pixel scale and viewport position", () => {
  const a = [650, 530], b = [780, 420];
  const translated = { ...metrics, centerX: metrics.centerX + 33,
    centerY: metrics.centerY - 81 };
  close(drag(a, b), drag([683, 449], [813, 339], translated));
  const doubled = { centerX: metrics.centerX * 2, centerY: metrics.centerY * 2, radius: metrics.radius * 2, focalLength: metrics.focalLength * 2 };
  close(drag(a, b), drag(a.map(v => v * 2), b.map(v => v * 2), doubled));
});

test("off-axis bodies transport drag axes into the optical frame without changing speed", () => {
  const a = [650, 530], b = [780, 420];
  const centered = drag(a, b);
  for (const [dx, dy] of [[0, 70], [80, 0], [-55, 90], [55, -90]]) {
    const geometry = { ...metrics, opticalCenterX: metrics.centerX - dx,
      opticalCenterY: metrics.centerY - dy };
    const angle = Math.atan2(Math.hypot(dx, dy), metrics.focalLength);
    const axis = [dy, -dx, 0].map(v => v / Math.hypot(dx, dy));
    const basis = [...axis.map(v => v * Math.sin(angle / 2)), Math.cos(angle / 2)];
    const inverse = basis.map((v, i) => i < 3 ? -v : v);
    const expected = composeDragRotation(basis, composeDragRotation(centered, inverse));
    const actual = drag(a, b, geometry);
    close(actual, expected);
    assert.equal(actual[3], centered[3], "basis transport does not change angular sensitivity");
    close(composeDragRotation(drag(b, a, geometry), actual), [0, 0, 0, 1]);
    const doubled = { centerX: geometry.centerX * 2, centerY: geometry.centerY * 2, radius: geometry.radius * 2, focalLength: geometry.focalLength * 2, opticalCenterX: geometry.opticalCenterX * 2, opticalCenterY: geometry.opticalCenterY * 2 };
    close(actual, drag(a.map(v=>v*2), b.map(v=>v*2), doubled));
  }
  close(centered, drag(a, b, { ...metrics,
    opticalCenterX: metrics.centerX, opticalCenterY: metrics.centerY }));
});

test("the limb and off-disc continuation remain finite and continuous", () => {
  const limb = metrics.centerX + metrics.radius;
  const across = drag([limb - 1e-6, metrics.centerY], [limb + 1e-6, metrics.centerY]);
  assert.ok(Math.abs(across[1]) < 0.0001);
  for (const x of [limb + 1, limb + 100, limb + 1000]) {
    const q = drag([x, metrics.centerY], [x + 1, metrics.centerY]);
    assert.ok(q.every(Number.isFinite));
    close(q, [0,0,0,1]);
    assert.ok(Math.abs(Math.hypot(...q) - 1) < 1e-12);
  }
  const outside = drag([limb + 100, metrics.centerY],
    [metrics.centerX, metrics.centerY + metrics.radius + 100]);
  const onRim = drag([limb, metrics.centerY],
    [metrics.centerX, metrics.centerY + metrics.radius]);
  close(outside, onRim);
  assert.throws(() => drag([0, 0], [1, 1], { ...metrics, radius: 0 }));
});

test("coasting follows one rotation axis at either refresh rate", () => {
  const velocity = [-0.0002, 0.0001, 0.0003];
  close(rotationFromAngularVelocity([0, 0, 0], 16), [0, 0, 0, 1]);
  close(rotationFromAngularVelocity(velocity, 0), [0, 0, 0, 1]);
  for (const step of [1000 / 60, 1000 / 120]) {
    let q: readonly number[] = [0, 0, 0, 1];
    let total = 0;
    let decay = 1;
    for (let i = 0; i < 12; i++) {
      decay *= 1 - step / 1200;
      const elapsed = step * decay;
      total += elapsed;
      q = composeDragRotation(rotationFromAngularVelocity(velocity, elapsed), q);
    }
    close(q, rotationFromAngularVelocity(velocity, total));
  }
});
