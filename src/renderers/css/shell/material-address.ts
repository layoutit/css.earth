/** Fixed atlas corner convention shared by preparation and retained material selection. */
export const SHELL_CORNER_PERMUTATIONS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]] as const;

export function nearestFacingIndex(facing: number, levels: readonly number[]): number {
  let low = 0, high = levels.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >>> 1;
    if (facing < levels[middle]!) high = middle; else low = middle;
  }
  return facing - levels[low]! <= levels[high]! - facing ? low : high;
}

/** Packed frame*6+cornerOrder; selection allocates no per-face arrays or objects. */
export function shellMaterialAddress(a: number, b: number, c: number, count: number): number {
  const order = a <= b ? b <= c ? 0 : a <= c ? 1 : 4 : a <= c ? 2 : b <= c ? 3 : 5;
  const lo = Math.min(a, b, c), hi = Math.max(a, b, c), mid = a + b + c - lo - hi;
  const total = count * (count + 1) * (count + 2) / 6, remaining = count - lo;
  const frame = total - remaining * (remaining + 1) * (remaining + 2) / 6 +
    (mid - lo) * (2 * count - lo - mid + 1) / 2 + hi - mid;
  return frame * 6 + order;
}
