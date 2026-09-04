import {
  CUBIC_SKY_STANDARD,
  createCubicSkySunPresentation,
  projectDirectionToCubemapFace as projectCubicSkyDirectionToFace,
} from "../../../platform/cubic-sky-contract.mjs";

export const SUN_LOGICAL_SIZE = CUBIC_SKY_STANDARD.sun.logicalSize;
export const SUN_PRESENTATION_WIDTH =
  CUBIC_SKY_STANDARD.sun.presentationSize[0];
export const SUN_PRESENTATION_HEIGHT =
  CUBIC_SKY_STANDARD.sun.presentationSize[1];
export const SUN_PRESENTATION_ALPHA_GAIN =
  CUBIC_SKY_STANDARD.sun.presentationAlphaGain;
export const SUN_PRESENTATION_CORE_GAIN =
  CUBIC_SKY_STANDARD.sun.presentationCoreGain;
export const SUN_CANONICAL_FOCAL_PIXELS =
  CUBIC_SKY_STANDARD.sun.canonicalFocalPixels;
export const STARFIELD_PRESENTATION_PITCH_OFFSET_DEGREES =
  CUBIC_SKY_STANDARD.presentationPitchOffsetDegrees;
export const STARFIELD_PRESENTATION_YAW_OFFSET_DEGREES =
  CUBIC_SKY_STANDARD.presentationYawOffsetDegrees;
export const VENUS_DEFAULT_CONTROL_YAW_DEGREES =
  CUBIC_SKY_STANDARD.defaultControlYawDegrees;
// The explicit Google 0-degree-tilt/0-degree-heading sweep moves the sky in
// the opposite vertical direction to the Venus body, at about 1.7 times the
// body's prepared pitch response. This scalar is transported by the retained
// sky-cube matrix; it does not introduce runtime image work.
export const STARFIELD_CAMERA_PITCH_RESPONSE =
  CUBIC_SKY_STANDARD.cameraPitchResponse;
// Across Google's comparable 26M-44M metre range, the Sun footprint changes
// only about six percent. Preserve that weak field-of-view response while the
// Venus body continues to use the full camera zoom.
export const STARFIELD_CAMERA_ZOOM_RESPONSE =
  CUBIC_SKY_STANDARD.cameraZoomResponse;

const SUN_PRESENTATION = createCubicSkySunPresentation();
export const SUN_INITIAL_VIEW_DIRECTION =
  SUN_PRESENTATION.initialViewDirection;
export const SUN_INITIAL_SKY_DIRECTION = SUN_PRESENTATION.initialSkyDirection;
export const SUN_LOCAL_DIRECTION = SUN_PRESENTATION.localDirection;

export function projectLocalDirectionToInitialScreen(direction) {
  const skyDirection = rotateY(
    rotateX(
      rotateZ(direction, STARFIELD_PRESENTATION_YAW_OFFSET_DEGREES),
      40 + STARFIELD_PRESENTATION_PITCH_OFFSET_DEGREES,
    ),
    -VENUS_DEFAULT_CONTROL_YAW_DEGREES,
  );
  if (skyDirection[2] >= 0) return null;
  return Object.freeze({
    x: skyDirection[0] / -skyDirection[2],
    y: skyDirection[1] / -skyDirection[2],
  });
}

export function projectDirectionToCubemapFace([x, y, z]) {
  return projectCubicSkyDirectionToFace([x, y, z]);
}

function rotateX([x, y, z], degrees) {
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x, y * cosine - z * sine, y * sine + z * cosine];
}

function rotateY([x, y, z], degrees) {
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x * cosine + z * sine, y, -x * sine + z * cosine];
}

function rotateZ([x, y, z], degrees) {
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x * cosine - y * sine, x * sine + y * cosine, z];
}
