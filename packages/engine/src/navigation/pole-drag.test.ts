import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { composeDragRotation, rotationFromAngularVelocity } from './sphere-drag.js';
import { poleGrabTurn, poleTumbleTurn, poleTurnRotation, rotateVector } from './pole-drag.js';
import { createDragHistory, estimateDragThrow, projectTrackballDelta, recordDragSample } from './trackball-drag-inertia.js';
import type { Vector3 } from './math-types.js';

// The ball the renderer measures on a 1408 px viewport, as in navigation-math.test.ts.
const trackball = { centerX: 704, centerY: 479.5, radius: 295.4867, surfaceRadius: 295.4867,
  focalLength: 1408 * Math.sqrt(3) / 2, viewportWidth: 1408, angularDegreesPerTrackballRadius: 90 };
const degrees = Math.PI / 180;
// Earth's opening view leans its north pole 17.6 degrees toward the eye.
const opening: Vector3 = [0, -Math.cos(17.6 * degrees), Math.sin(17.6 * degrees)];
// Screen lean of the pole off screen-up, and its angle toward the eye, in degrees.
const lean = (pole: Vector3) => Math.atan2(pole[0]!, -pole[1]!) / degrees;
const toward = (pole: Vector3) => Math.asin(pole[2]!) / degrees;
const tumble = (dx: number, dy: number) => projectTrackballDelta({ ...trackball, previousX: 704, previousY: 479.5, currentX: 704 + dx, currentY: 479.5 + dy });
// The screen-axis tumble the pole replaces: pitch about screen x, yaw about screen y.
const screenAxes = (dx: number, dy: number) => { const t = tumble(dx, dy); return rotationFromAngularVelocity([-t.pitchDegrees * degrees, t.yawDegrees * degrees, 0], 1); };
const byPole = (pole: Vector3, dx: number, dy: number) => poleTurnRotation(poleTumbleTurn(tumble(dx, dy), pole), pole);
function drag(steps: readonly [number, number][], pole: Vector3, project: 'pole' | 'screen') {
  let current = pole;
  for (const [dx, dy] of steps) current = rotateVector(project === 'pole' ? byPole(current, dx, dy) : screenAxes(dx, dy), current);
  return current;
}
const east = Array.from({ length: 60 }, () => [5, 0] as [number, number]);

describe('pole-held tumble', () => {
  it('turns a sideways drag about the pole where the screen-axis tumble swung it sideways', () => {
    assert.ok(Math.abs(lean(drag(east, opening, 'screen'))) > 10);
    const held = drag(east, opening, 'pole');
    assert.ok(Math.abs(lean(held) - (0)) < 10 ** -9 / 2, `${lean(held)} is not close to ${0}`);
    assert.ok(Math.abs(toward(held) - (17.6)) < 10 ** -9 / 2, `${toward(held)} is not close to ${17.6}`);
  });

  it('is the screen-axis tumble while the pole stands upright on screen', () => {
    const upright: Vector3 = [0, -1, 0];
    for (const [dx, dy] of [[12, 0], [0, -9], [7, 5]] as const) {
      const a = byPole(upright, dx, dy), b = screenAxes(dx, dy);
      // Each step of the screen tumble turns about one combined axis; the pole turn composes its two. They agree to first order.
      a.forEach((value, i) => assert.ok(Math.abs(value - (b[i]!)) < 10 ** -3 / 2, `${value} is not close to ${b[i]!}`));
    }
  });

  it('keeps a rolled view at its roll and follows the pole on screen', () => {
    const rolled: Vector3 = [Math.sin(0.4) * Math.cos(0.3), -Math.cos(0.4) * Math.cos(0.3), Math.sin(0.3)];
    const turned = drag(Array.from({ length: 30 }, () => [4, -3] as [number, number]), rolled, 'pole');
    assert.ok(Math.abs(lean(turned) - (lean(rolled))) < 10 ** -9 / 2, `${lean(turned)} is not close to ${lean(rolled)}`);
    // A drag along the pole's screen direction only tilts: no turn about the pole.
    const along = poleTumbleTurn(projectTrackballDelta({ ...trackball, previousX: 704, previousY: 479.5,
      currentX: 704 + 10 * Math.sin(0.4), currentY: 479.5 - 10 * Math.cos(0.4) }), rolled);
    assert.ok(Math.abs(along.spin - (0)) < 10 ** -12 / 2, `${along.spin} is not close to ${0}`);
  });

  it('stops the pole at the line of sight instead of turning the body over', () => {
    const over = drag(Array.from({ length: 200 }, () => [0, 6] as [number, number]), opening, 'pole');
    assert.ok(over[2] > 0.999999);
    assert.ok(Math.abs(lean(drag([[0, -40], [30, 0]], over, 'pole')) - (0)) < 10 ** -6 / 2, `${lean(drag([[0, -40], [30, 0]], over, 'pole'))} is not close to ${0}`);
  });

  it('coasts a throw about the pole', () => {
    const history = createDragHistory();
    for (const [x, timestamp, yaw] of [[600, 0, 0], [620, 16, 5], [670, 32, 17], [760, 48, 39]]) recordDragSample(history, { x, y: 450, timestamp, yaw, pitch: 0 });
    const projectTurn = (input: Parameters<typeof projectTrackballDelta>[0]) => poleTumbleTurn(projectTrackballDelta({ ...trackball, ...input, radius: trackball.radius }), opening);
    const motion = estimateDragThrow({ history, releaseTimestamp: 48, trackball, pole: opening, projectTurn });
    if (!motion?.poleTurnPerMillisecond) throw new Error('Expected a pole throw.');
    assert.ok(Math.abs(motion.poleTurnPerMillisecond.tilt - (0)) < 10 ** -12 / 2, `${motion.poleTurnPerMillisecond.tilt} is not close to ${0}`);
    assert.ok(Math.abs(lean(rotateVector(composeDragRotation(motion.launchRotation, [0, 0, 0, 1]), opening)) - (0)) < 10 ** -9 / 2, `${lean(rotateVector(composeDragRotation(motion.launchRotation, [0, 0, 0, 1]), opening))} is not close to ${0}`);
    assert.equal(estimateDragThrow({ history, releaseTimestamp: 48, trackball })?.poleTurnPerMillisecond, null);
  });
});

describe('pole grab', () => {
  // Earth at its opening distance, drawn a little off the optical axis: 230 px across on a 1829 px focal length.
  const sphere = { center: [40, -25, -1000], radius: 120, opticalCenterX: 640, opticalCenterY: 400, focalLength: 1829 };
  const project = (q: Vector3) => {
    const p = [0, 1, 2].map(i => sphere.center[i]! + sphere.radius * q[i]!);
    return [sphere.opticalCenterX + sphere.focalLength * p[0]! / -p[2]!, sphere.opticalCenterY + sphere.focalLength * p[1]! / -p[2]!];
  };
  const centre = project([0, 0, 0]);
  // The surface point under a screen pixel, by bisecting along the ray: independent of the solver's own intersection.
  const under = (x: number, y: number): Vector3 => {
    const ray = [x - sphere.opticalCenterX, y - sphere.opticalCenterY, -sphere.focalLength];
    const n = Math.hypot(...ray), d = ray.map(c => c / n);
    let lo = 0, hi = Math.hypot(...sphere.center);
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      const inside = Math.hypot(...d.map((c, k) => c * mid - sphere.center[k]!)) < sphere.radius;
      if (inside) hi = mid; else lo = mid;
    }
    return d.map((c, k) => (c * hi - sphere.center[k]!) / sphere.radius);
  };

  it('keeps the grabbed ground under the pointer and the pole on its screen direction', () => {
    for (const [x0, y0, x1, y1] of [[-60, 10, 70, 30], [0, -80, 20, 60], [50, 50, -40, -30], [-90, -40, -10, -60]]) {
      const pointer = { previousX: centre[0]! + x0!, previousY: centre[1]! + y0!, currentX: centre[0]! + x1!, currentY: centre[1]! + y1! };
      const turn = poleGrabTurn(pointer, sphere, opening);
      assert.ok(turn);
      const rotation = poleTurnRotation(turn, opening);
      const landed = project(rotateVector(rotation, under(pointer.previousX, pointer.previousY)));
      assert.ok(Math.hypot(landed[0]! - pointer.currentX, landed[1]! - pointer.currentY) < 1e-6, `${landed} missed ${pointer.currentX},${pointer.currentY}`);
      assert.ok(Math.abs(lean(rotateVector(rotation, opening)) - lean(opening)) < 1e-9);
    }
  });

  it('turns by angle when the pointer leaves the body', () => {
    assert.equal(poleGrabTurn({ previousX: centre[0]!, previousY: centre[1]!, currentX: centre[0]! + 400, currentY: centre[1]! }, sphere, opening), null);
  });

  it('stays finite where no turn reaches the pointer beside the pole', () => {
    const top = project(rotateVector([0, 0, 0, 1], opening));
    // 80 px sideways, 20 px under the pole: the latitude circle there is narrower than the stroke.
    const pointer = { previousX: top[0]! - 2, previousY: top[1]! + 20, currentX: top[0]! + 80, currentY: top[1]! + 20 };
    const turn = poleGrabTurn(pointer, sphere, opening);
    assert.ok(turn && Number.isFinite(turn.spin) && Number.isFinite(turn.tilt));
    const landed = project(rotateVector(poleTurnRotation(turn, opening), under(pointer.previousX, pointer.previousY)));
    assert.ok(Math.hypot(landed[0]! - pointer.currentX, landed[1]! - pointer.currentY) > 1, 'the stroke was reachable after all');
  });

  // A straight drag down a body whose pole starts 17 degrees from the eye, leaning 8 degrees: the pole comes to the line
  // of sight, is held there, and the pointer goes on across it. The spin that kept the ground under the pointer turned
  // the body 172 degrees in one 3 px step there (Earth, 2026-10-02).
  const facing = { center: [0, 0, -1000], radius: 120, opticalCenterX: 640, opticalCenterY: 400, focalLength: 1829 };
  const dragDown = (x: number) => {
    let pole: Vector3 = [Math.sin(17 * degrees) * Math.sin(-8 * degrees), -Math.sin(17 * degrees) * Math.cos(-8 * degrees), Math.cos(17 * degrees)], worst = 0;
    for (let y = -135; y < 135; y += 3) {
      const turn = poleGrabTurn({ previousX: 640 + x, previousY: 400 + y, currentX: 640 + x, currentY: 403 + y }, facing, pole);
      assert.ok(turn);
      const rotation = poleTurnRotation(turn, pole);
      worst = Math.max(worst, 2 * Math.acos(Math.min(1, Math.abs(rotation[3]!))) / degrees);
      pole = rotateVector(rotation, pole);
    }
    return { worst, pole };
  };
  it('stops at a held pole instead of spinning the body round as the pointer crosses it', () => {
    for (const x of [0, 2, -6]) {
      const { worst, pole } = dragDown(x);
      assert.ok(pole[2]! > 1 - 1e-9, 'the drag did not hold the pole at the line of sight');
      assert.ok(worst < 2, `one 3 px step turned the body ${worst} degrees with the pointer ${x} px beside the pole`);
    }
  });
  it('still turns the body with a pointer that circles a held pole', () => {
    const { pole } = dragDown(0);
    const around = (degreesRound: number) => [640 + 60 * Math.cos(degreesRound * degrees), 400 + 60 * Math.sin(degreesRound * degrees)];
    const [previousX, previousY] = around(0), [currentX, currentY] = around(10);
    const turn = poleGrabTurn({ previousX: previousX!, previousY: previousY!, currentX: currentX!, currentY: currentY! }, facing, pole);
    assert.ok(turn && Math.abs(Math.abs(turn.spin) / degrees - 10) < .5, `a 10 degree sweep round the pole spun ${turn && turn.spin / degrees}`);
  });
});
