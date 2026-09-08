export type SurfacePoint = readonly [number, number, number];
export type SurfaceTriangle = readonly [SurfacePoint, SurfacePoint, SurfacePoint];
export type SurfaceFrontFace = 'clockwise' | 'counter-clockwise';
/** Prepared dual axes map a hit into an opaque unit disc on a retained face. */
export interface SurfaceDisc {
  readonly firstTriangle: number; readonly triangleCount: number;
  readonly center: SurfacePoint; readonly axisU: SurfacePoint; readonly axisV: SurfacePoint;
}
export interface PreparedSurfaceHit {
  readonly target: number; readonly triangles: readonly SurfaceTriangle[]; readonly discs?: readonly SurfaceDisc[];
  readonly frontFace?: SurfaceFrontFace;
}
export interface PreparedSurfaceHitTest {
  (clientX: number, clientY: number): boolean;
  point(clientX: number, clientY: number): SurfacePoint | null;
  surfacePointRadius(clientX: number, clientY: number): number | null;
  radialDistance(rotation: DOMMatrix, direction: SurfacePoint): number | null;
}
const sub = (a: SurfacePoint, b: SurfacePoint): SurfacePoint => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: SurfacePoint, b: SurfacePoint): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: SurfacePoint, b: SurfacePoint): SurfacePoint => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

function computedMatrix(node: HTMLElement): DOMMatrix {
  // CSS text serialization rounds matrix components. That loses metres at
  // close range; Typed OM retains the computed transform's numeric precision.
  const transform = node.computedStyleMap?.().get('transform');
  return transform && 'toMatrix' in transform ? (transform as CSSTransformValue).toMatrix()
    : new DOMMatrix(getComputedStyle(node).transform);
}

export function validateSurfaceDiscs(discs: unknown, triangleCount: number): asserts discs is readonly SurfaceDisc[] | undefined {
  if (discs === undefined) return;
  if (!Array.isArray(discs) || discs.length > triangleCount) throw new TypeError('Invalid prepared surface discs.');
  let end = 0;
  for (const d of discs) {
    if (!d || Object.keys(d).some(key => !['firstTriangle', 'triangleCount', 'center', 'axisU', 'axisV'].includes(key)) ||
        !Number.isSafeInteger(d.firstTriangle) || d.firstTriangle < end || !Number.isSafeInteger(d.triangleCount) || d.triangleCount < 1 ||
        d.firstTriangle + d.triangleCount > triangleCount || [d.center, d.axisU, d.axisV].some(p =>
          !Array.isArray(p) || p.length !== 3 || p.some(n => !Number.isFinite(n)))) throw new TypeError('Invalid prepared surface disc.');
    if (!(Math.hypot(...cross(d.axisU, d.axisV)) > 0)) throw new TypeError('Degenerate prepared surface disc.');
    end = d.firstTriangle + d.triangleCount;
  }
}

/** Intersect source-prepared triangles. Runtime never creates or resamples a mesh. */
export function rayHitsPreparedTriangles(origin: SurfacePoint, direction: SurfacePoint, triangles: readonly SurfaceTriangle[], frontFace?: SurfaceFrontFace): boolean {
  return intersectPreparedSurface(origin, direction, { triangles, frontFace }) !== null;
}

/** Return the nearest painted hit, or the outer boundary along a body-centred ray. */
export function intersectPreparedSurface(origin: SurfacePoint, direction: SurfacePoint,
  plan: Pick<PreparedSurfaceHit, 'triangles' | 'discs' | 'frontFace'>, farthest = false) {
  let hit: { point: SurfacePoint; distance: number; triangleIndex: number } | null = null;
  for (let triangleIndex = 0; triangleIndex < plan.triangles.length; triangleIndex++) {
    const [a, b, c] = plan.triangles[triangleIndex]!;
    const ab = sub(b, a), ac = sub(c, a), p = cross(direction, ac), determinant = dot(ab, p);
    if (Math.abs(determinant) < 1e-12) continue;
    if (plan.frontFace === 'clockwise' && determinant > 0 || plan.frontFace === 'counter-clockwise' && determinant < 0) continue;
    const t = sub(origin, a), u = dot(t, p) / determinant;
    if (u < 0 || u > 1) continue;
    const q = cross(t, ab), v = dot(direction, q) / determinant;
    const distance = dot(ac, q) / determinant;
    if (v < 0 || u + v > 1 || distance < 0 ||
        (hit && (farthest ? distance <= hit.distance : distance >= hit.distance))) continue;
    const point: SurfacePoint = [origin[0] + distance * direction[0], origin[1] + distance * direction[1], origin[2] + distance * direction[2]];
    const disc = plan.discs?.find(d => triangleIndex >= d.firstTriangle && triangleIndex < d.firstTriangle + d.triangleCount);
    if (disc) {
      const offset = sub(point, disc.center);
      if (dot(offset, disc.axisU) ** 2 + dot(offset, disc.axisV) ** 2 > 1 + 1e-12) continue;
    }
    hit = { point, distance, triangleIndex };
  }
  return hit;
}

export function bindPreparedSurfaceHit(plan: PreparedSurfaceHit, target: HTMLElement, scene: HTMLElement,
  camera: HTMLElement): PreparedSurfaceHitTest {
  if (!target || !scene.contains(target) || !Number.isSafeInteger(plan.target) || !Array.isArray(plan.triangles) ||
      (plan.frontFace !== undefined && !['clockwise','counter-clockwise'].includes(plan.frontFace)) ||
      plan.triangles.length === 0 || plan.triangles.length > 10000 || plan.triangles.some(triangle =>
        !Array.isArray(triangle) || triangle.length !== 3 || triangle.some(point =>
          !Array.isArray(point) || point.length !== 3 || point.some(n => !Number.isFinite(n))))) throw new TypeError('Invalid prepared surface hit mesh.');
  validateSurfaceDiscs(plan.discs, plan.triangles.length);
  const ancestors = (end: HTMLElement) => {
    let matrix = new DOMMatrix(), node: HTMLElement | null = target;
    while (node && node !== end) {
      matrix = computedMatrix(node).multiply(matrix);
      node = node.parentElement;
    }
    return node === end ? matrix : null;
  };
  const sample = (clientX: number, clientY: number) => {
    const bounds = camera.getBoundingClientRect(), style = getComputedStyle(camera), focal = parseFloat(style.perspective);
    const principal = style.perspectiveOrigin.split(' ').map(parseFloat);
    if (!(focal > 0) || principal.length !== 2 || principal.some(n => !Number.isFinite(n))) return null;
    // Retained mesh ancestors use zero transform origins. Their current matrices
    // include the same body spin and world-camera placement as the painted scene.
    const matrix = ancestors(camera);
    if (!matrix) return null;
    const inverse = matrix.inverse(), offset = [principal[0] - bounds.width / 2, principal[1] - bounds.height / 2];
    const eye = inverse.transformPoint(new DOMPoint(offset[0], offset[1], focal));
    const ray = inverse.transformPoint(new DOMPoint(clientX - bounds.x - principal[0], clientY - bounds.y - principal[1], -focal, 0));
    const hit = intersectPreparedSurface([eye.x, eye.y, eye.z], [ray.x, ray.y, ray.z], plan);
    return hit ? { hit, matrix } : null;
  };
  return Object.assign((clientX: number, clientY: number) => sample(clientX, clientY) !== null, {
    point(clientX: number, clientY: number): SurfacePoint | null {
      const result = sample(clientX, clientY);
      if (!result) return null;
      const point = result.matrix.transformPoint(new DOMPoint(...result.hit.point));
      return [point.x, point.y, point.z];
    },
    surfacePointRadius(clientX: number, clientY: number) {
      const result = sample(clientX, clientY);
      if (!result) return null;
      const point = result.matrix.transformPoint(new DOMPoint(...result.hit.point));
      const center = computedMatrix(scene).transformPoint(new DOMPoint());
      return Math.hypot(point.x - center.x, point.y - center.y, point.z - center.z);
    },
    radialDistance(rotation: DOMMatrix, direction: SurfacePoint) {
      const local = ancestors(scene), length = Math.hypot(...direction);
      if (!local || !(length > 0)) return null;
      const inverse = rotation.multiply(local).inverse();
      const origin = inverse.transformPoint(new DOMPoint());
      const ray = inverse.transformPoint(new DOMPoint(direction[0] / length, direction[1] / length, direction[2] / length, 0));
      return intersectPreparedSurface([origin.x, origin.y, origin.z], [ray.x, ray.y, ray.z], plan, true)?.distance ?? null;
    },
  });
}
