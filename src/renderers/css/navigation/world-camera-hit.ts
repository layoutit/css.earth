import type { BodyProjection } from '../solar-system/heliocentric-view.js';

type Bounds = Pick<DOMRect, 'x' | 'y' | 'width' | 'height'>;

/** Pick the drawn physical silhouette, independently of the larger drag sphere. */
export function hitsProjectedBody(clientX: number, clientY: number, body: BodyProjection,
  cameraBounds: Bounds, markerBounds: Bounds | null = null): boolean {
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
