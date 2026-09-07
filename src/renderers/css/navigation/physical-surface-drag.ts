import type { SphereDragInput } from '@cssearth/engine';
import type { TrackballMetrics, Quaternion } from './types.js';
type Surface = NonNullable<TrackballMetrics['surfaceSphere']>;
type Projection = Pick<TrackballMetrics, 'centerX' | 'centerY' | 'opticalCenterX' | 'opticalCenterY' | 'focalLength'>;

/** Pointer rays intersect the same physical reference sphere as the camera. */
export function physicalSurfacePoint(x: number, y: number, projection: Projection, sphere: Surface, clampToHorizon = false): number[] | null {
  const ray = [x - (projection.opticalCenterX ?? projection.centerX),
    y - (projection.opticalCenterY ?? projection.centerY), -projection.focalLength];
  const length = Math.hypot(...ray), direction = ray.map(value => value / length);
  const along = direction.reduce((sum, value, i) => sum + value * sphere.center[i]!, 0);
  const outside = sphere.center.reduce((sum, value) => sum + value * value, 0) - sphere.radius * sphere.radius;
  const discriminant = along * along - outside;
  if (along <= 0 || outside <= 0) return null;
  if (discriminant < 0) {
    if (!clampToHorizon) return null;
    // A captured drag keeps its surface mapping beyond the limb. Project the
    // missed ray onto the tangent circle; this joins the real intersection
    // continuously and preserves movement around the horizon and back in.
    const centerDistance = Math.hypot(...sphere.center);
    const center = sphere.center.map(value => value / centerDistance);
    const tangent = direction.map((value, i) => value - center[i]! * along / centerDistance);
    const tangentLength = Math.hypot(...tangent), ratio = sphere.radius / centerDistance;
    return tangent.map((value, i) => value / tangentLength * Math.sqrt(1 - ratio * ratio) - ratio * center[i]!);
  }
  // Stable near-surface root: avoid subtracting nearly equal distances.
  const distance = outside / (along + Math.sqrt(discriminant));
  return direction.map((value, i) => (value * distance - sphere.center[i]!) / sphere.radius);
}

export function projectPhysicalSurfaceDrag(pointer: SphereDragInput, sphere: Surface): Quaternion {
  const a = physicalSurfacePoint(pointer.previousX, pointer.previousY, pointer, sphere, true);
  const b = physicalSurfacePoint(pointer.currentX, pointer.currentY, pointer, sphere, true);
  if (!a || !b) return [0, 0, 0, 1];
  const q = [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!,
    a[0]! * b[1]! - a[1]! * b[0]!, 1 + a.reduce((sum, value, i) => sum + value * b[i]!, 0)];
  const length = Math.hypot(...q);
  return q.map(value => value / length);
}
