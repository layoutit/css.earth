import { prepareEclipticPresentationFrame } from
  "../../../platform/solar-presentation-frame.mjs";

// The presentation frame the scene is prepared in: ecliptic north up, the Sun
// to the left at zero yaw. Scene preparation applies it to the body system
// and the Sun preparation expresses the Sun in it, so both read it from here.
export const EUROPA_PRESENTATION_FRAME =
  prepareEclipticPresentationFrame("europa");

// The default camera pose, shared by scene preparation and by the Sun
// placement that has to agree with it. Both read it from here so the sky can
// never drift from the camera it was prepared against.
//
// Zero yaw keeps the Sun exactly on screen left (half phase, terminator
// vertical). The scene pitch is applied as CSS rotateX, so a positive value
// stands the camera south of the ecliptic while keeping north up.
export const EUROPA_CAMERA_POSE = Object.freeze({
  initialScenePitchDegrees: 40,
  defaultControlYawDegrees: 0,
});
