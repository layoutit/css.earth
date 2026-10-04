/** The classic NetCDF reader against three files the reference library wrote (fixtures/README.md): every value below is
 * the one the fixture's definition states, so the reader is compared with libnetcdf, not with itself. */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { openClassicNetcdf, parseClassicNetcdfHeader } from '@cssearth/bake/objects/raster';

const fixture = (name: string) => resolve(import.meta.dirname, 'fixtures', name);

test('a 64-bit-offset history file gives its dimensions, attributes and every record of every variable', async () => {
  const file = await openClassicNetcdf(fixture('field-cdf2.nc'));
  try {
    assert.equal(file.version, 2);
    assert.equal(file.records, 2);
    assert.deepEqual([...file.dimensions], [['time', 2], ['lev', 2], ['lat', 4], ['lon', 8], ['latd', 4], ['chars', 4]]);
    assert.equal(file.attributes.title, 'cssEarth classic NetCDF reader fixture');
    const surface = file.variables.get('TS')!;
    assert.deepEqual([surface.dimensions, surface.shape, surface.type], [['time', 'lat', 'lon'], [2, 4, 8], 'float']);
    assert.deepEqual([surface.attributes.units, surface.attributes.long_name], ['K', 'Surface temperature']);
    assert.deepEqual([...await file.values('lat')], [-67.5, -22.5, 22.5, 67.5]);
    assert.deepEqual([...await file.values('lon')], [0, 45, 90, 135, 180, 225, 270, 315]);
    // Four record variables are interleaved record by record: each must come back whole and in order.
    assert.deepEqual([...await file.values('time')], [10.5, 11.5]);
    assert.deepEqual([...await file.values('date')], [20240101, 20240102]);
    const ts = await file.values('TS'), t = await file.values('T');
    for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) for (let j = 0; j < 8; j++) {
      assert.equal(ts[r * 32 + i * 8 + j], 200 + 100 * r + 10 * i + j, `TS[${r},${i},${j}]`);
      for (let k = 0; k < 2; k++) assert.equal(t[r * 64 + k * 32 + i * 8 + j], 1000 * k + 100 * r + 10 * i + j + 0.5, `T[${r},${k},${i},${j}]`);
    }
    // Stored values come back as stored: the scale, offset and fill value are attributes for the caller.
    const packed = file.variables.get('PACKED')!;
    assert.deepEqual([packed.type, packed.attributes.scale_factor, packed.attributes.add_offset, packed.attributes._FillValue], ['short', [0.5], [200], [-32767]]);
    assert.deepEqual([...(await file.values('PACKED')).subarray(8, 12)], [10, 11, -32767, 13]);
    await assert.rejects(file.values('label'), /variable label is text, not numbers/u);
    await assert.rejects(file.values('TZ'), /has no variable TZ; it has lat, lon, /u);
  } finally { await file.close(); }
});

test('a lone record variable is read without the padding the classic format leaves out for it', async () => {
  const file = await openClassicNetcdf(fixture('records-cdf1.nc'));
  try {
    assert.deepEqual([file.version, file.records], [1, 3]);
    assert.deepEqual([...await file.values('fixed')], [-1, 2, 3]);
    assert.deepEqual([...await file.values('S')], [1, 2, -3, 101, 102, -103, 201, 202, -203]);
  } finally { await file.close(); }
});

test('a 64-bit-data file gives its unsigned and 64-bit types', async () => {
  const file = await openClassicNetcdf(fixture('types-cdf5.nc'));
  try {
    assert.equal(file.version, 5);
    assert.deepEqual(file.attributes.count, [7]);
    assert.deepEqual([...await file.values('u1')], [0, 200, 255]);
    assert.deepEqual([...await file.values('u2')], [0, 40000, 65535]);
    assert.deepEqual([...await file.values('u4')], [0, 3000000000, 4294967295]);
    assert.deepEqual([...await file.values('i8')], [-9007199254740991, 0, 9007199254740991]);
    assert.deepEqual([...await file.values('u8')], [0, 1, 9007199254740991]);
    assert.deepEqual([...await file.values('f8')], [-1.5, 0, 2.25]);
  } finally { await file.close(); }
});

test('a file that is not classic NetCDF is refused by what it is', async () => {
  const work = await mkdtemp(resolve(tmpdir(), 'netcdf-'));
  try {
    // NetCDF-4 is an HDF5 container: its eight signature bytes, then anything.
    await writeFile(resolve(work, 'four.nc'), Buffer.concat([Buffer.from([0x89, 0x48, 0x44, 0x46, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]));
    await assert.rejects(openClassicNetcdf(resolve(work, 'four.nc')), /four\.nc is a NetCDF-4 file \(an HDF5 container\)\. This reader reads classic NetCDF: CDF-1, CDF-2 and CDF-5/u);
    await writeFile(resolve(work, 'text.nc'), 'longitude,latitude\n');
    await assert.rejects(openClassicNetcdf(resolve(work, 'text.nc')), /text\.nc is not a classic NetCDF file: it starts with 6c6f6e67/u);
    const whole = await readFile(fixture('field-cdf2.nc'));
    await writeFile(resolve(work, 'cut.nc'), whole.subarray(0, 300));
    await assert.rejects(openClassicNetcdf(resolve(work, 'cut.nc')), /cut\.nc ends inside its NetCDF header/u);
    // The header is whole, the values are not.
    const header = parseClassicNetcdfHeader(whole, 'field-cdf2.nc');
    await writeFile(resolve(work, 'short.nc'), whole.subarray(0, header.bytes + 16));
    const short = await openClassicNetcdf(resolve(work, 'short.nc'));
    try { await assert.rejects(short.values('TSD'), /short\.nc ends inside variable TSD/u); } finally { await short.close(); }
  } finally { await rm(work, { recursive: true, force: true }); }
});
