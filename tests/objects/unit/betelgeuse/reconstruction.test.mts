/**
 * The pinned reconstruction is checked against the pinned visibilities without the code that made it: an independent discrete
 * Fourier transform of the image must reproduce the measured squared visibilities and closure phases about as well as SQUEEZE
 * reported. This is the proof that the photograph lens is an image of the data, not of the regulariser alone. The merged
 * visibilities are themselves recomputed from the pinned MATISSE files when those are present.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readFitsImage } from '../../../../tools/fits.mts';
import { readMergedContinuum } from '../../../../tools/objects/interferometry/matisse-continuum.mts';
import { fitStatistics, visibility } from '../../../../tools/objects/interferometry/image-fit.mts';
import { authorBetelgeuse } from '../../../../tools/objects/source-authoring/betelgeuse/author.mts';

const SOURCE = resolve(import.meta.dirname, '../../../../src/objects/betelgeuse/source');
const IMAGE = resolve(SOURCE, 'observations/betelgeuse-matisse-2020-02-continuum-squeeze.fits');
const VISIBILITIES = resolve(SOURCE, 'observations/betelgeuse-matisse-2020-02-continuum.oifits');

test('the pinned reconstruction fits the pinned visibilities and closure phases', async () => {
  const fits = readFitsImage(await readFile(IMAGE));
  assert.equal(fits.bitpix, -64); assert.equal(fits.width, 128); assert.equal(fits.height, 128);
  assert.ok(Number(fits.header.CDELT1) < 0, 'east is on the left');
  const image = { width: fits.width, height: fits.height, values: fits.values, pixelMas: Math.abs(Number(fits.header.CDELT1)), eastLeft: true };
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

test('the merged visibilities are the pinned MATISSE files averaged by the authoring tool', { skip: !(await access(resolve(SOURCE, 'observations/oifits')).then(() => true, () => false)) && 'MATISSE files not acquired' }, async () => {
  const result = await authorBetelgeuse({ check: true });
  assert.equal(result.files, 29); assert.equal(result.vis2, 780); assert.equal(result.t3, 520);
});
