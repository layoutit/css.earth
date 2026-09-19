/**
 * A ring drawn as wedges. One square leaf for a whole ring passes through the body's centre, and the browser then sorts the
 * ring's far side over the body. Wedges start outside the body, so each one lies wholly in front of or behind it.
 *
 * Units are the ring image's pixels at density 1, measured from the ring's centre, with x to the right and y down as the
 * image stores them. Wedge `k` is a rectangle centred on angle `angles[k]`: `innerPixels` to `outerPixels` along that
 * angle and `halfHeight` either side of it, which covers every point of its sector from the ring's first content outward.
 */
export interface RingWedgeLayout {
  readonly count: number;
  /** The rectangle's inner edge: the nearest point of the sector's inner arc, where the ring's content begins. */
  readonly innerPixels: number;
  readonly outerPixels: number;
  readonly halfHeight: number;
  /** One wedge's rectangle; the atlas stacks the wedges in one column in angle order. */
  readonly width: number;
  readonly height: number;
  /** Each wedge's centre angle, in radians. */
  readonly angles: readonly number[];
}

export function ringWedgeLayout({ size, count, contentPixels }: { size: number; count: number; contentPixels: number }): RingWedgeLayout {
  if (!Number.isInteger(count) || count < 3) throw new TypeError('A ring needs at least three wedges.');
  if (!(size > 0) || !(contentPixels > 0) || contentPixels >= size / 2) throw new TypeError('A ring\'s content must begin inside its image.');
  const half = Math.PI / count, outerPixels = size / 2;
  const innerPixels = Math.floor(contentPixels * Math.cos(half)), halfHeight = Math.ceil(outerPixels * Math.sin(half));
  return Object.freeze({ count, innerPixels, outerPixels, halfHeight, width: outerPixels - innerPixels, height: 2 * halfHeight,
    angles: Object.freeze(Array.from({ length: count }, (_, k) => 2 * half * k)) });
}

/** Where a point of wedge `k`, at `(a, b)` within its rectangle, lies in the ring image, from the ring's centre. */
export function wedgePoint(layout: RingWedgeLayout, k: number, a: number, b: number): readonly [number, number] {
  const angle = layout.angles[k]!, u = layout.innerPixels + a, v = b - layout.halfHeight;
  return [Math.cos(angle) * u - Math.sin(angle) * v, Math.sin(angle) * u + Math.cos(angle) * v];
}

/** How much of a pixel `radius` pixels from the centre, at `angle`, belongs to wedge `k`: 1 inside, 0 outside, and the
 * pixel's share across a boundary, from the centre's distance to it. Neighbouring wedges' shares sum to one there. */
export function wedgeShare(layout: RingWedgeLayout, k: number, radius: number, angle: number) {
  const offset = Math.atan2(Math.sin(angle - layout.angles[k]!), Math.cos(angle - layout.angles[k]!));
  return Math.max(0, Math.min(1, 0.5 + radius * Math.sin(Math.PI / layout.count - Math.abs(offset))));
}

/** The CSS matrix placing wedge `k` in the plane of a ring image drawn at `scale` scene pixels per image pixel. It maps the
 * wedge's rectangle onto the same points the single square leaf put there, whose matrix swaps x and y. */
export function wedgeMatrix(layout: RingWedgeLayout, k: number, scale: number) {
  const angle = layout.angles[k]!, sine = Math.sin(angle), cosine = Math.cos(angle), round = (value: number) => Number(value.toFixed(6));
  return [scale * sine, scale * cosine, 0, 0, scale * cosine, -scale * sine, 0, 0, 0, 0, 1, 0,
    scale * (sine * layout.innerPixels - cosine * layout.halfHeight), scale * (cosine * layout.innerPixels + sine * layout.halfHeight), 0, 1].map(round).join(',');
}
