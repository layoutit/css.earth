import assert from 'node:assert/strict';
import test from 'node:test';
import { isisMetadata, pdsMetadata } from './native-metadata.mts';
const isis = (fields: string, calibration = '') => Buffer.from(`Object = IsisCube\nGroup = BandBin\n${fields}\nEnd_Group\nGroup = RadiometricCalibration\n${calibration}\nEnd_Group\nEnd_Object\nEnd\n`);

test('ISIS centers are count-checked and never inflated to continuous coverage without widths', () => {
  const result = isisMetadata(isis('Center = (1000,\n 1200, 1400) <nm>\nOriginalBand = (1, 2, 3)', 'OutputUnits = I/F'), 3);
  assert.deepEqual(result.nativeMetadata?.spectral?.centersMicrometres, [1, 1.2, 1.4000000000000001]);
  assert.equal(result.wavelengthIntervalsMicrometres, undefined);
  assert.equal(result.nativeMetadata?.units?.value, 'I/F');
  assert.throws(() => isisMetadata(isis('Center = (1, 2) <um>'), 3), /band count/);
  assert.throws(() => isisMetadata(isis('Center = (1, 2, 2) <um>'), 3), /monotonic/);
  assert.equal(isisMetadata(isis('Center = (1, 2, 3)'), 3).nativeMetadata?.spectral, undefined);
  assert.equal(isisMetadata(isis('Center = (1, 2, 3) <seconds>'), 3).nativeMetadata?.spectral, undefined);
  assert.equal(isisMetadata(isis('Center = (1, 2, 3) <um>', 'OutputUnits = nonsense'), 3).nativeMetadata?.units?.value, 'nonsense'); // The shared Astropy boundary validates the recorded spelling.
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

test('named geometry planes cannot masquerade as a spectral cube',()=>{
 const f=isisMetadata(isis('Center = (1,1) <um>\nOriginalBand = (97,97)\nName = (Latitude, Longitude)'),2);
 assert.equal(f.nativeMetadata?.spectral,undefined);assert.match(f.nativeMetadata!.structure,/geometry/);
});
