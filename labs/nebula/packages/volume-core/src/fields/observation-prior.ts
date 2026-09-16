import type {ObservationMapping} from '../contracts/observation-mapping.ts';
type Vec3=[number,number,number];
type Vec2=[number,number];
export interface ObservationPriorSource {bounds:{min:Vec3;max:Vec3};densityAt(x:number,y:number,z:number):number}
export interface ObservationPrior {
  density: Float32Array;
  dimensions: Vec3;
  /** These are tangent-X, tangent-Y and physical-Z coordinates; caller's local unit must be kpc. */
  boundsKpc: { min: Vec3; max: Vec3 };
  diagnostics: { sampledCells: number; nonzeroCells: number; sourceDepthRetained: boolean; meaning: string };
}
/** A coarse ray-coordinate prior, not a crop or mutation of the source volume. */
export function reprojectObservationPrior(source: ObservationPriorSource, mapping: ObservationMapping, options: {
  dimensions: Vec3; boundsUnits?: { min: Vec2; max: Vec2 };
}): ObservationPrior {
  const dimensions = [...options.dimensions] as Vec3, [nx, ny, nz] = dimensions;
  if (dimensions.length !== 3 || dimensions.some(value => !Number.isInteger(value) || value < 1) || nx * ny * nz > 8_388_608) {
    throw new TypeError('Observation prior requires at most 8,388,608 positive integer cells.');
  }
  const rectangle = options.boundsUnits ?? mapping.boundsUnits;
  if (rectangle.min.length !== 2 || rectangle.max.length !== 2 || rectangle.min.some((value, i) =>
    !Number.isFinite(value) || !Number.isFinite(rectangle.max[i]) || value >= rectangle.max[i])) throw new TypeError('Observation bounds must be finite increasing intervals.');
  const boundsKpc = { min: [...rectangle.min, source.bounds.min[2]] as Vec3,
    max: [...rectangle.max, source.bounds.max[2]] as Vec3 };
  if (boundsKpc.min[2] <= -mapping.distanceUnits) throw new TypeError('Density extends behind the observation origin.');
  const density = new Float32Array(nx * ny * nz);
  let nonzeroCells = 0;
  for (let z = 0; z < nz; z++) {
    const pz = boundsKpc.min[2] + (z + .5) / nz * (boundsKpc.max[2] - boundsKpc.min[2]);
    const factor = 1 + pz / mapping.distanceUnits;
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const px = rectangle.min[0] + (x + .5) / nx * (rectangle.max[0] - rectangle.min[0]);
      const py = rectangle.min[1] + (y + .5) / ny * (rectangle.max[1] - rectangle.min[1]);
      const value = source.densityAt(px * factor, py * factor, pz);
      density[(z * ny + y) * nx + x] = value;
      if (value > 0) nonzeroCells++;
    }
  }
  return { density, dimensions, boundsKpc, diagnostics: { sampledCells: density.length, nonzeroCells,
    sourceDepthRetained: true,
    meaning: 'Trilinearly filtered encoded stellar support decoded after filtering, sampled on calibrated observer rays. Relative clipped/quantized density prior; no luminosities, dust, or measured star depths.' } };
}
