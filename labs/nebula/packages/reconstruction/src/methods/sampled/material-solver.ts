/** Bounded RGB fitting on an immutable positive, depth-aware transmission operator. */
export interface MaterialColumn { indices: Uint32Array; values: Float32Array }
type Rgb = [number, number, number];
interface Options { iterations: number; regularization: number }
const unit = (value: number) => Number.isFinite(value) && value >= 0 && value <= 1;

function validate(columns: MaterialColumn[], target: Float32Array, fixed: Float32Array, covered: Uint8Array,
  initial: readonly Rgb[], options: Options): number {
  if (!(target instanceof Float32Array) || !(fixed instanceof Float32Array) || !(covered instanceof Uint8Array) ||
    !target.length || target.length % 3 !== 0 || target.length !== covered.length * 3 || target.length !== fixed.length ||
    covered.length > 1_048_576 || !target.every(unit) || !fixed.every(unit) || !covered.every(n => n === 0 || n === 1))
    throw new TypeError('Material solver requires finite unit RGB rasters and binary coverage of matching shape.');
  if (!options || !Number.isInteger(options.iterations) || options.iterations < 1 || options.iterations > 2000 ||
    !Number.isFinite(options.regularization) || options.regularization < 0 || options.regularization > 1e6)
    throw new TypeError('Material solver requires bounded iterations and nonnegative regularization.');
  if (!Array.isArray(columns) || columns.length > 8192 || !Array.isArray(initial) || initial.length !== columns.length ||
    initial.some(rgb => !Array.isArray(rgb) || rgb.length !== 3 || !rgb.every(unit)))
    throw new TypeError('Material solver requires one unit RGB initial color per bounded column.');
  let entries = 0;
  for (const column of columns) {
    if (!column || !(column.indices instanceof Uint32Array) || !(column.values instanceof Float32Array) ||
      column.indices.length !== column.values.length || (entries += column.indices.length) > 32_000_000 ||
      !column.values.every(value => unit(value) && value > 0) || !column.indices.every(index => index < covered.length))
      throw new TypeError('Invalid bounded positive material operator column.');
    if (new Set(column.indices).size !== column.indices.length) throw new TypeError('Material operator columns cannot repeat a pixel index.');
  }
  if (!covered.some((value, index) => value === 1 && index % 7 === 0) ||
    !covered.some((value, index) => value === 1 && index % 7 !== 0))
    throw new TypeError('Material solver requires both observed training and validation pixels.');
  return covered.length;
}

/**
 * Geometry, opacity and column memberships are inputs, never optimization variables.
 * Rank-deficient columns cannot identify unique component colors; a pull to the initial
 * colors and simultaneous deterministic updates preserve that ambiguity without noise.
 */
export function fitMaterialColors(columns: MaterialColumn[], target: Float32Array, fixed: Float32Array,
  covered: Uint8Array, initial: readonly Rgb[], options: Options, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const count = validate(columns, target, fixed, covered, initial, options);
  const rowSum = new Float64Array(count), prediction = new Float64Array(target.length);
  const colors = initial.map(rgb => [...rgb] as Rgb);
  for (const column of columns) for (let j = 0; j < column.indices.length; j++) rowSum[column.indices[j]!] += column.values[j]!;
  const scales = columns.map(column => {
    let bound = 0, norm = 0;
    for (let j = 0; j < column.indices.length; j++) {
      const pixel = column.indices[j]!, value = column.values[j]!;
      if (!covered[pixel] || pixel % 7 === 0) continue;
      bound += value * rowSum[pixel]!; norm += value * value;
    }
    const penalty = options.regularization * norm;
    return { step: bound + penalty > 0 ? 1 / (bound + penalty) : 0, penalty };
  });
  const project = () => {
    prediction.set(fixed);
    columns.forEach((column, i) => {
      for (let j = 0; j < column.indices.length; j++) {
        const at = column.indices[j]! * 3, weight = column.values[j]!;
        for (let c = 0; c < 3; c++) prediction[at + c] += weight * colors[i]![c]!;
      }
    });
  };
  const rmse = (validation: boolean) => {
    let sum = 0, pixels = 0;
    for (let pixel = 0; pixel < count; pixel++) if (covered[pixel] && (pixel % 7 === 0) === validation) {
      pixels++;
      for (let c = 0; c < 3; c++) sum += (prediction[pixel * 3 + c]! - target[pixel * 3 + c]!) ** 2;
    }
    return Math.sqrt(sum / (3 * pixels));
  };
  project();
  const beforeRmse = rmse(false), validationBeforeRmse = rmse(true);
  for (let iteration = 0; iteration < options.iterations; iteration++) {
    signal?.throwIfAborted();
    // Every gradient reads this same complete prediction: never update one component
    // and expose its new value to another component in the same iteration.
    columns.forEach((column, i) => {
      const { step, penalty } = scales[i]!; if (step === 0) return;
      const gradient: Rgb = [0, 0, 0];
      for (let j = 0; j < column.indices.length; j++) {
        const pixel = column.indices[j]!; if (!covered[pixel] || pixel % 7 === 0) continue;
        const value = column.values[j]!;
        for (let c = 0; c < 3; c++) gradient[c] += value * (prediction[pixel * 3 + c]! - target[pixel * 3 + c]!);
      }
      for (let c = 0; c < 3; c++) colors[i]![c] = Math.max(0, Math.min(1,
        colors[i]![c]! - step * (gradient[c]! + penalty * (colors[i]![c]! - initial[i]![c]!))));
    });
    project();
  }
  return { colors, beforeRmse, afterRmse: rmse(false), validationBeforeRmse, validationAfterRmse: rmse(true) };
}
