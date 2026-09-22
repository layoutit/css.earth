import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { pds3LabelHasReflectance } from './formats/pds3-reflectance.mts';

const label = readFileSync(new URL('../../../src/objects/tethys/source/observations/N1807429484_1_CALIB.LBL', import.meta.url), 'utf8');

test('the actual Cassini CISSCAL calibration log still qualifies reflectance after strict label parsing', () => {
  assert.equal(pds3LabelHasReflectance(label), true);
  for (const bad of [label.replace("UNITS = 'I/F'", "UNITS = 'DN'"), label.replace("UNITS = 'I/F'", "UNITS = 'I/F'\n  UNITS = 'DN'"),
    label.replace("UNITS = 'I/F'", "UNITS = 'I/F'\n  UNITS = 'I/F'"), label.replace('Calibrated using CISSCAL', 'Example using CISSCAL'),
    label.replace('CASSINI ORBITER', 'OTHER SPACECRAFT'), label.replace('INSTRUMENT_ID = "ISSNA"', 'INSTRUMENT_ID = "OTHER"'),
    `UNITS = 'DN'\n${label}`, label.replace("UNITS = 'I/F'", "UNITS = 'I/F' trailing text")]) {
    assert.equal(pds3LabelHasReflectance(bad), false);
  }
});

test('Voyager IMAGE reflectance scaling and explicit units remain supported, unrelated prose does not qualify', () => {
  const voyager = readFileSync(new URL('../../../src/objects/proteus/source/observations/C1137339_GEOMED.LBL', import.meta.url), 'utf8');
  assert.equal(pds3LabelHasReflectance(voyager), true);
  assert.equal(pds3LabelHasReflectance(voyager.replace('1.0000E-04', '1.0000E-05')), false);
  assert.equal(pds3LabelHasReflectance("UNITS = 'I/F'\n"), true);
  assert.equal(pds3LabelHasReflectance("DESCRIPTION = \"\nUNITS = 'I/F'\n\"\n"), false);
  assert.throws(() => pds3LabelHasReflectance("UNITS = 'I/F'\nUNITS = 'DN'\n"), /Duplicate/);
});

test('an unconsumed malformed archive creation date does not erase the native calibration report', () => {
  const hyperion = readFileSync(new URL('../../../src/objects/hyperion/source/observations/N1506383441_2_CALIB.LBL', import.meta.url), 'utf8');
  // The source really has a space-padded day; do not repair it for this test.
  assert.match(hyperion, /PRODUCT_CREATION_TIME = 2019-06- 9T17:21:30/);
  assert.equal(pds3LabelHasReflectance(hyperion), true);
});
