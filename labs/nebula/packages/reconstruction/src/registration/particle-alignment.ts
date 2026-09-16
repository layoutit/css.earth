/** Offline comparison of an authored photograph placement and an unchanged stellar-particle projection. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import type { OverlayOptions } from 'sharp';

type Point = [number, number] | [number, number, number];
export interface ParticleAlignmentOptions {
  rotatedParticlePath: string;
  extractedPhotoPath: string;
  photoCenterKpc: Point;
  photoSpanKpc: [number, number];
  boundsKpc: { min: Point; max: Point };
  /** Longest image dimension; shorter dimension follows physical XY aspect ratio. */
  resolution: number;
  outputDirectory: string;
}

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const levels = [0.1, 0.3, 0.6];
function validate(options: ParticleAlignmentOptions) {
  const { boundsKpc, photoCenterKpc, photoSpanKpc, resolution } = options;
  for (const point of [boundsKpc.min, boundsKpc.max, photoCenterKpc]) {
    if (![2, 3].includes(point.length) || !point.every(Number.isFinite))
      throw new TypeError('Alignment coordinates must have two or three finite components.');
  }
  if (boundsKpc.min.length !== boundsKpc.max.length ||
      boundsKpc.min.some((value, axis) => value >= boundsKpc.max[axis]!))
    throw new TypeError('Alignment bounds must have matching, strictly increasing axes.');
  if (photoSpanKpc.length !== 2 || photoSpanKpc.some(value => !(value > 0 && Number.isFinite(value))))
    throw new TypeError('Photo span must contain two finite positive lengths.');
  if (!Number.isInteger(resolution) || resolution < 64 || resolution > 1024)
    throw new TypeError('Alignment resolution must be an integer from 64 to 1024.');
}

function projectMass(bytes: Buffer, options: ParticleAlignmentOptions, width: number, height: number) {
  if (!bytes.length || bytes.length % 16) throw new TypeError('Expected nonempty float32 LE [x,y,z,mass] particles.');
  const { min, max } = options.boundsKpc;
  const mass = new Float64Array(width * height);
  let inputMass = 0, acceptedMass = 0, acceptedCount = 0, weightedX = 0, weightedY = 0;
  for (let offset = 0; offset < bytes.length; offset += 16) {
    const point = [bytes.readFloatLE(offset), bytes.readFloatLE(offset + 4), bytes.readFloatLE(offset + 8)];
    const weight = bytes.readFloatLE(offset + 12);
    if (!point.every(Number.isFinite) || !(weight >= 0 && Number.isFinite(weight)))
      throw new TypeError(`Invalid particle at byte ${offset}.`);
    inputMass += weight;
    if (min.some((value, axis) => point[axis]! < value || point[axis]! > max[axis]!)) continue;
    acceptedCount++; acceptedMass += weight;
    weightedX += weight * point[0]!; weightedY += weight * point[1]!;
    const x = (point[0]! - min[0]) / (max[0] - min[0]) * width - 0.5;
    const y = (max[1] - point[1]!) / (max[1] - min[1]) * height - 0.5;
    const cells: { index: number; weight: number }[] = [];
    let sum = 0;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const px = Math.floor(x) + dx, py = Math.floor(y) + dy;
      if (px < 0 || px >= width || py < 0 || py >= height) continue;
      const fractionX = x - Math.floor(x), fractionY = y - Math.floor(y);
      const cellWeight = (dx ? fractionX : 1 - fractionX) * (dy ? fractionY : 1 - fractionY);
      cells.push({ index: py * width + px, weight: cellWeight }); sum += cellWeight;
    }
    for (const cell of cells) mass[cell.index] += weight * cell.weight / sum;
  }
  if (!(acceptedMass > 0)) throw new TypeError('No positive stellar mass falls within the diagnostic bounds.');
  return { mass, statistics: { inputCount: bytes.length / 16, acceptedCount, inputMass, acceptedMass,
    projectedMass: mass.reduce((sum, value) => sum + value, 0),
    centroidKpc: [weightedX / acceptedMass, weightedY / acceptedMass] } };
}

/** Bilinear interpolation of premultiplied display RGB, retaining extracted signal encoded in alpha. */
function photoSample(data: Buffer, width: number, height: number, u: number, v: number) {
  if (u < 0 || u > 1 || v < 0 || v > 1) return [0, 0, 0];
  const x = u * (width - 1), y = (1 - v) * (height - 1);
  const rgb = [0, 0, 0];
  for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
    const px = Math.min(width - 1, Math.floor(x) + dx), py = Math.min(height - 1, Math.floor(y) + dy);
    const weight = (dx ? x % 1 : 1 - x % 1) * (dy ? y % 1 : 1 - y % 1);
    const offset = 4 * (py * width + px), alpha = data[offset + 3]! / 255;
    for (let channel = 0; channel < 3; channel++) rgb[channel] += weight * alpha * data[offset + channel]!;
  }
  return rgb;
}

function mapPhoto(data: Buffer, photoWidth: number, photoHeight: number,
  options: ParticleAlignmentOptions, width: number, height: number) {
  const image = Buffer.alloc(width * height * 3), { min, max } = options.boundsKpc;
  let signal = 0, weightedX = 0, weightedY = 0;
  for (let py = 0; py < height; py++) for (let px = 0; px < width; px++) {
    const x = min[0] + (px + 0.5) / width * (max[0] - min[0]);
    const y = max[1] - (py + 0.5) / height * (max[1] - min[1]);
    const u = 0.5 + (x - options.photoCenterKpc[0]) / options.photoSpanKpc[0];
    const v = 0.5 + (y - options.photoCenterKpc[1]) / options.photoSpanKpc[1];
    const rgb = photoSample(data, photoWidth, photoHeight, u, v);
    for (let channel = 0; channel < 3; channel++) image[3 * (py * width + px) + channel] = Math.round(rgb[channel]!);
    const luminance = (0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!) / 255;
    signal += luminance; weightedX += x * luminance; weightedY += y * luminance;
  }
  return { image, statistics: { summedDisplayLuminance: signal,
    centroidKpc: signal > 0 ? [weightedX / signal, weightedY / signal] : null } };
}

function markFootprint(image: Buffer, options: ParticleAlignmentOptions, width: number, height: number) {
  const { min, max } = options.boundsKpc;
  const px = (value: number) => Math.round((value - min[0]) / (max[0] - min[0]) * width - 0.5);
  const py = (value: number) => Math.round((max[1] - value) / (max[1] - min[1]) * height - 0.5);
  const left = px(options.photoCenterKpc[0] - options.photoSpanKpc[0] / 2);
  const right = px(options.photoCenterKpc[0] + options.photoSpanKpc[0] / 2);
  const top = py(options.photoCenterKpc[1] + options.photoSpanKpc[1] / 2);
  const bottom = py(options.photoCenterKpc[1] - options.photoSpanKpc[1] / 2);
  const paint = (x: number, y: number, rgb: number[]) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    for (let channel = 0; channel < 3; channel++) image[3 * (y * width + x) + channel] = rgb[channel]!;
  };
  for (let x = Math.max(0, left); x <= Math.min(width - 1, right); x++) {
    paint(x, top, [190, 100, 200]); paint(x, bottom, [190, 100, 200]);
  }
  for (let y = Math.max(0, top); y <= Math.min(height - 1, bottom); y++) {
    paint(left, y, [190, 100, 200]); paint(right, y, [190, 100, 200]);
  }
  for (let delta = -4; delta <= 4; delta++) {
    paint(px(0) + delta, py(0), [255, 220, 100]); paint(px(0), py(0) + delta, [255, 220, 100]);
  }
}

export async function createParticleAlignmentDiagnostic(options: ParticleAlignmentOptions) {
  validate(options);
  const [particleBytes, photoBytes] = await Promise.all([
    readFile(options.rotatedParticlePath), readFile(options.extractedPhotoPath),
  ]);
  const photo = await sharp(photoBytes).rotate().ensureAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  const spanX = options.boundsKpc.max[0] - options.boundsKpc.min[0];
  const spanY = options.boundsKpc.max[1] - options.boundsKpc.min[1];
  const width = Math.max(1, Math.round(options.resolution * spanX / Math.max(spanX, spanY)));
  const height = Math.max(1, Math.round(options.resolution * spanY / Math.max(spanX, spanY)));
  const projected = projectMass(particleBytes, options, width, height);
  const mapped = mapPhoto(photo.data, photo.info.width, photo.info.height, options, width, height);
  const density = Buffer.alloc(width * height * 3), overlay = Buffer.from(mapped.image);
  const peak = projected.mass.reduce((value, next) => Math.max(value, next), 0);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = y * width + x, value = projected.mass[index]! / peak;
    const shade = Math.round(255 * Math.log1p(99 * value) / Math.log(100));
    density.fill(shade, index * 3, index * 3 + 3);
    const neighbours = [x + 1 < width ? projected.mass[index + 1]! / peak : value,
      y + 1 < height ? projected.mass[index + width]! / peak : value];
    const edge = levels.some(level => neighbours.some(next => (value >= level) !== (next >= level)));
    if (edge) for (let channel = 0; channel < 3; channel++) {
      overlay[index * 3 + channel] = Math.round(0.3 * overlay[index * 3 + channel]! + 0.7 * [30, 240, 220][channel]!);
    }
  }
  const panels = [mapped.image, density, overlay];
  for (const panel of panels) markFootprint(panel, options, width, height);
  const gap = 12, top = 44, footer = 110, totalWidth = width * 3 + gap * 4;
  const composites: OverlayOptions[] = [];
  const text = async (content: string, textWidth: number, size = 15) => sharp({ text: {
    text: `<span foreground="#eeeeee">${content}</span>`, font: `sans ${size}`, rgba: true, width: textWidth,
  } }).png().toBuffer();
  const titles = ['PHOTO: RGB × ALPHA', 'STELLAR COLUMN MASS (LOG)', 'PHOTO + MASS CONTOURS'];
  for (let index = 0; index < panels.length; index++) {
    const left = gap + index * (width + gap);
    composites.push({ input: panels[index], raw: { width, height, channels: 3 }, left, top });
    composites.push({ input: await text(titles[index]!, width), left, top: 12 });
  }
  const description = 'AUTHORED ALIGNMENT — no astrometric fit, rescaling or coordinate warp.\n' +
    `Same XY pixels: X ${options.boundsKpc.min[0]} to ${options.boundsKpc.max[0]} kpc; ` +
    `Y ${options.boundsKpc.min[1]} to ${options.boundsKpc.max[1]} kpc (up). ` +
    `${options.boundsKpc.min.length === 3 ? `Z restricted to ${options.boundsKpc.min[2]}…${options.boundsKpc.max[2]} kpc.` : 'All Z included.'}\n` +
    'Purple: photo footprint. Gold: local origin. Cyan: 10, 30, 60% of peak column mass.\n' +
    'Density logarithm is display-only; brightness and contour similarity are not quantitative fit scores.';
  composites.push({ input: await text(description, totalWidth - 24, 13), left: 12, top: top + height + 12 });
  const png = await sharp({ create: { width: totalWidth, height: top + height + footer,
    channels: 3, background: '#101116' } }).composite(composites).png().toBuffer();
  await mkdir(options.outputDirectory, { recursive: true });
  const comparison = 'alignment-comparison.png';
  await writeFile(resolve(options.outputDirectory, comparison), png);
  const receipt = {
    schema: 'cssearth-particle-alignment-diagnostic@1',
    inputs: { particles: { path: options.rotatedParticlePath, sha256: hash(particleBytes), bytes: particleBytes.length },
      photo: { path: options.extractedPhotoPath, sha256: hash(photoBytes), bytes: photoBytes.length } },
    mapping: { photoCenterKpc: options.photoCenterKpc, photoSpanKpc: options.photoSpanKpc, boundsKpc: options.boundsKpc,
      width, height, kpcPerPixel: [spanX / width, spanY / height], yDirection: 'up',
      projection: 'Orthographic XY. Input particle XYZ unchanged; optional authored Z bounds select the same display region.' },
    mass: projected.statistics, photo: mapped.statistics,
    interpretation: { alignment: 'Authored placement, not an astrometric correspondence or fitted transformation.',
      mass: 'Raw source-unit stellar mass deposited by boundary-normalized 2D CIC; no smoothing.',
      photo: 'Extracted straight display RGB multiplied by alpha, bilinearly sampled in premultiplied form.',
      densityDisplay: 'log(1 + 99 × columnMass / peakColumnMass) / log(100)',
      contourFractionsOfPeakMass: levels,
      centroids: 'Independent raw mass and display-luminance centroids; not a goodness-of-fit statistic.' },
    outputs: { comparison, sha256: hash(png), bytes: png.length },
  };
  await writeFile(resolve(options.outputDirectory, 'alignment-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  return receipt;
}
