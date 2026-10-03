// A uniform surface color from published whole-disc photometry: color indices relative to the Sun give reflectance at
// each filter's effective wavelength, a piecewise-linear spectrum joins them, and the CIE 1931 observer under D65 turns
// it into linear sRGB scaled so the V reflectance is the published geometric albedo. No map, terrain or variation is implied.
import { requireString } from '@cssearth/core';
import { parseDiscColorRecord, type DiscColorRecord } from '@cssearth/objects';
import { linearToSrgb } from './color-transfer.ts';

const INDICES = ['B-V', 'V-R', 'V-I'] as const;

export interface DiscColor {
  readonly reflectance: readonly (readonly [number, number])[];
  readonly linear: readonly [number, number, number];
  readonly srgb: readonly [number, number, number];
}

/** Parse a CIE CSV table (wavelength, value[, value...]) at 1 nm steps. */
export function parseCieTable(text: string, columns: number): Map<number, readonly number[]> {
  const rows = new Map<number, readonly number[]>();
  for (const line of text.split(/\r?\n/u)) {
    if (!line.trim()) continue;
    const cells = line.split(',').map(cell => Number(cell));
    if (cells.length !== columns + 1 || cells.some(cell => !Number.isFinite(cell)) || !Number.isInteger(cells[0])) throw new TypeError(`Invalid CIE table row: ${line}`);
    rows.set(cells[0]!, cells.slice(1));
  }
  return rows;
}

/** Relative reflectance (V = 1) at each effective wavelength, from object minus solar color indices. */
export function filterReflectance(record: DiscColorRecord): readonly (readonly [number, number])[] {
  const relative = (name: typeof INDICES[number]) => record.colorIndices[name] - record.solarColorIndices[name];
  const { B, V, R, I } = record.effectiveWavelengthsNm;
  // A redder B-V makes B fainter relative to V; a redder V-R or V-I makes R or I brighter.
  return [[B, 10 ** (-0.4 * relative('B-V'))], [V, 1], [R, 10 ** (0.4 * relative('V-R'))], [I, 10 ** (0.4 * relative('V-I'))]];
}

function spectrum(points: readonly (readonly [number, number])[]) {
  return (wavelength: number) => {
    const [first, second] = [points[0]!, points[1]!];
    // Blueward of B the B-V slope continues, never below zero; redward of I the I value holds.
    if (wavelength <= first[0]) return Math.max(0, first[1] + (second[1] - first[1]) * (wavelength - first[0]) / (second[0] - first[0]));
    for (let index = 1; index < points.length; index++) {
      const [a, b] = [points[index - 1]!, points[index]!];
      if (wavelength <= b[0]) return a[1] + (b[1] - a[1]) * (wavelength - a[0]) / (b[0] - a[0]);
    }
    return points[points.length - 1]![1];
  };
}

// IEC 61966-2-1 XYZ (D65) -> linear sRGB.
const XYZ_TO_LINEAR_SRGB = [[3.2404542, -1.5371385, -0.4985314], [-0.969266, 1.8760108, 0.041556], [0.0556434, -0.2040259, 1.0572252]] as const;

export function discIntegratedColor(record: DiscColorRecord, colorMatching: Map<number, readonly number[]>, illuminant: Map<number, readonly number[]>): DiscColor {
  const points = filterReflectance(record), reflectance = spectrum(points);
  const xyz = [0, 0, 0], white = [0, 0, 0];
  for (let wavelength = 380; wavelength <= 780; wavelength++) {
    const observer = colorMatching.get(wavelength), light = illuminant.get(wavelength)?.[0];
    if (!observer || light === undefined) throw new TypeError(`The CIE tables must cover ${wavelength} nm.`);
    for (let channel = 0; channel < 3; channel++) {
      white[channel] += light * observer[channel]!;
      xyz[channel] += reflectance(wavelength) * light * observer[channel]!;
    }
  }
  // Normalize to the illuminant's luminance, then scale so V-band reflectance equals the geometric albedo.
  const scaled = xyz.map(value => value / white[1]! * record.geometricAlbedo);
  const linear = XYZ_TO_LINEAR_SRGB.map(row => row[0] * scaled[0]! + row[1] * scaled[1]! + row[2] * scaled[2]!) as [number, number, number];
  if (linear.some(value => value < 0 || value > 1)) throw new TypeError(`The disc color falls outside the sRGB gamut: ${linear.join(', ')}.`);
  return { reflectance: points, linear, srgb: linear.map(value => Math.round(255 * linearToSrgb(value))) as [number, number, number] };
}

/** `readColorMatching` returns the CIE 1931 2° color-matching table; the host reads it from the shared reference bank. */
export async function loadDiscIntegratedColor(read: (path: string) => Promise<Buffer>, science: Record<string, unknown>, sourcePath: string,
  readColorMatching: () => Promise<Buffer>) {
  const record = parseDiscColorRecord(JSON.parse((await read(sourcePath)).toString('utf8')));
  const colorMatching = parseCieTable((await readColorMatching()).toString('utf8'), 3);
  const illuminant = parseCieTable((await read(requireString(science.illuminant, 'science.illuminant'))).toString('utf8'), 1);
  return discIntegratedColor(record, colorMatching, illuminant);
}
