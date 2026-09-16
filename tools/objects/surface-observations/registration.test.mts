import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotate } from '../../spice/frames.mts';
import { multiply } from '../../spice/ck.mts';
import { controlledShapeCamera } from '../terrestrial-layers/shape-camera-mosaic.mts';
import { observerCamera, type BodyOrientation, type ObserverSighting } from '../terrestrial-layers/observer-camera.mts';
import { radiusFieldMesh, type SurfaceReference } from '../terrestrial-layers/observer-registration.mts';
import { DECISIVE, referenceRegistration, silhouetteRegistration } from './registration.mts';
import type { FrameDetector, LoadContext, ObservationCamera, ObservationFrame, ObservationImage } from './contract.mts';

const DEGREE = Math.PI / 180, J2000 = 2451545;

/** A body whose pole is the J2000 +z axis, turning once every twelve hours. */
const upright: BodyOrientation = { rotation: jd => rotate((30 + 720 * (jd - J2000)) * DEGREE, 3), phaseDegrees: jd => 30 + 720 * (jd - J2000) };
/** The same body with its pole tilted twenty degrees about the J2000 x axis: a wrong pole, which turns the projected outline on the sky. */
const tilted: BodyOrientation = { rotation: jd => multiply(upright.rotation(jd), rotate(20 * DEGREE, 1)), phaseDegrees: upright.phaseDegrees };
/** An elongated body: a 100 km sphere stretched to 160 km along its x axis. */
const shape = radiusFieldMesh((lon, lat) => { const x = Math.cos(lat * DEGREE) * Math.cos(lon * DEGREE); return 100_000 / Math.sqrt(1 - x * x * (1 - 1 / 1.6 ** 2)); }, 5);
const sighting = (epochJd: number, center: [number, number]): ObserverSighting => ({ epochJd, targetRightAscensionDegrees: 0, targetDeclinationDegrees: 0, rangeAu: 1,
  sunRightAscensionDegrees: 190, sunDeclinationDegrees: 0, pixelAngleMicroradians: 0.0134, center });
const markings: SurfaceReference = { sample(lon, lat) {
  let value = 100;
  for (let k = 1; k <= 12; k++) value += 12 * Math.cos(((0.7 + 0.6 * k) * lon + (0.5 + 0.45 * k) * lat + 40 * k) * DEGREE) * Math.cos(((0.9 + 0.35 * k) * lat - 7 * k) * DEGREE);
  return value;
} };

function normalOf(faceId: number) {
  const [a, b, c] = shape.indices[faceId].map(i => shape.positions[i]), u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], length = Math.hypot(n[0], n[1], n[2]) * (n[0] * a[0] + n[1] * a[1] + n[2] * a[2] >= 0 ? 1 : -1);
  return n.map(k => k / length);
}

/** A camera as the pipeline states one, from the observer route, and the frame it would take of the marked body. */
/** The long axis spans about 80 pixels at this range, so a 256-pixel detector holds the whole disc and a 96-pixel one does not. */
function photograph(id: string, epochJd: number, rendered: BodyOrientation, stated: BodyOrientation, size = 256, shading: 'lambert' | 'deconvolved' = 'lambert'): ObservationFrame {
  const centre: [number, number] = [size / 2, size / 2];
  const render = controlledShapeCamera(observerCamera(sighting(epochJd, centre), rendered)), eye = Array.from(render.position), values = new Float64Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const direction = Array.from(render.ray(x, y)), hit = shape.intersect(eye, direction);
    if (!hit) continue;
    const p = [0, 1, 2].map(k => eye[k] + direction[k] * hit.radius), r = Math.hypot(p[0], p[1], p[2]), n = normalOf(hit.faceId);
    const cosine = Math.max(0, n[0] * render.sun[0] + n[1] * render.sun[1] + n[2] * render.sun[2]);
    // A deconvolved frame keeps most of its light to the terminator; a Lambert disc goes dark there.
    values[y * size + x] = (markings.sample(Math.atan2(p[1], p[0]) / DEGREE, Math.asin(p[2] / r) / DEGREE) ?? 0) * (shading === 'lambert' ? cosine : 0.6 + 0.4 * cosine);
  }
  const claimed = controlledShapeCamera(observerCamera(sighting(epochJd, centre), stated)), position = Array.from(claimed.position);
  const startTime = new Date((epochJd - 2440587.5) * 86_400_000).toISOString().replace('Z', '');
  const image: ObservationImage = { width: size, height: size, values, reject: () => null, startTime, filter: 'test', report: {} };
  const camera: ObservationCamera = { kind: 'control-network', project: point => { const p = claimed.project(point); return p ? [p[0], p[1], 1] : null; }, ray: (x, y) => Array.from(claimed.ray(x, y)),
    positionMeters: position, positionKm: position.map(n => n / 1000), sunDirection: Array.from(claimed.sun), pinhole: true, report: {} };
  const detector: FrameDetector = { image, camera, mesh: shape };
  return { id, startTime, filter: 'test', positionKm: camera.positionKm, cameraKind: 'control-network', geometrySource: 'source-mesh-rays',
    footprint: { pixelAngleMicroradians: 0.0134, nadirMedianMeters: 2000, nadirMinimumMeters: 2000, sampledPixels: 1 },
    sample: () => ({ reason: 'outside-detector' }), visible: () => false, detector, report: {} };
}

test('the silhouette scores an elongated outline, and a wrong pole leaves a residual the right one does not', () => {
  // Three views, lit as a deconvolved frame is: two exposures two minutes apart, and one a whole turn later that sees the same elongated outline again.
  const view = (id: string, epochJd: number, stated: BodyOrientation) => photograph(id, epochJd, upright, stated, 256, 'deconvolved');
  const right = silhouetteRegistration([view('a', J2000 + 3.1, upright), view('b', J2000 + 3.1 + 2 / 1440, upright), view('c', J2000 + 3.6, upright)]);
  assert.equal(right.scored, 3, `every frame is out of round enough to score (${JSON.stringify(right.frames.map(f => f.skipped ?? f.elongation.toFixed(2)))})`);
  assert.ok(right.rmsDegrees !== null && right.rmsDegrees < 2, `the stated camera reproduces the outline (${right.rmsDegrees}°)`);
  assert.equal(right.pairs, 1, 'the two exposures two minutes apart form one noise pair');
  assert.ok(right.frames.every(f => f.widthRatio !== undefined && Math.abs(f.widthRatio - 1) < 0.08), 'the projected width matches the photographed width');
  const wrong = silhouetteRegistration([view('a', J2000 + 3.1, tilted), view('b', J2000 + 3.6, tilted)]);
  assert.ok(wrong.rmsDegrees !== null && right.rmsDegrees !== null && wrong.rmsDegrees > right.rmsDegrees + 5, `a pole tilted twenty degrees leaves a position-angle residual (${wrong.rmsDegrees}° against ${right.rmsDegrees}°)`);
});

test('a frame that runs off the detector is reported as partial, not scored', () => {
  const frame = photograph('near', J2000 + 3.1, upright, upright, 96, 'deconvolved');
  const report = silhouetteRegistration([frame]);
  assert.equal(report.frames[0].skipped, 'partial-disc');
  assert.equal(report.scored, 0);
  assert.equal(report.rmsDegrees, null);
});

test('the body\'s other frames stand in for a map and decide the turn', async () => {
  const frames = [0, 0.05, 0.1, 0.4].map((days, i) => photograph(`f${i}`, J2000 + 3.1 + days, upright, upright));
  const context = { config: { raster: { observations: [] } }, source: { manifest: { inputs: [] } }, sourceDirectory: '.' } as unknown as LoadContext;
  const report = await referenceRegistration(frames, context);
  assert.equal(report.kind, 'frames');
  assert.equal(report.frames.length, 4);
  // The synthetic markings are a sum of waves that a latitude mirror partly reproduces, so not every frame clears the mirror rule; a real surface is not so kind to its mirror.
  assert.ok(report.decisive >= 2, `frames are decisive against the others (${report.decisive})`);
  const peaks = report.frames.filter(row => row.decisive).map(row => row.exact?.offsetDegrees ?? NaN);
  assert.ok(peaks.every(offset => Math.abs(offset) <= 1), `a consistent set peaks at zero (${peaks.join(', ')})`);
  assert.ok(report.decisive < DECISIVE.minimumFrames ? report.medianOffsetDegrees === null : Math.abs(report.medianOffsetDegrees ?? NaN) <= 1, 'a median is stated only over enough decisive frames');
  for (const row of report.frames) if (row.decisive) assert.ok((row.mirrorMargin ?? 0) >= DECISIVE.minimumMirrorMargin || (row.mirrorGap ?? 0) >= DECISIVE.minimumMirrorGap);
  const alone = await referenceRegistration(frames.slice(0, 1), context);
  assert.equal(alone.kind, 'none');
  assert.equal(alone.reason, 'one frame and no reference observation');
});

test('a lens without cameras is left to its own report', async () => {
  const frame = { ...photograph('x', J2000 + 3.1, upright, upright), detector: undefined };
  const report = await referenceRegistration([frame], {} as LoadContext);
  assert.equal(report.kind, 'none');
  assert.equal(silhouetteRegistration([frame]).frames.length, 0);
});
