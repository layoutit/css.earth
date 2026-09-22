import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import { fitBackplaneSun, fittedCamera, tiltedCamera, turnedCamera } from './cameras.mts';

/** A 10 km sphere seen from 200 km along +x, lit from a direction 40 degrees off the line of sight: backplanes as an archive would state them. */
function backplanes(sun: readonly number[], size = 128) {
  const position = [200, 0, 0], focal = 1200, xyz: number[][] = [], valid: boolean[] = [], phase = new Float64Array(size * size);
  const norm = Math.hypot(...sun), s = sun.map(n => n / norm);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = [-focal, x - size / 2, y - size / 2], length = Math.hypot(...d), ray = d.map(n => n / length);
    // Ray–sphere intersection in kilometres.
    const b = 2 * (position[0] * ray[0] + position[1] * ray[1] + position[2] * ray[2]), c = position[0] ** 2 + position[1] ** 2 + position[2] ** 2 - 100, disc = b * b - 4 * c;
    if (disc < 0) { xyz.push([0, 0, 0]); valid.push(false); continue; }
    const t = (-b - Math.sqrt(disc)) / 2, p = position.map((n, k) => n + ray[k] * t);
    xyz.push(p); valid.push(true);
    const toCamera = position.map((n, k) => n - p[k]), l = Math.hypot(...toCamera);
    phase[y * size + x] = Math.acos((toCamera[0] * s[0] + toCamera[1] * s[1] + toCamera[2] * s[2]) / l);
  }
  return { width: size, height: size, xyz: (i: number) => xyz[i], valid: (i: number) => valid[i], planes: { PHASE_ANGLE_IMAGE: phase, IMAGE: new Float64Array(size * size).fill(1) }, positionKm: position, sun: s };
}

test('the Sun direction is recovered from the phase plane to a hundredth of a degree', () => {
  const frame = backplanes([0.766, 0.643, 0.1]);
  const fit = fitBackplaneSun(frame, frame.positionKm);
  assert.ok(fit);
  const angle = Math.acos(Math.min(1, fit.sunDirection.reduce((sum, n, k) => sum + n * frame.sun[k], 0))) * 180 / Math.PI;
  assert.ok(angle < 0.01, `fitted Sun ${angle.toFixed(4)}° from the true one`);
  assert.ok(fit.fit.rmsDegrees < 0.01 && fit.fit.holdoutPixels > 1000, JSON.stringify(fit.fit));
});

test('a phase plane that no single Sun explains is refused, and a frame without one cannot become a camera', () => {
  const frame = backplanes([0.766, 0.643, 0.1]);
  const broken = { ...frame, planes: { ...frame.planes, PHASE_ANGLE_IMAGE: frame.planes.PHASE_ANGLE_IMAGE.map((v, i) => i % 2 ? v + 0.2 : v) } };
  assert.throws(() => fitBackplaneSun(broken, frame.positionKm), /disagrees with the archive's phase plane/);
  assert.equal(fitBackplaneSun({ ...frame, planes: { IMAGE: frame.planes.IMAGE } }, frame.positionKm), null);
  assert.throws(() => fittedCamera({ ...frame, planes: { IMAGE: frame.planes.IMAGE } }), /no phase plane/);
});

test('a fitted camera carries the fitted Sun and its holdout in the report', () => {
  const frame = backplanes([0.5, -0.7, 0.3]);
  const camera = fittedCamera(frame);
  assert.ok(camera.sunDirection && Math.abs(Math.hypot(...camera.sunDirection) - 1) < 1e-9);
  const angle = Math.acos(Math.min(1, camera.sunDirection.reduce((sum, n, k) => sum + n * frame.sun[k], 0))) * 180 / Math.PI;
  assert.ok(angle < 0.01, `camera Sun ${angle.toFixed(4)}° from the true one`);
  assert.equal((camera.report as { sun?: { method: string } }).sun?.method, 'phase-plane-least-squares');
});

test('a turned camera sees the body turned the other way and keeps the provider in its report', () => {
  const frame = backplanes([0.5, -0.7, 0.3]), camera = fittedCamera(frame), turned = turnedCamera(camera, 30, { by: 'relief' });
  // The turned camera sees a body-fixed point where the original camera saw that point turned +30° about the pole: the body turned, the camera the other way.
  const point = [4000, 3000, 2000], a = 30 * Math.PI / 180, moved = [Math.cos(a) * point[0] - Math.sin(a) * point[1], Math.sin(a) * point[0] + Math.cos(a) * point[1], point[2]];
  const p = camera.project(moved)!, q = turned.project(point)!;
  assert.ok(Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-6, `${p} vs ${q}`);
  assert.ok(Math.abs(Math.hypot(...turned.positionMeters) - Math.hypot(...camera.positionMeters)) < 1e-6);
  assert.equal((turned.report as { refinement: { by: string; turnDegrees: number } }).refinement.turnDegrees, 30);
  assert.equal(turned.kind, camera.kind);
});

test('a tilted camera rolls about its own line of sight: the body centre stays put and a point turns on the sky', () => {
  const frame = backplanes([0.5, -0.7, 0.3]), camera = fittedCamera(frame), tilted = tiltedCamera(camera, 25, { tilt: 'silhouette' });
  const centre = camera.project([0, 0, 0])!, still = tilted.project([0, 0, 0])!;
  assert.ok(Math.hypot(centre[0] - still[0], centre[1] - still[1]) < 1e-6, 'the line of sight is the roll axis, so the body centre does not move');
  const point = [0, 6000, 0], before = camera.project(point)!, after = tilted.project(point)!;
  const angle = (p: readonly number[]) => Math.atan2(p[1] - centre[1], p[0] - centre[0]) * 180 / Math.PI;
  const rolled = ((angle(after) - angle(before) + 540) % 360) - 180;
  assert.ok(Math.abs(Math.abs(rolled) - 25) < 0.5, `a point off the axis turns by the tilt on the sky (${rolled.toFixed(2)}°)`);
  assert.ok(Math.abs(Math.hypot(...tilted.sunDirection) - 1) < 1e-9 && tilted.positionMeters === camera.positionMeters);
  assert.equal((tilted.report as { refinement: { tiltDegrees: number } }).refinement.tiltDegrees, 25);
});
