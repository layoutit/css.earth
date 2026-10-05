/**
 * The parts of an HDF5 file a NetCDF-4 reader walks, laid out by the HDF5 file format specification
 * (https://docs.hdfgroup.org/hdf5/v1_14/_f_m_t3.html), in the layouts the NetCDF-4 library writes: an object's version 2
 * header messages, a group's links (kept in the header, or in a fractal heap indexed by a version 2 B-tree once there are
 * more than a few), and the two heaps attribute values live in.
 *
 * Every function reads only the bytes its structure names. What is not read is refused by name: a filtered heap, a heap
 * object stored outside the heap's own blocks, a nested indirect heap block, a soft or external link, and the older
 * version 1 headers and symbol-table groups, which NetCDF-4 does not write.
 */
export type Read = (offset: number, length: number) => Promise<Buffer>;
export interface Hdf5Message { readonly type: number; readonly data: Buffer; /** Stored in another object, not here. */ readonly shared: boolean }

export const HDF5_MESSAGE = { dataspace: 0x01, linkInfo: 0x02, datatype: 0x03, fillValue: 0x05, link: 0x06, layout: 0x08, attribute: 0x0c, continuation: 0x10, attributeInfo: 0x15 } as const;
const UNDEFINED = 0xffffffffffffffffn;

const signature = (bytes: Buffer) => bytes.subarray(0, 4).toString('latin1');
/** An unsigned little-endian integer of `size` bytes. */
export function uint(bytes: Buffer, at: number, size: number, label: string): number {
  let value = 0;
  for (let i = size - 1; i >= 0; i--) value = value * 256 + bytes[at + i]!;
  if (!Number.isSafeInteger(value)) throw new RangeError(`${label}: a ${size}-byte number is beyond what is read.`);
  return value;
}
/** An 8-byte file address; undefined when HDF5 wrote its all-ones "no address". */
export const optionalAddress = (bytes: Buffer, at: number, label: string) => bytes.readBigUInt64LE(at) === UNDEFINED ? undefined : uint(bytes, at, 8, label);
export function address(bytes: Buffer, at: number, label: string): number {
  const value = optionalAddress(bytes, at, label);
  if (value === undefined) throw new TypeError(`${label}: an address the structure needs was never written.`);
  return value;
}
/** How many bytes hold a number up to `maximum`, as HDF5 sizes its variable-width fields. */
const bytesFor = (maximum: number) => Math.max(1, Math.ceil(Math.log2(maximum + 1) / 8));

/** An object header's messages, following its continuation blocks. */
export async function hdf5Messages(read: Read, at: number, label: string): Promise<Hdf5Message[]> {
  const head = await read(at, 16), out: Hdf5Message[] = [];
  if (signature(head) !== 'OHDR') throw new TypeError(`${label}: no version 2 object header at byte ${at}. NetCDF-4 tracks the order its contents were made in, which writes that version.`);
  if (head[4] !== 2) throw new TypeError(`${label}: object header version ${head[4]} is not read.`);
  // Version 2: optional times and attribute thresholds, then the first chunk's size; each later chunk carries a signature and a checksum.
  const flags = head[5]!, sizeAt = 6 + (flags & 0x20 ? 16 : 0) + (flags & 0x10 ? 4 : 0), sizeBytes = 1 << (flags & 3), prefix = flags & 0x04 ? 6 : 4;
  const first = await read(at, sizeAt + sizeBytes), blocks: [number, number][] = [[at + sizeAt + sizeBytes, uint(first, sizeAt, sizeBytes, label)]];
  for (let block = blocks.shift(); block; block = blocks.shift()) {
    const bytes = await read(block[0], block[1]);
    for (let p = 0; p + prefix <= bytes.length;) {
      const type = bytes[p]!, size = bytes.readUInt16LE(p + 1), data = bytes.subarray(p + prefix, p + prefix + size);
      if (type === HDF5_MESSAGE.continuation) blocks.push([address(data, 0, label) + 4, address(data, 8, label) - 8]);
      out.push({ type, data, shared: (bytes[p + 3]! & 2) !== 0 });
      p += prefix + size;
    }
  }
  return out;
}

/** A fractal heap's managed objects, by heap ID: where a group keeps its links and an object its attributes once there are many. */
async function fractalHeap(read: Read, at: number, label: string): Promise<{ readonly idLength: number; object(id: Buffer): Buffer }> {
  const head = await read(at, 142);
  if (signature(head) !== 'FRHP' || head[4] !== 0) throw new TypeError(`${label}: no fractal heap at byte ${at}.`);
  if (head.readUInt16LE(7)) throw new TypeError(`${label}: a filtered fractal heap is not read.`);
  const idLength = head.readUInt16LE(5), width = head.readUInt16LE(110), starting = address(head, 112, label), largest = address(head, 120, label);
  const offsetBytes = Math.ceil(head.readUInt16LE(128) / 8), lengthBytes = bytesFor(Math.min(largest, head.readUInt32LE(10))), rows = head.readUInt16LE(140);
  const directRows = Math.log2(largest) - Math.log2(starting) + 2, root = optionalAddress(head, 132, label), blocks: { offset: number; bytes: Buffer }[] = [];
  const direct = async (where: number, size: number) => {
    const bytes = await read(where, size);
    if (signature(bytes) !== 'FHDB') throw new TypeError(`${label}: no heap block at byte ${where}.`);
    blocks.push({ offset: uint(bytes, 13, offsetBytes, label), bytes });
  };
  if (root !== undefined && rows === 0) await direct(root, starting);
  else if (root !== undefined) {
    const bytes = await read(root, 13 + offsetBytes + rows * width * 8);
    if (signature(bytes) !== 'FHIB') throw new TypeError(`${label}: no heap index at byte ${root}.`);
    for (let row = 0, p = 13 + offsetBytes; row < rows; row++) for (let column = 0; column < width; column++, p += 8) {
      const child = optionalAddress(bytes, p, label);
      if (child === undefined) continue;
      if (row >= directRows) throw new TypeError(`${label}: a fractal heap with nested index blocks is not read.`);
      await direct(child, row < 2 ? starting : starting * 2 ** (row - 1));
    }
  }
  return { idLength, object(id) {
    if ((id[0]! & 0x30) !== 0) throw new TypeError(`${label}: a heap object stored outside the heap's blocks is not read.`);
    // A managed object's offset counts through the heap's blocks, their headers included.
    const offset = uint(id, 1, offsetBytes, label), length = uint(id, 1 + offsetBytes, lengthBytes, label);
    const block = blocks.find(entry => offset >= entry.offset && offset + length <= entry.offset + entry.bytes.length);
    if (!block) throw new TypeError(`${label}: the heap at byte ${at} has no block holding ${length} bytes at ${offset}.`);
    return block.bytes.subarray(offset - block.offset, offset - block.offset + length);
  } };
}

/** Every record of a version 2 B-tree, in key order. */
async function btreeRecords(read: Read, at: number, label: string): Promise<{ readonly type: number; readonly records: Buffer[] }> {
  const head = await read(at, 34);
  if (signature(head) !== 'BTHD' || head[4] !== 0) throw new TypeError(`${label}: no version 2 B-tree at byte ${at}.`);
  const type = head[5]!, nodeSize = head.readUInt32LE(6), recordSize = head.readUInt16LE(10), depth = head.readUInt16LE(12), root = optionalAddress(head, 16, label), records: Buffer[] = [];
  // How many records a node of each level can hold sets the width of the counts beside its child pointers.
  const most = [Math.floor((nodeSize - 10) / recordSize)], cumulative = [most[0]!], countBytes = bytesFor(most[0]!);
  const pointerBytes = (level: number) => 8 + countBytes + (level > 1 ? bytesFor(cumulative[level - 1]!) : 0);
  for (let level = 1; level <= depth; level++) {
    most[level] = Math.floor((nodeSize - 10 - pointerBytes(level)) / (recordSize + pointerBytes(level)));
    cumulative[level] = (most[level]! + 1) * cumulative[level - 1]! + most[level]!;
  }
  const node = async (where: number, count: number, level: number): Promise<void> => {
    const bytes = await read(where, nodeSize);
    if (signature(bytes) !== (level ? 'BTIN' : 'BTLF')) throw new TypeError(`${label}: no B-tree node at byte ${where}.`);
    const own = Array.from({ length: count }, (_, i) => bytes.subarray(6 + i * recordSize, 6 + (i + 1) * recordSize));
    if (!level) { records.push(...own); return; }
    for (let child = 0, p = 6 + count * recordSize; child <= count; child++, p += pointerBytes(level)) {
      await node(address(bytes, p, label), uint(bytes, p + 8, countBytes, label), level - 1);
      if (child < count) records.push(own[child]!);
    }
  };
  if (root !== undefined) await node(root, head.readUInt16LE(24), depth);
  return { type, records };
}

/** The objects a fractal heap holds, found through its name index. A record keeps its heap ID after a link's name hash, and first for an attribute. */
async function indexedObjects(read: Read, heapAt: number, indexAt: number, label: string): Promise<Buffer[]> {
  const heap = await fractalHeap(read, heapAt, label), { type, records } = await btreeRecords(read, indexAt, label);
  if (type !== 5 && type !== 8) throw new TypeError(`${label}: the B-tree at byte ${indexAt} is of type ${type}, not a name index.`);
  return records.map(record => heap.object(record.subarray(type === 5 ? 4 : 0, (type === 5 ? 4 : 0) + heap.idLength)));
}

function link(data: Buffer, label: string): [string, number] {
  if (data[0] !== 1) throw new TypeError(`${label}: link message version ${data[0]} is not read.`);
  const flags = data[1]!, type = flags & 0x08 ? data[2]! : 0, sizeBytes = 1 << (flags & 3);
  const sizeAt = 2 + (flags & 0x08 ? 1 : 0) + (flags & 0x04 ? 8 : 0) + (flags & 0x10 ? 1 : 0), length = uint(data, sizeAt, sizeBytes, label);
  const name = data.subarray(sizeAt + sizeBytes, sizeAt + sizeBytes + length).toString('utf8');
  if (type !== 0) throw new TypeError(`${label}: ${name} is a soft or external link, which is not followed.`);
  return [name, address(data, sizeAt + sizeBytes + length, label)];
}

/** A group's members by name, each with its object header's address, from the group's own header messages. */
export async function hdf5GroupMembers(read: Read, messages: readonly Hdf5Message[], label: string): Promise<Map<string, number>> {
  const members = new Map<string, number>();
  const info = messages.find(message => message.type === HDF5_MESSAGE.linkInfo);
  if (!info) throw new TypeError(`${label}: its root group keeps no link information, as a NetCDF-4 file's does.`);
  for (const message of messages) if (message.type === HDF5_MESSAGE.link) members.set(...link(message.data, label));
  const heapAt = optionalAddress(info.data, info.data[1]! & 1 ? 10 : 2, label);
  if (heapAt !== undefined) for (const data of await indexedObjects(read, heapAt, address(info.data, info.data[1]! & 1 ? 18 : 10, label), label)) members.set(...link(data, label));
  return members;
}

/** An object's attribute messages: those in its header, and those its attribute info keeps in a fractal heap. */
export async function hdf5AttributeMessages(read: Read, messages: readonly Hdf5Message[], label: string): Promise<Buffer[]> {
  const out = messages.filter(message => message.type === HDF5_MESSAGE.attribute).map(message => message.data);
  const info = messages.find(message => message.type === HDF5_MESSAGE.attributeInfo);
  const heapAt = info && optionalAddress(info.data, info.data[1]! & 1 ? 4 : 2, label);
  if (info && heapAt !== undefined) out.push(...await indexedObjects(read, heapAt, address(info.data, info.data[1]! & 1 ? 12 : 10, label), label));
  return out;
}

/** One object of a global heap collection: where HDF5 keeps the elements of variable-length values. */
export async function hdf5GlobalHeapObject(read: Read, collection: number, index: number, label: string): Promise<Buffer> {
  const head = await read(collection, 16);
  if (signature(head) !== 'GCOL') throw new TypeError(`${label}: no global heap at byte ${collection}.`);
  const bytes = await read(collection, address(head, 8, label));
  for (let p = 16; p + 16 <= bytes.length;) {
    const id = bytes.readUInt16LE(p), size = address(bytes, p + 8, label);
    if (id === index) return bytes.subarray(p + 16, p + 16 + size);
    if (id === 0) break;
    p += 16 + Math.ceil(size / 8) * 8;
  }
  throw new TypeError(`${label}: the global heap at byte ${collection} holds no object ${index}.`);
}
