import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import { decodeCalibratedCamera } from './shape-camera-mosaic.mts';
import { card, imageFixture } from '../../../tests/fixtures/fits/helpers.mts';

/** The survey's sky axes, copied from the first pinned Psyche frame: RA---TAN/DEC--TAN with east toward the first column and north toward the last row. */
const SKY = [card('CTYPE1', "'RA---TAN'"), card('CTYPE2', "'DEC--TAN'"), card('CD1_1', '-1.00833333333333E-06'), card('CD1_2', '0.'), card('CD2_1', '0.'), card('CD2_2', '1.00833333333333E-06'), card('CRVAL1', '231.219611'), card('CRVAL2', '-14.24997'), card('CUNIT1', "'deg     '"), card('CUNIT2', "'deg     '")];
/** A deconvolved ZIMPOL frame as the survey ships it: one double-precision image HDU that names its instrument and states its sky axes. */
const zimpol = (values: readonly number[] = [0.5, 1.5, 2.5, 3.5], extra: readonly string[] = [card('INSTRUME', "'SPHERE  '")]) =>
  imageFixture(-64, values, [...extra, ...SKY]);

test('a deconvolved ZIMPOL frame decodes through its own header', () => {
  const image = decodeCalibratedCamera(zimpol(), 'fits-zimpol-intensity');
  assert.equal(image.width, 2);
  assert.equal(image.height, 2);
  assert.equal(image.encoding, 'fits-zimpol-intensity');
  // Deconvolved intensity has a floor at zero rather than a calibrated sky level, so exact zero is a sample.
  assert.equal(image.allowZero, true);
});

test('the decoded rows run top-down, as every other camera on this route does', () => {
  // The file stores row 0 at the bottom. The ray caster indexes rows directly, so a frame left in FITS order
  // renders mirrored in latitude against the 22 bodies whose archives store row 0 at the top. The silhouette,
  // the disc size and the phase angle are all identical either way, so only this assertion catches it.
  const image = decodeCalibratedCamera(zimpol([0.5, 1.5, 2.5, 3.5]), 'fits-zimpol-intensity');
  assert.deepEqual(Array.from(image.data), [2.5, 3.5, 0.5, 1.5]);
  const tall = decodeCalibratedCamera(zimpol([1, 2, 3, 4, 5, 6]), 'fits-zimpol-intensity');
  assert.equal(tall.height, 3);
  assert.deepEqual(Array.from(tall.data), [5, 6, 3, 4, 1, 2]);
});

test('a frame from another instrument is refused rather than read as ZIMPOL', () => {
  // The survey directory is not the only place these filenames occur; the header states what took the exposure.
  assert.throws(() => decodeCalibratedCamera(zimpol([1, 2, 3, 4], [card('INSTRUME', "'NACO    '")]), 'fits-zimpol-intensity'), /states SPHERE/);
  assert.throws(() => decodeCalibratedCamera(zimpol([1, 2, 3, 4], []), 'fits-zimpol-intensity'), /states SPHERE/);
});

test('a layout the survey does not ship is refused rather than silently reinterpreted', () => {
  // Single precision is the Galileo route's layout, not this one; reading it here would halve every sample.
  assert.throws(() => decodeCalibratedCamera(imageFixture(-32, [1, 2, 3, 4], [card('INSTRUME', "'SPHERE  '")]), 'fits-zimpol-intensity'), /Unsupported deconvolved ZIMPOL/);
  assert.throws(() => decodeCalibratedCamera(imageFixture(16, [1, 2, 3, 4], [card('INSTRUME', "'SPHERE  '")]), 'fits-zimpol-intensity'), /Unsupported deconvolved ZIMPOL/);
  // A scaled frame would need its BSCALE applied by the consumer; refuse instead of ignoring it.
  assert.throws(() => decodeCalibratedCamera(zimpol([1, 2, 3, 4], [card('INSTRUME', "'SPHERE  '"), card('BSCALE', '2.0')]), 'fits-zimpol-intensity'), /Unsupported deconvolved ZIMPOL/);
  // Trailing bytes mean a second HDU this route does not read.
  assert.throws(() => decodeCalibratedCamera(Buffer.concat([zimpol(), Buffer.alloc(2880)]), 'fits-zimpol-intensity'), /Unsupported deconvolved ZIMPOL/);
});

test('the ZIMPOL layout is not reachable without naming its encoding', () => {
  // Without the encoding the shared decoder falls into the VICAR parser, which must not accept a FITS file.
  assert.throws(() => decodeCalibratedCamera(zimpol()), /Unsupported VICAR camera layout/);
  assert.throws(() => decodeCalibratedCamera(zimpol(), 'calibrated'), /Unsupported VICAR camera layout/);
});
