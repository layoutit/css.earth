/** The median of `values`, averaging the middle pair of an even-length sample. Sorts `values` in place; an empty sample
 * gives NaN. */
export function median(values: number[]): number {
  values.sort((a, b) => a - b);
  const middle = values.length >> 1;
  return values.length % 2 ? values[middle]! : (values[middle - 1]! + values[middle]!) / 2;
}
