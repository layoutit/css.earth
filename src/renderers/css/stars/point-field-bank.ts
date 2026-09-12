import type { DensityVolumeFrame } from '@cssearth/objects';
import type { PointFieldBankStorage, PointFieldVector, PreparedPointFieldBank, PreparedPointFieldBankColumn,
  PreparedPointFieldNode, PreparedPointFieldStar } from './types.js';

/** Binary column bank of one prepared point field. Little-endian, every column 8-byte aligned.
 * Header (64 bytes): magic "CSEPFB01", u16 header bytes, u16 version, u32 star count, u32 node count,
 * u32 child-link count, u32 anchor count, u16 column count, u16 zero, u32 total bytes, zero padding.
 * Directory: one (u32 offset, u32 byte length) pair per column, in POINT_FIELD_BANK_COLUMNS order.
 * Runtime only decodes these prepared values; it derives no position, magnitude or hierarchy. */
export const POINT_FIELD_BANK_ENCODING = 'cssearth-point-field-bank@1';
export const POINT_FIELD_BANK_MAGIC = 'CSEPFB01';
export const POINT_FIELD_BANK_VERSION = 1;
export const POINT_FIELD_BANK_HEADER_BYTES = 64;
const DIRECTORY_ENTRY_BYTES = 8, ALIGNMENT = 8;

/** Star magnitudes travel as int16 millimagnitudes and decode onto the float32 grid of the HYG
 * source column. Half a quantum is the declared bound; preparation asserts its display effect. */
export const POINT_FIELD_MAGNITUDE_DIVISOR = 1000;
export const POINT_FIELD_MAGNITUDE_BOUND = 0.5 / POINT_FIELD_MAGNITUDE_DIVISOR;
export function decodeStarMagnitude(quantized: number): number { return Math.fround(quantized / POINT_FIELD_MAGNITUDE_DIVISOR); }

type Domain = 'star' | 'node' | 'child' | 'anchor';
interface ColumnSpec { readonly name: string; readonly storage: PointFieldBankStorage; readonly domain: Domain; readonly width: number; }
export const POINT_FIELD_BANK_COLUMNS: readonly ColumnSpec[] = Object.freeze([
  { name: 'star.sourceRow', storage: 'uint32', domain: 'star', width: 1 },
  { name: 'star.positionUnits', storage: 'float32', domain: 'star', width: 3 },
  { name: 'star.absoluteMagnitude', storage: 'int16', domain: 'star', width: 1 },
  { name: 'star.colorIndex', storage: 'uint8', domain: 'star', width: 1 },
  { name: 'star.coverageAnchor', storage: 'uint32', domain: 'anchor', width: 1 },
  { name: 'node.positionUnits', storage: 'float64', domain: 'node', width: 3 },
  { name: 'node.radiusUnits', storage: 'float64', domain: 'node', width: 1 },
  { name: 'node.absoluteMagnitude', storage: 'float64', domain: 'node', width: 1 },
  { name: 'node.colorIndex', storage: 'uint8', domain: 'node', width: 1 },
  { name: 'node.first', storage: 'uint32', domain: 'node', width: 1 },
  { name: 'node.count', storage: 'uint32', domain: 'node', width: 1 },
  { name: 'node.childCount', storage: 'uint8', domain: 'node', width: 1 },
  { name: 'node.children', storage: 'uint32', domain: 'child', width: 1 },
] satisfies ColumnSpec[]);

/** Declared decode rule and error bound of every numeric field. Float columns are lossless:
 * star positions are the float32 HYG values, hierarchy values the published float64 aggregates. */
export const POINT_FIELD_BANK_QUANTIZATION = Object.freeze([
  { field: 'star.positionUnits', storage: 'float32', decode: 'identity', unit: 'pc', bound: 0 },
  { field: 'star.absoluteMagnitude', storage: 'int16', decode: 'float32(q / 1000)', unit: 'mag', bound: POINT_FIELD_MAGNITUDE_BOUND },
  { field: 'node.positionUnits', storage: 'float64', decode: 'identity', unit: 'pc', bound: 0 },
  { field: 'node.radiusUnits', storage: 'float64', decode: 'identity', unit: 'pc', bound: 0 },
  { field: 'node.absoluteMagnitude', storage: 'float64', decode: 'identity', unit: 'mag', bound: 0 },
] as const);

const STORAGE_BYTES: Readonly<Record<PointFieldBankStorage, number>> = { uint8: 1, int16: 2, uint32: 4, float32: 4, float64: 8 };

export interface PointFieldBankCounts {
  readonly starCount: number; readonly nodeCount: number; readonly childLinkCount: number; readonly anchorCount: number;
}

export function pointFieldBankLayout(counts: PointFieldBankCounts): { readonly columns: readonly PreparedPointFieldBankColumn[]; readonly bytes: number } {
  for (const value of [counts.starCount, counts.nodeCount, counts.childLinkCount, counts.anchorCount]) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) throw new TypeError('Point-field bank counts are invalid.');
  }
  const elements: Readonly<Record<Domain, number>> = { star: counts.starCount, node: counts.nodeCount, child: counts.childLinkCount, anchor: counts.anchorCount };
  let offset = align(POINT_FIELD_BANK_HEADER_BYTES + POINT_FIELD_BANK_COLUMNS.length * DIRECTORY_ENTRY_BYTES);
  const columns = POINT_FIELD_BANK_COLUMNS.map(column => {
    const count = elements[column.domain] * column.width, bytes = count * STORAGE_BYTES[column.storage];
    const entry: PreparedPointFieldBankColumn = Object.freeze({ name: column.name, storage: column.storage, count, offset, bytes });
    offset = align(offset + bytes);
    return entry;
  });
  if (offset > 0xffffffff) throw new TypeError('Point-field bank exceeds its 32-bit layout.');
  return Object.freeze({ columns: Object.freeze(columns), bytes: offset });
}

/** Header and directory bytes shared by the offline encoder and the runtime check. */
export function pointFieldBankHeader(counts: PointFieldBankCounts): Uint8Array {
  const layout = pointFieldBankLayout(counts);
  const header = new Uint8Array(layout.columns[0]!.offset), view = new DataView(header.buffer);
  for (let index = 0; index < POINT_FIELD_BANK_MAGIC.length; index++) header[index] = POINT_FIELD_BANK_MAGIC.charCodeAt(index);
  view.setUint16(8, POINT_FIELD_BANK_HEADER_BYTES, true);
  view.setUint16(10, POINT_FIELD_BANK_VERSION, true);
  view.setUint32(12, counts.starCount, true);
  view.setUint32(16, counts.nodeCount, true);
  view.setUint32(20, counts.childLinkCount, true);
  view.setUint32(24, counts.anchorCount, true);
  view.setUint16(28, layout.columns.length, true);
  view.setUint32(32, layout.bytes, true);
  layout.columns.forEach((column, index) => {
    view.setUint32(POINT_FIELD_BANK_HEADER_BYTES + index * DIRECTORY_ENTRY_BYTES, column.offset, true);
    view.setUint32(POINT_FIELD_BANK_HEADER_BYTES + index * DIRECTORY_ENTRY_BYTES + 4, column.bytes, true);
  });
  return header;
}

export interface DecodedPointFieldBank {
  readonly stars: readonly PreparedPointFieldStar[];
  readonly nodes: readonly PreparedPointFieldNode[];
}

/** Decodes a verified bank into the immutable in-memory point field rows. Every header field,
 * directory entry, index and value range is checked; nothing is assumed from the manifest alone. */
export function decodePointFieldBank(input: ArrayBuffer | Uint8Array, bank: PreparedPointFieldBank,
  context: { readonly frame: DensityVolumeFrame; readonly colorCount: number }): DecodedPointFieldBank {
  if (new Uint8Array(new Uint16Array([1]).buffer)[0] !== 1) throw new TypeError('Point-field banks require a little-endian runtime.');
  const source = input instanceof Uint8Array ? input : new Uint8Array(input);
  const layout = pointFieldBankLayout(bank), expectedHeader = pointFieldBankHeader(bank);
  if (source.byteLength !== bank.bytes || source.byteLength !== layout.bytes) throw new TypeError('Point-field bank byte length does not match its manifest.');
  if (bank.columns.length !== layout.columns.length || bank.columns.some((column, index) => {
    const expected = layout.columns[index]!;
    return column.name !== expected.name || column.storage !== expected.storage || column.count !== expected.count ||
      column.offset !== expected.offset || column.bytes !== expected.bytes;
  })) throw new TypeError('Point-field bank columns do not match the declared layout.');
  for (let index = 0; index < expectedHeader.length; index++) {
    if (source[index] !== expectedHeader[index]) throw new TypeError('Point-field bank header or directory drifted.');
  }
  // Typed views need aligned offsets; copy only when the caller supplied an unaligned view.
  const bytes = source.byteOffset % ALIGNMENT === 0 ? source : source.slice();
  const column = <T>(name: string, make: (buffer: ArrayBufferLike, offset: number, length: number) => T): T => {
    const entry = layout.columns.find(candidate => candidate.name === name)!;
    return make(bytes.buffer, bytes.byteOffset + entry.offset, entry.count);
  };
  const u8 = (b: ArrayBufferLike, o: number, n: number) => new Uint8Array(b, o, n);
  const i16 = (b: ArrayBufferLike, o: number, n: number) => new Int16Array(b, o, n);
  const u32 = (b: ArrayBufferLike, o: number, n: number) => new Uint32Array(b, o, n);
  const f32 = (b: ArrayBufferLike, o: number, n: number) => new Float32Array(b, o, n);
  const f64 = (b: ArrayBufferLike, o: number, n: number) => new Float64Array(b, o, n);
  const { starCount, nodeCount } = bank, colorCount = context.colorCount;
  const rows = column('star.sourceRow', u32), positions = column('star.positionUnits', f32);
  const magnitudes = column('star.absoluteMagnitude', i16), colors = column('star.colorIndex', u8), anchors = column('star.coverageAnchor', u32);
  const anchored = new Uint8Array(starCount);
  anchors.forEach((index, order) => {
    if (index >= starCount || (order > 0 && index <= anchors[order - 1]!)) throw new TypeError('Point-field coverage anchors must be increasing star indices.');
    anchored[index] = 1;
  });
  const names: (string | null)[] = new Array<string | null>(starCount).fill(null);
  bank.names.forEach(([index, name], order) => {
    if (index >= starCount || (order > 0 && index <= bank.names[order - 1]![0])) throw new TypeError('Point-field names must be increasing star indices.');
    names[index] = name;
  });
  const { min, max } = context.frame.boundsUnits, seen = new Uint8Array(starCount);
  const stars = new Array<PreparedPointFieldStar>(starCount);
  for (let index = 0; index < starCount; index++) {
    const row = rows[index]!, x = positions[index * 3]!, y = positions[index * 3 + 1]!, z = positions[index * 3 + 2]!, colorIndex = colors[index]!;
    // Comparisons are false for NaN, so non-finite positions fail the frame bounds too.
    if (row >= starCount || seen[row] || !(x >= min[0] && x <= max[0] && y >= min[1] && y <= max[1] && z >= min[2] && z <= max[2]) || colorIndex >= colorCount) {
      throw new TypeError('Prepared point-field star is invalid.');
    }
    seen[row] = 1;
    stars[index] = Object.freeze({ id: `${bank.starIdPrefix}:${row}`, positionUnits: Object.freeze([x, y, z]) as PointFieldVector,
      absoluteMagnitude: decodeStarMagnitude(magnitudes[index]!), colorIndex, name: names[index]!, coverageAnchor: anchored[index] === 1 });
  }
  const nodePositions = column('node.positionUnits', f64), radii = column('node.radiusUnits', f64), nodeMagnitudes = column('node.absoluteMagnitude', f64);
  const nodeColors = column('node.colorIndex', u8), firsts = column('node.first', u32), counts = column('node.count', u32);
  const childCounts = column('node.childCount', u8), links = column('node.children', u32);
  const nodes = new Array<PreparedPointFieldNode>(nodeCount);
  let link = 0;
  for (let index = 0; index < nodeCount; index++) {
    const x = nodePositions[index * 3]!, y = nodePositions[index * 3 + 1]!, z = nodePositions[index * 3 + 2]!;
    const radiusUnits = radii[index]!, absoluteMagnitude = nodeMagnitudes[index]!, colorIndex = nodeColors[index]!, childCount = childCounts[index]!;
    if (![x, y, z, radiusUnits, absoluteMagnitude].every(Number.isFinite) || radiusUnits < 0 || colorIndex >= colorCount ||
        counts[index] === 0 || link + childCount > links.length) throw new TypeError('Prepared point-field hierarchy node is invalid.');
    const children = Object.freeze(Array.from(links.subarray(link, link + childCount)));
    if (children.some(child => child >= nodeCount) || new Set(children).size !== children.length) throw new TypeError('Prepared point-field hierarchy children are invalid.');
    link += childCount;
    nodes[index] = Object.freeze({ positionUnits: Object.freeze([x, y, z]) as PointFieldVector, radiusUnits, absoluteMagnitude, colorIndex,
      first: firsts[index]!, count: counts[index]!, children });
  }
  if (link !== links.length) throw new TypeError('Prepared point-field hierarchy links do not match their count.');
  return Object.freeze({ stars: Object.freeze(stars), nodes: Object.freeze(nodes) });
}

function align(value: number): number { return Math.ceil(value / ALIGNMENT) * ALIGNMENT; }
