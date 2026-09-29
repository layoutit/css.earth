/** Milky Way stars in front of a galaxy photograph. The photograph is laid on the galaxy's inclined disc, so a round
 * foreground star becomes an ellipse stretched by 1 / cos(inclination) along the minor axis (4.6× for M31): round from
 * the Sun, a dash from anywhere else. Each catalogued foreground star is measured in the image and, where it shows,
 * replaced by the surrounding light before the layers are cut.
 *
 * Every size below is in pixels of the bake's face image (`bake.maxFacePixels`). */
const PEAK_SEARCH = 3;
// A star is at most this wide; anything still above its background further out is an extended object (M32's or NGC 205's
// core, a cluster or the bulge) and is left in the image. Only a star both saturated in the image and brighter than
// Gaia G = 14 may grow to the wider limit: every foreground star M31's photograph kept at the narrow limit was G <= 13.7,
// while the Gaia sources on M32's saturated core are G 16.8 and 17.8.
const MAX_RADIUS = 20, BRIGHT_MAX_RADIUS = 120, SATURATED = 240, BRIGHT_G = 14;
// Shows: the peak stands 5 background sigmas and 4 levels above the local background. Compact: unless saturated, its light
// 2 pixels out is at most half the peak's (a star is 2-3 pixels wide here; a galaxy's glow, such as NGC 205's, is not).
// Ends: the ring's mean is back within 1 sigma (or 2 levels) of the background, or no longer falls by a level over the
// next two pixels once below saturation (first tried over a quarter of its radius for a bright star, whose slow halo still counts as falling): on the disc's
// arms and dust lanes the far background is no measure of the light right around a star.
// Presentation choices, from the M31 face image.
const PEAK_SIGMAS = 5, PEAK_LEVELS = 4, COMPACT_RADIUS = 2, COMPACT_FRACTION = 0.5, EDGE_SIGMAS = 1, EDGE_LEVELS = 2, FLAT_LEVELS = 1, FLAT_STEP = 2, FLAT_FRACTION = 0.25;
// The mask reaches half the measured radius past the edge, so a bright star's faint wings go with it.
const MARGIN = 0.5, FILL_SAMPLES = 48;

export interface ForegroundRemoval { catalogued: number; inImage: number; removed: number; extended: number; radiusPx: { median: number; max: number } }

const median = (values: number[]): number => {
  if (!values.length) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b), middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

/** Replaces each foreground star that shows in `rgb` (packed 8-bit RGB, `width` × `height`) by an inverse-square blend of
 * the ring just outside it. `stars` are the catalogued stars' image positions in pixels (x right, y down) and Gaia G magnitudes. */
export function removeForegroundStars(rgb: Buffer, width: number, height: number, stars: readonly { x: number; y: number; gMag: number }[]): ForegroundRemoval {
  const luminance = new Float32Array(width * height);
  const lum = (p: number) => 0.2126 * rgb[3 * p]! + 0.7152 * rgb[3 * p + 1]! + 0.0722 * rgb[3 * p + 2]!;
  for (let p = 0; p < width * height; p++) luminance[p] = lum(p);
  const at = (x: number, y: number) => luminance[y * width + x]!;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;
  let inImage = 0, removed = 0, extended = 0;
  const radii: number[] = [];
  for (const { x: sx, y: sy, gMag } of stars) {
    const cx0 = Math.round(sx), cy0 = Math.round(sy);
    if (!inside(cx0, cy0)) continue;
    inImage++;
    // The brightest pixel near the catalogue position: the photograph's registration is good to a few pixels.
    let cx = cx0, cy = cy0;
    for (let dy = -PEAK_SEARCH; dy <= PEAK_SEARCH; dy++) for (let dx = -PEAK_SEARCH; dx <= PEAK_SEARCH; dx++) {
      if (dx * dx + dy * dy <= PEAK_SEARCH * PEAK_SEARCH && inside(cx0 + dx, cy0 + dy) && at(cx0 + dx, cy0 + dy) > at(cx, cy)) { cx = cx0 + dx; cy = cy0 + dy; }
    }
    // Rings are measured on the part of them inside the image, so a star at the edge is measured on its inner side.
    const ring = (from: number, to: number) => {
      const values: number[] = [];
      for (let dy = -Math.ceil(to); dy <= Math.ceil(to); dy++) for (let dx = -Math.ceil(to); dx <= Math.ceil(to); dx++) {
        const d = Math.hypot(dx, dy);
        if (d >= from && d < to && inside(cx + dx, cy + dy)) values.push(at(cx + dx, cy + dy));
      }
      return values;
    };
    // Whether it shows is judged against the light just outside a star's narrow limit; where a bright star's halo ends,
    // against the light outside its wide one.
    const backgroundOf = (limit: number) => {
      const annulus = ring(limit + 2, limit + 8), level = median(annulus);
      return { level, sigma: 1.4826 * median(annulus.map(value => Math.abs(value - level))) };
    };
    const near = backgroundOf(MAX_RADIUS);
    if (!Number.isFinite(near.level) || at(cx, cy) - near.level < Math.max(PEAK_SIGMAS * near.sigma, PEAK_LEVELS)) continue;
    const limit = at(cx, cy) >= SATURATED && gMag < BRIGHT_G ? BRIGHT_MAX_RADIUS : MAX_RADIUS;
    const { level: background, sigma } = limit === MAX_RADIUS ? near : backgroundOf(limit);
    const mean = (r: number) => { const values = ring(r - 0.5, r + 0.5); return values.reduce((a, b) => a + b, 0) / values.length; };
    if (at(cx, cy) < SATURATED && mean(COMPACT_RADIUS) - near.level > COMPACT_FRACTION * (at(cx, cy) - near.level)) { extended++; continue; }
    const edgeAt = (step: (r: number) => number) => {
      for (let r = 1; r <= limit; r++) {
        const here = mean(r);
        if (!(here - background > Math.max(EDGE_SIGMAS * sigma, EDGE_LEVELS)) || (here < SATURATED && here - mean(r + step(r)) < FLAT_LEVELS)) return r;
      }
      return 0;
    };
    // A bright star measured with the long step first; on the disc, where its halo never flattens that way, the short one.
    const radius = (limit === BRIGHT_MAX_RADIUS ? edgeAt(r => Math.max(FLAT_STEP, Math.round(r * FLAT_FRACTION))) : 0) || edgeAt(() => FLAT_STEP);
    if (!radius) { extended++; continue; }
    const mask = Math.ceil(radius * (1 + MARGIN)), edge = mask + 1.5;
    const samples = Array.from({ length: FILL_SAMPLES }, (_, k) => {
      const angle = 2 * Math.PI * k / FILL_SAMPLES, x = Math.round(cx + edge * Math.cos(angle)), y = Math.round(cy + edge * Math.sin(angle)), p = 3 * (y * width + x);
      return inside(x, y) ? [{ x, y, colour: [rgb[p]!, rgb[p + 1]!, rgb[p + 2]!], light: at(x, y) }] : [];
    }).flat();
    // A neighbouring star crossing the ring would be smeared into the fill: samples far above the ring's median are left out.
    const ringMedian = median(samples.map(sample => sample.light)), ringSigma = 1.4826 * median(samples.map(sample => Math.abs(sample.light - ringMedian)));
    const fill = samples.filter(sample => sample.light - ringMedian <= Math.max(PEAK_SIGMAS * ringSigma, PEAK_LEVELS));
    for (let dy = -mask; dy <= mask; dy++) for (let dx = -mask; dx <= mask; dx++) {
      if (dx * dx + dy * dy > mask * mask || !inside(cx + dx, cy + dy)) continue;
      const x = cx + dx, y = cy + dy, p = y * width + x, colour = [0, 0, 0];
      let total = 0;
      for (const sample of fill) {
        const weight = 1 / ((sample.x - x) ** 2 + (sample.y - y) ** 2);
        total += weight; for (let c = 0; c < 3; c++) colour[c]! += weight * sample.colour[c]!;
      }
      for (let c = 0; c < 3; c++) rgb[3 * p + c] = Math.round(colour[c]! / total);
      luminance[p] = lum(p);
    }
    removed++; radii.push(mask);
  }
  return { catalogued: stars.length, inImage, removed, extended, radiusPx: { median: radii.length ? median(radii) : 0, max: radii.length ? Math.max(...radii) : 0 } };
}

/** A companion galaxy in front of or beside the photographed one (M32, NGC 205 for M31), as its catalogue centre and
 * half-light ellipse on the image: centre in pixels, half-light semi-major axis in pixels, axis ratio, and the major
 * axis as a unit vector in pixels (x right, y down). */
export interface CompanionEllipse { x: number; y: number; halfLightPx: number; axisRatio: number; major: [number, number] }
// Its glow is followed outwards on elliptical rings, a tenth of a half-light radius apart, up to this many half-light
// radii, and ends by the stars' rules above. Presentation choices, from the M31 face image.
const COMPANION_MAX_HALF_LIGHT = 8, COMPANION_STEP = 0.1;

/** Replaces each companion galaxy's glow by an inverse-square blend of the light on the ellipse just outside it. */
export function removeCompanionGalaxies(rgb: Buffer, width: number, height: number, companions: readonly CompanionEllipse[]): { extentHalfLight: number[] } {
  const lum = (p: number) => 0.2126 * rgb[3 * p]! + 0.7152 * rgb[3 * p + 1]! + 0.0722 * rgb[3 * p + 2]!;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;
  const extents: number[] = [];
  for (const galaxy of companions) {
    const [mx, my] = galaxy.major, reach = Math.ceil(galaxy.halfLightPx * (COMPANION_MAX_HALF_LIGHT + 2));
    // Elliptical radius in half-light radii of a pixel offset.
    const radius = (dx: number, dy: number) => Math.hypot(dx * mx + dy * my, (-dx * my + dy * mx) / galaxy.axisRatio) / galaxy.halfLightPx;
    const rings = new Map<number, number[]>();
    const cx = Math.round(galaxy.x), cy = Math.round(galaxy.y);
    for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
      if (!inside(cx + dx, cy + dy)) continue;
      const ring = Math.round(radius(dx, dy) / COMPANION_STEP);
      if (ring > (COMPANION_MAX_HALF_LIGHT + 1) / COMPANION_STEP) continue;
      const list = rings.get(ring) ?? []; list.push(lum((cy + dy) * width + cx + dx)); rings.set(ring, list);
    }
    const mean = (ring: number) => { const list = rings.get(ring) ?? []; return list.length ? list.reduce((a, b) => a + b, 0) / list.length : Number.NaN; };
    const outer = [...rings.keys()].filter(ring => ring * COMPANION_STEP > COMPANION_MAX_HALF_LIGHT).flatMap(ring => rings.get(ring)!);
    const background = median(outer), sigma = 1.4826 * median(outer.map(value => Math.abs(value - background)));
    let edge = COMPANION_MAX_HALF_LIGHT;
    for (let ring = 1; ring * COMPANION_STEP <= COMPANION_MAX_HALF_LIGHT; ring++) {
      const r = ring * COMPANION_STEP, step = Math.max(1, Math.round(ring * FLAT_FRACTION)), here = mean(ring);
      if (!(here - background > Math.max(EDGE_SIGMAS * sigma, EDGE_LEVELS)) || (here < SATURATED && here - mean(ring + step) < FLAT_LEVELS * step * COMPANION_STEP * galaxy.halfLightPx / FLAT_STEP)) { edge = r; break; }
    }
    const mask = edge * (1 + MARGIN), fillAt = mask + 2 / galaxy.halfLightPx;
    const samples = Array.from({ length: FILL_SAMPLES * 2 }, (_, k) => {
      const angle = Math.PI * k / FILL_SAMPLES, a = fillAt * galaxy.halfLightPx * Math.cos(angle), b = fillAt * galaxy.halfLightPx * galaxy.axisRatio * Math.sin(angle);
      const x = Math.round(galaxy.x + a * mx - b * my), y = Math.round(galaxy.y + a * my + b * mx), p = y * width + x;
      return inside(x, y) ? [{ x, y, colour: [rgb[3 * p]!, rgb[3 * p + 1]!, rgb[3 * p + 2]!] }] : [];
    }).flat();
    for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
      const x = cx + dx, y = cy + dy;
      if (!inside(x, y) || radius(dx, dy) > mask) continue;
      const colour = [0, 0, 0]; let total = 0;
      for (const sample of samples) { const weight = 1 / ((sample.x - x) ** 2 + (sample.y - y) ** 2 + 1); total += weight; for (let c = 0; c < 3; c++) colour[c]! += weight * sample.colour[c]!; }
      for (let c = 0; c < 3; c++) rgb[3 * (y * width + x) + c] = Math.round(colour[c]! / total);
    }
    extents.push(Number(mask.toFixed(2)));
  }
  return { extentHalfLight: extents };
}
