/** The NetCDF-4 reader against two files the reference libraries wrote (fixtures/README.md): every value below is the one
 * the fixture's definition states, so the reader is compared with libnetcdf and libhdf5, not with itself. */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { openHdf5Netcdf } from '@cssearth/bake/objects/raster';

const fixture = (name: string) => resolve(import.meta.dirname, 'fixtures', name);
/** The default fill value libnetcdf gives a float or double variable nobody set one for. */
const DEFAULT_FILL = 9.969209968386869e+36;

test('a file libnetcdf wrote gives its variables, their dimensions and attributes, and every value', async () => {
  const file = await openHdf5Netcdf(fixture('field-nc4.nc'));
  try {
    // `chars` is a dimension no variable was declared for: the library stores it as a dataset, and it is not a variable.
    assert.deepEqual([...file.variables.keys()].sort(), ['COUNTS', 'P', 'PACKED', 'SQUEEZED', 'T', 'TS', 'UNWRITTEN', 'label', 'lat', 'lev', 'lon', 'time']);
    const air = file.variables.get('T')!;
    assert.deepEqual([air.dimensions, air.shape, air.type], [['time', 'lev', 'lat', 'lon'], [2, 3, 4, 8], 'double']);
    // The library's own bookkeeping beside the attributes is left out; a variable-length string is read from its heap.
    assert.deepEqual(air.attributes, { units: 'K', standard_name: 'air_temperature', note: 'a variable-length string', _FillValue: [DEFAULT_FILL] });
    assert.deepEqual([file.variables.get('TS')!.dimensions, file.variables.get('TS')!.type], [['time', 'lat', 'lon'], 'float']);
    assert.deepEqual(file.variables.get('label')!.dimensions, ['chars']);
    assert.deepEqual([...await file.values('lat')], [-67.5, -22.5, 22.5, 67.5]);
    assert.deepEqual([...await file.values('lon')], [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5]);
    assert.deepEqual([...await file.values('lev')], [1000, 2000, 3000]);
    assert.deepEqual([...await file.values('time')], [10.5, 11.5]);
    const t = await file.values('T'), p = await file.values('P'), ts = await file.values('TS');
    for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) for (let j = 0; j < 8; j++) {
      assert.equal(ts[r * 32 + i * 8 + j], 200 + 100 * r + 10 * i + j, `TS[${r},${i},${j}]`);
      for (let k = 0; k < 3; k++) {
        assert.equal(t[r * 96 + k * 32 + i * 8 + j], 1000 - 100 * k + 10 * i + j + 500 * r, `T[${r},${k},${i},${j}]`);
        assert.equal(p[r * 96 + k * 32 + i * 8 + j], 1000 * 10 ** -k * (1 + j / 8), `P[${r},${k},${i},${j}]`);
      }
    }
    // A run of values is read from its own bytes: T at the second time, third level, last latitude.
    assert.deepEqual([...await file.slice('T', 96 + 64 + 24, 8)], [1330, 1331, 1332, 1333, 1334, 1335, 1336, 1337]);
    // Stored values come back as stored: the scale, offset and fill value are attributes for the caller.
    const packed = file.variables.get('PACKED')!;
    assert.deepEqual([packed.type, packed.attributes.scale_factor, packed.attributes.add_offset, packed.attributes._FillValue], ['short', [0.5], [200], [-32767]]);
    assert.deepEqual([...(await file.values('PACKED')).subarray(8, 12)], [10, 11, -32767, 13]);
    assert.deepEqual([file.variables.get('COUNTS')!.type, [...await file.values('COUNTS')]], ['uint', [0, 1, 2, 3, 3000000000, 4294967294, 6, 7]]);
  } finally { await file.close(); }
});

test('what the reader does not read is refused by name', async () => {
  const file = await openHdf5Netcdf(fixture('field-nc4.nc'));
  try {
    await assert.rejects(file.values('SQUEEZED'), /variable SQUEEZED is stored chunked; only a variable stored whole and unfiltered is read/u);
    await assert.rejects(file.values('UNWRITTEN'), /variable UNWRITTEN was never written/u);
    await assert.rejects(file.values('label'), /variable label is text, not numbers/u);
    await assert.rejects(file.values('TZ'), /has no variable TZ; it has /u);
    await assert.rejects(file.slice('lat', 2, 3), /variable lat has 4 values, and 3 from value 2 were asked for/u);
  } finally { await file.close(); }
  await assert.rejects(openHdf5Netcdf(fixture('field-cdf2.nc')), /field-cdf2\.nc is not an HDF5 file, and so not NetCDF-4/u);
  // A download that stopped early is shorter than the length the file states for itself.
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-netcdf4-'));
  try {
    await writeFile(join(directory, 'short.nc'), (await readFile(fixture('field-nc4.nc'))).subarray(0, 12000));
    await assert.rejects(openHdf5Netcdf(join(directory, 'short.nc')), /short\.nc is cut short: it holds 12000 of the 20950 bytes it states for itself/u);
  } finally { await rm(directory, { recursive: true }); }
});

test('the oldest file layout, with links and attributes kept in heaps, reads the same way', async () => {
  // Superblock version 0, as libnetcdf wrote until 4.6 and as the Met Office model release this reader was written for is.
  assert.equal((await readFile(fixture('field-nc4-superblock0.nc')))[8], 0);
  const file = await openHdf5Netcdf(fixture('field-nc4-superblock0.nc'));
  try {
    // Ten members: more than a group's header holds, so their links are in a heap behind a B-tree.
    assert.deepEqual([...file.variables.keys()].sort(), ['TS', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'lat', 'lon', 'time']);
    const surface = file.variables.get('TS')!;
    // TS carries ten attributes, more than its header holds: its dimension list and the nine below are in a heap too.
    assert.deepEqual([surface.dimensions, surface.shape, surface.type], [['time', 'lat', 'lon'], [2, 4, 8], 'double']);
    assert.deepEqual(surface.attributes, { units: 'K', ...Object.fromEntries(Array.from({ length: 8 }, (_, n) => [`note${n + 1}`, `attribute ${n + 1}`])) });
    assert.deepEqual([...await file.values('lon')], [0, 45, 90, 135, 180, 225, 270, 315]);
    const ts = await file.values('TS');
    for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) for (let j = 0; j < 8; j++) assert.equal(ts[r * 32 + i * 8 + j], 200 + 100 * r + 10 * i + j, `TS[${r},${i},${j}]`);
    for (let n = 1; n <= 6; n++) assert.deepEqual([...await file.values(`V${n}`)], [n, 10 * n, 100 * n]);
  } finally { await file.close(); }
});
