/**
 * The two images are the authors' (Montargès et al. 2018, CDS J/A+A/614/A12), not reconstructed here. They are checked against
 * the public calibrated PIONIER files in the OiDB with an independent transform, channel by channel. Those files are the JMMC
 * pipeline's automated calibration, not the paper's reduction, so the fit is poorer than the paper's; what the test pins is that
 * each image is the right epoch in the right orientation: mirrored or turned, it fits several times worse.
 */
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('ce-tauri');
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readReconstruction } from '../../../../tools/objects/interferometry/beam-convolve.mts';
import { concatenateOifits } from '../../../../tools/objects/interferometry/oifits-concat.mts';
import { fitChannels, readChannelRows } from '../../../../tools/objects/interferometry/oifits-rows.mts';
import { reconstructionPlane } from '../../../../tools/objects/interferometry/image-fit.mts';

const SOURCE = resolve(import.meta.dirname, '../../../../src/objects/ce-tauri/source');
const OIFITS = resolve(SOURCE, 'observations/oifits');
const acquired = await access(OIFITS).then(() => true, () => false);
const nights = async (prefix: string) => {
  const files = (await readdir(OIFITS)).filter(name => name.startsWith(prefix)).sort();
  return readChannelRows(concatenateOifits(await Promise.all(files.map(name => readFile(resolve(OIFITS, name))))).bytes);
};
const image = async (name: string) => {
  const fits = readReconstruction(await readFile(resolve(SOURCE, `observations/${name}.fit`)));
  return { fits, pixelMas: fits.axes.scale[0] };
};

test('the published images are 32 by 32 pixels of 0.5 mas, east left, with unit flux', async () => {
  for (const name of ['nov_avg', 'dec_avg']) {
    const { fits, pixelMas } = await image(name);
    assert.equal(fits.width, 32); assert.equal(fits.height, 32); assert.equal(pixelMas, 0.5);
    assert.ok(reconstructionPlane(fits).eastLeft, `${name}: east is on the left`);
    const total = fits.values.reduce((sum, value) => sum + value, 0);
    assert.ok(Math.abs(total - 1) < 1e-6, `${name}: flux sums to one (${total})`);
  }
});

test('each published image fits its own epoch of the public visibilities, and only in its published orientation', { skip: !acquired && 'PIONIER files not acquired' }, async () => {
  const november = await nights('PIONI.2016-11'), december = await nights('PIONI.2016-12-23');
  assert.equal(november.vis2.length, 276); assert.equal(december.vis2.length, 144);
  const nov = await image('nov_avg'), dec = await image('dec_avg');
  const plane = (fits: typeof nov.fits, values: ArrayLike<number> = fits.values, mirror = false) => { const read = reconstructionPlane({ ...fits, values }); return { ...read, eastLeft: read.eastLeft !== mirror }; };
  const novFit = fitChannels(plane(nov.fits), november), decFit = fitChannels(plane(dec.fits), december);
  assert.ok(novFit.reducedChi2Vis2 < 20 && novFit.reducedChi2T3 < 40, `November: ${novFit.reducedChi2Vis2}, ${novFit.reducedChi2T3}`);
  assert.ok(decFit.reducedChi2Vis2 < 16 && decFit.reducedChi2T3 < 3.5, `December: ${decFit.reducedChi2Vis2}, ${decFit.reducedChi2T3}`);
  // Mirrored east-west, or turned by 180 degrees, the same image fits the closure phases several times worse.
  const mirrored = fitChannels(plane(nov.fits, nov.fits.values, true), november);
  const turned = fitChannels(plane(nov.fits, Float64Array.from(nov.fits.values).reverse()), november);
  assert.ok(mirrored.reducedChi2T3 > 4 * novFit.reducedChi2T3, `mirrored: ${mirrored.reducedChi2T3}`);
  assert.ok(turned.reducedChi2T3 > 4 * novFit.reducedChi2T3, `turned: ${turned.reducedChi2T3}`);
  // A uniform disc of the published diameter fits the squared visibilities worse than the image.
  const disc = plane(dec.fits, Float64Array.from({ length: 32 * 32 }, (_, i) => Math.hypot(i % 32 - 15.5, Math.floor(i / 32) - 15.5) * 0.5 <= 10.18 / 2 ? 1 : 0));
  const discFit = fitChannels(disc, december);
  assert.ok(discFit.reducedChi2Vis2 > 3 * decFit.reducedChi2Vis2, `uniform disc: ${discFit.reducedChi2Vis2} against ${decFit.reducedChi2Vis2}`);
});
