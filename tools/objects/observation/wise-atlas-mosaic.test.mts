import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { gzipSync } from 'node:zlib';
import { card } from '../../../tests/fixtures/fits/helpers.mts';
import { binWiseAtlasTile, matchTileBackgrounds, mosaicTiles, parseTilePins, wiseAtlasUrl } from './wise-atlas-mosaic.mts';

const size = 64, scale = 0.01;
function atlasTile(coaddId: string, ra: number, dec: number, sky: (ra: number, dec: number) => number, offset: number, extra: readonly string[] = []) {
  const cards = [card('SIMPLE', 'T'), card('BITPIX', '-32'), card('NAXIS', '2'), card('NAXIS1', String(size)), card('NAXIS2', String(size)),
    card('BUNIT', "'DN      '"), card('CRVAL1', String(ra)), card('CRVAL2', String(dec)), card('EQUINOX', '2000.0'),
    card('CTYPE1', "'RA---SIN'"), card('CTYPE2', "'DEC--SIN'"), card('CRPIX1', String(size / 2)), card('CRPIX2', String(size / 2)),
    card('CDELT1', String(-scale)), card('CDELT2', String(scale)), card('CROTA2', '0.000000'), card('COADDID', `'${coaddId}'`), card('MAGZP', '13.'), ...extra, 'END'.padEnd(80)];
  const header = Buffer.from(cards.join('').padEnd(Math.ceil(cards.length * 80 / 2880) * 2880));
  const data = Buffer.alloc(Math.ceil(size * size * 4 / 2880) * 2880);
  for (let q = 0; q < size; q++) for (let p = 0; p < size; p++) {
    // Small-field SIN approximation is enough to give each pixel a sky position for the synthetic signal.
    const skyRa = ra + (size / 2 - (p + 1)) * scale / Math.cos(dec * Math.PI / 180), skyDec = dec + (q + 1 - size / 2) * scale;
    data.writeFloatBE(q === 5 && p === 5 ? NaN : sky(skyRa, skyDec) + offset, (q * size + p) * 4);
  }
  return gzipSync(Buffer.concat([header, data]));
}
const pins = parseTilePins({ schema: 'cssearth-wise-atlas-tiles@1', band: 'W4', tiles: [{ coaddId: '0544p242_ac51', sha256: 'a'.repeat(64), bytes: 4000 }] });
const grid = { width: 120, height: 80, fovDeg: 1.1, centerIcrsDegrees: [56.5, 24.2] as [number, number] };

test('tile pixels bin into the hips2fits grid and overlap medians recover per-tile levels up to one constant', () => {
  const sky = (ra: number, dec: number) => 50 + 20 * Math.sin(ra * 3) * Math.cos(dec * 5);
  const levels = [0, 17.5, -8, 30];
  const tiles = [[56.1, 24.0], [56.6, 24.05], [56.3, 24.45], [56.85, 24.4]].map(([ra, dec], t) =>
    binWiseAtlasTile(atlasTile(`054${t}p242_ac51`, ra!, dec!, sky, levels[t]!), pins, `054${t}p242_ac51`, grid)!);
  assert.ok(tiles.every(Boolean));
  const matched = matchTileBackgrounds(tiles, 20);
  assert.ok(matched.pairs >= 4, `${matched.pairs} overlapping pairs`);
  const mean = levels.reduce((a, b) => a + b) / levels.length;
  matched.offsets.forEach((offset, t) => assert.ok(Math.abs(offset - (levels[t]! - mean)) < 0.5, `tile ${t}: ${offset} vs ${levels[t]! - mean}`));
  assert.ok(matched.medianPairStepBefore > 5 && matched.medianPairStepAfter < 0.5);
  const mosaic = mosaicTiles(tiles, matched.offsets, grid);
  const covered = [...mosaic].filter(Number.isFinite);
  assert.ok(covered.length > grid.width * grid.height / 3);
  // Levels are recovered up to the zero-mean gauge: every covered pixel sits within the signal range plus that mean.
  assert.ok(covered.every(value => value > 30 + mean - 1 && value < 70 + mean + 1));
});

test('atlas identity, zero point, projection and pins are checked', () => {
  const sky = () => 1;
  assert.throws(() => binWiseAtlasTile(atlasTile('0544p242_ac51', 56.5, 24.2, sky, 0), pins, '0545p242_ac51', grid), /unexpected WISE atlas header/);
  assert.throws(() => binWiseAtlasTile(atlasTile('0544p242_ac51', 56.5, 24.2, sky, 0, [card('PC1_2', '0.1')]), pins, '0544p242_ac51', grid), /unexpected/);
  const w1 = parseTilePins({ ...pins, band: 'W1' });
  assert.throws(() => binWiseAtlasTile(atlasTile('0544p242_ac51', 56.5, 24.2, sky, 0), w1, '0544p242_ac51', grid), /unexpected/);
  assert.equal(binWiseAtlasTile(atlasTile('0544p242_ac51', 10, -60, sky, 0), pins, '0544p242_ac51', grid), undefined);
  assert.throws(() => parseTilePins({ ...pins, tiles: [...pins.tiles, pins.tiles[0]] }), /unique/);
  assert.throws(() => parseTilePins({ ...pins, band: 'W5' }), /Unsupported/);
  assert.equal(wiseAtlasUrl('0544p242_ac51', 'W4'), 'https://irsa.ipac.caltech.edu/ibe/data/wise/allwise/p3am_cdd/05/0544/0544p242_ac51/0544p242_ac51-w4-int-3.fits.gz');
});

test('tiles in overlap groups that share no chain of overlaps are refused, not solved group by group', () => {
  // MOLTRONX's PR #250 case: two internally overlapping pairs at disjoint positions keep independent levels.
  const flat = (coaddId: string, x0: number, value: number) =>
    ({ coaddId, x0, y0: 0, width: 20, height: 10, sum: new Float64Array(200).fill(value), count: new Uint32Array(200).fill(1) });
  const tiles = [flat('0000p000_ac51', 0, 100), flat('0001p000_ac51', 0, 110), flat('0002p000_ac51', 100, 1000), flat('0003p000_ac51', 100, 1020)];
  assert.throws(() => matchTileBackgrounds(tiles, 20), /disconnected overlap groups: 0002p000_ac51, 0003p000_ac51/);
  const joined = [...tiles, flat('0004p000_ac51', 10, 105), { ...flat('0005p000_ac51', 90, 1010), width: 30, sum: new Float64Array(300).fill(1010), count: new Uint32Array(300).fill(1) }];
  joined[4] = { ...joined[4]!, width: 95, sum: new Float64Array(950).fill(105), count: new Uint32Array(950).fill(1) };
  assert.equal(matchTileBackgrounds(joined, 20).offsets.length, 6);
  // A grid-edge sliver with too little overlap is left out only when joined tiles already cover all its pixels.
  const sliver = { coaddId: '0006p000_ac51', x0: 5, y0: 2, width: 3, height: 3, sum: new Float64Array(9).fill(5000), count: new Uint32Array(9).fill(1) };
  const withSliver = matchTileBackgrounds([...joined, sliver], 20);
  assert.deepEqual(withSliver.excluded.map(tile => [tile.coaddId, tile.pixels]), [['0006p000_ac51', 9]]);
  assert.equal(withSliver.tiles.length, 6);
  assert.equal(withSliver.offsets.length, 6);
  const ownSky = { ...sliver, x0: 400 };
  assert.throws(() => matchTileBackgrounds([...joined, ownSky], 20), /disconnected overlap groups: 0006p000_ac51/);
});
