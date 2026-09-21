export type Vector3 = [number, number, number];
export type ReadonlyVector3 = readonly [number, number, number];
export interface EllipsoidShape {equatorialRadius: number; polarRadius: number}
export interface ObjectDirectionFrame {presentationNodeDegrees: number; systemObliquityDegrees: number; meshRotationDegrees: number}
export interface EllipsoidIntersectionOptions extends EllipsoidShape {arithmetic?: 'division' | 'reciprocal'; rootSelection?: 'facing' | 'positive'; includeDistance?: boolean}
export interface EllipsoidHit {position: Vector3; normal: Vector3; distance?: number}
export interface Point2 {x: number; y: number}
export interface SilhouetteOptions extends EllipsoidShape {latitudeSegments: number; longitudeSegments: number; right: ReadonlyVector3; down: ReadonlyVector3; scaledRadiusX: number; scaledRadiusY: number; outputSize: number; supersampling: number}
/** Preparation-only oblate geometry. Callers supply physical/display facts. */
export function normalizeVector(vector: ReadonlyVector3): Vector3 {
  const length = Math.hypot(...vector) || 1;
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

export function dotVector(left: ReadonlyVector3, right: ReadonlyVector3) {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

export function subtractVector(left: ReadonlyVector3, right: ReadonlyVector3): Vector3 {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

export function crossVector(left: ReadonlyVector3, right: ReadonlyVector3): Vector3 {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

export function rotateX([x, y, z]: ReadonlyVector3, radians: number): Vector3 {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x, y * cosine - z * sine, y * sine + z * cosine];
}

export function rotateY([x, y, z]: ReadonlyVector3, radians: number): Vector3 {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x * cosine + z * sine, y, -x * sine + z * cosine];
}

export function rotateZ([x, y, z]: ReadonlyVector3, radians: number): Vector3 {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x * cosine - y * sine, x * sine + y * cosine, z];
}

export function ellipsoidPoint(latitude: number, longitude: number, { equatorialRadius, polarRadius }: EllipsoidShape): Vector3 {
  const latitudeRadius = Math.cos(latitude);
  return [
    equatorialRadius * latitudeRadius * Math.cos(longitude),
    equatorialRadius * latitudeRadius * Math.sin(longitude),
    polarRadius * Math.sin(latitude),
  ];
}

/** Select the outward, camera-facing root, including rays starting in the body. */
export function intersectViewRayWithEllipsoid(origin: ReadonlyVector3, direction: ReadonlyVector3, {
  equatorialRadius, polarRadius, arithmetic = 'division', rootSelection = 'facing',
  includeDistance = false,
}: EllipsoidIntersectionOptions): EllipsoidHit | null {
  if (!['division', 'reciprocal'].includes(arithmetic) || !['facing', 'positive'].includes(rootSelection)) {
    throw new TypeError('Unknown ellipsoid intersection arithmetic or root selection.');
  }
  if (arithmetic === 'reciprocal') {
    const inverseEquatorialSquared = 1 / equatorialRadius ** 2;
    const inversePolarSquared = 1 / polarRadius ** 2;
    const quadratic = (left: ReadonlyVector3, right: ReadonlyVector3) =>
      (left[0] * right[0] + left[1] * right[1]) * inverseEquatorialSquared +
        left[2] * right[2] * inversePolarSquared;
    const a = quadratic(direction, direction);
    const b = 2 * quadratic(origin, direction);
    const c = quadratic(origin, origin) - 1;
    const discriminant = b * b - 4 * a * c;
    if (!Number.isFinite(discriminant) || discriminant < 0 || a === 0) return null;
    const root = Math.sqrt(discriminant);
    const distances = rootSelection === 'positive' ? [(-b + root) / (2 * a)] :
      [(-b - root) / (2 * a), (-b + root) / (2 * a)];
    const hits = distances.map(distance => {
      const position: Vector3 = [origin[0] + direction[0] * distance, origin[1] + direction[1] * distance, origin[2] + direction[2] * distance];
      const normal = normalizeVector([
        position[0] * inverseEquatorialSquared,
        position[1] * inverseEquatorialSquared,
        position[2] * inversePolarSquared,
      ]);
      return { position, normal, distance, visibility: dotVector(normal, direction) };
    });
    const hit = hits.length === 1 || hits[0].visibility >= hits[1].visibility ? hits[0] : hits[1];
    return includeDistance ? hit : { position: hit.position, normal: hit.normal };
  }
  const equatorialSquared = equatorialRadius ** 2;
  const polarSquared = polarRadius ** 2;
  const coefficientA =
    (direction[0] ** 2 + direction[1] ** 2) / equatorialSquared +
    direction[2] ** 2 / polarSquared;
  const coefficientB = 2 * (
    (origin[0] * direction[0] + origin[1] * direction[1]) /
      equatorialSquared +
    origin[2] * direction[2] / polarSquared
  );
  const coefficientC =
    (origin[0] ** 2 + origin[1] ** 2) / equatorialSquared +
    origin[2] ** 2 / polarSquared - 1;
  const discriminant = coefficientB ** 2 - 4 * coefficientA * coefficientC;
  if (!Number.isFinite(discriminant) || discriminant < 0 || coefficientA === 0) return null;
  const root = Math.sqrt(discriminant);
  const candidates = [
    (-coefficientB - root) / (2 * coefficientA),
    (-coefficientB + root) / (2 * coefficientA),
  ].map((distance) => {
    const position: Vector3 = [
      origin[0] + direction[0] * distance,
      origin[1] + direction[1] * distance,
      origin[2] + direction[2] * distance,
    ];
    const normal = normalizeVector([
      position[0] / equatorialSquared,
      position[1] / equatorialSquared,
      position[2] / polarSquared,
    ]);
    return { position, normal, distance, visibility: dotVector(normal, direction) };
  });
  const selected = rootSelection === 'positive' ? candidates[1] : candidates[0].visibility >= candidates[1].visibility
    ? candidates[0]
    : candidates[1];
  return includeDistance ? selected : { position: selected.position, normal: selected.normal };
}

/** Authored rotations are applied in list order; angles are degrees. */
export function rotateSequence(vector: ReadonlyVector3, rotations: readonly {axis: 'x' | 'y' | 'z'; degrees: number}[]): ReadonlyVector3 {
  for (const { axis, degrees } of rotations) {
    const rotate = { x: rotateX, y: rotateY, z: rotateZ }[axis];
    if (!rotate || !Number.isFinite(degrees)) throw new TypeError('Invalid authored rotation.');
    vector = rotate(vector, degrees * Math.PI / 180);
  }
  return vector;
}

export function prepareObjectSpaceDirection(direction: ReadonlyVector3, {
  presentationNodeDegrees,
  systemObliquityDegrees,
  meshRotationDegrees,
}: ObjectDirectionFrame) {
  direction = rotateZ(direction, -presentationNodeDegrees * Math.PI / 180);
  direction = rotateX(direction, -systemObliquityDegrees * Math.PI / 180);
  direction = rotateZ(direction, -meshRotationDegrees * Math.PI / 180);
  return normalizeVector(direction);
}

export function prepareObjectViewDirection(scenePitchDegrees: number, frame: ObjectDirectionFrame) {
  return prepareObjectSpaceDirection(
    rotateY([0, 0, 1], scenePitchDegrees * Math.PI / 180), frame,
  );
}

export function convexHull2d(points: readonly Point2[]) {
  const sorted = [...points].sort((left, right) =>
    left.x - right.x || left.y - right.y);
  const cross = (origin: Point2, left: Point2, right: Point2) =>
    (left.x - origin.x) * (right.y - origin.y) -
      (left.y - origin.y) * (right.x - origin.x);
  const halfHull = (ordered: readonly Point2[]) => {
    const result: Point2[] = [];
    for (const point of ordered) {
      while (result.length >= 2 && cross(result[result.length - 2], result[result.length - 1], point) <= 0) {
        result.pop();
      }
      result.push(point);
    }
    return result;
  };
  const lower = halfHull(sorted);
  const upper = halfHull([...sorted].reverse());
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

/** Fractional scanline coverage of retained topology, not an analytic disc. */
export function prepareProjectedEllipsoidSilhouetteCoverage({
  equatorialRadius, polarRadius, latitudeSegments, longitudeSegments,
  right, down, scaledRadiusX, scaledRadiusY, outputSize, supersampling,
}: SilhouetteOptions) {
  const projectedVertices = [];
  for (let latitudeIndex = 0; latitudeIndex <= latitudeSegments; latitudeIndex += 1) {
    const latitude = -Math.PI / 2 + latitudeIndex / latitudeSegments * Math.PI;
    const longitudeCount = latitudeIndex === 0 || latitudeIndex === latitudeSegments ? 1 : longitudeSegments;
    for (let longitudeIndex = 0; longitudeIndex < longitudeCount; longitudeIndex += 1) {
      const longitude = longitudeIndex / longitudeSegments * Math.PI * 2;
      const position = ellipsoidPoint(latitude, longitude, { equatorialRadius, polarRadius });
      projectedVertices.push({
        x: (dotVector(position, right) / scaledRadiusX + 1) * 0.5 * outputSize,
        y: (dotVector(position, down) / scaledRadiusY + 1) * 0.5 * outputSize,
      });
    }
  }
  const hull = convexHull2d(projectedVertices);
  if (hull.length < 3) throw new Error('Prepared ellipsoid silhouette hull is invalid.');
  const accumulatedCoverage = new Float32Array(outputSize * outputSize);
  for (let row = 0; row < outputSize; row += 1) {
    for (let sampleIndex = 0; sampleIndex < supersampling; sampleIndex += 1) {
      const sampleY = row + (sampleIndex + 0.5) / supersampling;
      const intersections = [];
      for (let pointIndex = 0; pointIndex < hull.length; pointIndex += 1) {
        const start = hull[pointIndex];
        const end = hull[(pointIndex + 1) % hull.length];
        if (start.y === end.y) continue;
        const minimumY = Math.min(start.y, end.y);
        const maximumY = Math.max(start.y, end.y);
        if (sampleY < minimumY || sampleY >= maximumY) continue;
        intersections.push(start.x + (sampleY - start.y) / (end.y - start.y) * (end.x - start.x));
      }
      if (intersections.length < 2) continue;
      const left = Math.max(0, Math.min(...intersections));
      const rightEdge = Math.min(outputSize, Math.max(...intersections));
      const minimumColumn = Math.max(0, Math.floor(left));
      const maximumColumn = Math.min(outputSize - 1, Math.floor(Math.max(left, rightEdge - Number.EPSILON)));
      for (let column = minimumColumn; column <= maximumColumn; column += 1) {
        const horizontalCoverage = Math.max(0, Math.min(column + 1, rightEdge) - Math.max(column, left));
        accumulatedCoverage[row * outputSize + column] += horizontalCoverage / supersampling;
      }
    }
  }
  const coverage = Buffer.alloc(outputSize * outputSize);
  for (let index = 0; index < coverage.length; index += 1) {
    coverage[index] = Math.round(Math.max(0, Math.min(1, accumulatedCoverage[index])) * 255);
  }
  return coverage;
}

/** Resample an equirectangular map whose rows are evenly spaced in planetographic latitude (the angle of the surface normal, as
 * Hubble OPAL and most giant-planet maps are published) onto rows evenly spaced in the mesh's own latitude, the parameter of
 * `ellipsoidPoint` (x = a cos beta, z = b sin beta). The two agree only on a sphere: tan(planetographic) = (a / b) tan(beta), so on
 * Saturn (a / b = 1.109) a map read row for row sits up to 2.95 degrees of latitude away from where it belongs. Rows are linearly
 * interpolated; columns are unchanged. */
export function planetographicRowsToMeshLatitude(data: Uint8Array, width: number, height: number, channels: number, axisRatio: number): Buffer {
  if (!(axisRatio >= 1) || !Number.isFinite(axisRatio)) throw new RangeError('An axis ratio a / b must be finite and at least 1.');
  if (data.length !== width * height * channels) throw new RangeError('Map bytes do not match its dimensions.');
  const output = Buffer.alloc(data.length), rowBytes = width * channels;
  for (let y = 0; y < height; y += 1) {
    const beta = Math.PI / 2 - (y + 0.5) / height * Math.PI;
    const planetographic = Math.atan2(axisRatio * Math.sin(beta), Math.cos(beta));
    const source = Math.max(0, Math.min(height - 1, (Math.PI / 2 - planetographic) / Math.PI * height - 0.5));
    const y0 = Math.floor(source), y1 = Math.min(height - 1, y0 + 1), fraction = source - y0;
    for (let i = 0; i < rowBytes; i += 1) output[y * rowBytes + i] = Math.round(data[y0 * rowBytes + i]! * (1 - fraction) + data[y1 * rowBytes + i]! * fraction);
  }
  return output;
}
