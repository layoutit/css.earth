/**
 * NumPy's `.npy` files (format versions 1.0 to 3.0, little-endian, C order): the outer-ejecta port keeps its working
 * arrays in them so each stage's output can be set beside the original scripts' and compared value for value.
 * `writeNpy` writes the bytes `np.save` writes (version 1.0 while the header fits, the header padded with room to
 * grow the first axis and to a multiple of 64 bytes).
 */
import { readFile, writeFile } from 'node:fs/promises';

/** The element types kept: float32, float64, int64, bool (one byte, 0 or 1) and uint8. */
export type NpyArray =
  | { dtype: '<f4'; shape: number[]; data: Float32Array }
  | { dtype: '<f8'; shape: number[]; data: Float64Array }
  | { dtype: '<i8'; shape: number[]; data: BigInt64Array }
  | { dtype: '|b1'; shape: number[]; data: Uint8Array }
  | { dtype: '|u1'; shape: number[]; data: Uint8Array };
export type NpyDtype = NpyArray['dtype'];

const MAGIC = [0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59], ITEM_SIZE: Record<NpyDtype, number> = { '<f4': 4, '<f8': 8, '<i8': 8, '|b1': 1, '|u1': 1 };
const ARRAY_ALIGN = 64, GROWTH_AXIS_MAX_DIGITS = 21;

const elementCount = (shape: readonly number[]) => shape.reduce((product, length) => product * length, 1);
const shapeRepr = (shape: readonly number[]) => shape.length === 1 ? `(${shape[0]},)` : `(${shape.join(', ')})`;

/** An array from the bytes of a `.npy` file. */
export function readNpy(bytes: Uint8Array, name = 'npy'): NpyArray {
  if (bytes.length < 10 || MAGIC.some((value, i) => bytes[i] !== value)) throw new TypeError(`${name} is not a .npy file.`);
  const major = bytes[6]!, view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (major < 1 || major > 3) throw new TypeError(`${name}: .npy format version ${major} is not supported.`);
  const lengthBytes = major === 1 ? 2 : 4, headerLength = major === 1 ? view.getUint16(8, true) : view.getUint32(8, true), start = 8 + lengthBytes;
  if (start + headerLength > bytes.length) throw new TypeError(`${name}: the .npy header is truncated.`);
  const header = new TextDecoder(major === 3 ? 'utf-8' : 'latin1').decode(bytes.subarray(start, start + headerLength));
  const match = /^\{\s*'descr':\s*'([^']*)',\s*'fortran_order':\s*(True|False)\s*,\s*'shape':\s*\(([^)]*)\),?\s*\}\s*$/u.exec(header);
  if (!match) throw new TypeError(`${name}: unexpected .npy header ${JSON.stringify(header)}.`);
  const dtype = match[1]!;
  if (!Object.hasOwn(ITEM_SIZE, dtype)) throw new TypeError(`${name}: element type ${dtype} is not supported.`);
  if (match[2] === 'True') throw new TypeError(`${name}: Fortran-ordered arrays are not supported.`);
  const shape = match[3]!.split(',').map(part => part.trim()).filter(part => part).map(part => {
    if (!/^\d+$/u.test(part)) throw new TypeError(`${name}: bad shape entry ${part}.`);
    return Number(part);
  });
  const count = elementCount(shape), itemSize = ITEM_SIZE[dtype as NpyDtype], offset = start + headerLength;
  if (!Number.isSafeInteger(count) || bytes.length !== offset + count * itemSize) throw new TypeError(`${name}: ${bytes.length - offset} data bytes for shape (${shape.join(', ')}) of ${dtype}.`);
  const body = bytes.slice(offset), data = new DataView(body.buffer);
  switch (dtype as NpyDtype) {
    case '<f4': return { dtype: '<f4', shape, data: Float32Array.from({ length: count }, (_, i) => data.getFloat32(4 * i, true)) };
    case '<f8': return { dtype: '<f8', shape, data: Float64Array.from({ length: count }, (_, i) => data.getFloat64(8 * i, true)) };
    case '<i8': return { dtype: '<i8', shape, data: BigInt64Array.from({ length: count }, (_, i) => data.getBigInt64(8 * i, true)) };
    case '|b1': if (body.some(value => value > 1)) throw new TypeError(`${name}: a bool array holds a value other than 0 or 1.`); return { dtype: '|b1', shape, data: body };
    case '|u1': return { dtype: '|u1', shape, data: body };
  }
}

/** The bytes `np.save` writes for an array. */
export function writeNpy(array: NpyArray): Uint8Array {
  const count = elementCount(array.shape);
  if (array.shape.some(length => !Number.isSafeInteger(length) || length < 0) || array.data.length !== count) throw new RangeError(`An array of ${array.data.length} values does not have shape (${array.shape.join(', ')}).`);
  let header = `{'descr': '${array.dtype}', 'fortran_order': False, 'shape': ${shapeRepr(array.shape)}, }`;
  if (array.shape.length) header += ' '.repeat(GROWTH_AXIS_MAX_DIGITS - String(array.shape[0]).length);
  let lengthBytes = 2, pad = ARRAY_ALIGN - ((8 + lengthBytes + header.length + 1) % ARRAY_ALIGN);
  if (header.length + 1 + pad > 0xffff) { lengthBytes = 4; pad = ARRAY_ALIGN - ((8 + lengthBytes + header.length + 1) % ARRAY_ALIGN); }
  header += `${' '.repeat(pad)}\n`;
  const itemSize = ITEM_SIZE[array.dtype], start = 8 + lengthBytes + header.length, out = new Uint8Array(start + count * itemSize), view = new DataView(out.buffer);
  out.set(MAGIC); out[6] = lengthBytes === 2 ? 1 : 2; out[7] = 0;
  if (lengthBytes === 2) view.setUint16(8, header.length, true); else view.setUint32(8, header.length, true);
  for (let i = 0; i < header.length; i++) out[8 + lengthBytes + i] = header.charCodeAt(i);
  switch (array.dtype) {
    case '<f4': array.data.forEach((value, i) => view.setFloat32(start + 4 * i, value, true)); break;
    case '<f8': array.data.forEach((value, i) => view.setFloat64(start + 8 * i, value, true)); break;
    case '<i8': array.data.forEach((value, i) => view.setBigInt64(start + 8 * i, value, true)); break;
    case '|b1': if (array.data.some(value => value > 1)) throw new RangeError('A bool array holds a value other than 0 or 1.'); out.set(array.data, start); break;
    case '|u1': out.set(array.data, start); break;
  }
  return out;
}

/** `np.load(path)` for a `.npy` file. */
export async function readNpyFile(path: string): Promise<NpyArray> { return readNpy(new Uint8Array(await readFile(path)), path); }
/** `np.save(path, array)`. */
export async function writeNpyFile(path: string, array: NpyArray): Promise<void> { await writeFile(path, writeNpy(array)); }
