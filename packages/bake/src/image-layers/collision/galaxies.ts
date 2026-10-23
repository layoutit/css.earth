import { openedLight } from './compact-sources.ts';

/** A nucleus is light that stands this far, of 255, over the mean light within `WIDE_ARCSEC` of it, both read after
 * smoothing over `SMOOTH_ARCSEC`: the bright middle of a galaxy, whatever the glow it sits in. */
const NUCLEUS = 24, SMOOTH_ARCSEC = .5, WIDE_ARCSEC = 2;
/** Compact light is a galaxy's from this far, of 255, over the light around it: the mark a compact source stands by
 * (./compact-sources.ts). Under it the light is the picture's grain and stays with the diffuse light. */
const FAINT = 16;
/** Seen from the side a galaxy is as deep either way as this many times the spread of its light on the sky about its
 * middle (a ball of even light has 1.6), and never under `LEAST_DEEP_ARCSEC`: a curtain cannot show less than a cell or two. */
const DEEP = 1.6, LEAST_DEEP_ARCSEC = 1.2;

/** A cluster's galaxies in depth (`geometry.ellipsoid.galaxies`). The photograph of a cluster holds its galaxies on one
 * plane; nothing measures how far along the sight line each one lies. A cluster's galaxies follow its mass, so here
 * each galaxy is put at a depth drawn once, by its place in the picture, from where the mass's shells put matter on its
 * sight line; the one nearest the shells' centre is put at their middle.
 *
 * A galaxy is a nucleus, a bright middle, with the photograph's compact light that is nearer to it than to another
 * nucleus; compact light is what stands `FAINT` or more over the light around it (the picture opened over `radius`).
 * Compact light with no nucleus to join is a source of its own. Seen from the Sun a galaxy is its own cut-out of the
 * photograph, as sharp as the photograph, on a sheet at its depth (`sheets`); seen from the side it is a blob at its
 * depth, in the curtains (`own`, `emission`). The rest, the cluster's diffuse light, is spread through the shells as the
 * mass is (`diffuse`). The photograph fades out toward the largest shell the frame holds whole, as the shells' own
 * picture does.
 *
 * The photograph (RGBA, straight color) leaves its plane whole: it is cleared, in place. */
export function imageLayerGalaxies(options: { photograph: Buffer; width: number; height: number;
  /** Half the width, in pixels, under which light is compact. */
  radius: number; pixelArcsec: number; binArcsec: number;
  /** A pixel's place on the sky, arcseconds east and north; taken as flat across the picture. */
  sky: (px: number, py: number) => [number, number];
  /** The shells: how much they emit at a place and depth, how far they reach, each pixel's share after their fade, and their centre's pixel. */
  shells: { emission: (east: number, north: number, depth: number) => number; reachArcsec: number; fade: Float32Array; centre: [number, number] } }) {
  const { photograph, width: W, height: H, shells, sky, pixelArcsec } = options, count = W * H, light = new Uint8Array(count);
  for (let p = 0; p < count; p++) light[p] = Math.round(photograph[4 * p + 3]! * shells.fade[p]!);
  // A galaxy's light: what stands `FAINT` or more over the light around, less that mark, so that it starts from nothing.
  const around = openedLight(light, W, H, options.radius), mine = new Uint8Array(count); for (let p = 0; p < count; p++) mine[p] = Math.max(0, light[p]! - around[p]! - FAINT);
  // The mean light within a reach, from a table of sums.
  const sums = new Float64Array((W + 1) * (H + 1)); for (let y = 0; y < H; y++) { let row = 0; for (let x = 0; x < W; x++) { row += light[y * W + x]!; sums[(y + 1) * (W + 1) + x + 1] = sums[y * (W + 1) + x + 1]! + row; } }
  const mean = (x: number, y: number, reach: number) => { const x0 = Math.max(0, x - reach), x1 = Math.min(W, x + reach + 1), y0 = Math.max(0, y - reach), y1 = Math.min(H, y + reach + 1); return (sums[y1 * (W + 1) + x1]! - sums[y0 * (W + 1) + x1]! - sums[y1 * (W + 1) + x0]! + sums[y0 * (W + 1) + x0]!) / ((x1 - x0) * (y1 - y0)); };
  const fine = Math.max(1, Math.round(SMOOTH_ARCSEC / pixelArcsec)), wide = Math.max(fine + 1, Math.round(WIDE_ARCSEC / pixelArcsec)), label = new Int32Array(count).fill(-1), steps4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const, front: number[] = [];
  const nuclear = (p: number) => mine[p]! > 0 && mean(p % W, Math.floor(p / W), fine) - mean(p % W, Math.floor(p / W), wide) >= NUCLEUS;
  // The nuclei, each a patch of nuclear pixels; then every pixel of galaxy light joins the nucleus nearest to it through
  // such pixels, the nuclei growing outward together a pixel at a time; then light no nucleus reached, each island a source of its own.
  const flood = (start: number, joins: (q: number) => boolean, id: number) => { label[start] = id; front.push(start); for (let k = front.length - 1; k < front.length; k++) { const p = front[k]!, x = p % W, y = (p - x) / W; for (const [i, j] of steps4) { const qx = x + i, qy = y + j, q = qy * W + qx; if (qx < 0 || qy < 0 || qx >= W || qy >= H || label[q] !== -1 || !joins(q)) continue; label[q] = id; front.push(q); } } };
  let sources = 0; for (let p = 0; p < count; p++) if (label[p] === -1 && nuclear(p)) flood(p, nuclear, sources++);
  const nuclei = sources; for (let k = 0; k < front.length; k++) { const p = front[k]!, x = p % W, y = (p - x) / W; for (const [i, j] of steps4) { const qx = x + i, qy = y + j, q = qy * W + qx; if (qx < 0 || qy < 0 || qx >= W || qy >= H || label[q] !== -1 || !mine[q]) continue; label[q] = label[p]!; front.push(q); } }
  for (let p = 0; p < count; p++) if (label[p] === -1 && mine[p]) flood(p, q => mine[q]! > 0, sources++);
  // Each source's middle, by its light: where the shells put matter on that sight line, and a place drawn from it.
  const middle = Array.from({ length: sources }, () => ({ sum: 0, x: 0, y: 0, spread: 0 })); for (let p = 0; p < count; p++) if (label[p]! >= 0) { const m = middle[label[p]!]!, weight = mine[p]!; m.sum += weight; m.x += weight * (p % W); m.y += weight * Math.floor(p / W); }
  for (const m of middle) { m.x /= m.sum; m.y /= m.sum; } for (let p = 0; p < count; p++) if (label[p]! >= 0) { const m = middle[label[p]!]!; m.spread += mine[p]! * ((p % W - m.x) ** 2 + (Math.floor(p / W) - m.y) ** 2); }
  const deep = Float32Array.from(middle, m => Math.max(LEAST_DEEP_ARCSEC, DEEP * Math.sqrt(m.spread / m.sum / 2) * pixelArcsec));
  const step = options.binArcsec / 2, steps = Math.ceil(2 * shells.reachArcsec / step), depths = new Float32Array(sources); let central = -1, nearest = Infinity;
  for (const [id, m] of middle.entries()) { const distance = Math.hypot(m.x - shells.centre[0], m.y - shells.centre[1]); if (id < nuclei && distance < nearest) { nearest = distance; central = id; } }
  for (const [id, m] of middle.entries()) { if (id === central) continue; const { x, y } = m, [east, north] = sky(x, y), along = new Float64Array(steps); let total = 0;
    for (let k = 0; k < steps; k++) { along[k] = shells.emission(east, north, -shells.reachArcsec + (k + .5) * step); total += along[k]!; }
    if (!(total > 0)) continue; const drawn = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1; let held = 0, k = 0; while (k < steps - 1 && held + along[k]! < drawn * total) held += along[k++]!;
    const most = Math.max(0, shells.reachArcsec - deep[id]!); depths[id] = Math.max(-most, Math.min(most, -shells.reachArcsec + (k + .5) * step)); }
  // For the curtains: each pixel's light by channel as optical depth, the compact part and the diffuse part.
  const own = [0, 1, 2].map(() => new Float32Array(count)), diffuse = [0, 1, 2].map(() => new Float32Array(count)); let ownPixels = 0, diffusePixels = 0, compact = 0, all = 0;
  for (let p = 0; p < count; p++) { if (!light[p]) continue; const rest = light[p]! - mine[p]!; compact += mine[p]!; all += light[p]!; if (mine[p]) ownPixels++; if (rest) diffusePixels++;
    for (let ch = 0; ch < 3; ch++) { const share = photograph[4 * p + ch]! / 255; own[ch]![p] = -Math.log(1 - Math.min(.998, share * mine[p]! / 255)); diffuse[ch]![p] = -Math.log(1 - Math.min(.998, share * rest / 255)); } }
  // A sky position's pixel: the frame is small enough for three of its corners to give it.
  const [e0, n0] = sky(0, 0), [ex, nx] = sky(W - 1, 0), [ey, ny] = sky(0, H - 1), a = (ex - e0) / (W - 1), b = (ey - e0) / (H - 1), c = (nx - n0) / (W - 1), d = (ny - n0) / (H - 1), det = a * d - b * c;
  /** A galaxy's light at a place and depth: about the galaxy's depth, as deep as the galaxy is wide, falling off as a ball's does. */
  const emission = (east: number, north: number, depth: number) => { const px = Math.max(0, Math.min(W - 1, Math.round((d * (east - e0) - b * (north - n0)) / det))), py = Math.max(0, Math.min(H - 1, Math.round((a * (north - n0) - c * (east - e0)) / det))), id = label[py * W + px]!;
    if (id < 0) return 0; const t = (depth - depths[id]!) / deep[id]!; return Math.abs(t) < 1 ? 1 - t * t : 0; };
  /** The galaxies as sheets at `stand.length` depths: each galaxy's compact light, its color and that light as opacity,
   * on the sheet nearest its depth. An empty sheet is left out. The photograph's own plane is cleared once the sheets are cut. */
  const sheets = (stand: readonly number[]) => { const sheet = Array.from(depths, depth => stand.reduce((best, at, k) => Math.abs(at - depth) < Math.abs(stand[best]! - depth) ? k : best, 0));
    const cut = stand.flatMap((depth, k) => { let left = W, top = H, right = -1, bottom = -1; const on = (p: number) => mine[p]! > 0 && sheet[label[p]!] === k;
      for (let p = 0; p < count; p++) if (on(p)) { const x = p % W, y = (p - x) / W; left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
      if (right < left) return []; const width = right - left + 1, height = bottom - top + 1, rgba = Buffer.alloc(4 * width * height);
      for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) { const p = y * W + x, o = 4 * ((y - top) * width + x - left); photograph.copy(rgba, o, 4 * p, 4 * p + 3); rgba[o + 3] = on(p) ? mine[p]! : 0; }
      return [{ depth, rgba, width, height, left, top }]; });
    return cut; };
  for (let p = 0; p < count; p++) photograph[4 * p + 3] = 0;
  return { own, diffuse, emission, sheets, galaxies: nuclei, islands: sources - nuclei, ownPixels, diffusePixels, compactShare: all > 0 ? compact / all : 0 };
}
