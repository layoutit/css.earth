/** A run's mean line profiles and longitudinal fields, by the published codes toolchain.json pins.
 *
 * LSDpy (Folsom, after Donati et al. 1997, MNRAS 291, 658) averages the lines of a mask into one intensity, Stokes V and
 * null profile, rescales their error bars by the fit's chi-square and removes the constant offset of V and of the null.
 * SpecpolFlow measures the longitudinal field of each profile by the first moment of Stokes V. This module writes their
 * inputs (the mask and each spectrum as text) and reads their results; it computes nothing of its own. */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { MaskLine } from './mask.mts';
import type { PolarisedSpectrum } from './product.mts';
import { runPython, toolchainPaths } from './toolchain.mts';

/** The depth-weighted means LSDpy scales a profile to: it is then the profile of a line of this depth, wavelength and Landé factor. */
export interface MaskMeans { readonly depth: number; readonly wavelengthNm: number; readonly lande: number; readonly lines: number }

/** A mask as LSDpy reads it: the count, then for each line its rest wavelength (nm), element number + ion stage / 100,
 * depth, lower level (unused, 0), Landé factor and the use flag. */
export const maskFile = (lines: readonly MaskLine[]) => `${lines.length}\n${lines.map(line => `${line.restNm.toFixed(4)} ${(line.element + line.charge / 100).toFixed(2)} ${line.depth.toFixed(4)} 0.0 ${line.lande.toFixed(3)} 1`).join('\n')}\n`;

/** A spectrum as Libre-ESpRIT writes its text files and LSDpy reads them: two header lines, then wavelength (nm),
 * intensity, Stokes V, the null check twice (these products carry one) and the error bar. Pixels that are not numbers or
 * have no light or no error bar are left out. */
export function spectrumFile(spectrum: PolarisedSpectrum, name: string) { const rows: string[] = [];
  for (let i = 0; i < spectrum.wavelengthNm.length; i++) { const w = spectrum.wavelengthNm[i]!, I = spectrum.intensity[i]!, V = spectrum.stokesV[i]!, N = spectrum.check[i]!, e = spectrum.error[i]!;
    if (Number.isFinite(w) && Number.isFinite(I) && Number.isFinite(V) && Number.isFinite(N) && Number.isFinite(e) && I > 0 && e > 0) rows.push(`${w.toFixed(4)} ${I.toExponential(4)} ${V.toExponential(4)} ${N.toExponential(4)} ${N.toExponential(4)} ${e.toExponential(4)}`); }
  return `***Reduced spectrum of '${name}'\n${rows.length} 5\n${rows.join('\n')}\n`; }

export interface MeanLine { readonly product: string; readonly mjd: number; /** The profile LSDpy wrote: velocity, I, its error, V, its error, null, its error. */ readonly profile: string;
  /** Longitudinal field and its error in gauss, and the same measure on the null check. */ readonly gauss: number; readonly error: number; readonly nullGauss: number;
  /** The chance that noise alone makes the signal seen inside the line, for Stokes V and for the null. */ readonly falseAlarm: number; readonly nullFalseAlarm: number; readonly centreKmS: number;
  /** Reduced chi-square of LSDpy's fit to the spectrum (it scales the error bars by its root when above 1), and the offsets it removed. */ readonly chiSquare: { readonly intensity: number | null; readonly stokesV: number | null; readonly null: number | null }; readonly offset: { readonly stokesV: number | null; readonly null: number | null } }

/** How far around a catalogued velocity the star's line is looked for, and how far with no velocity at all, km/s. */
export const SEARCH_KMS = 30, BLIND_SEARCH_KMS = 300;
/** How far either side of each hydrogen line mask lines are left out, km/s: SpecpolFlow's tutorial value. */
export const HYDROGEN_KMS = 500;

/** The mean lines of a run. The mask is first cleaned of SpecpolFlow's default regions (the Earth's bands and the hydrogen
 * lines). `halfWidthKmS` is how far the profile runs either side of the star's line; `lineHalfWidthKmS` how far the line's
 * core reaches, which is where the field is measured and outside which its continuum is taken. The star's velocity is the
 * median centre of gravity of the mean lines. */
export async function meanLines(input: { readonly spectra: readonly PolarisedSpectrum[]; readonly products: readonly string[]; readonly lines: readonly MaskLine[]; readonly radialVelocityKmS?: number; readonly halfWidthKmS: number; readonly lineHalfWidthKmS: number; readonly directory: string; readonly stepKmS?: number }) {
  const { python } = await toolchainPaths(), directory = resolve(input.directory, 'lsd'), mask = resolve(directory, 'mask-all.dat'), cleanMask = resolve(directory, 'mask.dat');
  await mkdir(directory, { recursive: true }); await writeFile(mask, maskFile(input.lines));
  const spectra = input.products.map(product => ({ product, file: resolve(directory, `${product}.s`), profile: resolve(directory, `${product}.lsd`) }));
  await Promise.all(spectra.map((entry, i) => writeFile(entry.file, spectrumFile(input.spectra[i]!, entry.product))));
  const job = resolve(directory, 'job.json');
  await writeFile(job, JSON.stringify({ mask, cleanMask, hydrogenKmS: HYDROGEN_KMS, spectra, velocity: input.radialVelocityKmS ?? null, searchKmS: SEARCH_KMS, blindSearchKmS: BLIND_SEARCH_KMS, searchProfile: resolve(directory, 'search.lsd'), halfWidth: input.halfWidthKmS, lineHalfWidth: input.lineHalfWidthKmS, velPixel: input.stepKmS ?? 1.8 }));
  try {
    const result = JSON.parse(runPython(python, [resolve(import.meta.dirname, 'tools.py'), 'lsd', job])) as { mask: MaskMeans; searchCentreKmS: number; searchDepth: number; spectra: Omit<MeanLine, 'mjd' | 'profile'>[] };
    const lines = result.spectra.map((line, i): MeanLine => ({ ...line, mjd: input.spectra[i]!.mjd, profile: spectra[i]!.profile })), centres = lines.map(line => line.centreKmS).sort((a, b) => a - b);
    return { means: result.mask, lines, velocityKmS: centres[Math.floor(centres.length / 2)]!, searchCentreKmS: result.searchCentreKmS, searchDepth: result.searchDepth };
  } finally { await Promise.all(spectra.map(entry => rm(entry.file, { force: true }))); }   // the text spectra are 15 MB each and only LSDpy's input
}
