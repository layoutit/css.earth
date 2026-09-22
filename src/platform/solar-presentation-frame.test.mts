import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();

import {
  requireBodyFixedEclipticNorth,
  requireBodyFixedSunDirection,
} from "./solar-geometry.mts";
import { prepareEclipticPresentationFrame } from
  "./solar-presentation-frame.mts";
import { prepareSunReferenceViewDirection } from
  "./prepare-sun-view-direction.mts";
import { cssDirectionToViewDirection } from "./solar-view-direction.mts";

const BODIES = [
  "mercury",
  "venus",
  "earth",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
];

test("the presentation frame maps the body's right-handed axes into left-handed CSS space", () => {
  for (const bodyId of BODIES) {
    const frame = prepareEclipticPresentationFrame(bodyId);
    const [x, y, z] = frame.basis;
    for (const axis of frame.basis) {
      assert.ok(Math.abs(Math.hypot(...axis) - 1) < 1e-12, bodyId);
    }
    assert.ok(Math.abs(dot(x, y)) < 1e-12, bodyId);
    assert.ok(Math.abs(dot(y, z)) < 1e-12, bodyId);
    assert.ok(Math.abs(dot(z, x)) < 1e-12, bodyId);
    // CSS y runs down, so physical right x physical up (-y) points toward the viewer (+z): a reflection.
    const handed = cross(x, y);
    for (let axis = 0; axis < 3; axis += 1) {
      assert.ok(Math.abs(handed[axis] + z[axis]) < 1e-12, bodyId);
    }
    // The node transform for PolyCSS's own placement (world X/Y as CSS Y/X) is a proper rotation.
    const m = frame.cssTransform.slice(9, -1).split(",").map(Number);
    const determinant = m[0] * (m[5] * m[10] - m[9] * m[6]) - m[4] * (m[1] * m[10] - m[9] * m[2]) + m[8] * (m[1] * m[6] - m[5] * m[2]);
    assert.ok(Math.abs(determinant - 1) < 1e-12, bodyId);
  }
});

test("ecliptic north is screen up and the Sun projects to screen left", () => {
  for (const bodyId of BODIES) {
    const frame = prepareEclipticPresentationFrame(bodyId);
    const north = frame.toPresentation(requireBodyFixedEclipticNorth(bodyId));
    assert.ok(Math.abs(north[0]) < 1e-12 && Math.abs(north[2]) < 1e-12, bodyId);
    assert.ok(Math.abs(north[1] + 1) < 1e-12, `${bodyId} north is CSS -y`);
    // The Sun lies in the x/y plane (no z): exactly left once its ecliptic
    // latitude is removed, so the terminator is vertical up to that latitude.
    assert.ok(Math.abs(frame.sunDirection[2]) < 1e-12, bodyId);
    assert.ok(frame.sunDirection[0] < 0, `${bodyId} Sun is to the left`);
    assert.ok(Math.abs(
      Math.asin(frame.sunDirection[1] * -1) * 180 / Math.PI -
        frame.sunEclipticLatitudeDegrees,
    ) < 1e-9, bodyId);
  }
});

test("pole tilts match the ecliptic, not the body's own orbit", () => {
  const earth = prepareEclipticPresentationFrame("earth");
  assert.ok(Math.abs(earth.poleTiltDegrees - 23.44) < 0.01);
  assert.ok(Math.abs(earth.sunEclipticLatitudeDegrees) < 0.01);
  const mercury = prepareEclipticPresentationFrame("mercury");
  // 7.0 degrees of orbital inclination plus 0.03 degrees of obliquity.
  assert.ok(Math.abs(mercury.poleTiltDegrees - 7.04) < 0.01);
  assert.ok(Math.abs(mercury.sunEclipticLatitudeDegrees + 5.11) < 0.01);
  // North pole points up on screen with that tilt.
  assert.ok(mercury.poleDirection[1] < -0.99);
  assert.ok(Math.abs(
    Math.acos(-mercury.poleDirection[1]) * 180 / Math.PI -
      mercury.poleTiltDegrees,
  ) < 1e-9);
});

test("Mercury's Sun sits on screen left at zero yaw for any pitch", () => {
  const frame = prepareEclipticPresentationFrame("mercury");
  for (const initialScenePitchDegrees of [0, 40, 65, -30]) {
    const view = prepareSunReferenceViewDirection({
      bodyId: "mercury",
      initialScenePitchDegrees,
      defaultControlYawDegrees: 0,
      sceneDirection: frame.sunDirection,
    });
    // Lit direction on screen: atan2(y, x) with y up; 180 degrees is left.
    const litDegrees = Math.atan2(view[1], view[0]) * 180 / Math.PI;
    const fromLeft = Math.abs(((litDegrees - 180 + 540) % 360) - 180);
    assert.ok(fromLeft <= Math.abs(frame.sunEclipticLatitudeDegrees) + 1e-9,
      `pitch ${initialScenePitchDegrees}: ${fromLeft} degrees from left`);
    // Sun on the screen plane edge: near half phase.
    assert.ok(Math.abs(view[2]) < Math.sin(6 * Math.PI / 180));
  }
  // Without the presentation frame the body-fixed direction still works.
  const bodyFixed = prepareSunReferenceViewDirection({
    bodyId: "mercury",
    initialScenePitchDegrees: 40,
    defaultControlYawDegrees: -105,
  });
  const sun = requireBodyFixedSunDirection("mercury");
  assert.notDeepEqual([...bodyFixed], [...cssDirectionToViewDirection(sun)]);
});

function dot(a: readonly number[], b: readonly number[]) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: readonly number[], b: readonly number[]) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
