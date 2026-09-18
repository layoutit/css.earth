import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { continuumImage, memberProducts, parseDatalink } from './alma-archive.mts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = (name: string) => readFile(resolve(root, 'tests/fixtures/alma', name), 'utf8');

test('a member listing states where the calibration and the raw visibilities are', async () => {
  const rows = parseDatalink(await read('member-datalink.xml'));
  const products = memberProducts(rows);
  assert.equal(products.productListing, '2022.1.01071.S_uid___A001_X35f5_Xaea_001_of_001.tar');
  assert.ok(products.auxiliary?.url.endsWith('_auxiliary.tar'));
  assert.equal(products.auxiliary?.bytes, 879136768);
  assert.equal(products.readme?.contentType, 'text/plain');
  // Five raw tarballs for this member, smallest first, none of them the product tarball.
  assert.equal(products.raw.length, 5);
  assert.ok(products.raw.every(row => !row.url.endsWith('_001_of_001.tar')));
  assert.ok(products.raw.every(row => row.url.endsWith('.asdm.sdm.tar')));
  assert.ok(products.raw[0]!.bytes! <= products.raw.at(-1)!.bytes!);
});

test('the product listing gives one continuum image, preferring the self-calibrated one', async () => {
  const rows = parseDatalink(await read('product-datalink.xml'));
  const image = continuumImage(rows, 'R_Dor');
  assert.ok(image.url.endsWith('.cont.I.pbcor.fits'));
  assert.equal(image.bytes, 33212160);
  assert.throws(() => continuumImage(rows, 'Betelgeuse'), /no continuum image/u);
  // A listing that offers both calibrations yields the self-calibrated one, whichever order they arrive in.
  const both = [image].flatMap(row => [
    { ...row, url: row.url.replace('.cont.I.', '.cont.regcal.I.') },
    { ...row, url: row.url.replace('.cont.I.', '.cont.selfcal.I.tt0.') },
  ]);
  assert.ok(continuumImage(both, 'R_Dor').url.includes('.selfcal.'));
  assert.ok(continuumImage([...both].reverse(), 'R_Dor').url.includes('.selfcal.'));
});

test('a response without the fields this route reads is refused, and cell counts must match', async () => {
  assert.throws(() => parseDatalink('<VOTABLE><FIELD name="ID"/><TR><TD>x</TD></TR></VOTABLE>'), /declares access_url and semantics/u);
  const short = '<VOTABLE><FIELD name="ID"/><FIELD name="access_url"/><FIELD name="semantics"/><TR><TD>a</TD><TD>b</TD></TR></VOTABLE>';
  assert.throws(() => parseDatalink(short), /cells for 3 fields/u);
  assert.throws(() => memberProducts([]), /no raw visibilities/u);
});
