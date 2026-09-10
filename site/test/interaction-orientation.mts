// Offline comparison of start-relative camera rotations in the control frame.
export type Vector3 = readonly [number, number, number];
export type Matrix3 = readonly [Vector3, Vector3, Vector3];

function vector3(values: readonly number[]): Vector3 {
  if (values.length !== 3 || values.some((value) => !Number.isFinite(value))) {
    throw new TypeError("A finite three-vector is required.");
  }
  return [values[0]!, values[1]!, values[2]!];
}

export function multiply3(a: Matrix3, b: Matrix3): Matrix3 {
  const multiplyRow = (row: Vector3): Vector3 => [
    row[0] * b[0][0] + row[1] * b[1][0] + row[2] * b[2][0],
    row[0] * b[0][1] + row[1] * b[1][1] + row[2] * b[2][1],
    row[0] * b[0][2] + row[1] * b[1][2] + row[2] * b[2][2],
  ];
  return [multiplyRow(a[0]), multiplyRow(a[1]), multiplyRow(a[2])];
}

export function transpose3(matrix: Matrix3): Matrix3 {
  return [
    [matrix[0][0], matrix[1][0], matrix[2][0]],
    [matrix[0][1], matrix[1][1], matrix[2][1]],
    [matrix[0][2], matrix[1][2], matrix[2][2]],
  ];
}

export function rotation3(matrix: readonly number[]): Matrix3 {
  if (matrix.length !== 16 || !matrix.every(Number.isFinite)) {
    throw new TypeError("A finite column-major 4x4 camera matrix is required.");
  }
  const unit = (row: Vector3): Vector3 => {
    const length = Math.hypot(...row);
    if (length < 1e-12) throw new TypeError("Camera rotation is singular.");
    return vector3(row.map((value) => value / length));
  };
  const x = unit([matrix[0], matrix[4], matrix[8]]);
  const rawY: Vector3 = [matrix[1]!, matrix[5]!, matrix[9]!];
  const dot = x.reduce((sum, value, i) => sum + value * rawY[i], 0);
  const y = unit(vector3(rawY.map((value, i) => value - dot * x[i]!)));
  const z: Vector3 = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2],
    x[0] * y[1] - x[1] * y[0]];
  const rawZ: Vector3 = [matrix[2]!, matrix[6]!, matrix[10]!];
  if (z.reduce((sum, value, i) => sum + value * rawZ[i], 0) <= 1e-12) {
    throw new TypeError("Camera rotation is singular or reflected.");
  }
  return [x, y, z];
}

export function relativeOrientation3(matrix: readonly number[], initialMatrix: readonly number[]): Matrix3 {
  return multiply3(rotation3(matrix), transpose3(rotation3(initialMatrix)));
}

export function orientationErrorDegrees(a: Matrix3, b: Matrix3): number {
  const relative = multiply3(a, transpose3(b));
  const cosine = (relative[0][0] + relative[1][1] + relative[2][2] - 1) / 2;
  return Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
}
