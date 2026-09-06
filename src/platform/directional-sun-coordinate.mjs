// Both maps take a Sun direction in the sprite's view frame (+x right, +y up,
// +z toward the viewer) and return a light direction in the prepared material
// frame (+x right, +y down, +z toward the viewer — the frame the overlay banks
// are baked in).
//
// The presentation map is the Google Earth Pro Mars convention shared by the
// standard-Sun objects: a Sun visible in front of the camera lights the face
// the camera sees (a full phase), so it mirrors z. It is deliberately not
// physical.
export function viewSunDirectionToPreparedLightDirection(direction) {
  validateViewDirection(direction);
  return Object.freeze([direction[0], -direction[1], -direction[2]]);
}

// The physical map keeps z: a Sun beyond the body (negative view z) lights
// the far hemisphere and the camera sees the night side with a lit crescent
// toward the Sun. Objects with observed solar geometry use this one.
export function viewSunDirectionToPhysicalLightDirection(direction) {
  validateViewDirection(direction);
  return Object.freeze([direction[0], -direction[1], direction[2]]);
}

function validateViewDirection(direction) {
  if (!Array.isArray(direction) || direction.length !== 3 ||
      direction.some((value) => !Number.isFinite(value)) ||
      Math.abs(Math.hypot(...direction) - 1) > 1e-9) {
    throw new TypeError("Directional Sun view direction is invalid.");
  }
}
