import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { readFitsHdus } from '../../fits/fits.mts';
import { readOracleFixture, readOracleInput } from '../../oracles/fixture.mts';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../sources/source-values.mts';
import { atlasToGridPixel, gridWcs } from './wise-atlas-mosaic.mts';

const fixture = await readOracleFixture('fits/wise-atlas-projection.json');
for (const [name, raw] of Object.entries(fixture.cases)) test(`Astropy SIN tile -> TAN grid pixels: ${name}`, async () => {
  const entry = requireRecord(raw), path = requireString(entry.path), input = fixture.inputs.find(item => item.path === path);
  assert.ok(input);
  // Read the WCS cards the oracle wrote, not the case copies.
  const [tile, grid] = readFitsHdus(await readOracleInput(input)).map(hdu => hdu.header);
  const n = (value: unknown) => requireFiniteNumber(value);
  const wcs = gridWcs({ width: 2 * n(grid!.CRPIX1), height: 2 * n(grid!.CRPIX2), fovDeg: requireFiniteNumber(requireArray(entry.grid)[4]),
    centerIcrsDegrees: [n(grid!.CRVAL1), n(grid!.CRVAL2)] });
  assert.ok(Math.abs(wcs.scaleDeg[1] - n(grid!.CDELT2)) < 1e-15 && wcs.referencePixel[0] === n(grid!.CRPIX1));
  const map = atlasToGridPixel({ crpix: [n(tile!.CRPIX1), n(tile!.CRPIX2)], cdelt: [n(tile!.CDELT1), n(tile!.CDELT2)], crval: [n(tile!.CRVAL1), n(tile!.CRVAL2)] }, wcs);
  const tilePixels = requireArray(entry.tilePixels), gridPixels = requireArray(entry.gridPixels);
  tilePixels.forEach((raw, i) => {
    const [p, q] = requireArray(raw).map(n), expected = requireArray(gridPixels[i]).map(n), actual = map(p!, q!);
    assert.ok(actual, `${name} ${i} maps in front of the grid`);
    assert.ok(Math.hypot(actual[0] - expected[0]!, actual[1] - expected[1]!) < 1e-6, `${name} ${i}: ${actual} vs ${expected}`);
  });
});
