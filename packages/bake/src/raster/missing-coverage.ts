export interface CoverageRaster { width: number; height: number; channels: number; }
// Prepare-only cartographic styling. Gray is a data gap, never inferred terrain.
// Images without validity channels may restrict exact black fill to a polar edge.
// Interior photographed black and nonzero edge pixels remain observations.
export function blackFillCoverage(data: Uint8Array, { width, height, channels }: CoverageRaster, { southConnected = false, northConnected = false } = {}) {
  const missing = new Uint8Array(width * height);
  const black = (i: number) => {
    for (let c = 0; c < channels; c++) if (data[i * channels + c] !== 0) return false;
    return true;
  };
  if (!southConnected && !northConnected) {
    for (let i = 0; i < missing.length; i++) missing[i] = Number(black(i));
    return missing;
  }
  const queue = new Uint32Array(width * height);
  let head = 0, tail = 0;
  const visit = (i: number) => {
    if (!missing[i] && black(i)) { missing[i] = 1; queue[tail++] = i; }
  };
  for (let x = 0; x < width; x++) {
    if (northConnected) visit(x);
    if (southConnected) visit((height - 1) * width + x);
  }
  while (head < tail) {
    const i = queue[head++], x = i % width;
    if (i >= width) visit(i - width);
    if (i + width < missing.length) visit(i + width);
    visit(x === 0 ? i + width - 1 : i - 1);
    visit(x === width - 1 ? i - width + 1 : i + 1);
  }
  return missing;
}

export function sampleCoverage(missing: Uint8Array, source: Pick<CoverageRaster, "width" | "height">, width: number, height: number) {
  const output = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sx = Math.min(source.width - 1, Math.floor((x + 0.5) * source.width / width));
    const sy = Math.min(source.height - 1, Math.floor((y + 0.5) * source.height / height));
    output[y * width + x] = missing[sy * source.width + sx];
  }
  return output;
}

/** Named fills for a data gap. `gray` is the shared cartographic default every mapped body uses. `dark` keeps the same
 * graticule on a black ground, for a body whose observed side is a self-luminous image on the sky rather than a lit map:
 * grey there reads as a second, dimmer surface, and black reads as the absence the gap is. */
export const MISSING_COVERAGE_STYLES = Object.freeze({
  gray: Object.freeze({ base: Object.freeze([82, 84, 82]), line: Object.freeze([112, 115, 111]) }),
  dark: Object.freeze({ base: Object.freeze([0, 0, 0]), line: Object.freeze([130, 48, 40]) }),
});
export type MissingCoverageStyle = keyof typeof MISSING_COVERAGE_STYLES;
export const isMissingCoverageStyle = (value: unknown): value is MissingCoverageStyle =>
  typeof value === 'string' && Object.hasOwn(MISSING_COVERAGE_STYLES, value);

export function missingCoverageColor(longitude: number, latitude: number, pixelDegrees: number, style: MissingCoverageStyle = 'gray') {
  const { base, line } = MISSING_COVERAGE_STYLES[style];
  const distance = (angle: number, step: number) => Math.abs(angle - Math.round(angle / step) * step);
  const parallel = distance(latitude, 10);
  const meridian = distance(longitude, 30) * Math.cos(latitude * Math.PI / 180);
  // Fade converging meridians at the pole so they do not become a bright disk.
  const poleFade = Math.max(0, Math.min(1, (88 - Math.abs(latitude)) / 8));
  const stroke = (d: number) => Math.max(0, Math.min(1, (0.16 + pixelDegrees / 2 - d) / pixelDegrees));
  // Do not straddle the equatorial atlas seam with a painted parallel.
  const amount = Math.max(Math.abs(latitude) > 1 && Math.abs(latitude) < 88 ? stroke(parallel) : 0, stroke(meridian) * poleFade);
  return base.map((value, c) => Math.round(value + (line[c] - value) * amount));
}

export function paintMissingCoverage(data: Uint8Array, { width, height, channels }: CoverageRaster, missing: Uint8Array, style: MissingCoverageStyle = 'gray') {
  if (missing.length !== width * height || data.length !== width * height * channels || channels !== 3) {
    throw new Error("Coverage and RGB raster dimensions must match.");
  }
  const output = Buffer.from(data), pixelDegrees = 180 / height;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!missing[y * width + x]) continue;
    const color = missingCoverageColor((x + 0.5) * 360 / width, 90 - (y + 0.5) * pixelDegrees, pixelDegrees, style);
    const i = (y * width + x) * channels;
    for (let c = 0; c < channels; c++) output[i + c] = color[c];
  }
  return output;
}

/** Find the gray gap fill in a lossy copy of a painted map, such as a minimap. A pixel is a candidate when it is within
 * `tolerance` of the fill colour at its own map position. The fill's graticule lines are the evidence: a candidate region inside
 * one graticule cell is a gap when most of the line pixels bordering it carry the painted line, which a gray surface of the
 * fill's tone does not. `longitudeOffsetDegrees` is the map longitude of the copy's left edge when the copy was rolled (a framed
 * minimap). */
export function detectMissingCoverage(data: Uint8Array, { width, height, channels }: CoverageRaster, { longitudeOffsetDegrees = 0, tolerance = 10 } = {}) {
  if (data.length !== width * height * channels || channels < 3) throw new Error("Coverage detection needs an RGB raster of the stated size.");
  const count = width * height, pixelDegrees = 180 / height, { base } = MISSING_COVERAGE_STYLES.gray;
  // `wall`: a pixel within a pixel of a graticule line, which separates cells. `onLine`: a wall pixel whose painted line is
  // strong enough (a third of the way to the line colour) to tell a painted gap from a surface of the base tone.
  const candidate = new Uint8Array(count), onLine = new Uint8Array(count), wall = new Uint8Array(count);
  const near = (angle: number, step: number) => Math.abs(angle - Math.round(angle / step) * step);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x, longitude = ((x + 0.5) * 360 / width + longitudeOffsetDegrees) % 360, latitude = 90 - (y + 0.5) * pixelDegrees;
    const color = missingCoverageColor(longitude, latitude, pixelDegrees);
    wall[i] = Number(Math.abs(latitude) > 1 && Math.abs(latitude) < 88 && near(latitude, 10) < pixelDegrees ||
      Math.abs(latitude) < 80 && near(longitude, 30) * Math.cos(latitude * Math.PI / 180) < pixelDegrees);
    onLine[i] = Number(wall[i] && color[0] - base[0] >= 10);
    candidate[i] = Number(color.every((value, c) => Math.abs(data[i * channels + c] - value) <= tolerance));
  }
  const neighbours = (i: number) => { const x = i % width;
    return [i >= width ? i - width : -1, i + width < count ? i + width : -1, x === 0 ? i + width - 1 : i - 1, x === width - 1 ? i - width + 1 : i + 1]; };
  const missing = new Uint8Array(count), seen = new Uint8Array(count), border = new Uint32Array(count), queue = new Uint32Array(count);
  let stamp = 0;
  for (let start = 0; start < count; start++) {
    if (!candidate[start] || wall[start] || seen[start]) continue;
    // One region: candidates connected without crossing a wall, so it stays inside one graticule cell.
    let head = 0, tail = 0, lines = 0, painted = 0;
    stamp++; seen[start] = 1; queue[tail++] = start;
    // Evidence is read up to two pixels into a wall: its first pixel can be the faint edge of the painted line.
    const evidence = (j: number, depth: number) => {
      if (border[j] === stamp) return;
      border[j] = stamp;
      if (onLine[j]) { lines++; painted += candidate[j]!; }
      if (depth < 2) for (const k of neighbours(j)) if (k >= 0 && wall[k]) evidence(k, depth + 1);
    };
    while (head < tail) {
      for (const j of neighbours(queue[head++]!)) {
        if (j < 0) continue;
        if (wall[j]) evidence(j, 1);
        else if (candidate[j] && !seen[j]) { seen[j] = 1; queue[tail++] = j; }
      }
    }
    if (lines >= 4 && painted * 2 > lines) for (let k = 0; k < tail; k++) missing[queue[k]!] = 1;
  }
  // A wall pixel is a gap where it matches the fill and touches a gap, spreading through the wall's width.
  let tail = 0;
  for (let i = 0; i < count; i++) if (missing[i]) queue[tail++] = i;
  for (let head = 0; head < tail;) {
    for (const j of neighbours(queue[head++]!)) if (j >= 0 && wall[j] && candidate[j] && !missing[j]) { missing[j] = 1; queue[tail++] = j; }
  }
  return missing;
}
