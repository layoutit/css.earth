import type { OrientationXyzw, PositionM } from '@cssearth/engine';

/** Row-major, orthonormal. Validation belongs at the public boundary. */
export type WorldRotation = readonly number[];

export function validateWorldRotation(rotation: WorldRotation): void { orthonormal(rotation, 1); }

/** CSS 3D space is left-handed (+x right, +y down, +z toward the viewer), so a map between it and a right-handed reference
 * frame such as ICRF reverses handedness. A prepared `presentationToReference` is one. */
export function validateWorldReflection(reflection: WorldRotation): void { orthonormal(reflection, -1); }

function orthonormal(rotation: WorldRotation, determinant: 1 | -1): void {
  if (rotation.length !== 9 || !rotation.every(Number.isFinite)) throw new TypeError('World rotation must contain nine finite components.');
  for (let row = 0; row < 3; row++) for (let other = 0; other < 3; other++) {
    let dot = 0;
    for (let column = 0; column < 3; column++) dot += rotation[row * 3 + column] * rotation[other * 3 + column];
    if (Math.abs(dot - Number(row === other)) > 1e-9) throw new TypeError('World rotation must be orthonormal.');
  }
  const [a, b, c, d, e, f, g, h, i] = rotation;
  if (Math.abs(a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g) - determinant) > 1e-9) {
    throw new TypeError(determinant === 1 ? 'World rotation must preserve handedness.' : 'A map between CSS and a reference frame must reverse handedness.');
  }
}

/** A physical camera pose keeps right-handed axes: +x right, +y up, +z toward the eye. CSS eye space differs only in +y, which
 * points down, so the camera's CSS view is its reference-to-camera rotation with the y row negated. */
export function cssViewFromOrientation(orientation: OrientationXyzw): WorldRotation {
  const r = worldRotationFromQuaternion(orientation);
  return [r[0], r[3], r[6], -r[1], -r[4], -r[7], r[2], r[5], r[8]];
}

/** The camera's CSS axes (+x right, +y down, +z toward the eye) in its reference frame, as columns: the pose's rotation with
 * the y column negated. A reflection, used only to project. */
export function cssCameraAxesFromOrientation(orientation: OrientationXyzw): WorldRotation {
  const r = worldRotationFromQuaternion(orientation);
  return [r[0], -r[1], r[2], r[3], -r[4], r[5], r[6], -r[7], r[8]];
}

/** Negate the y axis on both sides: a rotation between CSS spaces becomes the same rotation between their y-up twins. */
export function flipWorldRotationY(m: WorldRotation): WorldRotation {
  return [m[0], -m[1], m[2], -m[3], m[4], -m[5], m[6], -m[7], m[8]];
}

/** A reflection from CSS presentation to a reference frame, composed with the y flip: the proper rotation from the presentation's
 * y-up twin, which a quaternion can carry. */
export function referenceRotationFromPresentation(m: WorldRotation): WorldRotation {
  return [m[0], -m[1], m[2], m[3], -m[4], m[5], m[6], -m[7], m[8]];
}

export function validateWorldPosition(value: PositionM): void {
  if (value.length !== 3 || !value.every(Number.isFinite)) throw new TypeError('World position must contain three finite components.');
}

export function transposeWorldRotation(m: WorldRotation): WorldRotation {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

export function rotateWorldPosition(m: WorldRotation, p: PositionM): PositionM {
  return [m[0] * p[0] + m[1] * p[1] + m[2] * p[2],
    m[3] * p[0] + m[4] * p[1] + m[5] * p[2],
    m[6] * p[0] + m[7] * p[1] + m[8] * p[2]];
}

export function scaleWorldPosition(p: PositionM, scale: number): PositionM {
  return [p[0] * scale, p[1] * scale, p[2] * scale];
}

export function worldQuaternionFromRotation(m: WorldRotation): OrientationXyzw {
  const trace = m[0] + m[4] + m[8];
  let x: number, y: number, z: number, w: number;
  if (trace > 0) {
    const s = 2 * Math.sqrt(trace + 1);
    w = s / 4; x = (m[7] - m[5]) / s; y = (m[2] - m[6]) / s; z = (m[3] - m[1]) / s;
  } else if (m[0] > m[4] && m[0] > m[8]) {
    const s = 2 * Math.sqrt(1 + m[0] - m[4] - m[8]);
    w = (m[7] - m[5]) / s; x = s / 4; y = (m[1] + m[3]) / s; z = (m[2] + m[6]) / s;
  } else if (m[4] > m[8]) {
    const s = 2 * Math.sqrt(1 + m[4] - m[0] - m[8]);
    w = (m[2] - m[6]) / s; x = (m[1] + m[3]) / s; y = s / 4; z = (m[5] + m[7]) / s;
  } else {
    const s = 2 * Math.sqrt(1 + m[8] - m[0] - m[4]);
    w = (m[3] - m[1]) / s; x = (m[2] + m[6]) / s; y = (m[5] + m[7]) / s; z = s / 4;
  }
  const length = Math.hypot(x, y, z, w);
  return [x / length, y / length, z / length, w / length];
}

export function worldRotationFromQuaternion([x, y, z, w]: OrientationXyzw): WorldRotation {
  return [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)];
}

export function worldRotationCss(m: WorldRotation): string {
  return `matrix3d(${[m[0], m[3], m[6], 0, m[1], m[4], m[7], 0, m[2], m[5], m[8], 0, 0, 0, 0, 1]
    .map(value => Number(value.toFixed(12))).join(',')})`;
}
