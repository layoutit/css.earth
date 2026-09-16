#!/usr/bin/env node
/** Betelgeuse authored inputs: the uniform-disc reference sphere from the retained measurements, and the monochromatic continuum
 * OIFITS merged from the pinned VLT/MATISSE files. Both are deterministic functions of checked-in or pinned inputs.
 *
 *   node tools/objects/source-authoring/betelgeuse/author.mts [--check]
 *
 * --check recomputes both outputs and fails if either differs from the file on disk. */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mergeContinuum, mergedOifits, type ContinuumRecipe } from '../../interferometry/matisse-continuum.mts';
import { convolveGaussian, readReconstruction, writeReconstruction } from '../../interferometry/beam-convolve.mts';
import { requireRecord, requireFiniteNumber, requireString } from '../../../source-values.mts';

const root = resolve(import.meta.dirname, '../../../../src/objects/betelgeuse/source');

/** The reconstruction recipe the pilot settled: the paper's pseudo-continuum windows, its two February 2020 nights, and the
 * error floors measured from the beam-commuting-device repeats. */
export const CONTINUUM_RECIPE: ContinuumRecipe = Object.freeze({
  windowsMicrometres: [[3.942, 3.974], [3.992, 3.998]] as const,
  referenceWavelengthMetres: 3.97e-6, referenceBandMetres: 0.06e-6,
  vis2MultiplicativeFloor: 0.12, vis2AdditiveFloor: 5.65e-4, closurePhaseFloorDegrees: 2,
  outputMjd: 58895, outputDateObs: '2020-02-08',
  target: { name: 'alf Ori', rightAscensionDegrees: 88.7929, declinationDegrees: 7.4071, spectralType: 'M2Iab' },
});
export const CONTINUUM_NIGHTS = Object.freeze(['2020-02-08', '2020-02-19']);
export const MERGED_PATH = 'observations/betelgeuse-matisse-2020-02-continuum.oifits';
/** SQUEEZE's posterior mean at 0.78 mas pixels, and the same image convolved to the 4 mas beam of the February 2020 baselines
 * (Drevon et al. 2024), which is what the lens casts: structure below the beam is the regulariser's, not the star's. */
export const RAW_IMAGE_PATH = 'observations/betelgeuse-matisse-2020-02-continuum-squeeze.fits';
export const BEAM_IMAGE_PATH = 'observations/betelgeuse-matisse-2020-02-continuum-4mas.fits';
export const BEAM_FWHM_MAS = 4;
export const SPHERE_PATH = 'shape/uniform-disc.tab';

/** A latitude/longitude/radius table of one radius: the reference sphere, in the released-table format the mesh loader reads. */
export function uniformDiscTable(radiusKm: number, stepDegrees: number): string {
  const lines: string[] = [];
  for (let latitude = -90; latitude <= 90; latitude += stepDegrees) {
    for (let longitude = 0; longitude <= 360; longitude += stepDegrees) lines.push(`${longitude} ${latitude} ${radiusKm.toFixed(6)}`);
  }
  return `${lines.join('\n')}\n`;
}

export async function authorBetelgeuse({ check = false } = {}) {
  const measurements = requireRecord(JSON.parse(await readFile(resolve(root, 'measurements.json'), 'utf8')), 'measurements');
  if (measurements.schema !== 'cssearth-uniform-disc-star@1') throw new TypeError('Unexpected Betelgeuse measurements schema.');
  const shape = requireRecord(measurements.shape, 'shape');
  if (requireString(shape.path) !== SPHERE_PATH) throw new TypeError('Betelgeuse sphere path differs from the authoring tool.');
  const table = uniformDiscTable(requireFiniteNumber(measurements.radiusKm), requireFiniteNumber(shape.stepDegrees));
  const oifitsDirectory = resolve(root, 'observations/oifits');
  const files = (await readdir(oifitsDirectory)).filter(name => name.endsWith('.fits') && CONTINUUM_NIGHTS.some(night => name.startsWith(night))).sort().map(name => resolve(oifitsDirectory, name));
  if (files.length !== 29) throw new Error(`Expected the 29 pinned February 2020 MATISSE files, found ${files.length}.`);
  const merged = await mergeContinuum(files, CONTINUUM_RECIPE), oifits = mergedOifits(merged, CONTINUUM_RECIPE);
  const raw = readReconstruction(await readFile(resolve(root, RAW_IMAGE_PATH)));
  const pixelMas = Math.abs(Number(raw.cards.find(([key]) => key === 'CDELT1')?.[1]));
  if (!(pixelMas > 0)) throw new Error('The reconstruction states no pixel scale.');
  const beam = writeReconstruction(raw, convolveGaussian(raw, BEAM_FWHM_MAS / pixelMas), [['BEAMFWHM', BEAM_FWHM_MAS, 'mas, Gaussian convolution applied by author.mts'], ['ORIGFILE', RAW_IMAGE_PATH.split('/').at(-1)!, 'SQUEEZE posterior mean this was convolved from']]);
  const outputs: [string, Buffer][] = [[SPHERE_PATH, Buffer.from(table, 'latin1')], [MERGED_PATH, oifits], [BEAM_IMAGE_PATH, beam]];
  for (const [path, bytes] of outputs) {
    const target = resolve(root, path);
    if (check) {
      if (!(await readFile(target)).equals(bytes)) throw new Error(`${path} differs from its authored recomputation.`);
    } else await writeFile(target, bytes);
  }
  return { vis2: merged.vis2.length, t3: merged.t3.length, rawVis2: merged.rawVis2, rawT3: merged.rawT3, files: merged.files.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await authorBetelgeuse({ check: process.argv.includes('--check') });
  console.log(`Betelgeuse: ${result.files} MATISSE files, ${result.rawVis2} raw V2 and ${result.rawT3} raw T3 channels -> ${result.vis2} V2 and ${result.t3} T3 rows; sphere table and beam-convolved image written.`);
}
