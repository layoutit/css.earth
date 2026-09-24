import type { PositionM } from '@cssearth/engine';
import type { WorldRotation } from '../src/renderers/css/navigation/world-camera-math.js';
import type { SurfaceAxes } from './surface-minimap-math.mts';
import type { MapViewport } from './surface-map-context.mts';
import type { Rectangle } from '@cesium/engine';
import Cartesian3 from '@cesium/engine/Source/Core/Cartesian3.js';
import Cartesian4 from '@cesium/engine/Source/Core/Cartesian4.js';
import CullingVolume from '@cesium/engine/Source/Core/CullingVolume.js';
import Ellipsoid from '@cesium/engine/Source/Core/Ellipsoid.js';
import IntersectionTests from '@cesium/engine/Source/Core/IntersectionTests.js';
import Ray from '@cesium/engine/Source/Core/Ray.js';
import { rotateWorldPosition } from '../src/renderers/css/dist/navigation.js';
import { wrapMapU } from './surface-minimap-math.mts';
import { viewScale } from './view-format.mts';
import { computeViewRectangle } from './vendor/cesium-view-rectangle.mjs';
export interface MinimapCameraState { eye: PositionM; rotation: WorldRotation; view: MapViewport; axes: SurfaceAxes; }

const dot = (a: PositionM, b: PositionM) => a.reduce((sum, x, i) => sum + x * b[i], 0);
const referenceAxes: SurfaceAxes = { prime: [1, 0, 0], east: [0, 1, 0], north: [0, 0, 1] };

// Adapt the existing CSS camera to Cesium's calculation interface. Coordinates
// are in body radii, with map prime/east/north as Cesium X/Y/Z. No scene,
// canvas element, second camera controller or renderer is created here.
export function minimapCamera({ eye, rotation, view, axes }: MinimapCameraState) {
  const toMap = (v: PositionM) => new Cartesian3(dot(v, axes.prime), dot(v, axes.east), dot(v, axes.north));
  const positionWC = toMap(eye);
  const direction = (v: PositionM) => toMap(rotateWorldPosition(rotation, v));
  const normals: PositionM[] = [[1, 0, view.left], [-1, 0, -view.right], [0, 1, view.top], [0, -1, -view.bottom], [0, 0, -1]];
  const planes = normals.map(v => {
      const n = Cartesian3.normalize(direction(v), new Cartesian3());
      return new Cartesian4(n.x, n.y, n.z, -Cartesian3.dot(n, positionWC));
    });
  const volume = new CullingVolume(planes);
  return {
    positionWC,
    directionWC: direction([0, 0, -1]),
    upWC: direction([0, -1, 0]),
    frustum: { computeCullingVolume: () => volume },
    // The upstream routine reads only these viewport dimensions.
    _scene: { canvas: { clientWidth: 1, clientHeight: 1 } },
    pickEllipsoid({ x, y }: { x: number; y: number }, ellipsoid: Ellipsoid, result = new Cartesian3()) {
      const ray = new Ray(positionWC, direction([
        view.left + (view.right - view.left) * x,
        view.top + (view.bottom - view.top) * y, -1,
      ]));
      const interval = IntersectionTests.rayEllipsoid(ray, ellipsoid);
      return interval ? Ray.getPoint(ray, interval.start, result) : undefined;
    },
  };
}

export function rectangleOnMap(rectangle: Rectangle | undefined) {
  if (!rectangle) return null;
  return {
    left: rectangle.width >= Math.PI * 2 ? 0 : wrapMapU(rectangle.west / (Math.PI * 2)),
    top: .5 - rectangle.north / Math.PI,
    width: rectangle.width / (Math.PI * 2),
    height: rectangle.height / Math.PI,
  };
}

export function surfaceViewRectangle(state: MinimapCameraState) {
  const camera = minimapCamera(state);
  const rectangle = computeViewRectangle.call(camera, Ellipsoid.UNIT_SPHERE);
  const picked = rectangle && camera.pickEllipsoid({ x: .5, y: .5 }, Ellipsoid.UNIT_SPHERE);
  const center = picked && Ellipsoid.UNIT_SPHERE.cartesianToCartographic(picked);
  return {
    bounds: rectangleOnMap(rectangle),
    center: center ? { u: wrapMapU(center.longitude / (Math.PI * 2)), v: .5 - center.latitude / Math.PI } : null,
  };
}

export function measureView({ eyeM, radiusM, rotation, view, focalPixels, axes, mapLeftEdgeLongitudeDeg = 0 }: { eyeM: PositionM; radiusM: number; rotation: WorldRotation; view: MapViewport; focalPixels: number; axes?: SurfaceAxes; mapLeftEdgeLongitudeDeg?: number }) {
  const camera = minimapCamera({ eye: [eyeM[0] / radiusM, eyeM[1] / radiusM, eyeM[2] / radiusM], rotation, view, axes: axes ?? referenceAxes });
  const pick = (x: number) => {
    const point = camera.pickEllipsoid({ x, y: .5 }, Ellipsoid.UNIT_SPHERE);
    // At interstellar distances a subpixel globe may be below float precision.
    return point && Math.abs(Math.hypot(point.x, point.y, point.z) - 1) < 1e-5 ? point : null;
  };
  const center = pick(.5);
  const width = (view.right - view.left) * focalPixels;
  const a = pick(.5 - .5 / width), b = pick(.5 + .5 / width);
  let metersPerPixel, scaleTitle;
  if (a && b) {
    const cross = [a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x];
    metersPerPixel = Math.atan2(Math.hypot(...cross), a.x * b.x + a.y * b.y + a.z * b.z) * radiusM;
    scaleTitle = 'Approximate surface scale at the center of the view';
  } else {
    const forward = rotateWorldPosition(rotation, [0, 0, -1]);
    metersPerPixel = -dot(eyeM, forward) / focalPixels;
    scaleTitle = 'Scale at the distance of the selected object';
  }
  return {
    altitudeM: Math.max(0, Math.hypot(...eyeM) - radiusM),
    coordinates: center && axes ? {
      latitude: Math.asin(Math.max(-1, Math.min(1, center.z / Math.hypot(center.x, center.y, center.z)))) * 180 / Math.PI,
      // The axes count longitude from the map's left edge, as the feature labels do.
      longitude: ((Math.atan2(center.y, center.x) * 180 / Math.PI + mapLeftEdgeLongitudeDeg) % 360 + 540) % 360 - 180,
    } : null,
    scale: viewScale(metersPerPixel), scaleTitle,
  };
}
