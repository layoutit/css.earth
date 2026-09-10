import type { PositionM } from '@cssearth/engine';
import type { WorldRotation } from '../src/renderers/css/navigation/world-camera-math.js';
import type { SurfaceAxes } from './surface-minimap-math.mts';
import type { MapViewport } from './surface-map-context.mts';
import type { Rectangle } from '@cesium/engine';
export interface MinimapCameraState { eye: PositionM; rotation: WorldRotation; view: MapViewport; axes: SurfaceAxes; }
import Cartesian3 from '@cesium/engine/Source/Core/Cartesian3.js';
import Cartesian4 from '@cesium/engine/Source/Core/Cartesian4.js';
import CullingVolume from '@cesium/engine/Source/Core/CullingVolume.js';
import Ellipsoid from '@cesium/engine/Source/Core/Ellipsoid.js';
import IntersectionTests from '@cesium/engine/Source/Core/IntersectionTests.js';
import Ray from '@cesium/engine/Source/Core/Ray.js';
import { rotateWorldPosition } from '../src/renderers/css/dist/navigation.js';
import { wrapMapU } from './surface-minimap-math.mts';
import { computeViewRectangle } from './vendor/cesium-view-rectangle.mjs';

const dot = (a: PositionM, b: PositionM) => a.reduce((sum, x, i) => sum + x * b[i], 0);

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
