import type { ImageLayerRecipe } from './config.ts';
import { rad } from './disc.ts';
import { RIM_JOINS_FROM } from './shape.ts';

type Density = NonNullable<ImageLayerRecipe['geometry']['densityGrid']>;

/** How many directions around the star the gas's outline is read in. */
export const OUTLINE_DIRECTIONS = 360;

/** A published density grid's cells (`geometry.densityGrid`): a text file of `cells` cubed rows, "x y z density", the first
 * axis outermost and the third fastest. The cells are returned in the file's order. */
export function densityGrid(text: string, cells: number, name: string): Float32Array {
  const rows = text.split(/\r?\n/u).filter(line => line.trim());
  if (rows.length !== cells ** 3) throw new TypeError(`${name} holds ${rows.length} rows; a grid of ${cells} cells a side (geometry.densityGrid.cells) has ${cells ** 3}.`);
  const grid = new Float32Array(rows.length), place = (row: number) => rows[row]!.trim().split(/\s+/u).map(Number);
  for (let row = 0; row < rows.length; row++) { const value = Number(rows[row]!.trim().split(/\s+/u)[3]); if (!Number.isFinite(value) || value < 0) throw new TypeError(`${name}: row ${row + 1} has no density in its fourth column: ${JSON.stringify(rows[row])}.`); grid[row] = value; }
  const first = place(0), second = place(1), third = place(cells);
  if (!(second[2]! > first[2]! && second[0] === first[0] && second[1] === first[1] && third[1]! > first[1]! && third[0] === first[0])) throw new TypeError(`${name}: its rows do not run with the third axis fastest and the first slowest.`);
  return grid;
}

/**
 * A nebula's published density grid as walls (`geometry.densityGrid`). A paper turned velocity cubes into gas density:
 * under an expansion in which speed grows in proportion to distance from the star, a speed along the sight line is a
 * depth, so each cell of the cube is a place in the nebula. Gas shines as its density squared.
 *
 * One picture holds each sight line's light summed. The grid says where along the sight line that light comes from:
 * the nearer half of the emission and the farther half, each at its own middle. Those two depths are the sight line's
 * walls, and each holds half the smooth light, as a shell's walls do (./shape-walls.ts). Fine detail lies on the
 * nearer one. Over the outer part of the gas's outline (from `RIM_JOINS_FROM` of the way from the star to it) the walls
 * are led onto the picture's plane, where the picture outside the outline lies: a presentation choice. The central
 * star's own light (`starRadiusArcsec`) is at the star, on that plane.
 *
 * The frame is the bake's: x east, y north, z along the sight line away from the Sun, in arcseconds from the star.
 */
export function imageLayerDensityModel(density: Density, grid: Float32Array) {
  const N = density.cells, middle = (N - 1) / 2, cell = density.cellArcsec, toward = density.toward === 'high' ? 1 : -1;
  // Per sight line of the grid: the middle of the nearer half of its emission and of the farther half.
  const nearAt = new Float32Array(N * N).fill(NaN), farAt = new Float32Array(N * N).fill(NaN), emission = new Float32Array(N);
  for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) { let total = 0;
    // Nearest the Sun first: a cell's depth is its place along the first axis, turned away from the Sun.
    for (let step = 0; step < N; step++) { const value = grid[((toward > 0 ? N - 1 - step : step) * N + j) * N + k]!; emission[step] = value * value; total += emission[step]!; }
    if (!(total > 0)) continue;
    let passed = 0, front = 0, back = 0;
    for (let step = 0; step < N; step++) { const depth = (step - middle) * cell, light = emission[step]!, inFront = Math.max(0, Math.min(light, total / 2 - passed)); front += inFront * depth; back += (light - inFront) * depth; passed += light; }
    nearAt[j * N + k] = front / (total / 2); farAt[j * N + k] = back / (total / 2); }
  // The grid's second and third axes on the sky, east and north.
  const second = [Math.sin(rad(density.secondAxisPaDeg)), Math.cos(rad(density.secondAxisPaDeg))] as const, third = [Math.sin(rad(density.thirdAxisPaDeg)), Math.cos(rad(density.thirdAxisPaDeg))] as const, [centreEast, centreNorth] = density.centreArcsec ?? [0, 0];
  const cellOf = (east: number, north: number) => [middle + ((east - centreEast) * second[0] + (north - centreNorth) * second[1]) / cell, middle + ((east - centreEast) * third[0] + (north - centreNorth) * third[1]) / cell] as const;
  // A map between its cells' middles, from those of the four cells around that hold gas; NaN where none does.
  const read = (map: Float32Array, u: number, v: number) => { const j = Math.floor(u), k = Math.floor(v); if (j < 0 || k < 0 || j >= N - 1 || k >= N - 1) return NaN; const a = u - j, b = v - k; let sum = 0, held = 0;
    for (const [dj, dk, weight] of [[0, 0, (1 - a) * (1 - b)], [0, 1, (1 - a) * b], [1, 0, a * (1 - b)], [1, 1, a * b]] as const) { const value = map[(j + dj) * N + k + dk]!; if (weight > 0 && !Number.isNaN(value)) { sum += weight * value; held += weight; } }
    return held > 0 ? sum / held : NaN; };
  // The gas's outline around the star: how far, in cells, the gas reaches in each direction of the grid.
  const [starJ, starK] = cellOf(0, 0), outline = new Float32Array(OUTLINE_DIRECTIONS);
  if (Number.isNaN(read(nearAt, starJ, starK))) throw new RangeError(`geometry.densityGrid: the grid holds no gas on the star's own sight line (cell ${starJ.toFixed(1)}, ${starK.toFixed(1)} of ${N}).`);
  for (let direction = 0; direction < OUTLINE_DIRECTIONS; direction++) { const turn = 2 * Math.PI * direction / OUTLINE_DIRECTIONS; let reached = 0; while (!Number.isNaN(read(nearAt, starJ + (reached + .5) * Math.cos(turn), starK + (reached + .5) * Math.sin(turn)))) reached += .5; outline[direction] = reached; }
  let reach = 0; for (let at = 0; at < N * N; at++) if (!Number.isNaN(nearAt[at]!)) reach = Math.max(reach, Math.abs(nearAt[at]!), Math.abs(farAt[at]!));
  /** The walls a sight line's light lies on, near and far; null outside the gas's outline. */
  const walls = (east: number, north: number, _mix?: readonly [number, number, number]): { near: number; far: number } | null => {
    const [u, v] = cellOf(east, north), near = read(nearAt, u, v), far = read(farAt, u, v); if (Number.isNaN(near) || Number.isNaN(far)) return null;
    const from = Math.hypot(u - starJ, v - starK), turn = (Math.atan2(v - starK, u - starJ) / (2 * Math.PI) + 1) % 1 * OUTLINE_DIRECTIONS, below = Math.floor(turn) % OUTLINE_DIRECTIONS, edge = outline[below]! + (outline[(below + 1) % OUTLINE_DIRECTIONS]! - outline[below]!) * (turn - Math.floor(turn));
    const r = Math.max(0, Math.min(1, ((edge > 0 ? from / edge : 1) - RIM_JOINS_FROM) / (1 - RIM_JOINS_FROM))), flat = 1 - r * r * (3 - 2 * r);
    return { near: near * flat, far: far * flat };
  };
  /** Whether the walls need a place between them: a star's own light is at the star. */
  const between = density.starRadiusArcsec !== undefined;
  /** Where a sight line's fine detail lies, between its walls `near` and `far`: on the near wall, but for the star's own
   * light, which is on the picture's plane (all of it out to the star's radius, less and less out to twice that). */
  const detail = (east: number, north: number, near: number, far: number): { near: number; far: number; mid: number; at: number; walls: number; lifted?: { near: number; far: number } } => {
    const from = density.starRadiusArcsec ? Math.hypot(east, north) / density.starRadiusArcsec : Infinity, t = Math.max(0, Math.min(1, 2 - from)), star = t * t * (3 - 2 * t);
    return { near: 1 - star, far: 0, mid: star, at: Math.max(near, Math.min(far, 0)), walls: 1 };
  };
  return { shape: { smoothPixels: density.smoothPixels } as { smoothPixels: number; speeds?: { depth?: 'speed' } }, walls, reach, between, detail };
}
