/** Minimal dBase III/IV attribute table reader for pinned shapefile archives.
 * The Gazetteer ships one fixed-width DBF beside its point geometry; every
 * field the catalogue needs (name, type, centre, diameter, origin) lives here. */
export interface DbfField { readonly name: string; readonly type: string; readonly length: number; readonly decimals: number; }
export interface DbfTable { readonly fields: readonly DbfField[]; readonly rows: readonly Readonly<Record<string, string>>[]; readonly deleted: number; }

export function parseDbf(bytes: Uint8Array, encoding = 'utf-8'): DbfTable {
  if (bytes.length < 32) throw new TypeError('DBF header is truncated.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const recordCount = view.getUint32(4, true), headerLength = view.getUint16(8, true), recordLength = view.getUint16(10, true);
  const fields: DbfField[] = [];
  const ascii = new TextDecoder('ascii'), decoder = new TextDecoder(encoding, { fatal: true });
  for (let offset = 32; offset < headerLength; offset += 32) {
    if (bytes[offset] === 0x0d) break;
    if (offset + 32 > bytes.length) throw new TypeError('DBF field descriptor is truncated.');
    const raw = bytes.subarray(offset, offset + 11), end = raw.indexOf(0);
    const name = ascii.decode(raw.subarray(0, end < 0 ? 11 : end)).trim();
    const type = String.fromCharCode(bytes[offset + 11]!), length = bytes[offset + 16]!, decimals = bytes[offset + 17]!;
    if (!name || !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(name)) throw new TypeError('DBF field name is invalid.');
    fields.push({ name, type, length, decimals });
  }
  if (!fields.length) throw new TypeError('DBF table declares no fields.');
  const declaredLength = 1 + fields.reduce((sum, field) => sum + field.length, 0);
  if (declaredLength !== recordLength) throw new TypeError('DBF record length does not match its fields.');
  if (new Set(fields.map(field => field.name)).size !== fields.length) throw new TypeError('DBF field names repeat.');
  if (headerLength + recordCount * recordLength > bytes.length) throw new TypeError('DBF records are truncated.');
  const rows: Record<string, string>[] = [];
  let deleted = 0;
  for (let index = 0; index < recordCount; index++) {
    const start = headerLength + index * recordLength, flag = bytes[start];
    if (flag === 0x2a) { deleted++; continue; }
    if (flag !== 0x20) throw new TypeError('DBF record flag is invalid.');
    const row: Record<string, string> = {};
    let cursor = start + 1;
    for (const field of fields) {
      row[field.name] = decoder.decode(bytes.subarray(cursor, cursor + field.length)).replace(/\0+$/u, '').trim();
      cursor += field.length;
    }
    rows.push(row);
  }
  return Object.freeze({ fields: Object.freeze(fields), rows: Object.freeze(rows), deleted });
}
