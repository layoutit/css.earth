/** Read a JWST spectral cube (a level-3 _s3d product of NIRSpec's or MIRI's integral-field unit) and measure an absorption
 * band in every pixel.
 *
 * A cube is a small picture with a spectrum in each pixel: SCI is surface brightness in MJy/sr on axes (x, y, wavelength), ERR
 * its one-sigma error. The pipeline builds it north up on a tangent plane, with a linear wavelength axis. Planes are read from
 * disk one at a time, so a cube of hundreds of megabytes costs one plane of memory.
 *
 * A band depth is 1 - band / continuum: the mean brightness inside the band, over a straight-line continuum drawn between the
 * mean brightness in a window on each side and read at the band's centre. It is a ratio of brightnesses at neighbouring
 * wavelengths in one pixel, so it needs no solar spectrum, no distance and no albedo; its error is carried from ERR. */
import { open } from 'node:fs/promises';
import { readFitsFileHdus, type FitsFileHdu } from '../../../fits/fits.mts';
import { requireFiniteNumber } from '../../../sources/source-values.mts';

export type Window = readonly [number, number];
export interface SpectralCube {
  readonly path: string; readonly width: number; readonly height: number; readonly planes: number;
  /** Wavelength of plane k, in micrometres. */
  readonly wavelength: (plane: number) => number;
  readonly arcsecPerPixel: number;
  /** The header of the primary HDU and of SCI, for the caller's own checks (target, grating, epoch). */
  readonly primary: FitsFileHdu['header']; readonly science: FitsFileHdu['header'];
  readonly sci: FitsFileHdu; readonly err: FitsFileHdu;
}

export async function openSpectralCube(path: string): Promise<SpectralCube> {
  const hdus = await readFitsFileHdus(path), named = (name: string) => hdus.find(hdu => hdu.header.EXTNAME === name);
  const sci = named('SCI'), err = named('ERR');
  if (!sci || !err || sci.bitpix !== -32 || err.bitpix !== -32 || sci.dimensions.length !== 3 || sci.dimensions.join() !== err.dimensions.join()) throw new Error(`${path} is not a spectral cube with SCI and ERR.`);
  const header = sci.header, [width, height, planes] = sci.dimensions as [number, number, number];
  if (header.CTYPE1 !== 'RA---TAN' || header.CTYPE2 !== 'DEC--TAN' || header.CTYPE3 !== 'WAVE' || header.CUNIT3 !== 'um' || header.BUNIT !== 'MJy/sr') throw new Error(`${path}: expected a tangent-plane cube in MJy/sr with a linear wavelength axis in micrometres.`);
  // North up, east left: what cube_build writes for its default "skyalign" frame. Anything else would need a rotation here.
  if (header.PC1_1 !== -1 || header.PC2_2 !== 1 || header.PC1_2 !== 0 || header.PC2_1 !== 0) throw new Error(`${path}: the cube is not north up.`);
  const scale = requireFiniteNumber(header.CDELT2, 'CDELT2');
  if (Math.abs(requireFiniteNumber(header.CDELT1, 'CDELT1')) !== scale) throw new Error(`${path}: the pixels are not square.`);
  const first = requireFiniteNumber(header.CRVAL3, 'CRVAL3'), step = requireFiniteNumber(header.CDELT3, 'CDELT3'), reference = requireFiniteNumber(header.CRPIX3, 'CRPIX3');
  return { path, width, height, planes, wavelength: plane => first + (plane + 1 - reference) * step, arcsecPerPixel: scale * 3600, primary: hdus[0]!.header, science: header, sci, err };
}

/** Mean brightness and its error in a wavelength window, per pixel, and the wavelength that mean belongs to. A sample that is
 * NaN, or has a missing or negative uncertainty, is left out; a pixel with fewer than half the window's samples is NaN. When a
 * sample is left out the mean of the rest sits at the mean of THEIR wavelengths, not at the window's middle, so that
 * wavelength is carried with it: on a sloping spectrum, placing a lopsided mean at the nominal centre invents a band. */
export async function windowMean(cube: SpectralCube, [from, to]: Window): Promise<{ mean: Float64Array; error: Float64Array; wavelength: Float64Array }> {
  const pixels = cube.width * cube.height, bytes = pixels * 4, sum = new Float64Array(pixels), variance = new Float64Array(pixels), count = new Uint32Array(pixels), reach = new Float64Array(pixels);
  const planes = Array.from({ length: cube.planes }, (_, plane) => plane).filter(plane => cube.wavelength(plane) >= from && cube.wavelength(plane) <= to);
  if (planes.length < 2) throw new RangeError(`The cube has ${planes.length} planes between ${from} and ${to} µm.`);
  const file = await open(cube.path, 'r'), sci = Buffer.alloc(bytes), err = Buffer.alloc(bytes);
  try {
    for (const plane of planes) {
      await file.read(sci, 0, bytes, cube.sci.dataStart + plane * bytes); await file.read(err, 0, bytes, cube.err.dataStart + plane * bytes);
      for (let pixel = 0; pixel < pixels; pixel++) {
        const value = sci.readFloatBE(pixel * 4), sigma = err.readFloatBE(pixel * 4);
        if (!Number.isFinite(value) || !Number.isFinite(sigma) || sigma < 0) continue;
        sum[pixel]! += value; variance[pixel]! += sigma * sigma; count[pixel]!++; reach[pixel]! += cube.wavelength(plane);
      }
    }
  } finally { await file.close(); }
  const mean = new Float64Array(pixels), error = new Float64Array(pixels), wavelength = new Float64Array(pixels);
  for (let pixel = 0; pixel < pixels; pixel++) {
    const n = count[pixel]!, enough = n >= planes.length / 2;
    mean[pixel] = enough ? sum[pixel]! / n : NaN; error[pixel] = enough ? Math.sqrt(variance[pixel]!) / n : NaN; wavelength[pixel] = enough ? reach[pixel]! / n : NaN;
  }
  return { mean, error, wavelength };
}

export interface BandRecipe { readonly band: Window; readonly continuum: readonly [Window, Window] }
export interface BandDepthMap { readonly width: number; readonly height: number; readonly depth: Float64Array; readonly error: Float64Array; readonly continuum: Float64Array }

/** The band's depth in every pixel, its one-sigma error, and the continuum brightness under the band. The continuum is the
 * straight line through the two window means, each placed at the wavelength its retained samples average to, read at the
 * wavelength the band's retained samples average to: in every pixel the three means are compared where they actually sit. */
export async function bandDepth(cube: SpectralCube, recipe: BandRecipe): Promise<BandDepthMap> {
  assertRecipeCoverage(cube, recipe);
  const [left, right] = recipe.continuum;
  if (!(left[1] <= recipe.band[0] && recipe.band[1] <= right[0])) throw new RangeError('The continuum windows lie on either side of the band.');
  const [a, b, c] = await Promise.all([windowMean(cube, left), windowMean(cube, recipe.band), windowMean(cube, right)]);
  const pixels = cube.width * cube.height, depth = new Float64Array(pixels), error = new Float64Array(pixels), continuum = new Float64Array(pixels);
  for (let pixel = 0; pixel < pixels; pixel++) {
    const t = (b.wavelength[pixel]! - a.wavelength[pixel]!) / (c.wavelength[pixel]! - a.wavelength[pixel]!);
    const level = (1 - t) * a.mean[pixel]! + t * c.mean[pixel]!, levelError = Math.hypot((1 - t) * a.error[pixel]!, t * c.error[pixel]!), ratio = b.mean[pixel]! / level;
    continuum[pixel] = level; depth[pixel] = level > 0 ? 1 - ratio : NaN;
    error[pixel] = level > 0 ? Math.hypot(b.error[pixel]! / level, b.mean[pixel]! * levelError / (level * level)) : NaN;
  }
  return { width: cube.width, height: cube.height, depth, error, continuum };
}

/** A partial band or continuum cannot establish the recipe's estimator. */
export function recipeInputRange(recipe: BandRecipe): Window {
 return [Math.min(recipe.band[0], ...recipe.continuum.map(w=>w[0])), Math.max(recipe.band[1], ...recipe.continuum.map(w=>w[1]))];
}
export function assertRecipeCoverage(cube: SpectralCube, recipe: BandRecipe): void {
 const [from,to]=recipeInputRange(recipe), ends=[cube.wavelength(0),cube.wavelength(cube.planes-1)];
 if(Math.min(...ends)>from||Math.max(...ends)<to)throw new RangeError(`The selected cube must cover the band and both continuum windows: ${from} to ${to} micrometres.`);
}
