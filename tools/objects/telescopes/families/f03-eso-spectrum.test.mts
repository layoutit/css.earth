import test from 'node:test';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { primaryHdu, binaryTableHdu } from '../../interferometry/fits-table.mts';
import { readEsoSpectrum, describeEsoSpectrum } from './f03-eso-spectrum.mts';
import { exportSpectrumCsv, spectrumPreviewSamples } from './f03-spectrum.mts';

/** Deliberately small adversarial SDP record; independent real-data comparison is retained in evidence. */
type Card = NonNullable<Parameters<typeof primaryHdu>[0]>[number];
function spectrumFixture(options: { readonly errorUnit?: string; readonly flags?: readonly number[]; readonly wave?: readonly number[];
  readonly flux?: readonly number[]; readonly error?: readonly number[]; readonly extra?: readonly Card[]; readonly target?: string } = {}): Buffer {
  return Buffer.concat([primaryHdu([['OBJECT', options.target ?? 'Betelgeuse'], ['PRODCATG', 'SCIENCE.SPECTRUM'], ['SPECSYS', 'BARYCENT'], ['FLUXCAL', 'ABSOLUTE']]),
    binaryTableHdu('SPECTRUM', [{ name: 'WAVE', form: '5D' }, { name: 'FLUX', form: '5D' }, { name: 'ERR', form: '5D' }, { name: 'QUAL', form: '5J' }],
      [[options.wave ?? [4000, 4001, 4002, 4003, 4004], options.flux ?? [1, 2, -3, 4, 5], options.error ?? [.1, .2, .3, .4, .5], options.flags ?? [0, 1, 0, 0, 0]]],
      [['VOCLASS', 'SPECTRUM V2.0'], ['NELEM', 5], ['TUNIT1', 'angstrom'], ['TUNIT2', 'Jy'], ['TUNIT3', options.errorUnit ?? 'Jy'],
        ['TUTYP1', 'spec:Data.SpectralAxis.Value'], ['TUTYP2', 'spec:Data.FluxAxis.Value'], ['TUTYP3', 'spec:Data.FluxAxis.Accuracy.StatError'], ...options.extra ?? []])]);
}

test('ESO SDP preserves units, negative flux and native IDs, and breaks at rejected quality', () => {
  const source = readEsoSpectrum(spectrumFixture());
  assert.equal(source.nativeSamples, 5); assert.equal(source.excludedSamples, 1);
  assert.equal(source.wavelengthToMicrometres, 1e-4); assert.equal(source.fluxUnit, 'Jy');
  assert.deepEqual(source.samples.map(s => [s.id, s.segment, s.wavelength, s.value, s.uncertainty]),
    [['0', '1', 4000, 1, .1], ['2', '2', 4002, -3, .3], ['3', '2', 4003, 4, .4], ['4', '2', 4004, 5, .5]]);
  const product = describeEsoSpectrum('fixture-spectrum', 'betelgeuse', source);
  assert.deepEqual(product.components[0]!.locations, [{ memberId: 'science', hdu: 1 }]);
  assert.equal(product.components[0]!.axes[0]!.length, 5);
  assert.match(exportSpectrumCsv(source.samples), /2,2,4002,-3,0.3,0/u);
});

test('nonfinite flux and invalid errors are excluded without silently joining gaps', () => {
  const source = readEsoSpectrum(spectrumFixture({ flags: [0, 0, 0, 0, 0], flux: [1, NaN, 3, 4, 5], error: [.1, .2, .3, 0, .5] }));
  assert.deepEqual(source.samples.map(s => [s.id, s.segment]), [['0', '1'], ['2', '2'], ['4', '3']]);
  assert.throws(() => readEsoSpectrum(spectrumFixture({ error: [0, 0, 0, 0, 0] })), /needs samples/u);
});

test('ambiguous or incompatible spectral coordinates and error units are refused', () => {
  assert.throws(() => readEsoSpectrum(spectrumFixture({ errorUnit: 'mJy' })), /same stated unit/u);
  assert.throws(() => readEsoSpectrum(spectrumFixture({ wave: [1, 2, 2, 4, 5] })), /strictly increasing/u);
  assert.throws(() => readEsoSpectrum(spectrumFixture({ flags: [0, -1, 0, 0, 0] })), /invalid flag/u);
  assert.throws(() => readEsoSpectrum(spectrumFixture({ extra: [['NELEM', 6]] })), /NELEM/u);
  assert.throws(() => readEsoSpectrum(primaryHdu()), /PRODCATG/u);
});

test('large spectrum previews select bounded native samples and retain gap identities', () => {
  const samples = Array.from({ length: 200_000 }, (_, i) => ({ id: String(i), segment: i < 100_000 ? 'blue' : 'red', wavelength: i + 1, value: i }));
  const preview = spectrumPreviewSamples(samples);
  assert.equal(preview.samples.length, 1600);
  assert.equal(preview.samples[0], samples[0]); assert.equal(preview.samples.at(-1), samples.at(-1));
  assert.deepEqual([...new Set(preview.samples.map(s => s.segment))], ['blue', 'red']);
  assert.equal(preview.sampling.sourceSamples, 200_000);
  assert.equal(spectrumPreviewSamples(samples.slice(0, 12)).samples.length, 12);
});

test('real ESPRESSO excerpt agrees with independent Astropy 8.0.1 values', async () => {
  const fixture = new URL('../../../../tests/fixtures/telescope-vo/eso-spectrum/', import.meta.url);
  const reference = JSON.parse(await readFile(new URL('astropy-reference.json', fixture), 'utf8'));
  const source = readEsoSpectrum(await readFile(new URL('espresso-excerpt.fits', fixture)));
  assert.equal(source.wavelengthUnit, reference.wavelengthUnit);
  assert.equal(source.fluxUnit, reference.fluxUnit);
  assert.deepEqual(source.samples.map(({ segment: _segment, ...sample }) => sample), reference.samples);
});
