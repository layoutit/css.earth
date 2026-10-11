/**
 * A filled polygon exactly as Pillow 12.3.0 draws one with `ImageDraw.Draw(image).polygon(points, fill=...)` and no
 * outline: the outer-ejecta cloud rasters the Homunculus's lobes (the Steffen et al. 2014 mesh, triangle by
 * triangle) this way, and which sky cells the lobes cover decides where the gas dots go.
 *
 * Pillow's path (_imaging.c `_draw_polygon`, Draw.c `ImagingDrawPolygon` and `polygon_generic`):
 * - each vertex is truncated toward zero to integer pixels;
 * - the closed outline becomes edges (a horizontal edge that continues another in the same direction is merged into it);
 * - a horizontal edge is drawn as its whole row span;
 * - every other row from the polygon's top to its bottom (clipped to the image, the bottom bound being the image's
 *   height) crosses each edge at x = (y - y0) dx + x0, one single-precision fused multiply-add (`fmaf`); an edge's last row counts twice (unless it
 *   is the polygon's last row), a corner whose two edges meet on one pixel is pushed one pixel out past its
 *   neighbours on the next row; the crossings are sorted and each pair filled from ROUND_UP of the first to
 *   ROUND_DOWN of the second (half away from zero, and half toward zero).
 * Single-precision arithmetic is reproduced with Math.fround at each step Pillow rounds.
 */

interface Edge { x0: number; y0: number; xmin: number; ymin: number; xmax: number; ymax: number; dx: number }

const f = Math.fround;
/** C's roundf: half away from zero. */
const roundf = (v: number) => f(v >= 0 ? Math.floor(v + 0.5) : -Math.floor(-v + 0.5));
/** Draw.c ROUND_UP on a float: `f + 0.5F` is single precision when f >= 0; `fabs(f) + 0.5F` is double otherwise. */
const roundUp = (v: number) => v >= 0 ? Math.floor(f(v + 0.5)) : -Math.floor(Math.abs(v) + 0.5);
/** Draw.c ROUND_DOWN on a float. */
const roundDown = (v: number) => v >= 0 ? Math.ceil(f(v - 0.5)) : -Math.ceil(Math.abs(v) - 0.5);

function edgeOf(x0: number, y0: number, x1: number, y1: number): Edge {
  return { x0, y0, xmin: Math.min(x0, x1), xmax: Math.max(x0, x1), ymin: Math.min(y0, y1), ymax: Math.max(y0, y1), dx: y0 === y1 ? 0 : f((x1 - x0) / (y1 - y0)) };
}
const bits = new Float32Array(1), word = new Uint32Array(bits.buffer);
/** The single-precision neighbour of a finite float `r` away from zero (toward zero when `down`). */
function step(r: number, down: boolean): number { bits[0] = r; word[0] = word[0]! + (down ? -1 : 1); return bits[0]!; }
/**
 * fmaf(a, b, c): a b + c rounded once to single precision. Pillow's compiled `(y - y0) * dx + x0` is contracted into a
 * fused multiply-add (clang's default on arm64), so the crossing is not rounded after the product. The product of two
 * floats is exact in double; the sum is made exact by its rounding error, which breaks a tie at the float midpoint.
 */
function fmaf(a: number, b: number, c: number): number {
  const p = a * b, s = p + c, z = s - p, e = (p - (s - z)) + (c - z), r = f(s);
  if (e === 0 || r === 0 || !Number.isFinite(r)) return r;
  const away = Math.abs(s) > Math.abs(r), other = step(r, !away), mid = (r + other) / 2;
  if (s !== mid) return r;
  // s lies exactly halfway between r and its neighbour: the exact value is on the side of its error.
  return (e > 0) === (other > r) ? other : r;
}
/** Where an edge crosses row y, in single precision as Pillow computes it. */
const crossing = (edge: Edge, y: number) => fmaf(f(y - edge.y0), edge.dx, edge.x0);

/**
 * Sets to 1 the pixels of `mask` (row-major, `width` x `height`) that Pillow's polygon fill covers for `points`
 * (pixel x right, y down). Throws on fewer than two points or a coordinate that is not a finite number.
 */
export function fillPolygon(mask: Uint8Array, width: number, height: number, points: readonly (readonly [number, number])[]): Uint8Array {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) throw new RangeError(`fillPolygon: ${width} x ${height} is not an image size.`);
  if (mask.length !== width * height) throw new RangeError(`fillPolygon: a mask of ${mask.length} pixels is not ${width} x ${height}.`);
  if (points.length < 2) throw new TypeError('fillPolygon: a polygon needs at least two points.');
  const xy: number[] = [];
  for (const [x, y] of points) { if (!Number.isFinite(x) || !Number.isFinite(y)) throw new TypeError(`fillPolygon: point ${x}, ${y} is not finite.`); xy.push(Math.trunc(x), Math.trunc(y)); }
  const count = points.length, edges: Edge[] = [];
  let i = 0;
  for (; i < count - 1; i++) {
    const x0 = xy[2 * i]!, y0 = xy[2 * i + 1]!, x1 = xy[2 * i + 2]!, y1 = xy[2 * i + 3]!;
    if (y0 === y1 && i !== 0 && y0 === xy[2 * i - 1]) {
      // A horizontal edge straight after another, in the same direction, lengthens it.
      const last = edges[edges.length - 1]!;
      if (x1 > x0 && x0 > xy[2 * i - 2]!) { last.xmax = x1; continue; }
      if (x1 < x0 && x0 < xy[2 * i - 2]!) { last.xmin = x1; continue; }
    }
    edges.push(edgeOf(x0, y0, x1, y1));
  }
  if (xy[2 * i] !== xy[0] || xy[2 * i + 1] !== xy[1]) edges.push(edgeOf(xy[2 * i]!, xy[2 * i + 1]!, xy[0]!, xy[1]!));
  const hline = (xa: number, y: number, xb: number) => {
    if (y < 0 || y >= height) return;
    if (xa < 0) xa = 0; else if (xa >= width) return;
    if (xb < 0) return; else if (xb >= width) xb = width - 1;
    if (xa <= xb) mask.fill(1, y * width + xa, y * width + xb + 1);
  };
  let ymin = height - 1, ymax = 0;
  const table: Edge[] = [];
  for (const edge of edges) {
    if (ymin > edge.ymin) ymin = edge.ymin;
    if (ymax < edge.ymax) ymax = edge.ymax;
    if (edge.ymin === edge.ymax) { hline(edge.xmin, edge.ymin, edge.xmax); continue; }
    table.push(edge);
  }
  if (ymin < 0) ymin = 0;
  if (ymax > height) ymax = height;
  const xx: number[] = [];
  for (; ymin <= ymax; ymin++) {
    xx.length = 0;
    for (let e = 0; e < table.length; e++) {
      const current = table[e]!;
      if (ymin < current.ymin || ymin > current.ymax) continue;
      xx.push(crossing(current, ymin));
      if (ymin === current.ymax && ymin < ymax) { xx.push(xx[xx.length - 1]!); continue; }
      if ((ymin === current.ymin || ymin === current.ymax) && current.dx !== 0) {
        // Connect a corner whose two edges meet on one pixel to the next (or, on the last row, the previous) row.
        for (let k = 0; k < e; k++) {
          const other = table[k]!;
          if ((ymin !== other.ymin && ymin !== other.ymax) || other.dx === 0) continue;
          const last = xx.length - 1;
          if (roundf(xx[last]!) !== roundf(crossing(other, ymin))) continue;
          const offset = ymin === current.ymax ? -1 : 1, adjacent = crossing(current, ymin + offset);
          if (ymin + offset >= other.ymin && ymin + offset <= other.ymax) {
            const adjacentOther = crossing(other, ymin + offset);
            if (xx[last]! > f(adjacent + 1) && xx[last]! > f(adjacentOther + 1)) xx[last] = f(roundf(Math.max(adjacent, adjacentOther)) + 1);
            else if (xx[last]! < f(adjacent - 1) && xx[last]! < f(adjacentOther - 1)) xx[last] = f(roundf(Math.min(adjacent, adjacentOther)) - 1);
            break;
          }
        }
      }
    }
    xx.sort((a, b) => a - b);
    for (let k = 1; k < xx.length; k += 2) hline(roundUp(xx[k - 1]!), ymin, roundDown(xx[k]!));
  }
  return mask;
}
