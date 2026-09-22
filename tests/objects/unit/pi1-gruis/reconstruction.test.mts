/**
 * The pinned reconstruction is checked against the pinned PIONIER file without the code that made it: an independent discrete
 * Fourier transform of the image, channel by channel at each channel's wavelength, must reproduce the measured squared
 * visibilities and closure phases about as well as SQUEEZE reported. The beam-convolved image the lens shows is recomputed
 * from the raw one, and the authoring tool's outputs are recomputed byte for byte.
 */
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('pi1-gruis');
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readChannelRows, fitChannels } from '../../../../tools/objects/interferometry/oifits-rows.mts';
import { reconstructionPlane, visibility } from '../../../../tools/objects/interferometry/image-fit.mts';
import { authorPi1Gruis, BEAM_FWHM_MAS } from '../../../../tools/objects/source-authoring/pi1-gruis/author.mts';
import { convolveGaussian, readReconstruction } from '../../../../tools/objects/interferometry/beam-convolve.mts';

const SOURCE = resolve(import.meta.dirname, '../../../../src/objects/pi1-gruis/source');
const IMAGE = resolve(SOURCE, 'observations/pi1-gruis-pionier-2014-09-squeeze.fits');
const BEAM_IMAGE = resolve(SOURCE, 'observations/pi1-gruis-pionier-2014-09-2.1mas.fits');
const VISIBILITIES = resolve(SOURCE, 'observations/PI_GRU_forImage.fits');
const DISC_MAS = 18.17;

test('the pinned reconstruction fits the pinned visibilities and closure phases', async () => {
  const fits = readReconstruction(await readFile(IMAGE));
  assert.equal(fits.width, 128); assert.equal(fits.height, 128);
  const image = reconstructionPlane(fits), pixelMas = image.pixelMas;
  assert.ok(image.eastLeft, 'east is on the left');
  const rows = readChannelRows(await readFile(VISIBILITIES));
  assert.equal(rows.vis2.length, 909); assert.equal(rows.t3.length, 603);
  const [re, im] = visibility(image, 0, 0, rows.wavelengthsMetres[0]!);
  assert.ok(Math.abs(re - 1) < 1e-12 && Math.abs(im) < 1e-12, 'a normalised image has unit visibility at zero baseline');
  const fit = fitChannels(image, rows);
  // SQUEEZE reported 2.45 and 1.06 for its own transform (reference/squeeze-command.txt).
  assert.ok(fit.reducedChi2Vis2 < 3, `squared-visibility reduced chi-squared ${fit.reducedChi2Vis2}`);
  assert.ok(fit.reducedChi2T3 < 1.5, `closure-phase reduced chi-squared ${fit.reducedChi2T3}`);
  const disc = { ...image, values: Float64Array.from({ length: 128 * 128 }, (_, i) => Math.hypot(i % 128 - 63.5, Math.floor(i / 128) - 63.5) * pixelMas <= DISC_MAS / 2 ? 1 : 0) };
  const discFit = fitChannels(disc, rows);
  assert.ok(discFit.reducedChi2Vis2 > 5 * fit.reducedChi2Vis2, `a uniform disc fits the visibilities worse: ${discFit.reducedChi2Vis2} against ${fit.reducedChi2Vis2}`);
});

test('the displayed image is the raw reconstruction convolved to the beam, and keeps its flux and centre', async () => {
  const raw = readReconstruction(await readFile(IMAGE)), beam = readReconstruction(await readFile(BEAM_IMAGE));
  assert.equal(beam.width, raw.width); assert.equal(beam.height, raw.height);
  const pixelMas = raw.axes.scale[0];
  const expected = convolveGaussian(raw, BEAM_FWHM_MAS / pixelMas);
  let maximum = 0, rawFlux = 0, beamFlux = 0;
  for (let i = 0; i < expected.length; i++) { maximum = Math.max(maximum, Math.abs(expected[i]! - beam.values[i]!)); rawFlux += raw.values[i]!; beamFlux += beam.values[i]!; }
  assert.ok(maximum < 1e-15, `the pinned beam image is the convolution of the pinned raw image (max difference ${maximum})`);
  assert.ok(Math.abs(beamFlux - rawFlux) < 1e-4 * rawFlux, 'convolution keeps the flux to the edge truncation');
  const rows = readChannelRows(await readFile(VISIBILITIES));
  const fit = fitChannels(reconstructionPlane(beam), rows);
  // The beam is the data's own resolution, so smoothing to it removes what the longest baselines measured: the beam image fits the
  // closure phases (1.3) but not the squared visibilities (55). It is the display, not the fit; the raw image is what the data constrain.
  assert.ok(fit.reducedChi2T3 < 2, `the beam-convolved image still fits the closure phases: ${fit.reducedChi2T3}`);
  assert.ok(fit.reducedChi2Vis2 > 20 && fit.reducedChi2Vis2 < 100, `and no longer the squared visibilities, as recorded: ${fit.reducedChi2Vis2}`);
  // Most of the light is on the disc: the halo is small next to Betelgeuse's.
  let sx = 0, sy = 0, sw = 0;
  for (let i = 0; i < beam.values.length; i++) { const v = beam.values[i]!; if (v > 0) { sx += (i % beam.width) * v; sy += Math.floor(i / beam.width) * v; sw += v; } }
  const inside = beam.values.reduce((sum, v, i) => Math.hypot(i % beam.width - sx / sw, Math.floor(i / beam.width) - sy / sw) * pixelMas <= DISC_MAS / 2 ? sum + v : sum, 0) / sw;
  assert.ok(inside > 0.8 && inside < 0.95, `${(inside * 100).toFixed(1)}% of the flux lies inside the fitted disc`);
});

test('the authored outputs are the tool\'s recomputation', async () => {
  const result = await authorPi1Gruis({ check: true });
  assert.equal(result.vis2, 909); assert.equal(result.t3, 603); assert.equal(result.channels, 6);
  assert.ok(Math.abs(result.beamMas - BEAM_FWHM_MAS) < 0.05);
});
