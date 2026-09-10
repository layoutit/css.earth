import type { Cartesian2, Cartesian3, CullingVolume, Ellipsoid, Rectangle } from '@cesium/engine';
/** The unmodified Cesium helper's numeric camera surface. */
export interface ViewRectangleCamera {
  positionWC: Cartesian3;
  directionWC: Cartesian3;
  upWC: Cartesian3;
  frustum: { computeCullingVolume(position: Cartesian3, direction: Cartesian3, up: Cartesian3): CullingVolume };
  _scene: { canvas: { clientWidth: number; clientHeight: number } };
  pickEllipsoid(point: Pick<Cartesian2, 'x' | 'y'>, ellipsoid: Ellipsoid, result?: Cartesian3): Cartesian3 | undefined;
}
export function computeViewRectangle(this: ViewRectangleCamera, ellipsoid?: Ellipsoid, result?: Rectangle): Rectangle | undefined;
