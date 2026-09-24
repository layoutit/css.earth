/** Numeric matrix transport shared by preparation and the CSS renderer. */
export type Matrix4 = readonly number[];
interface Point3 { x: number; y: number; z: number; }

export function requirePreparedMatrix4(value: Matrix4): Matrix4 {
  if (!Array.isArray(value) || value.length !== 16 || !value.every(Number.isFinite)) {
    throw new TypeError("Prepared projection requires a finite matrix.");
  }
  return value;
}

// This consumes a camera publication, never an element's CSS transform.
export function readPreparedMatrix4(value: Matrix4 | string | undefined): Matrix4 {
  if (Array.isArray(value)) return requirePreparedMatrix4(value);
  const match = typeof value === "string" && value.match(/^matrix3d\(([^)]+)\)$/u);
  if (!match) throw new TypeError("Prepared projection requires a matrix3d view.");
  return requirePreparedMatrix4(match[1].split(",").map(Number));
}

export function multiplyPreparedMatrix4(left: Matrix4, right: Matrix4): number[] {
  const product = new Array(16).fill(0);
  for (let column = 0; column < 4; column++) for (let row = 0; row < 4; row++) for (let index = 0; index < 4; index++) {
    product[column * 4 + row] += left[index * 4 + row] * right[column * 4 + index];
  }
  return product;
}

export function preparedRotationMatrix4(axis: string, degrees:number): number[] {
  const radians = degrees * Math.PI / 180, cosine = Math.cos(radians), sine = Math.sin(radians);
  if (axis === "x") return [1, 0, 0, 0, 0, cosine, sine, 0, 0, -sine, cosine, 0, 0, 0, 0, 1];
  if (axis === "y") return [cosine, 0, -sine, 0, 0, 1, 0, 0, sine, 0, cosine, 0, 0, 0, 0, 1];
  if (axis === "z") return [cosine, sine, 0, 0, -sine, cosine, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  throw new TypeError("Prepared rotation axis is invalid.");
}

export function invertPreparedAffineMatrix4(matrix: Matrix4): number[] {
  const [a, d, g, , b, e, h, , c, f, i] = matrix;
  const determinant = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) throw new RangeError("Prepared material parent became singular.");
  const inverse = [
    (e * i - f * h) / determinant, (f * g - d * i) / determinant, (d * h - e * g) / determinant, 0,
    (c * h - b * i) / determinant, (a * i - c * g) / determinant, (b * g - a * h) / determinant, 0,
    (b * f - c * e) / determinant, (c * d - a * f) / determinant, (a * e - b * d) / determinant, 0, 0, 0, 0, 1,
  ];
  const translation = transformPreparedPoint(inverse, matrix[12], matrix[13], matrix[14], 0);
  inverse[12] = -translation.x; inverse[13] = -translation.y; inverse[14] = -translation.z;
  return inverse;
}

export function transformPreparedPoint(matrix: Matrix4, x:number, y:number, z:number, w:number): Point3 {
  return { x: matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12] * w,
    y: matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13] * w,
    z: matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14] * w };
}

export function serializePreparedMatrix4(matrix: Matrix4): string {
  return `matrix3d(${matrix.map(value => Math.abs(value) < 1e-12 ? 0 : Number(value.toFixed(12))).join(",")})`;
}
