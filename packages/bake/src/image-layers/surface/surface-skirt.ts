import type { ImageLayerRecipe } from '../config.ts';
import { SURFACE_MOST_CROSSINGS, surfaceOnPicture, type SurfaceCrossings } from './surface.ts';
import type { SurfaceTriangle } from './surface-mesh.ts';

type Surface = NonNullable<ImageLayerRecipe['geometry']['surface']>;

/** Flattening the surface's equatorial protrusions under the skirt: heights in file units the radii are read in, turns
 * about the pole in bins of SKIRT_TURN_BINS, a point's radius capped at SKIRT_CAP over the median radius within
 * SKIRT_TURN_REACH bins either side at its height, over SKIRT_WAIST_BAND file units either side of the waist. */
/** Flattening the surface's equatorial protrusions under the skirt: the smooth shape is fitted over SKIRT_FIT_BAND file
 * units either side of the star along the pole, as each height's radius in turn about the pole up to
 * SKIRT_FIT_HARMONICS harmonics, the heights in SKIRT_HEIGHT_STEP slices smoothed over SKIRT_HEIGHT_SMOOTH slices; a
 * point standing out past SKIRT_CAP of that shape is brought to it, fully within SKIRT_WAIST_BAND of the star and
 * less and less out to SKIRT_FIT_BAND. */
export const SKIRT_FIT_BAND = 1.6, SKIRT_WAIST_BAND = 1, SKIRT_HEIGHT_STEP = 0.1, SKIRT_HEIGHT_SMOOTH = 3, SKIRT_FIT_HARMONICS = 2, SKIRT_CAP = 1.03;

/**
 * The surface with its equatorial protrusions brought in to the lobes' broad shape, where the skirt takes their light
 * instead. Steffen et al. (2014) model off-planar equatorial protrusions from H2; the picture's skirt is a thin disc
 * they find no H2 from. Near the star the surface's radius about the pole is fitted, height by height, by a few
 * harmonics of the turn about the pole (least squares on the points' radii, the slices smoothed in height): the lobes'
 * broad, lopsided shape. A protrusion stands out of it, narrow in turn and in height, and is brought back onto it. The
 * file's triangles, moved, in its units.
 */
export function flattenProtrusions(surface: Surface, triangles: Float32Array): Float32Array {
  const [ox, oy, oz] = surface.originUnits, corners = triangles.length / 3, K = SKIRT_FIT_HARMONICS, terms = 2 * K + 1;
  const basis = (turn: number) => { const b = [1]; for (let k = 1; k <= K; k++) b.push(Math.cos(k * turn), Math.sin(k * turn)); return b; };
  // Least squares per slice: the normal equations' sums.
  const slices = Math.round(SKIRT_FIT_BAND / SKIRT_HEIGHT_STEP), sums = Array.from({ length: 2 * slices + 1 }, () => ({ a: new Float64Array(terms * terms), b: new Float64Array(terms), n: 0 }));
  for (let c = 0; c < corners; c++) { const x = triangles[3 * c]! - ox, y = triangles[3 * c + 1]! - oy, z = triangles[3 * c + 2]! - oz, slice = Math.round(z / SKIRT_HEIGHT_STEP); if (Math.abs(slice) > slices) continue;
    const f = basis(Math.atan2(y, x)), r = Math.hypot(x, y), sum = sums[slice + slices]!; sum.n++; for (let i = 0; i < terms; i++) { sum.b[i]! += f[i]! * r; for (let j = 0; j < terms; j++) sum.a[i * terms + j]! += f[i]! * f[j]!; } }
  const solve = (a: Float64Array, b: Float64Array) => { const m = Array.from({ length: terms }, (_, i) => [...Array.from({ length: terms }, (_, j) => a[i * terms + j]! + (i === j ? 1e-6 : 0)), b[i]!]);
    for (let i = 0; i < terms; i++) { let p = i; for (let r = i + 1; r < terms; r++) if (Math.abs(m[r]![i]!) > Math.abs(m[p]![i]!)) p = r; [m[i], m[p]] = [m[p]!, m[i]!];
      for (let r = 0; r < terms; r++) if (r !== i) { const f = m[r]![i]! / m[i]![i]!; for (let k = i; k <= terms; k++) m[r]![k]! -= f * m[i]![k]!; } }
    return m.map((row, i) => row[terms]! / row[i]!); };
  const fits = sums.map((_, s) => { const a = new Float64Array(terms * terms), b = new Float64Array(terms); let n = 0;
    for (let d = -SKIRT_HEIGHT_SMOOTH; d <= SKIRT_HEIGHT_SMOOTH; d++) { const other = sums[s + d]; if (!other) continue; n += other.n; for (let i = 0; i < terms * terms; i++) a[i]! += other.a[i]!; for (let i = 0; i < terms; i++) b[i]! += other.b[i]!; }
    return n > 3 * terms ? solve(a, b) : null; });
  const out = Float32Array.from(triangles);
  for (let c = 0; c < corners; c++) { const x = triangles[3 * c]! - ox, y = triangles[3 * c + 1]! - oy, z = triangles[3 * c + 2]! - oz, slice = Math.round(z / SKIRT_HEIGHT_STEP), fit = Math.abs(slice) <= slices ? fits[slice + slices] : null; if (!fit) continue;
    const t = Math.max(0, Math.min(1, (SKIRT_FIT_BAND - Math.abs(z)) / (SKIRT_FIT_BAND - SKIRT_WAIST_BAND))), w = t * t * (3 - 2 * t), r = Math.hypot(x, y), cap = SKIRT_CAP * basis(Math.atan2(y, x)).reduce((sum, f, i) => sum + f * fit[i]!, 0);
    if (!(w > 0) || !(r > cap) || !(cap > 0)) continue; const scale = (r - w * (r - cap)) / r;
    out[3 * c] = ox + x * scale; out[3 * c + 1] = oy + y * scale; }
  return out;
}

/** Regions drawn on the picture (`source/regions.json`): closed paths of picture pixels, each named. */
export interface PictureRegions { dimensions: readonly [number, number]; regions: readonly { name: string; points: readonly (readonly [number, number])[] }[] }
/** Where the regions whose names start with `prefix` cover the face grid, 0 to 1: their paths filled (even-odd per
 * path, any path counting), scaled from the picture's dimensions to the grid's, and feathered by a box blur of
 * `feather` pixels twice. */
export function regionMask(regions: PictureRegions, prefix: string, width: number, height: number, feather: number): Float32Array {
  const mask = new Float32Array(width * height), sx = width / regions.dimensions[0], sy = height / regions.dimensions[1];
  for (const region of regions.regions) { if (!region.name.startsWith(prefix)) continue; const points = region.points.map(([x, y]) => [x * sx, y * sy] as const);
    for (let y = 0; y < height; y++) { const cy = y + .5, xs: number[] = [];
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) { const [xi, yi] = points[i]!, [xj, yj] = points[j]!; if ((yi > cy) !== (yj > cy)) xs.push(xi + (cy - yi) / (yj - yi) * (xj - xi)); }
      xs.sort((a, b) => a - b); for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.ceil(xs[k]! - .5)); x <= Math.min(width - 1, Math.floor(xs[k + 1]! - .5)); x++) mask[y * width + x] = 1; } }
  let out = mask; for (let pass = 0; pass < 2; pass++) { const row = new Float32Array(out.length), next = new Float32Array(out.length);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { let sum = 0, n = 0; for (let k = Math.max(0, x - feather); k <= Math.min(width - 1, x + feather); k++) { sum += out[y * width + k]!; n++; } row[y * width + x] = sum / n; }
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { let sum = 0, n = 0; for (let k = Math.max(0, y - feather); k <= Math.min(height - 1, y + feather); k++) { sum += row[k * width + x]!; n++; } next[y * width + x] = sum / n; }
    out = next; }
  return out;
}

/** The skirt's sheet: tiles a side, the feather in face pixels from the lobes' outline over which the sheet takes over
 * the picture, and the share of its reach over which it fades out at its rim. */
export const SKIRT_TILES = 12, SKIRT_OUTLINE_FEATHER_PIXELS = 6, SKIRT_RIM_FADE = 0.25;
/** The Gaussian, across the fan from -1 to 1, by which a skirt's sheets share its optical depth. */
export const SKIRT_LAYER_SIGMA = 0.5;

/**
 * A bipolar nebula's equatorial skirt (`geometry.surface.skirt`): a thin disc in the plane through the star across the
 * pole, the plane that parts the lobes. Steffen et al. (2014) find no H2 from it, so the published surface does not hold
 * it; the picture shows it outside the lobes, two flat fans either side of the waist. The sheet takes the picture where
 * it lies on the sky: where `cover` says (the skirt's drawn regions, over the lobes too), or else only outside the lobes'
 * outline (`crossings`, feathered over SKIRT_OUTLINE_FEATHER_PIXELS); and
 * clear of the star's glare (out to twice `starRadiusArcsec`), out to `reachArcsec` from the star, fading over its last
 * SKIRT_RIM_FADE. It is cut into SKIRT_TILES by SKIRT_TILES tiles so each sorts on its own against the lobes; a tile that
 * holds no light is left out. Each tile is returned as a parallelogram of the picture's place (column, row, depth in
 * arcseconds) with its texture over it, as the lobes' triangles are, with the whole box drawn.
 */
export function imageLayerSurfaceSkirt(surface: Surface, skirt: { reachArcsec: number; layers?: number; openingDeg?: number }, photo: Buffer, width: number, height: number, sky: (px: number, py: number) => readonly [number, number], crossings: SurfaceCrossings, cover?: Float32Array): SurfaceTriangle[] {
  const { place } = surfaceOnPicture(surface, width, height, sky), [ox, oy, oz] = surface.originUnits, reach = skirt.reachArcsec / surface.arcsecPerUnit, count = width * height;
  const arcsecPerPixel = Math.hypot(...sky(1, 0).map((value, k) => value - sky(0, 0)[k]!)), cellsPerUnit = surface.arcsecPerUnit / arcsecPerPixel;
  // How far each pixel is outside the lobes' outline, in pixels (a chamfer distance from the pixels the surface crosses).
  const outside = new Float32Array(count).fill(Infinity);
  for (let p = 0; p < count; p++) if (!Number.isNaN(crossings.depths[SURFACE_MOST_CROSSINGS * p]!)) outside[p] = 0;
  for (let pass = 0; pass < 2; pass++) for (let y = pass ? height - 1 : 0; pass ? y >= 0 : y < height; y += pass ? -1 : 1) for (let x = pass ? width - 1 : 0; pass ? x >= 0 : x < width; x += pass ? -1 : 1) {
    const p = y * width + x, d = pass ? 1 : -1; if (x - d >= 0 && x - d < width) outside[p] = Math.min(outside[p]!, outside[p - d]! + 1); if (y - d >= 0 && y - d < height) outside[p] = Math.min(outside[p]!, outside[p - d * width]! + 1); }
  const smooth = (t: number) => { const u = Math.max(0, Math.min(1, t)); return u * u * (3 - 2 * u); };
  const glare = 2 * (surface.starRadiusArcsec ?? 0);
  // The skirt's thickness: `layers` sheets fanning out from the star, `openingDeg` either side of the plane at their
  // farthest, the picture's optical depth shared among them by a Gaussian across the fan, most on the plane.
  const layers = Math.max(1, Math.round(skirt.layers ?? 1)), opening = Math.tan((skirt.openingDeg ?? 0) * Math.PI / 180);
  const spread = Array.from({ length: layers }, (_, k) => layers === 1 ? 0 : 2 * k / (layers - 1) - 1), raw = spread.map(t => Math.exp(-(t * t) / (2 * SKIRT_LAYER_SIGMA * SKIRT_LAYER_SIGMA))), total = raw.reduce((a, b) => a + b, 0), share = raw.map(w => w / total);
  const lift = (x: number, y: number, layer: number) => oz + spread[layer]! * opening * Math.hypot(x, y);
  // A point of a sheet (file units from the star along the file's x and y) as its texel: the picture where it lies on
  // the sky, kept where the skirt is, with the sheet's share of its optical depth.
  let layer = 0;
  const texel = (x: number, y: number, out: number[]) => { const [px, py] = place(ox + x, oy + y, lift(x, y, layer)), cx = Math.round(px), cy = Math.round(py), r = Math.hypot(x, y) / reach;
    if (cx < 0 || cy < 0 || cx >= width || cy >= height || r >= 1) { out[0] = out[1] = out[2] = out[3] = 0; return; } const p = cy * width + cx;
    const keep = (cover ? cover[p]! : smooth(outside[p]! / SKIRT_OUTLINE_FEATHER_PIXELS)) * smooth((1 - r) / SKIRT_RIM_FADE) * (glare > 0 ? smooth((Math.hypot(...sky(cx, cy)) - glare / 2) / (glare / 2)) : 1);
    for (let c = 0; c < 3; c++) out[c] = photo[4 * p + c]!; const a = Math.min(.998, photo[4 * p + 3]! / 255 * keep); out[3] = Math.round(255 * (1 - (1 - a) ** share[layer]!)); };
  const tiles: SurfaceTriangle[] = [], side = 2 * reach / SKIRT_TILES, cells = Math.max(2, Math.ceil(side * cellsPerUnit)), sample = [0, 0, 0, 0];
  for (layer = 0; layer < layers; layer++) for (let i = 0; i < SKIRT_TILES; i++) for (let j = 0; j < SKIRT_TILES; j++) {
    const x0 = -reach + i * side, y0 = -reach + j * side, rgba = Buffer.alloc(4 * cells * cells); let any = false;
    for (let row = 0; row < cells; row++) for (let column = 0; column < cells; column++) { texel(x0 + (column + .5) / cells * side, y0 + (row + .5) / cells * side, sample);
      const o = 4 * (row * cells + column); for (let c = 0; c < 4; c++) rgba[o + c] = sample[c]!; if (sample[3]! > 2) any = true; }
    if (!any) continue;
    tiles.push({ corners: [place(ox + x0, oy + y0, lift(x0, y0, layer)), place(ox + x0 + side, oy + y0, lift(x0 + side, y0, layer)), place(ox + x0, oy + y0 + side, lift(x0, y0 + side, layer))], texture: [cells, cells], rgba });
  }
  return tiles;
}
