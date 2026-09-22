import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOverlayVariants, variantsForImage } from './overlay-variants.js';

test('image layers reject changed source bindings, cropped grids, unsafe paths and duplicate identities', () => {
  const row = { imageId: 'test', originalTextureSha256: 'a'.repeat(64), sourceSha256: 'b'.repeat(64), receiptPath: 'receipts/test.json',
    layers: [{ id: 'diffuse', label: 'Diffuse trial', texturePath: 'prepared/diffuse.webp', widthPx: 200, heightPx: 100, sha256: 'c'.repeat(64) }] };
  const parse = (input: unknown) => parseOverlayVariants({ schema: 'cssearth-nebula-overlay-variants@1', variants: [input] });
  const rows = parse(row), original = { id: 'test', sha256: 'a'.repeat(64), widthPx: 400, heightPx: 200 };
  assert.equal(variantsForImage(rows, original).length, 1);
  assert.deepEqual(variantsForImage(rows, { ...original, id: 'other' }), []);
  assert.throws(() => variantsForImage(rows, { ...original, widthPx: 300 }), /pixel grid/);
  assert.throws(() => parse({ ...row, layers: [...row.layers, ...row.layers] }), TypeError);
  assert.throws(() => parse({ ...row, layers: [{ ...row.layers[0], texturePath: '../outside.png' }] }), TypeError);
  assert.throws(() => parse({ ...row, layers: [{ ...row.layers[0], id: 'original' }] }), TypeError);
});
