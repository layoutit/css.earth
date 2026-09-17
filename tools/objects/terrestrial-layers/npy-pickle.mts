/** A restricted reader for NumPy `.npy` files that hold a pickled object: `np.save` of a dictionary of arrays, as published data
 * products often are. Pickle is a program for a stack machine; this reader interprets only the opcodes such files use, resolves
 * only the three NumPy globals that rebuild an array (`_reconstruct`, `ndarray`, `dtype`) and decodes array bytes itself. It
 * never imports or calls anything a file names, so an unexpected opcode or global is an error, not code. */

export interface NpyArray { readonly kind: 'ndarray'; readonly shape: readonly number[]; readonly dtype: string; readonly fortranOrder: boolean; readonly data: Float64Array | readonly NpyValue[] }
export type NpyValue = null | boolean | number | string | Uint8Array | NpyArray | readonly NpyValue[] | { readonly [key: string]: NpyValue };

const MAGIC = Buffer.from([0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59]);
const ALLOWED_GLOBALS = new Map([
  ['numpy.core.multiarray\n_reconstruct', 'reconstruct'], ['numpy._core.multiarray\n_reconstruct', 'reconstruct'],
  ['numpy\nndarray', 'ndarray'], ['numpy\ndtype', 'dtype'],
]);

type Global = { readonly global: string };
type Dtype = { kind: 'dtype'; name: string; byteOrder: string | null };
type Pending = { kind: 'pending-array' };
type Mark = { readonly mark: true };
type Item = NpyValue | Global | Dtype | Pending | Mark | Item[] | Map<string, Item>;

/** Parse a `.npy` header (format versions 1 to 3) for any array or pickled object it describes. */
export function readNpyHeader(bytes: Uint8Array) {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (buffer.length < 10 || !buffer.subarray(0, 6).equals(MAGIC)) throw new TypeError('Not a NumPy .npy file.');
  const major = buffer[6]!;
  if (![1, 2, 3].includes(major)) throw new TypeError(`Unsupported .npy format version ${major}.`);
  const start = major === 1 ? 10 : 12, headerLength = major === 1 ? buffer.readUInt16LE(8) : buffer.readUInt32LE(8), dataOffset = start + headerLength;
  if (dataOffset > buffer.length || dataOffset % 16 !== 0) throw new TypeError('Truncated or misaligned .npy header.');
  const header = buffer.subarray(start, dataOffset).toString(major === 3 ? 'utf8' : 'latin1');
  const descr = /'descr':\s*'([^']*)'/u.exec(header)?.[1], fortran = /'fortran_order':\s*(True|False)/u.exec(header)?.[1], shape = /'shape':\s*\(([^)]*)\)/u.exec(header)?.[1];
  if (descr === undefined || fortran === undefined || shape === undefined) throw new TypeError(`Malformed .npy header: ${header.trim()}.`);
  return { version: major, header, descr, fortranOrder: fortran === 'True', shape: shape.split(',').map(value => value.trim()).filter(Boolean).map(Number), dataOffset };
}

/** Read a pickled-object `.npy` file into plain values: dictionaries become objects, float64 arrays become Float64Array. */
export function readNpyObject(bytes: Uint8Array): NpyValue {
  const header = readNpyHeader(bytes);
  if (header.descr !== '|O' || header.shape.length !== 0) throw new TypeError('The .npy file does not hold one pickled object.');
  const value = unpickle(Buffer.from(bytes.buffer, bytes.byteOffset + header.dataOffset, bytes.byteLength - header.dataOffset));
  // np.save of a Python object wraps it in a zero-dimensional object array.
  if (!isArray(value) || value.shape.length !== 0 || !Array.isArray(value.data) || value.data.length !== 1) throw new TypeError('The pickled object is not a zero-dimensional object array.');
  return value.data[0]!;
}

const isArray = (value: unknown): value is NpyArray => typeof value === 'object' && value !== null && (value as { kind?: unknown }).kind === 'ndarray';

function unpickle(buffer: Buffer): NpyValue {
  const stack: Item[] = [], memo = new Map<number, Item>();
  let offset = 0;
  const u8 = () => buffer[offset++]!;
  const take = (length: number) => { if (offset + length > buffer.length) throw new TypeError('Truncated pickle.'); const view = buffer.subarray(offset, offset + length); offset += length; return view; };
  const pop = (): Item => { if (!stack.length) throw new TypeError('Pickle stack underflow.'); return stack.pop()!; };
  const popMark = (): Item[] => {
    for (let i = stack.length - 1; i >= 0; i--) if (isMark(stack[i])) { const items = stack.splice(i + 1); stack.pop(); return items; }
    throw new TypeError('Pickle MARK not found.');
  };
  const line = () => { const end = buffer.indexOf(0x0a, offset); if (end < 0) throw new TypeError('Unterminated pickle line.'); const text = buffer.subarray(offset, end).toString('latin1'); offset = end + 1; return text; };
  while (offset < buffer.length) {
    const op = u8();
    switch (op) {
      case 0x80: if (u8() > 4) throw new TypeError('Unsupported pickle protocol.'); break; // PROTO
      case 0x63: { const name = `${line()}\n${line()}`; if (!ALLOWED_GLOBALS.has(name)) throw new TypeError(`Pickle global not allowed: ${name.replace('\n', '.')}.`); stack.push({ global: ALLOWED_GLOBALS.get(name)! }); break; } // GLOBAL
      case 0x71: memo.set(u8(), stack.at(-1)!); break; // BINPUT
      case 0x72: memo.set(take(4).readUInt32LE(0), stack.at(-1)!); break; // LONG_BINPUT
      case 0x68: stack.push(memoGet(memo, u8())); break; // BINGET
      case 0x6a: stack.push(memoGet(memo, take(4).readUInt32LE(0))); break; // LONG_BINGET
      case 0x4b: stack.push(u8()); break; // BININT1
      case 0x4d: stack.push(take(2).readUInt16LE(0)); break; // BININT2
      case 0x4a: stack.push(take(4).readInt32LE(0)); break; // BININT
      case 0x47: stack.push(take(8).readDoubleBE(0)); break; // BINFLOAT
      case 0x4e: stack.push(null); break; // NONE
      case 0x88: stack.push(true); break; // NEWTRUE
      case 0x89: stack.push(false); break; // NEWFALSE
      case 0x43: stack.push(new Uint8Array(take(u8()))); break; // SHORT_BINBYTES
      case 0x42: stack.push(new Uint8Array(take(take(4).readUInt32LE(0)))); break; // BINBYTES
      case 0x8c: stack.push(take(u8()).toString('utf8')); break; // SHORT_BINUNICODE
      case 0x58: stack.push(take(take(4).readUInt32LE(0)).toString('utf8')); break; // BINUNICODE
      case 0x28: stack.push({ mark: true }); break; // MARK
      case 0x29: stack.push([]); break; // EMPTY_TUPLE
      case 0x85: stack.push([pop()]); break; // TUPLE1
      case 0x86: { const b = pop(), a = pop(); stack.push([a, b]); break; } // TUPLE2
      case 0x87: { const c = pop(), b = pop(), a = pop(); stack.push([a, b, c]); break; } // TUPLE3
      case 0x74: stack.push(popMark()); break; // TUPLE
      case 0x5d: stack.push([]); break; // EMPTY_LIST
      case 0x61: { const value = pop(), list = stack.at(-1); if (!Array.isArray(list)) throw new TypeError('APPEND needs a list.'); list.push(value); break; } // APPEND
      case 0x65: { const values = popMark(), list = stack.at(-1); if (!Array.isArray(list)) throw new TypeError('APPENDS needs a list.'); list.push(...values); break; } // APPENDS
      case 0x7d: stack.push(new Map()); break; // EMPTY_DICT
      case 0x73: { const value = pop(), key = pop(), dict = stack.at(-1); setItem(dict, key, value); break; } // SETITEM
      case 0x75: { const items = popMark(), dict = stack.at(-1); for (let i = 0; i < items.length; i += 2) setItem(dict, items[i]!, items[i + 1]!); break; } // SETITEMS
      case 0x52: { const args = pop(), callable = pop(); stack.push(reduce(callable, args)); break; } // REDUCE
      case 0x62: { const state = pop(), target = stack.at(-1); build(target, state); break; } // BUILD
      case 0x2e: { if (stack.length !== 1) throw new TypeError('Pickle ended with a malformed stack.'); return plain(stack[0]!); } // STOP
      default: throw new TypeError(`Pickle opcode 0x${op.toString(16)} is not supported.`);
    }
  }
  throw new TypeError('Pickle has no STOP.');
}

const isMark = (item: Item | undefined): item is Mark => typeof item === 'object' && item !== null && (item as Mark).mark === true;
function memoGet(memo: Map<number, Item>, key: number) { if (!memo.has(key)) throw new TypeError(`Pickle memo ${key} is empty.`); return memo.get(key)!; }
function setItem(dict: Item | undefined, key: Item, value: Item) {
  if (!(dict instanceof Map) || typeof key !== 'string') throw new TypeError('SETITEM needs a dictionary with string keys.');
  dict.set(key, value);
}

function reduce(callable: Item, args: Item): Item {
  const name = typeof callable === 'object' && callable !== null && 'global' in callable ? callable.global : null;
  if (!Array.isArray(args)) throw new TypeError('REDUCE arguments must be a tuple.');
  if (name === 'reconstruct') {
    // _reconstruct(ndarray, (0,), b'b'): an empty array whose BUILD state supplies shape, dtype and bytes.
    const [subtype, shape, typeCode] = args;
    if (!(typeof subtype === 'object' && subtype !== null && 'global' in subtype && subtype.global === 'ndarray') || !Array.isArray(shape) || !(typeCode instanceof Uint8Array)) {
      throw new TypeError('Unexpected numpy _reconstruct arguments.');
    }
    return { kind: 'pending-array' };
  }
  if (name === 'dtype') {
    const [code, align, copy] = args;
    if (typeof code !== 'string' || align !== false || copy !== true) throw new TypeError('Unexpected numpy dtype arguments.');
    return { kind: 'dtype', name: code, byteOrder: null };
  }
  throw new TypeError('REDUCE of a callable that is not allowed.');
}

function build(target: Item | undefined, state: Item) {
  if (!Array.isArray(state)) throw new TypeError('BUILD state must be a tuple.');
  if (typeof target === 'object' && target !== null && (target as Dtype).kind === 'dtype') {
    // dtype state: (version, byteorder, subarray, names, fields, elsize, alignment, flags)
    const dtype = target as Dtype, [version, byteOrder, subarray, names, fields] = state;
    if (version !== 3 || typeof byteOrder !== 'string' || subarray !== null || names !== null || fields !== null) throw new TypeError('Only plain numpy dtypes are supported.');
    dtype.byteOrder = byteOrder;
    return;
  }
  if (typeof target === 'object' && target !== null && (target as Pending).kind === 'pending-array') {
    // ndarray state: (version, shape, dtype, is_fortran, raw bytes or object list)
    const [version, shape, dtypeItem, fortran, raw] = state;
    const dtype = dtypeItem as Dtype;
    if (version !== 1 || !Array.isArray(shape) || !shape.every(n => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0) ||
        dtype?.kind !== 'dtype' || typeof fortran !== 'boolean') throw new TypeError('Unexpected numpy array state.');
    const dims = shape as number[], count = dims.reduce((product, n) => product * n, 1);
    const array = target as unknown as { kind: string; shape: number[]; dtype: string; fortranOrder: boolean; data: Float64Array | NpyValue[] };
    array.kind = 'ndarray'; array.shape = dims; array.fortranOrder = fortran;
    if (dtype.name === 'O8') {
      if (!Array.isArray(raw) || raw.length !== count) throw new TypeError('Object array contents do not match its shape.');
      array.dtype = 'object'; array.data = raw.map(plain);
      return;
    }
    if (dtype.name !== 'f8' || !['<', '='].includes(dtype.byteOrder ?? '') || !(raw instanceof Uint8Array) || raw.byteLength !== count * 8) {
      throw new TypeError(`Only little-endian float64 arrays are supported (got ${dtype.name}, ${dtype.byteOrder}).`);
    }
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength), data = new Float64Array(count);
    for (let i = 0; i < count; i++) data[i] = view.getFloat64(i * 8, true);
    array.dtype = 'float64'; array.data = data;
    return;
  }
  throw new TypeError('BUILD target is not a numpy array or dtype.');
}

function plain(item: Item): NpyValue {
  if (item instanceof Map) return Object.fromEntries([...item].map(([key, value]) => [key, plain(value)]));
  if (Array.isArray(item)) return item.map(plain);
  if (typeof item === 'object' && item !== null && ('global' in item || isMark(item) || (item as Dtype).kind === 'dtype' || (item as Pending).kind === 'pending-array')) {
    throw new TypeError('The pickle left an unbuilt numpy object.');
  }
  return item as NpyValue;
}
