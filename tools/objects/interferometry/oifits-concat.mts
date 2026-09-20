/** Concatenate several calibrated OIFITS files of one target into one file, byte for byte: every OI_ARRAY, OI_WAVELENGTH,
 * OI_VIS2 and OI_T3 table is copied as it is, with its INSNAME and ARRNAME suffixed by the file's index so tables from
 * different files never share a name, and one OI_TARGET is kept. Nothing is averaged, rescaled or re-weighted; flags travel
 * with their rows. This is the input an image-reconstruction code reads when the observations span several nights and
 * configurations but the authors published no merged file. */
import { binaryTable, numbers, padBlock, readFitsHdus, tableColumn } from './fits-table.mts';

const BLOCK = 2880, CARD = 80;

function withSuffixedCard(header: Buffer, key: string, suffix: string): Buffer {
  const out = Buffer.from(header);
  for (let at = 0; at < out.length; at += CARD) {
    const card = out.toString('latin1', at, at + CARD);
    if (card.slice(0, 8).trim() === 'END') break;
    if (card.slice(0, 8).trim() !== key || card[8] !== '=') continue;
    const open = card.indexOf("'"), close = card.indexOf("'", open + 1);
    if (open < 0 || close < 0) throw new Error(`${key} is not a string card.`);
    const value = card.slice(open + 1, close).trimEnd() + suffix;
    const rebuilt = `${card.slice(0, open + 1)}${value}'`.padEnd(CARD);
    if (rebuilt.length > CARD) throw new Error(`${key} value too long after suffixing: ${value}`);
    out.write(rebuilt, at, 'latin1');
  }
  return out;
}

export interface ConcatenatedOifits { readonly bytes: Buffer; readonly files: number; readonly tables: Record<string, number> }

export function concatenateOifits(files: readonly Buffer[]): ConcatenatedOifits {
  if (!files.length) throw new Error('Nothing to concatenate.');
  const parts: Buffer[] = [], tables: Record<string, number> = {};
  let target: Buffer | null = null;
  files.forEach((bytes, index) => {
    const hdus = readFitsHdus(bytes), suffix = `_f${String(index).padStart(2, '0')}`;
    hdus.forEach((hdu, position) => {
      const headerStart = hdu.headerOffset;
      const dataEnd = hdu.dataOffset + Math.ceil(hdu.dataBytes / BLOCK) * BLOCK;
      const header = bytes.subarray(headerStart, hdu.dataOffset), data = bytes.subarray(hdu.dataOffset, dataEnd);
      if (position === 0) { if (index === 0) parts.push(Buffer.concat([header, data])); return; }
      if (hdu.extname === 'OI_TARGET') { if (!target) { target = Buffer.concat([header, data]); } return; }
      if (!['OI_ARRAY', 'OI_WAVELENGTH', 'OI_VIS2', 'OI_T3', 'OI_VIS'].includes(hdu.extname)) return;
      let patched = withSuffixedCard(Buffer.from(header), 'INSNAME', suffix);
      patched = withSuffixedCard(patched, 'ARRNAME', suffix);
      parts.push(Buffer.concat([patched, data]));
      tables[hdu.extname] = (tables[hdu.extname] ?? 0) + 1;
    });
  });
  if (!target) throw new Error('No OI_TARGET table found.');
  parts.push(target);
  return { bytes: Buffer.concat(parts), files: files.length, tables };
}

export interface OifitsRowSelection { readonly OI_VIS?: readonly number[]; readonly OI_VIS2?: readonly number[]; readonly OI_T3?: readonly number[] }

const observableNames = ['OI_VIS', 'OI_VIS2', 'OI_T3'] as const;
const rawHdu = (bytes: Buffer, hdu: ReturnType<typeof readFitsHdus>[number]) => bytes.subarray(hdu.headerOffset, hdu.dataOffset + Math.ceil(hdu.dataBytes / BLOCK) * BLOCK);
function withRowCount(header: Buffer, rows: number): Buffer {
  const out = Buffer.from(header);
  for (let at = 0; at < out.length; at += CARD) {
    const line = out.toString('latin1', at, at + CARD);
    if (line.slice(0, 8).trim() === 'END') break;
    if (line.slice(0, 8).trim() !== 'NAXIS2' || line[8] !== '=') continue;
    out.write(`NAXIS2  = ${String(rows).padStart(20)}`.padEnd(CARD), at, 'latin1');
    return out;
  }
  throw new Error('A selected OIFITS table has no NAXIS2 card.');
}
function selectedRows(rows: number, requested: readonly number[] | undefined, name: string): number[] {
  if (!requested?.length) return [];
  const selected = [...requested];
  if (new Set(selected).size !== selected.length || selected.some(row => !Number.isSafeInteger(row) || row < 0 || row >= rows))
    throw new RangeError(`${name} selection contains an invalid or repeated row.`);
  return selected;
}
function croppedHdu(bytes: Buffer, hdu: ReturnType<typeof readFitsHdus>[number], rows: readonly number[]): Buffer {
  const table = binaryTable(hdu);
  if (Number(hdu.header.PCOUNT ?? 0) !== 0) throw new Error(`${hdu.extname} has a variable-length heap and cannot be exactly subset.`);
  const header = withRowCount(bytes.subarray(hdu.headerOffset, hdu.dataOffset), rows.length);
  const data = Buffer.concat(rows.map(row => bytes.subarray(hdu.dataOffset + row * table.rowBytes, hdu.dataOffset + (row + 1) * table.rowBytes)));
  return Buffer.concat([header, padBlock(data)]);
}

/** Copy a selected set of observable rows byte-for-byte, with every table they name.  FITS row bytes are never decoded and
 * re-encoded, so visibility/phase conventions, FLAG, uncertainty and correlation references survive unchanged. */
export function subsetOifits(input: Buffer, selection: OifitsRowSelection): Buffer {
  const hdus = readFitsHdus(input), selected = new Map<ReturnType<typeof readFitsHdus>[number], number[]>();
  const targetIds = new Set<number>(), insNames = new Set<string>(), arrNames = new Set<string>(), corrNames = new Set<string>(), stationsByArray = new Map<string, Set<number>>();
  for (const hdu of hdus.filter(candidate => observableNames.includes(candidate.extname as typeof observableNames[number]))) {
    const table = binaryTable(hdu), rows = selectedRows(table.rows, selection[hdu.extname as keyof OifitsRowSelection], hdu.extname);
    if (!rows.length) continue;
    if (Number(hdu.header.PCOUNT ?? 0) !== 0) throw new Error(`${hdu.extname} has a variable-length heap and cannot be exactly subset.`);
    selected.set(hdu, rows);
    const target = tableColumn(table, 'TARGET_ID'), stations = table.columns.find(column => column.name === 'STA_INDEX');
    const insName = hdu.header.INSNAME, arrName = hdu.header.ARRNAME, corrName = hdu.header.CORRNAME;
    if (typeof insName !== 'string' || !insName.trim()) throw new Error(`${hdu.extname} has no INSNAME link to OI_WAVELENGTH.`);
    insNames.add(insName.trim());
    if (typeof arrName === 'string' && arrName.trim()) arrNames.add(arrName.trim());
    if (typeof corrName === 'string' && corrName.trim()) corrNames.add(corrName.trim());
    for (const row of rows) {
      targetIds.add(numbers(input, table, row, target)[0]!);
      if (stations && typeof arrName === 'string' && arrName.trim()) {
        const stationIds = stationsByArray.get(arrName.trim()) ?? new Set<number>();
        for (const station of numbers(input, table, row, stations)) stationIds.add(station);
        stationsByArray.set(arrName.trim(), stationIds);
      }
    }
  }
  if (!selected.size) throw new Error('Select at least one OI_VIS, OI_VIS2 or OI_T3 row.');
  const targetRows = new Map<ReturnType<typeof readFitsHdus>[number], number[]>(), linked = new Set<ReturnType<typeof readFitsHdus>[number]>();
  for (const hdu of hdus.filter(candidate => candidate.extname === 'OI_TARGET')) {
    const table = binaryTable(hdu), id = tableColumn(table, 'TARGET_ID'), rows = Array.from({ length: table.rows }, (_, row) => row).filter(row => targetIds.has(numbers(input, table, row, id)[0]!));
    if (rows.length) { targetRows.set(hdu, rows); for (const row of rows) targetIds.delete(numbers(input, table, row, id)[0]!); }
  }
  if (targetIds.size) throw new Error(`OI_TARGET lacks selected TARGET_ID ${[...targetIds].join(', ')}.`);
  for (const hdu of hdus.filter(candidate => candidate.extname === 'OI_WAVELENGTH')) if (typeof hdu.header.INSNAME === 'string' && insNames.delete(hdu.header.INSNAME.trim())) linked.add(hdu);
  if (insNames.size) throw new Error(`No OI_WAVELENGTH for ${[...insNames].join(', ')}.`);
  for (const hdu of hdus.filter(candidate => candidate.extname === 'OI_ARRAY')) if (typeof hdu.header.ARRNAME === 'string' && arrNames.delete(hdu.header.ARRNAME.trim())) {
    const table = binaryTable(hdu), station = tableColumn(table, 'STA_INDEX');
    const stationIds = stationsByArray.get(hdu.header.ARRNAME.trim())!;
    for (let row = 0; row < table.rows; row++) stationIds.delete(numbers(input, table, row, station)[0]!);
    linked.add(hdu);
  }
  if (arrNames.size) throw new Error(`No OI_ARRAY for ${[...arrNames].join(', ')}.`);
  for (const [arrName, stationIds] of stationsByArray) if (stationIds.size) throw new Error(`OI_ARRAY ${arrName} lacks selected STA_INDEX ${[...stationIds].join(', ')}.`);
  for (const hdu of hdus.filter(candidate => candidate.extname === 'OI_CORR')) if (typeof hdu.header.CORRNAME === 'string' && corrNames.delete(hdu.header.CORRNAME.trim())) linked.add(hdu);
  if (corrNames.size) throw new Error(`No OI_CORR for ${[...corrNames].join(', ')}.`);
  const parts: Buffer[] = [];
  for (const hdu of hdus) {
    if (hdu.extname === 'PRIMARY') parts.push(rawHdu(input, hdu));
    else if (targetRows.has(hdu)) parts.push(croppedHdu(input, hdu, targetRows.get(hdu)!));
    else if (linked.has(hdu)) parts.push(rawHdu(input, hdu));
    else if (selected.has(hdu)) parts.push(croppedHdu(input, hdu, selected.get(hdu)!));
  }
  const output = Buffer.concat(parts);
  // Re-open through the same FITS owner before publishing bytes, so an edited header or padded row cannot masquerade as a subset.
  for (const hdu of readFitsHdus(output)) if (hdu.extname !== 'PRIMARY') binaryTable(hdu);
  return output;
}
