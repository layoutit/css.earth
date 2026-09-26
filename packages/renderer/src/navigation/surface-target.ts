/** Minimal scene-space rotation taking an authored +Z surface target toward
 * the physical eye. Row-major; translation and framing remain camera-owned. */
export function prepareSurfaceTargetRotation(bodyCenterUnits: readonly number[]): readonly number[] {
  if (bodyCenterUnits.length !== 3 || bodyCenterUnits.some(value => !Number.isFinite(value))) {
    throw new TypeError('A surface target requires a finite physical body centre.');
  }
  const scale = Math.max(...bodyCenterUnits.map(Math.abs));
  if (scale === 0) throw new TypeError('A surface target cannot be centred on the eye.');
  const scaled = bodyCenterUnits.map(value => -value / scale);
  const length = Math.hypot(...scaled);
  const [x, y, z] = scaled.map(value => value / length);
  const sine = Math.hypot(x, y);
  if (sine === 0) return Object.freeze(z >= 0
    ? [1, 0, 0, 0, 1, 0, 0, 0, 1] : [1, 0, 0, 0, -1, 0, 0, 0, -1]);
  const axisX = -y / sine, axisY = x / sine, versine = 1 - z;
  return Object.freeze([
    z + axisX * axisX * versine, axisX * axisY * versine, x,
    axisX * axisY * versine, z + axisY * axisY * versine, y,
    -x, -y, z,
  ]);
}
