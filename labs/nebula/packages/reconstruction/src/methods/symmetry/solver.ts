/** Independent implementation of Wenger, Lorenz & Magnor (2013), equations 1–7.
 * Fits relative emission, NOT gas mass density. No rendering or source-specific rules.
 */
export interface InferenceGrid { width: number; height: number; depth: number; }
export interface SymmetryPrior {
  /** Axis in image coordinates: x right, y down, z toward the observer. */
  axis: readonly [number, number, number];
  center: readonly [number, number, number];
  binWidth: number;
}
export interface SymmetryGroups { offsets: Uint32Array; indices: Uint32Array; }
export interface IterationReport { iteration: number; relativeChange: number; relativeProjectionError: number; }

function gridSize(grid: InferenceGrid) {
  const dims = [grid.width, grid.height, grid.depth];
  if (dims.some(n => !Number.isInteger(n) || n < 2) || dims.reduce((a, b) => a * b, 1) > 4_000_000)
    throw new TypeError('Inference grid must contain 2–4,000,000 voxels with each dimension at least two.');
  return grid.width * grid.height * grid.depth;
}

/** Disjoint cylindrical bins: axial position and radius, as in paper section 6. */
export function createSymmetryGroups(grid: InferenceGrid, prior: SymmetryPrior): SymmetryGroups {
  const size = gridSize(grid), norm = Math.hypot(...prior.axis);
  if (![...prior.axis, ...prior.center, prior.binWidth].every(Number.isFinite) || norm < 1e-10 || prior.binWidth <= 0)
    throw new TypeError('Finite axis, center and positive symmetry bin width required.');
  const [ax, ay, az] = prior.axis.map(v => v / norm) as [number, number, number];
  const groups = new Map<string, number[]>();
  for (let z = 0; z < grid.depth; z++) for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) {
    const dx = x - prior.center[0], dy = y - prior.center[1], dz = z - prior.center[2];
    const axial = dx * ax + dy * ay + dz * az;
    const radius = Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - axial * axial));
    const key = `${Math.round(axial / prior.binWidth)},${Math.round(radius / prior.binWidth)}`;
    const index = (z * grid.height + y) * grid.width + x;
    const group = groups.get(key);
    if (group) group.push(index); else groups.set(key, [index]);
  }
  const offsets = new Uint32Array(groups.size + 1), indices = new Uint32Array(size);
  let offset = 0, groupIndex = 0;
  for (const group of groups.values()) { offsets[groupIndex++] = offset; indices.set(group, offset); offset += group.length; }
  offsets[groupIndex] = offset;
  return { offsets, indices };
}

/** Positive L-infinity proximal operator; deterministic water filling replaces quickselect. */
export function positiveGroupProx(values: Float32Array, budget: number): void {
  if (!Number.isFinite(budget) || budget < 0) throw new TypeError('Nonnegative finite proximal budget required.');
  let total = 0;
  for (let i = 0; i < values.length; i++) { values[i] = Math.max(0, values[i]!); total += values[i]!; }
  if (budget === 0) return;
  if (total <= budget) { values.fill(0); return; }
  const sorted = values.slice().sort().reverse();
  let sum = 0, threshold = 0;
  for (let i = 0; i < sorted.length; i++) {
    sum += sorted[i]!;
    threshold = (sum - budget) / (i + 1);
    if (i === sorted.length - 1 || threshold >= sorted[i + 1]!) break;
  }
  for (let i = 0; i < values.length; i++) values[i] = Math.min(values[i]!, threshold);
}

/** Orthographic Earth-facing projection P; P P^T = I. */
export function projectEmission(volume: Float32Array, grid: InferenceGrid): Float32Array {
  if (volume.length !== gridSize(grid)) throw new TypeError('Volume length differs from grid.');
  const pixels = grid.width * grid.height, image = new Float32Array(pixels), gain = 1 / Math.sqrt(grid.depth);
  for (let i = 0; i < volume.length; i++) image[i % pixels]! += volume[i]! * gain;
  return image;
}

export function inferEmission(options: {
  grid: InferenceGrid; image: Float32Array; prior: SymmetryPrior; tau: number; iterations: number;
  onIteration?: (report: IterationReport) => void;
}): { volume: Float32Array; report: IterationReport } {
  const { grid, image, tau, iterations } = options, size = gridSize(grid), pixels = grid.width * grid.height;
  if (image.length !== pixels || image.some(v => !Number.isFinite(v) || v < 0) || !image.some(v => v > 0))
    throw new TypeError('A nonempty finite nonnegative input image matching the grid is required.');
  if (!Number.isFinite(tau) || tau < 0 || !Number.isInteger(iterations) || iterations < 1 || iterations > 1000)
    throw new TypeError('Finite nonnegative tau and 1–1000 iterations required.');
  const groups = createSymmetryGroups(grid, options.prior);
  let previous = new Float32Array(size), current = new Float32Array(size);
  const accelerated = new Float32Array(size), projection = new Float64Array(pixels);
  const lengths = groups.offsets.slice(1).map((end, i) => end - groups.offsets[i]!);
  let maxLength = 0; for (const length of lengths) maxLength = Math.max(maxLength, length);
  const workspace = new Float32Array(maxLength), inverseRoot = 1 / Math.sqrt(grid.depth);
  const imageNormSquared = image.reduce((sum, value) => sum + value * value, 0);
  let t = 1, report: IterationReport = { iteration: 0, relativeChange: 1, relativeProjectionError: 1 };
  for (let iteration = 1; iteration <= iterations; iteration++) {
    projection.fill(0);
    for (let i = 0; i < size; i++) projection[i % pixels]! += accelerated[i]! * inverseRoot;
    for (let i = 0; i < size; i++) current[i] = accelerated[i]! + (image[i % pixels]! - projection[i % pixels]!) * inverseRoot;
    for (let group = 0; group < lengths.length; group++) {
      const start = groups.offsets[group]!, length = lengths[group]!, values = workspace.subarray(0, length);
      for (let j = 0; j < length; j++) values[j] = current[groups.indices[start + j]!]!;
      positiveGroupProx(values, tau * length);
      for (let j = 0; j < length; j++) current[groups.indices[start + j]!] = values[j]!;
    }
    const nextT = (1 + Math.sqrt(1 + 4 * t * t)) / 2, momentum = (t - 1) / nextT;
    let delta = 0, norm = 0;
    projection.fill(0);
    for (let i = 0; i < size; i++) {
      const value = current[i]!, difference = value - previous[i]!;
      accelerated[i] = value + momentum * difference;
      delta += difference * difference; norm += value * value;
      projection[i % pixels]! += value * inverseRoot;
    }
    let error = 0;
    for (let i = 0; i < pixels; i++) error += (projection[i]! - image[i]!) ** 2;
    report = { iteration, relativeChange: Math.sqrt(delta / Math.max(norm, 1e-30)),
      relativeProjectionError: Math.sqrt(error / imageNormSquared) };
    options.onIteration?.(report);
    [previous, current] = [current, previous]; t = nextT;
  }
  return { volume: previous, report };
}
