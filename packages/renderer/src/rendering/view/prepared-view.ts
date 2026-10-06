/** The camera's view as a prepared presentation reads it each frame: pose, projection, level of detail and the body on screen. */
export interface PreparedView {
  readonly projection: import('../../prepared-data/physical-projection.js').PhysicalProjection;
  revision?: number; controlPitch: number; controlYaw: number; zoom: number; sceneMatrix: string;
  sunViewDirection: readonly number[] | null; reference?: { sceneMatrix: string; sunViewDirection: readonly number[] | null };
  counterRotation: string; counterRotationFor(systemTransform: string | DOMMatrix | null): string;
  levelOfDetail: { stage: string; silhouetteDiameter: number | null; billboardOpacity: number; markerOpacity: number };
  body: { visible: boolean; screen?: readonly number[] | null; silhouette?: { radial: readonly number[]; centre: readonly number[]; radialSemiAxis: number; tangentialSemiAxis: number } | null };
  /** The camera root's principal point, and the stage's: the root moves to centre the body in the area the shell leaves
   * open, so the two differ by that move. */
  principalOffset: readonly number[];
  stageViewport: { readonly principalOffsetPixels: readonly number[] };
  viewportWidth?: number; viewportHeight?: number;
  /** Every motion animation is paused at its prepared start, where the prepared texture placements hold. */
  motionAtRest?: boolean;
}
