/**
 * A chunked variable's values, as the NetCDF-4 library stores a variable with an unlimited dimension or chunk sizes of its
 * own: a version 3 data layout message names a version 1 B-tree whose leaves point at each chunk (HDF5 file format
 * specification, "Data Layout Message" and "Version 1 B-trees", https://docs.hdfgroup.org/hdf5/v1_14/_f_m_t3.html).
 * ALERA-V's analysis of the Venus atmosphere keeps one time step of each field per chunk, so one map is one run of bytes
 * inside one chunk.
 *
 * Chunks are read unfiltered, from their own bytes: a variable with a filter pipeline (compression, shuffling) is refused
 * before this is reached, and a chunk stored in other than its full size is refused here. A chunk the file never wrote
 * holds the variable's fill value, as HDF5 reads it.
 */
import { address, type Read } from './hdf5-objects.ts';

export interface ChunkLayout {
  /** The B-tree that indexes the chunks. */
  readonly tree: number;
  /** A chunk's length along each of the variable's dimensions. */
  readonly chunk: readonly number[];
  readonly elementBytes: number;
}
interface Chunk { readonly at: number; readonly bytes: number }
export type ChunkIndex = ReadonlyMap<string, Chunk>;

const product = (lengths: readonly number[]) => lengths.reduce((total, length) => total * length, 1);
const strides = (lengths: readonly number[]) => lengths.map((_, d) => product(lengths.slice(d + 1)));

/** A version 3 chunked layout: its dimensionality (the variable's rank plus the element), the B-tree's address, then each
 * dimension's chunk length and the element's bytes last. */
export function chunkLayout(layout: Buffer, rank: number, label: string): ChunkLayout {
  if (layout[0] !== 3 || layout[1] !== 2) throw new TypeError(`${label}: data layout version ${layout[0]} class ${layout[1]} is not a version 3 chunked layout.`);
  if (layout[2] !== rank + 1) throw new TypeError(`${label}: its chunks have ${layout[2]! - 1} dimensions and the variable ${rank}.`);
  const lengths = Array.from({ length: rank + 1 }, (_, i) => layout.readUInt32LE(11 + 4 * i));
  return { tree: address(layout, 3, label), chunk: lengths.slice(0, rank), elementBytes: lengths[rank]! };
}

/** Every chunk the file wrote, by the index of its first element along each dimension ('0,0,0'). A node holds its entries
 * as key, child, key, child ... key; a chunk's key is its stored size, its filter mask and its offsets. */
export async function chunkIndex(read: Read, layout: ChunkLayout, label: string): Promise<ChunkIndex> {
  const keyBytes = 8 + 8 * (layout.chunk.length + 1), index = new Map<string, Chunk>();
  const node = async (at: number): Promise<void> => {
    const head = await read(at, 24);
    if (head.toString('latin1', 0, 4) !== 'TREE' || head[4] !== 1) throw new TypeError(`${label}: no chunk B-tree node at byte ${at}.`);
    const level = head[5]!, used = head.readUInt16LE(6), body = await read(at + 24, used * (keyBytes + 8) + keyBytes);
    for (let entry = 0; entry < used; entry++) {
      const key = entry * (keyBytes + 8), child = address(body, key + keyBytes, label);
      if (level > 0) { await node(child); continue; }
      const offsets = layout.chunk.map((_, d) => address(body, key + 8 + 8 * d, label));
      index.set(offsets.join(','), { at: child, bytes: body.readUInt32LE(key) });
    }
  };
  await node(layout.tree);
  return index;
}

/** `count` stored values from the `start`-th in storage order (the last dimension varying fastest), as bytes: each run
 * along the last dimension is read from the chunk that holds it. `fill` is the stored bytes of one fill value. */
export async function chunkedBytes(read: Read, layout: ChunkLayout, index: ChunkIndex, shape: readonly number[], start: number, count: number, fill: Buffer | undefined, label: string): Promise<Buffer> {
  const size = layout.elementBytes, out = Buffer.alloc(count * size), across = strides(shape), within = strides(layout.chunk), last = shape.length - 1;
  const full = product(layout.chunk) * size;
  for (let done = 0; done < count;) {
    const at = shape.map((length, d) => Math.floor((start + done) / across[d]!) % length);
    const origin = at.map((value, d) => value - (value % layout.chunk[d]!)), edge = layout.chunk[last]!;
    const run = Math.min(count - done, shape[last]! - at[last]!, edge - (at[last]! % edge));
    const chunk = index.get(origin.join(','));
    if (!chunk) {
      if (!fill) throw new TypeError(`${label}: the chunk at ${origin.join(', ')} was never written, and the variable has no fill value.`);
      for (let i = 0; i < run; i++) fill.copy(out, (done + i) * size);
    } else {
      if (chunk.bytes !== full) throw new TypeError(`${label}: the chunk at ${origin.join(', ')} is stored in ${chunk.bytes} bytes, not its full ${full}: a filtered chunk is not read.`);
      const offset = at.reduce((sum, value, d) => sum + (value - origin[d]!) * within[d]!, 0);
      (await read(chunk.at + offset * size, run * size)).copy(out, done * size);
    }
    done += run;
  }
  return out;
}
