// Immutable object transforms and shape dimensions arrive from preparation.
// Only the current shared camera basis and light roll vary during publication.
export function createPreparedEllipsoidProjection({ projection, width, height = width }) {
  if (!(width > 0) || !(height > 0) || !Number.isFinite(width) || !Number.isFinite(height) ||
      !["equatorialRadius", "polarRadius", "coverageScale"].every(key => Number.isFinite(projection?.[key]) && projection[key] > 0)) {
    throw new TypeError("Prepared ellipsoid dimensions must be positive and finite.");
  }
  const matrices = {};
  for (const key of ["bodySystemMatrix", "bodyMeshMatrix", "materialSystemMatrix", "materialMeshMatrix",
    "baseProjection", "centerTranslation", "inverseCenterTranslation"]) {
    matrices[key] = Object.freeze([...requirePreparedMatrix4(projection[key])]);
  }
  const counterTransport = Object.freeze(Object.fromEntries(["counterPrecision", "counterFractionDigits", "counterFractionScale"]
    .filter(key => projection[key] !== undefined).map(key => [key, projection[key]])));
  const precision = value => Number.isInteger(value) && value >= 1 && value <= 16;
  if (counterTransport.counterPrecision !== undefined && !precision(counterTransport.counterPrecision) ||
      counterTransport.counterFractionDigits !== undefined && (!precision(counterTransport.counterPrecision) ||
        !precision(counterTransport.counterFractionDigits) || !(counterTransport.counterFractionScale > 0) || !Number.isFinite(counterTransport.counterFractionScale)) ||
      counterTransport.counterFractionScale !== undefined && counterTransport.counterFractionDigits === undefined) {
    throw new TypeError("Prepared matrix transport precision is invalid.");
  }
  const equatorialRadius = projection.equatorialRadius * projection.coverageScale;
  const polarRadius = projection.polarRadius * projection.coverageScale;
  return ({ degrees, sceneMatrix, counterMatrix, preserveDefault = false }) => {
    if (!Number.isFinite(degrees) || typeof preserveDefault !== "boolean") {
      throw new TypeError("Prepared ellipsoid view must be finite.");
    }
    const localRotation = multiplyPreparedMatrix4(matrices.centerTranslation,
      multiplyPreparedMatrix4(preparedRotationMatrix4("z", degrees), matrices.inverseCenterTranslation));
    const materialProjection = multiplyPreparedMatrix4(matrices.baseProjection, localRotation);
    if (preserveDefault) return serializePreparedMatrix4(materialProjection);
    const scene = readPreparedMatrix4(sceneMatrix), counter = readPreparedCounterMatrix(counterMatrix, counterTransport);
    const body = multiplyPreparedMatrix4(multiplyPreparedMatrix4(scene, matrices.bodySystemMatrix), matrices.bodyMeshMatrix);
    const parent = multiplyPreparedMatrix4(multiplyPreparedMatrix4(
      multiplyPreparedMatrix4(scene, matrices.materialSystemMatrix), counter), matrices.materialMeshMatrix);
    const material = multiplyPreparedMatrix4(parent, materialProjection);
    const target = projectedCovariance([
      transformPreparedPoint(body, 1, 0, 0, 0), transformPreparedPoint(body, 0, 1, 0, 0), transformPreparedPoint(body, 0, 0, 1, 0),
    ], [equatorialRadius, equatorialRadius, polarRadius]);
    const source = projectedCovariance([
      transformPreparedPoint(material, 1, 0, 0, 0), transformPreparedPoint(material, 0, 1, 0, 0),
    ], [width / 2, height / 2]);
    const correction = multiplyMatrix2(covarianceSquareRoot(target), invertMatrix2(covarianceSquareRoot(source)));
    const materialCenter = transformPreparedPoint(material, width / 2, height / 2, 0, 1);
    const bodyCenter = transformPreparedPoint(body, 0, 0, 0, 1);
    const screenCorrection = [
      correction[0][0], correction[1][0], 0, 0,
      correction[0][1], correction[1][1], 0, 0,
      0, 0, 1, 0,
      bodyCenter.x - correction[0][0] * materialCenter.x - correction[0][1] * materialCenter.y,
      bodyCenter.y - correction[1][0] * materialCenter.x - correction[1][1] * materialCenter.y, 0, 1,
    ];
    return serializePreparedMatrix4(multiplyPreparedMatrix4(
      multiplyPreparedMatrix4(invertPreparedAffineMatrix4(parent), screenCorrection), material));
  };
}

function requirePreparedMatrix4(value) {
  if (!Array.isArray(value) || value.length !== 16 || !value.every(Number.isFinite)) {
    throw new TypeError("Prepared projection requires a finite matrix.");
  }
  return value;
}

// This consumes a camera publication, never an element's CSS transform.
export function readPreparedMatrix4(value) {
  if (Array.isArray(value)) return requirePreparedMatrix4(value);
  const match = typeof value === "string" && value.match(/^matrix3d\(([^)]+)\)$/u);
  if (!match) throw new TypeError("Prepared projection requires a matrix3d view.");
  return requirePreparedMatrix4(match[1].split(",").map(Number));
}

// Some retained references consumed CSSOM numeric transport before projection.
// Its precision is prepared data. Preserve that input without reparsing DOM or
// changing the higher-precision transform that the common view owner publishes.
export function readPreparedCounterMatrix(value, projection) {
  const values = readPreparedMatrix4(value);
  if (projection.counterPrecision === undefined) return values;
  const components = typeof value === "string" ? value.slice(9, -1).split(",").map(value => value.trim()) : values.map(String);
  const fastDecimal = projection.counterFractionDigits !== undefined && !components.some(value => /e/iu.test(value));
  return values.map((number, index) => {
    const fraction = components[index].split(".")[1];
    if (fastDecimal && fraction?.length >= projection.counterFractionDigits) {
      number = Math.sign(number) * (Math.trunc(Math.abs(number)) +
        Number(fraction.slice(0, projection.counterFractionDigits)) * projection.counterFractionScale);
    }
    return Number(number.toPrecision(projection.counterPrecision));
  });
}

export function multiplyPreparedMatrix4(left, right) {
  const product = new Array(16).fill(0);
  for (let column = 0; column < 4; column++) for (let row = 0; row < 4; row++) for (let index = 0; index < 4; index++) {
    product[column * 4 + row] += left[index * 4 + row] * right[column * 4 + index];
  }
  return product;
}

export function preparedRotationMatrix4(axis, degrees) {
  const radians = degrees * Math.PI / 180, cosine = Math.cos(radians), sine = Math.sin(radians);
  if (axis === "x") return [1, 0, 0, 0, 0, cosine, sine, 0, 0, -sine, cosine, 0, 0, 0, 0, 1];
  if (axis === "y") return [cosine, 0, -sine, 0, 0, 1, 0, 0, sine, 0, cosine, 0, 0, 0, 0, 1];
  if (axis === "z") return [cosine, sine, 0, 0, -sine, cosine, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  throw new TypeError("Prepared rotation axis is invalid.");
}

export function invertPreparedAffineMatrix4(matrix) {
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

function transformPreparedPoint(matrix, x, y, z, w) {
  return { x: matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12] * w,
    y: matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13] * w,
    z: matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14] * w };
}

export function serializePreparedMatrix4(matrix) {
  return `matrix3d(${matrix.map(value => Math.abs(value) < 1e-12 ? 0 : Number(value.toFixed(12))).join(",")})`;
}

function projectedCovariance(directions, radii) {
  return {
    xx: directions.reduce((sum, direction, index) => sum + (direction.x * radii[index]) ** 2, 0),
    xy: directions.reduce((sum, direction, index) => sum + direction.x * direction.y * radii[index] ** 2, 0),
    yy: directions.reduce((sum, direction, index) => sum + (direction.y * radii[index]) ** 2, 0),
  };
}

function covarianceSquareRoot(matrix) {
  const determinantRoot = Math.sqrt(Math.max(0, matrix.xx * matrix.yy - matrix.xy ** 2));
  const divisor = Math.sqrt(Math.max(Number.EPSILON, matrix.xx + matrix.yy + 2 * determinantRoot));
  return [[(matrix.xx + determinantRoot) / divisor, matrix.xy / divisor],
    [matrix.xy / divisor, (matrix.yy + determinantRoot) / divisor]];
}

function invertMatrix2(matrix) {
  const determinant = matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) throw new RangeError("Prepared material projection became singular.");
  return [[matrix[1][1] / determinant, -matrix[0][1] / determinant], [-matrix[1][0] / determinant, matrix[0][0] / determinant]];
}

function multiplyMatrix2(left, right) {
  return [[left[0][0] * right[0][0] + left[0][1] * right[1][0], left[0][0] * right[0][1] + left[0][1] * right[1][1]],
    [left[1][0] * right[0][0] + left[1][1] * right[1][0], left[1][0] * right[0][1] + left[1][1] * right[1][1]]];
}
