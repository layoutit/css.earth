import type { ShapeLayer, ShapeWalls } from './shape-walls.ts';

/** How many times its fit, along the sight line, a patch may stand from its surface. A steep patch can lie a few pixels
 * from the surface across it and tens of pixels from it in depth; from the side that depth is what shows. */
export const PATCH_FIT_DEPTHS = 4;
/** A square's side in face pixels, at least and at most; both powers of two. */
export const PATCH_LEAST_PIXELS = 32, PATCH_MOST_PIXELS = 128;
/** How far from one plane, in face pixels along the sight line, a square's four corners may stand for the square to be
 * one patch. A square more twisted than that is two triangles, each through three of its corners. */
export const PATCH_FLAT_PIXELS = 1;
/** How far a patch reaches beyond its edges, in face pixels: over twice this a pixel's light passes from one patch to
 * the next, so no edge is a hard line between two layers. Two patches meet along their shared edge, and this near to it
 * they lie on one another. */
export const PATCH_OVERLAP_PIXELS = 2;
/** The most patches one 3D scene holds. A browser sorts the leaves of a scene by depth against one another and cuts
 * every leaf that crosses another's plane: 1,900 leaves in one scene took Chrome 88 ms a frame; in scenes of 24, with
 * no two overlapping leaves in the same scene, 9 to 12 ms (headless, M3 Max, 2026-10-04). */
export const SCENE_MOST_PATCHES = 24;
/** An atlas's side at most, and the clear texels between two patches in it. */
export const ATLAS_PIXELS = 2048, ATLAS_GUTTER_PIXELS = 2;

/** One patch of a surface: a rectangle of the picture on a plane through the surface there. */
export interface ShapePatch {
  /** Its rectangle of the picture, in face pixels from the picture's top-left corner; its texture, `texture[0]` by
   * `texture[1]` texels over that rectangle (a texel is a face pixel unless the surface's layer says otherwise), and
   * the texels. */
  left: number; top: number; width: number; height: number; texture: readonly [number, number]; rgba: Buffer;
  /** Its plane: the depth at the texture's top-left corner, and how much deeper it is a pixel to the right and a pixel down. */
  depth: number; right: number; down: number;
}
/** The surfaces as patches in the order they are painted, farthest surface first, and the sizes of the consecutive
 * runs of patches that share a 3D scene. */
export interface ShapePatches { patches: ShapePatch[]; scenes: number[] }

const smooth = (t: number) => { const u = Math.max(0, Math.min(1, t)); return u * u * (3 - 2 * u); };
/** A place's rank along a curve that keeps neighbours together. */
const morton = (x: number, y: number) => { let rank = 0; for (let bit = 0; bit < 15; bit++) rank += ((x >> bit) & 1) * 4 ** bit + ((y >> bit) & 1) * 2 * 4 ** bit; return rank; };

/** A square of a surface and the depths at its corners: top-left, top-right, bottom-left, bottom-right. */
type Corners = readonly [number, number, number, number];
/** A flat part of a square: the depth at the square's top-left corner, its change a pixel to the right and down, and
 * how far inside each of its edges a place in the square is (pixels from the square's corner; negative outside). */
type Part = { depth: number; right: number; down: number; edges: readonly ((dx: number, dy: number) => number)[] };

/** A square as one patch or two. One, on the plane nearest its four corners, where they stand within
 * PATCH_FLAT_PIXELS of it; else two triangles, each through three corners, split along the diagonal from the top-right
 * corner (`diagonal` 0) or from the top-left one (1). */
function parts([a, b, c, d]: Corners, size: number, diagonal: 0 | 1, flat: number): Part[] {
  const left = (dx: number) => dx, right = (dx: number) => size - dx, top = (_: number, dy: number) => dy, bottom = (_: number, dy: number) => size - dy;
  if (Math.abs(a + d - b - c) / 4 <= flat) { const across = (b + d - a - c) / (2 * size), down = (c + d - a - b) / (2 * size); return [{ depth: (a + b + c + d) / 4 - (across + down) * size / 2, right: across, down, edges: [left, right, top, bottom] }]; }
  return diagonal === 0
    ? [{ depth: a, right: (b - a) / size, down: (c - a) / size, edges: [left, top, (dx, dy) => (size - dx - dy) / Math.SQRT2] },
       { depth: b + c - d, right: (d - c) / size, down: (d - b) / size, edges: [right, bottom, (dx, dy) => (dx + dy - size) / Math.SQRT2] }]
    : [{ depth: a, right: (b - a) / size, down: (d - b) / size, edges: [top, right, (dx, dy) => (dx - dy) / Math.SQRT2] },
       { depth: a, right: (d - c) / size, down: (c - a) / size, edges: [left, bottom, (dx, dy) => (dy - dx) / Math.SQRT2] }];
}

/**
 * A nebula's surfaces (./shape-walls.ts) as a mesh of flat patches, for surfaces that are gentle and known coarsely:
 * the depths measured speeds give (./shape.ts). A stack of slices draws a fine feature of such a surface on every slice
 * its depth lies between, and turned they show as copies side by side; on a patch it is drawn once.
 *
 * Each surface is cut into squares, a square into four wherever flat patches cannot follow the surface across it
 * within `fit`, how closely its depth is known. The depth is taken at the squares' corners and every patch passes
 * through its corners, so two patches side by side meet along the edge between them: the mesh has no gap and no step.
 * A corner in the middle of a larger square's edge stands on that edge.
 *
 * A patch is drawn as a rectangle of the picture on its plane. It reaches a little beyond its edges and fades there
 * (`PATCH_OVERLAP_PIXELS`), its neighbours fading in: a pixel's optical depth is shared among the patches that reach
 * it, so along the sight line a surface's patches add up to the surface.
 *
 * A surface of smooth light alone (`ShapeLayer.texels`) is cut and drawn on a grid that many face pixels to a texel: its
 * patches and their textures are that much coarser.
 *
 * Depths and `fit` are in the bank's units and `facePixel` is a face pixel's size in them.
 */
export function imageLayerShapePatches(walls: ShapeWalls, width: number, height: number, facePixel: number, fit: number): ShapePatches {
  const patches: ShapePatch[] = [], scenes: number[] = [];
  // The surfaces in the order they are painted: the last of the walls' layers first.
  for (const layer of [...walls.layers].reverse()) {
    const texels = layer.texels ?? 1, drawn = texels > 1 ? coarser(layer, width, height, texels) : { layer, width, height }, found = surfacePatches(drawn.layer, drawn.width, drawn.height, facePixel * texels, fit);
    for (const patch of found.patches) patches.push(texels > 1 ? { ...patch, left: patch.left * texels, top: patch.top * texels, width: patch.width * texels, height: patch.height * texels, right: patch.right / texels, down: patch.down / texels } : patch);
    scenes.push(...found.scenes);
  }
  return { patches, scenes };
}

/** A surface on a grid `texels` face pixels to a texel: a texel's optical depth is the mean over its face pixels, its
 * color theirs weighted by their optical depths, its depth the mean of those that hold light. */
function coarser(layer: ShapeLayer, width: number, height: number, texels: number): { layer: ShapeLayer; width: number; height: number } {
  const columns = Math.ceil(width / texels), rows = Math.ceil(height / texels), made: ShapeLayer = { depth: new Float32Array(columns * rows).fill(NaN), tau: new Float32Array(columns * rows), hue: new Uint8Array(3 * columns * rows) };
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) { let tau = 0, depth = 0, lit = 0; const color = [0, 0, 0];
    for (let y = row * texels; y < Math.min(height, (row + 1) * texels); y++) for (let x = column * texels; x < Math.min(width, (column + 1) * texels); x++) { const p = y * width + x, own = layer.tau[p]!; if (Number.isNaN(layer.depth[p]!) || !(own > 0)) continue;
      tau += own; depth += layer.depth[p]!; lit++; for (let channel = 0; channel < 3; channel++) color[channel]! += own * layer.hue[3 * p + channel]!; }
    if (!lit) continue;
    const at = row * columns + column; made.tau[at] = tau / (texels * texels); made.depth[at] = depth / lit; for (let channel = 0; channel < 3; channel++) made.hue[3 * at + channel] = Math.round(color[channel]! / tau); }
  return { layer: made, width: columns, height: rows };
}

/** One surface's patches, and the sizes of the runs of them that share a 3D scene. */
function surfacePatches(layer: ShapeLayer, width: number, height: number, facePixel: number, fit: number): ShapePatches {
  const count = width * height, patches: ShapePatch[] = [], scenes: number[] = [];
  {
    const lit = new Uint8Array(count); let x0 = width, y0 = height, x1 = -1, y1 = -1;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const p = y * width + x;
      if (Number.isNaN(layer.depth[p]!) || !(layer.tau[p]! > 0)) continue;
      lit[p] = 1; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    if (x1 < x0) return { patches, scenes };
    const tolerance = fit, flat = PATCH_FLAT_PIXELS * facePixel, least = PATCH_LEAST_PIXELS;
    // The surface's depth beyond its own pixels: that of its nearest pixel, found in two sweeps, so a corner outside the
    // surface stands where its edge is.
    const nearest = new Int32Array(count).fill(-1);
    for (let p = 0; p < count; p++) if (lit[p]) nearest[p] = p;
    const closer = (p: number, x: number, y: number, dx: number, dy: number) => { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= width || ny >= height) return;
      const found = nearest[ny * width + nx]!; if (found < 0) return; const held = nearest[p]!;
      if (held < 0 || (found % width - x) ** 2 + (Math.floor(found / width) - y) ** 2 < (held % width - x) ** 2 + (Math.floor(held / width) - y) ** 2) nearest[p] = found; };
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const p = y * width + x; if (lit[p]) continue; closer(p, x, y, -1, 0); closer(p, x, y, 0, -1); closer(p, x, y, -1, -1); closer(p, x, y, 1, -1); }
    for (let y = height - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--) { const p = y * width + x; if (lit[p]) continue; closer(p, x, y, 1, 0); closer(p, x, y, 0, 1); closer(p, x, y, 1, 1); closer(p, x, y, -1, 1); }
    const beyond = (x: number, y: number) => layer.depth[nearest[y * width + x]!]!;
    // The surface's depth at a corner between four pixels.
    const corner = (x: number, y: number) => { let sum = 0; for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]] as const) sum += beyond(Math.max(0, Math.min(width - 1, x + dx)), Math.max(0, Math.min(height - 1, y + dy))); return sum / 4; };
    // How far the surface stands at most from a square's patches where the square is lit, across the surface; null where it is not lit.
    const misfit = (left: number, top: number, size: number, made: readonly Part[]) => { let any = false, worst = 0; const across = made.map(part => Math.hypot(1, part.right / facePixel, part.down / facePixel));
      for (let y = Math.max(0, top); y < Math.min(height, top + size); y++) for (let x = Math.max(0, left); x < Math.min(width, left + size); x++) { const p = y * width + x; if (!lit[p]) continue;
        const dx = x + .5 - left, dy = y + .5 - top, which = made.length === 1 || made[0]!.edges[2]!(dx, dy) >= 0 ? 0 : 1, part = made[which]!, off = Math.abs(layer.depth[p]! - (part.depth + part.right * dx + part.down * dy));
        any = true; worst = Math.max(worst, off / across[which]!, off / PATCH_FIT_DEPTHS); }
      return any ? worst : null; };
    const cells: { left: number; top: number; size: number; diagonal: 0 | 1 }[] = [];
    const cut = (left: number, top: number, size: number) => { const corners: Corners = [corner(left, top), corner(left + size, top), corner(left, top + size), corner(left + size, top + size)];
      const first = misfit(left, top, size, parts(corners, size, 0, flat)); if (first === null) return;
      const second = misfit(left, top, size, parts(corners, size, 1, flat))!, diagonal = second < first ? 1 : 0;
      if (size > PATCH_MOST_PIXELS || (Math.min(first, second) > tolerance && size > least)) { const half = size / 2; cut(left, top, half); cut(left + half, top, half); cut(left, top + half, half); cut(left + half, top + half, half); } else cells.push({ left, top, size, diagonal }); };
    cut(x0, y0, Math.max(least, 2 ** Math.ceil(Math.log2(Math.max(x1 - x0 + 1, y1 - y0 + 1)))));
    // The mesh's corners. One in the middle of a larger square's edge stands on that edge, so the smaller squares
    // beside it meet the larger one along the whole edge: the larger squares' edges are laid first.
    const corners = new Map<number, number>(), key = (x: number, y: number) => y * (width + 1) + x;
    for (const cell of cells) for (const [x, y] of [[cell.left, cell.top], [cell.left + cell.size, cell.top], [cell.left, cell.top + cell.size], [cell.left + cell.size, cell.top + cell.size]] as const) if (!corners.has(key(x, y))) corners.set(key(x, y), corner(x, y));
    for (const cell of [...cells].sort((p, q) => q.size - p.size)) { const { left, top, size } = cell;
      for (const [fx, fy, tx, ty] of [[left, top, left + size, top], [left, top + size, left + size, top + size], [left, top, left, top + size], [left + size, top, left + size, top + size]] as const) {
        const from = corners.get(key(fx, fy))!, to = corners.get(key(tx, ty))!;
        for (let step = PATCH_LEAST_PIXELS; step < size; step += PATCH_LEAST_PIXELS) { const at = key(fx + (tx - fx) * step / size, fy + (ty - fy) * step / size); if (corners.has(at)) corners.set(at, from + (to - from) * step / size); } } }
    const pieces = cells.flatMap(cell => parts([corners.get(key(cell.left, cell.top))!, corners.get(key(cell.left + cell.size, cell.top))!, corners.get(key(cell.left, cell.top + cell.size))!, corners.get(key(cell.left + cell.size, cell.top + cell.size))!], cell.size, cell.diagonal, flat).map(part => ({ ...cell, ...part })));
    // A patch's share of a pixel: all of it inside the patch but for its rim, none beyond the overlap, over the sum of
    // the shares of every patch that reaches the pixel.
    const reach = PATCH_OVERLAP_PIXELS, share = (piece: (typeof pieces)[number], x: number, y: number) => { let held = 1; for (const edge of piece.edges) held *= smooth((edge(x + .5 - piece.left, y + .5 - piece.top) + reach) / (2 * reach)); return held; };
    const within = (piece: (typeof pieces)[number]) => ({ fromX: Math.max(0, piece.left - reach), toX: Math.min(width, piece.left + piece.size + reach), fromY: Math.max(0, piece.top - reach), toY: Math.min(height, piece.top + piece.size + reach) });
    const total = new Float32Array(count);
    for (const piece of pieces) { const { fromX, toX, fromY, toY } = within(piece); for (let y = fromY; y < toY; y++) for (let x = fromX; x < toX; x++) if (lit[y * width + x]) total[y * width + x]! += share(piece, x, y); }
    const drawn: ShapePatch[] = [];
    for (const piece of pieces) { const { fromX, toX, fromY, toY } = within(piece); let left = toX, top = toY, right = -1, bottom = -1; const opacity = new Uint8Array((toX - fromX) * (toY - fromY));
      for (let y = fromY; y < toY; y++) for (let x = fromX; x < toX; x++) { const p = y * width + x; if (!lit[p]) continue;
        const held = share(piece, x, y), alpha = held > 0 ? Math.round(255 * (1 - Math.exp(-layer.tau[p]! * held / total[p]!))) : 0; if (!alpha) continue;
        opacity[(y - fromY) * (toX - fromX) + x - fromX] = alpha; left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
      if (right < left) continue;
      // Color is kept under clear texels too, so the lossy encoding has no dark edge to bleed in.
      const w = right - left + 1, h = bottom - top + 1, rgba = Buffer.alloc(w * h * 4);
      for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) { const p = y * width + x, o = 4 * ((y - top) * w + x - left); for (let channel = 0; channel < 3; channel++) rgba[o + channel] = layer.hue[3 * p + channel]!; rgba[o + 3] = opacity[(y - fromY) * (toX - fromX) + x - fromX]!; }
      drawn.push({ left, top, width: w, height: h, texture: [w, h], rgba, depth: piece.depth + piece.right * (left - piece.left) + piece.down * (top - piece.top), right: piece.right, down: piece.down }); }
    // Scenes: patches that overlap never share one, and a scene's patches are neighbours.
    const order = drawn.map((_, index) => index).sort((a, b) => morton(drawn[a]!.left, drawn[a]!.top) - morton(drawn[b]!.left, drawn[b]!.top)), color = new Int32Array(drawn.length).fill(-1); let colors = 0;
    const overlap = (a: ShapePatch, b: ShapePatch) => a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;
    for (const index of order) { const taken = new Set<number>(); for (const other of order) if (color[other]! >= 0 && overlap(drawn[index]!, drawn[other]!)) taken.add(color[other]!); let free = 0; while (taken.has(free)) free++; color[index] = free; colors = Math.max(colors, free + 1); }
    for (let c = 0; c < colors; c++) { const same = order.filter(index => color[index] === c); for (let from = 0; from < same.length; from += SCENE_MOST_PATCHES) { const run = same.slice(from, from + SCENE_MOST_PATCHES); scenes.push(run.length); for (const index of run) patches.push(drawn[index]!); } }
  }
  return { patches, scenes };
}

/** The patches' textures on as few atlases as hold them, each with clear texels around it: where each patch lies. */
export function packShapePatches(patches: readonly ShapePatch[]): { atlases: { width: number; height: number; rgba: Buffer }[]; places: { atlas: number; x: number; y: number }[] } {
  const gutter = ATLAS_GUTTER_PIXELS, places: { atlas: number; x: number; y: number }[] = patches.map(() => ({ atlas: 0, x: 0, y: 0 })), sizes: { width: number; height: number }[] = [];
  // Shelves: the tallest patches first, each shelf as high as its first patch.
  const order = patches.map((_, index) => index).sort((a, b) => patches[b]!.texture[1] - patches[a]!.texture[1] || patches[b]!.texture[0] - patches[a]!.texture[0]);
  let atlas = 0, x = gutter, y = gutter, shelf = 0, widest = 0;
  const close = () => { sizes[atlas] = { width: widest + gutter, height: shelf ? y + shelf + gutter : y }; };
  for (const index of order) { const [columns, rows] = patches[index]!.texture;
    if (columns + 2 * gutter > ATLAS_PIXELS || rows + 2 * gutter > ATLAS_PIXELS) throw new RangeError(`A patch of ${columns} by ${rows} texels does not fit an atlas of ${ATLAS_PIXELS}.`);
    if (x + columns + gutter > ATLAS_PIXELS) { x = gutter; y += shelf + gutter; shelf = 0; }
    if (y + rows + gutter > ATLAS_PIXELS) { close(); atlas++; x = gutter; y = gutter; shelf = 0; widest = 0; }
    places[index] = { atlas, x, y }; x += columns + gutter; shelf = Math.max(shelf, rows); widest = Math.max(widest, x - gutter); }
  if (patches.length) close();
  const atlases = sizes.map(size => ({ ...size, rgba: Buffer.alloc(size.width * size.height * 4) }));
  for (const [index, patch] of patches.entries()) { const place = places[index]!, target = atlases[place.atlas]!, [columns, rows] = patch.texture;
    for (let row = 0; row < rows; row++) patch.rgba.copy(target.rgba, 4 * ((place.y + row) * target.width + place.x), 4 * row * columns, 4 * (row + 1) * columns); }
  return { atlases, places };
}
