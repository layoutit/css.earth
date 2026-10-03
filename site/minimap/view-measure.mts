import type { PositionM } from '@cssearth/engine';
import type { WorldRotation } from '@cssearth/core';
import type { SurfaceAxes, MapViewport } from './surface-map-context.mts';
import { rotateWorldPosition } from '@cssearth/engine';
import { dotN as dot } from '@cssearth/core';
import { viewScale } from './view-format.mts';

const referenceAxes: SurfaceAxes = { prime: [1, 0, 0], east: [0, 1, 0], north: [0, 0, 1] };

/** Forward intersection with the unit sphere. The stable quadratic root is adapted from
 * CesiumJS IntersectionTests.rayEllipsoid (Apache-2.0, Copyright CesiumJS Contributors;
 * ../vendor/cesium-LICENSE.md). Only sphere arithmetic is needed for the readout.
 * https://github.com/CesiumGS/cesium/blob/1.145/packages/engine/Source/Core/IntersectionTests.js
 */
export function pickUnitSphere(eye: PositionM, direction: PositionM): PositionM | null {
  const length = Math.sqrt(dot(direction, direction));
  if (!(length > 0)) return null;
  const ray: PositionM = [direction[0] / length, direction[1] / length, direction[2] / length];
  const radiusSquared = dot(eye, eye), along = dot(eye, ray);
  let distance = 0;
  if (radiusSquared > 1) {
    if (along >= 0) return null;
    const outside = radiusSquared - 1, raySquared = dot(ray, ray);
    const discriminant = along * along - raySquared * outside;
    if (discriminant < 0) return null;
    distance = discriminant === 0 ? Math.sqrt(outside / raySquared)
      : outside / (-along + Math.sqrt(discriminant));
  } else if (radiusSquared === 1 && along >= 0) return null;
  return [eye[0] + ray[0] * distance, eye[1] + ray[1] * distance, eye[2] + ray[2] * distance];
}

export function measureView({ eyeM, radiusM, rotation, view, focalPixels, axes, mapLeftEdgeLongitudeDeg = 0 }: { eyeM: PositionM; radiusM: number; rotation: WorldRotation; view: MapViewport; focalPixels: number; axes?: SurfaceAxes; mapLeftEdgeLongitudeDeg?: number }) {
  const basis = axes ?? referenceAxes;
  const toMap = (v: PositionM): PositionM => [dot(v, basis.prime), dot(v, basis.east), dot(v, basis.north)];
  const eye = toMap([eyeM[0] / radiusM, eyeM[1] / radiusM, eyeM[2] / radiusM]);
  const pick = (x: number) => {
    const direction = toMap(rotateWorldPosition(rotation, [view.left + (view.right - view.left) * x, (view.top + view.bottom) / 2, -1]));
    const point = pickUnitSphere(eye, direction);
    // At interstellar distances a subpixel globe may be below float precision.
    return point && Math.abs(Math.hypot(...point) - 1) < 1e-5 ? point : null;
  };
  const center = pick(.5);
  const width = (view.right - view.left) * focalPixels;
  const a = pick(.5 - .5 / width), b = pick(.5 + .5 / width);
  let metersPerPixel, scaleTitle;
  if (a && b) {
    const cross = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    metersPerPixel = Math.atan2(Math.hypot(...cross), a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) * radiusM;
    scaleTitle = 'Approximate surface scale at the center of the view';
  } else {
    const forward = rotateWorldPosition(rotation, [0, 0, -1]);
    metersPerPixel = -dot(eyeM, forward) / focalPixels;
    scaleTitle = 'Scale at the distance of the selected object';
  }
  return {
    altitudeM: Math.max(0, Math.hypot(...eyeM) - radiusM),
    coordinates: center && axes ? {
      latitude: Math.asin(Math.max(-1, Math.min(1, center[2] / Math.hypot(center[0], center[1], center[2])))) * 180 / Math.PI,
      // The axes count longitude from the map's left edge, as the feature labels do.
      longitude: ((Math.atan2(center[1], center[0]) * 180 / Math.PI + mapLeftEdgeLongitudeDeg) % 360 + 540) % 360 - 180,
    } : null,
    scale: viewScale(metersPerPixel), scaleTitle,
  };
}
