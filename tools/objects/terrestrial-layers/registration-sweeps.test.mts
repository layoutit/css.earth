import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import { rotate } from '@cssearth/spice';
import { controlledShapeCamera, type CameraImage } from './shape-camera-mosaic.mts';
import { observerCamera, type BodyOrientation, type ObserverSighting } from './observer-camera.mts';
import { framesReference, limbCentre, observationCaster, observerCaster, prepareFrame, radiusFieldMesh, registrationSweep, turnedOrientation, type SurfaceReference } from './registration-sweeps.mts';

const DEGREE = Math.PI / 180, J2000 = 2451545;

/** A body whose pole is the J2000 +z axis, turning once every twelve hours. */
const base: BodyOrientation = {
  rotation: jd => rotate((30 + 720 * (jd - J2000)) * DEGREE, 3),
  phaseDegrees: jd => 30 + 720 * (jd - J2000),
};
/** A 100 km sphere; the observer on the equator one astronomical unit away, the Sun 10 degrees from the line back to the observer, which from the body lies at right ascension 180: the phase angle of a main-belt body near opposition. */
const sphere = radiusFieldMesh(() => 100_000, 5);
const sighting = (center: [number, number]): ObserverSighting => ({ epochJd: J2000 + 3.1, targetRightAscensionDegrees: 0, targetDeclinationDegrees: 0, rangeAu: 1,
  sunRightAscensionDegrees: 190, sunDeclinationDegrees: 0, pixelAngleMicroradians: 0.0134, center });

/** A fixed pattern of markings on the sphere: waves a few tens of degrees across whose periods share no divisor, so no turn short of a full one repeats it. */
const markings: SurfaceReference = { sample(lon, lat) {
  let value = 100;
  for (let k = 1; k <= 12; k++) value += 12 * Math.cos(((0.7 + 0.6 * k) * lon + (0.5 + 0.45 * k) * lat + 40 * k) * DEGREE) * Math.cos(((0.9 + 0.35 * k) * lat - 7 * k) * DEGREE);
  return value;
} };

/** The outward normal of the face a ray hit: the faceted sphere is the truth surface, so its faces shade the rendering. */
function normalOf(faceId: number) {
  const [a, b, c] = sphere.indices[faceId].map(i => sphere.positions[i]), u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], length = Math.hypot(n[0], n[1], n[2]) * (n[0] * a[0] + n[1] * a[1] + n[2] * a[2] >= 0 ? 1 : -1);
  return n.map(k => k / length);
}

/** An independent rendering: cast every pixel through the camera the route states, shade the markings by the Sun. */
function render(orientation: BodyOrientation, center: [number, number], reference: SurfaceReference, epochJd?: number, size = 128): CameraImage {
  const s = { ...sighting(center), ...(epochJd === undefined ? {} : { epochJd }) };
  const camera = controlledShapeCamera(observerCamera(s, orientation)), data = new Float64Array(size * size), eye = Array.from(camera.position);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const direction = Array.from(camera.ray(x, y)), hit = sphere.intersect(eye, direction);
    if (!hit) continue;
    const p = [0, 1, 2].map(k => eye[k] + direction[k] * hit.radius), r = Math.hypot(p[0], p[1], p[2]), n = normalOf(hit.faceId);
    const cosine = Math.max(0, n[0] * camera.sun[0] + n[1] * camera.sun[1] + n[2] * camera.sun[2]);
    data[y * size + x] = (reference.sample(Math.atan2(p[1], p[0]) / DEGREE, Math.asin(p[2] / r) / DEGREE) ?? 0) * cosine;
  }
  return { data, width: size, height: size };
}

test('a radius field becomes a closed mesh that rays enter at the stated radius', () => {
  assert.equal(sphere.vertices, 72 * 36);
  assert.equal(sphere.faces, 2 * 72 * 35);
  const hit = sphere.intersect([300_000, 0, 0], [-1, 0, 0]);
  assert.ok(hit && Math.abs(hit.radius - 200_000) < 500, 'the ray reaches the sphere 100 km from its centre');
  assert.throws(() => radiusFieldMesh(() => 100_000, 7), /divide/);
  assert.throws(() => radiusFieldMesh(() => null, 5), /no radius/);
});

test('the limb places the disc centre where the frame was rendered, not at its brightness centroid', () => {
  const truth: [number, number] = [70.3, 61.7], image = render(base, truth, markings);
  const limb = limbCentre(image, sighting([0, 0]), base, sphere.positions);
    // A Lambert-lit synthetic disc goes fully dark past its terminator, so the outline on that side sits inside the limb by
  // about R(1 - cos α) at phase angle α; a deconvolved photograph keeps more light there. Two and a half pixels at α = 10°.
  assert.ok(Math.hypot(limb.center[0] - truth[0], limb.center[1] - truth[1]) < 2.5, `limb centre ${limb.center.join(',')} is within the terminator allowance of ${truth.join(',')}`);
  let cx = 0, cy = 0, n = 0, peak = 0;
  for (const v of image.data) peak = Math.max(peak, v);
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) if (image.data[y * image.width + x] > peak / 2) { cx += x; cy += y; n++; }
  assert.ok(Math.hypot(cx / n - truth[0], cy / n - truth[1]) > Math.hypot(limb.center[0] - truth[0], limb.center[1] - truth[1]), 'the centroid of the lit disc sits further from the rendered centre, toward the Sun');
});

test('the sweep recovers a turn of the body and prefers the true handedness', () => {
  const center: [number, number] = [64, 64];
  const turned = render(turnedOrientation(base, 7), center, markings);
  const result = registrationSweep(turned, observerCaster(sighting(center), base), sphere, markings);
  assert.ok(Math.abs(result.exact.offsetDegrees - 7) <= 0.5, `exact peak ${result.exact.offsetDegrees} recovers the seven-degree turn`);
  assert.ok(result.exact.correlation > 0.9, `the prediction at the peak matches the rendering (${result.exact.correlation})`);
  assert.ok(result.atZero < result.exact.correlation - 0.1, 'the untreated model scores lower than the peak');
  assert.ok(result.mirrorMargin > 1.5, `neither mirror competes with the model (${result.mirrorMargin})`);
  // Sampling the reference at a shifted longitude turns the body the other way.
  assert.ok(Math.abs(result.coarse.offsetDegrees + result.exact.offsetDegrees) <= 3, 'the coarse peak states the same turn with the opposite sign');
});

test('a frame rendered with reversed longitudes is told apart from the model', () => {
  const center: [number, number] = [64, 64];
  const mirrored = render(base, center, { sample: (lon, lat) => markings.sample(-lon, lat) });
  const result = registrationSweep(mirrored, observerCaster(sighting(center), base), sphere, markings);
  assert.ok(result.mirrorLongitude.correlation > 0.9, 'the reversed reference explains the frame');
  assert.ok(result.mirrorMargin < 1, `the model does not beat its mirror on a mirrored frame (${result.mirrorMargin})`);
});

test('the body\'s other frames stand in for a map and expose a turned frame', () => {
  const center: [number, number] = [64, 64];
  const frames = [0, 0.05, 0.1, 0.4].map(days => {
    const s = { ...sighting(center), epochJd: J2000 + 3.1 + days };
    return { image: render(base, center, markings, s.epochJd), sighting: s, camera: observerCaster(s, base) };
  });
  const reference = framesReference(frames.slice(1).map(frame => prepareFrame(frame.image, frame.camera, sphere)));
  const held = registrationSweep(frames[0].image, frames[0].camera, sphere, reference, { exactHalfWidth: 4 });
  assert.ok(Math.abs(held.exact.offsetDegrees) <= 1, `a consistent frame peaks at zero (${held.exact.offsetDegrees})`);
  assert.ok(held.mirrorMargin > 1.5, `the frames agree on handedness (${held.mirrorMargin})`);
  const turned = registrationSweep(frames[0].image, observerCaster(frames[0].sighting, turnedOrientation(base, 5)), sphere, reference, { exactHalfWidth: 8 });
  assert.ok(Math.abs(turned.exact.offsetDegrees + 5) <= 1, `a frame under a turned model reports the turn (${turned.exact.offsetDegrees})`);
});

test('any observation camera turns the same way the observer route does, and a reduced frame measures the same turn', () => {
  const center: [number, number] = [64, 64], camera = controlledShapeCamera(observerCamera(sighting(center), base));
  // The same camera as the surface pipeline sees it: position, Sun and rays in body-fixed metres, no orientation to hand back.
  const generic = observationCaster({ positionMeters: Array.from(camera.position), sunDirection: Array.from(camera.sun), ray: (x, y) => Array.from(camera.ray(x, y)), project: p => camera.project(p) });
  const route = observerCaster(sighting(center), base);
  for (const turn of [0, 7, -33]) {
    const a = generic.turned(turn), b = route.turned(turn);
    for (const [x, y] of [[40, 60], [64, 64], [80, 30]]) {
      const ra = a.ray(x, y), rb = b.ray(x, y);
      assert.ok(Math.hypot(ra[0] - rb[0], ra[1] - rb[1], ra[2] - rb[2]) < 1e-9, `turn ${turn}: rays agree at ${x},${y}`);
    }
    assert.ok(Math.hypot(...a.positionMeters.map((n, i) => n - b.positionMeters[i])) < 1e-3, `turn ${turn}: positions agree`);
    const pa = a.project([50_000, 20_000, 10_000]), pb = b.project([50_000, 20_000, 10_000]);
    assert.ok(pa && pb && Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) < 1e-6, `turn ${turn}: projections agree`);
  }
  const rendered = render(turnedOrientation(base, 7), [128, 128], markings, undefined, 256);
  const small = registrationSweep(rendered, observerCaster(sighting([128, 128]), base), sphere, markings, { maximumPixels: 2000 });
  assert.ok(small.reduction === 2, `a disc of some 7,800 lit pixels over a 2,000-pixel budget is reduced twofold (${small.reduction})`);
  assert.ok(Math.abs(small.exact.offsetDegrees - 7) <= 1, `the reduced frame still reports the seven-degree turn (${small.exact.offsetDegrees})`);
});
