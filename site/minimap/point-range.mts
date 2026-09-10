/** Conservative X slab of the view sphere, over a preparation-owned ordering.
 * The caller keeps the exact 3D distance/marker-inset test for these candidates. */
export function minimapPointRange(points: readonly {positionM: readonly number[]}[], order: readonly number[], centerX: number, radius: number) {
  const bound = (value: number, upper: boolean) => {
    let low = 0, high = order.length;
    while (low < high) {
      const middle = low + Math.floor((high - low) / 2);
      const x = points[order[middle]].positionM[0];
      if (x < value || (upper && x === value)) low = middle + 1;
      else high = middle;
    }
    return low;
  };
  return [bound(centerX - radius, false), bound(centerX + radius, true)];
}
