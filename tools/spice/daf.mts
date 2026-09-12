/**
 * NAIF Double precision Array File (DAF) reader: the container of SPK and CK
 * kernels. A DAF is a sequence of 1024-byte records: one file record, then
 * summary records (each followed by a name record) chained forward, then
 * array data addressed as 1-based double-precision words. Binary layout per
 * the NAIF DAF Required Reading; both little- and big-endian IEEE files are
 * read. Nothing here interprets segments; SPK and CK readers do that.
 */
export const DAF_RECORD_BYTES = 1024;

export interface DafSummary {
  /** Segment name from the name record, trimmed. */
  readonly name: string;
  /** The ND double-precision components. */
  readonly doubles: readonly number[];
  /** The NI integer components (the last two are the 1-based start and end word addresses). */
  readonly integers: readonly number[];
  readonly startAddress: number;
  readonly endAddress: number;
}

export interface Daf {
  readonly idWord: string;
  readonly internalName: string;
  readonly littleEndian: boolean;
  readonly nd: number;
  readonly ni: number;
  readonly summaries: readonly DafSummary[];
  /** Read `count` doubles starting at a 1-based word address. */
  readonly words: (address: number, count: number) => Float64Array;
}

/** Parse a DAF held entirely in memory. */
export function readDaf(bytes: Uint8Array): Daf {
  if (bytes.length < DAF_RECORD_BYTES || bytes.length % DAF_RECORD_BYTES !== 0) throw new Error('DAF must be whole 1024-byte records.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length)).replace(/\0/g, ' ').trimEnd();
  // Legacy files (the JPL planetary ephemerides among them) carry the pre-N0052 id word NAIF/DAF; they are SPKs.
  const rawId = ascii(0, 8), idWord = rawId === 'NAIF/DAF' ? 'DAF/SPK' : rawId;
  if (!/^DAF\/[A-Z]{2,4}\s*$/u.test(idWord)) throw new Error(`Not a DAF file: ${JSON.stringify(rawId)}`);
  const format = ascii(88, 8);
  const littleEndian = format === 'LTL-IEEE';
  if (!littleEndian && format !== 'BIG-IEEE') throw new Error(`Unsupported DAF binary format: ${JSON.stringify(format)}`);
  const int = (offset: number) => view.getInt32(offset, littleEndian);
  const nd = int(8), ni = int(12), forward = int(76), backward = int(80);
  if (nd < 0 || nd > 124 || ni < 2 || ni > 250 || nd + (ni + 1) / 2 > 125) throw new Error(`Invalid DAF summary shape: ND=${nd} NI=${ni}`);
  if (forward < 2 || backward < forward || forward * DAF_RECORD_BYTES > bytes.length) throw new Error('Invalid DAF summary record chain.');
  const summarySize = nd + Math.ceil(ni / 2);
  const readDouble = (address: number) => {
    if (!Number.isInteger(address) || address < 1 || address * 8 > bytes.length) throw new Error(`DAF word address out of range: ${address}`);
    return view.getFloat64((address - 1) * 8, littleEndian);
  };
  const summaries: DafSummary[] = [];
  let record = forward, visited = 0;
  while (record !== 0) {
    if (++visited > 100000 || record < 2 || record * DAF_RECORD_BYTES > bytes.length) throw new Error('Corrupt DAF summary chain.');
    const base = (record - 1) * DAF_RECORD_BYTES;
    const next = view.getFloat64(base, littleEndian), count = view.getFloat64(base + 16, littleEndian);
    if (!Number.isInteger(next) || next < 0 || !Number.isInteger(count) || count < 0 || 3 + count * summarySize > 128) throw new Error('Invalid DAF summary record.');
    const nameBase = record * DAF_RECORD_BYTES, nameLength = summarySize * 8;
    for (let index = 0; index < count; index++) {
      const start = base + (3 + index * summarySize) * 8;
      const doubles = Array.from({ length: nd }, (_, i) => view.getFloat64(start + i * 8, littleEndian));
      const integers = Array.from({ length: ni }, (_, i) => view.getInt32(start + nd * 8 + i * 4, littleEndian));
      const startAddress = integers[ni - 2], endAddress = integers[ni - 1];
      if (startAddress < 1 || endAddress < startAddress || endAddress * 8 > bytes.length) throw new Error('DAF segment addresses out of range.');
      summaries.push({ name: ascii(nameBase + index * nameLength, nameLength), doubles, integers, startAddress, endAddress });
    }
    record = next;
  }
  const words = (address: number, count: number) => {
    if (!Number.isInteger(count) || count < 0 || (address + count - 1) * 8 > bytes.length) throw new Error(`DAF read out of range at ${address} (+${count}).`);
    const out = new Float64Array(count);
    for (let i = 0; i < count; i++) out[i] = readDouble(address + i);
    return out;
  };
  return { idWord, internalName: ascii(16, 60), littleEndian, nd, ni, summaries, words };
}
