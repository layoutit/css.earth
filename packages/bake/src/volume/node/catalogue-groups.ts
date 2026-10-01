/**
 * Galaxy groups in a catalogue point bank: where a group's members are placed, and which of them a level keeps.
 * `packages/bake/cli/prepare-catalogue-points.mts` (`table.groupDistance`) and `merge-catalogue-points.mts`
 * (`densityCap.groupsFirst`) call these.
 */
import { gunzipSync } from 'node:zlib';

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
 * `floor(distance / width)`. With `skyBands`, a shell's room is split evenly over equal-area cells of the sky (the points'
 * own frame: `skyBands` bands equal in the sine of the latitude, each cut into twice as many cells in longitude), so a
 * direction a catalogue covers densely cannot take the room of one it covers thinly. With `groupsFirst`, members of groups
 * of two or more (among these points) take the room first, the richest group first and ties in `order`; a group of
 * `wholeGroupsOf` or more is kept whole, room or not; then the rest, in `order`, fill `background` times the room again.
 * Returns the kept points in `order`. */
export function selectByShell<T extends ShellPoint>(order: readonly T[], width: number, room: (shell: number) => number,
  groupsFirst?: { readonly background: number; readonly wholeGroupsOf?: number }, skyBands?: number): T[] {
  if (skyBands !== undefined && !(Number.isSafeInteger(skyBands) && skyBands >= 1)) throw new TypeError(`selectByShell: skyBands must be a whole number from 1, got ${skyBands}.`);
  const cells = skyBands === undefined ? 1 : 2 * skyBands * skyBands;
  const skyCell = (reference: readonly number[]) => {
    if (skyBands === undefined) return 0;
    const [x, y, z] = reference as [number, number, number], length = Math.hypot(x, y, z) || 1;
    const band = Math.min(skyBands - 1, Math.floor((z / length + 1) / 2 * skyBands));
    const longitude = (Math.atan2(y, x) / (2 * Math.PI) + 1) % 1;
    return band * 2 * skyBands + Math.min(2 * skyBands - 1, Math.floor(longitude * 2 * skyBands));
  };
  const shellOf = (point: T) => Math.floor(Math.hypot(...point.reference) / width) * cells + skyCell(point.reference);
  const left = new Map<number, [groups: number, all: number]>();
  const roomOf = (shell: number) => {
    let entry = left.get(shell);
    if (!entry) { const total = room(Math.floor(shell / cells)) / cells; entry = [total, total * (1 + (groupsFirst?.background ?? 0))]; left.set(shell, entry); }
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

/** Rows a paper measures one by one, at that distance on their own sight line whatever their column, redshift or group says:
 * a galaxy whose Cepheids Hubble measured is where they put it, not at its group's average (NGC 4536 was drawn 17 Mpc from
 * its Cepheids, by its redshift, 2026-10-01). `file` is a CSV, gzipped or not, of `name,distance` with distance moduli; `perPc` turns parsecs into the
 * points' unit. A listed row the table does not hold is a mistake in the list. Returns how many rows moved. */
export function placeMeasuredRows(points: number[][], names: readonly string[], file: Uint8Array | string, path: string, perPc: number,
  round = (value: number) => Math.round(value * 1e4) / 1e4): number {
  // The tracked list is gzipped, as the tables are (a bare .csv under source/ is a download, and ignored).
  const csv = typeof file === 'string' ? file : (path.endsWith('.gz') ? gunzipSync(file) : Buffer.from(file)).toString('utf8');
  const [header, ...lines] = csv.trim().split('\n');
  if (header !== 'name,distance') throw new TypeError(`${path}: the header is name,distance, not "${header}".`);
  const wanted = new Map(lines.map(line => {
    const [name, modulus] = line.split(','), value = Number(modulus);
    if (!name || !modulus || !Number.isFinite(value)) throw new TypeError(`${path}: "${line}" is not a name and a distance modulus.`);
    return [name, 10 ** (value / 5 + 1) * perPc] as const;
  }));
  let placed = 0;
  for (const [index, name] of names.entries()) {
    const distance = wanted.get(name);
    if (distance === undefined) continue;
    const point = points[index]!, length = Math.hypot(point[0]!, point[1]!, point[2]!);
    for (const axis of [0, 1, 2]) point[axis] = round(point[axis]! / length * distance);
    wanted.delete(name); placed++;
  }
  if (wanted.size) throw new TypeError(`${path}: ${[...wanted.keys()].join(', ')} ${wanted.size === 1 ? 'is' : 'are'} not among the table's rows.`);
  return placed;
}
