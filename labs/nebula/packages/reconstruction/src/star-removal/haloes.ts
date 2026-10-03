/** The haloes NOX leaves. NOX takes a star's core and spikes out of a picture but leaves the wide glow of a bright one.
 * Each catalogued bright star's glow is measured on the picture and filled from the ring just outside it.
 *
 * Measured: the glow's radius, per star. Each ring's median, per channel, is taken over the half of the ring that faces
 * away from the picture's centre (the target's own light falls off that way, so it does not read as glow). NOX can hollow
 * a bright star's centre and leave a ring, so the search starts at the brightest ring within `PEAK_SEARCH` pixels; the glow
 * ends at the first radius from there where no channel still falls by `FLAT_LEVELS` over the next `LOOK_AHEAD` pixels. A wider
 * search (fainter stars, or a test against the light further out) ran through the target's own light on M66 and M63 and
 * smeared their discs, so the measure stays this narrow and a level plateau NOX leaves is kept as it is.
 * Presentation choices, from M66's Sloan picture: every constant below. */
const STEP = 2, LOOK_AHEAD = 12, FLAT_LEVELS = 1.5, FIRST_RADIUS = 6, PEAK_SEARCH = 40, MARGIN = 1.15, RING = 1.12, RING_SAMPLES = 64, PATCH = 2, EDGE = 0.2;
/** A glow may reach this fraction of the picture's width, and no closer to the picture's centre than a tenth of the star's distance from it. */
const MAX_WIDTH_FRACTION = 0.15, MAX_DISTANCE_FRACTION = 0.9;
/** A star whose light at its position stands less than this above the light past its glow has nothing left to fill. */
const LEFT_LEVELS = 3;

export interface HaloStar { id: string; x: number; y: number; gMag: number }
export interface HaloRemoval { id: string; gMag: number; outcome: 'filled' | 'nothing-left' | 'no-end' | 'at-the-edge'; radiusPx?: number }

const median = (values: number[]): number => { values.sort((a, b) => a - b); return values[values.length >> 1] ?? Number.NaN; };

/** Fills, in place, the glow NOX left around each star of `stars` (brightest first) in `rgb` (packed 8-bit RGB). `centre`
 * is the target's place in the picture, in pixels. Returns what was done to each star. */
export function removeStarHaloes(rgb: Uint8Array, width: number, height: number, stars: readonly HaloStar[], centre: readonly [number, number]): HaloRemoval[] {
  if (rgb.length !== width * height * 3) throw new TypeError(`The picture is not ${width} x ${height} packed RGB.`);
  const inside = (x: number, y: number) => x >= PATCH && y >= PATCH && x < width - PATCH && y < height - PATCH;
  const patch = (x: number, y: number, channel: number) => {
    const values: number[] = [];
    for (let dy = -PATCH; dy <= PATCH; dy++) for (let dx = -PATCH; dx <= PATCH; dx++) values.push(rgb[((Math.round(y) + dy) * width + Math.round(x) + dx) * 3 + channel]!);
    return median(values);
  };
  return [...stars].sort((a, b) => a.gMag - b.gMag).map(star => {
    const report = { id: star.id, gMag: star.gMag };
    if (!inside(star.x, star.y)) return { ...report, outcome: 'at-the-edge' as const };
    const away = Math.atan2(star.y - centre[1], star.x - centre[0]), distance = Math.hypot(star.x - centre[0], star.y - centre[1]);
    const ringMedian = (radius: number) => [0, 1, 2].map(channel => {
      const values: number[] = [], samples = Math.max(24, Math.round(Math.PI * radius));
      for (let i = 0; i < samples; i++) {
        const angle = away + (i / (samples - 1) - 0.5) * Math.PI, x = Math.round(star.x + Math.cos(angle) * radius), y = Math.round(star.y + Math.sin(angle) * radius);
        if (inside(x, y)) values.push(rgb[(y * width + x) * 3 + channel]!);
      }
      return values.length > 8 ? median(values) : Number.NaN;
    });
    const limit = Math.min(Math.round(MAX_WIDTH_FRACTION * width), Math.round(MAX_DISTANCE_FRACTION * distance));
    // The brightest ring, by the mean of its three channel medians: a red glow counts as much as a white one.
    const brightness = (ring: number[]) => (ring[0]! + ring[1]! + ring[2]!) / 3;
    let start = FIRST_RADIUS, peak = brightness(ringMedian(FIRST_RADIUS));
    for (let radius = FIRST_RADIUS + STEP; radius <= Math.min(PEAK_SEARCH, limit); radius += STEP) { const value = brightness(ringMedian(radius)); if (value > peak) { peak = value; start = radius; } }
    let end = 0;
    for (let radius = start; radius < limit; radius += STEP) {
      const here = ringMedian(radius), ahead = ringMedian(radius + LOOK_AHEAD);
      if (here.some(Number.isNaN) || ahead.some(Number.isNaN)) break;
      if (here.every((value, channel) => value - ahead[channel]! <= FLAT_LEVELS)) { end = radius; break; }
    }
    if (!end) return { ...report, outcome: 'no-end' as const };
    const past = brightness(ringMedian(end + LOOK_AHEAD)), i = (Math.round(star.y) * width + Math.round(star.x)) * 3, centreLight = (rgb[i]! + rgb[i + 1]! + rgb[i + 2]!) / 3;
    if (end <= FIRST_RADIUS && Math.max(centreLight, peak) - past < LEFT_LEVELS) return { ...report, outcome: 'nothing-left' as const };
    const radius = Math.round(end * MARGIN), ring: { x: number; y: number; value: number[] }[] = [];
    for (let i = 0; i < RING_SAMPLES; i++) {
      const angle = i / RING_SAMPLES * 2 * Math.PI, x = star.x + Math.cos(angle) * radius * RING, y = star.y + Math.sin(angle) * radius * RING;
      if (inside(x, y)) ring.push({ x, y, value: [0, 1, 2].map(channel => patch(x, y, channel)) });
    }
    if (ring.length < RING_SAMPLES / 4) return { ...report, outcome: 'at-the-edge' as const };
    // Each pixel inside takes the ring's light, weighted by the inverse square of its distance to each ring sample, and
    // blends back to the picture over the outer fifth of the radius.
    for (let y = Math.max(0, Math.floor(star.y - radius)); y <= Math.min(height - 1, Math.ceil(star.y + radius)); y++) for (let x = Math.max(0, Math.floor(star.x - radius)); x <= Math.min(width - 1, Math.ceil(star.x + radius)); x++) {
      const fromStar = Math.hypot(x - star.x, y - star.y);
      if (fromStar >= radius) continue;
      let total = 0; const sum = [0, 0, 0];
      for (const sample of ring) { const weight = 1 / ((sample.x - x) ** 2 + (sample.y - y) ** 2); total += weight; for (let channel = 0; channel < 3; channel++) sum[channel]! += weight * sample.value[channel]!; }
      const blend = Math.min(1, (radius - fromStar) / (radius * EDGE)), i = (y * width + x) * 3;
      for (let channel = 0; channel < 3; channel++) rgb[i + channel] = Math.round(rgb[i + channel]! + blend * (sum[channel]! / total - rgb[i + channel]!));
    }
    return { ...report, outcome: 'filled' as const, radiusPx: radius };
  });
}
