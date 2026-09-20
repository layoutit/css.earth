import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { sha256 } from '../../../src/platform/sha256.mts';
import { card } from '../../../tests/fixtures/fits/helpers.mts';
import { fitsMetadata, isisMetadata, pdsMetadata, parseNativeMetadata } from './native-metadata.mts';
import { qualifySourceProduct } from './qualify-source.mts';
import { sourceRun, type SourceProduct } from './source-products.mts';
import { parseProductFacts } from './qualified-observations.mts';
import { assessRequest } from './request-satisfaction.mts';
const pin = { file: 'cube.fits', sha256: 'a'.repeat(64) };
const cube = (extra: readonly string[] = [], values = [1, 2, 3]) => {
  const header = Buffer.from([card('SIMPLE', 'T'), card('BITPIX', '-32'), card('NAXIS', '3'), card('NAXIS1', '1'), card('NAXIS2', '1'), card('NAXIS3', String(values.length)), ...extra, 'END'.padEnd(80)].join('').padEnd(2880));
  const data = Buffer.alloc(2880); values.forEach((n, i) => data.writeFloatBE(n, i * 4)); return Buffer.concat([header, data]);
};
const wave = [card('CTYPE3', "'WAVE'"), card('CUNIT3', "'nm'"), card('CRVAL3', '1000'), card('CRPIX3', '1'), card('CDELT3', '100'), card('BUNIT', "'MJy/sr'")];
const isis = (fields: string, calibration = '') => Buffer.from(`Object = IsisCube\nGroup = BandBin\n${fields}\nEnd_Group\nGroup = RadiometricCalibration\n${calibration}\nEnd_Group\nEnd_Object\nEnd\n`);

test('native FITS coordinates use one-based WCS, real units and retain holes in finite plane coverage', () => {
  const result = fitsMetadata(cube(wave, [1, NaN, 3]), pin);
  assert.deepEqual(result.nativeMetadata?.spectral?.centersMicrometres, [1, 1.1, 1.2]);
  assert.deepEqual(result.wavelengthIntervalsMicrometres, [[.9500000000000001, 1.05], [1.1500000000000001, 1.25]]);
  assert.equal(result.nativeMetadata?.units?.value, 'MJy/sr');
  assert.equal(assessRequest({ target: 'x', wavelengthMicrometres: [1, 1.2] }, { target: 'x', verified: true, ...result }).constraints.wavelength?.answer, 'partial');
  assert.deepEqual(parseNativeMetadata(result.nativeMetadata), result.nativeMetadata);
});
test('descending frequency axes convert to wavelength; coupled and unsupported WCS stay unknown', () => {
  const base = [card('CTYPE3', "'FREQ'"), card('CUNIT3', "'GHz'"), card('CRVAL3', '300'), card('CRPIX3', '1'), card('CDELT3', '-1')];
  const result = fitsMetadata(cube(base), pin);
  assert.ok(result.nativeMetadata!.spectral!.centersMicrometres[1] > result.nativeMetadata!.spectral!.centersMicrometres[0]);
  assert.equal(fitsMetadata(cube([...wave, card('PC3_1', '.1')]), pin).wavelengthIntervalsMicrometres, undefined);
  assert.equal(fitsMetadata(cube(wave.map(c => c.startsWith('CTYPE3') ? card('CTYPE3', "'WAVE-TAB'") : c)), pin).wavelengthIntervalsMicrometres, undefined);
  assert.throws(() => fitsMetadata(cube(wave.filter(c => !c.startsWith('CRPIX3'))), pin), /Incomplete/);
});
test('a product restoring beam requires both axes and applicable units; pixel sampling never becomes a PSF', () => {
  const beam = [card('BUNIT', "'Jy/beam'"), card('BMAJ', '0.001'), card('BMIN', '0.0001'), card('BPA', '45')];
  const facts = fitsMetadata(cube(beam), pin);
  assert.equal(facts.angularResolutionArcsec, 3.6);
  assert.deepEqual(facts.resolutionEvidence, [{ kind: 'calibrated', receipt: pin }]);
  assert.equal(fitsMetadata(cube([card('CDELT1', '0.00001')]), pin).angularResolutionArcsec, undefined);
  assert.throws(() => fitsMetadata(cube(beam.filter(c => !c.startsWith('BMIN'))), pin), /beam axes/);
  assert.equal(fitsMetadata(cube([...beam, card('CASAMBM', 'T')]), pin).angularResolutionArcsec, undefined);
  assert.equal(fitsMetadata(cube(beam.map(c => c.startsWith('BUNIT') ? card('BUNIT', "'DN'") : c)), pin).angularResolutionArcsec, undefined);
});
test('ISIS centers are count-checked and never inflated to continuous coverage without widths', () => {
  const result = isisMetadata(isis('Center = (1000,\n 1200, 1400) <nm>\nOriginalBand = (1, 2, 3)', 'OutputUnits = I/F'), 3);
  assert.deepEqual(result.nativeMetadata?.spectral?.centersMicrometres, [1, 1.2, 1.4000000000000001]);
  assert.equal(result.wavelengthIntervalsMicrometres, undefined);
  assert.equal(result.nativeMetadata?.units?.value, 'I/F');
  assert.throws(() => isisMetadata(isis('Center = (1, 2) <um>'), 3), /band count/);
  assert.throws(() => isisMetadata(isis('Center = (1, 2, 2) <um>'), 3), /monotonic/);
  assert.equal(isisMetadata(isis('Center = (1, 2, 3)'), 3).nativeMetadata?.spectral, undefined);
  assert.equal(isisMetadata(isis('Center = (1, 2, 3) <seconds>'), 3).nativeMetadata?.spectral, undefined);
  assert.equal(isisMetadata(isis('Center = (1, 2, 3) <um>', 'OutputUnits = nonsense'), 3).nativeMetadata?.units, undefined);
});
test('ISIS band widths preserve spectral gaps and exclude empty bands', () => {
  const result = isisMetadata(isis('Center = (1, 2, 3) <um>\nWidth = (100, 100, 100) <nm>'), 3, [true, false, true]);
  assert.deepEqual(result.wavelengthIntervalsMicrometres, [[.95, 1.05], [2.95, 3.05]]);
  assert.throws(() => isisMetadata(isis('Center = (1, 2, 3) <um>\nOriginalBand = (1, 1, 3)'), 3), /original-band/);
});
test('PDS optical filters and units must belong to the decoded array, never another global entry', () => {
  const decoded = { standard: 'PDS4', structures: [{ name: 'SCI', shape: [2, 3], nativeMetadata: { unit: 'I/F' } }], metadata: { units: ['K'], opticalFilters: [{ array: 'OTHER', center: '500', width: '10', centerUnit: 'nm', widthUnit: 'nm' }] } };
  assert.equal(pdsMetadata(decoded).wavelengthIntervalsMicrometres, undefined);
  assert.equal(pdsMetadata(decoded).nativeMetadata?.units?.value, 'I/F');
  decoded.metadata.opticalFilters[0].array = 'SCI';
  assert.deepEqual(pdsMetadata(decoded).wavelengthIntervalsMicrometres, [[.495, .505]]);
  decoded.metadata.opticalFilters.push(decoded.metadata.opticalFilters[0]);
  assert.throws(() => pdsMetadata(decoded), /Ambiguous/);
});
test('native qualification persists metadata, pins beam evidence and invalidates changed calibration bytes', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'native-metadata-'));
  try {
    const bytes = cube([...wave.map(c => c.startsWith('BUNIT') ? card('BUNIT', "'Jy/beam'") : c), card('BMAJ', '0.001'), card('BMIN', '0.0005')]);
    await mkdir(resolve(root, 'source')); await writeFile(resolve(root, pin.file), bytes);
    const product: SourceProduct = { id: 'cube', target: 'x', telescope: 'fixture', mode: 'cube', kind: 'cube', archiveProductId: 'native', decoder: 'fits-image', identity: { SIMPLE: true }, units: 'unchecked wrong units', meaning: 'fixture', citation: 'https://example.org', limitations: [],
      files: [{ role: 'science', path: pin.file, origin: 'https://example.org/cube.fits', bytes: bytes.length, sha256: sha256(bytes) }] };
    const first = await qualifySourceProduct(root, product);
    const report = JSON.parse(await readFile(resolve(root, 'output/telescopes/x/cube/decoded.json'), 'utf8'));
    const facts = parseProductFacts(report.facts);
    assert.equal(facts.nativeMetadata?.units?.value, 'Jy/beam');
    assert.equal(assessRequest({ target: 'x', wavelengthMicrometres: [1, 1.2], angularResolutionArcsec: 4 }, facts).status, 'fulfilled');
    assert.equal((await qualifySourceProduct(root, product)).reused, true);
    const changed = Buffer.from(bytes); changed.write(card('BMAJ', '0.002'), bytes.indexOf('BMAJ'));
    await writeFile(resolve(root, pin.file), changed);
    await assert.rejects(qualifySourceProduct(root, product), /manifest pin/);
    const revised = { ...product, files: [{ ...product.files[0], sha256: sha256(changed) }] };
    assert.notDeepEqual((await sourceRun(product)).inputs, (await sourceRun(revised)).inputs);
    assert.equal((await qualifySourceProduct(root, revised)).reused, false);
    const after = JSON.parse(await readFile(resolve(root, 'output/telescopes/x/cube/decoded.json'), 'utf8'));
    assert.equal(after.facts.angularResolutionArcsec, 7.2);
    assert.equal(first.reused, false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('PDS band coordinates require explicit band cardinality and wavelength units', () => {
  const decoded = { metadata: {}, structures: [{ name: 'QUBE', shape: [3, 2, 2], nativeMetadata: { unit: 'I/F', bands: 3, centers: [1000, 1100, 1200], wavelengthUnit: 'nm' } }] };
  assert.deepEqual(pdsMetadata(decoded).nativeMetadata?.spectral?.centersMicrometres, [1, 1.1, 1.2]);
  assert.equal(pdsMetadata(decoded).wavelengthIntervalsMicrometres, undefined);
  decoded.structures[0].nativeMetadata.bands = 2;
  assert.throws(() => pdsMetadata(decoded), /band count/);
});

test('ISIS RC19 convention requires the actual calibration record, not an instrument name alone', () => {
  const base = isis('Center = (1, 2, 3)\nOriginalBand = (97, 98, 99)', 'OutputUnits = I/F\nCalibrationVersion = RC19\nBandwidthFile = "$cassini/calibration/vims/RC19/band-wavelengths/wavelengths.2005_v0001.cub"').toString();
  const header = base.replace('End_Object', 'Group = Instrument\nInstrumentId = VIMS\nEnd_Group\nEnd_Object');
  assert.deepEqual(isisMetadata(Buffer.from(header), 3).nativeMetadata?.spectral?.centersMicrometres, [1, 2, 3]);
  assert.equal(isisMetadata(Buffer.from(header.replace('CalibrationVersion = RC19', 'CalibrationVersion = unknown')), 3).nativeMetadata?.spectral, undefined);
});

test('mixed units and coordinate overflow cannot silently qualify a spectral axis', () => {
  assert.throws(() => isisMetadata(isis('Center = (1 <um>, 2 <nm>, 3 <um>)'), 3), /Mixed/);
  assert.throws(() => isisMetadata(isis('Center = (1e308) <m>'), 1), /Invalid native/);
});
