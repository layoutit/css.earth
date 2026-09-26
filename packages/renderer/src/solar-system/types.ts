/** Numeric coordinates retain their source precision; preparation validates dimensions. */
export type Vector2 = readonly number[];
export type Vector3 = readonly number[];
export type Matrix3 = readonly number[];
export type Matrix4 = readonly number[];
export interface VisibleRect { left: number; top: number; right: number; bottom: number; }
export interface Matrix3dLike { m11:number;m12:number;m13:number;m21:number;m22:number;m23:number;m31:number;m32:number;m33:number; }
export interface SilhouetteEllipse { radialSemiAxis: number; tangentialSemiAxis: number; radial: Vector2; centre: Vector2; }
export interface BodyProjection { distance: number; depth: number; visible: boolean; screen: Vector2 | null; offAxisDegrees: number;
  silhouetteRadius: number; silhouetteDiameter: number; silhouette: SilhouetteEllipse | null; orthographicRadius: number; translate: Vector3; }
/** A projected line: start x, start y, end x, end y in centre-relative pixels, then its trail weight. */
export type OrbitSegment = readonly number[];
