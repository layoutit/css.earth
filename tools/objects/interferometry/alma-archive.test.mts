import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { continuumImage, memberProducts, type DatalinkRow } from './alma-archive.mts';

const row = (url: string, bytes: number | null, semantics = '#this', contentType = 'application/x-tar'): DatalinkRow =>
  ({ id: 'uid://A001/X35f5/Xaea', url, semantics, description: '', contentType, bytes, serviceDef: '' });

test('normalized ALMA rows state where the calibration and raw visibilities are', () => {
  const base = 'https://almascience.eso.org/dataPortal/';
  const rows = [
    row(`${base}member.uid___A001_X35f5_Xaea.README.txt`, 3524, '#documentation', 'text/plain'),
    row(`${base}2022.1.01071.S_uid___A001_X35f5_Xaea_001_of_001.tar`, 77_463_712_768),
    row(`${base}2022.1.01071.S_uid___A001_X35f5_Xaea_auxiliary.tar`, 879_136_768, '#auxiliary'),
    ...[63_307_551_744, 47_000_000_000, 51_000_000_000, 54_000_000_000, 59_000_000_000]
      .map((bytes, index) => row(`${base}execution-${index}.asdm.sdm.tar`, bytes, '#progenitor')),
  ];
  const products = memberProducts(rows);
  assert.equal(products.productListing, '2022.1.01071.S_uid___A001_X35f5_Xaea_001_of_001.tar');
  assert.ok(products.auxiliary?.url.endsWith('_auxiliary.tar'));
  assert.equal(products.auxiliary?.bytes, 879_136_768);
  assert.equal(products.readme?.contentType, 'text/plain');
  assert.equal(products.raw.length, 5);
  assert.ok(products.raw.every(entry => entry.url.endsWith('.asdm.sdm.tar')));
  assert.ok(products.raw[0]!.bytes! <= products.raw.at(-1)!.bytes!);
  assert.throws(() => memberProducts([]), /no raw visibilities/u);
});

test('the product rows give one continuum image, preferring the self-calibrated one', () => {
  const image = row('https://almascience.eso.org/dataPortal/member.R_Dor_sci.spw25.cont.I.pbcor.fits', 33_212_160);
  assert.equal(continuumImage([image], 'R_Dor').bytes, 33_212_160);
  assert.throws(() => continuumImage([image], 'Betelgeuse'), /no continuum image/u);
  const both = [image].flatMap(entry => [
    { ...entry, url: entry.url.replace('.cont.I.', '.cont.regcal.I.') },
    { ...entry, url: entry.url.replace('.cont.I.', '.cont.selfcal.I.tt0.') },
  ]);
  assert.ok(continuumImage(both, 'R_Dor').url.includes('.selfcal.'));
  assert.ok(continuumImage([...both].reverse(), 'R_Dor').url.includes('.selfcal.'));
});
