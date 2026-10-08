/** The bright stars NOX leaves, with their diffraction spikes. NOX takes a star whose core is a few pixels wide; a
 * saturated star keeps its core and, in a Webb picture, its six spikes, which reach hundreds of pixels across the
 * picture. Neither is the nebula's light.
 *
 * Found: a star is a bright place whose light runs out along the spikes' directions and not between them. The
 * directions are the telescope's, the same for every star of a picture: they are measured on the picture, as the
 * angles where the light around its brightest stars stands highest (`spikeAngles`), not assumed.
 *
 * Removed, per star and spike: the spike's light is what stands above the light either side of it, across the spike.
 * Along the spike, each pixel of its band takes the line between the medians of the two flanks beside it, where that is
 * darker and the light it loses is a star's color (its red no more than `redOverBlue` of its blue: in Cassiopeia A's
 * picture a star is blue and the ejecta red). A spike ends where it no longer stands above its flanks over `END_RUN`
 * pixels. A spike is wider near the core: there its band reaches out, either side, to where its light comes within
 * `END_LEVELS` of the light just past it, up to `BAND_WIDTHS` of its width farther out.
 *
 * The core and its glow are the light that stands round the star alike in every direction: each ring's median, per
 * channel, above the median of the ring where the glow ends (where a ring stands less than `GLOW_LEVELS` above the ring
 * `GLOW_GAP` pixels farther out, and no farther than `GLOW_MOST`; past `GLOW_CORES` core radii only while that fall is a
 * star's color: round a star on the remnant's whitish gas, the rings' fall is the gas's own). That excess is taken from every pixel of the disc,
 * where it is a star's color, so the gas under the glow keeps its own structure: a fill from the ring around it smoothed
 * the remnant's gas into a flat disc. Where a ring stands below the glow's end, NOX hollowed the core: that is given back.
 *
 * A Webb star has six bright spikes on three lines and two faint ones on a fourth; a star is a bright place with at
 * least `LINES_SEEN` of its lines standing above the light between them.
 *
 * Presentation choices, from Cassiopeia A's ESA/Webb NIRCam picture: every constant below. */

/** A star's core: blue at least `CORE_BLUE` and green at least `CORE_GREEN` (a saturated star is white to blue; the
 * ejecta's bright knots are red); its spikes standing at least `SPIKE_LEVELS` above the light between them. */
const CORE_BLUE = 235, CORE_GREEN = 215, SPIKE_LEVELS = 12;
/** The glow: see above. */
const GLOW_LEVELS = 3, GLOW_GAP = 12, GLOW_MOST = 90, GLOW_CORES = 3, RING_SAMPLES = 96, BAND_WIDTHS = 3, LINES_SEEN = 3;
/** The spikes are measured from `SPIKE_FROM` to `SPIKE_TO` pixels out, where the core's own glow is past. */
const SPIKE_FROM = 18, SPIKE_TO = 70;
/** A star's core: the saturated place's radius and `CORE_MARGIN` past it. There its light is all the star's, whatever its color (a saturated core is white). */
const CORE_MARGIN = 6;
/** The band a spike's light lies in, either side of its line, at most; its flanks are the `FLANK` pixels just past it. */
const MAX_HALF_WIDTH = 9, FLANK = 4;
/** A spike's height is the running median of its centre over `ALONG` pixels either side. */
const ALONG = 20;
/** A spike ends where it stands less than `END_LEVELS` above its flanks over `END_RUN` pixels, or at `MAX_LENGTH`. */
const END_LEVELS = 3, END_RUN = 24, MAX_LENGTH = 1600;
/** Two stars nearer than this are one. */
const SEPARATION = 24;

export interface SpikeStar { x: number; y: number; strength: number; coreRadius: number; halfWidth: number; lengths: number[]; glowRadius?: number }
export interface SpikeRemoval { angles: number[]; stars: SpikeStar[]; spikePixels: number; corePixels: number }

const median = (values: number[]) => { values.sort((a, b) => a - b); return values[values.length >> 1] ?? 0; };

/** The spikes' directions, in degrees counterclockwise from the picture's +x with y up, in [0, 180): the lines through
 * the brightest stars' cores where the light 18 to 70 px out stands highest, `count` of them, at least 20° apart. */
export function spikeAngles(rgb: Uint8Array, width: number, height: number, cores: readonly { x: number; y: number }[], count: number): number[] {
  const profile = new Float64Array(360);
  for (const core of cores) for (let a = 0; a < 360; a++) {
    const t = a * Math.PI / 180, values: number[] = [];
    for (let r = SPIKE_FROM; r <= SPIKE_TO; r++) { const x = Math.round(core.x + r * Math.cos(t)), y = Math.round(core.y - r * Math.sin(t)); if (x >= 0 && y >= 0 && x < width && y < height) values.push(rgb[(y * width + x) * 3 + 2]!); }
    profile[a] += median(values);
  }
  // A line is both its directions.
  const line = Array.from({ length: 180 }, (_, a) => profile[a]! + profile[a + 180]!), chosen: number[] = [];
  for (const a of [...line.keys()].sort((i, j) => line[j]! - line[i]!)) { if (chosen.every(b => Math.min(Math.abs(a - b), 180 - Math.abs(a - b)) >= 20)) chosen.push(a); if (chosen.length === count) break; }
  return chosen.sort((a, b) => a - b);
}

/** Removes, in place, from `rgb` (NOX's star-free picture, packed 8-bit RGB) the bright stars that carry spikes, and
 * their spikes. The stars are found on `original`, the picture before NOX: NOX hollows a bright star's core and leaves
 * a dark middle in its spikes. `lines` is how many spike lines a star has (a Webb star: 3, six spikes). */
export function removeSpikedStars(rgb: Uint8Array, original: Uint8Array, width: number, height: number, lines: number, redOverBlue: number): SpikeRemoval {
  if (rgb.length !== width * height * 3 || original.length !== rgb.length) throw new TypeError(`The pictures are not ${width} x ${height} packed RGB.`);
  const at = (x: number, y: number, c: number) => rgb[(y * width + x) * 3 + c]!, before = (x: number, y: number, c: number) => original[(y * width + x) * 3 + c]!;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;
  // Bright cores: connected places at the core level, by their light-weighted middle.
  const seen = new Uint8Array(width * height), cores: { x: number; y: number; area: number }[] = [];
  const bright = (p: number) => original[3 * p + 2]! >= CORE_BLUE && original[3 * p + 1]! >= CORE_GREEN;
  for (let p = 0; p < width * height; p++) {
    if (seen[p] || !bright(p)) continue;
    const queue = [p]; seen[p] = 1; let n = 0, sx = 0, sy = 0;
    while (queue.length) { const q = queue.pop()!, qx = q % width, qy = (q - qx) / width; n++; sx += qx; sy += qy;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = qx + dx, ny = qy + dy, np = ny * width + nx; if (inside(nx, ny) && !seen[np] && bright(np)) { seen[np] = 1; queue.push(np); } } }
    cores.push({ x: sx / n, y: sy / n, area: n });
  }
  cores.sort((a, b) => b.area - a.area);
  const angles = spikeAngles(original, width, height, cores.slice(0, 8), lines);
  const rays = angles.flatMap(a => [a, a + 180]).map(a => a * Math.PI / 180);
  const between = angles.map((a, i) => (a + ((angles[(i + 1) % angles.length]! + (i + 1 === angles.length ? 180 : 0)) - a) / 2)).flatMap(a => [a, a + 180]).map(a => a * Math.PI / 180);
  const rayLight = (x: number, y: number, t: number, c = 2) => { const values: number[] = []; for (let r = SPIKE_FROM; r <= SPIKE_TO; r++) { const px = Math.round(x + r * Math.cos(t)), py = Math.round(y - r * Math.sin(t)); if (inside(px, py)) values.push(before(px, py, c)); } return values.length ? median(values) : 0; };
  // A star: its spikes stand above the light between them, on every line.
  const stars: SpikeStar[] = [];
  for (const core of cores) {
    if (stars.some(star => Math.hypot(star.x - core.x, star.y - core.y) < SEPARATION)) continue;
    const along = rays.map(t => rayLight(core.x, core.y, t)), across = median(between.map(t => rayLight(core.x, core.y, t)));
    const lineLight = angles.map((_, i) => Math.min(along[2 * i]!, along[2 * i + 1]!) - across).sort((a, b) => b - a);
    if (!(lineLight[Math.min(LINES_SEEN, lineLight.length) - 1]! >= SPIKE_LEVELS)) continue;
    stars.push({ x: core.x, y: core.y, strength: lineLight[0]!, coreRadius: Math.round(Math.sqrt(core.area / Math.PI)) + CORE_MARGIN, halfWidth: 0, lengths: [] });
  }
  let spikePixels = 0;
  const loss = new Float32Array(rgb.length);
  for (const star of stars) {
    // The band: out from the line until the light across the spike, 30 px out, falls to a quarter of its height.
    const t0 = rays[0]!, ux = Math.cos(t0), uy = -Math.sin(t0), nx = -uy, ny = ux, cx = star.x + 30 * ux, cy = star.y + 30 * uy;
    const acrossAt = (d: number) => { const x = Math.round(cx + d * nx), y = Math.round(cy + d * ny); return inside(x, y) ? at(x, y, 2) : 0; };
    const peak = acrossAt(0), floor = Math.min(acrossAt(-MAX_HALF_WIDTH - FLANK), acrossAt(MAX_HALF_WIDTH + FLANK));
    let half = 1; while (half < MAX_HALF_WIDTH && Math.max(acrossAt(half), acrossAt(-half)) - floor > (peak - floor) / 4) half++;
    star.halfWidth = half + 1;
    for (const t of rays) {
      const ux = Math.cos(t), uy = -Math.sin(t), nx = -uy, ny = ux; let quiet = 0, r = star.coreRadius;
      // First the spike as measured: at each step out, its band and the light standing above the line between its flanks.
      const steps: { bx: number; by: number; w: number; left: number[]; right: number[]; centre: number[] }[] = [];
      for (; r < MAX_LENGTH && quiet < END_RUN; r++) {
        const bx = star.x + r * ux, by = star.y + r * uy;
        if (!inside(Math.round(bx), Math.round(by))) break;
        // The band's half width here: out, on either side, to where the blue comes within END_LEVELS of the light just past it.
        const blueAt = (d: number) => { const x = Math.round(bx + d * nx), y = Math.round(by + d * ny); return inside(x, y) ? at(x, y, 2) : 0; };
        const reach = (side: number) => { let d = star.halfWidth; while (d < BAND_WIDTHS * star.halfWidth) { const past = median(Array.from({ length: FLANK }, (_, k) => blueAt(side * (d + 1 + k)))); if (blueAt(side * d) - past < END_LEVELS) break; d++; } return d; };
        const w = Math.max(reach(-1), reach(1));
        // The flanks' medians, per channel, and the line between them across the band.
        const flank = (side: number) => [0, 1, 2].map(c => { const values: number[] = []; for (let d = w + 1; d <= w + FLANK; d++) { const x = Math.round(bx + side * d * nx), y = Math.round(by + side * d * ny); if (inside(x, y)) values.push(at(x, y, c)); } return values.length ? median(values) : Number.NaN; });
        const left = flank(-1), right = flank(1);
        if (left.some(Number.isNaN) || right.some(Number.isNaN)) break;
        const centre = [0, 1, 2].map(c => median([-1, 0, 1].map(d => { const x = Math.round(bx + d * nx), y = Math.round(by + d * ny); return at(x, y, c) - (left[c]! + right[c]!) / 2; })));
        steps.push({ bx, by, w, left, right, centre });
        quiet = centre[2]! < END_LEVELS ? quiet + 1 : 0;
      }
      // The spike's own height along it, per channel: the running median of its centre's light, so a filament it crosses,
      // brighter than the spike, stays (a spike's color changes along it: Webb's spikes are dispersed). A spike whose red
      // stands higher than `redOverBlue` of its blue over its length is not a star's.
      const height = [0, 1, 2].map(c => { const light = steps.map(step => Math.max(0, step.centre[c]!)); return light.map((_, i) => median(light.slice(Math.max(0, i - ALONG), i + ALONG + 1))); });
      if (median([...height[0]!]) > redOverBlue * median([...height[2]!]) + END_LEVELS) { star.lengths.push(0); continue; }
      // Then each band pixel loses no more than the spike's height there, across its band as a bell `w` / 2 wide.
      // Sampled every half pixel along and across, so a slanted band misses no pixel; each pixel keeps its largest loss.
      steps.forEach((step, i) => {
        const sigma = Math.max(1, step.w / 2);
        for (const half of [0, 0.5]) for (let d = -step.w; d <= step.w; d += 0.5) {
          const x = Math.round(step.bx + half * ux + d * nx), y = Math.round(step.by + half * uy + d * ny); if (!inside(x, y)) continue;
          const f = (d + step.w + 1) / (2 * step.w + 2), bell = Math.exp(-0.5 * (d / sigma) ** 2), p = (y * width + x) * 3;
          for (let c = 0; c < 3; c++) { const lost = Math.min(Math.max(0, rgb[p + c]! - (step.left[c]! + (step.right[c]! - step.left[c]!) * f)), bell * height[c]![i]!); if (lost > loss[p + c]!) loss[p + c] = lost; }
        }
      });
      star.lengths.push(r);
    }
  }
  for (let p = 0; p < width * height; p++) { if (loss[3 * p]! + loss[3 * p + 1]! + loss[3 * p + 2]! <= 0) continue; for (let c = 0; c < 3; c++) rgb[3 * p + c] = Math.round(rgb[3 * p + c]! - loss[3 * p + c]!); spikePixels++; }
  // The cores and their glow: the light that stands round each star alike in every direction.
  let corePixels = 0;
  const ring = (x: number, y: number, radius: number, c: number) => { const values: number[] = []; for (let i = 0; i < RING_SAMPLES; i++) { const t = 2 * Math.PI * i / RING_SAMPLES, px = Math.round(x + radius * Math.cos(t)), py = Math.round(y - radius * Math.sin(t)); if (inside(px, py)) values.push(at(px, py, c)); } return values.length ? median(values) : 0; };
  for (const star of stars) {
    // The glow ends where a ring no longer stands above the ring past it, after the brightest ring (NOX hollows the core).
    const profile = (radius: number) => [0, 1, 2].map(c => ring(star.x, star.y, radius, c));
    let radius = 1, brightest = 0, most = -1; for (let r = 0; r <= star.coreRadius + SPIKE_FROM; r++) { const light = profile(r)[2]!; if (light > most) { most = light; brightest = r; } }
    radius = Math.max(brightest, star.coreRadius); const nearCore = GLOW_CORES * star.coreRadius;
    for (; radius < GLOW_MOST; radius++) {
      const drop = profile(radius).map((light, c) => light - ring(star.x, star.y, radius + GLOW_GAP, c));
      if (!drop.some(value => value >= GLOW_LEVELS)) break;
      // Past a few core radii the glow goes on only while its fall is a star's color: round a star on the gas, the rest is the gas's own.
      if (radius >= nearCore && !(drop[2]! >= GLOW_LEVELS && drop[0]! <= redOverBlue * drop[2]!)) break;
    }
    const floor = profile(radius), excess = Array.from({ length: radius + 1 }, (_, r) => profile(r).map((light, c) => light - floor[c]!));
    for (let y = Math.floor(star.y - radius); y <= Math.ceil(star.y + radius); y++) for (let x = Math.floor(star.x - radius); x <= Math.ceil(star.x + radius); x++) {
      const r = Math.hypot(x - star.x, y - star.y); if (!inside(x, y) || r > radius) continue;
      const i = Math.min(radius - 1, Math.floor(r)), f = r - i, lost = [0, 1, 2].map(c => (1 - f) * excess[i]![c]! + f * excess[i + 1]![c]!);
      // Where the rings stand below the glow's end, NOX hollowed them: that is given back, whatever its color, as is the core.
      const hollow = lost[2]! < 0;
      if (lost[2]! === 0 || (!hollow && r > star.coreRadius && lost[0]! > redOverBlue * lost[2]! + END_LEVELS)) continue;
      const p = (y * width + x) * 3; for (let c = 0; c < 3; c++) rgb[p + c] = Math.round(Math.max(0, Math.min(255, rgb[p + c]! - lost[c]!))); corePixels++;
    }
    star.glowRadius = radius;
  }
  return { angles, stars, spikePixels, corePixels };
}
