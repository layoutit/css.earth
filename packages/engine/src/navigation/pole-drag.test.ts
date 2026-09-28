import { describe, expect, it } from 'vitest';
import { composeDragRotation, rotationFromAngularVelocity } from './sphere-drag.js';
import { poleTumbleTurn, poleTurnRotation, rotateVector } from './pole-drag.js';
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
    expect(Math.abs(lean(drag(east, opening, 'screen')))).toBeGreaterThan(10);
    const held = drag(east, opening, 'pole');
    expect(lean(held)).toBeCloseTo(0, 9);
    expect(toward(held)).toBeCloseTo(17.6, 9);
  });

  it('is the screen-axis tumble while the pole stands upright on screen', () => {
    const upright: Vector3 = [0, -1, 0];
    for (const [dx, dy] of [[12, 0], [0, -9], [7, 5]] as const) {
      const a = byPole(upright, dx, dy), b = screenAxes(dx, dy);
      // Each step of the screen tumble turns about one combined axis; the pole turn composes its two. They agree to first order.
      a.forEach((value, i) => expect(value).toBeCloseTo(b[i]!, 3));
    }
  });

  it('keeps a rolled view at its roll and follows the pole on screen', () => {
    const rolled: Vector3 = [Math.sin(0.4) * Math.cos(0.3), -Math.cos(0.4) * Math.cos(0.3), Math.sin(0.3)];
    const turned = drag(Array.from({ length: 30 }, () => [4, -3] as [number, number]), rolled, 'pole');
    expect(lean(turned)).toBeCloseTo(lean(rolled), 9);
    // A drag along the pole's screen direction only tilts: no turn about the pole.
    const along = poleTumbleTurn(projectTrackballDelta({ ...trackball, previousX: 704, previousY: 479.5,
      currentX: 704 + 10 * Math.sin(0.4), currentY: 479.5 - 10 * Math.cos(0.4) }), rolled);
    expect(along.spin).toBeCloseTo(0, 12);
  });

  it('stops the pole at the line of sight instead of turning the body over', () => {
    const over = drag(Array.from({ length: 200 }, () => [0, 6] as [number, number]), opening, 'pole');
    expect(over[2]).toBeGreaterThan(0.999999);
    expect(lean(drag([[0, -40], [30, 0]], over, 'pole'))).toBeCloseTo(0, 6);
  });

  it('coasts a throw about the pole', () => {
    const history = createDragHistory();
    for (const [x, timestamp, yaw] of [[600, 0, 0], [620, 16, 5], [670, 32, 17], [760, 48, 39]]) recordDragSample(history, { x, y: 450, timestamp, yaw, pitch: 0 });
    const projectTurn = (input: Parameters<typeof projectTrackballDelta>[0]) => poleTumbleTurn(projectTrackballDelta({ ...trackball, ...input, radius: trackball.radius }), opening);
    const motion = estimateDragThrow({ history, releaseTimestamp: 48, trackball, pole: opening, projectTurn });
    if (!motion?.poleTurnPerMillisecond) throw new Error('Expected a pole throw.');
    expect(motion.poleTurnPerMillisecond.tilt).toBeCloseTo(0, 12);
    expect(lean(rotateVector(composeDragRotation(motion.launchRotation, [0, 0, 0, 1]), opening))).toBeCloseTo(0, 9);
    expect(estimateDragThrow({ history, releaseTimestamp: 48, trackball })?.poleTurnPerMillisecond).toBeNull();
  });
});
