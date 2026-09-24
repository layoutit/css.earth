#!/usr/bin/env node
/** Measure a radio continuum image, and compare one against another.
 *
 *   node tools/objects/interferometry/alma-image.mts <image.fits> [<other.fits>]
 *
 * A restored image is judged against the archive's own image of the same visibilities: the two should put the same source at
 * the same size with the same peak, through beams of the same shape. Where they differ, the difference is the route's, and it
 * is stated rather than hidden — this route does not reproduce the pipeline's renormalisation or its self-calibration, so
 * equality is not expected and the numbers say by how much.
 *
 * Everything here is measured on the image's own grid: an ALMA product states its pixel scale and restoring beam in its
 * header, and the two images being compared may have neither in common. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFitsHeader, type FitsHeader } from '../../fits/fits.mts';
import { flagValue, positionalArguments } from '@cssearth/core';

export interface ContinuumImage {
  readonly width: number; readonly height: number;
  /** Pixel size in milliarcseconds; ALMA writes square pixels. */
  readonly pixelMas: number;
  readonly beamMajorMas: number; readonly beamMinorMas: number; readonly beamAngleDegrees: number;
  readonly header: FitsHeader;
  readonly at: (x: number, y: number) => number;
}

const number = (header: FitsHeader, key: string) => {
  const value = header[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`A continuum image states a numeric ${key}.`);
  return value;
};

/** One ALMA continuum image: a single plane of 32-bit samples over two sky axes, with its beam.
 *
 * A restored image states its beam. A CLEAN residual does not — nothing has been convolved into it — so a caller measuring
 * the residual of an image it also has passes that image's beam, which is the one that applies. */
export function readContinuumImage(bytes: Buffer, beam?: Pick<ContinuumImage, 'beamMajorMas' | 'beamMinorMas' | 'beamAngleDegrees'>): ContinuumImage {
  const { header, dataOffset } = readFitsHeader(bytes);
  const width = number(header, 'NAXIS1'), height = number(header, 'NAXIS2');
  if (number(header, 'BITPIX') !== -32) throw new TypeError('A continuum image is 32-bit floating point.');
  const scale = Math.abs(number(header, 'CDELT1')) * 3.6e6;
  if (Math.abs(Math.abs(number(header, 'CDELT2')) * 3.6e6 - scale) > 1e-9) throw new TypeError('A continuum image has square pixels.');
  const stated = header.BMAJ !== undefined || beam === undefined;
  return { width, height, pixelMas: scale,
    beamMajorMas: stated ? number(header, 'BMAJ') * 3.6e6 : beam.beamMajorMas,
    beamMinorMas: stated ? number(header, 'BMIN') * 3.6e6 : beam.beamMinorMas,
    beamAngleDegrees: stated ? number(header, 'BPA') : beam.beamAngleDegrees,
    header, at: (x, y) => bytes.readFloatBE(dataOffset + 4 * (y * width + x)) };
}

export interface SourceMeasurement {
  readonly peak: number; readonly noise: number; readonly signalToNoise: number;
  /** Flux-weighted centre of everything above half the peak, in pixels. */
  readonly centreX: number; readonly centreY: number;
  /** Azimuthally averaged half-power diameter, interpolated between radial bins. */
  readonly halfPowerDiameterMas: number;
  /** How many beam areas the half-power disc covers: the independent samples across the face. */
  readonly beamAreas: number;
}

/** The brightest source near the middle of the image, and its size. The pointing centre is where ALMA put the target, so the
 * search is bounded to the middle rather than scanning a field that may hold other sources.
 *
 * `reachMas` is how far from the peak the centroid and the radial profile are taken. A star is a few beams across and the
 * default is ample; a resolved body is not — Europa's disc is 770 mas, six times the default — and a reach shorter than the
 * source stops the profile before it crosses half the peak and reports the box instead of the disc. */
export function measureSource(image: ContinuumImage, searchMas = 700, reachMas = 120): SourceMeasurement {
  const half = Math.min(Math.floor(Math.min(image.width, image.height) / 2) - 2, Math.ceil(searchMas / image.pixelMas));
  const cx = Math.round(image.width / 2), cy = Math.round(image.height / 2);
  let peak = -Infinity, px = cx, py = cy;
  for (let y = cy - half; y <= cy + half; y++) for (let x = cx - half; x <= cx + half; x++) {
    const value = image.at(x, y);
    if (value > peak) { peak = value; px = x; py = y; }
  }
  const reach = Math.ceil(reachMas / image.pixelMas);
  let sx = 0, sy = 0, weight = 0;
  for (let y = py - reach; y <= py + reach; y++) for (let x = px - reach; x <= px + reach; x++) {
    const value = image.at(x, y);
    if (value > peak / 2) { sx += x * value; sy += y * value; weight += value; }
  }
  const centreX = sx / weight, centreY = sy / weight;
  // The noise is taken from a quadrant of the field well away from the source.
  const quarter = Math.floor(image.width / 8);
  let sum = 0, square = 0, count = 0;
  for (let y = quarter; y < 3 * quarter; y++) for (let x = quarter; x < 3 * quarter; x++) {
    const value = image.at(x, y); sum += value; square += value * value; count += 1;
  }
  const noise = Math.sqrt(square / count - (sum / count) ** 2);
  // Azimuthal mean by integer radius, then the radius where it crosses half the peak.
  const bins = new Map<number, { sum: number; count: number }>();
  for (let y = Math.round(centreY) - reach; y <= Math.round(centreY) + reach; y++) for (let x = Math.round(centreX) - reach; x <= Math.round(centreX) + reach; x++) {
    const bin = Math.round(Math.hypot(x - centreX, y - centreY));
    const current = bins.get(bin) ?? { sum: 0, count: 0 };
    current.sum += image.at(x, y); current.count += 1; bins.set(bin, current);
  }
  const mean = (bin: number) => { const entry = bins.get(bin); return entry ? entry.sum / entry.count : Number.NaN; };
  let last = 0;
  while (Number.isFinite(mean(last + 1)) && mean(last + 1) >= peak / 2) last += 1;
  const inside = mean(last), outside = mean(last + 1);
  const fraction = Number.isFinite(outside) && inside !== outside ? (inside - peak / 2) / (inside - outside) : 0;
  const halfPowerDiameterMas = 2 * (last + fraction) * image.pixelMas;
  const beamArea = Math.PI * image.beamMajorMas * image.beamMinorMas / 4;
  return { peak, noise, signalToNoise: peak / noise, centreX, centreY, halfPowerDiameterMas,
    beamAreas: Math.PI * (halfPowerDiameterMas / 2) ** 2 / beamArea };
}

export interface ImageComparison {
  readonly peakRatio: number;
  readonly diameterDifferenceMas: number;
  /** Pearson correlation of the two images over the smaller half-power disc, each sampled on its own grid. */
  readonly correlation: number;
  readonly beamRatio: number;
  readonly samples: number;
}

/** Compare a restored image with the archive's own. Both are sampled about their measured centres, on the coarser of the two
 * grids, out to the smaller of the two discs, so neither image's pixel scale decides the result. */
export function compareImages(restored: ContinuumImage, archive: ContinuumImage, reachMas = 120): ImageComparison {
  const a = measureSource(restored, 700, reachMas), b = measureSource(archive, 700, reachMas);
  const step = Math.max(restored.pixelMas, archive.pixelMas);
  const radius = Math.min(a.halfPowerDiameterMas, b.halfPowerDiameterMas) / 2;
  const sample = (image: ContinuumImage, measurement: SourceMeasurement, dx: number, dy: number) => {
    const x = Math.round(measurement.centreX + dx / image.pixelMas), y = Math.round(measurement.centreY + dy / image.pixelMas);
    return x >= 0 && y >= 0 && x < image.width && y < image.height ? image.at(x, y) : Number.NaN;
  };
  let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, count = 0;
  for (let dy = -radius; dy <= radius; dy += step) for (let dx = -radius; dx <= radius; dx += step) {
    if (Math.hypot(dx, dy) > radius) continue;
    const va = sample(restored, a, dx, dy), vb = sample(archive, b, dx, dy);
    if (!Number.isFinite(va) || !Number.isFinite(vb)) continue;
    sa += va; sb += vb; saa += va * va; sbb += vb * vb; sab += va * vb; count += 1;
  }
  if (count < 16) throw new Error('Too few overlapping samples to compare two images.');
  const covariance = sab / count - (sa / count) * (sb / count);
  const spread = Math.sqrt((saa / count - (sa / count) ** 2) * (sbb / count - (sb / count) ** 2));
  return { peakRatio: a.peak / b.peak, diameterDifferenceMas: a.halfPowerDiameterMas - b.halfPowerDiameterMas,
    correlation: spread === 0 ? Number.NaN : covariance / spread, beamRatio: (a => a)(restored.beamMajorMas * restored.beamMinorMas) / (archive.beamMajorMas * archive.beamMinorMas),
    samples: count };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const given = process.argv.slice(2);
  const [first, second] = positionalArguments(given, ['--reach']), reach = flagValue(given, '--reach');
  if (!first) throw new TypeError('Usage: alma-image.mts <image.fits> [<other.fits>] [--reach <mas>]');
  const reachMas = given.includes('--reach') ? Number(reach) : 120;
  if (!Number.isFinite(reachMas) || reachMas <= 0) throw new TypeError('--reach takes a distance in milliarcseconds.');
  const image = readContinuumImage(await readFile(first));
  const measurement = measureSource(image, 700, reachMas);
  const describe = (name: string, i: ContinuumImage, m: SourceMeasurement) =>
    `${name}\n  ${i.width}x${i.height} of ${i.pixelMas.toFixed(2)} mas, beam ${i.beamMajorMas.toFixed(1)}x${i.beamMinorMas.toFixed(1)} mas at ${i.beamAngleDegrees.toFixed(0)} deg` +
    `\n  peak ${m.peak.toExponential(3)}, noise ${m.noise.toExponential(2)}, signal-to-noise ${m.signalToNoise.toFixed(0)}` +
    `\n  half-power disc ${m.halfPowerDiameterMas.toFixed(1)} mas over ${m.beamAreas.toFixed(1)} beam areas`;
  console.log(describe(first, image, measurement));
  if (second) {
    const other = readContinuumImage(await readFile(second));
    console.log(describe(second, other, measureSource(other, 700, reachMas)));
    const comparison = compareImages(image, other, reachMas);
    console.log(`\ncompared over ${comparison.samples} samples of the smaller disc:` +
      `\n  peak ratio        ${comparison.peakRatio.toFixed(3)}` +
      `\n  diameter          ${comparison.diameterDifferenceMas >= 0 ? '+' : ''}${comparison.diameterDifferenceMas.toFixed(1)} mas` +
      `\n  beam area ratio   ${comparison.beamRatio.toFixed(3)}` +
      `\n  correlation       ${comparison.correlation.toFixed(3)}`);
  }
}
