import { cross3 as cross, dot3 as dot } from '@cssearth/core';
/** Per-pixel geometry. An archive either ships backplanes with its image, or the camera's rays are cast onto the full source mesh. */
import type { SourceMesh } from '../terrestrial-layers/contracts.mts';
import type { ObservationCamera, PixelGeometry } from './contract.mts';

const sub = (a: readonly number[], b: readonly number[]) => a.map((n, i) => n - b[i]);
const unit = (a: readonly number[]) => { const l = Math.hypot(...a); return a.map(n => n / l); };

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

type ShadingMesh = Pick<SourceMesh, 'positions' | 'indices'>;
const shadingNormals = new WeakMap<ShadingMesh, (faceId: number, point: readonly number[]) => readonly number[]>();

/** The surface normal at a point on a face: area-weighted normals at the welded source vertices, interpolated across the face, so
 * photometry follows the surface the mesh approximates rather than its facets. A face whose interpolated normal turns away keeps its own. */
export function shadingNormal(mesh: ShadingMesh) {
  const cached = shadingNormals.get(mesh);
  if (cached) return cached;
  const ids = new Map<string, number>(), welded = mesh.positions.map(p => { const key = p.join(','); if (!ids.has(key)) ids.set(key, ids.size); return ids.get(key)!; });
  const faceNormals = mesh.indices.map(f => cross(sub(mesh.positions[f[1]], mesh.positions[f[0]]), sub(mesh.positions[f[2]], mesh.positions[f[0]])));
  const normals = new Float64Array(ids.size * 3);
  mesh.indices.forEach((f, face) => { for (const v of f) for (let k = 0; k < 3; k++) normals[welded[v] * 3 + k] += faceNormals[face][k]; });
  for (let v = 0; v < ids.size; v++) { const l = Math.hypot(normals[v * 3], normals[v * 3 + 1], normals[v * 3 + 2]) || 1; for (let k = 0; k < 3; k++) normals[v * 3 + k] /= l; }
  const normalAt = (faceId: number, point: readonly number[]) => {
    const f = mesh.indices[faceId], a = mesh.positions[f[0]], v0 = sub(mesh.positions[f[1]], a), v1 = sub(mesh.positions[f[2]], a), v2 = sub(point, a);
    const d00 = dot(v0, v0), d01 = dot(v0, v1), d11 = dot(v1, v1), d20 = dot(v2, v0), d21 = dot(v2, v1), d = d00 * d11 - d01 * d01;
    const v = (d11 * d20 - d01 * d21) / d, w = (d00 * d21 - d01 * d20) / d, weights = [1 - v - w, v, w], facet = faceNormals[faceId];
    const n = [0, 1, 2].map(k => weights.reduce((sum, weight, j) => sum + weight * normals[welded[f[j]] * 3 + k], 0)), length = Math.hypot(...n);
    return Number.isFinite(length) && length > 0 && dot(n, facet) > 0 ? n.map(x => x / length) : unit(facet);
  };
  shadingNormals.set(mesh, normalAt);
  return normalAt;
}

/** Cast every detector pixel's ray onto the full source mesh, never the simplified display mesh. A pinhole camera casts only
 * inside the projected mesh bounds; a camera with lens distortion casts the whole detector. Angles use the interpolated surface
 * normal. A pixel's cast shadow is traced toward the Sun the first time a sample asks for it. */
export function castSourceRays(camera: ObservationCamera, mesh: Pick<SourceMesh, 'positions' | 'indices' | 'intersect' | 'faceProvenance' | 'constraintFlags'>, width: number, height: number): PixelGeometry {
  const sun = camera.sunDirection;
  if (![width, height].every(n => Number.isInteger(n) && n >= 2 && n <= 4096) || !sun) throw new Error('Ray-cast geometry needs a detector size and the camera Sun direction.');
  const count = width * height, points = new Float64Array(count * 3), angles = new Float64Array(count * 3), ranges = new Float64Array(count), state = new Uint8Array(count);
  const faces = new Int32Array(count), shade = new Uint8Array(count);
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
  const normalAt = shadingNormal(mesh), eye = camera.positionMeters;
  let geometryPixels = 0, unconstrainedPixels = 0;
  for (let y = bounds[1]; y <= bounds[3]; y++) for (let x = bounds[0]; x <= bounds[2]; x++) {
    const i = y * width + x, direction = camera.ray(x, y), hit = mesh.intersect(eye, direction);
    if (!hit) continue;
    if (!qualifiedFace(mesh, hit.faceId)) { state[i] = 2; unconstrainedPixels++; continue; }
    const point = [0, 1, 2].map(k => eye[k] + direction[k] * hit.radius), normal = normalAt(hit.faceId, point);
    points.set(point, i * 3); faces[i] = hit.faceId;
    angles[i * 3] = angle(dot(normal, sun)); angles[i * 3 + 1] = angle(-dot(normal, direction)); angles[i * 3 + 2] = angle(-dot(sun, direction));
    ranges[i] = hit.radius; state[i] = 1; geometryPixels++;
  }
  return { source: 'source-mesh-rays', report: { source: 'source-mesh-rays', projectedBounds: bounds, geometryPixels, unconstrainedPixels, normals: 'interpolated welded vertex normals' },
    reject: i => state[i] === 1 ? null : state[i] === 2 ? 'unconstrained-source-shape' : 'no-geometry',
    distanceMeters: (i, point) => Math.hypot(points[i * 3] - point[0], points[i * 3 + 1] - point[1], points[i * 3 + 2] - point[2]),
    rangeMeters: i => ranges[i],
    incidence: i => angles[i * 3], emission: i => angles[i * 3 + 1], phase: i => angles[i * 3 + 2],
    shadowed: i => {
      if (state[i] !== 1) return false;
      if (!shade[i]) {
        // Start a centimetre above the hit face, so the ray toward the Sun does not find the face it leaves.
        const f = mesh.indices[faces[i]], lift = unit(cross(sub(mesh.positions[f[1]], mesh.positions[f[0]]), sub(mesh.positions[f[2]], mesh.positions[f[0]])));
        shade[i] = mesh.intersect([0, 1, 2].map(k => points[i * 3 + k] + lift[k] * .01), sun) ? 2 : 1;
      }
      return shade[i] === 2;
    } };
}
