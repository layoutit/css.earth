/** PROTOTYPE. A Tecplot binary data file (.plt, written by preplot or TecIO), read without loading it whole: the header and
 * each zone's layout are parsed, and a variable of a zone is read on request from its own byte range. Tecplot's Data Format
 * Guide describes the layout; this covers what BATS-R-US solution files use: block-packed zones, nodal or cell-centred
 * variables in single or double precision, finite-element connectivity after the values.
 *
 * The layout differs between file versions (102 to 112), so the parse checks itself: every zone must start with its
 * marker where the previous one ends, and the last zone must end at the end of the file. */
import { open, type FileHandle } from 'node:fs/promises';

const ZONE_MARKER = 299, END_OF_HEADER = 357;
const NODES_PER_ELEMENT: Record<number, number> = { 1: 2, 2: 3, 3: 4, 4: 4, 5: 8 };
const BYTES_PER_VALUE: Record<number, number> = { 1: 4, 2: 8, 3: 4, 4: 2, 5: 1 };

export interface TecplotZone {
  readonly name: string; readonly zoneType: number; readonly solutionTime: number;
  /** Ordered zones carry their three dimensions; finite-element zones their node and element counts. */
  readonly dimensions?: readonly [number, number, number];
  readonly points: number; readonly elements: number;
  readonly variables: readonly { readonly name: string; readonly format: number; readonly count: number; readonly offset: number; readonly cellCentred: boolean;
    readonly minimum?: number; readonly maximum?: number; readonly absent: boolean }[];
  readonly connectivity?: { readonly offset: number; readonly nodesPerElement: number };
}
export interface TecplotFile { readonly version: number; readonly title: string; readonly variables: readonly string[]; readonly zones: readonly TecplotZone[]; readonly bytes: number }

class Cursor {
  private buffer = Buffer.alloc(0); private bufferStart = 0;
  private readonly file: FileHandle; position: number; private readonly littleEndian: boolean;
  constructor(file: FileHandle, position: number, littleEndian = true) { this.file = file; this.position = position; this.littleEndian = littleEndian; }
  private async need(bytes: number) {
    if (this.position >= this.bufferStart && this.position + bytes <= this.bufferStart + this.buffer.length) return;
    const size = Math.max(bytes, 1 << 16), next = Buffer.alloc(size), { bytesRead } = await this.file.read(next, 0, size, this.position);
    if (bytesRead < bytes) throw new RangeError(`The Tecplot file ends inside a record at byte ${this.position}.`);
    this.buffer = next.subarray(0, bytesRead); this.bufferStart = this.position;
  }
  async int32() { await this.need(4); const value = this.littleEndian ? this.buffer.readInt32LE(this.position - this.bufferStart) : this.buffer.readInt32BE(this.position - this.bufferStart); this.position += 4; return value; }
  async float32() { await this.need(4); const value = this.littleEndian ? this.buffer.readFloatLE(this.position - this.bufferStart) : this.buffer.readFloatBE(this.position - this.bufferStart); this.position += 4; return value; }
  async float64() { await this.need(8); const value = this.littleEndian ? this.buffer.readDoubleLE(this.position - this.bufferStart) : this.buffer.readDoubleBE(this.position - this.bufferStart); this.position += 8; return value; }
  async text() { let out = ''; for (;;) { const code = await this.int32(); if (code === 0) return out; out += String.fromCodePoint(code); if (out.length > 4096) throw new RangeError('A Tecplot string does not end.'); } }
}

interface HeaderZone { name: string; zoneType: number; solutionTime: number; dimensions?: [number, number, number]; points: number; elements: number; cellCentred: boolean[]; pointPacked: boolean }

async function readHeader(file: FileHandle) {
  const magic = Buffer.alloc(8); await file.read(magic, 0, 8, 0);
  const signature = magic.toString('latin1'), version = Number(signature.slice(5));
  if (!signature.startsWith('#!TDV') || !(version >= 102 && version <= 112)) throw new TypeError(`Not a Tecplot binary file of versions 102 to 112: ${JSON.stringify(signature)}.`);
  const order = Buffer.alloc(4); await file.read(order, 0, 4, 8);
  const littleEndian = order.readInt32LE(0) === 1;
  if (!littleEndian && order.readInt32BE(0) !== 1) throw new TypeError('The Tecplot byte-order mark is neither 1 nor its byte swap.');
  const cursor = new Cursor(file, 12, littleEndian);
  if (version >= 109) await cursor.int32(); // file type: full, grid or solution
  const title = await cursor.text(), count = await cursor.int32();
  if (!(count > 0 && count < 1000)) throw new RangeError(`Implausible Tecplot variable count ${count}.`);
  const variables: string[] = []; for (let i = 0; i < count; i++) variables.push(await cursor.text());
  const zones: HeaderZone[] = [];
  for (;;) {
    const marker = await cursor.float32();
    if (marker === END_OF_HEADER) break;
    if (marker !== ZONE_MARKER) throw new TypeError(`Tecplot header record ${marker} at byte ${cursor.position - 4} is not a zone; geometries, text and auxiliary records are not read.`);
    const name = await cursor.text();
    let solutionTime = 0;
    if (version >= 107) { await cursor.int32(); await cursor.int32(); solutionTime = await cursor.float64(); }
    await cursor.int32(); // unused (formerly the zone's color)
    const zoneType = await cursor.int32();
    const pointPacked = version < 112 ? await cursor.int32() === 1 : false;
    const cellCentred = variables.map(() => false);
    if (await cursor.int32() === 1) for (let i = 0; i < count; i++) cellCentred[i] = await cursor.int32() === 1;
    if (version >= 108) await cursor.int32(); // raw local one-to-one face neighbours supplied
    const miscellaneous = await cursor.int32();
    if (miscellaneous !== 0) { await cursor.int32(); if (zoneType !== 0) await cursor.int32(); }
    const zone: HeaderZone = { name, zoneType, solutionTime, points: 0, elements: 0, cellCentred, pointPacked };
    if (zoneType === 0) { const i = await cursor.int32(), j = await cursor.int32(), k = await cursor.int32(); zone.dimensions = [i, j, k]; zone.points = i * j * k;
      zone.elements = Math.max(1, i - 1) * Math.max(1, j - 1) * Math.max(1, k - 1); }
    else {
      zone.points = await cursor.int32();
      if (zoneType === 6 || zoneType === 7) throw new TypeError('Polygonal and polyhedral Tecplot zones are not read.');
      zone.elements = await cursor.int32(); await cursor.int32(); await cursor.int32(); await cursor.int32();
    }
    while (await cursor.int32() === 1) { await cursor.text(); await cursor.int32(); await cursor.text(); }
    zones.push(zone);
  }
  return { version, title, variables, zones, dataStart: cursor.position, littleEndian };
}

/** Parse the file's header and the layout of every zone's values. */
export async function openTecplot(path: string): Promise<TecplotFile & { readonly path: string; readonly littleEndian: boolean }> {
  const file = await open(path, 'r');
  try {
    const { size } = await file.stat(), header = await readHeader(file), cursor = new Cursor(file, header.dataStart, header.littleEndian);
    const zones: TecplotZone[] = [];
    for (const [index, zone] of header.zones.entries()) {
      const marker = await cursor.float32();
      if (marker !== ZONE_MARKER) throw new TypeError(`Zone ${index} (${zone.name}) does not start with its marker at byte ${cursor.position - 4}: found ${marker}.`);
      if (zone.pointPacked) throw new TypeError('Point-packed Tecplot zones are not read.');
      const formats: number[] = []; for (let i = 0; i < header.variables.length; i++) formats.push(await cursor.int32());
      const passive = header.variables.map(() => false), shared = header.variables.map(() => -1);
      if (await cursor.int32() === 1) for (let i = 0; i < passive.length; i++) passive[i] = await cursor.int32() === 1;
      if (await cursor.int32() === 1) for (let i = 0; i < shared.length; i++) shared[i] = await cursor.int32();
      const sharedConnectivity = await cursor.int32();
      const stored = header.variables.map((_, i) => !passive[i] && shared[i] === -1);
      const ranges: ([number, number] | undefined)[] = [];
      for (let i = 0; i < stored.length; i++) ranges.push(stored[i] ? [await cursor.float64(), await cursor.float64()] : undefined);
      let offset = cursor.position;
      const variables = header.variables.map((name, i) => {
        const count = zone.cellCentred[i] ? zone.elements : zone.points, width = BYTES_PER_VALUE[formats[i]!];
        if (width === undefined) throw new TypeError(`Variable ${name} has the unread Tecplot format ${formats[i]}.`);
        const entry = { name, format: formats[i]!, count, offset, cellCentred: zone.cellCentred[i]!, absent: !stored[i],
          ...(ranges[i] ? { minimum: ranges[i]![0], maximum: ranges[i]![1] } : {}) };
        if (stored[i]) offset += count * width;
        return entry;
      });
      let connectivity: TecplotZone['connectivity'];
      if (zone.zoneType !== 0 && sharedConnectivity === -1) {
        const nodesPerElement = NODES_PER_ELEMENT[zone.zoneType];
        if (nodesPerElement === undefined) throw new TypeError(`Unread Tecplot zone type ${zone.zoneType}.`);
        connectivity = { offset, nodesPerElement }; offset += zone.elements * nodesPerElement * 4;
      }
      cursor.position = offset;
      zones.push({ name: zone.name, zoneType: zone.zoneType, solutionTime: zone.solutionTime, ...(zone.dimensions ? { dimensions: zone.dimensions } : {}),
        points: zone.points, elements: zone.elements, variables, ...(connectivity ? { connectivity } : {}) });
    }
    if (cursor.position !== size) throw new RangeError(`The Tecplot zones end at byte ${cursor.position} but the file has ${size}: the layout was not understood.`);
    return { path, version: header.version, title: header.title, variables: header.variables, zones, bytes: size, littleEndian: header.littleEndian };
  } finally { await file.close(); }
}

/** One variable of one zone, as 32-bit floats. */
export async function readTecplotVariable(file: TecplotFile & { readonly path: string; readonly littleEndian: boolean }, zoneIndex: number, name: string): Promise<Float32Array> {
  const zone = file.zones[zoneIndex], variable = zone?.variables.find(entry => entry.name === name);
  if (!zone || !variable) throw new RangeError(`Zone ${zoneIndex} has no variable ${JSON.stringify(name)}; it has ${file.variables.map(entry => JSON.stringify(entry)).join(', ')}.`);
  if (variable.absent) throw new RangeError(`Variable ${name} is passive or shared in zone ${zoneIndex}.`);
  if (!file.littleEndian) throw new TypeError('Big-endian Tecplot values are not read.');
  const width = BYTES_PER_VALUE[variable.format]!, handle = await open(file.path, 'r');
  try {
    const out = new Float32Array(variable.count), chunkValues = 1 << 20, chunk = Buffer.alloc(chunkValues * width);
    for (let done = 0; done < variable.count; done += chunkValues) {
      const values = Math.min(chunkValues, variable.count - done), { bytesRead } = await handle.read(chunk, 0, values * width, variable.offset + done * width);
      if (bytesRead !== values * width) throw new RangeError(`Short read of ${name}.`);
      if (variable.format === 1) out.set(new Float32Array(chunk.buffer, chunk.byteOffset, values), done);
      else if (variable.format === 2) { const doubles = new Float64Array(chunk.buffer, chunk.byteOffset, values); for (let i = 0; i < values; i++) out[done + i] = doubles[i]!; }
      else throw new TypeError(`Variable ${name} is stored as integers (format ${variable.format}).`);
    }
    return out;
  } finally { await handle.close(); }
}
