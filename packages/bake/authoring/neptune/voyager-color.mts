/**
 * Color for the Voyager map of Neptune. The sharpest frames are in one filter; the color sets were taken two to three days
 * earlier, from further away. The color sets give each cell's ratios to green at their own epoch; each latitude band's
 * ratios are then moved along the band to where the sharp map shows the same clouds, and multiplied onto the sharp map.
 */
import { blurMap, type DriftRate, type MapGrid } from './voyager-map.mts';

export interface ColorPolicy {
  bandDegrees: number; highPassDegrees: number;
  /** A band's clouds are searched for within this many degrees of where the drift puts them. */
  searchDegrees: number;
  minimumCorrelation: number; minimumContrast: number;
  /** An unmatched band between matched bands this close in latitude, whose lags agree this well, takes the lag between them. */
  bridgeLatitudeDegrees: number; bridgeLagDegrees: number;
  /** Ratios are smoothed over this many degrees: color is coarser than the sharp map and a small misregistration must not fringe. */
  smoothDegrees: number;
}
export const COLOR_POLICY: ColorPolicy = { bandDegrees: 2, highPassDegrees: 30, searchDegrees: 12, minimumCorrelation: 0.35, minimumContrast: 0.003,
  bridgeLatitudeDegrees: 10, bridgeLagDegrees: 6, smoothDegrees: 1.5 };
export interface ColorBand { row: number; rows: number; latitude: number; lagColumns: number; correlation: number; registered: boolean; bridged: boolean }

function bandProfile(map: Float32Array, grid: MapGrid, firstRow: number, rows: number, highPassColumns: number) {
  const w = grid.width, mean = new Float32Array(w).fill(NaN);
  for (let x = 0; x < w; x++) { let sum = 0, n = 0; for (let y = firstRow; y < firstRow + rows; y++) { const v = map[y * w + x]!; if (!Number.isNaN(v)) { sum += v; n++; } } if (n === rows) mean[x] = sum / n; }
  const profile = new Float32Array(w).fill(NaN), half = Math.floor(highPassColumns / 2);
  for (let x = 0; x < w; x++) {
    if (Number.isNaN(mean[x]!)) continue;
    let sum = 0, n = 0;
    for (let d = -half; d <= half; d++) { const v = mean[((x + d) % w + w) % w]!; if (!Number.isNaN(v)) { sum += v; n++; } }
    if (n > half) profile[x] = mean[x]! / (sum / n) - 1;
  }
  return profile;
}

/** Mean of a grid over `factor` x `factor` blocks, NaN where a block is not wholly seen. */
export function reduceMap(map: Float32Array, grid: MapGrid, factor: number) {
  const w = grid.width / factor, h = grid.height / factor, out = new Float32Array(w * h).fill(NaN);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let sum = 0, n = 0;
    for (let dy = 0; dy < factor; dy++) for (let dx = 0; dx < factor; dx++) { const v = map[(y * factor + dy) * grid.width + x * factor + dx]!; if (!Number.isNaN(v)) { sum += v; n++; } }
    if (n === factor * factor) out[y * w + x] = sum / n;
  }
  return out;
}

/** Where each band of the color epoch's green map sits in the sharp map: the lag, in columns, that best correlates the two. */
export function registerBands(colorGreen: Float32Array, sharp: Float32Array, grid: MapGrid, drift: DriftRate, hoursApart: number, policy: ColorPolicy = COLOR_POLICY): ColorBand[] {
  const w = grid.width, rows = Math.round(policy.bandDegrees / 180 * grid.height), highPass = Math.round(policy.highPassDegrees / 360 * w), window = Math.round(policy.searchDegrees / 360 * w);
  const wrap = (lag: number) => ((lag % w) + w) % w, apart = (p: number, q: number) => Math.abs(((p - q) % w + w + w / 2) % w - w / 2);
  const bands: ColorBand[] = [];
  for (let row = 0; row + rows <= grid.height; row += rows) {
    const latitude = 90 - (row + rows / 2) / grid.height * 180, a = bandProfile(colorGreen, grid, row, rows, highPass), b = bandProfile(sharp, grid, row, rows, highPass);
    // Searched only near where the drift puts the band after the hours between the epochs: a free search round the whole
    // circle finds chance matches among clouds that have changed.
    const expected = Math.round(drift(latitude) * hoursApart / 360 * w);
    let best = -Infinity, bestLag = expected, contrast = 0;
    for (let offset = -window; offset <= window; offset++) {
      const lag = wrap(expected + offset);
      let sab = 0, saa = 0, sbb = 0, n = 0;
      for (let x = 0; x < w; x++) { const va = a[x]!, vb = b[(x + lag) % w]!; if (Number.isNaN(va) || Number.isNaN(vb)) continue; sab += va * vb; saa += va * va; sbb += vb * vb; n++; }
      if (n < 0.8 * w) continue;
      const score = sab / Math.sqrt(saa * sbb); contrast = Math.sqrt(sbb / n);
      if (score > best) { best = score; bestLag = lag; }
    }
    const registered = best >= policy.minimumCorrelation && contrast >= policy.minimumContrast && apart(bestLag, expected) < window;
    bands.push({ row, rows, latitude, lagColumns: registered ? bestLag : wrap(expected), correlation: Number.isFinite(best) ? best : NaN, registered, bridged: false });
  }
  // One cloud system spans several bands and moves as one.
  for (let i = 0; i < bands.length; i++) {
    if (bands[i]!.registered) continue;
    let before = i - 1, after = i + 1;
    while (before >= 0 && !bands[before]!.registered) before--;
    while (after < bands.length && !bands[after]!.registered) after++;
    if (before < 0 || after >= bands.length || bands[before]!.bridged || bands[before]!.latitude - bands[after]!.latitude > policy.bridgeLatitudeDegrees) continue;
    if (apart(bands[before]!.lagColumns, bands[after]!.lagColumns) * 360 / w > policy.bridgeLagDegrees) continue;
    const delta = ((bands[after]!.lagColumns - bands[before]!.lagColumns) % w + w + w / 2) % w - w / 2;
    for (let j = before + 1; j < after; j++) bands[j] = { ...bands[j]!, lagColumns: wrap(Math.round(bands[before]!.lagColumns + (j - before) / (after - before) * delta)), registered: true, bridged: true };
  }
  return bands;
}

/**
 * A filter's ratio to green at the sharp epoch. A registered band's ratios are moved by its lag; a band whose clouds could
 * not be matched keeps only its mean ratio round the planet, so no color lands on the wrong cloud.
 */
export function ratioMap(numerator: Float32Array, green: Float32Array, bands: readonly ColorBand[], grid: MapGrid, policy: ColorPolicy = COLOR_POLICY) {
  const w = grid.width, ratio = new Float32Array(w * grid.height).fill(NaN);
  for (const band of bands) for (let y = band.row; y < band.row + band.rows; y++) {
    let sum = 0, n = 0; const line = new Float32Array(w).fill(NaN);
    for (let x = 0; x < w; x++) { const g = green[y * w + x]!, v = numerator[y * w + x]!; if (g > 0 && v > 0) { line[x] = v / g; sum += v / g; n++; } }
    if (n < 0.3 * w) continue;
    const zonal = sum / n;
    for (let x = 0; x < w; x++) { const source = line[((x - band.lagColumns) % w + w) % w]!; ratio[y * w + x] = band.registered && !Number.isNaN(source) ? source : zonal; }
  }
  return blurMap(ratio, grid, policy.smoothDegrees / 360 * w);
}

/** Rows of a map every longitude of which is seen: the first and the last. */
export function wholeRows(map: Float32Array, grid: MapGrid) {
  const whole = (y: number) => { for (let x = 0; x < grid.width; x++) if (Number.isNaN(map[y * grid.width + x]!)) return false; return true; };
  let first = 0, last = grid.height - 1;
  while (first < grid.height && !whole(first)) first++;
  while (last > first && !whole(last)) last--;
  return { first, last };
}

/** Red, green and blue reflectance on the sharp grid: the sharp green map, and it times the orange and blue ratios. NaN outside `rows`. */
export function composeColor(sharp: Float32Array, grid: MapGrid, ratioOrange: Float32Array, ratioBlue: Float32Array, colorGrid: MapGrid, rows: { first: number; last: number }) {
  const factor = grid.width / colorGrid.width, w = colorGrid.width, h = colorGrid.height, rgb = new Float32Array(grid.width * grid.height * 3).fill(NaN);
  const sample = (map: Float32Array, X: number, Y: number) => {
    const fx = (X + 0.5) / factor - 0.5, fy = Math.max(0, Math.min(h - 1.001, (Y + 0.5) / factor - 0.5)), x0 = Math.floor(fx), y0 = Math.floor(fy), ax = fx - x0, ay = fy - y0;
    const at = (xx: number, yy: number) => map[yy * w + ((xx % w) + w) % w]!;
    const value = (at(x0, y0) * (1 - ax) + at(x0 + 1, y0) * ax) * (1 - ay) + (at(x0, y0 + 1) * (1 - ax) + at(x0 + 1, y0 + 1) * ax) * ay;
    return Number.isNaN(value) ? at(Math.round(fx), Math.round(fy)) : value;
  };
  for (let y = rows.first; y <= rows.last; y++) for (let x = 0; x < grid.width; x++) {
    const l = sharp[y * grid.width + x]!, i = (y * grid.width + x) * 3;
    rgb[i] = l * sample(ratioOrange, x, y); rgb[i + 1] = l; rgb[i + 2] = l * sample(ratioBlue, x, y);
  }
  return rgb;
}
