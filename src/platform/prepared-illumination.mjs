// Direction is in prepared image coordinates: right, down, toward the viewer.
// Resource ownership and asynchronous publication stay in object selection.
export function preparedIlluminationState(plan, direction, shadows = true) {
  if (!plan || !Number.isInteger(plan.frameCount) || plan.frameCount < 2 ||
      !Number.isFinite(plan.baseLightAzimuthDegrees) ||
      !(plan.maximumLightViewZ > plan.minimumLightViewZ) ||
      !Array.isArray(direction) || direction.length !== 3 || !direction.every(Number.isFinite) ||
      Math.abs(Math.hypot(...direction) - 1) > 1e-8) {
    throw new TypeError("Invalid prepared illumination selection.");
  }
  const phase = Math.max(0, Math.min(1, (direction[2] - plan.minimumLightViewZ) /
    (plan.maximumLightViewZ - plan.minimumLightViewZ)));
  const phaseFrame = Math.round(phase * (plan.frameCount - 1));
  const offset = !shadows && plan.shadowlessFrameOffset !== undefined ? plan.shadowlessFrameOffset : 0;
  if (!Number.isInteger(offset) || offset < 0 || (offset > 0 && offset < plan.frameCount)) {
    throw new TypeError("Invalid prepared shadowless frame offset.");
  }
  const angle = Math.hypot(direction[0], direction[1]) < 1e-9 ? 0
    : Math.atan2(direction[1], direction[0]) * 180 / Math.PI - plan.baseLightAzimuthDegrees;
  return { phaseFrame, frame: phaseFrame + offset, rollDegrees: ((angle + 180) % 360 + 360) % 360 - 180 };
}

export function publishPreparedIllumination(element, presentation, rollDegrees, rotate) {
  if (!presentation?.url) return false;
  let writes = 0;
  for (const [property, value] of [["backgroundImage", `url("${presentation.url}")`],
    ["backgroundPosition", presentation.backgroundPosition], ["backgroundSize", presentation.backgroundSize]]) {
    if (element.style[property] !== value) { element.style[property] = value; writes++; }
  }
  if (rotate) rotate(rollDegrees);
  else if (element.style.rotate !== `${rollDegrees}deg`) element.style.rotate = `${rollDegrees}deg`;
  return { writes };
}
