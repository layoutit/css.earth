/**
 * Galaxy groups in a catalogue point bank: where a group's members are placed, and which of them a level keeps.
 * `packages/bake/cli/prepare-catalogue-points.mts` (`table.groupDistance`) and `merge-catalogue-points.mts`
 * (`densityCap.groupsFirst`) call these.
 */

/** Members of each group of two or more at the group's distance, `distance(group)` in the points' unit: each on its own
 * sight line, moved along it by the sky-plane offset (from the members' mean direction, along the axis east of it) of the
 * member half the group away in the order given, so the group is as deep as it is wide. The points are replaced in place;
 * a point without a group, or whose group has one member or no distance, keeps its own place. Returns how many moved. */
export function placeGroupMembers(points: number[][], groups: readonly string[], distance: (group: string) => number | null,
  round = (value: number) => Math.round(value * 1e4) / 1e4): number {
  if (groups.length !== points.length) throw new TypeError(`placeGroupMembers: ${groups.length} groups for ${points.length} points.`);
  const members = new Map<string, number[]>();
  groups.forEach((group, index) => { if (group) members.set(group, [...members.get(group) ?? [], index]); });
  let placed = 0;
  for (const [group, indices] of members) {
    const at = distance(group);
    if (indices.length < 2 || at === null) continue;
    if (!(at > 0)) throw new TypeError(`placeGroupMembers: group ${group} has distance ${at}; a group's distance is positive.`);
    const units = indices.map(index => { const point = points[index]!, length = Math.hypot(...point.slice(0, 3)); return point.slice(0, 3).map(value => value / length); });
    const mean = [0, 1, 2].map(axis => units.reduce((sum, unit) => sum + unit[axis]!, 0)), meanLength = Math.hypot(...mean);
    const centre = mean.map(value => value / meanLength);
    // East of the mean direction: the celestial pole crossed with it (the x axis where the group sits at a pole).
    const pole = Math.abs(centre[2]!) > 0.999999 ? [1, 0, 0] : [0, 0, 1];
    const eastRaw = [pole[1]! * centre[2]! - pole[2]! * centre[1]!, pole[2]! * centre[0]! - pole[0]! * centre[2]!, pole[0]! * centre[1]! - pole[1]! * centre[0]!];
    const eastLength = Math.hypot(...eastRaw), east = eastRaw.map(value => value / eastLength);
    const offsets = units.map(unit => at * unit.reduce((sum, value, axis) => sum + value * east[axis]!, 0));
    indices.forEach((index, member) => {
      const depth = offsets[(member + Math.floor(indices.length / 2)) % indices.length]!;
      points[index] = [...units[member]!.map(value => round(value * (at + depth))), ...points[index]!.slice(3)];
    });
    placed += indices.length;
  }
  return placed;
}

export interface ShellPoint { readonly reference: readonly number[]; readonly group?: string }
/** A level's shell selection: in `order`, the points kept under each shell's room, `room(shell)` dots for shell
 * `floor(distance / width)`. With `groupsFirst`, members of groups of two or more (among these points) take the room first,
 * the richest group first and ties in `order`; a group of `wholeGroupsOf` or more is kept whole, room or not; then the
 * rest, in `order`, fill `background` times the room again. Returns the kept points in `order`. */
export function selectByShell<T extends ShellPoint>(order: readonly T[], width: number, room: (shell: number) => number,
  groupsFirst?: { readonly background: number; readonly wholeGroupsOf?: number }): T[] {
  const shellOf = (point: T) => Math.floor(Math.hypot(...point.reference) / width);
  const left = new Map<number, [groups: number, all: number]>();
  const roomOf = (shell: number) => {
    let entry = left.get(shell);
    if (!entry) { const total = room(shell); entry = [total, total * (1 + (groupsFirst?.background ?? 0))]; left.set(shell, entry); }
    return entry;
  };
  const size = new Map<string, number>();
  for (const point of order) if (point.group) size.set(point.group, (size.get(point.group) ?? 0) + 1);
  const taken = new Set<T>();
  if (groupsFirst) {
    const members = order.map((point, index) => ({ point, index })).filter(({ point }) => point.group !== undefined && size.get(point.group)! > 1)
      .sort((a, b) => size.get(b.point.group!)! - size.get(a.point.group!)! || a.index - b.index);
    for (const { point } of members) {
      const shellRoom = roomOf(shellOf(point));
      if (groupsFirst.wholeGroupsOf === undefined || size.get(point.group!)! < groupsFirst.wholeGroupsOf) {
        if (shellRoom[0] < 1) continue;
        shellRoom[0]--; shellRoom[1]--;
      }
      taken.add(point);
    }
  }
  return order.filter(point => {
    if (taken.has(point)) return true;
    const shellRoom = roomOf(shellOf(point));
    if (shellRoom[1] < 1) return false;
    shellRoom[1]--;
    return true;
  });
}
