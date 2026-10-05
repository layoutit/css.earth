/**
 * NetCDF-4, the format newer climate models write: an HDF5 container (its structures are read in `hdf5-objects.ts`). This
 * reads the plain kind the Met Office Unified Model's files come out of the Iris library as: every variable in the root
 * group, stored whole and unfiltered (the contiguous layout) as little-endian numbers, under any of the four superblock
 * versions (libnetcdf wrote version 0 until 4.6 and writes version 2 since).
 *
 * Anything else is refused by name with what was met: a chunked or compressed variable, a nested group, big-endian
 * numbers. A variable's dimensions are the dimension scales its DIMENSION_LIST attribute points at, as the NetCDF-4
 * convention writes them. Structure is read from its own bytes and a variable's values from theirs, so a file of hundreds
 * of megabytes is never loaded whole. The file must be whole all the same: the library spreads its structure through the
 * file as variables are added, so no first part of it stands alone, and a file shorter than the length it states for
 * itself is refused.
 */
import { open } from 'node:fs/promises';
import type { NetcdfAttribute, NetcdfType, NetcdfVariable } from './classic-netcdf.ts';
import { address, HDF5_MESSAGE, hdf5AttributeMessages, hdf5GlobalHeapObject, hdf5GroupMembers, hdf5Messages, optionalAddress, type Hdf5Message, type Read } from './hdf5-objects.ts';

const SIGNATURE = Buffer.from([0x89, 0x48, 0x44, 0x46, 0x0d, 0x0a, 0x1a, 0x0a]);
/** The largest variable read whole: 64 million values are 512 MB as float64. */
const MAXIMUM_VALUES = 64_000_000;
/** What the NetCDF-4 library writes for its own use beside a variable's attributes, and does not show as attributes. */
const BOOKKEEPING = new Set(['CLASS', 'NAME', 'DIMENSION_LIST', 'REFERENCE_LIST', '_Netcdf4Dimid', '_Netcdf4Coordinates', '_nc3_strict']);
const DIMENSION_ONLY = 'This is a netCDF dimension but not a netCDF variable.';

/** What a datatype message says of one element. `references` and `strings` are variable-length values held in a global heap. */
interface ElementType { readonly kind: 'number' | 'text' | 'references' | 'strings' | 'other'; readonly bytes: number; readonly type?: NetcdfType; readonly littleEndian: boolean }
interface RawAttribute { readonly name: string; readonly element: ElementType; readonly shape: readonly number[]; readonly data: Buffer }
interface Stored { readonly variable: NetcdfVariable; readonly element: ElementType; readonly address: number | undefined; readonly inline: Buffer | undefined; readonly layout: string }

const product = (shape: readonly number[]) => shape.reduce((total, length) => total * length, 1);

function elementType(data: Buffer, label: string): ElementType {
  const kind = data[0]! & 0x0f, bits = data[1]!, bytes = data.readUInt32LE(4), littleEndian = (bits & 1) === 0;
  if (kind === 1) {
    if (bytes !== 4 && bytes !== 8) throw new TypeError(`${label}: a ${bytes}-byte floating-point type is not read.`);
    return { kind: 'number', bytes, type: bytes === 4 ? 'float' : 'double', littleEndian };
  }
  if (kind === 0) {
    const names: Readonly<Record<number, readonly [NetcdfType, NetcdfType]>> = { 1: ['byte', 'ubyte'], 2: ['short', 'ushort'], 4: ['int', 'uint'], 8: ['int64', 'uint64'] };
    const name = names[bytes];
    if (!name) throw new TypeError(`${label}: a ${bytes}-byte integer type is not read.`);
    return { kind: 'number', bytes, type: name[bits & 8 ? 0 : 1], littleEndian };
  }
  if (kind === 3) return { kind: 'text', bytes, type: 'char', littleEndian: true };
  // A variable-length type: text when its class bits say so, otherwise a list, here of object references.
  if (kind === 9) return { kind: (bits & 0x0f) === 1 ? 'strings' : (data[8]! & 0x0f) === 7 ? 'references' : 'other', bytes, littleEndian: true };
  return { kind: 'other', bytes, littleEndian: true };
}

function shapeOf(data: Buffer, label: string): readonly number[] {
  const version = data[0]!;
  if (version !== 1 && version !== 2) throw new TypeError(`${label}: dataspace version ${version} is not read.`);
  // A version 2 dataspace of type 2 is the null dataspace: no elements.
  if (version === 2 && data[3] === 2) return [0];
  return Array.from({ length: data[1]! }, (_, i) => address(data, (version === 1 ? 8 : 4) + 8 * i, label));
}

function numbers(bytes: Buffer, element: ElementType, label: string): Float64Array {
  if (element.kind !== 'number') throw new TypeError(`${label} is not numbers.`);
  if (!element.littleEndian) throw new TypeError(`${label}: big-endian numbers are not read.`);
  if (bytes.length % element.bytes) throw new TypeError(`${label}: ${bytes.length} bytes are not a whole number of ${element.bytes}-byte values.`);
  const type = element.type;
  return Float64Array.from({ length: bytes.length / element.bytes }, (_, index) => {
    const at = index * element.bytes;
    return type === 'double' ? bytes.readDoubleLE(at) : type === 'float' ? bytes.readFloatLE(at) : type === 'int' ? bytes.readInt32LE(at) : type === 'short' ? bytes.readInt16LE(at)
      : type === 'byte' ? bytes.readInt8(at) : type === 'ubyte' ? bytes.readUInt8(at) : type === 'ushort' ? bytes.readUInt16LE(at) : type === 'uint' ? bytes.readUInt32LE(at)
      : type === 'int64' ? Number(bytes.readBigInt64LE(at)) : Number(bytes.readBigUInt64LE(at));
  });
}

function attribute(data: Buffer, label: string): RawAttribute {
  const version = data[0]!;
  if (version < 1 || version > 3) throw new TypeError(`${label}: attribute version ${version} is not read.`);
  if (version > 1 && (data[1]! & 3)) throw new TypeError(`${label}: an attribute whose type or shape is stored in another object is not read.`);
  const nameSize = data.readUInt16LE(2), typeSize = data.readUInt16LE(4), spaceSize = data.readUInt16LE(6), pad = (length: number) => version === 1 ? Math.ceil(length / 8) * 8 : length;
  const nameAt = version === 3 ? 9 : 8, typeAt = nameAt + pad(nameSize), spaceAt = typeAt + pad(typeSize), dataAt = spaceAt + pad(spaceSize);
  const name = data.subarray(nameAt, nameAt + nameSize).toString('utf8').replace(/\0+$/u, '');
  return { name, element: elementType(data.subarray(typeAt, typeAt + typeSize), `${label}, attribute ${name}`), shape: shapeOf(data.subarray(spaceAt, spaceAt + spaceSize), `${label}, attribute ${name}`), data: data.subarray(dataAt) };
}

/** A variable-length element: how many items, and the global heap object that holds them. */
const heapRef = (data: Buffer, at: number, label: string) => ({ length: data.readUInt32LE(at), collection: address(data, at + 4, label), index: data.readUInt32LE(at + 12) });

/** Text and numbers; an attribute of any other type (a reference list, a compound) has no NetCDF value and is left out. */
async function attributeValue(read: Read, raw: RawAttribute, label: string): Promise<NetcdfAttribute | undefined> {
  if (raw.element.kind === 'text') return raw.data.subarray(0, raw.element.bytes).toString('utf8').replace(/\0.*$/su, '');
  if (raw.element.kind === 'number') return [...numbers(raw.data.subarray(0, product(raw.shape) * raw.element.bytes), raw.element, `${label}, attribute ${raw.name}`)];
  if (raw.element.kind === 'strings' && product(raw.shape) === 1) {
    const ref = heapRef(raw.data, 0, label);
    return (await hdf5GlobalHeapObject(read, ref.collection, ref.index, label)).subarray(0, ref.length).toString('utf8');
  }
  return undefined;
}

export interface Hdf5Netcdf {
  readonly variables: ReadonlyMap<string, NetcdfVariable>;
  /** Every value of a numeric variable, in storage order (the last dimension varying fastest), as stored: no scale, offset or fill is applied. */
  values(name: string): Promise<Float64Array>;
  /** `count` of those values from the `start`-th, read from their own bytes alone. */
  slice(name: string, start: number, count: number): Promise<Float64Array>;
  close(): Promise<void>;
}

/** Open a NetCDF-4 file of the plain kind this reader takes: its structure is read now, a variable's values when asked for. */
export async function openHdf5Netcdf(path: string): Promise<Hdf5Netcdf> {
  const file = await open(path, 'r');
  try {
    const { size } = await file.stat();
    const read: Read = async (offset, length) => {
      if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset + length > size) throw new TypeError(`${path}: its structure points at ${length} bytes from byte ${offset}, outside its ${size} bytes.`);
      const bytes = Buffer.alloc(length), { bytesRead } = await file.read(bytes, 0, length, offset);
      if (bytesRead !== length) throw new TypeError(`${path} ends inside the ${length} bytes at ${offset}.`);
      return bytes;
    };
    const superblock = await read(0, Math.min(size, 100));
    if (!superblock.subarray(0, 8).equals(SIGNATURE)) throw new TypeError(`${path} is not an HDF5 file, and so not NetCDF-4.`);
    const version = superblock[8]!;
    if (version > 3) throw new TypeError(`${path}: HDF5 superblock version ${version} is not read.`);
    // Versions 0 and 1 give the sizes after five version bytes and end on the root group's symbol table entry, whose second
    // field is the root's object header; versions 2 and 3 give the sizes first and the root's object header directly.
    const sizesAt = version < 2 ? 13 : 9, fields = version === 0 ? 24 : version === 1 ? 28 : 12;
    if (superblock[sizesAt] !== 8 || superblock[sizesAt + 1] !== 8) throw new TypeError(`${path}: ${superblock[sizesAt]}-byte offsets and ${superblock[sizesAt + 1]}-byte lengths are not read; 8 and 8 are.`);
    if (address(superblock, fields, path) !== 0) throw new TypeError(`${path}: a base address other than 0 is not read.`);
    const stated = address(superblock, fields + 16, path), root = address(superblock, fields + (version < 2 ? 40 : 24), path);
    if (size < stated) throw new TypeError(`${path} is cut short: it holds ${size} of the ${stated} bytes it states for itself.`);
    const members = await hdf5GroupMembers(read, await hdf5Messages(read, root, path), path);

    const byAddress = new Map([...members].map(([name, at]) => [at, name])), stored = new Map<string, Stored>(), groups: string[] = [];
    for (const [name, at] of members) {
      const label = `${path}, ${name}`, all = await hdf5Messages(read, at, label);
      const one = (type: number): Hdf5Message | undefined => all.find(message => message.type === type);
      if (one(HDF5_MESSAGE.linkInfo)) { groups.push(name); continue; }
      const type = one(HDF5_MESSAGE.datatype), space = one(HDF5_MESSAGE.dataspace), layout = one(HDF5_MESSAGE.layout)?.data;
      if (!type || !space || !layout) continue;
      if (type.shared || space.shared) throw new TypeError(`${label}: a type or shape stored in another object is not read.`);
      const element = elementType(type.data, label), shape = shapeOf(space.data, label);
      if (element.kind !== 'number' && element.kind !== 'text') continue;
      const raw = (await hdf5AttributeMessages(read, all, label)).map(data => attribute(data, label));
      const scale = raw.find(entry => entry.name === 'NAME' && entry.element.kind === 'text')?.data.toString('latin1');
      // A dimension no variable was declared for is still written as a dataset, with a NAME that says so.
      if (scale?.startsWith(DIMENSION_ONLY)) continue;
      const attributes: Record<string, NetcdfAttribute> = {};
      for (const entry of raw) {
        const value = BOOKKEEPING.has(entry.name) ? undefined : await attributeValue(read, entry, label);
        if (value !== undefined) attributes[entry.name] = value;
      }
      // The fill value message stands in when the variable carries no attribute of its own for it.
      const fill = one(HDF5_MESSAGE.fillValue)?.data;
      if (fill && attributes._FillValue === undefined && element.kind === 'number') {
        const defined = fill[0] === 3 ? (fill[1]! & 0x20) !== 0 : fill[0] === 2 && fill[3] === 1, valueAt = fill[0] === 3 ? 6 : 8;
        if (defined && fill.readUInt32LE(valueAt - 4) === element.bytes) attributes._FillValue = [...numbers(fill.subarray(valueAt, valueAt + element.bytes), element, label)];
      }
      // Dimensions: the scales the DIMENSION_LIST attribute points at; a scale is its own dimension.
      const list = raw.find(entry => entry.name === 'DIMENSION_LIST' && entry.element.kind === 'references');
      const dimensions: string[] = [];
      for (let i = 0; i < shape.length; i++) {
        let dimension: string | undefined;
        if (list) {
          const ref = heapRef(list.data, i * 16, label);
          if (ref.length > 0) dimension = byAddress.get(address(await hdf5GlobalHeapObject(read, ref.collection, ref.index, label), 0, label));
        }
        dimensions.push(dimension ?? (shape.length === 1 && scale !== undefined ? name : `${name}#${i}`));
      }
      if (layout[0] !== 3 && layout[0] !== 4) throw new TypeError(`${label}: data layout version ${layout[0]} is not read.`);
      const kind = layout[1] === 1 ? 'contiguous' : layout[1] === 0 ? 'compact' : layout[1] === 2 ? 'chunked' : `in layout class ${layout[1]}`;
      stored.set(name, { variable: { name, dimensions, shape, type: element.type!, attributes }, element, layout: kind,
        // No address is a variable no value was ever written to.
        address: kind === 'contiguous' ? optionalAddress(layout, 2, label) : undefined,
        inline: kind === 'compact' ? layout.subarray(4, 4 + layout.readUInt16LE(2)) : undefined });
    }
    if (groups.length) throw new TypeError(`${path} holds the groups ${groups.join(', ')}; variables inside groups are not read.`);

    const entryOf = (name: string) => {
      const entry = stored.get(name);
      if (!entry) throw new TypeError(`${path} has no variable ${name}; it has ${[...stored.keys()].join(', ')}.`);
      if (entry.element.kind !== 'number') throw new TypeError(`${path}: variable ${name} is text, not numbers.`);
      return entry;
    };
    const slice = async (name: string, start: number, count: number) => {
      const entry = entryOf(name), total = product(entry.variable.shape), bytes = entry.element.bytes;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(count) || start < 0 || count <= 0 || start + count > total)
        throw new RangeError(`${path}: variable ${name} has ${total} values, and ${count} from value ${start} were asked for.`);
      if (entry.inline) return numbers(entry.inline.subarray(start * bytes, (start + count) * bytes), entry.element, `${path}, ${name}`);
      if (entry.layout !== 'contiguous') throw new TypeError(`${path}: variable ${name} is stored ${entry.layout}; only a variable stored whole and unfiltered is read.`);
      if (entry.address === undefined) throw new TypeError(`${path}: variable ${name} was never written.`);
      return numbers(await read(entry.address + start * bytes, count * bytes), entry.element, `${path}, ${name}`);
    };
    return { variables: new Map([...stored].map(([name, entry]) => [name, entry.variable])), slice, close: () => file.close(),
      async values(name: string) {
        const total = product(entryOf(name).variable.shape);
        if (total > MAXIMUM_VALUES) throw new RangeError(`${path}: variable ${name} has ${total} values, more than the ${MAXIMUM_VALUES} read at once.`);
        return slice(name, 0, total);
      } };
  } catch (error) { await file.close(); throw error; }
}
