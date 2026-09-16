type Vec3 = [number, number, number];
type Vec2 = [number, number];
export interface ObservationMapping {
  distanceUnits: number;
  boundsUnits: { min: Vec2; max: Vec2 };
  tangentAtUv(u: number, v: number): Vec2;
  /** Null outside the full calibrated photo footprint; no edge extension. */
  uvAtTangent(x: number, y: number): Vec2 | null;
  pointAtDepth(x0: number, y0: number, z: number): Vec3;
  tangentAtPoint(x: number, y: number, z: number): Vec2;
  /** ds/dz for physical ray-length integration. */
  rayPathPerDepth(x0: number, y0: number): number;
}
