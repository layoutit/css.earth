import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { subdividedOctahedron } from './ellipsoid-parameters.mts';
import { parseObjShape } from './obj-shape.mts';
import { refineStripEpochs, type EpochOffsets, type RefinableStrip, type StripRefinementPolicy } from './strip-refinement.mts';
import { dot3 as dot } from '../../../src/platform/vector3.mts';

// An ellipsoid with 300, 240 and 180 m semi-axes seen from about 60 km by a spinning strip camera: 40,000 px/rad, strips 640 x 64 pixels
// taken every 0.4 s while the spin carries the scene 56 rows per strip, and a spacecraft that drifts across the line of sight.
const axes = [300, 240, 180], { unit, faces } = subdividedOctahedron(5);
const mesh = parseObjShape([...unit.map(v => `v ${v.map((n, i) => n * axes[i]).join(' ')}`), ...faces.map(f => `f ${f.map(i => i + 1).join(' ')}`)].join('\n'),
  { metersPerUnit: 1, expectedVertices: unit.length, expectedFaces: faces.length });
const width = 640, height = 64, focal = 4e4, centre = [(width - 1) / 2, (height - 1) / 2], interval = 0.4, spin = 56 / focal / interval, strips = 11;
const norm = (v: readonly number[]) => { const n = Math.hypot(...v); return v.map(x => x / n); };
const cross = (a: readonly number[], b: readonly number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sun = norm([1, -1, 0.3]), start = [0, -60, 20], velocityKmS = norm(cross([0, 0, 1], start)).map(v => v * 0.03);

/** Strip `index` at the two epochs: the spacecraft is taken at the ephemeris epoch, and the pointing epoch turns the camera about its X axis. */
function camera(index: number, offsets: EpochOffsets) {
  const taken = index * interval + offsets.pointingSeconds, at = taken + offsets.ephemerisSeconds, eye = start.map((v, k) => v + velocityKmS[k] * at);
  const forward0 = norm(start.map(v => -v)), right = norm(cross(forward0, [0, 0, 1])), down0 = cross(forward0, right);
  // The spin turns the boresight about the camera's X axis; the middle strip looks at the body at its nominal epoch.
  const angle = spin * (taken - (strips - 1) / 2 * interval), c = Math.cos(angle), s = Math.sin(angle);
  const forward = forward0.map((v, k) => v * c + down0[k] * s), down = down0.map((v, k) => v * c - forward0[k] * s);
  const R = [right, down, forward], intrinsic = [[focal, 0, centre[0]], [0, focal, centre[1]], [0, 0, 1]];
  const P = intrinsic.map(row => [0, 1, 2].map(j => row[0] * R[0][j] + row[1] * R[1][j] + row[2] * R[2][j]));
  const rayMatrix = [0, 1, 2].map(i => [R[0][i] / focal, R[1][i] / focal, -R[0][i] * centre[0] / focal - R[1][i] * centre[1] / focal + R[2][i]]);
  return { schema: 'cssearth-archived-camera@1', matrix: P.map(row => [...row, -dot(row, eye)]), rayMatrix, positionKm: eye, sunDirection: sun };
}

/** Lambert-shaded strip through `cam`, 3 x 3 samples per pixel so limb pixels carry fractional coverage. */
function render(cam: ReturnType<typeof camera>) {
  const eye = cam.positionKm.map(v => v * 1000), image = new Float32Array(width * height), offsets = [-1 / 3, 0, 1 / 3];
  const normals = mesh.indices.map(indices => { const [a, b, c] = indices.map(i => mesh.positions[i]); return norm(cross(b.map((v, k) => v - a[k]), c.map((v, k) => v - a[k]))); });
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let sum = 0, any = false;
    for (const dy of offsets) for (const dx of offsets) {
      const hit = mesh.intersect(eye, norm(cam.rayMatrix.map(row => row[0] * (x + dx) + row[1] * (y + dy) + row[2])));
      if (!hit) continue;
      any = true; sum += 0.5 * Math.max(0, dot(normals[hit.faceId], sun)) / 9;
    }
    if (any) image[y * width + x] = sum + 0.002 * ((x * 7 + y * 13) % 5);
  }
  return image;
}

const truth: EpochOffsets = { pointingSeconds: 0.03, ephemerisSeconds: 0.9 };
const pinhole = { toPinhole: (x: number, y: number) => [x, y], fromPinhole: (x: number, y: number) => [x, y] };
const image: RefinableStrip[] = Array.from({ length: strips }, (_, index) => ({ id: `strip-${index}`, image: { width, height, planes: { IMAGE: render(camera(index, truth)) } }, pixelMapping: pinhole,
  camera: offsets => camera(index, offsets) }));
const policy: StripRefinementPolicy = { method: 'mesh-limb-epochs', maximumPointingSeconds: 0.05, maximumEphemerisSeconds: 3, maximumResidualPixels: 0.75, minimumControls: 40, maximumControls: 1200, searchPixels: 64 };

test('both epochs of a push-frame image are recovered from the lit limb its strips show', () => {
  const { offsets, report } = refineStripEpochs(image, mesh, policy);
  // The pointing epoch moves the scene along the scan, 140 rows a second here; the ephemeris epoch moves it across, 20 columns a second.
  assert.ok(Math.abs(offsets.pointingSeconds - truth.pointingSeconds) < 0.004, `pointing epoch ${offsets.pointingSeconds}`);
  assert.ok(Math.abs(offsets.ephemerisSeconds - truth.ephemerisSeconds) < 0.03, `ephemeris epoch ${offsets.ephemerisSeconds}`);
  assert.ok(report.residuals.before.holdout.rmsPixels > 10 && report.residuals.after.holdout.rmsPixels < 0.75, JSON.stringify(report.residuals));
  assert.ok(report.edgePoints.fit >= 40 && report.edgePoints.holdout >= 40 && report.holdoutMatchedFraction > 0.9);
});

test('an offset beyond its budget, too few limb points and an invalid policy are refused', () => {
  assert.throws(() => refineStripEpochs(image, mesh, { ...policy, maximumEphemerisSeconds: 0.5 }), /moved the pointing epoch .* and the ephemeris epoch .* the budget/u);
  assert.throws(() => refineStripEpochs(image.slice(5, 6), mesh, { ...policy, minimumControls: 400, maximumControls: 1200 }), /limb points within 64 px; 400 of each are required/u);
  for (const invalid of [{ method: 'mesh-limb' }, { maximumPointingSeconds: 0.3 }, { maximumEphemerisSeconds: 6 }, { maximumResidualPixels: 0 }, { minimumControls: 8 }, { maximumControls: 60 }, { searchPixels: 4 }])
    assert.throws(() => refineStripEpochs(image, mesh, { ...policy, ...invalid } as StripRefinementPolicy), /Invalid strip epoch refinement/u, JSON.stringify(invalid));
});
