import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { polePanTurn, poleViewportTurn, poleTurnRotation, rotateVector } from './pole-drag.js';
import type { GrabSphere, PoleTurn } from './pole-drag.js';
import type { Vector3 } from './math-types.js';
// CesiumJS 1.145.0's own globe under twelve drags, frame by frame: written by `node labs/experiments/drag-oracle/run.mts record`.
import recorded from './pole-drag.cesium.json' with { type: 'json' };

const degrees = Math.PI / 180;
const apart = (a: Vector3, b: readonly number[]) => Math.max(...a.map((value, i) => Math.abs(value - b[i]!)));
// Earth's opening view leans its north pole 17.6 degrees toward the eye.
const opening: Vector3 = [0, -Math.cos(17.6 * degrees), Math.sin(17.6 * degrees)], meridian: Vector3 = [1, 0, 0];
const sphere: GrabSphere = { center: [0, 0, -8], radius: 1, opticalCenterX: 640, opticalCenterY: 400, focalLength: 1829 };
const lean = (pole: Vector3) => Math.atan2(pole[0]!, -pole[1]!);
const fromEye = (pole: Vector3) => Math.acos(pole[2]!);

describe('pole-held turns against CesiumJS', () => {
  it('turns the body as Cesium turns its globe, in every recorded frame', () => {
    let frames = 0, panned = 0, turned = 0, worst = 0;
    for (const gesture of recorded.gestures) {
      const body: GrabSphere = { center: [0, 0, -gesture.distance], radius: 1, opticalCenterX: gesture.viewport.width / 2, opticalCenterY: gesture.viewport.height / 2, focalLength: gesture.focalLength };
      let pole: Vector3 = gesture.start.pole, across: Vector3 = gesture.start.meridian, offGlobe = false;
      for (const frame of gesture.frames) {
        if (frame.movement) {
          const [previousX, previousY, currentX, currentY] = frame.movement, pointer = { previousX: previousX!, previousY: previousY!, currentX: currentX!, currentY: currentY! };
          // Cesium pans while both ends of the movement are on the globe, and from the first miss turns by viewport share.
          const pan: PoleTurn | null = offGlobe ? null : polePanTurn(pointer, body, pole);
          assert.equal(pan === null, frame.rotating, 'the drag left the globe in a different frame than Cesium\'s');
          offGlobe = frame.rotating;
          const rotation = poleTurnRotation(pan ?? poleViewportTurn(pointer, body, gesture.viewport, pole), pole, across);
          worst = Math.max(worst, apart(rotateVector(rotation, pole), frame.pole), apart(rotateVector(rotation, across), frame.meridian));
          frames++; if (pan) panned++; else turned++;
        }
        // The next frame starts from Cesium's own globe, so no frame leans on the one before it.
        pole = frame.pole; across = frame.meridian;
      }
    }
    assert.ok(panned > 100 && turned > 10, `the recording covers ${panned} pans and ${turned} turns off the globe of ${frames} frames`);
    // Cesium places its camera through heading, pitch and roll, good to about 1e-7; a pan near a pole amplifies that (8e-7 at worst here).
    assert.ok(worst < 5e-6, `a frame ended ${worst} from Cesium's`);
  });
});

describe('pole-held turns', () => {
  it('keeps the pole on its screen direction', () => {
    const leaning: Vector3 = [Math.sin(.4) * Math.cos(.3), -Math.cos(.4) * Math.cos(.3), Math.sin(.3)];
    for (const [dx, dy] of [[70, 30], [-40, -90], [5, 120]] as const) {
      const turn = polePanTurn({ previousX: 640, previousY: 400, currentX: 640 + dx, currentY: 400 + dy }, sphere, leaning);
      assert.ok(turn);
      const turnedPole = rotateVector(poleTurnRotation(turn, leaning, [Math.cos(.4), Math.sin(.4), 0]), leaning);
      assert.ok(Math.abs(lean(turnedPole) - lean(leaning)) < 1e-12, 'the pole rolled on screen');
    }
  });

  it('pans by the longitude and the pole angle between the two points, without solving for the pointer', () => {
    const upright: Vector3 = [0, -1, 0];
    // Sideways through the disc centre: the same latitude at both ends, so a spin alone.
    const sideways = polePanTurn({ previousX: 600, previousY: 400, currentX: 690, currentY: 400 }, sphere, upright);
    assert.ok(sideways && Math.abs(sideways.tilt) < 1e-12 && sideways.spin < 0);
    // Straight down the eye's meridian: the same longitude at both ends, so a tilt alone, the pole toward the eye.
    const down = polePanTurn({ previousX: 640, previousY: 380, currentX: 640, currentY: 450 }, sphere, upright);
    assert.ok(down && Math.abs(down.spin) < 1e-12 && down.tilt > 0);
  });

  it('gives no pan when the pointer misses the body', () => {
    assert.equal(polePanTurn({ previousX: 640, previousY: 400, currentX: 1000, currentY: 400 }, sphere, opening), null);
    assert.equal(polePanTurn({ previousX: 1000, previousY: 400, currentX: 640, currentY: 400 }, sphere, opening), null);
  });

  it('stops a pole just short of the line of sight, holds it there, and lets it leave', () => {
    const to = rotateVector(poleTurnRotation({ spin: 0, tilt: 3 }, opening, meridian), opening);
    assert.ok(Math.abs(fromEye(to) - 1e-4) < 1e-9, `the pole stopped ${fromEye(to)} from the line of sight`);
    const across = rotateVector(poleTurnRotation({ spin: 0, tilt: 3 }, opening, meridian), meridian);
    assert.ok(Math.abs(fromEye(rotateVector(poleTurnRotation({ spin: .3, tilt: .2 }, to, across), to)) - 1e-4) < 1e-9, 'a tilt toward a held pole moved it');
    assert.ok(Math.abs(fromEye(rotateVector(poleTurnRotation({ spin: 0, tilt: -.2 }, to, across), to)) - (1e-4 + .2)) < 1e-9, 'a tilt away from a held pole was not free');
    // The far pole holds the same way.
    const far = rotateVector(poleTurnRotation({ spin: 0, tilt: -3 }, opening, meridian), opening);
    assert.ok(Math.abs(Math.PI - fromEye(far) - 1e-4) < 1e-9);
  });

  it('turns off the globe by viewport share, at the eye\'s height in radii up to 1.77', () => {
    const upright: Vector3 = [0, -1, 0], viewport = { width: 1000, height: 500 };
    // A twentieth of the width to the right, a twentieth of the height down: at 8 radii the rate is held at 1.77.
    const turn = poleViewportTurn({ previousX: 100, previousY: 100, currentX: 150, currentY: 125 }, sphere, viewport, upright);
    assert.ok(Math.abs(turn.spin - -.05 * 2 * Math.PI * 1.77) < 1e-12 && Math.abs(turn.tilt - .05 * Math.PI * 1.77) < 1e-12);
    // Close in the rate is the height: 1.5 radii from the centre is half a radius up.
    const near = poleViewportTurn({ previousX: 100, previousY: 100, currentX: 150, currentY: 100 }, { ...sphere, center: [0, 0, -1.5] }, viewport, upright);
    assert.ok(Math.abs(near.spin - -.05 * 2 * Math.PI * .5) < 1e-12);
    // Cesium holds a frame's leftward and upward share to a tenth, and not the other two.
    const fast = poleViewportTurn({ previousX: 500, previousY: 300, currentX: 100, currentY: 100 }, sphere, viewport, upright);
    assert.ok(Math.abs(fast.spin - .1 * 2 * Math.PI * 1.77) < 1e-12 && Math.abs(fast.tilt - -.1 * Math.PI * 1.77) < 1e-12);
    const back = poleViewportTurn({ previousX: 100, previousY: 100, currentX: 500, currentY: 300 }, sphere, viewport, upright);
    assert.ok(Math.abs(back.spin - -.4 * 2 * Math.PI * 1.77) < 1e-12 && Math.abs(back.tilt - .4 * Math.PI * 1.77) < 1e-12);
  });

  it('takes sideways and up along a leaning pole\'s own screen direction', () => {
    const viewport = { width: 1000, height: 1000 }, leaning: Vector3 = [Math.sin(.5), -Math.cos(.5), 0];
    // Along the pole's screen direction: a tilt alone.
    const along = poleViewportTurn({ previousX: 0, previousY: 0, currentX: -20 * Math.sin(.5), currentY: 20 * Math.cos(.5) }, sphere, viewport, leaning);
    assert.ok(Math.abs(along.spin) < 1e-12 && along.tilt > 0);
  });
});
