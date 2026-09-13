/** Per-pixel geometry. An archive either ships backplanes with its image, or the camera's rays are cast onto the full source mesh. */
import type { SourceMesh } from '../terrestrial-layers/contracts.mts';
import type { ObservationCamera, PixelGeometry } from './contract.mts';

const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: readonly number[], b: readonly number[]) => a.map((n, i) => n - b[i]);
const unit = (a: readonly number[]) => { const l = Math.hypot(...a); return a.map(n => n / l); };
const cross = (a: readonly number[], b: readonly number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const angle = (cosine: number) => Math.acos(Math.max(-1, Math.min(1, cosine)));

/** A face counts only when the source mesh does not mark it, or any of its vertices, as unconstrained. */
export function qualifiedFace(mesh: Pick<SourceMesh, 'indices' | 'faceProvenance' | 'constraintFlags'>, id: number) {
  if (mesh.faceProvenance && mesh.faceProvenance[id] !== 0) return false;
  if (mesh.constraintFlags && mesh.indices[id].some(v => mesh.constraintFlags?.[v] === 3)) return false;
  return true;
}

export interface BackplaneFrame { width: number; height: number; planes: Record<string, ArrayLike<number>>; xyz(index: number): number[]; valid(index: number): boolean }

/** Archive backplanes: surface points in kilometres and angles in radians, decoded beside the image. Range comes from the fitted
 * camera position, because archives disagree on what a distance plane measures. */
export function archiveBackplanes(frame: BackplaneFrame, camera: Pick<ObservationCamera, 'positionMeters'>, shapeModel?: string): PixelGeometry {
  const { planes } = frame;
  return { source: 'archive-backplanes', report: { source: 'archive-backplanes', ...(shapeModel ? { shapeModel } : {}) },
    reject: i => frame.valid(i) ? null : 'no-geometry',
    distanceMeters: (i, point) => Math.hypot(...frame.xyz(i).map((n, j) => n - point[j] / 1000)) * 1000,
    rangeMeters: i => Math.hypot(...frame.xyz(i).map((n, j) => n * 1000 - camera.positionMeters[j])),
    incidence: i => planes.INCIDENCE_ANGLE_IMAGE[i], emission: i => planes.EMISSION_ANGLE_IMAGE[i], phase: i => planes.PHASE_ANGLE_IMAGE?.[i] };
}

/** Cast every detector pixel's ray onto the full source mesh, never the simplified display mesh. A pinhole camera casts only
 * inside the projected mesh bounds; a camera with lens distortion casts the whole detector. */
export function castSourceRays(camera: ObservationCamera, mesh: Pick<SourceMesh, 'positions' | 'indices' | 'intersect' | 'faceProvenance' | 'constraintFlags'>, width: number, height: number): PixelGeometry {
  const sun = camera.sunDirection;
  if (![width, height].every(n => Number.isInteger(n) && n >= 2 && n <= 4096) || !sun) throw new Error('Ray-cast geometry needs a detector size and the camera Sun direction.');
  const count = width * height, points = new Float64Array(count * 3), angles = new Float64Array(count * 3), ranges = new Float64Array(count), state = new Uint8Array(count);
  let bounds = [0, 0, width - 1, height - 1];
  if (camera.pinhole) {
    let minimumX = Infinity, minimumY = Infinity, maximumX = -Infinity, maximumY = -Infinity;
    for (const position of mesh.positions) {
      const p = camera.project(position);
      if (!p || !(p[2] > 0)) continue;
      minimumX = Math.min(minimumX, p[0]); minimumY = Math.min(minimumY, p[1]); maximumX = Math.max(maximumX, p[0]); maximumY = Math.max(maximumY, p[1]);
    }
    bounds = minimumX > maximumX ? [0, 0, -1, -1] : [Math.max(0, Math.floor(minimumX) - 2), Math.max(0, Math.floor(minimumY) - 2),
      Math.min(width - 1, Math.ceil(maximumX) + 2), Math.min(height - 1, Math.ceil(maximumY) + 2)];
  }
  const normals = mesh.indices.map(f => unit(cross(sub(mesh.positions[f[1]], mesh.positions[f[0]]), sub(mesh.positions[f[2]], mesh.positions[f[0]]))));
  const eye = camera.positionMeters;
  let geometryPixels = 0, unconstrainedPixels = 0;
  for (let y = bounds[1]; y <= bounds[3]; y++) for (let x = bounds[0]; x <= bounds[2]; x++) {
    const i = y * width + x, direction = camera.ray(x, y), hit = mesh.intersect(eye, direction);
    if (!hit) continue;
    if (!qualifiedFace(mesh, hit.faceId)) { state[i] = 2; unconstrainedPixels++; continue; }
    const normal = normals[hit.faceId];
    for (let k = 0; k < 3; k++) points[i * 3 + k] = eye[k] + direction[k] * hit.radius;
    angles[i * 3] = angle(dot(normal, sun)); angles[i * 3 + 1] = angle(-dot(normal, direction)); angles[i * 3 + 2] = angle(-dot(sun, direction));
    ranges[i] = hit.radius; state[i] = 1; geometryPixels++;
  }
  return { source: 'source-mesh-rays', report: { source: 'source-mesh-rays', projectedBounds: bounds, geometryPixels, unconstrainedPixels },
    reject: i => state[i] === 1 ? null : state[i] === 2 ? 'unconstrained-source-shape' : 'no-geometry',
    distanceMeters: (i, point) => Math.hypot(points[i * 3] - point[0], points[i * 3 + 1] - point[1], points[i * 3 + 2] - point[2]),
    rangeMeters: i => ranges[i],
    incidence: i => angles[i * 3], emission: i => angles[i * 3 + 1], phase: i => angles[i * 3 + 2] };
}
