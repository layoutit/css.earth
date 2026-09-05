// Offline comparison of start-relative camera rotations in the control frame.
export function multiply3(a, b) {
  return a.map((row) => row.map((_, column) =>
    row.reduce((sum, value, index) => sum + value * b[index][column], 0)));
}

export function transpose3(matrix) {
  return matrix[0].map((_, column) => matrix.map((row) => row[column]));
}

export function rotation3(matrix) {
  if (matrix.length !== 16 || !matrix.every(Number.isFinite)) {
    throw new TypeError("A finite column-major 4x4 camera matrix is required.");
  }
  const unit = (row) => {
    const length = Math.hypot(...row);
    if (length < 1e-12) throw new TypeError("Camera rotation is singular.");
    return row.map((value) => value / length);
  };
  const x = unit([matrix[0], matrix[4], matrix[8]]);
  const rawY = [matrix[1], matrix[5], matrix[9]];
  const dot = x.reduce((sum, value, i) => sum + value * rawY[i], 0);
  const y = unit(rawY.map((value, i) => value - dot * x[i]));
  const z = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2],
    x[0] * y[1] - x[1] * y[0]];
  const rawZ = [matrix[2], matrix[6], matrix[10]];
  if (z.reduce((sum, value, i) => sum + value * rawZ[i], 0) <= 1e-12) {
    throw new TypeError("Camera rotation is singular or reflected.");
  }
  return [x, y, z];
}

export function relativeOrientation3(matrix, initialMatrix) {
  return multiply3(rotation3(matrix), transpose3(rotation3(initialMatrix)));
}

export function orientationErrorDegrees(a, b) {
  const relative = multiply3(a, transpose3(b));
  const cosine = (relative[0][0] + relative[1][1] + relative[2][2] - 1) / 2;
  return Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
}
