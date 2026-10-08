/** The drawing boundary of a picture faded on a shell's measured rim (`geometry.fadeAt: "outline"`): a rounded, cloud-shaped
 * line about the star that sits inside the picture's frame everywhere, so neither the frame's corners nor its straight
 * edges show, and nothing past it (a light echo, a detector edge) is drawn. */

/** Where a picture faded on its outline stops (`geometry.fadeOutline`). */
export type FadeOutline = {
  /** How far the measured rim is pushed outward: its radius in each direction times this. */
  outward: number;
  /** How wide the fade inside the boundary is, in arcseconds. */
  featherArcsec: number;
  /** How far inside the frame's border the boundary stays, at the least, in arcseconds. */
  frameMarginArcsec: number;
  /** Over how many degrees either side of a direction the boundary is rounded. */
  smoothDeg: number;
  /** Where the picture's light fills only part of its frame (a mosaic laid square in a rectangle, its empty part black):
   * that part's corners in the source picture's pixels (x right, y down from its top left corner), in order round it, a
   * convex polygon. It stands for the frame; its corners may lie a little past the picture's border. */
  filledCornersPixels?: [number, number][];
};

/** The boundary's directions, a quarter of a degree apart. */
const BINS = 1440;

/** In each direction from the star (degrees east of north), the distance to a convex frame's border less a margin: the
 * frame's corners (east, north, in arcseconds, in order round it) with each side moved inward by the margin. */
export function frameReach(corners: readonly (readonly [number, number])[], marginArcsec: number): (east: number, north: number) => number {
  const sides = corners.map((a, i) => {
    const b = corners[(i + 1) % corners.length]!, edge = [b[0] - a[0], b[1] - a[1]], length = Math.hypot(edge[0]!, edge[1]!);
    // The side's normal away from the star (the origin), and its line's distance from the star along it.
    let normal: [number, number] = [edge[1]! / length, -edge[0]! / length], distance = normal[0] * a[0] + normal[1] * a[1];
    if (distance < 0) { normal = [-normal[0], -normal[1]]; distance = -distance; }
    if (distance <= marginArcsec) throw new RangeError(`The star is within ${marginArcsec} arcsec of the frame's border.`);
    return { normal, inset: distance - marginArcsec };
  });
  return (east, north) => {
    const length = Math.hypot(east, north), d = length ? [east / length, north / length] : [0, 1];
    let reach = Infinity;
    for (const { normal, inset } of sides) { const toward = normal[0] * d[0]! + normal[1] * d[1]!; if (toward > 0) reach = Math.min(reach, inset / toward); }
    return reach;
  };
}

/** Over how many arcseconds the boundary passes from the shell's rounded line to the frame's where the two cross: the
 * width of the soft least that joins them, so the join has no corner. */
export const FRAME_JOIN_ARCSEC = 6;

/** In each direction from the star, the distance to a convex frame's border less a margin with its corners rounded on
 * circles of a radius: the frame moved inward by the margin and the radius, then grown back by the radius. Its straight
 * sides stay where the margin puts them; only its corners are cut, each by an arc. */
export function roundedFrameReach(corners: readonly (readonly [number, number])[], marginArcsec: number, radiusArcsec: number): (east: number, north: number) => number {
  frameReach(corners, marginArcsec + radiusArcsec);
  // The inner frame: each side's line moved inward by the margin and the radius, its corners where neighbouring lines meet.
  const lines = corners.map((a, i) => { const b = corners[(i + 1) % corners.length]!, length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let normal: [number, number] = [(b[1] - a[1]) / length, -(b[0] - a[0]) / length], distance = normal[0] * a[0] + normal[1] * a[1];
    if (distance < 0) { normal = [-normal[0], -normal[1]]; distance = -distance; }
    return { normal, at: distance - marginArcsec - radiusArcsec }; });
  const inner = lines.map((l, i) => { const m = lines[(i + lines.length - 1) % lines.length]!, det = m.normal[0] * l.normal[1] - m.normal[1] * l.normal[0];
    return [(m.at * l.normal[1] - l.at * m.normal[1]) / det, (m.normal[0] * l.at - l.normal[0] * m.at) / det] as const; });
  const outside = (x: number, y: number) => lines.some(l => l.normal[0] * x + l.normal[1] * y > l.at);
  const distance = (x: number, y: number) => { if (!outside(x, y)) return 0; let least = Infinity;
    for (let i = 0; i < inner.length; i++) { const a = inner[i]!, b = inner[(i + 1) % inner.length]!, e = [b[0] - a[0], b[1] - a[1]] as const;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * e[0] + (y - a[1]) * e[1]) / (e[0] * e[0] + e[1] * e[1])));
      least = Math.min(least, Math.hypot(x - a[0] - t * e[0], y - a[1] - t * e[1])); }
    return least; };
  return (east, north) => {
    const length = Math.hypot(east, north), d = length ? [east / length, north / length] as const : [0, 1] as const;
    // The distance from the inner frame grows along the ray once past it: halve to where it is the radius.
    let lo = 0, hi = 1; while (distance(d[0] * hi, d[1] * hi) < radiusArcsec) hi *= 2;
    for (let n = 0; n < 60; n++) { const mid = (lo + hi) / 2; if (distance(d[0] * mid, d[1] * mid) < radiusArcsec) lo = mid; else hi = mid; }
    return lo;
  };
}

/**
 * The drawing boundary's radius, in arcseconds, in the direction of a sky offset (east, north) from the star. In each
 * direction the shell's line is the measured rim pushed outward (`outward`), or as far as the measured knots and jets
 * reach (`reach`) where they go farther. That line is eroded (the least within twice `smoothDeg` either side) and averaged
 * twice over `smoothDeg` either side: every weight of the average is a least over a window holding the direction itself,
 * so the line is nowhere past what it was made from. The frame, less its margin, has its corners rounded on circles of
 * `featherArcsec` and keeps its straight sides; the boundary is the soft least of the two (`FRAME_JOIN_ARCSEC`), never
 * past either. The frame is not smoothed over angle: an angular window wide enough to round a corner far from the star
 * pulls a near side's distance into every direction beside it, and that cut real cloud where the frame's corner holds it.
 */
export function drawingBoundary(options: { rim: (east: number, north: number) => number; reach: ((east: number, north: number) => number) | null;
  frame: readonly (readonly [number, number])[]; fade: FadeOutline }): (east: number, north: number) => number {
  const { rim, reach, frame, fade } = options, inside = roundedFrameReach(frame, fade.frameMarginArcsec, fade.featherArcsec), step = 2 * Math.PI / BINS;
  const at = (bin: number) => ((bin % BINS) + BINS) % BINS;
  const target = Float64Array.from({ length: BINS }, (_, bin) => {
    const east = Math.sin(bin * step), north = Math.cos(bin * step);
    return Math.max(rim(east, north) * fade.outward, reach ? reach(east, north) : 0);
  });
  const half = Math.max(1, Math.round(fade.smoothDeg / 360 * BINS));
  const eroded = Float64Array.from(target, (_, bin) => { let least = Infinity; for (let k = -2 * half; k <= 2 * half; k++) least = Math.min(least, target[at(bin + k)]!); return least; });
  const average = (values: Float64Array) => Float64Array.from(values, (_, bin) => { let sum = 0; for (let k = -half; k <= half; k++) sum += values[at(bin + k)]!; return sum / (2 * half + 1); });
  const shell = average(average(eroded)), k = FRAME_JOIN_ARCSEC;
  const boundary = Float64Array.from(shell, (line, bin) => { const edge = inside(Math.sin(bin * step), Math.cos(bin * step)), least = Math.min(line, edge);
    return least - k * Math.log(Math.exp((least - line) / k) + Math.exp((least - edge) / k)); });
  // Between two directions the boundary is the chord between their points, which a convex stretch (a frame's side) holds.
  const points = Array.from(boundary, (r, bin) => [r * Math.sin(bin * step), r * Math.cos(bin * step)] as const);
  return (east, north) => { const u = (Math.atan2(east, north) / step + BINS) % BINS, i = Math.floor(u) % BINS, a = points[i]!, b = points[(i + 1) % BINS]!;
    const length = Math.hypot(east, north), d = length ? [east / length, north / length] : [0, 1], e = [b[0] - a[0], b[1] - a[1]];
    return (a[0] * b[1] - a[1] * b[0]) / (d[0]! * e[1]! - d[1]! * e[0]!); };
}

/** A picture's opacity at a distance from the star against the boundary there: 1 inside the feather, 0 past the boundary. */
export function outlineFade(radiusArcsec: number, boundaryArcsec: number, featherArcsec: number): number {
  const t = Math.max(0, Math.min(1, (boundaryArcsec - radiusArcsec) / featherArcsec));
  return t * t * (3 - 2 * t);
}

type Reach = (east: number, north: number) => number;

/** What the picture keeps at a place of its plane (`east`, `north` in arcseconds; `radius`, in the plane's units, is the
 * distance the support circle is measured in). With a drawing boundary (`fade`, `rim` and `frame`, `fadeAt: "outline"`) it
 * fades inside that; with `fadeAt: "frame"` it is kept everywhere; otherwise it fades out on the support circle, or on a
 * shell's measured rim scaled as the shell is (`ringScale`), or as far as measured depths reach past it (`reach`, in
 * arcseconds), over the support's taper. */
export function pictureFade(options: { fadeAt: string | undefined; fade: FadeOutline | null; rim: Reach | null; reach: Reach | null; ringScale: Reach | null;
  frame: readonly (readonly [number, number])[] | null; support: number; taper: number; arcsecUnits: number }): (east: number, north: number, radius: number) => number {
  const { fadeAt, fade, rim, reach, ringScale, frame, support, taper, arcsecUnits } = options;
  const boundary = fade && rim && frame ? drawingBoundary({ rim, reach, frame, fade }) : null;
  return (east, north, radius) => {
    if (boundary && fade) return outlineFade(Math.hypot(east, north), boundary(east, north), fade.featherArcsec);
    if (fadeAt === 'frame') return 1;
    const shell = ringScale ? support * ringScale(east, north) : support, edge = reach ? Math.max(shell, reach(east, north) * arcsecUnits) : shell, fadeFrom = edge - (support - taper);
    if (radius >= edge) return 0;
    if (radius > fadeFrom) { const t = (edge - radius) / (edge - fadeFrom); return t * t * (3 - 2 * t); }
    return 1;
  };
}
