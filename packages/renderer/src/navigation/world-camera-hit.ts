import type { BodyProjection } from '../solar-system/types.js';

type Bounds = Pick<DOMRect, 'x' | 'y' | 'width' | 'height'>;
export interface PhysicalBodyHit { focalPixels: number; principalOffsetPixels: readonly [number, number]; bodyRadiusUnits: number; }

/** Pick the drawn physical silhouette, independently of the larger drag sphere. */
export function hitsProjectedBody(clientX: number, clientY: number, body: Pick<BodyProjection, 'visible' | 'silhouette' | 'translate'>,
  cameraBounds: Bounds, markerBounds: Bounds | null = null, physical?: PhysicalBodyHit): boolean {
  // A nearby body may cross the eye plane and project an unbounded conic.
  // Its visible surface still has an exact forward-ray test.
  if (body.silhouette === null && physical) {
    const { focalPixels: focal, principalOffsetPixels: offset, bodyRadiusUnits: radius } = physical;
    const ray = [clientX - cameraBounds.x - cameraBounds.width / 2 - offset[0],
      clientY - cameraBounds.y - cameraBounds.height / 2 - offset[1], -focal];
    const center = [body.translate[0] - offset[0], body.translate[1] - offset[1], body.translate[2] - focal];
    const lengthSquared = ray.reduce((sum, value) => sum + value * value, 0);
    const along = ray.reduce((sum, value, axis) => sum + value * center[axis]!, 0);
    const outside = center.reduce((sum, value) => sum + value * value, 0) - radius * radius;
    return focal > 0 && radius > 0 && along > 0 && along * along - lengthSquared * outside >= 0;
  }
  if (!body.visible || body.silhouette === null) return false;
  const ellipse = body.silhouette;
  const x = clientX - cameraBounds.x - cameraBounds.width / 2 - ellipse.centre[0];
  const y = clientY - cameraBounds.y - cameraBounds.height / 2 - ellipse.centre[1];
  const length = Math.hypot(...ellipse.radial);
  const ux = length > 0 ? ellipse.radial[0] / length : 1;
  const uy = length > 0 ? ellipse.radial[1] / length : 0;
  const radial = (x * ux + y * uy) / ellipse.radialSemiAxis;
  const tangential = (-x * uy + y * ux) / ellipse.tangentialSemiAxis;
  if (radial * radial + tangential * tangential <= 1) return true;
  // An unresolved body's actually painted marker remains a valid object hit.
  // Its retained bounds are supplied only while that marker is visible.
  if (markerBounds && markerBounds.width > 0 && markerBounds.height > 0) {
    const mx = (clientX - markerBounds.x - markerBounds.width / 2) / (markerBounds.width / 2);
    const my = (clientY - markerBounds.y - markerBounds.height / 2) / (markerBounds.height / 2);
    return mx * mx + my * my <= 1;
  }
  return false;
}
