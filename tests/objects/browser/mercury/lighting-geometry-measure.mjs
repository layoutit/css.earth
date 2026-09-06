// Pixel measurements for the Mercury lighting and sky geometry browser suite.
// Every function takes a PNG buffer (a Playwright screenshot) and reads what is
// painted; nothing here knows about the scene's internal state.

import sharp from "sharp";

export async function decodeLuminance(image) {
  const { data, info } = await sharp(image).raw().toBuffer({
    resolveWithObject: true,
  });
  const { width, height, channels } = info;
  const luminance = new Float32Array(width * height);
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * channels;
    luminance[index] = 0.2126 * data[offset] + 0.7152 * data[offset + 1] +
      0.0722 * data[offset + 2];
  }
  return { width, height, luminance };
}

// The body's silhouette against black (lighting overlay hidden): its centroid
// and equivalent radius, so lighting is measured about the painted disc
// rather than the overlay's layout box.
export async function discSilhouette(image, { threshold = 8 } = {}) {
  const { width, height, luminance } = await decodeLuminance(image);
  let count = 0;
  let sumX = 0;
  let sumY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (luminance[y * width + x] <= threshold) continue;
      count += 1;
      sumX += x + 0.5;
      sumY += y + 0.5;
    }
  }
  if (count === 0) return { pixels: 0, centre: null, radius: 0 };
  return {
    pixels: count,
    centre: [sumX / count, sumY / count],
    radius: Math.sqrt(count / Math.PI),
  };
}

// Centroid of the disc's luminance above the night level (screen
// coordinates, y down) and the lit direction it implies (0 right, 90 up, 180
// left). Weighting by the excess over the threshold keeps the faint night-side
// gradient from pulling a thin crescent's centroid toward the disc centre.
export async function discLighting(image, {
  radiusShare = 0.95,
  threshold = 0,
  disc = null,
} = {}) {
  const { width, height, luminance } = await decodeLuminance(image);
  const centerX = disc?.centre[0] ?? width / 2;
  const centerY = disc?.centre[1] ?? height / 2;
  const radius = (disc?.radius ?? Math.min(centerX, centerY)) * radiusShare;
  let weight = 0;
  let momentX = 0;
  let momentY = 0;
  const values = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (Math.hypot(x + 0.5 - centerX, y + 0.5 - centerY) > radius) continue;
      const value = luminance[y * width + x];
      values.push(value);
      const excess = Math.max(0, value - threshold);
      weight += excess;
      momentX += excess * (x + 0.5 - centerX);
      momentY += excess * (y + 0.5 - centerY);
    }
  }
  values.sort((a, b) => a - b);
  const percentile = (share) => values[Math.floor((values.length - 1) * share)];
  return {
    litDirectionDegrees: Math.atan2(-momentY / weight, momentX / weight) *
      180 / Math.PI,
    centroidRadiusShare: Math.hypot(momentX / weight, momentY / weight) /
      radius,
    discPixels: values.length,
    percentiles: {
      p02: percentile(0.02),
      p05: percentile(0.05),
      p10: percentile(0.1),
      p25: percentile(0.25),
      p50: percentile(0.5),
      p75: percentile(0.75),
      p95: percentile(0.95),
      p995: percentile(0.995),
    },
  };
}

// Share of the disc brighter than a fixed luminance threshold: the
// illuminated fraction, with the threshold placed between the night side and
// the lit side.
export async function illuminatedShare(image, {
  radiusShare = 0.95,
  threshold,
  disc = null,
}) {
  const { width, height, luminance } = await decodeLuminance(image);
  const centerX = disc?.centre[0] ?? width / 2;
  const centerY = disc?.centre[1] ?? height / 2;
  const radius = (disc?.radius ?? Math.min(centerX, centerY)) * radiusShare;
  let inside = 0;
  let lit = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (Math.hypot(x + 0.5 - centerX, y + 0.5 - centerY) > radius) continue;
      inside += 1;
      if (luminance[y * width + x] > threshold) lit += 1;
    }
  }
  return lit / inside;
}

// The terminator as a fitted straight line: along rows through the disc, the
// position where luminance crosses the threshold on the way from the lit
// side to the dark side. Returns the line angle (degrees from horizontal, y
// up, in [0, 180)) and the fit residual in pixels.
export async function terminatorLine(image, {
  threshold,
  litDirectionDegrees,
  rowShare = 0.6,
  radiusShare = 0.95,
  disc = null,
}) {
  const { width, height, luminance } = await decodeLuminance(image);
  const centerX = disc?.centre[0] ?? width / 2;
  const centerY = disc?.centre[1] ?? height / 2;
  const radius = (disc?.radius ?? Math.min(centerX, centerY)) * radiusShare;
  // Walk each row from the lit side toward the dark side.
  const litOnRight = Math.cos(litDirectionDegrees * Math.PI / 180) > 0;
  const points = [];
  const smoothed = new Float32Array(width);
  for (let y = Math.round(centerY - radius * rowShare);
    y <= Math.round(centerY + radius * rowShare); y += 2) {
    const dy = y + 0.5 - centerY;
    const half = Math.sqrt(Math.max(0, radius * radius - dy * dy)) * 0.9;
    const start = Math.round(centerX - half);
    const end = Math.round(centerX + half);
    if (end - start < 8) continue;
    for (let x = start; x <= end; x += 1) {
      let sum = 0;
      let count = 0;
      for (let d = -2; d <= 2; d += 1) {
        const xx = x + d;
        if (xx < start || xx > end) continue;
        sum += luminance[y * width + xx];
        count += 1;
      }
      smoothed[x] = sum / count;
    }
    let crossing = null;
    if (litOnRight) {
      for (let x = end; x > start; x -= 1) {
        if (smoothed[x] > threshold && smoothed[x - 1] <= threshold) {
          crossing = x - 0.5;
          break;
        }
      }
    } else {
      for (let x = start; x < end; x += 1) {
        if (smoothed[x] > threshold && smoothed[x + 1] <= threshold) {
          crossing = x + 0.5;
          break;
        }
      }
    }
    if (crossing !== null) points.push([crossing, y + 0.5]);
  }
  if (points.length < 10) {
    return { angleDegrees: NaN, residualPixels: NaN, points: points.length };
  }
  // Fit x = a * y + b (the terminator is near vertical).
  let sumY = 0;
  let sumX = 0;
  let sumYY = 0;
  let sumXY = 0;
  for (const [x, y] of points) {
    sumY += y;
    sumX += x;
    sumYY += y * y;
    sumXY += x * y;
  }
  const n = points.length;
  const a = (n * sumXY - sumX * sumY) / (n * sumYY - sumY * sumY);
  const b = (sumX - a * sumY) / n;
  let residual = 0;
  for (const [x, y] of points) residual += (x - (a * y + b)) ** 2;
  // Direction vector (a, 1) in y-down screen space; y up flips the sign.
  const angle = (Math.atan2(-1, a) * 180 / Math.PI + 360) % 180;
  return {
    angleDegrees: angle,
    residualPixels: Math.sqrt(residual / n),
    points: n,
    centreOffsetPixels: a * centerY + b - centerX,
  };
}

// Centroid of pixels brighter than the threshold: the position of a lone
// bright blob (the Sun sprite on an otherwise dark stage).
export async function brightBlob(image, { threshold = 48 } = {}) {
  const { width, height, luminance } = await decodeLuminance(image);
  let weight = 0;
  let momentX = 0;
  let momentY = 0;
  let count = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = luminance[y * width + x];
      if (value <= threshold) continue;
      const k = value - threshold;
      count += 1;
      weight += k;
      momentX += k * (x + 0.5);
      momentY += k * (y + 0.5);
    }
  }
  if (count === 0) return { pixels: 0, centre: null };
  return { pixels: count, centre: [momentX / weight, momentY / weight] };
}

// The diffuse Milky Way band: blurred luminance above its 90th percentile,
// weighted by the excess; plus the brightest blurred pixel.
export async function milkyWayBand(image, { blurSigma = 12 } = {}) {
  const { width, height, luminance } = await decodeLuminance(image);
  const blurred = await blurLuminance(luminance, width, height, blurSigma);
  const sorted = Array.from(blurred).sort((a, b) => a - b);
  const threshold = sorted[Math.floor(sorted.length * 0.9)];
  const samples = [];
  let peakValue = -1;
  let peak = null;
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const value = blurred[y * width + x];
      if (value > peakValue) {
        peakValue = value;
        peak = [x + 0.5, y + 0.5];
      }
      if (value > threshold) samples.push([x, y, value - threshold]);
    }
  }
  return {
    samples,
    peak,
    peakValue,
    threshold,
    meanLuminance: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
  };
}

// Compact bright objects stand out as local mean minus wide mean. Returns a
// finder that locates the strongest detail peak inside a window.
export async function detailField(image, { narrowSigma, wideSigma }) {
  const { width, height, luminance } = await decodeLuminance(image);
  const narrow = await blurLuminance(luminance, width, height, narrowSigma);
  const wide = await blurLuminance(luminance, width, height, wideSigma);
  const detail = new Float32Array(width * height);
  for (let index = 0; index < detail.length; index += 1) {
    detail[index] = narrow[index] - wide[index];
  }
  return {
    width,
    height,
    peakNear([px, py], radius) {
      let best = -Infinity;
      let at = null;
      const x0 = Math.max(0, Math.floor(px - radius));
      const x1 = Math.min(width - 1, Math.ceil(px + radius));
      const y0 = Math.max(0, Math.floor(py - radius));
      const y1 = Math.min(height - 1, Math.ceil(py + radius));
      for (let y = y0; y <= y1; y += 1) {
        for (let x = x0; x <= x1; x += 1) {
          if (Math.hypot(x + 0.5 - px, y + 0.5 - py) > radius) continue;
          const value = detail[y * width + x];
          if (value > best) {
            best = value;
            at = [x + 0.5, y + 0.5];
          }
        }
      }
      return { value: best, at };
    },
    // Typical detail amplitude, to scale the peak threshold.
    spread() {
      let sum = 0;
      for (let index = 0; index < detail.length; index += 7) {
        sum += Math.abs(detail[index]);
      }
      return sum / Math.ceil(detail.length / 7);
    },
  };
}

// Translation between two screenshots inside a window, by normalised cross-
// correlation of high-passed luminance at half resolution. `expected` centres
// the search; `radius` bounds it (both in full-resolution pixels).
export async function estimateShift(before, after, {
  window,
  expected = [0, 0],
  radius = 40,
  scale = 2,
}) {
  const [a, b] = await Promise.all([before, after].map((image) =>
    highPassedWindow(image, window, scale)));
  const width = a.width;
  const height = a.height;
  const ex = Math.round(expected[0] / scale);
  const ey = Math.round(expected[1] / scale);
  const r = Math.ceil(radius / scale);
  let best = { score: -Infinity, shift: null };
  const scores = [];
  for (let dy = ey - r; dy <= ey + r; dy += 1) {
    for (let dx = ex - r; dx <= ex + r; dx += 1) {
      // Pixel (x, y) in `before` lands at (x + dx, y + dy) in `after`.
      const x0 = Math.max(0, -dx);
      const x1 = Math.min(width, width - dx);
      const y0 = Math.max(0, -dy);
      const y1 = Math.min(height, height - dy);
      if (x1 - x0 < width * 0.4 || y1 - y0 < height * 0.4) continue;
      let sumAB = 0;
      let sumAA = 0;
      let sumBB = 0;
      for (let y = y0; y < y1; y += 1) {
        const rowA = y * width;
        const rowB = (y + dy) * width + dx;
        for (let x = x0; x < x1; x += 1) {
          const va = a.data[rowA + x];
          const vb = b.data[rowB + x];
          sumAB += va * vb;
          sumAA += va * va;
          sumBB += vb * vb;
        }
      }
      const score = sumAB / Math.sqrt(sumAA * sumBB + 1e-9);
      scores.push([dx, dy, score]);
      if (score > best.score) best = { score, shift: [dx, dy] };
    }
  }
  if (!best.shift) return { shift: null, score: -1, distinctness: 0 };
  // Distinctness: the best score outside a 3-pixel neighbourhood of the peak.
  let runnerUp = -Infinity;
  for (const [dx, dy, score] of scores) {
    if (Math.hypot(dx - best.shift[0], dy - best.shift[1]) <= 3) continue;
    runnerUp = Math.max(runnerUp, score);
  }
  return {
    shift: [best.shift[0] * scale, best.shift[1] * scale],
    score: best.score,
    distinctness: best.score - runnerUp,
  };
}

async function highPassedWindow(image, { x, y, width, height }, scale) {
  const w = Math.floor(width / scale);
  const h = Math.floor(height / scale);
  const { data, info } = await sharp(image)
    .extract({ left: Math.round(x), top: Math.round(y),
      width: Math.round(width), height: Math.round(height) })
    .resize(w, h, { kernel: "lanczos3" })
    .removeAlpha()
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const luminance = new Float32Array(w * h);
  for (let index = 0; index < w * h; index += 1) {
    luminance[index] = data[index * info.channels];
  }
  const smooth = await blurLuminance(luminance, w, h, 6);
  const fine = await blurLuminance(luminance, w, h, 0.8);
  const out = new Float32Array(w * h);
  for (let index = 0; index < w * h; index += 1) {
    out[index] = fine[index] - smooth[index];
  }
  return { width: w, height: h, data: out };
}

async function blurLuminance(luminance, width, height, sigma) {
  const clamped = new Uint8Array(width * height);
  for (let index = 0; index < clamped.length; index += 1) {
    clamped[index] = Math.max(0, Math.min(255, Math.round(luminance[index])));
  }
  const { data, info } = await sharp(Buffer.from(clamped), {
    raw: { width, height, channels: 1 },
  }).blur(sigma).raw().toBuffer({ resolveWithObject: true });
  const out = new Float32Array(width * height);
  for (let index = 0; index < out.length; index += 1) {
    out[index] = data[index * info.channels];
  }
  return out;
}
