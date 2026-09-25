/** A pinned density field sampled as a conditional depth prior, in the compiler's angular tangent units. */
import type { EmissionBounds } from './emission.ts';

export interface SimulationDepthPrior {
  /** SHA-256 identity of the pinned source and its sampling transform. */
  identity: string;
  bounds: EmissionBounds;
  /** Same angular/tangent XYZ units as the field. Caller owns any physical ray mapping. */
  sampleDensity(x: number, y: number, z: number): number;
}
