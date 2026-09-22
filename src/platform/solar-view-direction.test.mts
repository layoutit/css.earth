import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();

import {
  viewSunDirectionToPhysicalLightDirection,
  viewSunDirectionToPreparedLightDirection,
} from "./directional-sun-coordinate.mts";
import { requireBodyFixedSunDirection } from "./solar-geometry.mts";
import { prepareSunReferenceViewDirection } from
  "./prepare-sun-view-direction.mts";
import { cssDirectionToViewDirection } from "./solar-view-direction.mts";

// A view direction lies in front of the camera when `forward = -z` is positive.
function forward(viewDirection: readonly number[]) {
  return -viewDirection[2];
}

test("a CSS direction beyond the body projects in front of the camera", () => {
  // CSS +z points toward the viewer, so a Sun beyond the body has negative
  // CSS z. It lies in front of the camera, on the same side of the
  // screen as the CSS direction (x right, y down).
  const beyond = cssDirectionToViewDirection([0.6, 0.48, -0.64]);
  assert.ok(forward(beyond) > 0, "Sun beyond the body is in front of the camera");
  assert.ok(beyond[0] > 0, "screen right stays screen right");
  assert.ok(beyond[1] < 0, "CSS down becomes view down (negative y up)");

  const behind = cssDirectionToViewDirection([0.6, 0.48, 0.64]);
  assert.ok(forward(behind) < 0, "Sun behind the camera is behind it");
});

test("the physical light map returns the CSS scene direction", () => {
  const css = [0.36, -0.48, -0.8];
  const view = cssDirectionToViewDirection(css);
  assert.deepEqual([...viewSunDirectionToPhysicalLightDirection(view)], css);
  // The presentation map is the deliberate reference full-phase mirror.
  assert.deepEqual(
    [...viewSunDirectionToPreparedLightDirection(view)],
    [css[0], css[1], -css[2]],
  );
});

test("Mercury's reference view direction matches the scene matrix", () => {
  const pose = {
    initialScenePitchDegrees: 40,
    defaultControlYawDegrees: -105,
  };
  const reference = prepareSunReferenceViewDirection({
    bodyId: "mercury",
    ...pose,
  });
  const expected = cssDirectionToViewDirection(rotateX(
    rotateY(requireBodyFixedSunDirection("mercury"), pose.defaultControlYawDegrees),
    pose.initialScenePitchDegrees,
  ));
  for (let axis = 0; axis < 3; axis += 1) {
    assert.ok(Math.abs(reference[axis] - expected[axis]) < 1e-12);
  }
  // At the default pose the Sun stands above and behind the camera: the
  // sprite is hidden and the physical overlay shows a lit gibbous disc.
  assert.ok(reference[1] > 0.8);
  assert.ok(forward(reference) < 0);
  assert.ok(viewSunDirectionToPhysicalLightDirection(reference)[2] > 0.5);
});

// CSS rotateY / rotateX, as DOMMatrix.rotateAxisAngle applies them.
function rotateY([x, y, z]: readonly number[], degrees: number) {
  const angle = degrees * Math.PI / 180;
  return [
    Math.cos(angle) * x + Math.sin(angle) * z,
    y,
    -Math.sin(angle) * x + Math.cos(angle) * z,
  ];
}

function rotateX([x, y, z]: readonly number[], degrees: number) {
  const angle = degrees * Math.PI / 180;
  return [
    x,
    Math.cos(angle) * y - Math.sin(angle) * z,
    Math.sin(angle) * y + Math.cos(angle) * z,
  ];
}
