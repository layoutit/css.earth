/**
 * How deep inside a photograph's usable disc each pixel lies: the Euclidean distance, in pixels, to the nearest pixel the lens
 * cannot use (off the body, past the limb or terminator limits, or disqualified), with everything beyond the detector unusable.
 * The distance is exact (Felzenszwalb and Huttenlocher, "Distance Transforms of Sampled Functions", Theory of Computing 8, 2012)
 * and changes by at most one pixel per pixel, so a weight built on it fades a frame out continuously at its disc edge.
 */

/** The lower envelope of parabolas rooted at the finite entries of f: d[q] = min over p of (q - p)² + f[p]; Infinity where f has none. */
function squaredDistances1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array) {
  let k = -1;
  for (let q = 0; q < n; q++) {
    if (f[q] === Infinity) continue;
    if (k < 0) { k = 0; v[0] = q; z[0] = -Infinity; z[1] = Infinity; continue; }
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * (q - v[k]));
    while (s <= z[k]) { k--; s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * (q - v[k])); }
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  if (k < 0) { d.fill(Infinity, 0, n); return; }
  for (let q = 0, j = 0; q < n; q++) {
    while (z[j + 1] < q) j++;
    d[q] = (q - v[j]) ** 2 + f[v[j]];
  }
}

export interface ContourDistances { width: number; height: number; distances: Float32Array; deepest: number }

/** Each pixel's distance to the nearest unusable pixel or the detector's edge; unusable pixels are at zero. */
export function contourDistances(width: number, height: number, usable: (index: number) => boolean): ContourDistances {
  // One unusable pixel pads every side, so the detector's edge bounds the disc like its limb does.
  const w = width + 2, h = height + 2, grid = new Float64Array(w * h), longest = Math.max(w, h);
  const f = new Float64Array(longest), d = new Float64Array(longest), v = new Int32Array(longest), z = new Float64Array(longest + 1);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (usable(y * width + x)) grid[(y + 1) * w + x + 1] = Infinity;
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
    squaredDistances1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
  }
  const distances = new Float32Array(width * height);
  let deepest = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
    squaredDistances1d(f, w, d, v, z);
    if (y === 0 || y === h - 1) continue;
    for (let x = 1; x < w - 1; x++) {
      // Kept at the stored precision, so the deepest pixel reads exactly one.
      const distance = Math.fround(Math.sqrt(d[x]));
      distances[(y - 1) * width + x - 1] = distance;
      if (distance > deepest) deepest = distance;
    }
  }
  return { width, height, distances, deepest };
}

/** The distance at detector coordinates, interpolated like the footprint's pixels, as a fraction of the deepest pixel's; zero off the detector. */
export function contourDepth({ width, height, distances, deepest }: ContourDistances, x: number, y: number): number {
  if (!(deepest > 0) || !Number.isFinite(x + y) || x < 0 || y < 0 || x > width - 1 || y > height - 1) return 0;
  const ix = Math.min(Math.floor(x), width - 2), iy = Math.min(Math.floor(y), height - 2), tx = x - ix, ty = y - iy, i = iy * width + ix;
  return ((1 - tx) * (1 - ty) * distances[i] + tx * (1 - ty) * distances[i + 1] + (1 - tx) * ty * distances[i + width] + tx * ty * distances[i + width + 1]) / deepest;
}
