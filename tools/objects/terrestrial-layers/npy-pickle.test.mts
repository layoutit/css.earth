import assert from 'node:assert/strict';
import test from 'node:test';
import { readNpyHeader, readNpyObject, type NpyArray, type NpyValue } from './npy-pickle.mts';
import { decodeNpyDictionaryMap, theresaVisibleLongitudes } from './npy-dictionary-map.mts';
import { readTarMember } from './tar-member.mts';

/** The byte program numpy.save writes for a dictionary of float64 arrays, protocol 3, so the reader is tested on what it claims
 * to read without a Python dependency. */
function pickledDictionary(arrays: Record<string, { shape: number[]; values: number[] }>, reconstruct = 'numpy.core.multiarray\n_reconstruct\n') {
  const parts: Buffer[] = [], op = (...bytes: number[]) => parts.push(Buffer.from(bytes));
  const unicode = (text: string) => { const b = Buffer.from(text, 'utf8'), n = Buffer.alloc(4); n.writeUInt32LE(b.length); parts.push(Buffer.from([0x58]), n, b); };
  const dtype = (name: string, order: string) => { op(0x63); parts.push(Buffer.from('numpy\ndtype\n', 'latin1')); unicode(name); op(0x89, 0x88, 0x87, 0x52); op(0x28, 0x4b, 3); unicode(order); op(0x4e, 0x4e, 0x4e); op(0x4a, 0xff, 0xff, 0xff, 0xff, 0x4a, 0xff, 0xff, 0xff, 0xff, 0x4b, 0, 0x74, 0x62); };
  const array = (shape: number[]) => { op(0x63); parts.push(Buffer.from(reconstruct, 'latin1')); op(0x63); parts.push(Buffer.from('numpy\nndarray\n', 'latin1')); op(0x4b, 0, 0x85, 0x43, 1, 0x62, 0x87, 0x52); op(0x28, 0x4b, 1, 0x28); for (const n of shape) op(0x4b, n); op(0x74); };
  op(0x80, 3);
  array([]); dtype('O8', '|'); op(0x89, 0x5d, 0x7d, 0x28);
  for (const [key, { shape, values }] of Object.entries(arrays)) {
    unicode(key); array(shape); dtype('f8', '<'); op(0x89);
    const raw = Buffer.alloc(values.length * 8); values.forEach((v, i) => raw.writeDoubleLE(v, i * 8));
    const n = Buffer.alloc(4); n.writeUInt32LE(raw.length); parts.push(Buffer.from([0x42]), n, raw); op(0x74, 0x62);
  }
  op(0x75, 0x61, 0x74, 0x62, 0x2e);
  const header = "{'descr': '|O', 'fortran_order': False, 'shape': (), }", padded = header.padEnd(117, ' ') + '\n';
  const prefix = Buffer.from([0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59, 1, 0, padded.length & 255, padded.length >> 8]);
  return Buffer.concat([prefix, Buffer.from(padded, 'latin1'), ...parts]);
}

function tar(entries: Record<string, Buffer>) {
  const blocks: Buffer[] = [];
  for (const [name, data] of Object.entries(entries)) {
    const header = Buffer.alloc(512);
    header.write(name, 0, 'utf8'); header.write('0000644\0', 100); header.write(data.length.toString(8).padStart(11, '0') + '\0', 124); header.write('0', 156); header.write('ustar\0', 257);
    header.fill(32, 148, 156);
    let sum = 0; for (const byte of header) sum += byte;
    header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
    blocks.push(header, data, Buffer.alloc((512 - data.length % 512) % 512));
  }
  return Buffer.concat([...blocks, Buffer.alloc(1024)]);
}

const grid = (width: number, height: number, value: (lon: number, lat: number) => number) => {
  const lat: number[] = [], lon: number[] = [], map: number[] = [];
  for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
    const la = -90 + (row + 0.5) * 180 / height, lo = -180 + (column + 0.5) * 360 / width;
    lat.push(la); lon.push(lo); map.push(value(lo, la));
  }
  return { tmap: { shape: [height, width], values: map }, lat: { shape: [height, width], values: lat }, lon: { shape: [height, width], values: lon } };
};

test('reads a pickled dictionary of float64 arrays without running anything it names', () => {
  const bytes = pickledDictionary({ a: { shape: [2, 3], values: [1, 2, 3, 4, 5, 6.5] } });
  assert.deepEqual(readNpyHeader(bytes).shape, []);
  const value = readNpyObject(bytes);
  const entry = value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Uint8Array) ? Object.entries(value).find(([key]) => key === 'a')?.[1] : undefined;
  const isArray = (item: NpyValue | undefined): item is NpyArray => typeof item === 'object' && item !== null && 'kind' in item && item.kind === 'ndarray';
  assert.ok(isArray(entry));
  assert.deepEqual(entry.shape, [2, 3]);
  assert.deepEqual([...entry.data], [1, 2, 3, 4, 5, 6.5]);
  // The same program naming any other callable is refused before anything is built.
  const hostile = pickledDictionary({ a: { shape: [1], values: [1] } }, 'os\nsystem\n');
  assert.throws(() => readNpyObject(hostile), /global not allowed: os.system/u);
  assert.throws(() => readNpyObject(Buffer.concat([bytes.subarray(0, readNpyHeader(bytes).dataOffset), Buffer.from([0x80, 3, 0x69])])), /opcode 0x69 is not supported/u);
  assert.throws(() => readNpyObject(Buffer.from('not numpy')), /Not a NumPy/u);
});

test('samples a regular pixel-centre map read from a tar member, and refuses an irregular grid', () => {
  const arrays = grid(8, 4, (lon, lat) => 1000 + lon + 10 * lat);
  const archive = tar({ 'deposit/README': Buffer.from('readme'), 'deposit/maps.npy': pickledDictionary({ tmap: arrays.tmap, lat: arrays.lat, lon: arrays.lon }) });
  assert.equal(readTarMember(archive, 'deposit/README').toString(), 'readme');
  assert.throws(() => readTarMember(archive, 'deposit/missing'), /no member/u);
  const recipe = { path: 'x', sampling: 'bilinear', units: 'K', values: ['tmap'], latitudes: ['lat'], longitudes: ['lon'] };
  const map = decodeNpyDictionaryMap(readTarMember(archive, 'deposit/maps.npy'), recipe);
  assert.equal(map.width, 8); assert.equal(map.height, 4);
  // A pixel centre returns its own value; between centres the value is interpolated; longitude wraps.
  assert.equal(map.sample(-157.5, -67.5), 1000 - 157.5 - 675);
  assert.ok(Math.abs(map.sample(0, 0)! - 1000) < 1e-9);
  assert.equal(map.sample(202.5, -67.5), map.sample(-157.5, -67.5));
  assert.equal(decodeNpyDictionaryMap(readTarMember(archive, 'deposit/maps.npy'), { ...recipe, sampling: 'nearest' }).sample(-150, -60), 1000 - 157.5 - 675);
  const shuffled = { ...arrays, lon: { ...arrays.lon, values: [...arrays.lon.values].reverse() } };
  assert.throws(() => decodeNpyDictionaryMap(pickledDictionary(shuffled), recipe), /not a regular south-to-north, west-to-east/u);
});

test('a map saved without its grid arrays states the pixel-centre grid, and shows only the longitudes its observations saw', () => {
  const arrays = grid(8, 4, (lon, lat) => 1000 + lon + 10 * lat);
  const bytes = pickledDictionary({ tmap: arrays.tmap });
  const recipe = { path: 'x', sampling: 'bilinear', units: 'K', values: ['tmap'], gridLayout: 'pixel-centres' };
  assert.equal(decodeNpyDictionaryMap(bytes, recipe).sample(-157.5, -67.5), 1000 - 157.5 - 675);
  assert.throws(() => decodeNpyDictionaryMap(bytes, { ...recipe, gridLayout: undefined }), /states gridLayout pixel-centres/u);
  assert.throws(() => decodeNpyDictionaryMap(bytes, { ...recipe, latitudes: ['lat'] }), /names both/u);
  // Around an eclipse (phase 0.45 to 0.55) the sub-observer longitude runs from +18 to -18 degrees; each limb adds 90.
  const range = theresaVisibleLongitudes([0.45, 0.5, 0.55], 0, 1);
  assert.ok(Math.abs(range[0] + 108) < 1e-9 && Math.abs(range[1] - 108) < 1e-9);
  // ThERESA wraps each limb before taking the extremes, so a limb past 180 degrees reads as the far west.
  assert.deepEqual(theresaVisibleLongitudes([0.2], 0, 1).map(v => Math.round(v * 1e9) / 1e9), [18, -162]);
  assert.throws(() => theresaVisibleLongitudes([0.2], 0, 1, .1), /explicit rotation law/);
  const visible = decodeNpyDictionaryMap(bytes, { ...recipe, visibleLongitudes: { times: ['t'], planet: 'p' } }, range);
  // Cells of 45 degrees: the one centred at -112.5 reaches -90 and is kept; the one centred at -157.5 ends at -135 and is not.
  assert.equal(visible.sample(-157.5, 0), null);
  assert.equal(visible.sample(-112.5, -67.5), 1000 - 112.5 - 675);
  // A kept cell is drawn whole: beside a hidden column its own value fills the missing corners.
  assert.equal(visible.sample(-130, -67.5), 1000 - 112.5 - 675);
  assert.throws(() => decodeNpyDictionaryMap(bytes, { ...recipe, visibleLongitudes: { times: ['t'], planet: 'p' } }), /computed from the recipe/u);
  assert.equal(visible.report.shownColumns, 6);
});
