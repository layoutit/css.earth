#!/usr/bin/env node
/** Read a Chandra event list: the EVENTS binary table of a level-1 or level-2 event file.
 *
 * The repository's shared binary-table reader (../interferometry/fits-table.mts) is used for everything it covers, but it does
 * not read bit columns, and every Chandra event list carries its status as one (`32X` for ACIS, `16X` for HRC). So the column
 * layout is parsed here, over the HDU bounds that reader already checks, and a bit column reads as the unsigned integer its bits
 * spell, most significant first, which is how the CIAO tools and the status filters state it.
 *
 * A column whose TSCAL or TZERO would change its values is refused, as it is there: an event list states none.
 *
 * Nothing here decompresses. A `.fits.gz` is expanded to a file first (gunzipFile), because an event list is tens to hundreds of
 * megabytes and both sides of a comparison are held at once. */
import { createGunzip } from 'node:zlib';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { stat } from 'node:fs/promises';
import { readFitsHdus, type FitsHdu } from '../interferometry/fits-table.mts';

/** Bytes a cell of each form takes; `X` is counted in bits, so it is handled apart. */
const TYPE_BYTES: Readonly<Record<string, number>> = { L: 1, B: 1, I: 2, J: 4, K: 8, A: 1, E: 4, D: 8 };
const FORM = /^(\d*)([LBIJKAEDX])$/u;

export interface EventColumn {
  readonly name: string;
  readonly form: string;
  /** Values a cell holds; for a bit column, the bits it holds. */
  readonly repeat: number;
  readonly type: 'L' | 'B' | 'I' | 'J' | 'K' | 'A' | 'E' | 'D' | 'X';
  readonly offset: number;
  readonly bytes: number;
  readonly unit?: string;
}
export interface EventTable {
  readonly hdu: FitsHdu;
  readonly columns: readonly EventColumn[];
  readonly rows: number;
  readonly rowBytes: number;
}

/** The EVENTS extension of an event file, with its column layout. */
export function eventTable(bytes: Buffer): EventTable {
  // CIAO writes the extension as `events` where standard data processing writes `EVENTS`, so the name is matched without case.
  const hdu = readFitsHdus(bytes).find(entry => entry.extname.toUpperCase() === 'EVENTS');
  if (!hdu) throw new Error('The file holds no EVENTS extension.');
  if (hdu.header.XTENSION !== 'BINTABLE') throw new Error('EVENTS is not a binary table.');
  const fields = Number(hdu.header.TFIELDS), rowBytes = Number(hdu.header.NAXIS1), rows = Number(hdu.header.NAXIS2);
  if (!Number.isSafeInteger(fields) || !Number.isSafeInteger(rowBytes) || !Number.isSafeInteger(rows)) throw new Error('EVENTS states no shape.');
  const columns: EventColumn[] = [];
  let offset = 0;
  for (let index = 1; index <= fields; index++) {
    const form = String(hdu.header[`TFORM${index}`]).trim(), match = FORM.exec(form);
    if (!match) throw new Error(`Unsupported event column form ${form}.`);
    const type = match[2] as EventColumn['type'], repeat = match[1] ? Number(match[1]) : 1;
    const scale = hdu.header[`TSCAL${index}`] ?? 1, zero = hdu.header[`TZERO${index}`] ?? 0;
    if (scale !== 1 || zero !== 0) throw new Error(`Event column ${index} states a TSCAL or TZERO; an event list carries none.`);
    const width = type === 'X' ? Math.ceil(repeat / 8) : repeat * TYPE_BYTES[type]!;
    const unit = hdu.header[`TUNIT${index}`];
    columns.push({ name: String(hdu.header[`TTYPE${index}`]).trim(), form, repeat, type, offset, bytes: width,
      ...(typeof unit === 'string' && unit.trim() ? { unit: unit.trim() } : {}) });
    offset += width;
  }
  if (offset !== rowBytes) throw new Error(`The event row is ${rowBytes} bytes, its columns ${offset}.`);
  // sso_freeze appends its object-centred columns to whatever it is given, so a file it was run on twice carries two `ocx`.
  // A repeated name would make every read of it ambiguous, so it is refused rather than resolved to the first.
  const repeated = columns.map(entry => entry.name).filter((name, index, all) => all.indexOf(name) !== index);
  if (repeated.length) throw new Error(`The event list repeats the column ${[...new Set(repeated)].join(', ')}.`);
  if (hdu.dataBytes < rows * rowBytes) throw new Error('The EVENTS data block is shorter than its rows.');
  return { hdu, columns, rows, rowBytes };
}

export const eventColumn = (table: EventTable, name: string) => table.columns.find(column => column.name === name);
export function requireEventColumn(table: EventTable, name: string): EventColumn {
  const column = eventColumn(table, name);
  if (!column) throw new Error(`The event list has no ${name} column.`);
  return column;
}

/** The scalar value of one cell. A bit column reads as the unsigned integer its bits spell, most significant bit first. A column
 * that holds more than one value a row is not a scalar and is refused; no Chandra event column is one. */
export function scalar(bytes: Buffer, table: EventTable, row: number, column: EventColumn): number {
  const at = table.hdu.dataOffset + row * table.rowBytes + column.offset;
  if (column.type === 'X') {
    if (column.repeat > 53) throw new Error(`${column.name} holds ${column.repeat} bits, more than one number states.`);
    let value = 0;
    for (let index = 0; index < column.bytes; index++) value = value * 256 + bytes[at + index]!;
    return value;
  }
  if (column.repeat !== 1) throw new Error(`${column.name} holds ${column.repeat} values a row.`);
  switch (column.type) {
    case 'L': return bytes[at] === 0x54 ? 1 : 0;
    case 'B': return bytes.readUInt8(at);
    case 'I': return bytes.readInt16BE(at);
    case 'J': return bytes.readInt32BE(at);
    case 'K': return Number(bytes.readBigInt64BE(at));
    case 'E': return bytes.readFloatBE(at);
    case 'D': return bytes.readDoubleBE(at);
    default: throw new Error(`${column.name} is a character column, not a number.`);
  }
}

/** One column read whole, as a typed array: what a comparison walks. */
export function column(bytes: Buffer, table: EventTable, name: string): Float64Array {
  const found = requireEventColumn(table, name), values = new Float64Array(table.rows);
  for (let row = 0; row < table.rows; row++) values[row] = scalar(bytes, table, row, found);
  return values;
}

/** Expand a `.fits.gz` beside itself, as a stream, so nothing larger than a chunk is held. Returns the expanded file's path and
 * size; an already-expanded file of the same name is reused. */
export async function gunzipFile(path: string): Promise<{ path: string; bytes: number }> {
  if (!path.endsWith('.gz')) return { path, bytes: (await stat(path)).size };
  const target = path.slice(0, -'.gz'.length);
  const existing = await stat(target).then(info => info.size, () => -1);
  if (existing < 0) await pipeline(createReadStream(path), createGunzip(), createWriteStream(target));
  return { path: target, bytes: (await stat(target)).size };
}
