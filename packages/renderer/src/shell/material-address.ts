export function nearestFacingIndex(facing: number, levels: readonly number[]): number {
  let low = 0, high = levels.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >>> 1;
    if (facing < levels[middle]!) high = middle; else low = middle;
  }
  return facing - levels[low]! <= levels[high]! - facing ? low : high;
}
