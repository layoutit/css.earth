import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFitsHdus, skyProjection } from '@cssearth/fits';
import { readFitsFileHdus, readFitsFileRegion } from '@cssearth/fits/node';
import { readOracleFixture, readOracleInput } from '../fixture.mts';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';

const fixture = await readOracleFixture('fits/sky-projection.json');
const input = fixture.inputs.find(entry => entry.path === 'tests/fixtures/fits/sky-projection.fits');
assert.ok(input);
const bytes = await readOracleInput(input);
// Read the WCS cards the oracle wrote, not copies of them.
const headers = new Map(readFitsHdus(bytes).slice(1).map(hdu => [hdu.header.EXTNAME, hdu.header]));
const pair = (value: unknown) => { const [a, b] = requireArray(value).map(v => requireFiniteNumber(v)); return [a!, b!] as const; };
const angle = (a: number, b: number) => ((b - a + 540) % 360) - 180;

for (const [name, raw] of Object.entries(fixture.cases)) {
  if (name === 'region' || name === 'refused') continue;
  test(`Astropy TAN or SIN projection: ${name}`, () => {
    const entry = requireRecord(raw), header = headers.get(name);
    assert.ok(header, `${name} has an extension`);
    const projection = skyProjection(header);
    assert.ok(Math.abs(projection.scaleArcsec - requireFiniteNumber(entry.scaleArcsec)) < 1e-9 * projection.scaleArcsec, `${name} scale`);
    for (const point of requireArray(entry.skyToPixel).map(value => requireRecord(value))) {
      const [ra, dec] = pair(point.sky), [x, y] = pair(point.pixel), got = projection.pixelOf(ra, dec);
      assert.ok(got, `${name}: ${ra}, ${dec} is on the near side`);
      assert.ok(Math.hypot(got[0] - x, got[1] - y) < 1e-6, `${name} pixel ${got} vs ${x}, ${y}`);
    }
    for (const point of requireArray(entry.pixelToSky).map(value => requireRecord(value))) {
      const [x, y] = pair(point.pixel), [ra, dec] = pair(point.sky), [gotRa, gotDec] = projection.skyOf(x, y);
      assert.ok(Math.abs(angle(ra, gotRa)) * Math.cos(dec * Math.PI / 180) < 1e-9 && Math.abs(gotDec - dec) < 1e-9, `${name} sky ${gotRa}, ${gotDec} vs ${ra}, ${dec}`);
    }
  });
}

test('distortion, slant SIN, other projections and other frames are refused', () => {
  for (const name of requireArray(fixture.cases.refused).map(value => requireString(value))) {
    const header = headers.get(name);
    assert.ok(header, `${name} has an extension`);
    assert.throws(() => skyProjection(header), /distortion|RA---TAN|not ICRS|slant SIN/u, name);
  }
});

test('a region of one extension is read from disk as Astropy reads it', async () => {
  const entry = requireRecord(fixture.cases.region), directory = await mkdtemp(join(tmpdir(), 'fits-region-'));
  try {
    const path = join(directory, 'sky-projection.fits');
    await writeFile(path, bytes);
    const hdus = await readFitsFileHdus(path), sci = hdus.find(hdu => hdu.header.EXTNAME === requireString(entry.extension));
    assert.ok(sci);
    assert.equal(hdus.length, readFitsHdus(bytes).length);
    const region = await readFitsFileRegion(path, sci, { x0: requireFiniteNumber(entry.x0), y0: requireFiniteNumber(entry.y0),
      width: requireFiniteNumber(entry.width), height: requireFiniteNumber(entry.height) });
    const expected = requireArray(entry.values);
    assert.equal(region.values.length, expected.length);
    region.values.forEach((value, i) => expected[i] === null ? assert.ok(Number.isNaN(value), `sample ${i} is NaN`)
      : assert.equal(value, requireFiniteNumber(expected[i])));
    await assert.rejects(readFitsFileRegion(path, sci, { x0: 5, y0: 0, width: 4, height: 1 }), /outside image/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
