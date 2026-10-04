import type { ImageLayerRecipe } from './config.ts';
import type { ShapeLayer, ShapeWalls } from './shape-walls.ts';

type Surface = NonNullable<ImageLayerRecipe['geometry']['surface']>;

/** The most times a sight line may cross the surface: three bodies, one behind another. */
export const SURFACE_MOST_CROSSINGS = 6;
/** Two neighbouring pixels' crossings belong to one body while the middle of the crossing moves by no more than this
 * many pixels of depth between them; a larger move is one part of the surface in front of another. */
export const BODY_STEP_PIXELS = 6;
/** A body smaller than this many pixels is not drawn: its light stays on the flat picture. */
export const BODY_LEAST_PIXELS = 256;
/** Over this many pixels inside a body's outline its two sides are led onto the depth half way between them, and the
 * flat picture keeps the picture's light under them. A sight line that grazes the body crosses it over a depth of tens
 * of pixels a pixel inside the outline and not at all a pixel outside: left alone, the two sides end that far apart;
 * and a side that ends at a hard edge over a dark picture shows as a line. */
export const RIM_JOINS_PIXELS = 4;
/** What the flat picture keeps under the surface is the light around the surface's outline, carried inward: the
 * picture outside the outline as means over squares this many pixels across, each square under the surface the mean
 * of its neighbours, settled over `CARRIED_PASSES` passes. */
export const CARRIED_SQUARE_PIXELS = 8, CARRIED_PASSES = 400;
/** How far past a body's outline, in pixels, each of its sides is carried on as the other side goes, mirrored in the
 * outline: a patch that crosses the outline then stands near the surface on both sides of it, and the two sides'
 * patches meet at the rim. Without it a patch's corners past the outline stand at the rim's own depth, and the patch
 * cuts the corner the surface turns there: the two sides end apart by a good part of the body's depth. */
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
 * `depths` are arcseconds along the sight line from the star's plane, negative toward the Sun, NaN past the last
 * crossing; `lobes` say which end of the pole each crossing is on: 1 the receding end's lobe, 0 the approaching one's. */
export interface SurfaceCrossings { depths: Float32Array; lobes: Uint8Array }

/**
 * A nebula's published surface on the sky (`geometry.surface`): a closed mesh a paper made from spectra, placed where
 * the paper says. The file's own z axis is the nebula's pole, and the star's plane across it parts the surface into
 * two lobes. `pole.tiltDeg` is that pole's angle from the sight line and `pole.paDeg` the position angle its receding
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
  const u = [pole[1]! / across, -pole[0]! / across, 0], v = [-(pole[1]! * u[2]! - pole[2]! * u[1]!), -(pole[2]! * u[0]! - pole[0]! * u[2]!), -(pole[0]! * u[1]! - pole[1]! * u[0]!)];
  const ex = u.map((value, k) => Math.cos(roll) * value + Math.sin(roll) * v[k]!), ey = u.map((value, k) => -Math.sin(roll) * value + Math.cos(roll) * v[k]!), ez = pole.map(value => receding * value);
  // The picture is a small patch of the sky: a pixel's east and north are linear in its column and row.
  const [e0, n0] = sky(0, 0), [e1, n1] = sky(width - 1, 0), [e2, n2] = sky(0, height - 1);
  const ax = (e1 - e0) / (width - 1), ay = (n1 - n0) / (width - 1), bx = (e2 - e0) / (height - 1), by = (n2 - n0) / (height - 1), det = ax * by - ay * bx;
  if (!(Math.abs(det) > 0)) throw new RangeError('The picture\'s columns and rows do not span the sky.');
  const depths = new Float32Array(most * width * height).fill(NaN), lobes = new Uint8Array(most * width * height), px = [0, 0, 0], py = [0, 0, 0], depth = [0, 0, 0], [ox, oy, oz] = surface.originUnits;
  for (let index = 0; index < triangles.length; index += 9) { let along = 0;
    for (let corner = 0; corner < 3; corner++) { const x = triangles[index + 3 * corner]! - ox, y = triangles[index + 3 * corner + 1]! - oy, z = triangles[index + 3 * corner + 2]! - oz; along += z;
      const east = surface.arcsecPerUnit * (x * ex[0]! + y * ey[0]! + z * ez[0]!) - e0, north = surface.arcsecPerUnit * (x * ex[1]! + y * ey[1]! + z * ez[1]!) - n0;
      px[corner] = (east * by - north * bx) / det; py[corner] = (north * ax - east * ay) / det; depth[corner] = surface.arcsecPerUnit * (x * ex[2]! + y * ey[2]! + z * ez[2]!); }
    const area = (px[1]! - px[0]!) * (py[2]! - py[0]!) - (px[2]! - px[0]!) * (py[1]! - py[0]!); if (Math.abs(area) < 1e-12) continue;
    const x0 = Math.max(0, Math.ceil(Math.min(...px))), x1 = Math.min(width - 1, Math.floor(Math.max(...px))), y0 = Math.max(0, Math.ceil(Math.min(...py))), y1 = Math.min(height - 1, Math.floor(Math.max(...py)));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const w1 = ((x - px[0]!) * (py[2]! - py[0]!) - (px[2]! - px[0]!) * (y - py[0]!)) / area, w2 = ((px[1]! - px[0]!) * (y - py[0]!) - (x - px[0]!) * (py[1]! - py[0]!)) / area; if (w1 < 0 || w2 < 0 || w1 + w2 > 1) continue;
      // Kept in order of depth; a crossing past the most a pixel holds is dropped.
      let at = depth[0]! + w1 * (depth[1]! - depth[0]!) + w2 * (depth[2]! - depth[0]!), lobe = receding * along > 0 ? 1 : 0; const first = most * (y * width + x);
      for (let slot = 0; slot < most; slot++) { const held = depths[first + slot]!; if (Number.isNaN(held)) { depths[first + slot] = at; lobes[first + slot] = lobe; break; } if (at < held) { const other = lobes[first + slot]!; depths[first + slot] = at; lobes[first + slot] = lobe; at = held; lobe = other; } } }
  }
  return { depths, lobes };
}

const layerOf = (count: number): ShapeLayer => ({ depth: new Float32Array(count).fill(NaN), tau: new Float32Array(count), hue: new Uint8Array(3 * count) });

/**
 * The picture's light on a published surface (`geometry.surface`): inside the surface's outline each pixel's light
 * leaves the flat picture (`base`) for the surface.
 *
 * A sight line enters and leaves the surface in pairs of crossings (./surface.ts). A body is the pairs of one lobe, at
 * neighbouring pixels, whose middles stand at one depth (`BODY_STEP_PIXELS`), one pair a pixel: one lobe in front of
 * the other is two bodies. Each body has two sides, the one its sight lines enter by and the one they leave by, led
 * onto one another at the body's outline (`RIM_JOINS_PIXELS`).
 *
 * The picture shows the side nearest the Sun, so that side holds the picture. The sides behind it were never
 * photographed: each repeats the picture, sight line by sight line, so the surface is closed and lit from every side.
 * The flat picture keeps three things under the surface: the faint light that surrounds the outline
 * carried inward (`CARRIED_SQUARE_PIXELS`), so no hole stands behind the surface when it is seen from the side; the central star's
 * own light (`starRadiusArcsec`: all of it out to that radius, less and less out to twice that), which is at the star
 * and on no surface; and, over the last pixels inside the outline of the body that shows the picture, that picture's
 * light again, under the body's own. The stack paints the flat picture, then the sides from the farthest to the nearest; the nearest holds what the
 * photograph has left once those behind show through it, so seen from the Sun they are the photograph.
 *
 * `unitsPerArcsec` turns the crossings' depths into the bank's units, in which a face pixel is `facePixelUnits` across;
 * `fromStar` gives a face pixel's distance from the star on the sky, in arcseconds. Returns the sides nearest first, a
 * body's entering side before its leaving side.
 */
export function imageLayerSurfaceWalls(base: Buffer, width: number, height: number, crossings: SurfaceCrossings, unitsPerArcsec: number, facePixelUnits: number, fromStar: (px: number, py: number) => number, starRadiusArcsec = 0): ShapeWalls {
  const count = width * height, most = SURFACE_MOST_CROSSINGS, pairs = most / 2, step = BODY_STEP_PIXELS * facePixelUnits / unitsPerArcsec, { depths, lobes } = crossings;
  const enter = (p: number, pair: number) => depths[most * p + 2 * pair]!, leave = (p: number, pair: number) => depths[most * p + 2 * pair + 1]!, has = (p: number, pair: number) => !Number.isNaN(leave(p, pair));
  const sides = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  // Bodies: pairs of one lobe joined across neighbouring pixels where their middles stand at one depth, one pair a pixel.
  const body = new Int32Array(pairs * count).fill(-1), claimed = new Int32Array(count).fill(-1), sizes: number[] = [], stack: number[] = [];
  for (let start = 0; start < pairs * count; start++) { const p0 = Math.floor(start / pairs), j0 = start % pairs; if (!has(p0, j0) || body[start]! >= 0) continue; const id = sizes.length, lobe = lobes[most * p0 + 2 * j0]!; let size = 0; body[start] = id; claimed[p0] = id; stack.push(start);
    for (let node = stack.pop(); node !== undefined; node = stack.pop()) { size++; const p = Math.floor(node / pairs), j = node % pairs, x = p % width, y = (p - x) / width, middle = (enter(p, j) + leave(p, j)) / 2;
      for (const [dx, dy] of sides) { const nx = x + dx, ny = y + dy, q = ny * width + nx; if (nx < 0 || ny < 0 || nx >= width || ny >= height || claimed[q] === id) continue;
        for (let k = 0; k < pairs; k++) { if (!has(q, k) || body[pairs * q + k]! >= 0 || lobes[most * q + 2 * k] !== lobe || Math.abs((enter(q, k) + leave(q, k)) / 2 - middle) > step) continue; body[pairs * q + k] = id; claimed[q] = id; stack.push(pairs * q + k); break; } } }
    sizes.push(size); }
  const drawn = (p: number, pair: number) => has(p, pair) && sizes[body[pairs * p + pair]!]! >= BODY_LEAST_PIXELS;
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
  // Each body's sides: their depths led together, and their share of the light taken up, over the last pixels inside its outline.
  const made = new Map<number, { enter: ShapeLayer; leave: ShapeLayer; depth: number; size: number }>(), inside = new Float32Array(count), taken = new Float32Array(pairs * count), sharp = new Uint8Array(count); let pixels = 0;
  for (let id = 0; id < sizes.length; id++) { if (sizes[id]! < BODY_LEAST_PIXELS) continue;
    const pairOf = new Int8Array(count).fill(-1); for (let node = 0; node < pairs * count; node++) if (body[node] === id) pairOf[Math.floor(node / pairs)] = node % pairs;
    // How far inside this body's outline each of its pixels is, in pixels.
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const p = y * width + x; inside[p] = pairOf[p]! < 0 ? 0 : Math.min(x && y ? Math.min(inside[p - 1]!, inside[p - width]!) + 1 : 1, RIM_JOINS_PIXELS + 1); }
    for (let y = height - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--) { const p = y * width + x; if (pairOf[p]! >= 0) inside[p] = Math.min(inside[p]!, x < width - 1 && y < height - 1 ? Math.min(inside[p + 1]!, inside[p + width]!) + 1 : 1); }
    const side = { enter: { ...layerOf(count), around: new Float32Array(count).fill(NaN) }, leave: { ...layerOf(count), around: new Float32Array(count).fill(NaN) }, depth: 0, size: 0 }; made.set(id, side);
    for (let p = 0; p < count; p++) { const j = pairOf[p]!; if (j < 0) continue; const t = Math.min(1, (inside[p]! - 1) / RIM_JOINS_PIXELS), open = t * t * (3 - 2 * t), middle = (enter(p, j) + leave(p, j)) / 2, half = (leave(p, j) - enter(p, j)) / 2 * open;
      side.enter.depth[p] = (middle - half) * unitsPerArcsec; side.leave.depth[p] = (middle + half) * unitsPerArcsec; side.depth += middle; side.size++; taken[pairs * p + j] = open; }
    // Past the outline: each pixel's nearest pixel of the body, and the body's pixel as far inside it again.
    const nearest = new Int32Array(count).fill(-1); for (let p = 0; p < count; p++) if (pairOf[p]! >= 0) nearest[p] = p;
    const closer = (p: number, x: number, y: number, dx: number, dy: number) => { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= width || ny >= height) return; const found = nearest[ny * width + nx]!; if (found < 0) return; const held = nearest[p]!;
      if (held < 0 || (found % width - x) ** 2 + (Math.floor(found / width) - y) ** 2 < (held % width - x) ** 2 + (Math.floor(held / width) - y) ** 2) nearest[p] = found; };
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const p = y * width + x; if (pairOf[p]! >= 0) continue; closer(p, x, y, -1, 0); closer(p, x, y, 0, -1); closer(p, x, y, -1, -1); closer(p, x, y, 1, -1); }
    for (let y = height - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--) { const p = y * width + x; if (pairOf[p]! >= 0) continue; closer(p, x, y, 1, 0); closer(p, x, y, 0, 1); closer(p, x, y, 1, 1); closer(p, x, y, -1, 1); }
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const p = y * width + x, q = nearest[p]!; if (pairOf[p]! >= 0 || q < 0) continue; const qx = q % width, qy = (q - qx) / width; if ((qx - x) ** 2 + (qy - y) ** 2 > BEYOND_PIXELS ** 2) continue;
      const mx = 2 * qx - x, my = 2 * qy - y, mirror = mx < 0 || my < 0 || mx >= width || my >= height || pairOf[my * width + mx]! < 0 ? q : my * width + mx;
      side.enter.around[p] = side.leave.depth[mirror]!; side.leave.around[p] = side.enter.depth[mirror]!; }
  }
  // The light, sight line by sight line: the flat picture, then each side from the farthest to the nearest.
  const tauOf = (alpha: number) => -Math.log(1 - alpha), hue = (layer: ShapeLayer, p: number, shown: readonly number[], alpha: number) => { for (let c = 0; c < 3; c++) layer.hue[3 * p + c] = alpha > 0 ? Math.min(255, Math.round(255 * shown[c]! / alpha)) : 0; };
  for (let p = 0; p < count; p++) { if (!base[4 * p + 3]) continue; const lit: number[] = []; for (let j = 0; j < pairs; j++) if (drawn(p, j)) lit.push(j); if (!lit.length) continue;
    // The surface's share of the light there: none at the star. The flat picture keeps the rest, and over the last pixels
    // inside the outline of the body that shows the picture it keeps that light too: a side that ends at a hard edge
    // over a dark picture shows as a line, and the nearest side holds only what the photograph has left over it.
    const from = starRadiusArcsec > 0 ? fromStar(p % width, Math.floor(p / width)) / starRadiusArcsec : Infinity, t = Math.max(0, Math.min(1, 2 - from)), share = 1 - t * t * (3 - 2 * t), under = 1 - share * taken[pairs * p + lit[0]!]!; if (!(share > 0)) continue;
    const whole = tauOf(Math.min(base[4 * p + 3]! / 255, .998)), all = [light(p, 0), light(p, 1), light(p, 2)], faint = all.map((value, c) => Math.min(value, kept(p, c))), faintTau = Math.min(whole, tauOf(Math.min(Math.max(...faint), .998)));
    const own = all.map((value, c) => share * (value - faint[c]!)), keep = all.map((value, c) => faint[c]! + under * (value - faint[c]!)), keepAlpha = Math.min(.998, Math.max(1 - Math.exp(-(faintTau + under * (whole - faintTau))), ...keep)), alpha = Math.min(.998, Math.max(1 - Math.exp(-share * (whole - faintTau)), ...own));
    const below = [...keep];
    for (let at = lit.length - 1; at >= 0; at--) for (const entering of [false, true]) { const side = made.get(body[pairs * p + lit[at]!]!)!, layer = entering ? side.enter : side.leave;
      // The nearest side is opaque enough to hold, in every channel, what the photograph has left once the rest shows
      // through it, and to hide what the rest shows beyond the photograph.
      if (at === 0 && entering) { const nearAlpha = Math.min(.998, Math.max(alpha, ...all.map((value, c) => below[c]! < 1 ? (value - below[c]!) / (1 - below[c]!) : 0), ...all.map((value, c) => below[c]! > value ? 1 - value / below[c]! : 0))), shown = all.map((value, c) => Math.max(0, value - (1 - nearAlpha) * below[c]!)); layer.tau[p] = tauOf(nearAlpha); hue(layer, p, shown, nearAlpha); }
      else { layer.tau[p] = tauOf(alpha); hue(layer, p, own, alpha); for (let c = 0; c < 3; c++) below[c] = own[c]! + (1 - alpha) * below[c]!; } }
    for (let c = 0; c < 3; c++) base[4 * p + c] = keepAlpha > 0 ? Math.min(255, Math.round(255 * keep[c]! / keepAlpha)) : 0;
    base[4 * p + 3] = Math.round(255 * keepAlpha); sharp[p] = 1; pixels++; }
  const bodies = [...made.values()].filter(side => side.size).sort((a, b) => a.depth / a.size - b.depth / b.size);
  return { layers: bodies.flatMap(side => [side.enter, side.leave]), sharp, pixels };
}
