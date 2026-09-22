import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { subdividedOctahedron } from './ellipsoid-parameters.mts';
import { parseObjShape } from './obj-shape.mts';
import { refineCameraByLimb, rotateCamera, rotationOf, limbThreshold, observedLimb } from './limb-refinement.mts';

// A 300 x 240 x 180 m ellipsoid, seen from 60 km by a 1 m focal length behind 10 µm pixels (100,000 px/rad, 0.6 m/px).
const axes = [300, 240, 180], { unit, faces } = subdividedOctahedron(5);
const mesh = parseObjShape([...unit.map(v => `v ${v.map((n, i) => n * axes[i]).join(' ')}`), ...faces.map(f => `f ${f.map(i => i + 1).join(' ')}`)].join('\n'),
  { metersPerUnit: 1, expectedVertices: unit.length, expectedFaces: faces.length });
const width = 1024, height = 1024, focal = 1e5, centre = [(width - 1) / 2, (height - 1) / 2];
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (v: readonly number[]) => { const n = Math.hypot(...v); return v.map(x => x / n); };
/** A pinhole looking from `eye` (km) at the origin with `up` roughly along body +Z; columns follow the camera +X axis, rows -Y. */
function camera(eye: number[], sun: number[], roll = 0) {
  const forward = norm(eye.map(v => -v)), right0 = norm([forward[1], -forward[0], 0]), c = Math.cos(roll), s = Math.sin(roll);
  const up0 = [forward[1] * right0[2] - forward[2] * right0[1], forward[2] * right0[0] - forward[0] * right0[2], forward[0] * right0[1] - forward[1] * right0[0]];
  const right = right0.map((v, i) => v * c + up0[i] * s), up = up0.map((v, i) => -right0[i] * s + v * c);
  // Instrument frame: X = right, Y = up, boresight -Z = forward. Intrinsic rows: column along +X, row along -Y.
  const R = [right, up, forward.map(v => -v)]; // body -> instrument
  const intrinsic = [[focal, 0, -centre[0]], [0, -focal, -centre[1]], [0, 0, -1]];
  const P = intrinsic.map(row => [0, 1, 2].map(j => row[0] * R[0][j] + row[1] * R[1][j] + row[2] * R[2][j]));
  const scale = Math.hypot(...P[2]);
  const matrix = P.map(row => row.map(v => v / scale)).map(row => [...row, -dot(row, eye)]);
  // rayMatrix = R^T K^-1; K^-1 for the rows above: ray(x, y) = R^T [(x - cx)/f, -(y - cy)/f, -1].
  const rayMatrix = [0, 1, 2].map(i => [R[0][i] / focal, -R[1][i] / focal, -R[0][i] * centre[0] / focal + R[1][i] * centre[1] / focal - R[2][i]]);
  return { schema: 'cssearth-archived-camera@1', matrix, rayMatrix, positionKm: eye, sunDirection: norm(sun) };
}
const project = (matrix: number[][], p: number[]) => { const h = matrix.map(row => row[0] * p[0] + row[1] * p[1] + row[2] * p[2] + row[3]); return [h[0] / h[2], h[1] / h[2], h[2]]; };
/** Lambert-shaded image of the mesh through `cam`, 3 x 3 samples per pixel so limb pixels carry fractional coverage: 0.5 on lit surface scaled by cos(incidence), zero space and unlit surface. */
function render(cam: ReturnType<typeof camera>) {
  const eye = cam.positionKm.map(v => v * 1000), image = new Float32Array(width * height);
  const normals = mesh.indices.map(indices => { const [a, b, c] = indices.map(i => mesh.positions[i]); const u = b.map((v, k) => v - a[k]), w = c.map((v, k) => v - a[k]); return norm([u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]); });
  const offsets = [-1 / 3, 0, 1 / 3];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let sum = 0, any = false;
    for (const dy of offsets) for (const dx of offsets) {
      const ray = norm(cam.rayMatrix.map(row => row[0] * (x + dx) + row[1] * (y + dy) + row[2])), hit = mesh.intersect(eye, ray);
      if (!hit) continue;
      any = true; sum += 0.5 * Math.max(0, dot(normals[hit.faceId], cam.sunDirection)) / 9;
    }
    if (any) image[y * width + x] = sum + 0.002 * ((x * 7 + y * 13) % 5); // a little texture
  }
  return image;
}
const policy = { method: 'mesh-limb', maximumCorrectionDegrees: 1, maximumResidualPixels: 0.75, minimumControls: 40, searchPixels: 400 };
const truth = camera([0, -60, 20], [1, -1, 0.3]);
const image = render(truth);
const frame = { width, height, planes: { IMAGE: image } };

test('the edge budget retains every side of the body when it downsamples', () => {
  const size = 100, values = new Float32Array(size * size);
  for (let y = 20; y < 80; y++) for (let x = 20; x < 80; x++) values[y * size + x] = 1;
  const square = { width: size, height: size, planes: { IMAGE: values } };
  for (const budget of [140, 90]) {
    const edges = observedLimb(square, 0.1, budget, 1);
    assert.equal(edges.length, budget);
    assert.equal(new Set(edges.map(p => `${p.x},${p.y}`)).size, budget);
    for (const partition of ['fit', 'holdout']) {
      const points = edges.filter(p => p.partition === partition);
      assert.ok(points.some(p => p.y < 21), `${partition} retains the top edge`);
      assert.ok(points.some(p => p.y > 78), `${partition} retains the bottom edge`);
      assert.ok(points.some(p => p.x < 21), `${partition} retains the left edge`);
      assert.ok(points.some(p => p.x > 78), `${partition} retains the right edge`);
    }
  }
});

test('fixed nonlinear detector distortion is retained during pointing refinement', () => {
  // An analytically invertible quadratic shear, independent of the camera fitter.
  // Its displacement varies across the limb, so a pointing shift cannot absorb it.
  const shear = (y: number) => 0.0007 * (y - centre[1]) ** 2;
  const pixelMapping = {
    toPinhole: (x: number, y: number) => [x + shear(y), y],
    fromPinhole: (x: number, y: number) => [x - shear(y), y],
  };
  const distorted = new Float32Array(image.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sample = x + shear(y), left = Math.floor(sample), fraction = sample - left;
    if (left >= 0 && left + 1 < width) distorted[y * width + x] = (1 - fraction) * image[y * width + left] + fraction * image[y * width + left + 1];
  }
  const perturbed = rotateCamera(truth, [0.00015, 0, -0.0001]);
  const mappedFrame = { width, height, planes: { IMAGE: distorted }, camera: perturbed, pixelMapping };
  const result = refineCameraByLimb(mappedFrame, mesh, policy);
  assert.ok(result.report.residuals.after.holdout.rmsPixels <= policy.maximumResidualPixels);
  assert.equal(result.report.pixelCoordinates, 'native detector; fixed distortion applied before ray rotation');
  for (const point of [[0, 0, 0], [0.2, 0, 0], [0, 0.15, 0.1], [-0.1, -0.1, -0.12]]) {
    const a = project(truth.matrix, point), b = project(result.camera.matrix, point);
    const expected = pixelMapping.fromPinhole(a[0], a[1]), actual = pixelMapping.fromPinhole(b[0], b[1]);
    assert.ok(Math.hypot(actual[0] - expected[0], actual[1] - expected[1]) < 1, 'Recovered camera agrees at independent native-pixel controls.');
  }
  assert.throws(() => refineCameraByLimb({ ...mappedFrame, pixelMapping: undefined }, mesh, policy), /Limb refinement/);
});

test('a camera perturbed by hundreds of pixels is recovered from the lit limb to a fraction of a pixel', () => {
  const { threshold, split, bodyMean } = limbThreshold(image, () => true);
  assert.ok(threshold > 0 && threshold < 0.05 && split > threshold, `threshold ${threshold} below the class split ${split}`);
  const edges = observedLimb(frame, threshold, 600, bodyMean);
  assert.ok(edges.length >= 500, `${edges.length} edge points`);
  // 2.4 mrad across the line of sight (240 px) and 0.1° of roll about it; a partial elliptical limb constrains roll only weakly.
  const boresight = norm(truth.positionKm.map(v => -v)), across = norm([boresight[1], -boresight[0], 0]);
  const perturbed = rotateCamera(truth, across.map((v, i) => v * 0.0024 + boresight[i] * 0.00175));
  const shifted = project(perturbed.matrix, [0, 0, 0]);
  assert.ok(Math.hypot(shifted[0] - centre[0], shifted[1] - centre[1]) > 200, `perturbation moved the centre by ${Math.hypot(shifted[0] - centre[0], shifted[1] - centre[1])} px`);
  const { camera: refined, report } = refineCameraByLimb({ ...frame, camera: perturbed }, mesh, policy);
  // Body-fixed points in kilometres on and around the 300 m body, up to 330 px from the image centre.
  for (const point of [[0, 0, 0], [0.2, 0, 0], [0, 0.15, 0.1], [-0.1, -0.1, -0.12]]) {
    const a = project(truth.matrix, point), b = project(refined.matrix, point), off = Math.hypot(a[0] - centre[0], a[1] - centre[1]);
    // The centre returns to within the limb's own scatter; points 330 px out also carry the weakly constrained roll.
    assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) < (off < 50 ? 0.6 : 1), `point ${point} projects ${Math.hypot(a[0] - b[0], a[1] - b[1])} px from the truth`);
  }
  // The rotation across the line of sight is recovered to a hundredth of a degree. Roll about it is nearly unobservable on
  // a smooth ellipse: 0.1° moves this outline by under 0.2 px along its normals, below the limb scatter, so only its order is checked.
  const omega = report.correction.rotationVectorMicroradians.map(v => v * 1e-6), rollRadians = omega[0] * boresight[0] + omega[1] * boresight[1] + omega[2] * boresight[2];
  const acrossRadians = Math.hypot(...omega.map((v, i) => v - rollRadians * boresight[i]));
  assert.ok(Math.abs(acrossRadians - 0.0024) * 180 / Math.PI < 0.01, `across-boresight correction ${(acrossRadians * 180 / Math.PI).toFixed(4)}° against 0.1375°`);
  assert.ok(Math.abs(rollRadians + 0.00175) * 180 / Math.PI < 0.25, `roll correction ${(rollRadians * 180 / Math.PI).toFixed(4)}° against -0.1003°`);
  assert.ok(report.residuals.before.holdout.rmsPixels > 100 && report.residuals.after.holdout.rmsPixels < 0.6, JSON.stringify(report.residuals));
  assert.ok(report.correction.boresightShiftPixels > 200);
  assert.ok(report.edgePoints.unlitOrUnmatched > 0, 'terminator edges were set aside');
  assert.equal(report.edgePoints.fit + report.edgePoints.holdout, report.edgePoints.lit);
});

test('the budget refuses a correction larger than declared and residuals above the limit', () => {
  const boresight = norm(truth.positionKm.map(v => -v)), across = norm([boresight[1], -boresight[0], 0]);
  const perturbed = rotateCamera(truth, across.map(v => v * 0.002));
  assert.throws(() => refineCameraByLimb({ ...frame, camera: perturbed }, mesh, { ...policy, maximumCorrectionDegrees: 0.05 }), /exceeds the 0.05° budget/);
  assert.throws(() => refineCameraByLimb({ ...frame, camera: perturbed }, mesh, { ...policy, maximumResidualPixels: 0.001 }), /holdout points within/);
  assert.throws(() => refineCameraByLimb({ ...frame, camera: perturbed }, mesh, { ...policy, minimumControls: 5000 }), /edge points within/);
  assert.throws(() => refineCameraByLimb({ ...frame, camera: perturbed }, mesh, { ...policy, method: 'landmarks' }), /Unsupported camera refinement/);
});

test('an unperturbed camera stays where it is', () => {
  const { report } = refineCameraByLimb({ ...frame, camera: truth }, mesh, policy);
  assert.ok(report.correction.boresightShiftPixels < 0.3, `shift ${report.correction.boresightShiftPixels} px`);
  assert.ok(report.residuals.after.holdout.rmsPixels < 0.3);
  const r = rotationOf([0, 0, Math.PI / 2]);
  assert.ok(Math.abs(r[0][1] + 1) < 1e-12 && Math.abs(r[1][0] - 1) < 1e-12);
});
