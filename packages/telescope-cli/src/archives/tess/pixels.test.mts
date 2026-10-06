import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deflateRawSync } from 'node:zlib';
import { cadenceMinutes, cutoutUrl, onlyZipMember, parseSectors } from './pixels.mts';

test('the sector list is read as the sectors that imaged the place, oldest first', () => {
  const sectors = parseSectors({ results: [{ sectorName: 'tess-s0041-1-3', sector: '0041', camera: '1', ccd: '3' }, { sectorName: 'tess-s0014-1-4', sector: '0014', camera: '1', ccd: '4' }] });
  assert.deepEqual(sectors, [{ sector: 14, camera: 1, ccd: 4 }, { sector: 41, camera: 1, ccd: 3 }]);
  assert.deepEqual(parseSectors({ results: [] }), []);
  assert.throws(() => parseSectors({ message: 'no' }), /sector list/u);
  assert.throws(() => parseSectors({ results: [{ sector: 'x', camera: '1', ccd: '1' }] }), /listed sector x/u);
});

test('a sector\'s cadence and the request for its pixels', () => {
  assert.deepEqual([cadenceMinutes(14), cadenceMinutes(41), Number(cadenceMinutes(81).toFixed(2))], [30, 10, 3.33]);
  assert.equal(cutoutUrl(300.1821, 22.7109, 41), 'https://mast.stsci.edu/tesscut/api/v0.1/astrocut?ra=300.1821&dec=22.7109&y=11&x=11&sector=41');
});

/** A zip with one member, as a writer makes it: a local header, the data, a central directory entry. */
function zip(name: string, content: Buffer, deflated: boolean, sizesAfter = false) {
  const data = deflated ? deflateRawSync(content) : content, local = Buffer.alloc(30), central = Buffer.alloc(46);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(sizesAfter ? 8 : 0, 6); local.writeUInt16LE(deflated ? 8 : 0, 8); local.writeUInt32LE(sizesAfter ? 0 : data.length, 18); local.writeUInt16LE(name.length, 26);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt32LE(data.length, 20); central.writeUInt16LE(name.length, 28);
  return Buffer.concat([local, Buffer.from(name), data, central, Buffer.from(name)]);
}

test('the one file of the service\'s zip is read stored or deflated, with its size in the header or after the data', () => {
  const content = Buffer.from('SIMPLE  =                    T'.repeat(40));
  for (const [deflated, after] of [[false, false], [true, false], [true, true]] as const) {
    const member = onlyZipMember(zip('tess-s0041-1-3_cut.fits', content, deflated, after));
    assert.equal(member.name, 'tess-s0041-1-3_cut.fits'); assert.ok(member.bytes.equals(content));
  }
  assert.throws(() => onlyZipMember(Buffer.from('<html>busy</html>'.repeat(4))), /zip archive/u);
});
