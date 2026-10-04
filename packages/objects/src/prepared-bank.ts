import type { PreparedBinaryRegion } from './prepared-binary.js';

/**
 * The one container of the prepared data the page fetches: a small JSON header and typed columns. Text and structure go
 * in the header; every table of numbers is a column, so the reader hands the page typed arrays over the file's own
 * bytes and the page parses no large text and builds no object per row.
 *
 * Layout: magic `CSBANK01`, u32 header byte length, the UTF-8 JSON header, then the columns, each starting on an 8-byte
 * boundary. The header is `{ schema, fields, columns }`, where `columns` maps a name to `[type, offset, length]`: the
 * element type, the byte offset from the first column and the element count. The file travels packed
 * (prepared-binary.ts): its columns are the typed regions the shuffle works on.
 */
export const PREPARED_BANK_MAGIC = 'CSBANK01';

const TYPES = {
  f64: Float64Array, f32: Float32Array, i32: Int32Array, u32: Uint32Array, i16: Int16Array, u16: Uint16Array, i8: Int8Array, u8: Uint8Array,
} as const;
export type PreparedBankColumnType = keyof typeof TYPES;
export type PreparedBankColumn = InstanceType<(typeof TYPES)[PreparedBankColumnType]>;
/** A decoded bank: its schema, its header fields and its columns by name. */
export interface PreparedBank {
  readonly schema: string;
  readonly fields: Readonly<Record<string, unknown>>;
  readonly columns: Readonly<Record<string, PreparedBankColumn>>;
}

const align = (value: number) => value + (8 - value % 8) % 8;
const typeOf = (column: PreparedBankColumn, name: string, at: string): PreparedBankColumnType => {
  for (const [type, constructor] of Object.entries(TYPES)) if (column instanceof constructor && column.constructor === constructor) return type as PreparedBankColumnType;
  throw new TypeError(`${at}: column ${name} must be one of ${Object.keys(TYPES).join(', ')}.`);
};

/** A bank's bytes and its typed regions, ready for packPreparedBinary. */
export function encodePreparedBank(bank: PreparedBank, at = 'prepared bank'): { readonly bytes: Uint8Array; readonly regions: readonly PreparedBinaryRegion[] } {
  if (typeof bank.schema !== 'string' || !bank.schema) throw new TypeError(`${at}: a bank names its schema.`);
  const layout: Record<string, [PreparedBankColumnType, number, number]> = {};
  let offset = 0;
  for (const [name, column] of Object.entries(bank.columns)) {
    layout[name] = [typeOf(column, name, at), offset, column.length];
    offset = align(offset + column.byteLength);
  }
  const header = new TextEncoder().encode(JSON.stringify({ schema: bank.schema, fields: bank.fields, columns: layout }));
  const start = align(12 + header.byteLength), bytes = new Uint8Array(start + offset), regions: PreparedBinaryRegion[] = [];
  bytes.set(new TextEncoder().encode(PREPARED_BANK_MAGIC), 0);
  new DataView(bytes.buffer).setUint32(8, header.byteLength, true);
  bytes.set(header, 12);
  for (const [name, column] of Object.entries(bank.columns)) {
    const place = start + layout[name]![1];
    bytes.set(new Uint8Array(column.buffer, column.byteOffset, column.byteLength), place);
    if (column.byteLength) regions.push({ offset: place, bytes: column.byteLength, elementBytes: column.BYTES_PER_ELEMENT });
  }
  return { bytes, regions };
}

/** A bank from its unpacked bytes: the columns are views over `buffer`, so transferring it moves them all. */
export function decodePreparedBank(buffer: ArrayBuffer, at = 'prepared bank'): PreparedBank {
  const fail = (why: string): never => { throw new TypeError(`${at}: ${why}`); };
  const bytes = new Uint8Array(buffer);
  if (bytes.byteLength < 12 || new TextDecoder().decode(bytes.subarray(0, 8)) !== PREPARED_BANK_MAGIC) fail(`not a prepared bank (expected magic ${PREPARED_BANK_MAGIC}).`);
  const headerBytes = new DataView(buffer).getUint32(8, true), start = align(12 + headerBytes);
  if (start > bytes.byteLength) fail(`its header claims ${headerBytes} bytes of a ${bytes.byteLength}-byte file.`);
  let header: unknown;
  try { header = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(12, 12 + headerBytes))); }
  catch (cause) { throw new TypeError(`${at}: its header is not UTF-8 JSON.`, { cause }); }
  const { schema, fields, columns: layout } = (header ?? {}) as { schema?: unknown; fields?: unknown; columns?: unknown };
  const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
  if (typeof schema !== 'string' || !schema || !record(fields) || !record(layout)) fail('its header must hold a schema, fields and columns.');
  const columns: Record<string, PreparedBankColumn> = {};
  let end = start;
  for (const [name, entry] of Object.entries(layout as Record<string, unknown>)) {
    const [type, offset, length] = Array.isArray(entry) && entry.length === 3 ? entry as [unknown, unknown, unknown] : [];
    const constructor = typeof type === 'string' && Object.hasOwn(TYPES, type) ? TYPES[type as PreparedBankColumnType] : undefined;
    if (!constructor || !Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || (offset as number) < 0 || (length as number) < 0 || (offset as number) % 8 !== 0 ||
        start + (offset as number) + (length as number) * constructor.BYTES_PER_ELEMENT > bytes.byteLength) {
      fail(`column ${name} is ${JSON.stringify(entry)}, which is not [type, offset, length] inside the file's ${bytes.byteLength} bytes.`);
    }
    columns[name] = new constructor!(buffer, start + (offset as number), length as number);
    end = Math.max(end, align(start + (offset as number) + (length as number) * constructor!.BYTES_PER_ELEMENT));
  }
  if (end !== bytes.byteLength) fail(`its columns end at byte ${end}; the file holds ${bytes.byteLength}.`);
  return { schema: schema as string, fields: fields as Record<string, unknown>, columns };
}

/** The column `name` of `bank` as `type`, with `length` elements when given: a reader's one check per column. */
export function preparedBankColumn<Type extends PreparedBankColumnType>(bank: PreparedBank, name: string, type: Type | readonly Type[], length?: number, at = 'prepared bank'): InstanceType<(typeof TYPES)[Type]> {
  const column = bank.columns[name], types = typeof type === 'string' ? [type] : type;
  if (!column || !types.some(candidate => column.constructor === TYPES[candidate]) || (length !== undefined && column.length !== length)) {
    throw new TypeError(`${at}: column ${name} must be ${types.join(' or ')}${length === undefined ? '' : ` with ${length} values`}, got ${column ? `${column.constructor.name} with ${column.length}` : 'none'}.`);
  }
  return column as InstanceType<(typeof TYPES)[Type]>;
}
