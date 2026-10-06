/** A body's place on its orbit about its centre, in metres in the world's reference frame: what spatial-context.ts derives
 * and system views frame. */
export type Vector3 = readonly [number, number, number];

export interface OrbitalState {
  readonly positionM: Vector3;
  readonly centerBodyId: string;
  readonly centerPositionM: Vector3;
  readonly normal: Vector3;
  readonly perihelionDirection: Vector3;
  readonly semiMajorAxisM: number;
  readonly eccentricity: number;
  readonly trueAnomalyRadians: number;
}
