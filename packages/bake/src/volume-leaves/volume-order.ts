import type { Axis, Vector3 } from '../volume/index.ts';

/** Parallel slice planes need no source-depth DOM ordering: the browser still
 * resolves their physical depth. Offer median planes first so its first-pivot
 * BSP builder does not receive a linear chain. Coplanar source order stays exact. */
export function balanceVolumeSlices<T extends { centerUnits: Vector3 }>(leaves: readonly T[], axis: Axis, normal?: readonly number[]): T[] {
  const component = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  const planes = new Map<number, T[]>();
  for (const leaf of leaves) {
    const depth = normal ? leaf.centerUnits.reduce((sum, value, i) => sum + value * normal[i]!, 0) : leaf.centerUnits[component];
    const group = planes.get(depth);
    if (group) group.push(leaf);
    else planes.set(depth, [leaf]);
  }
  const depths = [...planes.keys()].sort((a, b) => a - b);
  const ordered: T[] = [];
  const visit = (start: number, end: number) => {
    if (start >= end) return;
    const middle = Math.floor((start + end) / 2);
    ordered.push(...planes.get(depths[middle]!)!);
    visit(start, middle);
    visit(middle + 1, end);
  };
  visit(0, depths.length);
  return ordered;
}
