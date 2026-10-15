/** Fixed-width numeric BINTABLE columns. The shared bake reader refuses TSCAL/TZERO, needed here. */
import { type FitsHeader, type readFitsHdus } from '@cssearth/fits';

type Hdu = ReturnType<typeof readFitsHdus>[number];
interface Column { readonly name: string; readonly unit: string; readonly type: string; readonly repeat: number; readonly offset: number; readonly stride: number; readonly scale: number; readonly zero: number; readonly nullValue?: number }
const widths: Readonly<Record<string, number>> = { L: 1, A: 1, B: 1, I: 2, J: 4, K: 8, E: 4, D: 8, C: 8, M: 16 };
function numberCard(header: FitsHeader, key: string, fallback?: number): number {
  const value = header[key] ?? fallback;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Invalid preview FITS ${key}.`);
  return value;
}

export function previewTable(hdu: Hdu) {
  const header = hdu.header;
  if (header.XTENSION !== 'BINTABLE') throw new Error('Preview spectrum requires a binary table.');
  const fields = numberCard(header, 'TFIELDS'), rowBytes = numberCard(header, 'NAXIS1'), rows = numberCard(header, 'NAXIS2');
  if (![fields, rowBytes, rows].every(value => Number.isSafeInteger(value) && value >= 0) || fields > 999) throw new Error('Invalid preview FITS table dimensions.');
  let offset = 0;
  const columns: Column[] = [];
  for (let i = 1; i <= fields; i++) {
    const form = header[`TFORM${i}`], match = typeof form === 'string' ? /^(\d*)([LABIJKEDCMX])$/u.exec(form.trim()) : null;
    if (!match) throw new Error('Preview does not support variable-length or unknown FITS columns.');
    const repeat = match[1] ? Number(match[1]) : 1, type = match[2]!, stride = widths[type] ?? 0;
    const length = type === 'X' ? Math.ceil(repeat / 8) : repeat * stride;
    if (!Number.isSafeInteger(repeat) || repeat < 1 || !Number.isSafeInteger(length) || offset + length > rowBytes) throw new Error('Invalid preview FITS column bounds.');
    const name = header[`TTYPE${i}`];
    if (typeof name !== 'string') throw new Error('Preview FITS column has no name.');
    const nullValue = header[`TNULL${i}`];
    if (nullValue !== undefined && (typeof nullValue !== 'number' || !Number.isSafeInteger(nullValue) || !'BIJK'.includes(type))) throw new Error('Invalid preview FITS table null.');
    columns.push({ name, type, repeat, stride, offset, unit: typeof header[`TUNIT${i}`] === 'string' ? String(header[`TUNIT${i}`]) : '',
      scale: numberCard(header, `TSCAL${i}`, 1), zero: numberCard(header, `TZERO${i}`, 0), ...(typeof nullValue === 'number' ? { nullValue } : {}) });
    offset += length;
  }
  if (offset !== rowBytes || new Set(columns.map(column => column.name)).size !== columns.length) throw new Error('Invalid preview FITS row layout.');
  return { hdu, rows, rowBytes, columns };
}

export function numericColumn(bytes: Uint8Array, table: ReturnType<typeof previewTable>, name: string, row: number): { values: number[]; unit: string } {
  const column = table.columns.find(column => column.name === name);
  if (!column || !'BIJKED'.includes(column.type)) throw new Error(`Missing numeric preview FITS column ${name}.`);
  if (!Number.isSafeInteger(row) || row < 0 || row >= table.rows) throw new Error('Preview FITS row is out of bounds.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), values: number[] = [];
  for (let i = 0; i < column.repeat; i++) {
    const at = table.hdu.dataOffset + row * table.rowBytes + column.offset + i * column.stride;
    const raw = column.type === 'B' ? view.getUint8(at) : column.type === 'I' ? view.getInt16(at) : column.type === 'J' ? view.getInt32(at)
      : column.type === 'E' ? view.getFloat32(at) : column.type === 'D' ? view.getFloat64(at) : Number(view.getBigInt64(at));
    if (column.type === 'K' && !Number.isSafeInteger(raw)) throw new Error('Preview FITS integer exceeds numeric precision.');
    values.push(raw === column.nullValue ? NaN : raw * column.scale + column.zero);
  }
  return { values, unit: column.unit };
}
