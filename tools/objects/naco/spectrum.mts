/** Reading a reduced NACO long-slit product: where the trace is, how wide it is across the slit, and its flux along the
 * dispersion.
 *
 * `naco_spc_combine` writes a 2D frame on the detector's own pixels. On the NACO L-band setup used by 088.C-0833(B) the slit
 * runs along the image's Y axis and the grism disperses along X, which is measured here rather than assumed: the axis whose
 * summed profile is the narrower one is the spatial axis, because a long-slit trace is a line.
 *
 * The width across the slit is the whole point for a Solar System target. A star is a point source and its profile across the
 * slit is the seeing-and-optics profile; a resolved disc is wider. Programme 088.C-0833(B) took a telluric standard through
 * the same slit and grism minutes after each Europa set, so the two widths can be compared directly and the answer is a
 * measurement, not an inference from an ephemeris. */
import { readFitsFileHdus, readFitsFileRegion, type FitsFileHdu } from '../../fits/fits.mts';

/** No product larger than this is read; a NACO detector is 1024 x 1024. */
export const MAX_SAMPLES = 16 * 1024 * 1024;

export interface Frame { readonly width: number; readonly height: number; readonly values: Float64Array }

/** The first image extension of a product, read whole. */
export async function readFrame(path: string): Promise<{ frame: Frame; hdu: FitsFileHdu }> {
  const hdus = await readFitsFileHdus(path);
  const hdu = hdus.find(candidate => candidate.dimensions.length === 2);
  if (!hdu) throw new Error(`${path} holds no two-axis image.`);
  const [width, height] = hdu.dimensions as [number, number];
  if (width * height > MAX_SAMPLES) throw new Error(`${path} has ${width * height} samples, more than this reader takes.`);
  const region = await readFitsFileRegion(path, hdu, { x0: 0, y0: 0, width, height });
  return { frame: { width, height, values: Float64Array.from(region.values) }, hdu };
}

/** Sums along each axis: `rows` is the profile across the slit when the slit runs along Y, `columns` the flux along the
 * dispersion. Non-finite samples are skipped rather than propagated. */
export function profiles(frame: Frame) {
  const rows = new Float64Array(frame.height), columns = new Float64Array(frame.width);
  for (let y = 0; y < frame.height; y++) {
    for (let x = 0; x < frame.width; x++) {
      const value = frame.values[y * frame.width + x]!;
      if (Number.isFinite(value)) { rows[y] += value; columns[x] += value; }
    }
  }
  return { rows, columns };
}

/** The median of a copy, used as the background level of a profile. */
export function median(values: ArrayLike<number>) {
  const sorted = Float64Array.from(values as never).sort();
  if (!sorted.length) return Number.NaN;
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

export interface Width {
  /** The brightest sample of the profile, above its own background. */
  readonly peak: number;
  readonly level: number;
  readonly background: number;
  /** Full width at half the peak's height above background, in samples, by linear interpolation of the crossings. */
  readonly fwhm: number;
  /** The flux-weighted centre over the samples above half maximum. */
  readonly centroid: number;
}

/** The width of a trace profile at half its maximum, above the profile's own median background.
 *
 * The half-maximum crossings are interpolated between samples, so a width is not quantised to whole pixels; a profile that
 * never falls back to half maximum on one side is refused rather than reported as the edge of the array. */
export function widthOf(profile: ArrayLike<number>): Width {
  const background = median(profile);
  let peak = -1, level = -Infinity;
  for (let index = 0; index < profile.length; index++) {
    const value = profile[index]! - background;
    if (Number.isFinite(value) && value > level) { level = value; peak = index; }
  }
  if (peak < 0 || !(level > 0)) throw new Error('The profile has no sample above its own background.');
  const half = level / 2;
  const above = (index: number) => profile[index]! - background >= half;
  const cross = (from: number, step: number) => {
    for (let index = from; index >= 0 && index < profile.length; index += step) {
      if (!above(index)) {
        const inner = profile[index - step]! - background, outer = profile[index]! - background;
        return index - step + step * (inner - half) / (inner - outer);
      }
    }
    throw new Error('The profile does not fall back to half maximum on both sides of its peak.');
  };
  const left = cross(peak, -1), right = cross(peak, 1);
  let weight = 0, moment = 0;
  for (let index = 0; index < profile.length; index++) {
    if (!above(index)) continue;
    const value = profile[index]! - background;
    weight += value; moment += value * index;
  }
  return { peak, level, background, fwhm: Math.abs(right - left), centroid: weight ? moment / weight : peak };
}

/** The fraction of a profile's peak height at which its support is counted. A tenth, not a half: a NACO L-band spectrum runs
 * through deep telluric absorption, so only a narrow part of it stands above half its own peak and both axes then measure the
 * same support. At a tenth the spectrum's support is hundreds of samples and the trace's is tens, which tells them apart. */
export const SUPPORT_FRACTION = 0.1;

/** How many samples of a profile stand above a tenth of its peak height. This is the support of the trace, and it is what
 * tells the two axes apart: across the slit the trace is a line tens of samples wide, along the dispersion it spans the
 * spectrum. A profile's FWHM cannot do the job, because a spectrum with a sharp peak in it has a narrow FWHM. */
export function supportOf(profile: ArrayLike<number>) {
  const background = median(profile);
  let level = -Infinity;
  for (let index = 0; index < profile.length; index++) {
    const value = profile[index]! - background;
    if (Number.isFinite(value) && value > level) level = value;
  }
  if (!(level > 0)) throw new Error('The profile has no sample above its own background.');
  let count = 0;
  for (let index = 0; index < profile.length; index++) if (profile[index]! - background >= level * SUPPORT_FRACTION) count++;
  return count;
}

/** Which axis the slit runs along, measured: the trace spans the dispersion and is a few samples wide across the slit, so the
 * spatial axis is the one whose profile has the narrower support. Returned with both supports so the decision is in the
 * receipt and not only in the code. */
export function slitAxis(frame: Frame) {
  const { rows, columns } = profiles(frame);
  const acrossSupport = supportOf(rows), alongSupport = supportOf(columns);
  return acrossSupport <= alongSupport
    ? { axis: 'y' as const, acrossSupport, alongSupport, spatial: rows, dispersion: columns }
    : { axis: 'x' as const, acrossSupport: alongSupport, alongSupport: acrossSupport, spatial: columns, dispersion: rows };
}

/** The profile across the slit, summed over a band of dispersion columns centred on the trace, so a narrow band of good
 * signal is measured rather than the whole frame including its empty ends. */
export function crossProfile(frame: Frame, axis: 'x' | 'y', centre: number, halfBand: number) {
  const spatialLength = axis === 'y' ? frame.height : frame.width;
  const profile = new Float64Array(spatialLength);
  const from = Math.max(0, Math.round(centre - halfBand)), to = Math.min((axis === 'y' ? frame.width : frame.height) - 1, Math.round(centre + halfBand));
  for (let spatial = 0; spatial < spatialLength; spatial++) {
    let total = 0;
    for (let index = from; index <= to; index++) {
      const value = axis === 'y' ? frame.values[spatial * frame.width + index]! : frame.values[index * frame.width + spatial]!;
      if (Number.isFinite(value)) total += value;
    }
    profile[spatial] = total;
  }
  return profile;
}

/** The one-dimensional spectrum: flux summed across the slit over a band around the trace, one value per dispersion sample. */
export function extractSpectrum(frame: Frame, axis: 'x' | 'y', centre: number, halfWidth: number) {
  const dispersionLength = axis === 'y' ? frame.width : frame.height;
  const spectrum = new Float64Array(dispersionLength);
  const from = Math.max(0, Math.round(centre - halfWidth)), to = Math.min((axis === 'y' ? frame.height : frame.width) - 1, Math.round(centre + halfWidth));
  for (let index = 0; index < dispersionLength; index++) {
    let total = 0;
    for (let spatial = from; spatial <= to; spatial++) {
      const value = axis === 'y' ? frame.values[spatial * frame.width + index]! : frame.values[index * frame.width + spatial]!;
      if (Number.isFinite(value)) total += value;
    }
    spectrum[index] = total;
  }
  return spectrum;
}

export interface TraceMeasurement {
  readonly axis: 'x' | 'y';
  /** Where the trace sits along the dispersion, and how wide the band summed for the cross profile was. */
  readonly dispersionCentre: number;
  readonly dispersionBand: number;
  /** The profile across the slit: its centre, and its full width at half maximum in samples. */
  readonly centroid: number;
  readonly fwhmPixels: number;
  readonly fwhmArcsec: number | null;
  readonly peakLevel: number;
  readonly background: number;
}

/** The slit axis of a product, for a product with enough signal to tell. It is a property of the instrument setup, not of one
 * exposure, so it is measured once on the strongest product of a night and then used for every product of that night: a
 * half-length nod set can have too little signal for the two supports to be told apart, and would otherwise be measured
 * along the wrong axis without complaint. */
export async function detectSlitAxis(path: string) {
  const { frame } = await readFrame(path);
  return traceDirection(frame);
}

/** Which way the trace runs, from the brightest pixel outwards: the contiguous run of samples above a tenth of that pixel's
 * height above background, in each of the four directions. A long-slit trace is a line along the dispersion, so the axis with
 * the long run is the dispersion and the other is the slit.
 *
 * Summed profiles cannot decide this on a NACO L-band frame: the spectrum runs through deep telluric absorption and the
 * detector has its own column structure, and both axes then report similar supports. A contiguous run from the peak does
 * decide it — on the telluric standard of 088.C-0833(B) it is 316 samples one way and 6 the other. */
export function traceDirection(frame: Frame) {
  const { width, height, values } = frame;
  const background = median(values);
  let peak = -1, level = -Infinity;
  for (let index = 0; index < values.length; index++) {
    const value = values[index]!;
    if (Number.isFinite(value) && value > level) { level = value; peak = index; }
  }
  if (peak < 0 || !(level > background)) throw new Error('The frame has no sample above its own background.');
  const x = peak % width, y = Math.floor(peak / width), threshold = background + (level - background) * SUPPORT_FRACTION;
  const run = (dx: number, dy: number) => {
    let count = 0;
    for (let cx = x + dx, cy = y + dy; cx >= 0 && cy >= 0 && cx < width && cy < height && values[cy * width + cx]! >= threshold; cx += dx, cy += dy) count++;
    return count;
  };
  const alongX = 1 + run(1, 0) + run(-1, 0), alongY = 1 + run(0, 1) + run(0, -1);
  if (alongX === alongY) throw new Error(`The trace runs ${alongX} samples each way, which does not tell a slit from a spectrum.`);
  // The long run is the dispersion; the slit is the other axis.
  return alongY > alongX
    ? { axis: 'x' as const, peakX: x, peakY: y, runAlongX: alongX, runAlongY: alongY }
    : { axis: 'y' as const, peakX: x, peakY: y, runAlongX: alongX, runAlongY: alongY };
}

/** Measure one product's trace on a given slit axis: where the trace is, and how wide it is across the slit.
 * `pixelScale` is arcseconds per pixel from the frame's own header, or null when it states none. */
export async function measureTrace(path: string, pixelScale: number | null, axis: 'x' | 'y', dispersionBand = 100): Promise<TraceMeasurement> {
  const { frame } = await readFrame(path);
  const { rows, columns } = profiles(frame);
  const dispersion = axis === 'y' ? columns : rows;
  const centre = widthOf(dispersion).centroid;
  const profile = crossProfile(frame, axis, centre, dispersionBand / 2);
  const width = widthOf(profile);
  return {
    axis, dispersionCentre: centre, dispersionBand, centroid: width.centroid, fwhmPixels: width.fwhm,
    fwhmArcsec: pixelScale === null ? null : width.fwhm * pixelScale, peakLevel: width.level, background: width.background,
  };
}
