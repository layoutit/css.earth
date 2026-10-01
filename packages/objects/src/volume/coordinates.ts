export type Vector3 = [number, number, number];
export type Axis = 'x' | 'y' | 'z';
export interface Bounds3 { min: Vector3; max: Vector3; }
export type EmissionVector3 = [number, number, number];
export interface EmissionBounds { min: EmissionVector3; max: EmissionVector3 }
export interface SkyBounds {
  /** [minimum xWest, minimum yNorth], in arcseconds. */
  min: [number, number];
  /** [maximum xWest, maximum yNorth], in arcseconds. Raster row zero is maximum yNorth. */
  max: [number, number];
}
