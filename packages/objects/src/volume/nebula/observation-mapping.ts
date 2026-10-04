import type { Vector2, Vector3 } from '../emission/coordinates.js';
export interface ObservationMapping {
  distanceUnits: number;
  boundsUnits: { min: Vector2; max: Vector2 };
  tangentAtUv(u: number, v: number): Vector2;
  /** Null outside the full calibrated photo footprint; no edge extension. */
  uvAtTangent(x: number, y: number): Vector2 | null;
  pointAtDepth(x0: number, y0: number, z: number): Vector3;
  tangentAtPoint(x: number, y: number, z: number): Vector2;
  /** ds/dz for physical ray-length integration. */
  rayPathPerDepth(x0: number, y0: number): number;
}
