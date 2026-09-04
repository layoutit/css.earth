export function viewSunDirectionToPreparedLightDirection(direction) {
  if (!Array.isArray(direction) || direction.length !== 3 ||
      direction.some((value) => !Number.isFinite(value)) ||
      Math.abs(Math.hypot(...direction) - 1) > 1e-9) {
    throw new TypeError("Directional Sun view direction is invalid.");
  }
  return Object.freeze([direction[0], -direction[1], -direction[2]]);
}
