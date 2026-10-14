import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { loadNpyLonLatField, npyDictionarySource, readNpyObject, type NpyArray } from '@cssearth/bake/objects/raster';

type Stored = { shape: number[]; values: number[]; float32?: true; mask?: number[] };

/** The byte program numpy.save writes for a dictionary of arrays, protocol 2, with the masked arrays (numpy.ma) and float32
 * values a GCM's released fields use, so the reader is tested on what it claims to read without a Python dependency. */
function pickled(arrays: Record<string, Stored>) {
  const parts: Buffer[] = [], op = (...bytes: number[]) => parts.push(Buffer.from(bytes));
  const unicode = (text: string) => { const b = Buffer.from(text, 'utf8'), n = Buffer.alloc(4); n.writeUInt32LE(b.length); parts.push(Buffer.from([0x58]), n, b); };
  const bytes = (data: Buffer) => { const n = Buffer.alloc(4); n.writeUInt32LE(data.length); parts.push(Buffer.from([0x42]), n, data); };
  const global = (name: string) => { op(0x63); parts.push(Buffer.from(`${name}\n`, 'latin1')); };
  const dtype = (name: string, order: string) => { global('numpy\ndtype'); unicode(name); op(0x89, 0x88, 0x87, 0x52); op(0x28, 0x4b, 3); unicode(order); op(0x4e, 0x4e, 0x4e); op(0x4a, 0xff, 0xff, 0xff, 0xff, 0x4a, 0xff, 0xff, 0xff, 0xff, 0x4b, 0, 0x74, 0x62); };
  const shape = (dims: number[]) => { op(0x28); for (const n of dims) op(0x4b, n); op(0x74); };
  // np.save wraps the dictionary in a zero-dimensional object array.
  op(0x80, 2);
  global('numpy.core.multiarray\n_reconstruct'); global('numpy\nndarray'); op(0x4b, 0, 0x85, 0x43, 1, 0x62, 0x87, 0x52);
  op(0x28, 0x4b, 1); shape([]); dtype('O8', '|'); op(0x89, 0x5d, 0x7d, 0x28);
  for (const [key, array] of Object.entries(arrays)) {
    unicode(key);
    // _mareconstruct(MaskedArray, ndarray, (0,), 'b') or _reconstruct(ndarray, (0,), b'b'), then the state BUILD gives it.
    if (array.mask) { global('numpy.ma.core\n_mareconstruct'); op(0x28); global('numpy.ma.core\nMaskedArray'); global('numpy\nndarray'); op(0x4b, 0, 0x85); unicode('b'); op(0x74); }
    else { global('numpy.core.multiarray\n_reconstruct'); global('numpy\nndarray'); op(0x4b, 0, 0x85, 0x43, 1, 0x62, 0x87); }
    op(0x52, 0x28, 0x4b, 1); shape(array.shape); dtype(array.float32 ? 'f4' : 'f8', '<'); op(0x89);
    const width = array.float32 ? 4 : 8, raw = Buffer.alloc(array.values.length * width);
    array.values.forEach((v, i) => array.float32 ? raw.writeFloatLE(v, i * 4) : raw.writeDoubleLE(v, i * 8));
    bytes(raw);
    if (array.mask) { bytes(Buffer.from(array.mask)); op(0x4e); }
    op(0x74, 0x62);
  }
  op(0x75, 0x61, 0x74, 0x62, 0x2e);
  const header = "{'descr': '|O', 'fortran_order': False, 'shape': (), }", padded = header.padEnd(117, ' ') + '\n';
  const prefix = Buffer.from([0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59, 1, 0, padded.length & 255, padded.length >> 8]);
  return Buffer.concat([prefix, Buffer.from(padded, 'latin1'), ...parts]);
}

// Two levels on a grid of three latitudes and four longitudes, the value 100 level + 10 row + column; one cell masked.
const levels = 2, rows = 3, columns = 4, cell = (level: number, row: number, column: number) => 100 * level + 10 * row + column;
const field = (mask = true): Record<string, Stored> => ({
  t: { shape: [levels, rows, columns], float32: true, values: Array.from({ length: levels * rows * columns }, (_, i) => cell(Math.floor(i / 12), Math.floor(i / 4) % 3, i % 4)),
    ...(mask ? { mask: Array.from({ length: levels * rows * columns }, (_, i) => i === 12 + 4 + 2 ? 1 : 0) } : {}) },
  lat: { shape: [rows], values: [-60, 0, 60], mask: [0, 0, 0] }, lon: { shape: [columns], values: [0, 90, 180, 270], mask: [0, 0, 0, 0] },
  pfull: { shape: [levels], values: [10, 5000], mask: [0, 0] },
});
const recipe = { format: 'npy-lonlat-field', path: 'field.npy', variable: 't', coordinates: { longitude: 'lon', latitude: 'lat' }, select: { pfull: 1 }, sourceUnits: 'K', longitudeZeroAt: 0, coordinateToleranceDegrees: 0.005 };

test('a masked float32 array in a pickled dictionary is read exactly, its masked cell without a value', () => {
  const value = readNpyObject(pickled(field())) as Record<string, NpyArray>, t = value.t!;
  assert.deepEqual([t.dtype, t.shape], ['float64', [2, 3, 4]]);
  assert.equal((t.data as Float64Array)[5], cell(0, 1, 1)); assert.ok(Number.isNaN((t.data as Float64Array)[18]));
  assert.deepEqual([...(value.lat!.data as Float64Array)], [-60, 0, 60]);
});

test('a field is read on the level the recipe selects, at every node, and a masked node has no value', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-npy-field-'));
  try {
    await writeFile(join(directory, 'field.npy'), pickled(field()));
    const read = await loadNpyLonLatField(directory, recipe);
    assert.equal(read.sample(0, 0), cell(1, 1, 0)); assert.equal(read.sample(-90, 60), cell(1, 2, 3)); assert.equal(read.sample(0, -60), cell(1, 0, 0));
    // A sample that would use the masked node has none.
    assert.equal(read.sample(180, 0), null); assert.equal(read.sample(135, 30), null);
    assert.equal(read.report.format, 'npy-lonlat-field'); assert.deepEqual(read.report.select, { pfull: 1 }); assert.equal(read.report.missing, 1);
    // The zero meridian falls where the recipe says the star is overhead.
    assert.equal((await loadNpyLonLatField(directory, { ...recipe, longitudeZeroAt: 180 })).sample(90, -60), cell(1, 0, 3));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('an axis no array, or two, could name is refused, and so is a level left unselected', () => {
  const ambiguous = { ...field(false), band: { shape: [3], values: [1, 2, 3] } };
  assert.throws(() => npyDictionarySource(readNpyObject(pickled(ambiguous)), { ...recipe, select: { pfull: 1, band: 0 } }, 'field.npy'), /axis 1 of t has 3 entries, and lat and band both have that length/u);
  assert.throws(() => npyDictionarySource(readNpyObject(pickled(field())), { ...recipe, select: {} }, 'field.npy'), /axis 0 of t has 2 entries, and none of lon, lat has that length/u);
  assert.throws(() => npyDictionarySource(readNpyObject(pickled(field())), { ...recipe, variable: 'ts' }, 'field.npy'), /has no numeric array ts/u);
});
