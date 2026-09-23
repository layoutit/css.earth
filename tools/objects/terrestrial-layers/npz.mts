/** NumPy .npz archives: a ZIP of .npy members, as numpy.savez writes them (stored) or numpy.savez_compressed (deflated). The
 * central directory is read, every member is inflated when needed, and each array is decoded by `readNpy`. ZIP64, encryption
 * and other compression methods are refused rather than guessed. */
import { inflateRawSync } from 'node:zlib';
import { readNpy, type NpyArray } from './npy-lonlat-grid.mts';
import { readNpyHeader } from './npy-pickle.mts';

const END = 0x06054b50, CENTRAL = 0x02014b50, LOCAL = 0x04034b50;

/** Every member of an .npz archive, by array name (the member name without `.npy`). */
export function readNpz(bytes: Buffer): Map<string, NpyArray> {
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) if (bytes.readUInt32LE(i) === END) { end = i; break; }
  if (end < 0) throw new TypeError('The .npz archive has no ZIP end record.');
  const count = bytes.readUInt16LE(end + 10), directory = bytes.readUInt32LE(end + 16);
  if (count === 0xffff || directory === 0xffffffff) throw new TypeError('ZIP64 .npz archives are not read.');
  const arrays = new Map<string, NpyArray>();
  let at = directory;
  for (let n = 0; n < count; n++) {
    if (bytes.readUInt32LE(at) !== CENTRAL) throw new TypeError('The .npz central directory is damaged.');
    const flags = bytes.readUInt16LE(at + 8), method = bytes.readUInt16LE(at + 10), compressed = bytes.readUInt32LE(at + 20), size = bytes.readUInt32LE(at + 24);
    const nameLength = bytes.readUInt16LE(at + 28), extraLength = bytes.readUInt16LE(at + 30), commentLength = bytes.readUInt16LE(at + 32), local = bytes.readUInt32LE(at + 42);
    const name = bytes.subarray(at + 46, at + 46 + nameLength).toString('utf8');
    at += 46 + nameLength + extraLength + commentLength;
    if (flags & 1) throw new TypeError(`${name}: encrypted .npz members are not read.`);
    if (compressed === 0xffffffff || size === 0xffffffff || local === 0xffffffff) throw new TypeError(`${name}: ZIP64 members are not read.`);
    if (bytes.readUInt32LE(local) !== LOCAL) throw new TypeError(`${name}: the local header is missing.`);
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28), raw = bytes.subarray(start, start + compressed);
    const data = method === 0 ? raw : method === 8 ? inflateRawSync(raw) : null;
    if (!data) throw new TypeError(`${name}: ZIP method ${method} is not read.`);
    if (data.length !== size) throw new TypeError(`${name}: inflated to ${data.length} bytes, not ${size}.`);
    if (!name.endsWith('.npy')) throw new TypeError(`${name}: an .npz member must be an .npy array.`);
    const buffer = Buffer.from(data), header = readNpyHeader(buffer);
    // numpy writes a Python scalar as a zero-dimensional array; it is read as one value.
    if (!header.shape.length) {
      if (header.descr !== '<f8' || buffer.length !== header.dataOffset + 8) throw new TypeError(`${name}: only a float64 scalar is read as a zero-dimensional array.`);
      arrays.set(name.slice(0, -4), { descr: '<f8', shape: [], values: Float64Array.of(buffer.readDoubleLE(header.dataOffset)) });
    } else if (header.fortranOrder) arrays.set(name.slice(0, -4), cOrder(buffer, header, name));
    else arrays.set(name.slice(0, -4), readNpy(buffer));
  }
  return arrays;
}

/** A Fortran-order float64 array (column-major, as numpy saves a transposed array) rearranged into C order. */
function cOrder(buffer: Buffer, header: ReturnType<typeof readNpyHeader>, name: string): NpyArray {
  const shape = header.shape, count = shape.reduce((product, n) => product * n, 1);
  if (header.descr !== '<f8' || buffer.length !== header.dataOffset + count * 8) throw new TypeError(`${name}: only float64 Fortran-order arrays are read.`);
  const values = new Float64Array(count), index = new Array<number>(shape.length).fill(0);
  for (let c = 0; c < count; c++) {
    // index counts in C order; its Fortran offset puts the first axis fastest.
    let fortran = 0, stride = 1;
    for (let axis = 0; axis < shape.length; axis++) { fortran += index[axis]! * stride; stride *= shape[axis]!; }
    values[c] = buffer.readDoubleLE(header.dataOffset + fortran * 8);
    for (let axis = shape.length - 1; axis >= 0; axis--) { if (++index[axis]! < shape[axis]!) break; index[axis] = 0; }
  }
  return { descr: '<f8', shape, values };
}

export function npzArray(arrays: Map<string, NpyArray>, name: string, context: string) {
  const array = arrays.get(name);
  if (!array) throw new TypeError(`${context}: the .npz archive has no ${name}.`);
  return array;
}
