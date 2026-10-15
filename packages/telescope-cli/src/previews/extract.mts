import { fitsImageAccessor, readFitsHdus } from '@cssearth/fits';
import { numericColumn, previewTable } from './fits-table.mts';
import type { ImagePreview, PreviewData, SpectrumPreview } from './types.mts';

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : sorted[middle - 1]! / 2 + sorted[middle]! / 2;
}

/** Ninety equal-width bins use edge midpoints and finite paired medians, as in NumPy digitize. */
export function binSpectrum(x: readonly number[], y: readonly number[], xunit: string, yunit: string): SpectrumPreview {
  if (x.length !== y.length) throw new Error('Preview spectrum columns differ in length.');
  const pairs = x.flatMap((value, i) => Number.isFinite(value) && Number.isFinite(y[i]) ? [{ x: value, y: y[i]! }] : []).sort((a, b) => a.x - b.x);
  if (pairs.length < 2) throw new Error('Preview spectrum has fewer than two finite samples.');
  const count = 90, start = pairs[0]!.x, end = pairs.at(-1)!.x, step = (end - start) / count;
  const edges = Array.from({ length: count + 1 }, (_, i) => i === count ? end : start + i * step);
  const bins = Array.from({ length: count }, (): number[] => []), bx: number[] = [], by: number[] = [];
  for (const pair of pairs) {
    let low = 0, high = edges.length;
    while (low < high) { const middle = Math.floor((low + high) / 2); if (pair.x < edges[middle]!) high = middle; else low = middle + 1; }
    bins[Math.max(0, Math.min(count - 1, low - 1))]!.push(pair.y);
  }
  for (let i = 0; i < count; i++) {
    if (!bins[i]!.length) continue;
    bx.push((edges[i]! + edges[i + 1]!) / 2); by.push(median(bins[i]!));
  }
  return { kind: 'spectrum', x: bx, y: by, xunit, yunit };
}

function wavelengthUnit(unit: string): { divisor: number; unit: string } {
  if (/^(angstroms?|Å)$/iu.test(unit)) return { divisor: 10, unit: 'nm' };
  if (/^nm$/iu.test(unit)) return { divisor: 1, unit: 'nm' };
  if (/^(um|µm|microns?)$/iu.test(unit)) return { divisor: 0.001, unit: 'nm' };
  if (unit === 'm') return { divisor: 1e-9, unit: 'nm' };
  throw new Error('Unsupported preview wavelength unit.');
}

function tableSpectrum(bytes: Uint8Array, origin: 'eso' | 'hst'): SpectrumPreview {
  const hdus = readFitsHdus(bytes);
  for (const hdu of hdus) {
    if (hdu.header.XTENSION !== 'BINTABLE') continue;
    const table = previewTable(hdu), names = table.columns.map(column => column.name);
    const wave = origin === 'eso' ? 'WAVE' : 'WAVELENGTH', flux = origin === 'eso' ? 'FLUX_REDUCED' : 'FLUX';
    if (!names.includes(wave) || !names.includes(flux)) continue;
    const x: number[] = [], y: number[] = [];
    let xunit = '', yunit = '';
    // The preview recipe takes ESO's first vector and flattens every HST row, including elements beyond NELEM.
    for (let row = 0; row < (origin === 'eso' ? Math.min(1, table.rows) : table.rows); row++) {
      const wavelengths = numericColumn(bytes, table, wave, row), fluxes = numericColumn(bytes, table, flux, row);
      if (wavelengths.values.length !== fluxes.values.length) throw new Error('Preview spectrum array columns differ in length.');
      const unit = wavelengthUnit(wavelengths.unit); xunit = unit.unit; yunit = origin === 'hst' ? 'erg/s/cm²/Å' : fluxes.unit || 'adu';
      for (let i = 0; i < wavelengths.values.length; i++) { x.push(wavelengths.values[i]! / unit.divisor); y.push(fluxes.values[i]!); }
    }
    return binSpectrum(x, y, xunit, yunit);
  }
  throw new Error('No supported 1-D spectrum table in the preview.');
}

/** NumPy's default percentile uses linear interpolation at (n - 1) * q. */
function percentile(sorted: readonly number[], percent: number): number {
  const at = (sorted.length - 1) * percent / 100, low = Math.floor(at), fraction = at - low;
  return sorted[low]! + (sorted[Math.ceil(at)]! - sorted[low]!) * fraction;
}
const clip = (value: number) => Math.max(0, Math.min(1, value));

/** The approved recipes stretch before mean pooling for ESO, after peak-cropped max pooling for ALMA. */
function imageGrid(width: number, height: number, sample: (i: number) => number, centreOnPeak: boolean, caption: string): ImagePreview {
  const pixels = Array.from({ length: width * height }, (_, i) => {
    const value = sample(i); return Number.isNaN(value) ? 0 : value;
  });
  if (!pixels.every(Number.isFinite)) throw new Error('Preview image contains nonfinite pixels.');
  let side: number, left: number, top: number;
  if (centreOnPeak) {
    let peakIndex = 0;
    for (let i = 1; i < pixels.length; i++) if (pixels[i]! > pixels[peakIndex]!) peakIndex = i;
    const x = peakIndex % width, y = Math.floor(peakIndex / width), half = Math.min(y, x, height - y, width - x, 60);
    if (!half) throw new Error('Preview peak crop is empty at the image edge.');
    side = half * 2; left = x - half; top = y - half;
  } else {
    const sorted = [...pixels].sort((a, b) => a - b), lo = percentile(sorted, 5), range = percentile(sorted, 99.7) - lo;
    for (let i = 0; i < pixels.length; i++) pixels[i] = range > 0 ? Math.asinh(clip((pixels[i]! - lo) / range) * 10) / Math.asinh(10) : 0;
    side = Math.min(width, height); left = Math.floor((width - side) / 2); top = Math.floor((height - side) / 2);
  }
  const grid = Array.from({ length: 30 }, (_, row) => Array.from({ length: 60 }, (_, column) => {
    if (!centreOnPeak) {
      const x0 = column * side / 60, x1 = (column + 1) * side / 60, y0 = row * side / 30, y1 = (row + 1) * side / 30;
      let sum = 0;
      for (let y = Math.floor(y0); y < Math.ceil(y1); y++) for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
        const area = (Math.min(x + 1, x1) - Math.max(x, x0)) * (Math.min(y + 1, y1) - Math.max(y, y0));
        sum += pixels[(top + y) * width + left + x]! * area;
      }
      return sum / ((x1 - x0) * (y1 - y0));
    }
    const x0 = Math.floor(column * side / 60), x1 = Math.max(x0 + 1, Math.floor((column + 1) * side / 60));
    const y0 = Math.floor(row * side / 30), y1 = Math.max(y0 + 1, Math.floor((row + 1) * side / 30));
    let value = -Infinity;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const pixel = pixels[(top + y) * width + left + x]!;
      value = Math.max(value, pixel);
    }
    return value;
  }));
  if (centreOnPeak) {
    const sorted = grid.flat().sort((a, b) => a - b), lo = percentile(sorted, 20), range = percentile(sorted, 100) - lo;
    for (const row of grid) for (let i = 0; i < row.length; i++) row[i] = range > 0 ? Math.sqrt(clip((row[i]! - lo) / range)) : 0;
  }
  // The approved panels were drawn from grids rounded to three decimals; a value like 0.0998 lands on the next ramp step.
  for (const row of grid) for (let i = 0; i < row.length; i++) row[i] = Math.round(row[i]! * 1000) / 1000;
  return { kind: 'image', grid, caption };
}

export function extractPreview(bytes: Uint8Array, origin: 'hst' | 'eso' | 'alma', product: 'spectrum' | 'image' | 'cube', instrument = ''): PreviewData {
  const hdus = readFitsHdus(bytes), primary = hdus[0]!;
  if (origin === 'eso' && primary.header.PRODCATG !== (product === 'spectrum' ? 'SCIENCE.SPECTRUM' : 'SCIENCE.IMAGE'))
    throw new Error('ESO preview does not carry the advertised science product category.');
  if (origin !== 'alma' && product === 'spectrum') return tableSpectrum(bytes, origin);
  const hdu = hdus.find(hdu => hdu.header.XTENSION !== 'BINTABLE' && hdu.dimensions.length >= 2 && hdu.count > 0);
  if (!hdu) throw new Error('Preview contains no image.');
  const sample = fitsImageAccessor(bytes, hdu), [width, height] = hdu.dimensions, planes = hdu.dimensions[2] ?? 1;
  if (product === 'cube') {
    if (hdu.header.CTYPE3 !== 'FREQ' || !['Hz', 'kHz', 'MHz', 'GHz'].includes(String(hdu.header.CUNIT3))) throw new Error('Preview cube requires a frequency axis.');
    const reference = hdu.header.CRVAL3, step = hdu.header.CDELT3, pixel = hdu.header.CRPIX3;
    if (typeof reference !== 'number' || typeof step !== 'number' || typeof pixel !== 'number' || !Number.isFinite(reference + step + pixel) || step === 0)
      throw new Error('Invalid preview cube frequency coordinates.');
    const divisor = hdu.header.CUNIT3 === 'Hz' ? 1e9 : hdu.header.CUNIT3 === 'kHz' ? 1e6 : hdu.header.CUNIT3 === 'MHz' ? 1e3 : 1;
    const x: number[] = [], y: number[] = [];
    for (let channel = 0; channel < planes; channel++) {
      let sum = 0;
      for (let i = 0; i < width * height; i++) { const value = sample(channel * width * height + i); if (!Number.isNaN(value)) sum += value; }
      x.push((reference + (channel + 1 - pixel) * step) / divisor); y.push(sum * 1000);
    }
    return binSpectrum(x, y, 'GHz', 'mJy/beam');
  }
  if (planes !== 1) throw new Error('A multi-plane image is not a continuum preview.');
  return imageGrid(width, height, sample, origin === 'alma', origin === 'alma' ? 'continuum image · ALMA data' : `${instrument || 'archive'} image · ESO data`);
}
