import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { encodeCloudAtlas, packCloudAtlas } from './pack.mts';

test('external gutters isolate the unchanged viewport from unlike neighboring cells', () => {
  const size = 4, gutter = 2;
  const tiles = [[61, 127, 211, 255], [239, 71, 13, 255]].map(color => {
    const tile = new Uint8Array(size * size * 4);
    for (let p = 0; p < size * size; p++) tile.set(color, p * 4);
    return tile;
  });
  const atlas = packCloudAtlas(tiles, size, gutter);
  for (let i = 0; i < tiles.length; i++) {
    const left = atlas.cells[i * 2]!, top = atlas.cells[i * 2 + 1]!;
    assert(left >= gutter && top >= gutter);
    // The whole bounded filter footprint must see this cell's own border color.
    // Opaque unlike borders ensure that deleting gutters/extrusion fails here.
    for (let y = -gutter; y < size + gutter; y++) for (let x = -gutter; x < size + gutter; x++) {
      const offset = ((top + y) * atlas.width + left + x) * 4;
      assert.deepEqual(atlas.rgba.slice(offset, offset + 4), tiles[i]!.slice(0, 4));
    }
  }
  assert.throws(() => packCloudAtlas(tiles, size, 0));
});

test('decoded lossless atlas preserves alpha and activeRGBA, with independent transparent edge colors', async () => {
  const size = 4, red = new Uint8Array(size * size * 4), blue = red.slice();
  red.set([231, 91, 153, 128], (size + 1) * 4);
  blue.set([61, 127, 211, 255], (size * 2 + 2) * 4);
  const originals = [red.slice(), blue.slice()], atlas = packCloudAtlas([red, blue], size, 2);
  assert.deepEqual([red, blue], originals, 'Packing must not mutate its input');
  const encoded = await encodeCloudAtlas(atlas), decoded = await sharp(encoded).ensureAlpha().raw().toBuffer();
  // Removing exact:true changes hiddenRGB on this fixture; test the encoded file.
  assert.deepEqual(new Uint8Array(decoded), atlas.rgba);
  for (const [i, original] of originals.entries()) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const from = (y * size + x) * 4, to = ((atlas.cells[i * 2 + 1]! + y) * atlas.width + atlas.cells[i * 2]! + x) * 4;
    assert.equal(decoded[to + 3], original[from + 3]);
    if (original[from + 3]) assert.deepEqual([...decoded.subarray(to, to + 4)], [...original.subarray(from, from + 4)]);
    else assert.deepEqual([...decoded.subarray(to, to + 3)], i ? [61, 127, 211] : [231, 91, 153]);
  }
});
