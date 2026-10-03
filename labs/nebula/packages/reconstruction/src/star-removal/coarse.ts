/** The stars too big for NOX. NOX takes a star out when its core is a few pixels wide; a saturated star tens of pixels
 * wide stays, with its spikes. On a copy of the picture several times smaller that star is small enough, so NOX runs
 * again over the small copy, and where that pass took light away the picture takes the small pass's result, enlarged.
 * Everywhere else the picture keeps its own pixels, so its detail is not lost to the small copy.
 *
 * Measured: the light the small pass took, per small pixel, as the largest fall over the three channels. A star is a
 * connected patch of small pixels that each lost more than `FLOOR` levels and holds one that lost `SEED` or more.
 * Presentation choices, from M16's ESO picture at a quarter of its size: every constant below. NOX redraws the whole
 * small copy within a few levels and softens fine structure by a few more (16% of M16's small pixels fell by more than 2
 * levels, 0.3% by more than 40); only a patch with a fall of `SEED` is read as a star. */
const FLOOR = 6, SEED = 40;
/** The picture is replaced in full out to `SPREAD` small pixels past the star's patch, then less and less over the next 2 x `FEATHER`. */
const SPREAD = 2, FEATHER = 2;

export interface CoarsePass { replacedPixels: number }

/** Replaces, in place, the parts of `rgb` (packed 8-bit RGB, `width` x `height`) where NOX took light from its small
 * copy: `before` and `after` are that copy (packed 8-bit RGB, `smallWidth` x `smallHeight`) as given to NOX and as
 * returned. Returns how many pixels of the picture changed. */
export function takeCoarsePass(rgb: Uint8Array, width: number, height: number, before: Uint8Array, after: Uint8Array, smallWidth: number, smallHeight: number): CoarsePass {
  if (rgb.length !== width * height * 3) throw new TypeError(`The picture is not ${width} x ${height} packed RGB.`);
  if (before.length !== smallWidth * smallHeight * 3 || after.length !== before.length) throw new TypeError(`The small copies are not ${smallWidth} x ${smallHeight} packed RGB.`);
  const count = smallWidth * smallHeight;
  const taken = new Float32Array(count), queue: number[] = [];
  let mask = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    taken[i] = Math.max(before[i * 3]! - after[i * 3]!, before[i * 3 + 1]! - after[i * 3 + 1]!, before[i * 3 + 2]! - after[i * 3 + 2]!);
    if (taken[i]! >= SEED) { mask[i] = 1; queue.push(i); }
  }
  if (!queue.length) return { replacedPixels: 0 };
  // Each seed grows through its neighbours that lost more than FLOOR levels.
  for (let next = queue.pop(); next !== undefined; next = queue.pop()) {
    const x = next % smallWidth, y = (next - x) / smallWidth;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy, neighbour = ny * smallWidth + nx;
      if (nx < 0 || ny < 0 || nx >= smallWidth || ny >= smallHeight || mask[neighbour] || taken[neighbour]! <= FLOOR) continue;
      mask[neighbour] = 1; queue.push(neighbour);
    }
  }
  // Separable passes over the small mask: the largest value within SPREAD + FEATHER pixels, then the mean within FEATHER pixels.
  const pass = (source: Float32Array, radius: number, fold: (values: number[]) => number) => {
    const along = (input: Float32Array, stepX: number, stepY: number) => {
      const output = new Float32Array(count);
      for (let y = 0; y < smallHeight; y++) for (let x = 0; x < smallWidth; x++) {
        const values: number[] = [];
        for (let offset = -radius; offset <= radius; offset++) {
          const sx = Math.max(0, Math.min(smallWidth - 1, x + offset * stepX)), sy = Math.max(0, Math.min(smallHeight - 1, y + offset * stepY));
          values.push(input[sy * smallWidth + sx]!);
        }
        output[y * smallWidth + x] = fold(values);
      }
      return output;
    };
    return along(along(source, 1, 0), 0, 1);
  };
  mask = pass(pass(mask, SPREAD + FEATHER, values => Math.max(...values)), FEATHER, values => values.reduce((sum, value) => sum + value, 0) / values.length);
  // Each picture pixel reads the small mask and the small result between their four nearest small pixels.
  const scaleX = smallWidth / width, scaleY = smallHeight / height;
  let replacedPixels = 0;
  for (let y = 0; y < height; y++) {
    const fy = Math.max(0, Math.min(smallHeight - 1, (y + 0.5) * scaleY - 0.5)), y0 = Math.floor(fy), y1 = Math.min(smallHeight - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < width; x++) {
      const fx = Math.max(0, Math.min(smallWidth - 1, (x + 0.5) * scaleX - 0.5)), x0 = Math.floor(fx), x1 = Math.min(smallWidth - 1, x0 + 1), tx = fx - x0;
      const a = y0 * smallWidth + x0, b = y0 * smallWidth + x1, c = y1 * smallWidth + x0, d = y1 * smallWidth + x1;
      const wa = (1 - tx) * (1 - ty), wb = tx * (1 - ty), wc = (1 - tx) * ty, wd = tx * ty;
      const share = mask[a]! * wa + mask[b]! * wb + mask[c]! * wc + mask[d]! * wd;
      if (share <= 0) continue;
      const i = (y * width + x) * 3;
      let changed = false;
      for (let channel = 0; channel < 3; channel++) {
        const small = after[a * 3 + channel]! * wa + after[b * 3 + channel]! * wb + after[c * 3 + channel]! * wc + after[d * 3 + channel]! * wd;
        const value = Math.round(rgb[i + channel]! + share * (small - rgb[i + channel]!));
        if (value !== rgb[i + channel]) { rgb[i + channel] = value; changed = true; }
      }
      if (changed) replacedPixels++;
    }
  }
  return { replacedPixels };
}
