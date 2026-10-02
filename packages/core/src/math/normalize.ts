/** Divide every component by the hypot length, falling back to 1 for zero or NaN.
 * Preserves signed zeros, array length and the historical NaN fallback. */
export function normalizeOrZero(vector: readonly number[]): number[] {
  const length = Math.hypot(...vector) || 1;
  return vector.map(value => value / length);
}

/** Three-component output with the same zero/NaN divisor fallback. */
export function normalize3OrZero(vector: readonly number[]): [number, number, number] {
  const length = Math.hypot(...vector) || 1;
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

/** Non-positive or NaN length gives three positive zeros; otherwise divide. */
export function normalize3OrZeroNonPositive(vector: readonly number[]): [number, number, number] {
  const length = Math.hypot(...vector);
  return length > 0 ? [vector[0] / length, vector[1] / length, vector[2] / length] : [0, 0, 0];
}

/** Refuse zero or NaN length. The caller supplies its existing error dialect. */
export function normalizeOrThrow(vector: readonly number[], failure: () => Error): number[] {
  const length = Math.hypot(...vector);
  if (!(length > 0)) throw failure();
  return vector.map(value => value / length);
}

/** Always divide: a zero length produces NaNs. No validation or fallback. */
export function normalize3Unchecked(vector: readonly number[]): [number, number, number] {
  const length = Math.hypot(...vector);
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}
