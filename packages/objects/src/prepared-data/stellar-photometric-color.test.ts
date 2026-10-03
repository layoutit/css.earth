import assert from 'node:assert/strict';
import test from 'node:test';
import { STELLAR_PHOTOMETRIC_COLOR_SCHEMA, PLANCK_FLOOR_KELVIN, parseStellarColorRecord, parseMeasuredSpectrumRecord, checkStellarTemperature } from './stellar-photometric-color.js';

const spectrum = { path: 'spectrum.txt', format: 'ascii-columns', wavelength: { column: '1', unit: 'nm' }, flux: { column: '2', kind: 'flux', error: '3' } };
const published = (kelvin: number, citation = 'https://example.org/paper') => ({ schema: STELLAR_PHOTOMETRIC_COLOR_SCHEMA, spectrum: 'planck',
  temperature: { published: { kelvin, lowerKelvin: 2580, upperKelvin: 2620, citation } } });
test('stellar color retains branch admission, bounds and diagnostics', () => {
  assert.equal(STELLAR_PHOTOMETRIC_COLOR_SCHEMA, 'cssearth-stellar-photometric-color@1');
  assert.equal(PLANCK_FLOOR_KELVIN, 1000);
  const parsed = parseStellarColorRecord(published(2600));
  assert.ok(parsed.spectrum === 'planck' && 'published' in parsed);
  assert.equal(parsed.published.kelvin, 2600);
  assert.throws(() => parseStellarColorRecord({ ...published(2600), schema: 'other' }), { message: 'The stellar color record must use cssearth-stellar-photometric-color@1.' });
  assert.throws(() => parseStellarColorRecord(published(2700)), /2700 K \(2580 to 2620\)/u);
  assert.throws(() => parseStellarColorRecord(published(2600, 'paper')), /by URL/u);
  assert.throws(() => checkStellarTemperature({ kelvin: 1000, lowerKelvin: 900, upperKelvin: 1100 }, 'temperature'), /inside its bounds/);
  const gaia = { schema: STELLAR_PHOTOMETRIC_COLOR_SCHEMA, spectrum: 'gaia-xp-sampled', sampledSpectrum: { path: 'xp.csv', sourceId: '123' } };
  assert.deepEqual(parseStellarColorRecord(gaia), { spectrum: 'gaia-xp-sampled', spectrumPath: 'xp.csv', sourceId: '123' });
  assert.throws(() => parseStellarColorRecord({ ...gaia, temperature: {} }), /takes no temperature/);
  assert.throws(() => parseStellarColorRecord({ ...gaia, sampledSpectrum: { path: 'xp.csv', sourceId: '1.2' } }), /integer string/);
  assert.deepEqual(parseStellarColorRecord({ schema: STELLAR_PHOTOMETRIC_COLOR_SCHEMA, spectrum: 'measured', measuredSpectrum: spectrum }),
    { spectrum: 'measured', measured: parseMeasuredSpectrumRecord(spectrum) });
});
test('measured stellar spectrum retains format, units, gap and error-column checks', () => {
  assert.deepEqual(parseMeasuredSpectrumRecord(spectrum).gaps, []);
  assert.throws(() => parseMeasuredSpectrumRecord({ ...spectrum, format: 'other' }), /Unknown measured spectrum format other/);
  assert.throws(() => parseMeasuredSpectrumRecord({ ...spectrum, format: 'fits-table' }), /names its extension/);
  assert.throws(() => parseMeasuredSpectrumRecord({ ...spectrum, format: 'tsv-columns' }), /error column/);
  assert.throws(() => parseMeasuredSpectrumRecord({ ...spectrum, wavelength: { column: '1', unit: 'm' } }), /Unknown wavelength unit/);
  assert.throws(() => parseMeasuredSpectrumRecord({ ...spectrum, gaps: [{ fromNm: 2, toNm: 1, reason: 'gap' }] }), /shorter to a longer/);
});
