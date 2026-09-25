import type { Vector3, DensityVolumeFrame } from '@cssearth/bake/volume';
export type Matrix3 = [number, number, number, number, number, number, number, number, number];
export interface TransformRecipe {
  mwCenterKpc: Vector3;
  simulationToGalactic: Matrix3;
  sunGalactocentricKpc: Vector3;
  galacticToIcrs: Matrix3;
  method: string;
  limitation: string;
}
export interface GridPlan {
  dimensions: Vector3;
  boundsKpc: { min: Vector3; max: Vector3 };
  cellWidthKpc: number;
  paddingCells: number;
  paddingKpc: { min: Vector3; max: Vector3 };
}

const multiply = (a: Matrix3, b: Matrix3): Matrix3 => Array.from({ length: 9 }, (_, index) => {
  const row = Math.floor(index / 3), column = index % 3;
  return a[3 * row]! * b[column]! + a[3 * row + 1]! * b[3 + column]! + a[3 * row + 2]! * b[6 + column]!;
}) as Matrix3;
const vector = (matrix: Matrix3, value: Vector3): Vector3 => [
  matrix[0] * value[0] + matrix[1] * value[1] + matrix[2] * value[2],
  matrix[3] * value[0] + matrix[4] * value[1] + matrix[5] * value[2],
  matrix[6] * value[0] + matrix[7] * value[1] + matrix[8] * value[2],
];
const transpose = (matrix: Matrix3): Matrix3 => [matrix[0], matrix[3], matrix[6], matrix[1], matrix[4],
  matrix[7], matrix[2], matrix[5], matrix[8]];
const add = (a: Vector3, b: Vector3): Vector3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const quaternionMatrix = ([x, y, z, w]: readonly number[]): Matrix3 => [
  1 - 2 * (y! * y! + z! * z!), 2 * (x! * y! - z! * w!), 2 * (x! * z! + y! * w!),
  2 * (x! * y! + z! * w!), 1 - 2 * (x! * x! + z! * z!), 2 * (y! * z! - x! * w!),
  2 * (x! * z! - y! * w!), 2 * (y! * z! + x! * w!), 1 - 2 * (x! * x! + y! * y!),
];
export const close = (a: readonly number[], b: readonly number[], tolerance = 2e-9): boolean =>
  a.length === b.length && a.every((value, index) => Math.abs(value - b[index]!) <= tolerance);

export function deriveCenteredToLocal(transform: TransformRecipe, centering: Vector3,
  frame: DensityVolumeFrame): { matrix: Matrix3; offsetKpc: Vector3 } {
  const referenceToLocal = transpose(quaternionMatrix(frame.localToReferenceXyzw));
  const matrix = multiply(referenceToLocal, multiply(transform.galacticToIcrs, transform.simulationToGalactic));
  const centeredGalactic = vector(transform.simulationToGalactic,
    add(centering, transform.mwCenterKpc.map(value => -value) as Vector3));
  const heliocentric = add(centeredGalactic,
    transform.sunGalactocentricKpc.map(value => -value) as Vector3);
  const referenceKpc = vector(transform.galacticToIcrs, heliocentric);
  const originUnits = frame.originM.map(value => value / frame.metersPerUnit) as Vector3;
  return { matrix, offsetKpc: vector(referenceToLocal,
    add(referenceKpc, originUnits.map(value => -value) as Vector3)) };
}

export function transformParticleBytes(source: Buffer, matrix: Matrix3, offset: Vector3): {
  bytes: Buffer; count: number; mass: number; boundsKpc: { min: Vector3; max: Vector3 };
} {
  if (!source.length || source.length % 16) throw new TypeError('Expected float32 LE XYZ-mass records.');
  const bytes = Buffer.allocUnsafe(source.length), min: Vector3 = [Infinity, Infinity, Infinity];
  const max: Vector3 = [-Infinity, -Infinity, -Infinity];
  let mass = 0;
  for (let record = 0; record < source.length / 16; record++) {
    const at = 16 * record;
    const point: Vector3 = [source.readFloatLE(at), source.readFloatLE(at + 4), source.readFloatLE(at + 8)];
    const weight = source.readFloatLE(at + 12), transformed = add(vector(matrix, point), offset);
    if (![...point, weight, ...transformed].every(Number.isFinite) || weight < 0) {
      throw new TypeError(`Invalid transformed particle ${record}.`);
    }
    for (let axis = 0; axis < 3; axis++) {
      bytes.writeFloatLE(transformed[axis]!, at + 4 * axis);
      const stored = bytes.readFloatLE(at + 4 * axis);
      min[axis] = Math.min(min[axis], stored); max[axis] = Math.max(max[axis], stored);
    }
    bytes.writeFloatLE(weight, at + 12); mass += weight;
  }
  return { bytes, count: source.length / 16, mass, boundsKpc: { min, max } };
}

export function planFullDensityGrid(particleBounds: GridPlan['boundsKpc'], settings: {
  maximumVoxels: number; maximumAxisCells: number; smoothingSigmaVoxels: number; boundaryPaddingSigma: number;
}): GridPlan {
  const span = particleBounds.max.map((value, axis) => value - particleBounds.min[axis]!) as Vector3;
  if (span.some(value => !(value > 0)) || !Number.isInteger(settings.maximumVoxels) ||
      !Number.isInteger(settings.maximumAxisCells) || settings.maximumVoxels < 1 || settings.maximumAxisCells < 16 ||
      !(settings.smoothingSigmaVoxels >= 0) || !(settings.boundaryPaddingSigma >= 4)) {
    throw new TypeError('Invalid full-density grid constraints.');
  }
  const paddingCells = Math.max(Math.ceil(settings.boundaryPaddingSigma * settings.smoothingSigmaVoxels),
    Math.ceil(3 * settings.smoothingSigmaVoxels) + 2);
  const dimensions = (cell: number): Vector3 => span.map(value => Math.ceil(value / cell) + 2 * paddingCells) as Vector3;
  const valid = (value: Vector3) => value.every(cells => cells <= settings.maximumAxisCells) &&
    value.reduce((product, cells) => product * cells, 1) <= settings.maximumVoxels;
  let lo = 0, hi = Math.max(...span);
  for (let step = 0; step < 80; step++) {
    const mid = (lo + hi) / 2;
    if (valid(dimensions(mid))) hi = mid; else lo = mid;
  }
  const cellWidthKpc = hi * (1 + 1e-12), cells = dimensions(cellWidthKpc);
  if (!valid(cells)) throw new TypeError('Unable to satisfy bounded full-density dimensions.');
  const min = particleBounds.min.map(value => value - paddingCells * cellWidthKpc) as Vector3;
  const max = min.map((value, axis) => value + cells[axis]! * cellWidthKpc) as Vector3;
  return { dimensions: cells, boundsKpc: { min, max }, cellWidthKpc, paddingCells,
    paddingKpc: { min: particleBounds.min.map((value, axis) => value - min[axis]!) as Vector3,
      max: particleBounds.max.map((value, axis) => max[axis]! - value) as Vector3 } };
}

export function boundaryDiagnostics(rgba: Uint8Array, dimensions: Vector3): { nonzeroAlpha: number; nonzeroRgb: number } {
  const [width, height, depth] = dimensions;
  let nonzeroAlpha = 0, nonzeroRgb = 0;
  for (let z = 0; z < depth; z++) for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (x !== 0 && x !== width - 1 && y !== 0 && y !== height - 1 && z !== 0 && z !== depth - 1) continue;
    const offset = 4 * ((z * height + y) * width + x);
    if (rgba[offset + 3]) nonzeroAlpha++;
    if (rgba[offset] || rgba[offset + 1] || rgba[offset + 2]) nonzeroRgb++;
  }
  return { nonzeroAlpha, nonzeroRgb };
}
