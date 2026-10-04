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
