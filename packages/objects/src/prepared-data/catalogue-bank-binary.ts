import type { PreparedBinaryRegion } from '../prepared-binary.js';

/**
 * A published catalogue point bank as the app fetches it (`<id>.bin`, packed by prepared-binary.ts): the bank's JSON
 * fields in a header and its points and cells as typed columns. It decodes to the same object the bank's JSON was, so
 * one parser reads both. Every published bank writes positions to four decimals, so a position travels as an Int32
 * count of 1e-4 units and decodes, by one division, to the same number; the encoder refuses any value that would not.
 * On the published banks (2026-09-30) this moved the quasar bank from 627,739 bytes as the asset host serves its JSON
 * (Brotli) to 439,630, and the Milky Way's dots from 344,478 to 256,636.
 *
 * Layout: magic `CSCPTS01`, u32 header byte length, the UTF-8 JSON header, then 8-byte-aligned columns: cell boxes
 * (Float64, six per cell), x, y and z (Int32), each point's cell (Uint16 or Uint32) and palette index (Uint8 or Uint16,
 * only for a bank with a palette). The header's `columns` says how many of each and how wide.
 */
export const CATALOGUE_BANK_BINARY_MAGIC = 'CSCPTS01';
export const CATALOGUE_POSITION_SCALE = 10_000;

type Row = readonly number[];
interface Columns { readonly points: number; readonly width: 3 | 4; readonly cells: number; readonly cellBytes: 2 | 4; readonly paletteBytes: 1 | 2 }
const align = (value: number) => value + (8 - value % 8) % 8;

function layout(headerBytes: number, columns: Columns) {
  const { points, width, cells, cellBytes, paletteBytes } = columns;
  let offset = align(12 + headerBytes);
  const section = (bytes: number, elementBytes: number): PreparedBinaryRegion => { const region = { offset, bytes, elementBytes }; offset = align(offset + bytes); return region; };
  const boxes = section(cells * 48, 8), x = section(points * 4, 4), y = section(points * 4, 4), z = section(points * 4, 4);
  const of = section(points * cellBytes, cellBytes), palette = width === 4 ? section(points * paletteBytes, paletteBytes) : null;
  return { boxes, x, y, z, of, palette, bytes: offset };
}

/** A published bank's bytes and typed regions, ready for packPreparedBinary. `bank` is the bank as its JSON would be:
 * `points` rows of x, y, z (and a palette index) and `cells` of { boxes, of }. */
export function encodeCatalogueBankBinary(bank: Readonly<Record<string, unknown>>, at: string): { readonly bytes: Uint8Array; readonly regions: readonly PreparedBinaryRegion[] } {
  const { points, cells, ...fields } = bank;
  const fail = (why: string): never => { throw new TypeError(`${at}: ${why}`); };
  if (!Array.isArray(points) || !points.length) fail('a published bank needs points.');
  const rows = points as Row[], width = rows[0]!.length;
  if (width !== 3 && width !== 4) fail(`points are x, y, z and an optional palette index, got ${width} values.`);
  const cellRecord = cells as { boxes?: unknown; of?: unknown } | undefined;
  if (!cellRecord || !Array.isArray(cellRecord.boxes) || !Array.isArray(cellRecord.of) || cellRecord.of.length !== rows.length) fail('a published bank needs its cells, one per point.');
  const boxes = cellRecord!.boxes as Row[], cellOf = cellRecord!.of as number[];
  const palette = width === 4 ? Math.max(...rows.map(row => row[3]!)) : 0;
  const columns: Columns = { points: rows.length, width: width as 3 | 4, cells: boxes.length, cellBytes: boxes.length <= 0x10000 ? 2 : 4, paletteBytes: palette < 0x100 ? 1 : 2 };
  const header = new TextEncoder().encode(JSON.stringify({ ...fields, columns }));
  const place = layout(header.byteLength, columns), bytes = new Uint8Array(place.bytes), view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode(CATALOGUE_BANK_BINARY_MAGIC), 0);
  view.setUint32(8, header.byteLength, true);
  bytes.set(header, 12);
  boxes.forEach((box, cell) => {
    if (!Array.isArray(box) || box.length !== 6) fail(`cell box ${cell} must be six numbers.`);
    box.forEach((value, index) => view.setFloat64(place.boxes.offset + (cell * 6 + index) * 8, value, true));
  });
  const axes = [place.x, place.y, place.z];
  rows.forEach((row, index) => {
    if (!Array.isArray(row) || row.length !== width) fail(`point ${index} must have ${width} values like the first, got ${JSON.stringify(row)}.`);
    for (let axis = 0; axis < 3; axis++) {
      const value = row[axis]!, count = Math.round(value * CATALOGUE_POSITION_SCALE);
      if (!(Math.abs(count) <= 0x7fffffff) || count / CATALOGUE_POSITION_SCALE !== value) {
        fail(`point ${index} axis ${'xyz'[axis]} is ${value}, which is not a whole number of 1e-4 units within Int32 range, so it would not decode to itself.`);
      }
      view.setInt32(axes[axis]!.offset + index * 4, count, true);
    }
    const cell = cellOf[index]!;
    if (!Number.isInteger(cell) || cell < 0 || cell >= boxes.length) fail(`point ${index} names cell ${cell}, outside its ${boxes.length} boxes.`);
    if (columns.cellBytes === 2) view.setUint16(place.of.offset + index * 2, cell, true); else view.setUint32(place.of.offset + index * 4, cell, true);
    if (place.palette) {
      const colour = row[3]!;
      if (!Number.isInteger(colour) || colour < 0) fail(`point ${index} names palette colour ${colour}.`);
      if (columns.paletteBytes === 1) view.setUint8(place.palette.offset + index, colour); else view.setUint16(place.palette.offset + index * 2, colour, true);
    }
  });
  return { bytes, regions: [place.boxes, place.x, place.y, place.z, place.of, ...(place.palette ? [place.palette] : [])] };
}

/** A published bank's original JSON fields, points and cells, from its unpacked bytes. */
export function decodeCatalogueBankBinary(buffer: ArrayBuffer, at: string): Record<string, unknown> {
  const fail = (why: string): never => { throw new TypeError(`${at}: ${why}`); };
  const bytes = new Uint8Array(buffer), view = new DataView(buffer);
  if (bytes.byteLength < 12 || new TextDecoder().decode(bytes.subarray(0, 8)) !== CATALOGUE_BANK_BINARY_MAGIC) fail(`not a catalogue point bank (expected magic ${CATALOGUE_BANK_BINARY_MAGIC}).`);
  const headerBytes = view.getUint32(8, true);
  if (12 + headerBytes > bytes.byteLength) fail(`its header claims ${headerBytes} bytes of a ${bytes.byteLength}-byte file.`);
  const header = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(12, 12 + headerBytes))) as Record<string, unknown>;
  const { columns: raw, ...fields } = header;
  const columns = raw as Partial<Columns> | undefined;
  const whole = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0;
  if (!columns || !whole(columns.points) || (columns.width !== 3 && columns.width !== 4) || !whole(columns.cells) ||
      (columns.cellBytes !== 2 && columns.cellBytes !== 4) || (columns.paletteBytes !== 1 && columns.paletteBytes !== 2)) {
    fail(`its header columns must give points, width 3 or 4, cells, cellBytes 2 or 4 and paletteBytes 1 or 2, got ${JSON.stringify(columns)}.`);
  }
  const place = layout(headerBytes, columns as Columns);
  if (place.bytes !== bytes.byteLength) fail(`its columns take ${place.bytes} bytes; the file holds ${bytes.byteLength}.`);
  const { points: count, width, cells, cellBytes, paletteBytes } = columns as Columns;
  const boxes = Array.from({ length: cells }, (_, cell) => Array.from({ length: 6 }, (_, index) => view.getFloat64(place.boxes.offset + (cell * 6 + index) * 8, true)));
  const of = new Array<number>(count), points = new Array<number[]>(count);
  for (let index = 0; index < count; index++) {
    const row = [view.getInt32(place.x.offset + index * 4, true) / CATALOGUE_POSITION_SCALE, view.getInt32(place.y.offset + index * 4, true) / CATALOGUE_POSITION_SCALE,
      view.getInt32(place.z.offset + index * 4, true) / CATALOGUE_POSITION_SCALE];
    if (width === 4) row.push(paletteBytes === 1 ? view.getUint8(place.palette!.offset + index) : view.getUint16(place.palette!.offset + index * 2, true));
    points[index] = row;
    of[index] = cellBytes === 2 ? view.getUint16(place.of.offset + index * 2, true) : view.getUint32(place.of.offset + index * 4, true);
  }
  return { ...fields, points, cells: { boxes, of } };
}
