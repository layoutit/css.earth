import { expect, test } from 'vitest';
import { placeGroupMembers, selectByShell } from './catalogue-groups.ts';

test('a group sits at its distance, as deep as it is wide; a lone member or a group without a distance keeps its place', () => {
  // Four members around +x at 10 units, spread along y (east of +x is +y), plus a lone galaxy and a group with no distance.
  const points = [[9, -1, 0, 7], [11, 0.5, 0, 7], [10, 1, 0, 7], [12, -0.5, 0, 7], [5, 5, 0], [3, 0, 3], [3, 0.1, 3]];
  const groups = ['g', 'g', 'g', 'g', 'lone', 'far', 'far'];
  const placed = placeGroupMembers(points, groups, group => group === 'g' ? 20 : null, value => value);
  expect(placed).toBe(4);
  const radial = points.slice(0, 4).map(point => Math.hypot(...point.slice(0, 3)));
  const offsets = [[9, -1, 0], [11, 0.5, 0], [10, 1, 0], [12, -0.5, 0]].map(([x, y]) => 20 * y! / Math.hypot(x!, y!));
  // Each member's depth is the sky offset of the member two along (half of four), its east offset from the mean direction.
  radial.forEach((distance, member) => expect(distance).toBeCloseTo(20 + offsets[(member + 2) % 4]!, 1));
  expect(points.slice(0, 4).every(point => point[3] === 7)).toBe(true);
  expect(points.slice(4)).toEqual([[5, 5, 0], [3, 0, 3], [3, 0.1, 3]]);
});

test('groups take a shell first, the richest first; a large group is whole; the background fills room again', () => {
  const point = (distance: number, group?: string) => ({ reference: [distance, 0, 0], ...(group ? { group } : {}) });
  // One shell (width 10) with room for 3: a rich group of 3, a pair, and field galaxies.
  const order = [point(1), point(2, 'pair'), point(3, 'rich'), point(4), point(5, 'rich'), point(6, 'pair'), point(7, 'rich'), point(8)];
  expect(selectByShell(order, 10, () => 3, { background: 0 }).map(p => p.reference[0])).toEqual([3, 5, 7]);
  expect(selectByShell(order, 10, () => 3, { background: 1 }).map(p => p.reference[0])).toEqual([1, 2, 3, 4, 5, 7]);
  expect(selectByShell(order, 10, () => 1, { background: 0, wholeGroupsOf: 3 }).map(p => p.reference[0])).toEqual([2, 3, 5, 7]);
  // Without groupsFirst the shell keeps its first three in order.
  expect(selectByShell(order, 10, () => 3).map(p => p.reference[0])).toEqual([1, 2, 3]);
});

test('sky bands split each shell\'s room evenly over the sky, so a densely covered direction keeps only its share', () => {
  // One shell with room for 4, split over 2 cells (one band: east and west of the x axis): 6 points east, 1 west.
  const east = Array.from({ length: 6 }, (_, index) => ({ reference: [1, 0.1 * (index + 1), 0] }));
  const west = [{ reference: [1, -0.5, 0] }];
  const kept = selectByShell([...east, ...west], 10, () => 4, undefined, 1);
  expect(kept.filter(point => point.reference[1]! > 0)).toHaveLength(2);
  expect(kept.filter(point => point.reference[1]! < 0)).toHaveLength(1);
  expect(() => selectByShell(east, 10, () => 4, undefined, 0)).toThrow(/skyBands/);
});
