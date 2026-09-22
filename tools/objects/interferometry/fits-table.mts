/** Binary tables (OIFITS) read with the standard's own byte layout: 2880-byte blocks, 80-character cards,
 * big-endian columns whose TFORM states a repeat count and a type. No heap (variable-length) columns are read. Complex columns
 * (C single, M double precision; OIFITS 2 VISDATA and VISERR) read as real and imaginary pairs, so a table that carries them,
 * as AMBER and GRAVITY files do, can be read and rewritten. Headers and HDU bounds come from tools/fits.mts. */
import { readFitsHdus as readSharedHdus, type FitsHeader } from '../../fits/fits.mts';
/** One HDU as tools/fits/fits.mts reads it: its header (ESO HIERARCH keywords as "ESO DET NAME" style keys), where its header and data start,
 * and how many data bytes it holds before padding. */
export interface FitsHdu { readonly header: FitsHeader; readonly headerOffset: number; readonly dataOffset: number; readonly dataBytes: number; readonly extname: string }
/** `nullValue` is the column's TNULL, read back as NaN. A column whose TSCAL or TZERO changes its values is refused when read or written. */
export interface TableColumn { readonly name: string; readonly repeat: number; readonly type: 'D' | 'E' | 'I' | 'J' | 'K' | 'L' | 'A' | 'B' | 'C' | 'M'; readonly offset: number; readonly bytes: number;
  readonly scaled?: true; readonly nullValue?: number }
export interface BinaryTable { readonly hdu: FitsHdu; readonly columns: readonly TableColumn[]; readonly rows: number; readonly rowBytes: number }

const BLOCK = 2880, CARD = 80;
/** Bytes per cell; a complex cell is two floating-point numbers. */
const TYPE_BYTES = { D: 8, E: 4, I: 2, J: 4, K: 8, L: 1, A: 1, B: 1, C: 8, M: 16 } as const;
const FORM = /^(\d*)([DEIJKLABCM])$/;

/** Every HDU in the file, read and bounds-checked by the repository's one FITS reader. */
export function readFitsHdus(bytes: Buffer): FitsHdu[] {
  let headerOffset = 0;
  return readSharedHdus(bytes).map((hdu, index) => {
    const extname = typeof hdu.header.EXTNAME === 'string' ? hdu.header.EXTNAME : index === 0 ? 'PRIMARY' : '';
    const read = { header: hdu.header, headerOffset, dataOffset: hdu.dataOffset, dataBytes: hdu.dataBytes, extname };
    headerOffset = hdu.nextOffset;
    return read;
  });
}

export function binaryTable(hdu: FitsHdu): BinaryTable {
  if (hdu.header.XTENSION !== 'BINTABLE') throw new Error(`${hdu.extname} is not a binary table.`);
  const fields = Number(hdu.header.TFIELDS), rowBytes = Number(hdu.header.NAXIS1), rows = Number(hdu.header.NAXIS2);
  const columns: TableColumn[] = [];
  let offset = 0;
  for (let index = 1; index <= fields; index++) {
    const form = String(hdu.header[`TFORM${index}`]).trim(), match = FORM.exec(form);
    if (!match) throw new Error(`Unsupported FITS column form ${form} in ${hdu.extname}.`);
    const repeat = match[1] ? Number(match[1]) : 1, type = match[2] as TableColumn['type'], bytes = repeat * TYPE_BYTES[type];
    const scale = hdu.header[`TSCAL${index}`] ?? 1, zero = hdu.header[`TZERO${index}`] ?? 0, nullValue = hdu.header[`TNULL${index}`];
    if (typeof scale !== 'number' || typeof zero !== 'number') throw new Error(`Column ${index} of ${hdu.extname} states a non-numeric TSCAL or TZERO.`);
    if (nullValue !== undefined && (typeof nullValue !== 'number' || !Number.isSafeInteger(nullValue) || !'BIJK'.includes(type)))
      throw new Error(`Column ${index} of ${hdu.extname} states a TNULL that only an integer column can carry.`);
    columns.push({ name: String(hdu.header[`TTYPE${index}`]).trim(), repeat, type, offset, bytes,
      ...(scale !== 1 || zero !== 0 ? { scaled: true as const } : {}), ...(nullValue !== undefined ? { nullValue } : {}) });
    offset += bytes;
  }
  if (offset !== rowBytes) throw new Error(`FITS row width ${rowBytes} differs from its columns (${offset}) in ${hdu.extname}.`);
  return { hdu, columns, rows, rowBytes };
}

export function tableColumn(table: BinaryTable, name: string): TableColumn {
  const column = table.columns.find(column => column.name === name);
  if (!column) throw new Error(`Column ${name} is absent from ${table.hdu.extname}.`);
  return column;
}

/** Numeric cells of one row: a repeat-count array of numbers (logicals as 0/1; complex cells as re, im pairs, twice as long). */
export function numbers(bytes: Buffer, table: BinaryTable, row: number, column: TableColumn): number[] {
  unscaled(column);
  const base = table.hdu.dataOffset + row * table.rowBytes + column.offset;
  if (column.type === 'C' || column.type === 'M') {
    const out = new Array<number>(column.repeat * 2), size = column.type === 'C' ? 4 : 8;
    for (let i = 0; i < out.length; i++) out[i] = size === 4 ? bytes.readFloatBE(base + i * 4) : bytes.readDoubleBE(base + i * 8);
    return out;
  }
  const out = new Array<number>(column.repeat);
  for (let i = 0; i < column.repeat; i++) {
    const at = base + i * TYPE_BYTES[column.type];
    out[i] = column.type === 'D' ? bytes.readDoubleBE(at) : column.type === 'E' ? bytes.readFloatBE(at) : column.type === 'I' ? bytes.readInt16BE(at)
      : column.type === 'J' ? bytes.readInt32BE(at) : column.type === 'K' ? Number(bytes.readBigInt64BE(at)) : column.type === 'L' ? (bytes[at] === 0x54 ? 1 : 0) : bytes[at]!;
    if (out[i] === column.nullValue) out[i] = Number.NaN;
  }
  return out;
}

function unscaled(column: TableColumn) {
  if (column.scaled) throw new Error(`Column ${column.name} is scaled by TSCAL or TZERO, which these tables do not apply.`);
}

/** Overwrite one complex cell (C or M) in place with its real and imaginary parts. */
export function writeComplexCell(bytes: Buffer, table: BinaryTable, row: number, column: TableColumn, index: number, re: number, im: number) {
  unscaled(column);
  if (column.type !== 'C' && column.type !== 'M') throw new TypeError(`${column.name} (${column.type}) is not a complex column.`);
  if (index < 0 || index >= column.repeat) throw new RangeError(`${column.name} has ${column.repeat} cells, not ${index + 1}.`);
  const at = table.hdu.dataOffset + row * table.rowBytes + column.offset + index * TYPE_BYTES[column.type];
  if (column.type === 'C') { bytes.writeFloatBE(re, at); bytes.writeFloatBE(im, at + 4); } else { bytes.writeDoubleBE(re, at); bytes.writeDoubleBE(im, at + 8); }
}

/** Overwrite one cell in place: a floating-point value or a logical flag. The column's own type decides the encoding. */
export function writeCell(bytes: Buffer, table: BinaryTable, row: number, column: TableColumn, index: number, value: number | boolean) {
  unscaled(column);
  if (index < 0 || index >= column.repeat) throw new RangeError(`${column.name} has ${column.repeat} cells, not ${index + 1}.`);
  const at = table.hdu.dataOffset + row * table.rowBytes + column.offset + index * TYPE_BYTES[column.type];
  if (column.type === 'D') bytes.writeDoubleBE(Number(value), at);
  else if (column.type === 'E') bytes.writeFloatBE(Number(value), at);
  else if (column.type === 'L') bytes[at] = value ? 0x54 : 0x46;
  else throw new TypeError(`${column.name} (${column.type}) is not a floating-point or logical column.`);
}
export function text(bytes: Buffer, table: BinaryTable, row: number, column: TableColumn): string {
  const base = table.hdu.dataOffset + row * table.rowBytes + column.offset;
  return bytes.toString('latin1', base, base + column.bytes).replace(/\0.*$/s, '').trim();
}
export function findTable(bytes: Buffer, name: string): BinaryTable {
  const hdu = readFitsHdus(bytes).find(hdu => hdu.extname === name);
  if (!hdu) throw new Error(`FITS extension ${name} is absent.`);
  return binaryTable(hdu);
}

// ---- writing ----------------------------------------------------------------------------------------------------------
type Card = readonly [string, string | number | boolean, string?];
function card([key, value, comment]: Card): string {
  const formatted = typeof value === 'string' ? `'${value.replace(/'/g, "''").padEnd(8)}'` : typeof value === 'boolean' ? (value ? 'T' : 'F').padStart(20)
    : Number.isInteger(value) ? String(value).padStart(20) : value.toExponential(12).toUpperCase().padStart(20);
  const line = `${key.padEnd(8)}= ${formatted}${comment ? ` / ${comment}` : ''}`;
  return line.slice(0, CARD).padEnd(CARD);
}
export function headerBlock(cards: readonly Card[]): Buffer {
  const textCards = [...cards.map(card), 'END'.padEnd(CARD)].join('');
  return Buffer.from(textCards.padEnd(Math.ceil(textCards.length / BLOCK) * BLOCK), 'latin1');
}
export function padBlock(data: Buffer): Buffer {
  const padded = Buffer.alloc(Math.ceil(data.length / BLOCK) * BLOCK);
  data.copy(padded);
  return padded;
}
export interface WriteColumn { readonly name: string; readonly form: string }
/** A binary-table HDU. Strings are padded with spaces; logicals are written as T/F bytes. */
export function binaryTableHdu(extname: string, columns: readonly WriteColumn[], rows: readonly (readonly (number | boolean | string | readonly number[] | readonly boolean[])[])[], extra: readonly Card[]): Buffer {
  const specs = columns.map(({ name, form }) => { const match = /^(\d*)([DEIJLA])$/.exec(form); if (!match) throw new Error(`Unsupported form ${form} for writing`); return { name, repeat: match[1] ? Number(match[1]) : 1, type: match[2] as TableColumn['type'] }; });
  const rowBytes = specs.reduce((sum, spec) => sum + spec.repeat * TYPE_BYTES[spec.type], 0), data = Buffer.alloc(rowBytes * rows.length);
  rows.forEach((row, r) => {
    let at = r * rowBytes;
    specs.forEach((spec, c) => {
      const value = row[c];
      if (spec.type === 'A') { data.write(String(value).padEnd(spec.repeat).slice(0, spec.repeat), at, 'latin1'); at += spec.repeat; return; }
      const values = Array.isArray(value) ? value : [value];
      if (values.length !== spec.repeat) throw new Error(`Column ${spec.name} expects ${spec.repeat} values.`);
      for (const cell of values) {
        if (spec.type === 'D') data.writeDoubleBE(Number(cell), at); else if (spec.type === 'E') data.writeFloatBE(Number(cell), at);
        else if (spec.type === 'I') data.writeInt16BE(Number(cell), at); else if (spec.type === 'J') data.writeInt32BE(Number(cell), at);
        else data[at] = cell ? 0x54 : 0x46;
        at += TYPE_BYTES[spec.type];
      }
    });
  });
  const cards: Card[] = [['XTENSION', 'BINTABLE', 'binary table extension'], ['BITPIX', 8], ['NAXIS', 2], ['NAXIS1', rowBytes], ['NAXIS2', rows.length], ['PCOUNT', 0], ['GCOUNT', 1], ['TFIELDS', columns.length],
    ...specs.flatMap((spec, i): Card[] => [[`TTYPE${i + 1}`, spec.name], [`TFORM${i + 1}`, `${spec.repeat}${spec.type}`]]), ['EXTNAME', extname], ...extra];
  return Buffer.concat([headerBlock(cards), padBlock(data)]);
}
export function primaryHdu(extra: readonly Card[] = []): Buffer {
  return headerBlock([['SIMPLE', true, 'conforms to FITS standard'], ['BITPIX', 8], ['NAXIS', 0], ['EXTEND', true], ...extra]);
}
