/** The median of `values`, averaging the middle pair of an even-length sample. Sorts `values` in place; an empty sample
 * gives NaN. */
export function medianAveraged(values: number[]): number {
  values.sort((a, b) => a - b);
  const middle = values.length >> 1;
  return values.length % 2 ? values[middle]! : (values[middle - 1]! + values[middle]!) / 2;
}

/** Copy, sort and choose the upper middle. An empty sample is refused. */
export function medianUpperMiddle(values: readonly number[]): number {
  if (!values.length) throw new TypeError('Cannot take the upper-middle median of an empty sample.');
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[sorted.length >> 1]!;
}
