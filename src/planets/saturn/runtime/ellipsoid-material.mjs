export function createEllipsoidMaterialPublisher({
  element,
  bodySystem,
  bodyMesh,
  materialSystem,
  materialCounter,
  materialMesh,
  projection,
  width,
  height = width,
}) {
  if (!(element instanceof HTMLElement) ||
      !(bodySystem instanceof HTMLElement) ||
      !(bodyMesh instanceof HTMLElement) ||
      !(materialSystem instanceof HTMLElement) ||
      !(materialCounter instanceof HTMLElement) ||
      !(materialMesh instanceof HTMLElement) ||
      !Number.isFinite(width) || width <= 0 ||
      !Number.isFinite(height) || height <= 0 ||
      !Number.isFinite(projection?.equatorialRadius) ||
      !Number.isFinite(projection?.polarRadius) ||
      !Number.isFinite(projection?.tileSize)) {
    throw new TypeError("Saturn ellipsoid material projection is invalid.");
  }
  const baseProjection = parseTransformMatrix(element.style.transform);
  const equatorialRadius = projection.equatorialRadius * projection.tileSize;
  const polarRadius = projection.polarRadius * projection.tileSize;
  const coverageScale = projection.coverageScale ?? 1;
  let publishedTransform = null;

  return ({ degrees, sceneMatrix, preserveApprovedDefault = false }) => {
    if (!Number.isFinite(degrees) || typeof sceneMatrix !== "string") {
      throw new TypeError("Saturn material presentation must be finite.");
    }
    const localRotation = multiplyMatrix4(
      translationMatrix(width / 2, height / 2),
      multiplyMatrix4(
        rotationMatrix("z", degrees),
        translationMatrix(-width / 2, -height / 2),
      ),
    );
    const uncorrectedProjection = multiplyMatrix4(
      baseProjection,
      localRotation,
    );
    const nextProjection = preserveApprovedDefault
      ? uncorrectedProjection
      : correctEllipsoidMaterialProjection({
        sceneMatrix: parseTransformMatrix(sceneMatrix),
        bodySystemMatrix: parseTransformMatrix(bodySystem.style.transform),
        bodyMeshMatrix: parseTransformMatrix(bodyMesh.style.transform),
        materialSystemMatrix: parseTransformMatrix(
          materialSystem.style.transform,
        ),
        materialCounterMatrix: parseTransformMatrix(
          materialCounter.style.transform,
        ),
        materialMeshMatrix: parseTransformMatrix(
          materialMesh.style.transform,
        ),
        materialProjection: uncorrectedProjection,
        equatorialRadius: equatorialRadius * coverageScale,
        polarRadius: polarRadius * coverageScale,
        width,
        height,
      });
    const transform = serializeMatrix4(nextProjection);
    if (transform === publishedTransform &&
        element.style.transform === transform) return false;
    element.style.removeProperty("rotate");
    element.style.transform = transform;
    publishedTransform = transform;
    return true;
  };
}

function correctEllipsoidMaterialProjection({
  sceneMatrix,
  bodySystemMatrix,
  bodyMeshMatrix,
  materialSystemMatrix,
  materialCounterMatrix,
  materialMeshMatrix,
  materialProjection,
  equatorialRadius,
  polarRadius,
  width,
  height,
}) {
  const bodyMatrix = multiplyMatrix4(
    multiplyMatrix4(sceneMatrix, bodySystemMatrix),
    bodyMeshMatrix,
  );
  const materialParentMatrix = multiplyMatrix4(
    multiplyMatrix4(
      multiplyMatrix4(sceneMatrix, materialSystemMatrix),
      materialCounterMatrix,
    ),
    materialMeshMatrix,
  );
  const materialMatrix = multiplyMatrix4(
    materialParentMatrix,
    materialProjection,
  );
  const bodyDirections = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ].map(([x, y, z]) => transformPoint(bodyMatrix, x, y, z, 0));
  const bodyCovariance = ellipseCovariance(
    bodyDirections,
    [equatorialRadius, equatorialRadius, polarRadius],
  );
  const materialDirections = [
    transformPoint(materialMatrix, 1, 0, 0, 0),
    transformPoint(materialMatrix, 0, 1, 0, 0),
  ];
  const materialCovariance = ellipseCovariance(
    materialDirections,
    [width / 2, height / 2],
  );
  const correction = covarianceCorrection(
    bodyCovariance,
    materialCovariance,
  );
  const materialCenter = transformPoint(
    materialMatrix,
    width / 2,
    height / 2,
    0,
    1,
  );
  const bodyCenter = transformPoint(bodyMatrix, 0, 0, 0, 1);
  const translateX = bodyCenter.x -
    correction[0][0] * materialCenter.x -
    correction[0][1] * materialCenter.y;
  const translateY = bodyCenter.y -
    correction[1][0] * materialCenter.x -
    correction[1][1] * materialCenter.y;
  const screenCorrection = [
    correction[0][0], correction[1][0], 0, 0,
    correction[0][1], correction[1][1], 0, 0,
    0, 0, 1, 0,
    translateX, translateY, 0, 1,
  ];
  return multiplyMatrix4(
    multiplyMatrix4(invertAffineMatrix4(materialParentMatrix), screenCorrection),
    materialMatrix,
  );
}

function parseTransformMatrix(value) {
  const transform = value.trim();
  if (!transform || transform === "none") return identityMatrix4();
  const matrixMatch = transform.match(/^matrix3d\(([^)]+)\)$/u);
  if (matrixMatch) {
    const values = matrixMatch[1].split(",").map(Number);
    if (values.length === 16 && values.every(Number.isFinite)) return values;
    throw new TypeError("Saturn matrix3d transform is invalid.");
  }

  const operationPattern = /rotate([XYZ])\((-?[\d.]+)deg\)/gu;
  let matrix = identityMatrix4();
  let remainder = transform;
  for (const match of transform.matchAll(operationPattern)) {
    matrix = multiplyMatrix4(
      matrix,
      rotationMatrix(match[1].toLowerCase(), Number(match[2])),
    );
    remainder = remainder.replace(match[0], "");
  }
  if (remainder.trim()) {
    throw new TypeError(`Unsupported Saturn transform: ${value}`);
  }
  return matrix;
}

function identityMatrix4() {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
}

function translationMatrix(x, y, z = 0) {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1,
  ];
}

function rotationMatrix(axis, degrees) {
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  if (axis === "x") {
    return [
      1, 0, 0, 0,
      0, cosine, sine, 0,
      0, -sine, cosine, 0,
      0, 0, 0, 1,
    ];
  }
  if (axis === "y") {
    return [
      cosine, 0, -sine, 0,
      0, 1, 0, 0,
      sine, 0, cosine, 0,
      0, 0, 0, 1,
    ];
  }
  return [
    cosine, sine, 0, 0,
    -sine, cosine, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
}

function multiplyMatrix4(left, right) {
  const product = new Array(16).fill(0);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      for (let index = 0; index < 4; index += 1) {
        product[column * 4 + row] +=
          left[index * 4 + row] * right[column * 4 + index];
      }
    }
  }
  return product;
}

function invertAffineMatrix4(matrix) {
  const [a, d, g, , b, e, h, , c, f, i] = matrix;
  const determinant =
    a * (e * i - f * h) -
    b * (d * i - f * g) +
    c * (d * h - e * g);
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) {
    throw new RangeError("Saturn material parent transform became singular.");
  }
  const inverse = [
    (e * i - f * h) / determinant,
    (f * g - d * i) / determinant,
    (d * h - e * g) / determinant,
    0,
    (c * h - b * i) / determinant,
    (a * i - c * g) / determinant,
    (b * g - a * h) / determinant,
    0,
    (b * f - c * e) / determinant,
    (c * d - a * f) / determinant,
    (a * e - b * d) / determinant,
    0,
    0, 0, 0, 1,
  ];
  const translation = transformPoint(
    inverse,
    matrix[12],
    matrix[13],
    matrix[14],
    0,
  );
  inverse[12] = -translation.x;
  inverse[13] = -translation.y;
  inverse[14] = -translation.z;
  return inverse;
}

function transformPoint(matrix, x, y, z, w) {
  return Object.freeze({
    x: matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12] * w,
    y: matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13] * w,
    z: matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14] * w,
  });
}

function serializeMatrix4(matrix) {
  return `matrix3d(${matrix.map((value) =>
    Math.abs(value) < 1e-12 ? 0 : Number(value.toFixed(12))
  ).join(",")})`;
}

function ellipseCovariance(directions, radii) {
  return Object.freeze({
    xx: directions.reduce(
      (sum, direction, index) =>
        sum + (direction.x * radii[index]) ** 2,
      0,
    ),
    xy: directions.reduce(
      (sum, direction, index) =>
        sum + direction.x * direction.y * radii[index] ** 2,
      0,
    ),
    yy: directions.reduce(
      (sum, direction, index) =>
        sum + (direction.y * radii[index]) ** 2,
      0,
    ),
  });
}

function covarianceCorrection(target, source) {
  const targetRoot = covarianceSquareRoot(target);
  const sourceRootInverse = invertMatrix2(covarianceSquareRoot(source));
  return multiplyMatrix2(targetRoot, sourceRootInverse);
}

function covarianceSquareRoot(matrix) {
  const determinantRoot = Math.sqrt(Math.max(
    0,
    matrix.xx * matrix.yy - matrix.xy ** 2,
  ));
  const divisor = Math.sqrt(Math.max(
    Number.EPSILON,
    matrix.xx + matrix.yy + 2 * determinantRoot,
  ));
  return [
    [(matrix.xx + determinantRoot) / divisor, matrix.xy / divisor],
    [matrix.xy / divisor, (matrix.yy + determinantRoot) / divisor],
  ];
}

function invertMatrix2(matrix) {
  const determinant =
    matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) {
    throw new RangeError("Saturn material projection became singular.");
  }
  return [
    [matrix[1][1] / determinant, -matrix[0][1] / determinant],
    [-matrix[1][0] / determinant, matrix[0][0] / determinant],
  ];
}

function multiplyMatrix2(left, right) {
  return [
    [
      left[0][0] * right[0][0] + left[0][1] * right[1][0],
      left[0][0] * right[0][1] + left[0][1] * right[1][1],
    ],
    [
      left[1][0] * right[0][0] + left[1][1] * right[1][0],
      left[1][0] * right[0][1] + left[1][1] * right[1][1],
    ],
  ];
}
