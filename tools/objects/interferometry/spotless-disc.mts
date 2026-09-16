#!/usr/bin/env node
/** The spotless-disc test: does a reconstruction show more than the gaps in its (u, v) coverage would draw on a plain star?
 *
 *   node tools/objects/interferometry/spotless-disc.mts simulate <oifits> <out.fits> --diameter-mas <d> [--limb-darkening <u>] [--seed <n>]
 *   node tools/objects/interferometry/spotless-disc.mts compare <real-reconstruction.fits> <spotless-reconstruction.fits> --diameter-mas <d> --beam-mas <b>
 *
 * `simulate` keeps every sampled point of an OIFITS file and replaces its squared visibilities and closure phases by those of a
 * limb-darkened disc without spots, plus Gaussian noise of each point's own error. That is how Evans et al. (2024, ApJ 971,
 * 190, Fig. 5) found which spots on their Polaris images were artefacts. Reconstruct the simulated file with the recipe used
 * on the real one, then `compare` the two images. Both are convolved to the beam and divided by their own mean radial
 * profile, so limb darkening drops out and only spots remain. The ratio of the real image's spot contrast to the spotless
 * one's is the verdict, advisory. Measured with the pinned SQUEEZE recipe on 2026-09-16: π¹ Gruis 5.22 (correlation 0.07) and
 * Betelgeuse 2.90 (-0.02), whose images match their papers, and Polaris 1.05 (0.58), whose April 2021 spots are the coverage's. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { convolveGaussian, readReconstruction } from './beam-convolve.mts';
import { binaryTable, numbers, readFitsHdus, tableColumn, type BinaryTable, type TableColumn } from './fits-table.mts';

const MAS_RAD = Math.PI / 180 / 3.6e6;

function besselJ1(x: number) {
  let sum = 0, term = x / 2;
  for (let k = 0; Math.abs(term) > 1e-16 && k < 400;) { sum += term; k++; term *= -(x * x / 4) / (k * (k + 1)); }
  return sum;
}

/** Visibility of a disc with linear limb darkening I(mu) = 1 - u (1 - mu) (Hanbury Brown et al. 1974), normalised to 1 at zero
 * baseline; negative past each null, so a closure phase over three baselines is 0 or 180 degrees. */
export function limbDarkenedVisibility(baselineMetres: number, wavelengthMetres: number, diameterMas: number, limbDarkening: number) {
  const x = Math.PI * baselineMetres / wavelengthMetres * diameterMas * MAS_RAD;
  if (x < 1e-6) return 1;
  const j32 = Math.sqrt(2 / (Math.PI * x)) * (Math.sin(x) / x - Math.cos(x));
  return ((1 - limbDarkening) * besselJ1(x) / x + limbDarkening * Math.sqrt(Math.PI / 2) * j32 / x ** 1.5) / ((1 - limbDarkening) / 2 + limbDarkening / 3);
}

/** A reproducible standard normal stream (xorshift32 and Box-Muller). */
export function normalStream(seed: number) {
  let state = (seed >>> 0) || 1;
  const uniform = () => { state ^= state << 13; state >>>= 0; state ^= state >>> 17; state ^= state << 5; state >>>= 0; return (state + 0.5) / 4294967296; };
  return () => Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform());
}

function writeCell(bytes: Buffer, table: BinaryTable, row: number, column: TableColumn, index: number, value: number) {
  const at = table.hdu.dataOffset + row * table.rowBytes + column.offset;
  if (column.type === 'D') bytes.writeDoubleBE(value, at + index * 8);
  else if (column.type === 'E') bytes.writeFloatBE(value, at + index * 4);
  else throw new TypeError(`${column.name} is not a floating-point column.`);
}

export interface SpotlessOptions { readonly diameterMas: number; readonly limbDarkening?: number; readonly seed?: number }

/** The OIFITS bytes with every squared visibility and closure phase replaced by the spotless disc's, noise included. Flags,
 * errors, (u, v) and every other table are kept, so the reconstruction sees the same sampling and weights. */
export function simulateSpotlessDisc(input: Buffer, { diameterMas, limbDarkening = 0, seed = 1 }: SpotlessOptions) {
  if (!(diameterMas > 0) || !(limbDarkening >= 0 && limbDarkening <= 1)) throw new TypeError('A spotless disc needs a positive diameter and a limb-darkening coefficient between 0 and 1.');
  const bytes = Buffer.from(input), hdus = readFitsHdus(bytes), noise = normalStream(seed);
  const wavelengths = new Map<string, number[]>();
  for (const hdu of hdus.filter(hdu => hdu.extname === 'OI_WAVELENGTH')) {
    const table = binaryTable(hdu), column = tableColumn(table, 'EFF_WAVE');
    wavelengths.set(String(hdu.header.INSNAME), Array.from({ length: table.rows }, (_, row) => numbers(bytes, table, row, column)[0]!));
  }
  const channels = (table: BinaryTable) => { const list = wavelengths.get(String(table.hdu.header.INSNAME)); if (!list) throw new Error(`No OI_WAVELENGTH for ${String(table.hdu.header.INSNAME)}.`); return list; };
  const visibility = (u: number, v: number, wavelength: number) => limbDarkenedVisibility(Math.hypot(u, v), wavelength, diameterMas, limbDarkening);
  let vis2 = 0, t3 = 0;
  for (const hdu of hdus.filter(hdu => hdu.extname === 'OI_VIS2')) {
    const table = binaryTable(hdu), list = channels(table);
    const [u, v, data, error] = ['UCOORD', 'VCOORD', 'VIS2DATA', 'VIS2ERR'].map(name => tableColumn(table, name)) as [TableColumn, TableColumn, TableColumn, TableColumn];
    for (let row = 0; row < table.rows; row++) {
      const uu = numbers(bytes, table, row, u)[0]!, vv = numbers(bytes, table, row, v)[0]!, errors = numbers(bytes, table, row, error);
      for (let k = 0; k < list.length; k++) { writeCell(bytes, table, row, data, k, visibility(uu, vv, list[k]!) ** 2 + noise() * errors[k]!); vis2++; }
    }
  }
  for (const hdu of hdus.filter(hdu => hdu.extname === 'OI_T3')) {
    const table = binaryTable(hdu), list = channels(table);
    const [u1, v1, u2, v2, phase, error] = ['U1COORD', 'V1COORD', 'U2COORD', 'V2COORD', 'T3PHI', 'T3PHIERR'].map(name => tableColumn(table, name)) as TableColumn[];
    for (let row = 0; row < table.rows; row++) {
      const [a, b, c, d] = [u1!, v1!, u2!, v2!].map(column => numbers(bytes, table, row, column)[0]!) as [number, number, number, number];
      const errors = numbers(bytes, table, row, error!);
      for (let k = 0; k < list.length; k++) {
        const product = visibility(a, b, list[k]!) * visibility(c, d, list[k]!) * visibility(a + c, b + d, list[k]!);
        writeCell(bytes, table, row, phase!, k, (product < 0 ? 180 : 0) + noise() * errors[k]!); t3++;
      }
    }
  }
  return { bytes, vis2, t3, complexVisibilityTables: hdus.filter(hdu => hdu.extname === 'OI_VIS').length };
}

export interface ReconstructionPlane { readonly width: number; readonly height: number; readonly values: ArrayLike<number>; readonly pixelMas: number }

/** The image convolved to the beam and divided by its own mean radial profile about the flux centroid, minus one, inside 90% of
 * the disc radius (NaN outside): the spots, with limb darkening removed. */
export function spotMap({ width, height, values, pixelMas }: ReconstructionPlane, diameterMas: number, beamMas: number) {
  const smooth = convolveGaussian({ width, height, values: Float64Array.from(values) }, beamMas / pixelMas);
  let sx = 0, sy = 0, sw = 0;
  for (let i = 0; i < smooth.length; i++) { const value = smooth[i]!; if (value > 0) { sx += (i % width) * value; sy += Math.floor(i / width) * value; sw += value; } }
  const radius = (i: number) => Math.hypot(i % width - sx / sw, Math.floor(i / width) - sy / sw) * pixelMas;
  const ring = (i: number) => Math.round(radius(i) / pixelMas);
  const sums = new Map<number, [number, number]>();
  for (let i = 0; i < smooth.length; i++) { const entry = sums.get(ring(i)) ?? [0, 0]; entry[0] += smooth[i]!; entry[1]++; sums.set(ring(i), entry); }
  const map = new Float64Array(smooth.length).fill(Number.NaN);
  for (let i = 0; i < smooth.length; i++) {
    if (radius(i) > diameterMas / 2 * 0.9) continue;
    const [sum, count] = sums.get(ring(i))!;
    map[i] = smooth[i]! / (sum / count) - 1;
  }
  return map;
}

/** Spot contrast of the real and spotless reconstructions over the pixels both maps cover, their correlation, and the ratio. */
export function compareSpotMaps(real: Float64Array, spotless: Float64Array) {
  if (real.length !== spotless.length) throw new TypeError('The two reconstructions must share a grid.');
  let rr = 0, ss = 0, rs = 0, dd = 0, n = 0;
  for (let i = 0; i < real.length; i++) {
    const a = real[i]!, b = spotless[i]!;
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    rr += a * a; ss += b * b; rs += a * b; dd += (a - b) ** 2; n++;
  }
  if (!n) throw new Error('The two spot maps share no disc pixels.');
  const realRms = Math.sqrt(rr / n), spotlessRms = Math.sqrt(ss / n);
  return { pixels: n, realRms, spotlessRms, differenceRms: Math.sqrt(dd / n), correlation: rs / Math.sqrt(rr * ss), ratio: realRms / spotlessRms };
}

/** The ratio below which the spots of a reconstruction are no stronger than the ones its coverage draws on a plain disc: between
 * Polaris (1.05) and Betelgeuse (2.90), the lowest of the stars shipped with a reconstruction. */
export const SPOT_CONTRAST_RATIO = 2;

const plane = async (path: string): Promise<ReconstructionPlane> => {
  const image = readReconstruction(await readFile(path));
  const pixelMas = Math.abs(Number(image.cards.find(([key]) => key === 'CDELT1')?.[1]));
  if (!(pixelMas > 0)) throw new Error(`${path} states no pixel scale.`);
  return { width: image.width, height: image.height, values: image.values, pixelMas };
};

export async function compareReconstructions(realPath: string, spotlessPath: string, diameterMas: number, beamMas: number) {
  const [real, spotless] = await Promise.all([plane(realPath), plane(spotlessPath)]);
  if (real.width !== spotless.width || real.height !== spotless.height || real.pixelMas !== spotless.pixelMas) throw new TypeError('Reconstruct the spotless file on the real image\'s grid.');
  return compareSpotMaps(spotMap(real, diameterMas, beamMas), spotMap(spotless, diameterMas, beamMas));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, first, second, ...rest] = process.argv.slice(2);
  const option = (name: string) => { const index = rest.indexOf(name); return index < 0 ? undefined : Number(rest[index + 1]); };
  const diameterMas = option('--diameter-mas');
  if (mode === 'simulate' && first && second && diameterMas !== undefined) {
    const result = simulateSpotlessDisc(await readFile(first), { diameterMas, limbDarkening: option('--limb-darkening') ?? 0, seed: option('--seed') ?? 1 });
    await writeFile(second, result.bytes);
    console.log(`${second}: ${result.vis2} squared visibilities and ${result.t3} closure phases of a spotless ${diameterMas} mas disc.${result.complexVisibilityTables ? ` The file also has ${result.complexVisibilityTables} OI_VIS tables, left as measured: reconstruct both files with -novis.` : ''}`);
  } else if (mode === 'compare' && first && second && diameterMas !== undefined && option('--beam-mas') !== undefined) {
    const result = await compareReconstructions(first, second, diameterMas, option('--beam-mas')!);
    console.log(`Spot contrast (rms, beam-convolved, limb profile removed): real ${(result.realRms * 100).toFixed(2)}%, spotless ${(result.spotlessRms * 100).toFixed(2)}%, real minus spotless ${(result.differenceRms * 100).toFixed(2)}%; correlation ${result.correlation.toFixed(2)}; ratio ${result.ratio.toFixed(2)}.`);
    console.log(result.ratio < SPOT_CONTRAST_RATIO
      ? `Verdict: the spots are no stronger than the coverage draws on a plain disc (ratio below ${SPOT_CONTRAST_RATIO}). Do not cast this image as a surface.`
      : `Verdict: the real image carries structure beyond the coverage artefacts (ratio ${SPOT_CONTRAST_RATIO} or more).`);
  } else {
    throw new TypeError('Usage: spotless-disc simulate <oifits> <out> --diameter-mas <d> [--limb-darkening <u>] [--seed <n>] | compare <real> <spotless> --diameter-mas <d> --beam-mas <b>');
  }
}
