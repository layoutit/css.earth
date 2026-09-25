import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readPdfImage } from './pdf-image.mts';

const pixels = Uint8Array.from([255, 0, 0, 0, 255, 0, 0, 0, 255, 10, 20, 30]);
function pdf(dictionary: string, body: Uint8Array, trailer = '') {
  return Buffer.concat([Buffer.from(`%PDF-1.5\n1 0 obj\n<< /Type /Catalog >>\nendobj\n5 0 obj\n${dictionary}\nstream\n`, 'latin1'), Buffer.from(body), Buffer.from(`\nendstream\nendobj\n${trailer}%%EOF\n`, 'latin1')]);
}
const packed = deflateSync(pixels);

test('an image XObject is found by number, inflated and checked against its size', () => {
  const direct = readPdfImage(pdf(`<< /Type /XObject /Subtype /Image /Width 2 /Height 2 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${packed.length} /SMask 9 0 R >>`, packed), 5);
  assert.deepEqual({ ...direct, data: Array.from(direct.data) }, { width: 2, height: 2, channels: 3, data: Array.from(pixels) });
  const indirect = readPdfImage(pdf('<< /Subtype /Image /Width 2 /Height 2 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/FlateDecode] /Length 6 0 R >>', packed, `6 0 obj\n${packed.length}\nendobj\n`), 5);
  assert.deepEqual(Array.from(indirect.data), Array.from(pixels), 'an indirect length is resolved');
  const gray = deflateSync(Uint8Array.from([1, 2, 3, 4]));
  assert.equal(readPdfImage(pdf(`<< /Subtype /Image /Width 2 /Height 2 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${gray.length} >>`, gray), 5).channels, 1);
});

test('anything a published figure does not use is refused by name', () => {
  const base = (extra: string) => pdf(`<< /Subtype /Image /Width 2 /Height 2 /ColorSpace /DeviceRGB /BitsPerComponent 8 ${extra} /Length ${packed.length} >>`, packed);
  assert.throws(() => readPdfImage(base('/Filter /DCTDecode'), 5), /DCTDecode/);
  assert.throws(() => readPdfImage(base('/Filter /FlateDecode /DecodeParms << /Predictor 15 /Columns 2 /Colors 3 >>'), 5), /predictor/);
  assert.throws(() => readPdfImage(pdf(`<< /Subtype /Image /Width 2 /Height 2 /ColorSpace /DeviceCMYK /BitsPerComponent 8 /Filter /FlateDecode /Length ${packed.length} >>`, packed), 5), /DeviceCMYK/);
  assert.throws(() => readPdfImage(pdf(`<< /Subtype /Image /Width 3 /Height 2 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${packed.length} >>`, packed), 5), /not the 18/);
  assert.throws(() => readPdfImage(base('/Filter /FlateDecode'), 4), /no object 4/);
});

// The survey paper is cited, not kept; set CSSEARTH_SURVEY_PAPER to a downloaded copy to run this check.
const SURVEY_PAPER = process.env.CSSEARTH_SURVEY_PAPER ?? '';
test('the SPHERE survey paper yields its Iris figure, given a downloaded copy', { skip: !SURVEY_PAPER || !existsSync(SURVEY_PAPER) }, () => {
  const figure = readPdfImage(readFileSync(SURVEY_PAPER), 1085);
  assert.deepEqual([figure.width, figure.height, figure.channels], [1598, 1233, 3]);
});
