import { presentPhysicalPoseInVolume, worldRotationFromQuaternion, rotateWorldPosition, type WorldCameraPose } from '@cssearth/engine';
import type { WorldRotation } from '@cssearth/core';
import type { DensityVolumeFrame, PreparedPointTransmission } from '@cssearth/objects';

const fields = new WeakMap<Node, Map<object, PreparedPointTransmission>>();
/** A region contributes only while its owning dataset is enabled. Other scenes inherit no material. */
export function setPointTransmission(host: Node, owner: object, field: PreparedPointTransmission | null): void {
  let owned = fields.get(host);
  if (!owned && field) fields.set(host, owned = new Map());
  if (field) owned!.set(owner, field); else owned?.delete(owner);
}
export function pointTransmissionAt(host: Node): PreparedPointTransmission | null {
  for (let node: Node | null = host; node; node = node.parentNode) {
    const owned = fields.get(node);
    if (owned?.size) return owned.values().next().value ?? null;
  }
  return null;
}
export function transmissionPaints(field: PreparedPointTransmission, paint: string): readonly string[] {
  const rgb = [1, 3, 5].map(at => parseInt(paint.slice(at, at + 2), 16));
  return Array.from({ length: field.thresholds.length + 1 }, (_, level) => '#' + rgb.map((value, band) =>
    field.colors[(level * 3 + band) * 256 + value]!.toString(16).padStart(2, '0')).join('') + paint.slice(7));
}
/** Row-major composition: apply `second`, then `first`. One source→field map per lookup, not per star. */
function composeRotation(first: WorldRotation, second: WorldRotation): WorldRotation {
  return [
    first[0] * second[0] + first[1] * second[3] + first[2] * second[6],
    first[0] * second[1] + first[1] * second[4] + first[2] * second[7],
    first[0] * second[2] + first[1] * second[5] + first[2] * second[8],
    first[3] * second[0] + first[4] * second[3] + first[5] * second[6],
    first[3] * second[1] + first[4] * second[4] + first[5] * second[7],
    first[3] * second[2] + first[4] * second[5] + first[5] * second[8],
    first[6] * second[0] + first[7] * second[3] + first[8] * second[6],
    first[6] * second[1] + first[7] * second[4] + first[8] * second[7],
    first[6] * second[2] + first[7] * second[5] + first[8] * second[8],
  ];
}
/** Only interpolation and selection from prepared values; no ray integration, grain law or optical calculation. */
export function transmissionLookup(field: PreparedPointTransmission, world: WorldCameraPose, frame: DensityVolumeFrame) {
  const eye = presentPhysicalPoseInVolume(world.pose, field.frame).positionUnits;
  const targetShape = field.targetAxes.map(axis => axis.length);
  const observerShape = field.observerAxes.map(axis => axis.length), stride = targetShape.reduce((a, b) => a * b, 1);
  const inverse = worldRotationFromQuaternion([-field.frame.localToReferenceXyzw[0], -field.frame.localToReferenceXyzw[1], -field.frame.localToReferenceXyzw[2], field.frame.localToReferenceXyzw[3]]);
  const sourceRotation = worldRotationFromQuaternion(frame.localToReferenceXyzw);
  const placed = composeRotation(inverse, sourceRotation);
  const scale = frame.metersPerUnit / field.frame.metersPerUnit;
  const origin = rotateWorldPosition(inverse, frame.originM.map((value, k) => (value - field.frame.originM[k]!) / field.frame.metersPerUnit) as [number, number, number]);
  let low0 = 0, t0 = 0, low1 = 0, t1 = 0, low2 = 0, t2 = 0;
  const bracket = (axis: readonly number[], value: number, index: 0 | 1 | 2) => {
    let low = 0, high = axis.length - 1;
    while (high - low > 1) { const mid = low + high >> 1; if (axis[mid]! <= value) low = mid; else high = mid; }
    let t = (value - axis[low]!) / (axis[low + 1]! - axis[low]!);
    if (t < 0) t = 0; else if (t > 1) t = 1;
    if (index === 0) { low0 = low; t0 = t; } else if (index === 1) { low1 = low; t1 = t; } else { low2 = low; t2 = t; }
  };
  bracket(field.observerAxes[0]!, eye[0]!, 0); bracket(field.observerAxes[1]!, eye[1]!, 1); bracket(field.observerAxes[2]!, eye[2]!, 2);
  const observerOffset = new Float64Array(8), observerWeight = new Float64Array(8);
  let view = 0;
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++, view++) {
    observerOffset[view] = ((low0 + a) * observerShape[1]! * observerShape[2]! + (low1 + b) * observerShape[2]! + low2 + c) * stride;
    observerWeight[view] = (a ? t0 : 1 - t0) * (b ? t1 : 1 - t1) * (c ? t2 : 1 - t2);
  }
  const ny = targetShape[1]!, nz = targetShape[2]!;
  const xAxis = field.targetAxes[0]!, yAxis = field.targetAxes[1]!, zAxis = field.targetAxes[2]!;
  const xEnd = xAxis.length - 1, yEnd = yAxis.length - 1, zEnd = zAxis.length - 1;
  const ex = eye[0]!, ey = eye[1]!, ez = eye[2]!, ox = origin[0]!, oy = origin[1]!, oz = origin[2]!;
  return (point: readonly number[]): number => {
    const x = point[0]! * scale, y = point[1]! * scale, z = point[2]! * scale;
    let tx = placed[0] * x + placed[1] * y + placed[2] * z + ox;
    let ty = placed[3] * x + placed[4] * y + placed[5] * z + oy;
    let tz = placed[6] * x + placed[7] * y + placed[8] * z + oz;
    // A more distant star retains the transmission to the region's exit on that same ray.
    let fraction = 1;
    const dx = tx - ex, dy = ty - ey, dz = tz - ez;
    if (dx !== 0) { const bound = ((dx > 0 ? xAxis[xEnd]! : xAxis[0]!) - ex) / dx; const clamped = bound < 0 ? 0 : bound; if (clamped < fraction) fraction = clamped; }
    if (dy !== 0) { const bound = ((dy > 0 ? yAxis[yEnd]! : yAxis[0]!) - ey) / dy; const clamped = bound < 0 ? 0 : bound; if (clamped < fraction) fraction = clamped; }
    if (dz !== 0) { const bound = ((dz > 0 ? zAxis[zEnd]! : zAxis[0]!) - ez) / dz; const clamped = bound < 0 ? 0 : bound; if (clamped < fraction) fraction = clamped; }
    if (fraction < 1) { tx = ex + fraction * dx; ty = ey + fraction * dy; tz = ez + fraction * dz; }
    bracket(xAxis, tx, 0); bracket(yAxis, ty, 1); bracket(zAxis, tz, 2);
    const xLow = low0, yLow = low1, zLow = low2, xt = t0, yt = t1, zt = t2;
    let tau = 0;
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) {
      const offset = ((xLow + a) * ny + yLow + b) * nz + zLow + c;
      const weight = (a ? xt : 1 - xt) * (b ? yt : 1 - yt) * (c ? zt : 1 - zt);
      if (weight === 0) continue;
      for (let corner = 0; corner < 8; corner++) tau += field.tau[observerOffset[corner]! + offset]! * observerWeight[corner]! * weight;
    }
    const value = tau / 1000;
    let level = 0; while (level < field.thresholds.length && value >= field.thresholds[level]!) level++;
    return level;
  };
}
