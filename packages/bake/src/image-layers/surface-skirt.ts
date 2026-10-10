import type { ImageLayerRecipe } from './config.ts';
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

/** The skirt's sheet: tiles a side, the feather in face pixels from the lobes' outline over which the sheet takes over
 * the picture, and the share of its reach over which it fades out at its rim. */
export const SKIRT_TILES = 8, SKIRT_OUTLINE_FEATHER_PIXELS = 6, SKIRT_RIM_FADE = 0.25;

/**
 * A bipolar nebula's equatorial skirt (`geometry.surface.skirt`): a thin disc in the plane through the star across the
 * pole, the plane that parts the lobes. Steffen et al. (2014) find no H2 from it, so the published surface does not hold
 * it; the picture shows it outside the lobes, two flat fans either side of the waist. The sheet takes the picture where
 * it lies on the sky, only outside the lobes' outline (`crossings`, feathered over SKIRT_OUTLINE_FEATHER_PIXELS) and
 * clear of the star's glare (out to twice `starRadiusArcsec`), out to `reachArcsec` from the star, fading over its last
 * SKIRT_RIM_FADE. It is cut into SKIRT_TILES by SKIRT_TILES tiles so each sorts on its own against the lobes; a tile that
 * holds no light is left out. Each tile is returned as a parallelogram of the picture's place (column, row, depth in
 * arcseconds) with its texture over it, as the lobes' triangles are, with the whole box drawn.
 */
export function imageLayerSurfaceSkirt(surface: Surface, skirt: { reachArcsec: number }, photo: Buffer, width: number, height: number, sky: (px: number, py: number) => readonly [number, number], crossings: SurfaceCrossings): SurfaceTriangle[] {
  const { place } = surfaceOnPicture(surface, width, height, sky), [ox, oy, oz] = surface.originUnits, reach = skirt.reachArcsec / surface.arcsecPerUnit, count = width * height;
  const arcsecPerPixel = Math.hypot(...sky(1, 0).map((value, k) => value - sky(0, 0)[k]!)), cellsPerUnit = surface.arcsecPerUnit / arcsecPerPixel;
  // How far each pixel is outside the lobes' outline, in pixels (a chamfer distance from the pixels the surface crosses).
  const outside = new Float32Array(count).fill(Infinity);
  for (let p = 0; p < count; p++) if (!Number.isNaN(crossings.depths[SURFACE_MOST_CROSSINGS * p]!)) outside[p] = 0;
  for (let pass = 0; pass < 2; pass++) for (let y = pass ? height - 1 : 0; pass ? y >= 0 : y < height; y += pass ? -1 : 1) for (let x = pass ? width - 1 : 0; pass ? x >= 0 : x < width; x += pass ? -1 : 1) {
    const p = y * width + x, d = pass ? 1 : -1; if (x - d >= 0 && x - d < width) outside[p] = Math.min(outside[p]!, outside[p - d]! + 1); if (y - d >= 0 && y - d < height) outside[p] = Math.min(outside[p]!, outside[p - d * width]! + 1); }
  const smooth = (t: number) => { const u = Math.max(0, Math.min(1, t)); return u * u * (3 - 2 * u); };
  const glare = 2 * (surface.starRadiusArcsec ?? 0);
  // A point of the plane (file units from the star along the file's x and y) as its texel: the picture there, kept outside the lobes.
  const texel = (x: number, y: number, out: number[]) => { const [px, py] = place(ox + x, oy + y, oz), cx = Math.round(px), cy = Math.round(py), r = Math.hypot(x, y) / reach;
    if (cx < 0 || cy < 0 || cx >= width || cy >= height || r >= 1) { out[0] = out[1] = out[2] = out[3] = 0; return; } const p = cy * width + cx;
    const keep = smooth(outside[p]! / SKIRT_OUTLINE_FEATHER_PIXELS) * smooth((1 - r) / SKIRT_RIM_FADE) * (glare > 0 ? smooth((Math.hypot(...sky(cx, cy)) - glare / 2) / (glare / 2)) : 1);
    for (let c = 0; c < 3; c++) out[c] = photo[4 * p + c]!; out[3] = Math.round(photo[4 * p + 3]! * keep); };
  const tiles: SurfaceTriangle[] = [], side = 2 * reach / SKIRT_TILES, cells = Math.max(2, Math.ceil(side * cellsPerUnit)), sample = [0, 0, 0, 0];
  for (let i = 0; i < SKIRT_TILES; i++) for (let j = 0; j < SKIRT_TILES; j++) {
    const x0 = -reach + i * side, y0 = -reach + j * side, rgba = Buffer.alloc(4 * cells * cells); let any = false;
    for (let row = 0; row < cells; row++) for (let column = 0; column < cells; column++) { texel(x0 + (column + .5) / cells * side, y0 + (row + .5) / cells * side, sample);
      const o = 4 * (row * cells + column); for (let c = 0; c < 4; c++) rgba[o + c] = sample[c]!; if (sample[3]! > 2) any = true; }
    if (!any) continue;
    tiles.push({ corners: [place(ox + x0, oy + y0, oz), place(ox + x0 + side, oy + y0, oz), place(ox + x0, oy + y0 + side, oz)], texture: [cells, cells], rgba });
  }
  return tiles;
}
