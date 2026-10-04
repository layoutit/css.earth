import type { ImageLayerRecipe } from './config.ts';
import type { ShapeLayer, ShapeWalls } from './shape-walls.ts';

type Surface = NonNullable<ImageLayerRecipe['geometry']['surface']>;

/** The most times a sight line may cross the surface: three parts, one behind another. */
export const SURFACE_MOST_CROSSINGS = 6;
/** Two neighbouring pixels' crossings belong to one side while the crossing, or the middle between it and the next
 * crossing before or behind it, moves by no more than this many pixels of depth between them; a larger move is one
 * part of the surface in front of another. Where a side turns away from the Sun it is steep, and the middle is not. */
export const SIDE_STEP_PIXELS = 6;
/** A side smaller than this many pixels is not drawn: the other sides and the flat picture hold its light. */
export const SIDE_LEAST_PIXELS = 256;
/** Where the surface folds, a side that faces the Sun meets one that faces away. Over this many pixels inside the
 * fold the two are led onto the depth half way between them and their light fades out. A sight line that grazes the
 * surface crosses it over a depth of tens of pixels a pixel inside the fold and not at all a pixel outside: left alone,
 * the two sides end that far apart; and a side that ends at a hard edge over a dark picture shows as a line. */
export const RIM_JOINS_PIXELS = 4;
/** What the flat picture keeps under the surface is the light around the surface's outline, carried inward: the
 * picture outside the outline as means over squares this many pixels across, each square under the surface the mean
 * of its neighbours, settled over `CARRIED_PASSES` passes. */
export const CARRIED_SQUARE_PIXELS = 8, CARRIED_PASSES = 400;
/** How far past a fold, in pixels, each of its two sides is carried on as the other side goes, mirrored in the fold: a
 * patch that crosses the fold then stands near the surface on both sides of it, and the two sides' patches meet
 * there. Without it a patch's corners past the fold stand at the fold's own depth, and the patch cuts the corner the
 * surface turns there: the two sides end apart by a good part of the surface's depth. */
export const BEYOND_PIXELS = 64;

/** The triangles of a binary STL file, nine numbers each: three corners, x, y and z. */
export function stlTriangles(bytes: Buffer, name: string): Float32Array {
  if (bytes.length < 84) throw new TypeError(`${name} is not a binary STL file: ${bytes.length} bytes hold no header and triangle count.`);
  const count = bytes.readUInt32LE(80);
  if (bytes.length !== 84 + 50 * count) throw new TypeError(`${name} is not a binary STL file: its header counts ${count} triangles, ${84 + 50 * count} bytes, and the file holds ${bytes.length}.`);
  const triangles = new Float32Array(9 * count);
  for (let index = 0; index < count; index++) for (let value = 0; value < 9; value++) { const read = bytes.readFloatLE(84 + 50 * index + 12 + 4 * value); if (!Number.isFinite(read)) throw new TypeError(`${name}: triangle ${index} has a corner that is not a number.`); triangles[9 * index + value] = read; }
  return triangles;
}

/** Where each face pixel's sight line crosses a surface, nearest the Sun first: up to `SURFACE_MOST_CROSSINGS` a pixel.
 * `depths` are arcseconds along the sight line from the star's plane of the sky, negative toward the Sun, NaN past
 * the last crossing; `lobes` say which side of the plane through the star across the pole each crossing is on: 1 the
 * receding end's lobe, 0 the approaching one's. */
export interface SurfaceCrossings { depths: Float32Array; lobes: Uint8Array }

/**
 * A nebula's published surface on the sky (`geometry.surface`): a closed mesh a paper made from spectra, placed where
 * the paper says. The file's own z axis is the nebula's pole, and the plane through the star across it parts the
 * surface into two lobes. `pole.tiltDeg` is that pole's angle from the sight line and `pole.paDeg` the position angle its receding
 * end points to; `pole.rollDeg` turns the file about the pole, and `pole.receding` says which end of the file's z axis
 * recedes. `originUnits` is the star in the file's units and `arcsecPerUnit` the file's unit on the sky.
 *
 * `sky` gives a face pixel's offset from the star, east and north in arcseconds.
 */
export function imageLayerSurfaceCrossings(surface: Surface, triangles: Float32Array, width: number, height: number, sky: (px: number, py: number) => readonly [number, number]): SurfaceCrossings {
  const rad = Math.PI / 180, tilt = surface.pole.tiltDeg * rad, pa = surface.pole.paDeg * rad, roll = surface.pole.rollDeg * rad, most = SURFACE_MOST_CROSSINGS, receding = surface.pole.receding === '+z' ? 1 : -1;
  // The receding pole on the sky: east, north, away from the Sun; two axes across it, turned by the roll.
  const pole = [Math.sin(tilt) * Math.sin(pa), Math.sin(tilt) * Math.cos(pa), Math.cos(tilt)], across = Math.hypot(pole[0]!, pole[1]!);
  if (across < 1e-9) throw new RangeError('geometry.surface.pole.tiltDeg: a pole along the sight line has no position angle to turn about.');
  if (pole[2]! < 1e-9) throw new RangeError('geometry.surface.pole.tiltDeg: a pole across the sight line has no receding end.');
  const u = [pole[1]! / across, -pole[0]! / across, 0], v = [-(pole[1]! * u[2]! - pole[2]! * u[1]!), -(pole[2]! * u[0]! - pole[0]! * u[2]!), -(pole[0]! * u[1]! - pole[1]! * u[0]!)];
  const ex = u.map((value, k) => Math.cos(roll) * value + Math.sin(roll) * v[k]!), ey = u.map((value, k) => -Math.sin(roll) * value + Math.cos(roll) * v[k]!), ez = pole.map(value => receding * value);
  // The picture is a small patch of the sky: a pixel's east and north are linear in its column and row.
  const [e0, n0] = sky(0, 0), [e1, n1] = sky(width - 1, 0), [e2, n2] = sky(0, height - 1);
  const ax = (e1 - e0) / (width - 1), ay = (n1 - n0) / (width - 1), bx = (e2 - e0) / (height - 1), by = (n2 - n0) / (height - 1), det = ax * by - ay * bx;
  if (!(Math.abs(det) > 0)) throw new RangeError('The picture\'s columns and rows do not span the sky.');
  const depths = new Float32Array(most * width * height).fill(NaN), lobes = new Uint8Array(most * width * height), px = [0, 0, 0], py = [0, 0, 0], depth = [0, 0, 0], [ox, oy, oz] = surface.originUnits;
  // The plane through the star across the pole, on a pixel's sight line.
  const across0 = (x: number, y: number) => -((e0 + ax * x + bx * y) * pole[0]! + (n0 + ay * x + by * y) * pole[1]!) / pole[2]!;
  for (let index = 0; index < triangles.length; index += 9) {
    for (let corner = 0; corner < 3; corner++) { const x = triangles[index + 3 * corner]! - ox, y = triangles[index + 3 * corner + 1]! - oy, z = triangles[index + 3 * corner + 2]! - oz;
      const east = surface.arcsecPerUnit * (x * ex[0]! + y * ey[0]! + z * ez[0]!) - e0, north = surface.arcsecPerUnit * (x * ex[1]! + y * ey[1]! + z * ez[1]!) - n0;
      px[corner] = (east * by - north * bx) / det; py[corner] = (north * ax - east * ay) / det; depth[corner] = surface.arcsecPerUnit * (x * ex[2]! + y * ey[2]! + z * ez[2]!); }
    const area = (px[1]! - px[0]!) * (py[2]! - py[0]!) - (px[2]! - px[0]!) * (py[1]! - py[0]!); if (Math.abs(area) < 1e-12) continue;
    const x0 = Math.max(0, Math.ceil(Math.min(...px))), x1 = Math.min(width - 1, Math.floor(Math.max(...px))), y0 = Math.max(0, Math.ceil(Math.min(...py))), y1 = Math.min(height - 1, Math.floor(Math.max(...py)));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const w1 = ((x - px[0]!) * (py[2]! - py[0]!) - (px[2]! - px[0]!) * (y - py[0]!)) / area, w2 = ((px[1]! - px[0]!) * (y - py[0]!) - (x - px[0]!) * (py[1]! - py[0]!)) / area; if (w1 < 0 || w2 < 0 || w1 + w2 > 1) continue;
      // Kept in order of depth; a crossing past the most a pixel holds is dropped.
      let at = depth[0]! + w1 * (depth[1]! - depth[0]!) + w2 * (depth[2]! - depth[0]!), lobe = at > across0(x, y) ? 1 : 0; const first = most * (y * width + x);
      for (let slot = 0; slot < most; slot++) { const held = depths[first + slot]!; if (Number.isNaN(held)) { depths[first + slot] = at; lobes[first + slot] = lobe; break; } if (at < held) { const other = lobes[first + slot]!; depths[first + slot] = at; lobes[first + slot] = lobe; at = held; lobe = other; } } }
  }
  return { depths, lobes };
}

const layerOf = (count: number): ShapeLayer => ({ depth: new Float32Array(count).fill(NaN), tau: new Float32Array(count), hue: new Uint8Array(3 * count) });

/**
 * The picture's light on a published surface (`geometry.surface`): inside the surface's outline each pixel's light
 * leaves the flat picture (`base`) for the surface.
 *
 * A sight line enters and leaves the surface by turns (./surface.ts). A side is the crossings of one lobe that all
 * enter, or all leave, at neighbouring pixels and one depth (`SIDE_STEP_PIXELS`), one crossing a pixel: a lobe has a
 * side that faces the Sun and one that faces away. Where the surface folds two sides meet, and there they are led onto
 * one another (`RIM_JOINS_PIXELS`); where a side ends at the plane between the lobes, the other lobe's side goes on from it.
 *
 * The picture shows the side nearest the Sun. The sides behind it were never photographed: each repeats the picture,
 * sight line by sight line, so the surface is closed and lit from every side. The flat picture keeps three things
 * under the surface: the light that surrounds the outline carried inward (`CARRIED_SQUARE_PIXELS`), so no hole stands
 * behind the surface when it is seen from the side; the central star's own light (`starRadiusArcsec`: all of it out
 * to that radius, less and less out to twice that), which is at the star and on no surface; and, where every side
 * there is at a fold, the picture's light itself. The stack paints the flat picture, then the sides from the farthest
 * to the nearest. Each holds what the photograph has left once those painted before it show through it, and none
 * shows more than the photograph: seen from the Sun they are the photograph.
 *
 * `unitsPerArcsec` turns the crossings' depths into the bank's units, in which a face pixel is `facePixelUnits` across;
 * `fromStar` gives a face pixel's distance from the star on the sky, in arcseconds. Returns the sides nearest first.
 */
export function imageLayerSurfaceWalls(base: Buffer, width: number, height: number, crossings: SurfaceCrossings, unitsPerArcsec: number, facePixelUnits: number, fromStar: (px: number, py: number) => number, starRadiusArcsec = 0): ShapeWalls {
  const count = width * height, most = SURFACE_MOST_CROSSINGS, step = SIDE_STEP_PIXELS * facePixelUnits / unitsPerArcsec, { depths, lobes } = crossings;
  const has = (p: number, slot: number) => !Number.isNaN(depths[most * p + slot]!), sides = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  // A crossing's kind: its lobe, and whether it enters or leaves. Its depth, or the middle between it and a neighbour in depth.
  const kind = (node: number) => 2 * lobes[node]! + (node % most & 1), middle = (node: number, to: number) => { const slot = node % most + to; return slot < 0 || slot >= most ? NaN : (depths[node]! + depths[node + to]!) / 2; };
  const nearestOf = (q: number, like: number, depth: number) => { let best = -1, least = Infinity;
    for (let node = most * q + (like & 1); node < most * (q + 1) && !Number.isNaN(depths[node]!); node += 2) { const off = Math.abs(depths[node]! - depth); if (lobes[node] === like >> 1 && off < least) { least = off; best = node; } }
    return best; };
  // Sides: crossings of one kind joined across neighbouring pixels, each the other's nearest of that kind, at one depth.
  const side = new Int32Array(most * count).fill(-1), holds = new Int32Array(count).fill(-1), sizes: number[] = [], stack: number[] = [];
  for (let start = 0; start < most * count; start++) { if (Number.isNaN(depths[start]!) || side[start]! >= 0) continue; const id = sizes.length, like = kind(start); let size = 0; side[start] = id; holds[Math.floor(start / most)] = id; stack.push(start);
    for (let node = stack.pop(); node !== undefined; node = stack.pop()) { const p = Math.floor(node / most), x = p % width, y = (p - x) / width; size++;
      for (const [dx, dy] of sides) { const nx = x + dx, ny = y + dy, q = ny * width + nx; if (nx < 0 || ny < 0 || nx >= width || ny >= height || holds[q] === id) continue;
        const found = nearestOf(q, like, depths[node]!); if (found < 0 || side[found]! >= 0 || nearestOf(p, like, depths[found]!) !== node || ![0, -1, 1].some(to => Math.abs(middle(node, to) - middle(found, to)) <= step)) continue;
        side[found] = id; holds[q] = id; stack.push(found); } }
    sizes.push(size); }
  // The picture's light, and the light around the surface's outline carried in under it.
  const light = (p: number, c: number) => base[4 * p + c]! / 255 * Math.min(base[4 * p + 3]! / 255, .998), square = CARRIED_SQUARE_PIXELS, columns = Math.ceil(width / square), rows = Math.ceil(height / square);
  const carried = [0, 1, 2].map(c => { const held = new Float32Array(columns * rows), known = new Uint8Array(columns * rows);
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) { let sum = 0, seen = 0;
      for (let y = row * square; y < Math.min(height, (row + 1) * square); y++) for (let x = column * square; x < Math.min(width, (column + 1) * square); x++) if (!has(y * width + x, 0)) { sum += light(y * width + x, c); seen++; }
      if (seen) { held[row * columns + column] = sum / seen; known[row * columns + column] = 1; } }
    for (let pass = 0; pass < CARRIED_PASSES; pass++) for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) { const at = row * columns + column; if (known[at]) continue; let sum = 0, around = 0;
      for (const [dx, dy] of sides) { const nx = column + dx, ny = row + dy; if (nx < 0 || ny < 0 || nx >= columns || ny >= rows) continue; sum += held[ny * columns + nx]!; around++; }
      held[at] = sum / around; }
    return held; });
  // What a pixel of the flat picture may keep: the carried light there, read between the squares' middles.
  const kept = (p: number, c: number) => { const x = p % width, y = (p - x) / width, u = Math.max(0, Math.min(columns - 1, (x + .5) / square - .5)), v = Math.max(0, Math.min(rows - 1, (y + .5) / square - .5)), i = Math.min(columns - 2, Math.floor(u)), j = Math.min(rows - 2, Math.floor(v)), a = u - i, b = v - j, field = carried[c]!;
    return (1 - b) * ((1 - a) * field[j * columns + i]! + a * field[j * columns + i + 1]!) + b * ((1 - a) * field[(j + 1) * columns + i]! + a * field[(j + 1) * columns + i + 1]!); };
  // Each drawn side: the slot it holds at each pixel, and how far inside its own outline each of its pixels is.
  const made = new Map<number, { layer: ShapeLayer & { around: Float32Array }; slot: Int8Array; inside: Uint8Array; open: Float32Array; folds: Int32Array; depth: number; size: number; rank: number }>(), sharp = new Uint8Array(count); let pixels = 0;
  for (let id = 0; id < sizes.length; id++) if (sizes[id]! >= SIDE_LEAST_PIXELS) made.set(id, { layer: { ...layerOf(count), around: new Float32Array(count).fill(NaN) }, slot: new Int8Array(count).fill(-1), inside: new Uint8Array(count), open: new Float32Array(count).fill(1), folds: new Int32Array(count).fill(-1), depth: 0, size: 0, rank: 0 });
  for (let node = 0; node < most * count; node++) { const one = made.get(side[node]!); if (!one) continue; one.slot[Math.floor(node / most)] = node % most; one.depth += depths[node]!; one.size++; }
  for (const { slot, inside } of made.values()) {
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const p = y * width + x; inside[p] = slot[p]! < 0 ? 0 : Math.min(x && y ? Math.min(inside[p - 1]!, inside[p - width]!) + 1 : 1, RIM_JOINS_PIXELS + 1); }
    for (let y = height - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--) { const p = y * width + x; if (slot[p]! >= 0) inside[p] = Math.min(inside[p]!, x < width - 1 && y < height - 1 ? Math.min(inside[p + 1]!, inside[p + width]!) + 1 : 1); } }
  // Folds: a side near its outline, and the side next to it in depth near its own, are led onto the depth between them.
  for (const one of made.values()) for (let p = 0; p < count; p++) { const slot = one.slot[p]!; if (slot < 0) continue; const node = most * p + slot; let depth = depths[node]!;
    if (one.inside[p]! <= RIM_JOINS_PIXELS) { let gap = Infinity;
      for (const to of [-1, 1]) { if (slot + to < 0 || slot + to >= most || Number.isNaN(depths[node + to]!)) continue; const other = made.get(side[node + to]!); if (!other || other.inside[p]! > RIM_JOINS_PIXELS || Math.abs(depths[node + to]! - depths[node]!) >= gap) continue;
        const t = (Math.max(one.inside[p]!, other.inside[p]!) - 1) / RIM_JOINS_PIXELS, open = t * t * (3 - 2 * t), between = (depths[node]! + depths[node + to]!) / 2; gap = Math.abs(depths[node + to]! - depths[node]!); depth = between + (depths[node]! - between) * open; one.open[p] = open; one.folds[p] = side[node + to]!; } }
    one.layer.depth[p] = one.layer.around[p] = depth * unitsPerArcsec; }
  // Past its outline a side goes on as the side it folds onto, mirrored in the outline: each pixel's nearest pixel of the
  // side, and the pixel as far inside it again. Where it does not fold there, it goes on as the crossing that continues
  // it: the one that enters, or leaves, as it does, at the nearest depth.
  for (const one of made.values()) { const nearest = new Int32Array(count).fill(-1); for (let p = 0; p < count; p++) if (one.slot[p]! >= 0) nearest[p] = p;
    const closer = (p: number, x: number, y: number, dx: number, dy: number) => { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= width || ny >= height) return; const found = nearest[ny * width + nx]!; if (found < 0) return; const held = nearest[p]!;
      if (held < 0 || (found % width - x) ** 2 + (Math.floor(found / width) - y) ** 2 < (held % width - x) ** 2 + (Math.floor(held / width) - y) ** 2) nearest[p] = found; };
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const p = y * width + x; if (one.slot[p]! >= 0) continue; closer(p, x, y, -1, 0); closer(p, x, y, 0, -1); closer(p, x, y, -1, -1); closer(p, x, y, 1, -1); }
    for (let y = height - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--) { const p = y * width + x; if (one.slot[p]! >= 0) continue; closer(p, x, y, 1, 0); closer(p, x, y, 0, 1); closer(p, x, y, 1, 1); closer(p, x, y, -1, 1); }
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const p = y * width + x, q = nearest[p]!; if (one.slot[p]! >= 0 || q < 0) continue; const qx = q % width, qy = (q - qx) / width; if ((qx - x) ** 2 + (qy - y) ** 2 > BEYOND_PIXELS ** 2) continue;
      const other = made.get(one.folds[q]!), mx = 2 * qx - x, my = 2 * qy - y, mirror = !other || mx < 0 || my < 0 || mx >= width || my >= height || other.slot[my * width + mx]! < 0 ? q : my * width + mx;
      if (other) { one.layer.around[p] = other.layer.depth[mirror]!; continue; }
      let on = -1, least = Infinity; for (let node = most * p + (one.slot[q]! & 1); node < most * (p + 1) && !Number.isNaN(depths[node]!); node += 2) { const off = Math.abs(depths[node]! - depths[most * q + one.slot[q]!]!); if (off < least) { least = off; on = node; } }
      one.layer.around[p] = on < 0 ? one.layer.depth[q]! : made.get(side[on]!)?.layer.depth[p] ?? depths[on]! * unitsPerArcsec; } }
  // The order the stack paints the sides in is the reverse of this one: nearest first, by where each side stands on the whole.
  const ordered = [...made.values()].filter(one => one.size).sort((a, b) => a.depth / a.size - b.depth / b.size); for (const [rank, one] of ordered.entries()) one.rank = rank;
  // The light, sight line by sight line: the flat picture, then each side there in the order the stack paints them.
  const tauOf = (alpha: number) => -Math.log(1 - alpha), lit: { layer: ShapeLayer; open: number; rank: number }[] = [];
  for (let p = 0; p < count; p++) { if (!base[4 * p + 3]) continue; lit.length = 0;
    for (let slot = 0; slot < most && has(p, slot); slot++) { const one = made.get(side[most * p + slot]!); if (one) lit.push({ layer: one.layer, open: one.open[p]!, rank: one.rank }); }
    if (!lit.length) continue; lit.sort((a, b) => b.rank - a.rank);
    // The surface's share of the light there: none at the star, and none where every side is at a fold. The flat picture keeps the rest.
    const from = starRadiusArcsec > 0 ? fromStar(p % width, Math.floor(p / width)) / starRadiusArcsec : Infinity, t = Math.max(0, Math.min(1, 2 - from)), share = 1 - t * t * (3 - 2 * t), under = 1 - share * Math.max(...lit.map(one => one.open)); if (!(share > 0)) continue;
    const whole = tauOf(Math.min(base[4 * p + 3]! / 255, .998)), all = [light(p, 0), light(p, 1), light(p, 2)], faint = all.map((value, c) => Math.min(value, kept(p, c))), faintTau = Math.min(whole, tauOf(Math.min(Math.max(...faint), .998)));
    const keep = all.map((value, c) => faint[c]! + under * (value - faint[c]!)), keepAlpha = Math.min(.998, Math.max(1 - Math.exp(-(faintTau + under * (whole - faintTau))), ...keep)), below = [...keep];
    // Each side is opaque enough to hold, in every channel, what the photograph has left once those painted before it
    // show through it, and holds no more than that: what is under a side never outshines the photograph.
    for (const { layer, open } of lit) { const needed = Math.max(0, ...all.map((value, c) => below[c]! < 1 ? (value - below[c]!) / (1 - below[c]!) : 0)), alpha = Math.min(.998, Math.max(1 - Math.exp(-open * share * (whole - faintTau)), open * needed)); if (!(alpha > 0)) continue;
      layer.tau[p] = tauOf(alpha);
      for (let c = 0; c < 3; c++) { const shown = Math.min(alpha, Math.max(0, all[c]! - (1 - alpha) * below[c]!)); layer.hue[3 * p + c] = Math.min(255, Math.round(255 * shown / alpha)); below[c] = shown + (1 - alpha) * below[c]!; } }
    for (let c = 0; c < 3; c++) base[4 * p + c] = keepAlpha > 0 ? Math.min(255, Math.round(255 * keep[c]! / keepAlpha)) : 0;
    base[4 * p + 3] = Math.round(255 * keepAlpha); sharp[p] = 1; pixels++; }
  return { layers: ordered.map(one => one.layer), sharp, pixels };
}
