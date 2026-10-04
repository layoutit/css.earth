import { decodePreparedBank, encodePreparedBank, preparedBankColumn, type PreparedBank } from '../../prepared-bank.js';
import type { PreparedBinaryRegion } from '../../prepared-binary.js';

/**
 * A published catalogue point bank as the app fetches it (`<id>.bin`): a prepared bank (prepared-bank.ts) whose header
 * holds the bank's JSON fields and whose columns hold its points and cells. Every published bank writes positions to
 * four decimals, so a position travels as an Int32 count of 1e-4 units and decodes, by one division, to the same number;
 * the encoder refuses any value that would not. On the published banks (2026-09-30) this moved the quasar bank from
 * 627,739 bytes as the asset host serves its JSON (Brotli) to 439,630, and the Milky Way's dots from 344,478 to 256,636.
 *
 * Columns: `boxes` (Float64, six bounds per cell), `x`, `y` and `z` (Int32), `cell` (each point's cell, Uint16 or Uint32)
 * and, for a bank with a palette, `palette` (each point's index into it, Uint8 or Uint16). The page reads the columns as
 * they are (catalogue-point-columns.ts); a preparation reads the bank back as the object its JSON was.
 */
export const CATALOGUE_POINTS_BINARY_SCHEMA = 'cssearth-catalogue-points-bin@2';
export const CATALOGUE_POSITION_SCALE = 10_000;

type Row = readonly number[];

/** A published bank as a prepared bank. `bank` is the bank as its JSON would be: `points` rows of x, y, z (and a palette
 * index) and `cells` of { boxes, of }. */
export function catalogueBankColumns(bank: Readonly<Record<string, unknown>>, at: string): PreparedBank {
  const { points, cells, ...fields } = bank;
  const fail = (why: string): never => { throw new TypeError(`${at}: ${why}`); };
  if (!Array.isArray(points) || !points.length) fail('a published bank needs points.');
  const rows = points as Row[], width = rows[0]!.length;
  if (width !== 3 && width !== 4) fail(`points are x, y, z and an optional palette index, got ${width} values.`);
  const cellRecord = cells as { boxes?: unknown; of?: unknown } | undefined;
  if (!cellRecord || !Array.isArray(cellRecord.boxes) || !Array.isArray(cellRecord.of) || cellRecord.of.length !== rows.length) fail('a published bank needs its cells, one per point.');
  const boxRows = cellRecord!.boxes as Row[], cellOf = cellRecord!.of as number[];
  const boxes = new Float64Array(boxRows.length * 6), axes = [new Int32Array(rows.length), new Int32Array(rows.length), new Int32Array(rows.length)];
  const cell = boxRows.length <= 0x10000 ? new Uint16Array(rows.length) : new Uint32Array(rows.length);
  const colors = width === 4 ? rows.map(row => row[3]!) : null;
  const palette = colors ? (Math.max(...colors) < 0x100 ? new Uint8Array(rows.length) : new Uint16Array(rows.length)) : null;
  boxRows.forEach((box, index) => {
    if (!Array.isArray(box) || box.length !== 6) fail(`cell box ${index} must be six numbers.`);
    boxes.set(box, index * 6);
  });
  rows.forEach((row, index) => {
    if (!Array.isArray(row) || row.length !== width) fail(`point ${index} must have ${width} values like the first, got ${JSON.stringify(row)}.`);
    for (let axis = 0; axis < 3; axis++) {
      const value = row[axis]!, count = Math.round(value * CATALOGUE_POSITION_SCALE);
      if (!(Math.abs(count) <= 0x7fffffff) || count / CATALOGUE_POSITION_SCALE !== value) {
        fail(`point ${index} axis ${'xyz'[axis]} is ${value}, which is not a whole number of 1e-4 units within Int32 range, so it would not decode to itself.`);
      }
      axes[axis]![index] = count;
    }
    const own = cellOf[index]!;
    if (!Number.isInteger(own) || own < 0 || own >= boxRows.length) fail(`point ${index} names cell ${own}, outside its ${boxRows.length} boxes.`);
    cell[index] = own;
    if (palette) {
      const color = row[3]!;
      if (!Number.isInteger(color) || color < 0) fail(`point ${index} names palette color ${color}.`);
      palette[index] = color;
    }
  });
  return { schema: CATALOGUE_POINTS_BINARY_SCHEMA, fields, columns: { boxes, x: axes[0]!, y: axes[1]!, z: axes[2]!, cell, ...(palette ? { palette } : {}) } };
}

/** A published bank's bytes and typed regions, ready for packPreparedBinary. */
export function encodeCatalogueBankBinary(bank: Readonly<Record<string, unknown>>, at: string): { readonly bytes: Uint8Array; readonly regions: readonly PreparedBinaryRegion[] } {
  return encodePreparedBank(catalogueBankColumns(bank, at), at);
}

/** The columns of a published bank's file, each checked for its type and its length. */
export function catalogueBankFileColumns(bank: PreparedBank, at: string) {
  if (bank.schema !== CATALOGUE_POINTS_BINARY_SCHEMA) throw new TypeError(`${at}: not a catalogue point bank (expected ${CATALOGUE_POINTS_BINARY_SCHEMA}, got ${bank.schema}).`);
  const x = preparedBankColumn(bank, 'x', 'i32', undefined, at), count = x.length;
  const boxes = preparedBankColumn(bank, 'boxes', 'f64', undefined, at);
  if (!boxes.length || boxes.length % 6 !== 0) throw new TypeError(`${at}: its boxes column holds ${boxes.length} values, which is not six bounds a cell.`);
  return { count, x, y: preparedBankColumn(bank, 'y', 'i32', count, at), z: preparedBankColumn(bank, 'z', 'i32', count, at), boxes,
    cell: preparedBankColumn(bank, 'cell', ['u16', 'u32'], count, at),
    palette: bank.columns.palette === undefined ? null : preparedBankColumn(bank, 'palette', ['u8', 'u16'], count, at) };
}

/** A published bank's original JSON fields, points and cells, from its unpacked bytes: what a preparation reads. */
export function decodeCatalogueBankBinary(buffer: ArrayBuffer, at: string): Record<string, unknown> {
  const bank = decodePreparedBank(buffer, at), { count, x, y, z, boxes, cell, palette } = catalogueBankFileColumns(bank, at);
  const points = new Array<number[]>(count);
  for (let index = 0; index < count; index++) {
    const row = [x[index]! / CATALOGUE_POSITION_SCALE, y[index]! / CATALOGUE_POSITION_SCALE, z[index]! / CATALOGUE_POSITION_SCALE];
    if (palette) row.push(palette[index]!);
    points[index] = row;
  }
  return { ...bank.fields, points, cells: { boxes: Array.from({ length: boxes.length / 6 }, (_, index) => [...boxes.subarray(index * 6, index * 6 + 6)]), of: [...cell] } };
}
