/**
 * The pinned reconstruction is checked against the pinned visibilities without the code that made it: an independent discrete
 * Fourier transform of the image must reproduce the measured squared visibilities and closure phases about as well as SQUEEZE
 * reported. This is the proof that the photograph lens is an image of the data, not of the regulariser alone. The merged
 * visibilities are themselves recomputed from the pinned MATISSE files when those are present.
 */
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('betelgeuse');
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readMergedContinuum } from '../../../../tools/objects/interferometry/matisse-continuum.mts';
import { fitStatistics, reconstructionPlane, visibility } from '../../../../tools/objects/interferometry/image-fit.mts';
import { authorBetelgeuse, BEAM_FWHM_MAS } from '../../../../tools/objects/source-authoring/betelgeuse/author.mts';
import { convolveGaussian, readReconstruction } from '../../../../tools/objects/interferometry/beam-convolve.mts';

const SOURCE = resolve(import.meta.dirname, '../../../../src/objects/betelgeuse/source');
const IMAGE = resolve(SOURCE, 'observations/betelgeuse-matisse-2020-02-continuum-squeeze.fits');
const BEAM_IMAGE = resolve(SOURCE, 'observations/betelgeuse-matisse-2020-02-continuum-4mas.fits');
const VISIBILITIES = resolve(SOURCE, 'observations/betelgeuse-matisse-2020-02-continuum.oifits');

test('the pinned reconstruction fits the pinned visibilities and closure phases', async () => {
  const fits = readReconstruction(await readFile(IMAGE));
  assert.equal(fits.width, 128); assert.equal(fits.height, 128);
  const image = reconstructionPlane(fits);
  assert.ok(image.eastLeft, 'east is on the left');
  const data = readMergedContinuum(await readFile(VISIBILITIES));
  assert.equal(data.vis2.length, 780); assert.equal(data.t3.length, 520);
  // Zero baseline: a normalised image has unit visibility.
  const [re, im] = visibility(image, 0, 0, data.wavelengthMetres);
  assert.ok(Math.abs(re - 1) < 1e-12 && Math.abs(im) < 1e-12);
  const fit = fitStatistics(image, data.wavelengthMetres, data.vis2, data.t3);
  // SQUEEZE reported 0.35 and 1.12 for its own transform (reference/squeeze-command.txt); the independent transform must agree
  // within the sampling of a 0.78 mas grid against sub-percent visibilities, and a uniform disc of the same size does not fit.
  assert.ok(fit.reducedChi2Vis2 < 0.6, `squared-visibility reduced chi-squared ${fit.reducedChi2Vis2}`);
  assert.ok(fit.reducedChi2T3 < 1.5, `closure-phase reduced chi-squared ${fit.reducedChi2T3}`);
  const disc = { ...image, values: Float64Array.from({ length: 128 * 128 }, (_, i) => Math.hypot(i % 128 - 63.5, Math.floor(i / 128) - 63.5) * 0.78 <= 42.45 / 2 ? 1 : 0) };
  const discFit = fitStatistics(disc, data.wavelengthMetres, data.vis2, data.t3);
  assert.ok(discFit.reducedChi2Vis2 > 3 * fit.reducedChi2Vis2, `a uniform disc fits the visibilities worse: ${discFit.reducedChi2Vis2} against ${fit.reducedChi2Vis2}`);
});

test('the light outside the photospheric disc is required by the visibilities', async () => {
  // The beam-convolved image keeps 80 percent of its flux inside the 42.45 mas disc. Zeroing everything outside it, or everything
  // beyond a few beams of the limb, breaks the fit to the closure phases: the halo the off-limb plate shows is in the data.
  const beam = readReconstruction(await readFile(BEAM_IMAGE)), data = readMergedContinuum(await readFile(VISIBILITIES));
  const pixelMas = beam.axes.scale[0], { width, height } = beam;
  let sx = 0, sy = 0, sw = 0;
  for (let i = 0; i < beam.values.length; i++) { const v = beam.values[i]!; if (v > 0) { sx += (i % width) * v; sy += Math.floor(i / width) * v; sw += v; } }
  const cx = sx / sw, cy = sy / sw, discRadius = 42.45 / 2 / pixelMas;
  const within = (limit: number) => { const values = Float64Array.from(beam.values, (v, i) => Math.hypot(i % width - cx, Math.floor(i / width) - cy) <= limit ? v : 0); const total = values.reduce((a, b) => a + b, 0); return { width, height, values: values.map(v => v / total), pixelMas, eastLeft: true }; };
  const full = fitStatistics(reconstructionPlane(beam), data.wavelengthMetres, data.vis2, data.t3);
  const disc = fitStatistics(within(discRadius), data.wavelengthMetres, data.vis2, data.t3);
  const fourBeams = fitStatistics(within(discRadius + 4 * BEAM_FWHM_MAS / pixelMas), data.wavelengthMetres, data.vis2, data.t3);
  assert.ok(disc.reducedChi2T3 > 100 * full.reducedChi2T3, `without the off-limb light the closure phases do not fit: ${disc.reducedChi2T3} against ${full.reducedChi2T3}`);
  assert.ok(fourBeams.reducedChi2T3 > 5 * full.reducedChi2T3, `light beyond four beams of the limb is still required: ${fourBeams.reducedChi2T3} against ${full.reducedChi2T3}`);
  const outside = beam.values.reduce((sum, v, i) => Math.hypot(i % width - cx, Math.floor(i / width) - cy) > discRadius ? sum + v : sum, 0) / beam.values.reduce((a, b) => a + b, 0);
  assert.ok(outside > 0.15 && outside < 0.25, `a fifth of the flux lies outside the disc: ${outside}`);
});

test('the displayed image is the raw reconstruction convolved to the beam, and keeps its flux and centre', async () => {
  const raw = readReconstruction(await readFile(IMAGE)), beam = readReconstruction(await readFile(BEAM_IMAGE));
  assert.equal(beam.width, raw.width); assert.equal(beam.height, raw.height);
  const expected = convolveGaussian(raw, BEAM_FWHM_MAS / raw.axes.scale[0]);
  let maximum = 0, rawFlux = 0, beamFlux = 0;
  for (let i = 0; i < expected.length; i++) { maximum = Math.max(maximum, Math.abs(expected[i]! - beam.values[i]!)); rawFlux += raw.values[i]!; beamFlux += beam.values[i]!; }
  assert.ok(maximum < 1e-15, `the pinned beam image is the convolution of the pinned raw image (max difference ${maximum})`);
  assert.ok(Math.abs(beamFlux - rawFlux) < 1e-4 * rawFlux, 'convolution keeps the flux to the edge truncation');
  // The beam removes the regulariser's grain: the peak over the median inside the disc drops, and the fit to the visibilities is still close.
  const wavelength = readMergedContinuum(await readFile(VISIBILITIES));
  const fit = fitStatistics(reconstructionPlane(beam), wavelength.wavelengthMetres, wavelength.vis2, wavelength.t3);
  assert.ok(fit.reducedChi2Vis2 < 2 && fit.reducedChi2T3 < 2.5, `the beam-convolved image still fits: ${fit.reducedChi2Vis2}, ${fit.reducedChi2T3}`);
});

test('the merged visibilities are the pinned MATISSE files averaged by the authoring tool', { skip: !(await access(resolve(SOURCE, 'observations/oifits')).then(() => true, () => false)) && 'MATISSE files not acquired' }, async () => {
  const result = await authorBetelgeuse({ check: true });
  assert.deepEqual(result['2020-02'], { files: 29, vis2: 780, t3: 520 });
  assert.deepEqual(result['2018-12'], { files: 111, vis2: 3240, t3: 2160 });
  assert.deepEqual(result['2020-12'], { files: 48, vis2: 1248, t3: 832 });
});
