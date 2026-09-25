#!/usr/bin/env node
/** Betelgeuse authored inputs: the uniform-disc reference sphere from the retained measurements, the monochromatic continuum
 * OIFITS merged from the pinned VLT/MATISSE files, the beam-convolved reconstruction and the navigation marker rendered from it.
 * All are deterministic functions of checked-in or pinned inputs.
 *
 *   node tools/objects/source-authoring/betelgeuse/author.mts [--check]
 *
 * --check recomputes both outputs and fails if either differs from the file on disk. */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mergeContinuum, mergedOifits, type ContinuumRecipe } from '../../interferometry/matisse-continuum.mts';
import { convolveGaussian, readReconstruction, writeReconstruction } from '../../interferometry/beam-convolve.mts';
import { skyDisplayRaster } from '@cssearth/fits';
import { requireArray, requireRecord, requireFiniteNumber, requireString } from '@cssearth/core';
import sharp from 'sharp';
import { interpolatePalette } from '../../color-transfer.mts';

const root = resolve(import.meta.dirname, '../../../../src/objects/betelgeuse/source');

/** The reconstruction recipe the pilot settled: the paper's pseudo-continuum windows, its two February 2020 nights, and the
 * error floors set above the scatter of the beam-commuting-device repeats: the repeats give 0.085 of the squared visibility
 * and no additive term, and the recipe states 0.12 and 5.65e-4, so every error written is at least the measured scatter.
 * season.json records the measurement. */
export const CONTINUUM_RECIPE: ContinuumRecipe = Object.freeze({
  windowsMicrometres: [[3.942, 3.974], [3.992, 3.998]] as const,
  referenceWavelengthMetres: 3.97e-6, referenceBandMetres: 0.06e-6,
  vis2MultiplicativeFloor: 0.12, vis2AdditiveFloor: 5.65e-4, closurePhaseFloorDegrees: 2,
  outputMjd: 58895, outputDateObs: '2020-02-08',
  target: { name: 'alf Ori', rightAscensionDegrees: 88.7929, declinationDegrees: 7.4071, spectralType: 'M2Iab' },
});
export const CONTINUUM_NIGHTS = Object.freeze(['2020-02-08', '2020-02-19']);

/** The three MATISSE epochs Drevon et al. (2024) image, before, during and after the Great Dimming: the nights their Table 1
 * keeps after rejecting contaminated ones, the continuum recipe above with each epoch's output date, and the beam each epoch's
 * longest baseline resolves (lambda / 2 B at 3.97 micrometres; February 2020 keeps the paper's 4 mas). The February epoch drives
 * the navigation marker. */
export interface MatisseEpoch { readonly id: string; readonly nights: readonly string[]; readonly files: number; readonly outputMjd: number; readonly outputDateObs: string; readonly beamMas: number }
export const MATISSE_EPOCHS: readonly MatisseEpoch[] = Object.freeze([
  { id: '2018-12', nights: ['2018-12-03', '2018-12-05', '2018-12-08', '2018-12-09', '2018-12-11', '2018-12-12', '2018-12-14', '2018-12-15'], files: 111, outputMjd: 58460, outputDateObs: '2018-12-03', beamMas: 3 },
  { id: '2020-02', nights: CONTINUUM_NIGHTS, files: 29, outputMjd: 58895, outputDateObs: '2020-02-08', beamMas: 4 },
  { id: '2020-12', nights: ['2020-12-14', '2020-12-18', '2020-12-27'], files: 48, outputMjd: 59201, outputDateObs: '2020-12-14', beamMas: 3.1 },
]);
export const epochPaths = (id: string) => ({ merged: `observations/betelgeuse-matisse-${id}-continuum.oifits`, raw: `observations/betelgeuse-matisse-${id}-continuum-squeeze.fits`,
  beam: (beamMas: number) => `observations/betelgeuse-matisse-${id}-continuum-${beamMas.toFixed(1).replace(/\.0$/u, '')}mas.fits` });
export const MERGED_PATH = 'observations/betelgeuse-matisse-2020-02-continuum.oifits';
/** SQUEEZE's posterior mean at 0.78 mas pixels, and the same image convolved to the 4 mas beam of the February 2020 baselines
 * (Drevon et al. 2024), which is what the lens casts: structure below the beam is the regulariser's, not the star's. */
export const RAW_IMAGE_PATH = 'observations/betelgeuse-matisse-2020-02-continuum-squeeze.fits';
export const BEAM_IMAGE_PATH = 'observations/betelgeuse-matisse-2020-02-continuum-4mas.fits';
export const BEAM_FWHM_MAS = 4;
export const SPHERE_PATH = 'shape/uniform-disc.tab';
/** The navigation marker: the beam-convolved reconstruction as observed (north up, east left) through the lens's palette. */
export const CONTEXT_PATH = 'presentation/context.png';
export const CONTEXT_SIZE = 512;

/** A latitude/longitude/radius table of one radius: the reference sphere, in the released-table format the mesh loader reads. */
export function uniformDiscTable(radiusKm: number, stepDegrees: number): string {
  const lines: string[] = [];
  for (let latitude = -90; latitude <= 90; latitude += stepDegrees) {
    for (let longitude = 0; longitude <= 360; longitude += stepDegrees) lines.push(`${longitude} ${latitude} ${radiusKm.toFixed(6)}`);
  }
  return `${lines.join('\n')}\n`;
}

/** The sky-plane image through the lens's own palette and percentile stretch, transparent off the disc. */
export async function contextMarker(image: ReturnType<typeof readReconstruction>, palette: readonly string[], percentiles: readonly [number, number], backgroundMaximum: number) {
  const { width, height } = image, values = skyDisplayRaster(image.values, width, height, image.axes);
  const disc = values.filter(value => value > backgroundMaximum).sort((a, b) => a - b);
  if (!disc.length) throw new Error('The reconstruction has no pixel above the background maximum.');
  const at = (p: number) => disc[Math.min(disc.length - 1, Math.floor(disc.length * p / 100))]!;
  const [low, high] = [at(percentiles[0]), at(percentiles[1])];
  if (!(high > low)) throw new Error('The reconstruction has no display range.');
  const rgba = Buffer.alloc(width * height * 4);
  for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
    const value = values[row * width + column]!;
    if (!(value > backgroundMaximum)) continue;
    const [r, g, b] = interpolatePalette(palette, (value - low) / (high - low));
    rgba.set([r, g, b, 255], (row * width + column) * 4);
  }
  return sharp(rgba, { raw: { width, height, channels: 4 } }).resize(CONTEXT_SIZE, CONTEXT_SIZE, { kernel: 'lanczos3', fit: 'fill' }).png({ compressionLevel: 9 }).toBuffer();
}

/** The uniform-disc reference sphere alone: a deterministic function of the retained measurements, with no dependency on
 * the much larger pinned interferometry archives every sibling star body also authors. Written or checked first, so the
 * small sphere table restores without the archive files a full run also needs. Shared by every uniform-disc star body. */
export async function authorUniformDiscSphere(sourceRoot: string, label: string, { check = false } = {}) {
  const measurements = requireRecord(JSON.parse(await readFile(resolve(sourceRoot, 'measurements.json'), 'utf8')), 'measurements');
  if (measurements.schema !== 'cssearth-uniform-disc-star@1') throw new TypeError(`Unexpected ${label} measurements schema.`);
  const shape = requireRecord(measurements.shape, 'shape');
  if (requireString(shape.path) !== SPHERE_PATH) throw new TypeError(`${label} sphere path differs from the authoring tool.`);
  const bytes = Buffer.from(uniformDiscTable(requireFiniteNumber(measurements.radiusKm), requireFiniteNumber(shape.stepDegrees)), 'latin1');
  const target = resolve(sourceRoot, SPHERE_PATH);
  if (check) { if (!(await readFile(target)).equals(bytes)) throw new Error(`${SPHERE_PATH} differs from its authored recomputation.`); }
  else await writeFile(target, bytes);
  return measurements;
}

export async function authorBetelgeuse({ check = false } = {}) {
  await authorUniformDiscSphere(root, 'Betelgeuse', { check });
  const oifitsDirectory = resolve(root, 'observations/oifits'), names = await readdir(oifitsDirectory);
  const raster = requireRecord(JSON.parse(await readFile(resolve(root, 'preparation/raster.json'), 'utf8')), 'raster');
  const lens = requireRecord(requireRecord(requireRecord(requireArray(raster.surfaces)[0], 'surface').science, 'science').lens, 'lens');
  const display = requireRecord(lens.display, 'display'), frame = requireRecord(requireArray(lens.frames)[0], 'frame');
  const palette = requireArray(display.palette).map(value => requireString(value)), percentiles = requireArray(display.percentiles).map(value => requireFiniteNumber(value));
  const outputs: [string, Buffer][] = [], counts: Record<string, { vis2: number; t3: number; files: number }> = {};
  for (const epoch of MATISSE_EPOCHS) {
    const files = names.filter(name => name.endsWith('.fits') && epoch.nights.some(night => name.startsWith(night))).sort().map(name => resolve(oifitsDirectory, name));
    if (files.length !== epoch.files) throw new Error(`Expected the ${epoch.files} pinned ${epoch.id} MATISSE files, found ${files.length}.`);
    const recipe = { ...CONTINUUM_RECIPE, outputMjd: epoch.outputMjd, outputDateObs: epoch.outputDateObs };
    const merged = await mergeContinuum(files, recipe), paths = epochPaths(epoch.id);
    const raw = readReconstruction(await readFile(resolve(root, paths.raw)));
    const pixelMas = raw.axes.scale[0];
    const beam = writeReconstruction(raw, convolveGaussian(raw, epoch.beamMas / pixelMas), [['BEAMFWHM', epoch.beamMas, 'mas, Gaussian convolution applied by author.mts'], ['ORIGFILE', paths.raw.split('/').at(-1)!, 'SQUEEZE posterior mean this was convolved from']]);
    outputs.push([paths.merged, mergedOifits(merged, recipe)], [paths.beam(epoch.beamMas), beam]);
    if (epoch.id === '2020-02') outputs.push([CONTEXT_PATH, await contextMarker(readReconstruction(beam), palette, [percentiles[0]!, percentiles[1]!], requireFiniteNumber(frame.backgroundMaximum))]);
    counts[epoch.id] = { vis2: merged.vis2.length, t3: merged.t3.length, files: merged.files.length };
  }
  for (const [path, bytes] of outputs) {
    const target = resolve(root, path);
    if (check) {
      if (!(await readFile(target)).equals(bytes)) throw new Error(`${path} differs from its authored recomputation.`);
    } else await writeFile(target, bytes);
  }
  return counts;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await authorBetelgeuse({ check: process.argv.includes('--check') });
  for (const [id, count] of Object.entries(result)) console.log(`Betelgeuse ${id}: ${count.files} MATISSE files -> ${count.vis2} V2 and ${count.t3} T3 rows; merged visibilities and beam-convolved image written.`);
}
