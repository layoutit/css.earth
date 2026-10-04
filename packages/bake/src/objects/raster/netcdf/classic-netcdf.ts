/**
 * Classic NetCDF, the format climate models write their history files in: CDF-1, CDF-2 ("64-bit offset") and CDF-5
 * ("64-bit data"), as the NetCDF classic format specification lays them out
 * (https://docs.unidata.ucar.edu/netcdf-c/current/file_format_specifications.html). The header is read from the start of
 * the file and one variable's values from their own byte range, so a file of hundreds of megabytes is never loaded whole.
 *
 * NetCDF-4 files are HDF5 containers and are not read here: they are refused by name, with what this reader does read.
 */
import { open } from 'node:fs/promises';

/** Bytes per element of each external type, by its `nc_type` number. Types 7 to 11 exist in CDF-5 only. */
const TYPES = { 1: ['byte', 1], 2: ['char', 1], 3: ['short', 2], 4: ['int', 4], 5: ['float', 4], 6: ['double', 8],
  7: ['ubyte', 1], 8: ['ushort', 2], 9: ['uint', 4], 10: ['int64', 8], 11: ['uint64', 8] } as const;
export type NetcdfType = typeof TYPES[keyof typeof TYPES][0];
/** A text attribute is a string; a numeric one is its values, one or several. */
export type NetcdfAttribute = string | readonly number[];

export interface NetcdfVariable {
  readonly name: string;
  /** Dimension names and lengths in storage order, the last varying fastest. The record dimension has the file's record count. */
  readonly dimensions: readonly string[]; readonly shape: readonly number[];
  readonly type: NetcdfType; readonly attributes: Readonly<Record<string, NetcdfAttribute>>;
}
export interface NetcdfHeader {
  readonly version: 1 | 2 | 5; readonly records: number; readonly bytes: number;
  readonly dimensions: ReadonlyMap<string, number>; readonly attributes: Readonly<Record<string, NetcdfAttribute>>;
  readonly variables: ReadonlyMap<string, NetcdfVariable>;
  /** Where each variable's values are: the first byte, the bytes of one record (or of the whole variable) and whether it has records. */
  readonly layout: ReadonlyMap<string, { readonly begin: number; readonly elementBytes: number; readonly record: boolean; readonly typeCode: number }>;
  readonly recordBytes: number;
}

/** The header runs past the bytes read so far: read more of the file and parse again. */
export class NetcdfHeaderIncomplete extends Error {}

const HDF5 = Buffer.from([0x89, 0x48, 0x44, 0x46, 0x0d, 0x0a, 0x1a, 0x0a]);
const DIMENSION = 0x0a, VARIABLE = 0x0b, ATTRIBUTE = 0x0c;
/** The largest variable read whole: 64 million values are 512 MB as float64. */
const MAXIMUM_VALUES = 64_000_000;

/** Parse a classic NetCDF header from the first bytes of `label`. */
export function parseClassicNetcdfHeader(bytes: Buffer, label: string): NetcdfHeader {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(HDF5))
    throw new TypeError(`${label} is a NetCDF-4 file (an HDF5 container). This reader reads classic NetCDF: CDF-1, CDF-2 and CDF-5.`);
  if (bytes.length < 4) throw new NetcdfHeaderIncomplete();
  const version = bytes[3];
  if (bytes.toString('latin1', 0, 3) !== 'CDF' || (version !== 1 && version !== 2 && version !== 5))
    throw new TypeError(`${label} is not a classic NetCDF file: it starts with ${bytes.subarray(0, 4).toString('hex')}, not "CDF" and version 1, 2 or 5.`);
  let at = 4;
  const need = (count: number) => { if (at + count > bytes.length) throw new NetcdfHeaderIncomplete(); };
  const int = () => { need(4); const value = bytes.readInt32BE(at); at += 4; return value; };
  const wide = () => { need(8); const value = bytes.readBigUInt64BE(at); at += 8; if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError(`${label}: a header size of ${value} is beyond what can be addressed.`); return Number(value); };
  // CDF-5 widens every count and size to 64 bits; list tags and type numbers stay 32 bits.
  const count = version === 5 ? wide : () => { need(4); const value = bytes.readUInt32BE(at); at += 4; return value; };
  const offset = version === 1 ? () => { need(4); const value = bytes.readUInt32BE(at); at += 4; return value; } : wide;
  const pad = (length: number) => { at += (4 - length % 4) % 4; };
  const name = () => { const length = count(); need(length); const text = bytes.toString('utf8', at, at + length); at += length; pad(length); return text; };
  const list = (tag: number, what: string) => {
    const found = int(), elements = count();
    if (found === 0 && elements === 0) return 0;
    if (found !== tag) throw new TypeError(`${label}: expected the ${what} list (tag ${tag}), found tag ${found}.`);
    return elements;
  };
  const element = (typeCode: number, position: number): number => {
    switch (typeCode) {
      case 1: return bytes.readInt8(position);
      case 3: return bytes.readInt16BE(position);
      case 4: return bytes.readInt32BE(position);
      case 5: return bytes.readFloatBE(position);
      case 6: return bytes.readDoubleBE(position);
      case 7: return bytes.readUInt8(position);
      case 8: return bytes.readUInt16BE(position);
      case 9: return bytes.readUInt32BE(position);
      case 10: return Number(bytes.readBigInt64BE(position));
      case 11: return Number(bytes.readBigUInt64BE(position));
      default: throw new TypeError(`${label}: type ${typeCode} holds no numbers.`);
    }
  };
  const typeOf = (typeCode: number, where: string) => {
    const type = TYPES[typeCode as keyof typeof TYPES];
    if (!type || (typeCode > 6 && version !== 5)) throw new TypeError(`${label}: ${where} has the unknown type number ${typeCode}.`);
    return type;
  };
  const attributes = (where: string) => {
    const out: Record<string, NetcdfAttribute> = {};
    for (let i = list(ATTRIBUTE, `${where} attribute`); i > 0; i--) {
      const key = name(), typeCode = int(), [, size] = typeOf(typeCode, `attribute ${key} of ${where}`), elements = count();
      need(elements * size);
      out[key] = typeCode === 2 ? bytes.toString('utf8', at, at + elements).replace(/\0+$/u, '')
        : Array.from({ length: elements }, (_, index) => element(typeCode, at + index * size));
      at += elements * size; pad(elements * size);
    }
    return out;
  };

  const streaming = version === 5 ? 0xffff_ffff_ffff_ffffn : 0xffff_ffffn;
  need(version === 5 ? 8 : 4);
  if ((version === 5 ? bytes.readBigUInt64BE(at) : BigInt(bytes.readUInt32BE(at))) === streaming)
    throw new TypeError(`${label} was left open while its records were being written (its record count is the streaming marker); it cannot be read.`);
  const records = count();
  const dimensionNames: string[] = [], dimensionLengths: number[] = [];
  for (let i = list(DIMENSION, 'dimension'); i > 0; i--) { dimensionNames.push(name()); dimensionLengths.push(count()); }
  const recordDimension = dimensionLengths.indexOf(0);
  if (dimensionLengths.lastIndexOf(0) !== recordDimension) throw new TypeError(`${label}: more than one record dimension.`);
  const global = attributes('the file');
  const variables = new Map<string, NetcdfVariable>(), layout = new Map<string, { begin: number; elementBytes: number; record: boolean; typeCode: number }>();
  const recordSizes: { padded: number; exact: number }[] = [];
  for (let i = list(VARIABLE, 'variable'); i > 0; i--) {
    const key = name(), rank = count(), ids = Array.from({ length: rank }, () => count());
    for (const id of ids) if (id >= dimensionNames.length) throw new TypeError(`${label}: variable ${key} names dimension ${id}, and the file has ${dimensionNames.length}.`);
    const own = attributes(`variable ${key}`), typeCode = int(), [type, size] = typeOf(typeCode, `variable ${key}`), vsize = count(), begin = offset();
    const record = rank > 0 && ids[0] === recordDimension;
    if (ids.slice(1).includes(recordDimension)) throw new TypeError(`${label}: variable ${key} has the record dimension after its first.`);
    const shape = ids.map(id => id === recordDimension ? records : dimensionLengths[id]!);
    const perRecord = ids.slice(record ? 1 : 0).reduce((product, id) => product * dimensionLengths[id]!, 1) * size;
    if (record) recordSizes.push({ padded: vsize, exact: perRecord });
    if (variables.has(key)) throw new TypeError(`${label}: variable ${key} is defined twice.`);
    variables.set(key, { name: key, dimensions: ids.map(id => dimensionNames[id]!), shape, type, attributes: own });
    layout.set(key, { begin, elementBytes: size, record, typeCode });
  }
  // One record of every record variable follows the last, each padded to four bytes; a lone record variable is not padded.
  const recordBytes = recordSizes.length === 1 ? recordSizes[0]!.exact : recordSizes.reduce((sum, { padded }) => sum + padded, 0);
  return { version, records, bytes: at, dimensions: new Map(dimensionNames.map((key, index) => [key, index === recordDimension ? records : dimensionLengths[index]!])),
    attributes: global, variables, layout, recordBytes };
}

/** Where a run of a variable's values lies in the file: `count` values from the `start`-th, counted in storage order. A
 * record variable's run lies inside one record, since the records of the other variables come between two of its own. */
export function valueRange(header: NetcdfHeader, name: string, start: number, count: number, label: string): { offset: number; length: number } {
  const variable = header.variables.get(name), place = header.layout.get(name);
  if (!variable || !place) throw new TypeError(`${label} has no variable ${name}; it has ${[...header.variables.keys()].join(', ')}.`);
  const total = variable.shape.reduce((product, length) => product * length, 1), perRecord = place.record ? total / Math.max(1, header.records) : total;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(count) || start < 0 || count <= 0 || start + count > total)
    throw new RangeError(`${label}: variable ${name} has ${total} values, and ${count} from value ${start} were asked for.`);
  const record = place.record ? Math.floor(start / perRecord) : 0, within = start - record * perRecord;
  if (within + count > perRecord) throw new RangeError(`${label}: values ${start} to ${start + count - 1} of ${name} lie in more than one record, and so in more than one run of bytes.`);
  return { offset: place.begin + record * header.recordBytes + within * place.elementBytes, length: count * place.elementBytes };
}

/** The numbers a run of stored bytes holds, as the variable's type reads them: no scale, offset or fill is applied. */
export function storedValues(header: NetcdfHeader, name: string, bytes: Buffer, label: string): Float64Array {
  const variable = header.variables.get(name), place = header.layout.get(name);
  if (!variable || !place) throw new TypeError(`${label} has no variable ${name}.`);
  if (variable.type === 'char') throw new TypeError(`${label}: variable ${name} is text, not numbers.`);
  if (bytes.length % place.elementBytes) throw new TypeError(`${label}: ${bytes.length} bytes are not a whole number of ${name}'s ${place.elementBytes}-byte values.`);
  const code = place.typeCode;
  return Float64Array.from({ length: bytes.length / place.elementBytes }, (_, index) => {
    const at = index * place.elementBytes;
    return code === 5 ? bytes.readFloatBE(at) : code === 6 ? bytes.readDoubleBE(at) : code === 4 ? bytes.readInt32BE(at) : code === 3 ? bytes.readInt16BE(at)
      : code === 1 ? bytes.readInt8(at) : code === 7 ? bytes.readUInt8(at) : code === 8 ? bytes.readUInt16BE(at) : code === 9 ? bytes.readUInt32BE(at)
      : code === 10 ? Number(bytes.readBigInt64BE(at)) : Number(bytes.readBigUInt64BE(at));
  });
}

export interface ClassicNetcdf extends NetcdfHeader {
  /** Every value of a numeric variable, in storage order (the last dimension varying fastest), as stored: no scale, offset or fill is applied. */
  values(name: string): Promise<Float64Array>;
  /** `count` of those values from the `start`-th, read from their own bytes alone. */
  slice(name: string, start: number, count: number): Promise<Float64Array>;
  close(): Promise<void>;
}

/** Open a classic NetCDF file: its header is read now, a variable's values when asked for. */
export async function openClassicNetcdf(path: string): Promise<ClassicNetcdf> {
  const file = await open(path, 'r');
  try {
    const { size } = await file.stat();
    let header: NetcdfHeader | undefined;
    // A model's history file names hundreds of variables; its header is read in growing pieces until it parses.
    for (let length = Math.min(size, 1 << 16); header === undefined; length = Math.min(size, length * 4)) {
      const bytes = Buffer.alloc(length);
      await file.read(bytes, 0, length, 0);
      try { header = parseClassicNetcdfHeader(bytes, path); }
      catch (error) {
        if (!(error instanceof NetcdfHeaderIncomplete)) throw error;
        if (length === size) throw new TypeError(`${path} ends inside its NetCDF header.`);
      }
    }
    const parsed = header;
    const slice = async (name: string, start: number, count: number) => {
      const { offset, length } = valueRange(parsed, name, start, count, path), bytes = Buffer.alloc(length);
      const { bytesRead } = await file.read(bytes, 0, length, offset);
      if (bytesRead !== length) throw new TypeError(`${path} ends inside variable ${name}: ${bytesRead} of ${length} bytes at ${offset}.`);
      return storedValues(parsed, name, bytes, path);
    };
    return { ...parsed, close: () => file.close(), slice, async values(name: string) {
      const variable = parsed.variables.get(name), place = parsed.layout.get(name);
      if (!variable || !place) throw new TypeError(`${path} has no variable ${name}; it has ${[...parsed.variables.keys()].join(', ')}.`);
      if (variable.type === 'char') throw new TypeError(`${path}: variable ${name} is text, not numbers.`);
      const total = variable.shape.reduce((product, length) => product * length, 1);
      if (total > MAXIMUM_VALUES) throw new RangeError(`${path}: variable ${name} has ${total} values, more than the ${MAXIMUM_VALUES} read at once.`);
      const perRecord = place.record ? total / Math.max(1, parsed.records) : total, out = new Float64Array(total);
      for (let written = 0; written < total; written += perRecord) out.set(await slice(name, written, perRecord), written);
      return out;
    } };
  } catch (error) { await file.close(); throw error; }
}
