// Prepare-only cartographic styling. Gray is a data gap, never inferred terrain.
// The JPEG has no validity channel: conservatively use only exactly black pixels
// connected to its southern border. Nonzero JPEG edge pixels remain untouched.
export function blackFillCoverage(data, { width, height, channels }, { southConnected = false } = {}) {
  const missing = new Uint8Array(width * height);
  const black = (i) => {
    for (let c = 0; c < channels; c++) if (data[i * channels + c] !== 0) return false;
    return true;
  };
  if (!southConnected) {
    for (let i = 0; i < missing.length; i++) missing[i] = Number(black(i));
    return missing;
  }
  const queue = new Uint32Array(width * height);
  let head = 0, tail = 0;
  const visit = (i) => {
    if (!missing[i] && black(i)) { missing[i] = 1; queue[tail++] = i; }
  };
  for (let x = 0; x < width; x++) visit((height - 1) * width + x);
  while (head < tail) {
    const i = queue[head++], x = i % width;
    if (i >= width) visit(i - width);
    if (i + width < missing.length) visit(i + width);
    visit(x === 0 ? i + width - 1 : i - 1);
    visit(x === width - 1 ? i - width + 1 : i + 1);
  }
  return missing;
}

export function sampleCoverage(missing, source, width, height) {
  const output = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sx = Math.min(source.width - 1, Math.floor((x + 0.5) * source.width / width));
    const sy = Math.min(source.height - 1, Math.floor((y + 0.5) * source.height / height));
    output[y * width + x] = missing[sy * source.width + sx];
  }
  return output;
}

export function paintMissingCoverage(data, { width, height, channels }, missing) {
  if (missing.length !== width * height || data.length !== width * height * channels || channels !== 3) {
    throw new Error("Pluto coverage and RGB raster dimensions must match.");
  }
  const output = Buffer.from(data);
  const base = [82, 84, 82], line = [112, 115, 111];
  const distance = (angle, step) => Math.abs(angle - Math.round(angle / step) * step);
  const pixelDegrees = 180 / height;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!missing[y * width + x]) continue;
    const latitude = 90 - (y + 0.5) * pixelDegrees;
    const longitude = (x + 0.5) * 360 / width;
    const parallel = distance(latitude, 10);
    const meridian = distance(longitude, 30) * Math.cos(latitude * Math.PI / 180);
    // Fade converging meridians at the pole so they do not become a bright disk.
    const poleFade = Math.max(0, Math.min(1, (88 - Math.abs(latitude)) / 8));
    const stroke = (d) => Math.max(0, Math.min(1, (0.16 + pixelDegrees / 2 - d) / pixelDegrees));
    // Do not straddle the equatorial atlas seam with a painted parallel.
    const amount = Math.max(Math.abs(latitude) > 1 && Math.abs(latitude) < 88 ? stroke(parallel) : 0, stroke(meridian) * poleFade);
    const i = (y * width + x) * channels;
    for (let c = 0; c < channels; c++) output[i + c] = Math.round(base[c] + (line[c] - base[c]) * amount);
  }
  return output;
}
