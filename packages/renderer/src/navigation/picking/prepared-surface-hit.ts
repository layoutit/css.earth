import { type SurfacePoint, type SurfaceTriangle, type SurfaceFrontFace, type PreparedSurfaceRange, type PreparedSurfaceHit } from '@cssearth/objects';

import { cross3 as cross, dot3 as dot } from '@cssearth/core';

const sub = (a: SurfacePoint, b: SurfacePoint): SurfacePoint => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
/** Intersect source-prepared triangles. Runtime never creates or resamples a mesh. */
export function rayHitsPreparedTriangles(origin: SurfacePoint, direction: SurfacePoint, triangles: readonly SurfaceTriangle[], frontFace?: SurfaceFrontFace,
  range?: Pick<PreparedSurfaceRange, 'start' | 'count'>): boolean {
  const start = range?.start ?? 0, end = start + (range?.count ?? triangles.length);
  for (let index = start; index < end; index++) {
    const [a, b, c] = triangles[index];
    const ab = sub(b, a), ac = sub(c, a), p = cross(direction, ac), determinant = dot(ab, p);
    if (Math.abs(determinant) < 1e-12) continue;
    if (frontFace === 'clockwise' && determinant > 0 || frontFace === 'counter-clockwise' && determinant < 0) continue;
    const t = sub(origin, a), u = dot(t, p) / determinant;
    if (u < 0 || u > 1) continue;
    const q = cross(t, ab), v = dot(direction, q) / determinant;
    if (v >= 0 && u + v <= 1 && dot(ac, q) / determinant >= 0) return true;
  }
  return false;
}

export function bindPreparedSurfaceHit(plan: PreparedSurfaceHit, target: HTMLElement, scene: HTMLElement,
  camera: HTMLElement, selectedDataset?: () => string | undefined): (clientX: number, clientY: number) => boolean {
  if (!target || !scene.contains(target) || !Number.isSafeInteger(plan.target) || !Array.isArray(plan.triangles) ||
      (plan.frontFace !== undefined && !['clockwise','counter-clockwise'].includes(plan.frontFace)) ||
      plan.triangles.length === 0 || plan.triangles.length > 10000 || plan.triangles.some(triangle =>
        !Array.isArray(triangle) || triangle.length !== 3 || triangle.some(point =>
          !Array.isArray(point) || point.length !== 3 || point.some(n => !Number.isFinite(n))))) throw new TypeError('Invalid prepared surface hit mesh.');
  if (plan.datasetRanges && (!selectedDataset || !plan.datasetRanges.length || plan.datasetRanges.some(range =>
    !Number.isSafeInteger(range.start) || range.start < 0 || !Number.isSafeInteger(range.count) || range.count < 1 ||
    range.start + range.count > plan.triangles.length))) throw new TypeError('Invalid prepared surface dataset ranges.');
  return (clientX, clientY) => {
    const range = plan.datasetRanges?.find(range => range.datasetId === selectedDataset?.());
    if (plan.datasetRanges && !range) return false;
    const bounds = camera.getBoundingClientRect(), style = getComputedStyle(camera), focal = parseFloat(style.perspective);
    // The camera root's optical framing is a uniform 2D scale. Its bounds are
    // scaled client pixels; CSS perspective and mesh matrices use local pixels.
    const scale = Number.parseFloat(style.scale) || 1;
    const principal = style.perspectiveOrigin.split(' ').map(parseFloat);
    if (!(focal > 0) || principal.length !== 2 || principal.some(n => !Number.isFinite(n))) return false;
    // Retained mesh ancestors use zero transform origins. Their current matrices
    // include the same body spin and world-camera placement as the painted scene.
    let matrix = new DOMMatrix(), node: HTMLElement | null = target;
    while (node && node !== camera) {
      matrix = new DOMMatrix(getComputedStyle(node).transform).multiply(matrix);
      node = node.parentElement;
    }
    if (node !== camera) return false;
    const inverse = matrix.inverse(), offset = [principal[0] - bounds.width / (2 * scale), principal[1] - bounds.height / (2 * scale)];
    const eye = inverse.transformPoint(new DOMPoint(offset[0], offset[1], focal));
    const ray = inverse.transformPoint(new DOMPoint((clientX - bounds.x) / scale - principal[0], (clientY - bounds.y) / scale - principal[1], -focal, 0));
    return rayHitsPreparedTriangles([eye.x, eye.y, eye.z], [ray.x, ray.y, ray.z], plan.triangles, plan.frontFace, range);
  };
}
