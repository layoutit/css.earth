import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { VirRecipe, Continuum, Reduced } from './vir-mosaic.mts';


/** Frigeri et al. (2019): the continuum joins the reflectance at the left anchor (the maximum within `left`) and the right
 * anchor (the maximum within `right`); the band depth is 1 - Rb/Rc at the band minimum between them (Clark and Roush). */
export function bandDepth(wavelengths: readonly number[], iof: readonly number[], continuum: Continuum) {
  const inRange = ([a, b]: readonly [number, number]) => wavelengths.map((w, i) => [w, i] as const).filter(([w]) => w >= a && w <= b).map(([, i]) => i);
  const pick = (range: readonly [number, number]) => { const idx = inRange(range); if (!idx.length) return -1; return idx.reduce((x, y) => iof[y] > iof[x] ? y : x); };
  const left = pick(continuum.left), right = pick(continuum.right);
  if (left < 0 || right <= left + 1) return NaN;
  let depth = -Infinity;
  for (let i = left + 1; i < right; i++) {
    const f = (wavelengths[i] - wavelengths[left]) / (wavelengths[right] - wavelengths[left]), c = iof[left] * (1 - f) + iof[right] * f;
    if (c > 0) depth = Math.max(depth, 1 - iof[i] / c);
  }
  return Number.isFinite(depth) ? depth : NaN;
}


/** One reduced cube's band parameters on the map grid: destriped, gaps bridged, each pixel footprint rasterised.
 * `visit` receives every covered cell once with the parameter values there. */
export function projectCube(recipe: VirRecipe, gain: number[][], header: Reduced, data: Float32Array, ppd: number, visit: (cell: number, values: number[]) => void) {
  const limit = recipe.output.latitudeLimitDegrees, width = 360 * ppd, height = 2 * limit * ppd;
  const cosI = Math.cos(recipe.policy.maximumIncidenceDegrees * Math.PI / 180), cosE = Math.cos(recipe.policy.maximumEmissionDegrees * Math.PI / 180), half = Math.floor(recipe.bands.boxcar / 2);
  const n = header.kept[1] - header.kept[0] + 1, rowWidth = 5 + n;
  // Pixel values first: band parameters per record, NaN where the pixel is outside the limits or on a bad column.
  const values = recipe.parameters.map(() => new Float32Array(header.records).fill(NaN)), line = new Int32Array(header.records);
  let currentLine = 0;
  for (let r = 0; r < header.records; r++) {
    const o = r * rowWidth, s = data[o + 4];
    if (r > 0 && s <= data[o - rowWidth + 4]) currentLine++;
    line[r] = currentLine;
    if (data[o + 2] < cosI || data[o + 3] < cosE || Math.abs(data[o]) >= limit) continue;
    // A column whose stripe gain is far from 1 is a dead or hot detector pixel, not a stripe; it is filled below.
    if (gain.some(row => !(row[s] > recipe.policy.minimumGain && row[s] < 1 / recipe.policy.minimumGain))) continue;
    const corrected = Array.from({ length: n }, (_, b) => data[o + 5 + b] / gain[b][s]);
    if (corrected.some(v => !(v > 0))) continue;
    const smooth: number[] = [], waves: number[] = [];
    for (let b = half; b < n - half; b++) { let sum = 0; for (let j = -half; j <= half; j++) sum += corrected[b + j]; smooth.push(sum / (2 * half + 1)); waves.push(header.wavelengths[s][b]); }
    recipe.parameters.forEach((parameter, i) => { values[i][r] = bandDepth(waves, smooth, parameter.continuum); });
  }
  const index = new Map<number, number>();
  for (let r = 0; r < header.records; r++) index.set(line[r] * 1024 + data[r * rowWidth + 4], r);
  // Dead or hot columns (and pixels with a bad band) leave short gaps along a line: bridge gaps of up to
  // `maximumColumnGap` samples by linear interpolation between the valid samples on either side, so footprints stay continuous.
  const lines = currentLine + 1, gap = recipe.policy.maximumColumnGap;
  const fill: number[] = [];
  for (let l = 0; l < lines; l++) {
    let previous = -1;
    for (let s = 0; s < 256; s++) {
      const r = index.get(l * 1024 + s);
      if (r === undefined || !Number.isFinite(values[0][r])) continue;
      if (previous >= 0 && s - previous > 1 && s - previous <= gap + 1) {
        const r0 = index.get(l * 1024 + previous)!;
        for (let m = previous + 1; m < s; m++) {
          const rm = index.get(l * 1024 + m);
          if (rm === undefined) continue;
          const f = (m - previous) / (s - previous);
          values.forEach(v => { v[rm] = v[r0] * (1 - f) + v[r] * f; });
          fill.push(rm);
        }
      }
      previous = s;
    }
  }
  // Despike (Frigeri et al. 2019, Section 3.1): a pixel whose band parameter departs from the median of its 3 x 3
  // detector neighbours by more than a modified z-score of `outlierModifiedZ` (Iglewicz and Hoaglin 1993, over this
  // cube's residuals) takes that median.
  for (const v of values) {
    const residual = new Float32Array(header.records).fill(NaN), local = new Float32Array(header.records).fill(NaN);
    for (let r = 0; r < header.records; r++) {
      if (!Number.isFinite(v[r])) continue;
      const s = data[r * rowWidth + 4], around: number[] = [];
      for (let dl = -1; dl <= 1; dl++) for (let ds = -1; ds <= 1; ds++) {
        if (!dl && !ds) continue;
        const q = index.get((line[r] + dl) * 1024 + s + ds);
        if (q !== undefined && Number.isFinite(v[q])) around.push(v[q]);
      }
      if (around.length < 5) continue;
      around.sort((x, y) => x - y); local[r] = around[around.length >> 1]; residual[r] = v[r] - local[r];
    }
    const finite = Array.from(residual).filter(Number.isFinite).sort((x, y) => x - y);
    if (finite.length < 100) continue;
    const median = finite[finite.length >> 1], mad = Array.from(finite, x => Math.abs(x - median)).sort((x, y) => x - y)[finite.length >> 1];
    if (!(mad > 0)) continue;
    for (let r = 0; r < header.records; r++) if (Number.isFinite(residual[r]) && 0.6745 * Math.abs(residual[r] - median) / mad > recipe.policy.outlierModifiedZ) v[r] = local[r];
  }
  // Scene-based destriping per cube: a column's median over its lines, minus the median of its neighbours' medians,
  // is that column's offset in this cube. Geology does not follow detector columns over a whole cube; stripes do.
  for (const v of values) {
    const byColumn = new Map<number, number[]>();
    for (let r = 0; r < header.records; r++) if (Number.isFinite(v[r])) { const s = data[r * rowWidth + 4]; (byColumn.get(s) ?? byColumn.set(s, []).get(s)!).push(v[r]); }
    const med = new Map<number, number>();
    for (const [s, list] of byColumn) if (list.length >= recipe.policy.minimumColumnPixels) { list.sort((x, y) => x - y); med.set(s, list[list.length >> 1]); }
    const offset = new Map<number, number>();
    for (const [s, m] of med) {
      const around: number[] = [];
      for (let o = -recipe.policy.destripeNeighbours; o <= recipe.policy.destripeNeighbours; o++) { const x = med.get(s + o); if (o !== 0 && x !== undefined) around.push(x); }
      if (around.length < recipe.policy.destripeNeighbours) continue;
      around.sort((x, y) => x - y); offset.set(s, m - around[around.length >> 1]);
    }
    for (let r = 0; r < header.records; r++) { const d = offset.get(data[r * rowWidth + 4]); if (d !== undefined) v[r] -= d; }
  }
  // Quads wider than this bridge a gap, not neighbouring pixels: `maximumQuadKm`, or for a coarser cube one median pixel step
  // plus that step foreshortened at the emission limit, whichever is larger.
  const kmPerDegree = recipe.target.referenceRadiusKm * Math.PI / 180;
  const maximumQuadDegrees = Math.max(recipe.policy.maximumQuadKm, pixelStepKm(recipe, header, data) * (1 + 1 / cosE)) / kmPerDegree;
  // Footprints: each 2 x 2 block of neighbouring pixels spans a quadrilateral on the map (Frigeri et al. map the whole
  // integration footprint, not the pixel centre). Every cell centre inside it takes the corners' interpolated value.
  const at = index;
  const lonOf = (r: number, reference: number) => { let lon = data[r * rowWidth + 1]; while (lon - reference > 180) lon -= 360; while (reference - lon > 180) lon += 360; return lon; };
  const touched = new Uint8Array(width * height);
  for (const [key, r00] of at) {
    const l = Math.floor(key / 1024), s = key % 1024;
    const corners = [r00, at.get(l * 1024 + s + 1), at.get((l + 1) * 1024 + s + 1), at.get((l + 1) * 1024 + s)];
    if (corners.some(c => c === undefined || values.some(v => !Number.isFinite(v[c])))) continue;
    const rs = corners as number[], ref = data[r00 * rowWidth + 1];
    const lons = rs.map(c => lonOf(c, ref)), lats = rs.map(c => data[c * rowWidth]);
    if (Math.max(...lons) - Math.min(...lons) > maximumQuadDegrees / Math.max(0.2, Math.cos(lats[0] * Math.PI / 180)) || Math.max(...lats) - Math.min(...lats) > maximumQuadDegrees) continue;
    for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]]) {
      const x = [lons[a], lons[b], lons[c]], y = [lats[a], lats[b], lats[c]];
      const det = (y[1] - y[2]) * (x[0] - x[2]) + (x[2] - x[1]) * (y[0] - y[2]);
      if (Math.abs(det) < 1e-12) continue;
      const colMin = Math.ceil(Math.min(...x) * ppd - 0.5), colMax = Math.floor(Math.max(...x) * ppd - 0.5);
      const rowMin = Math.ceil((limit - Math.max(...y)) * ppd - 0.5), rowMax = Math.floor((limit - Math.min(...y)) * ppd - 0.5);
      for (let row = Math.max(0, rowMin); row <= Math.min(height - 1, rowMax); row++) for (let col = colMin; col <= colMax; col++) {
        const px = (col + 0.5) / ppd, py = limit - (row + 0.5) / ppd;
        const w0 = ((y[1] - y[2]) * (px - x[2]) + (x[2] - x[1]) * (py - y[2])) / det, w1 = ((y[2] - y[0]) * (px - x[2]) + (x[0] - x[2]) * (py - y[2])) / det, w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const cell = row * width + (((col % width) + width) % width);
        if (touched[cell]) continue; // one sample per cell per cube: overlapping cubes are what get averaged
        touched[cell] = 1;
        visit(cell, values.map(v => w0 * v[rs[a]] + w1 * v[rs[b]] + w2 * v[rs[c]]));
      }
    }
  }
}


/** A cube's ground resolution: the larger of its median distances between neighbouring samples and between neighbouring
 * lines, in km on the reference sphere. */
export function pixelStepKm(recipe: VirRecipe, header: Reduced, data: Float32Array) {
  const rowWidth = 5 + header.kept[1] - header.kept[0] + 1, kmPerDegree = recipe.target.referenceRadiusKm * Math.PI / 180, index = new Map<number, number>();
  let line = 0;
  for (let r = 0; r < header.records; r++) { if (r > 0 && data[r * rowWidth + 4] <= data[(r - 1) * rowWidth + 4]) line++; index.set(line * 1024 + data[r * rowWidth + 4], r); }
  const steps: number[][] = [[], []];
  for (const [key, r] of index) for (const [k, next] of [[0, index.get(key + 1)], [1, index.get(key + 1024)]] as const) {
    if (next === undefined) continue;
    const dLat = data[next * rowWidth] - data[r * rowWidth], dLon = ((data[next * rowWidth + 1] - data[r * rowWidth + 1] + 540) % 360 - 180) * Math.cos(data[r * rowWidth] * Math.PI / 180);
    steps[k].push(Math.hypot(dLat, dLon) * kmPerDegree);
  }
  return Math.max(...steps.map(list => list.length ? list.sort((x, y) => x - y)[list.length >> 1] : 0));
}


/** Mean over a (2h+1) x (2h+1) box of the valid cells of a dense grid, NaN meaning no data; columns wrap when `wrap`. */
export function boxMean(grid: Float32Array, width: number, height: number, half: number, wrap: boolean) {
  const sum = new Float64Array((width + 1) * (height + 1)), count = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) { let rs = 0, rc = 0; for (let x = 0; x < width; x++) { const v = grid[y * width + x]; if (Number.isFinite(v)) { rs += v; rc++; }
    sum[(y + 1) * (width + 1) + x + 1] = sum[y * (width + 1) + x + 1] + rs; count[(y + 1) * (width + 1) + x + 1] = count[y * (width + 1) + x + 1] + rc; } }
  const rect = (table: Float64Array, x0: number, y0: number, x1: number, y1: number) => table[(y1 + 1) * (width + 1) + x1 + 1] - table[y0 * (width + 1) + x1 + 1] - table[(y1 + 1) * (width + 1) + x0] + table[y0 * (width + 1) + x0];
  const out = new Float32Array(width * height).fill(NaN);
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - half), y1 = Math.min(height - 1, y + half);
    for (let x = 0; x < width; x++) {
      if (!Number.isFinite(grid[y * width + x])) continue;
      let s = 0, c = 0;
      const spans = !wrap ? [[Math.max(0, x - half), Math.min(width - 1, x + half)]]
        : x - half < 0 ? [[0, x + half], [width + x - half, width - 1]] : x + half >= width ? [[x - half, width - 1], [0, x + half - width]] : [[x - half, x + half]];
      for (const [a, b] of spans) { s += rect(sum, a, y0, b, y1); c += rect(count, a, y0, b, y1); }
      out[y * width + x] = c ? s / c : NaN;
    }
  }
  return out;
}


/** One reduced cube projected at `ppd`: its header and, unless its band count differs from the stripe table, the cells
 * it covers with each parameter's values there. */
export async function projectReducedFile(recipe: VirRecipe, gain: number[][], work: string, name: string, ppd: number, fillMaximumStepKm = Infinity) {
  const header = JSON.parse(await readFile(resolve(work, name), 'utf8')) as Reduced;
  if (header.kept[1] - header.kept[0] + 1 !== gain.length) return { header, projected: null };
  const bytes = await readFile(resolve(work, name.replace(/\.json$/u, '.f32'))), data = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
  // A fill cube coarser than the coarsest primary cube would smear its few pixels over the gap; it is left out.
  const fill = recipe.phases.some(phase => phase.volume === header.volume && phase.role === 'fill');
  if (fill && header.records && pixelStepKm(recipe, header, data) > fillMaximumStepKm) return { header, projected: null };
  const cells: number[] = [], values: number[][] = recipe.parameters.map(() => []);
  projectCube(recipe, gain, header, data, ppd, (cell, v) => { cells.push(cell); v.forEach((x, i) => values[i].push(x)); });
  // ISIS3 noseam, per image: the high-pass part is the image minus its own box mean over `seamBoxCells`.
  const width = 360 * ppd, highPass: Float32Array<ArrayBuffer>[] = values.map(() => new Float32Array(cells.length));
  if (cells.length) {
    const cols = cells.map(cell => cell % width), rows = cells.map(cell => Math.floor(cell / width));
    // Unwrap the cube's columns across 0 degrees so its bounding box is contiguous.
    // Loops, not spreads: a distant cube can cover millions of cells.
    const extent = (list: number[]) => { let lo = Infinity, hi = -Infinity; for (const v of list) { if (v < lo) lo = v; if (v > hi) hi = v; } return [lo, hi]; };
    const [c0, c1] = extent(cols), shift = c1 - c0 > width / 2 ? width : 0, uc = cols.map(c => c < width / 2 ? c + shift : c);
    const [x0, x1] = extent(uc), [y0, y1] = extent(rows), w = x1 - x0 + 1, h = y1 - y0 + 1, half = (recipe.policy.seamBoxCells - 1) / 2;
    values.forEach((list, i) => {
      const grid = new Float32Array(w * h).fill(NaN);
      list.forEach((v, k) => { grid[(rows[k] - y0) * w + uc[k] - x0] = v; });
      const low = boxMean(grid, w, h, half, false);
      list.forEach((v, k) => { highPass[i][k] = v - low[(rows[k] - y0) * w + uc[k] - x0]; });
    });
  }
  return { header, projected: { cells: Int32Array.from(cells), values: values.map(list => Float32Array.from(list)), highPass } };
}
