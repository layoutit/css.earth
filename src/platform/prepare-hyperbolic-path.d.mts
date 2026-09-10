type Vector3 = readonly [number, number, number];
export interface HyperbolicPathInput {
  semiMajorAxisUnits: number;
  eccentricity: number;
  trueAnomalyRad: number;
  unitsPerAu: number;
  heliocentricDistanceAu: number;
  focus: Vector3;
  perihelionDirection: Vector3;
  perihelionMotion: Vector3;
  segments?: number;
  localRefinementHalvings?: number;
}
export interface PreparedHyperbolicPath {
  readonly closed: false;
  readonly bodyVertexIndex: number;
  readonly bodyHyperbolicAnomalyRad: number;
  readonly displayExtentAu: number;
  readonly displayExtentModel: "finite-heliocentric-radius-window-including-epoch";
  readonly semiMinorAxisUnits: number;
  readonly center: Vector3;
  readonly majorAxis: Vector3;
  readonly minorAxis: Vector3;
  readonly vertices: readonly Vector3[];
  readonly trail: readonly number[];
  readonly chordBehindTurns: readonly number[];
  readonly trailSpans: null;
  readonly trailModel: "finite-open-trajectory-constant-weight";
}
export function prepareHyperbolicPath(input: HyperbolicPathInput): PreparedHyperbolicPath;
