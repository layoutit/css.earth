import { imageLayerRingsCover, type imageLayerRingsModel } from './rings.ts';

type Model = ReturnType<typeof imageLayerRingsModel>;
/** A sky offset from the star at a face pixel: `at[0] + at[1] * px + at[2] * py`, in arcseconds. */
export type Across = readonly [number, number, number];

/** A texel's brightest channel is drawn at this share of full color and a little more opaque, which leaves room above
 * every channel: a browser keeps a layer's color times its opacity in whole numbers, rounded down, and half a step is
 * added back to each channel (the body's slabs do the same, `BODY_COLOR_PEAK`). */
const PEAK = 240 / 255;
/** A cell's glow is the least light within this many cells of it, then the mean over the cells beside it: smooth, and
 * never more than any pixel under it shows once a browser has stretched the grid over the picture. */
const LEAST_CELLS = 2;
/** How coarse the face-on drawing counts as against the curtains, in curtain spacings: the face-on drawing is the one
 * shown within about 27° of the sight line, the angle whose tangent is one over this. Farther round a ring can stand
 * edge-on, where layers parallel to it show nothing and the curtains do. */
export const RINGS_FACE_ON_STEP = 2;
/** A knot or a filament is in one place, so a sheet's detail is not shared as the glow is: it lies on the structure
 * with the larger share of its sight line's light. Within this much of an even split the two sheets share it, so no
 * edge shows from the Sun where the detail changes planes. Shared in proportion, every knot between the two radii
 * showed twice once the camera turned, once on each plane. */
const DETAIL_SHARED_WITHIN = 0.15;
/** The disc sheet's part of a sight line's detail, from the disc's share of its light. */
const detailOnDisc = (share: number) => { const t = Math.max(0, Math.min(1, (share - .5) / (2 * DETAIL_SHARED_WITHIN) + .5)); return t * t * (3 - 2 * t); };

/** The rings' glow on a grid of cells over the picture's light: each channel's optical depth for each cell and
 * structure (disc, then ring). */
export interface RingsCells { left: number; top: number; cell: number; cols: number; rows: number; glow: Float32Array }
/** A structure's glow for the views near the Sun's: `layers` are its drawings, each one of `images` (on the cells'
 * grid) at a depth from its plane, in arcseconds along the sight line. */
export interface RingsGlow { images: Buffer[]; layers: { offset: number; image: number }[] }

const at = (across: Across, px: number, py: number) => across[0] + across[1] * px + across[2] * py;
const paint = (rgba: Buffer, o: number, each: readonly number[]) => {
  const depth = Math.max(...each), stored = Math.max(0, Math.min(254, Math.round(255 * (1 - Math.exp(-depth / PEAK))))), lift = stored ? 127.5 / stored : 0;
  for (let c = 0; c < 3; c++) rgba[o + c] = Math.min(255, Math.round(255 * PEAK * each[c]! / depth + lift));
  rgba[o + 3] = stored;
};
/** How the glow falls off from a ring's plane: a bell as wide at half its height as the ring is thick, none of it
 * farther than the thickness from the plane. The share of the glow between two depths, in thicknesses from the plane.
 * A bell, not a slab with faces: drawn as layers or curtains, a face shows as a step at every one. */
const upTo = (depth: number) => { const t = Math.max(-1, Math.min(1, depth)); return (t + 1) / 2 + Math.sin(Math.PI * t) / (2 * Math.PI); };
const between = (from: number, to: number) => upTo(to) - upTo(from);

/** The smooth part of each structure's light, on a grid of about `facePixels` cells along the picture's longer side.
 * A pixel's light is shared between the structures as their sheets share it (`share`), by optical depth. */
export function imageLayerRingsCells(rgba: Buffer, width: number, height: number, east: Across, north: Across, model: Model, facePixels: number): RingsCells {
  let left = width, top = height, right = -1, bottom = -1;
  for (let py = 0; py < height; py++) for (let px = 0; px < width; px++) if (rgba[4 * (py * width + px) + 3]) { left = Math.min(left, px); right = Math.max(right, px); top = Math.min(top, py); bottom = Math.max(bottom, py); }
  if (right < left) throw new TypeError('The rings hold no light of the picture.');
  const cell = Math.max(1, Math.ceil(Math.max(right - left + 1, bottom - top + 1) / facePixels)), cols = Math.ceil((right - left + 1) / cell), rows = Math.ceil((bottom - top + 1) / cell), cells = cols * rows;
  let light = new Float32Array(cells * 6).fill(Infinity);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const o = 6 * (j * cols + i);
    for (let py = top + j * cell; py < top + (j + 1) * cell; py++) for (let px = left + i * cell; px < left + (i + 1) * cell; px++) {
      const p = 4 * (py * width + px), a = px < width && py < height ? Math.min(rgba[p + 3]! / 255, .998) : 0;
      if (!a) { for (let k = 0; k < 6; k++) light[o + k] = 0; continue; }
      const onDisc = model.planes[0].share(at(east, px, py), at(north, px, py));
      for (let s = 0; s < 2; s++) { const share = s ? 1 - onDisc : onDisc, opacity = share > 0 ? 1 - (1 - a) ** share : 0; for (let c = 0; c < 3; c++) light[o + 3 * s + c] = Math.min(light[o + 3 * s + c]!, rgba[p + c]! / 255 * opacity); } } }
  // The least over the cells around, then the mean over the cells beside: rows, then columns.
  const pass = (from: Float32Array, radius: number, least: boolean) => { const out = new Float32Array(from.length);
    for (const [length, lines, step, stride] of [[cols, rows, cols, 1], [rows, cols, 1, cols]] as const) { const source = stride === 1 ? from : Float32Array.from(out);
      for (let l = 0; l < lines; l++) for (let i = 0; i < length; i++) for (let k = 0; k < 6; k++) { let value = least ? Infinity : 0, n = 0;
        for (let m = Math.max(0, i - radius); m <= Math.min(length - 1, i + radius); m++) { const v = source[6 * (l * step + m * stride) + k]!; if (least) value = Math.min(value, v); else { value += v; n++; } }
        out[6 * (l * step + i * stride) + k] = least ? value : value / n; } }
    return out; };
  light = pass(pass(light, LEAST_CELLS, true), 1, false);
  return { left, top, cell, cols, rows, glow: light.map(value => -Math.log(1 - Math.min(value, .998))) };
}

/** Each structure's glow for the view from the Sun and near it: `layers` drawings parallel to the structure's plane,
 * evenly spaced along the sight line through twice `thickness` arcseconds, half in front of the plane and half behind
 * it, none on it; each holds the share of the glow that the bell puts about its depth. Parallel to the sheet, they
 * never cut through it, so their order with it is one order everywhere; along the sight line they lie over one
 * another, so from the Sun they add up exactly. Drawings as far in front of the plane as behind it are one image. */
export function imageLayerRingsGlow(cells: RingsCells, layers: number, thickness: number): [RingsGlow, RingsGlow] {
  const count = cells.cols * cells.rows, half = Math.ceil(layers / 2), total = 2 * half;
  return [0, 1].map(s => { const images: Buffer[] = [];
    for (let m = 0; m < half; m++) { const share = between(2 * m / total, 2 * (m + 1) / total), image = Buffer.alloc(count * 4);
      for (let t = 0; t < count; t++) { const each = [0, 1, 2].map(c => cells.glow[6 * t + 3 * s + c]! * share); if (Math.max(...each) > 0) paint(image, 4 * t, each); }
      images.push(image); }
    return { images, layers: Array.from({ length: total }, (_, j) => ({ offset: ((j + .5) / total * 2 - 1) * thickness, image: j < half ? half - 1 - j : j - half })) }; }) as [RingsGlow, RingsGlow];
}

/** A structure's glow as curtains across the picture, for the views from its sides: curtain `s` of `crossSlices` stands
 * at one place along the picture's columns (`x`) or rows (`y`) and shows the glow of the slab of nebula about it, the
 * cells along it (from `first`, `length` of them) against depth: row `d` of `depthPixels` is at
 * `((d + .5) / depthPixels * 2 - 1) * thickness` from the structure's plane, along the sight line. */
export function imageLayerRingsCurtains(cells: RingsCells, structure: number, axis: 'x' | 'y', crossSlices: number, cellArcsec: number, thickness: number): { first: number; length: number; depthPixels: number; images: (Buffer | null)[] } | null {
  const { cols, rows, glow } = cells, along = axis === 'x' ? rows : cols, across = axis === 'x' ? cols : rows, lit = (t: number) => Math.max(glow[6 * t + 3 * structure]!, glow[6 * t + 3 * structure + 1]!, glow[6 * t + 3 * structure + 2]!) > 0;
  let first = along, last = -1; for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) if (lit(j * cols + i)) { const a = axis === 'x' ? j : i; first = Math.min(first, a); last = Math.max(last, a); }
  if (last < first) return null;
  const length = last - first + 1, depthPixels = Math.max(8, Math.round(2 * thickness / cellArcsec)), spacing = across * cellArcsec / crossSlices, images: (Buffer | null)[] = [];
  for (let s = 0; s < crossSlices; s++) { const from = Math.floor(s * across / crossSlices), to = Math.max(from + 1, Math.floor((s + 1) * across / crossSlices)), image = Buffer.alloc(length * depthPixels * 4); let any = false;
    for (let a = 0; a < length; a++) { const each = [0, 0, 0];
      for (let i = from; i < to; i++) { const t = axis === 'x' ? (first + a) * cols + i : i * cols + first + a; for (let c = 0; c < 3; c++) each[c]! += glow[6 * t + 3 * structure + c]! / (to - from); }
      if (!(Math.max(...each) > 0)) continue;
      // The glow per arcsecond of depth here, times the curtain spacing: what the curtain's slab of nebula holds.
      for (let d = 0; d < depthPixels; d++) { const share = between(2 * d / depthPixels - 1, 2 * (d + 1) / depthPixels - 1) / (2 * thickness / depthPixels) * spacing, o = 4 * (d * length + a); paint(image, o, each.map(value => value * share)); if (image[o + 3]) any = true; } }
    images.push(any ? image : null); }
  return { first, length, depthPixels, images };
}

/** The two sheets, disc then ring, as RGBA over the whole face: what the photograph has left once the glow shows, so
 * that from the Sun glow and sheets together are the photograph. `drawn` are each structure's glow images as a browser
 * holds them (the encoded images read back). The glow is shared between the structures in proportion; what is left
 * goes to the sheet of the structure with the larger share (`DETAIL_SHARED_WITHIN`). Each sheet's opacity is a smooth
 * cover over its light (`imageLayerRingsCover`), and what it hides of the glow behind it is added to its own light. */
export function imageLayerRingsSheets(rgba: Buffer, width: number, height: number, east: Across, north: Across, model: Model, cells: RingsCells, glow: readonly [RingsGlow, RingsGlow], drawn: readonly Buffer[][]): [Buffer, Buffer] {
  const { left, top, cell, cols, rows } = cells, count = width * height, texels = cols * rows;
  // Each glow image as a browser draws it: color times opacity in whole numbers, rounded down.
  const held = drawn.map(images => images.map(image => { const out = new Uint8Array(texels * 4); for (let t = 0; t < texels; t++) { const a = image[4 * t + 3]!; out[4 * t + 3] = a; for (let c = 0; c < 3; c++) out[4 * t + c] = Math.floor(image[4 * t + c]! * a / 255); } return out; }));
  const most = Math.max(...held.map(images => images.length)), blended = [new Float32Array(4 * most), new Float32Array(4 * most)];
  const opacity: Float32Array[] = [new Float32Array(count), new Float32Array(count)], sheets: [Buffer, Buffer] = [Buffer.alloc(count * 4), Buffer.alloc(count * 4)], light = new Float32Array(6), seen = [0, 0, 0], corner = [0, 0, 0, 0], weight = [0, 0, 0, 0], shares = [0, 0];
  // Everything on a sight line, nearest first: a structure's drawings in front of its plane, its sheet, its drawings
  // behind. Where both structures are on the line the two runs are merged by depth.
  const runs = glow.map(structure => [...structure.layers.filter(layer => layer.offset < 0), null, ...structure.layers.filter(layer => layer.offset >= 0)]);
  /** One pixel's sheets: their light (color times opacity, 0 to 1) by structure and channel into `light`. */
  const solve = (px: number, py: number): number => {
    const p = py * width + px, a = Math.min(rgba[4 * p + 3]! / 255, .998); light.fill(0); if (!a) return 0;
    const e = at(east, px, py), n = at(north, px, py), onDisc = detailOnDisc(model.planes[0].share(e, n)); shares[0] = onDisc; shares[1] = 1 - onDisc;
    // Each glow image here, as a browser blends the four cells around the pixel: its light and opacity.
    const fx = (px + .5 - left) / cell - .5, fy = (py + .5 - top) / cell - .5, i0 = Math.floor(fx), j0 = Math.floor(fy), tx = fx - i0, ty = fy - j0, ia = Math.max(0, Math.min(cols - 1, i0)), ib = Math.max(0, Math.min(cols - 1, i0 + 1)), ja = Math.max(0, Math.min(rows - 1, j0)), jb = Math.max(0, Math.min(rows - 1, j0 + 1));
    corner[0] = 4 * (ja * cols + ia); corner[1] = 4 * (ja * cols + ib); corner[2] = 4 * (jb * cols + ia); corner[3] = 4 * (jb * cols + ib);
    weight[0] = (1 - tx) * (1 - ty) / 255; weight[1] = tx * (1 - ty) / 255; weight[2] = (1 - tx) * ty / 255; weight[3] = tx * ty / 255;
    for (let s = 0; s < 2; s++) { const images = held[s]!, into = blended[s]!; for (let m = 0; m < images.length; m++) { const image = images[m]!; for (let c = 0; c < 4; c++) into[4 * m + c] = weight[0]! * image[corner[0]! + c]! + weight[1]! * image[corner[1]! + c]! + weight[2]! * image[corner[2]! + c]! + weight[3]! * image[corner[3]! + c]!; } }
    const depths = [model.planes[0].depth(e, n), model.planes[1].depth(e, n)], next = [0, 0]; seen[0] = seen[1] = seen[2] = 0; let clear = 1; const clearTo = [1, 1];
    for (;;) { let structure = -1, nearest = Infinity;
      for (let s = 0; s < 2; s++) { const run = runs[s]!; if (next[s]! >= run.length) continue; const layer = run[next[s]!], depth = depths[s]! + (layer ? layer.offset : 0); if (depth < nearest) { nearest = depth; structure = s; } }
      if (structure < 0) break;
      const layer = runs[structure]![next[structure]!++];
      // A sheet is on the sight line only where its structure holds some of the pixel's light.
      if (!layer) { clearTo[structure] = clear; if (shares[structure]! > 0) clear *= 1 - opacity[structure]![p]! / 255; continue; }
      const o = 4 * layer.image, into = blended[structure]!; if (!(into[o + 3]! > 0)) continue;
      for (let c = 0; c < 3; c++) seen[c]! += clear * into[o + c]!;
      clear *= 1 - into[o + 3]!; }
    let brightest = 0;
    for (let c = 0; c < 3; c++) { const owed = Math.max(0, rgba[4 * p + c]! / 255 * a - seen[c]!); for (let s = 0; s < 2; s++) { if (!(shares[s]! > 0)) continue; const value = owed * shares[s]! / Math.max(clearTo[s]!, 1e-3); light[3 * s + c] = value; brightest = Math.max(brightest, value); } }
    return brightest; };
  // First with clear sheets, for how opaque each has to be; then with those opacities, for what each shows.
  for (let py = 0; py < height; py++) for (let px = 0; px < width; px++) if (solve(px, py) > 0) { const p = py * width + px; for (let s = 0; s < 2; s++) opacity[s]![p] = 255 * Math.min(1, Math.max(light[3 * s]!, light[3 * s + 1]!, light[3 * s + 2]!)); }
  const covers = [imageLayerRingsCover(opacity[0]!, width, height), imageLayerRingsCover(opacity[1]!, width, height)];
  opacity[0] = covers[0]!; opacity[1] = covers[1]!;
  for (let py = 0; py < height; py++) for (let px = 0; px < width; px++) { const p = py * width + px; if (!rgba[4 * p + 3]) continue; solve(px, py);
    for (let s = 0; s < 2; s++) { if (!(shares[s]! > 0)) continue; const brightest = Math.max(light[3 * s]!, light[3 * s + 1]!, light[3 * s + 2]!);
      const alpha = Math.min(255, Math.ceil(Math.max(covers[s]![p]!, 255 * Math.min(1, brightest)))), o = 4 * p; if (!alpha) continue; sheets[s]![o + 3] = alpha;
      for (let c = 0; c < 3; c++) sheets[s]![o + c] = Math.min(255, Math.round(255 * 255 * light[3 * s + c]! / alpha)); } }
  return sheets;
}
