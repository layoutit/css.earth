/** One member of a remote ZIP archive by byte range. A deposit of gigabytes holds a model file of a few megabytes: the
 * archive's last bytes name its central directory, the directory places the member, and only the member's own bytes are
 * asked for, past 4 GiB too (ZIP64). The whole archive is the fallback, never the first request. */
import { crc32, inflateRawSync } from 'node:zlib';

/** The longest an end-of-archive record can be: its 22 bytes and a comment of up to 65,535. */
export const ZIP_TAIL_BYTES = 22 + 65_535;
/** A member held in memory to be checked against its checksum is at most this large, packed or unpacked: a larger one is
 * streamed out of the whole archive, as before. */
export const ZIP_MEMBER_LIMIT = 256 * 1024 * 1024;
/** A central directory larger than this is not asked for: an archive of that many entries is taken whole. */
const DIRECTORY_LIMIT = 32 * 1024 * 1024;
const END_RECORD = 0x06054b50, DIRECTORY_ENTRY = 0x02014b50, LOCAL_HEADER = 0x04034b50, STORED = 0, DEFLATED = 8;
const ZIP64_END_RECORD = 0x06064b50, ZIP64_LOCATOR = 0x07064b50, ZIP64_EXTRA = 0x0001, WIDE = 0xffffffff;

/** The header of a request for the archive's last bytes, where its end record is. */
export const zipTailRange = `bytes=-${ZIP_TAIL_BYTES}`;

/** The bytes of one range, from first to last inclusive. Anything but a 206 of that length is refused: a server that
 * answered the first range and not this one is not sending the archive this read began on. */
async function rangeBytes(ranged: (range: string) => Promise<Response>, first: number, last: number, url: string): Promise<Buffer> {
  const response = await ranged(`bytes=${first}-${last}`), bytes = Buffer.from(await response.arrayBuffer());
  if (response.status !== 206 || bytes.length !== last - first + 1) throw new Error(`${url} answered bytes ${first} to ${last} with status ${response.status} and ${bytes.length} bytes.`);
  return bytes;
}

/** A number of eight bytes, which must fit a JavaScript number: no archive is larger than 2^53 bytes. */
function wide(bytes: Buffer, at: number, url: string): number {
  const value = Number(bytes.readBigUInt64LE(at));
  if (!Number.isSafeInteger(value)) throw new Error(`${url} records a size or place of more than 2^53 bytes.`);
  return value;
}

/** The ZIP64 end record's directory, when an archive needs one: past 65,535 entries or 4 GiB, the end record holds 0xffff or
 * 0xffffffff and a locator just before it places the ZIP64 end record. Measured 2026-10-14 on Zenodo record 19388488, a 48.6 GB
 * archive whose members lie past 4 GiB. Null when the archive has no locator or is split. */
async function zip64Directory(tail: Buffer, tailStart: number, end: number, ranged: (range: string) => Promise<Response>, url: string) {
  const at = end - 20;
  if (at < 0 || tail.readUInt32LE(at) !== ZIP64_LOCATOR || tail.readUInt32LE(at + 4) !== 0 || tail.readUInt32LE(at + 16) !== 1) return null;
  const place = wide(tail, at + 8, url);
  const record = place >= tailStart && place + 56 <= tailStart + tail.length ? tail.subarray(place - tailStart, place - tailStart + 56) : await rangeBytes(ranged, place, place + 55, url);
  if (record.readUInt32LE(0) !== ZIP64_END_RECORD) throw new Error(`${url} does not hold its ZIP64 end record where its locator places it.`);
  if (record.readUInt32LE(16) !== 0 || record.readUInt32LE(20) !== 0 || wide(record, 24, url) !== wide(record, 32, url)) return null;
  return { entries: wide(record, 32, url), directoryBytes: wide(record, 40, url), directoryStart: wide(record, 48, url) };
}

/** A directory entry's sizes and place, with those it marks 0xffffffff read from its ZIP64 extra field, in the order the
 * format gives them: unpacked size, packed size, place of the local header. */
function zip64Fields(extra: Buffer, fields: { unpacked: number; packed: number; local: number }, url: string, member: string) {
  for (let at = 0; at + 4 <= extra.length; at += 4 + extra.readUInt16LE(at + 2)) {
    if (extra.readUInt16LE(at) !== ZIP64_EXTRA) continue;
    const data = extra.subarray(at + 4, at + 4 + extra.readUInt16LE(at + 2)), out = { ...fields };
    let next = 0;
    for (const key of ['unpacked', 'packed', 'local'] as const) if (fields[key] === WIDE) {
      if (next + 8 > data.length) throw new Error(`${member} of ${url} has a ZIP64 extra field too short for the sizes it marks.`);
      out[key] = wide(data, next, url); next += 8;
    }
    return out;
  }
  throw new Error(`${member} of ${url} marks a size or place 0xffffffff and has no ZIP64 extra field.`);
}

/** The member's bytes, from the answer to a request for the archive's tail (`zipTailRange`), which must be a 206.
 * `ranged` asks the same archive for another range. ZIP64 archives are read too. Null when this reader is not the one for
 * the archive: split archives, an encrypted member, a method other than stored or deflate, a member over ZIP_MEMBER_LIMIT.
 * The caller then takes the whole archive. An archive whose directory lists no such member, or whose member does not
 * unpack to the size and CRC-32 the directory records, is refused. */
export async function zipMemberFromTail(tailResponse: Response, ranged: (range: string) => Promise<Response>, url: string, member: string): Promise<Uint8Array | null> {
  const total = Number(/\/(\d+)\s*$/u.exec(tailResponse.headers.get('content-range') ?? '')?.[1] ?? NaN), tail = Buffer.from(await tailResponse.arrayBuffer());
  if (tailResponse.status !== 206 || !Number.isSafeInteger(total) || tail.length > total) throw new Error(`${url} did not answer a range of its last bytes with their place in the archive.`);
  const tailStart = total - tail.length;
  let end = -1;
  for (let at = tail.length - 22; at >= 0; at--) if (tail.readUInt32LE(at) === END_RECORD && at + 22 + tail.readUInt16LE(at + 20) === tail.length) { end = at; break; }
  if (end < 0) throw new Error(`${url} does not end as a ZIP archive does.`);
  let entries = tail.readUInt16LE(end + 10), directoryBytes = tail.readUInt32LE(end + 12), directoryStart = tail.readUInt32LE(end + 16);
  // Counts and places too large for the end record are in the ZIP64 end record; an archive without one is taken whole.
  if (entries === 0xffff || directoryBytes === WIDE || directoryStart === WIDE) {
    const zip64 = await zip64Directory(tail, tailStart, end, ranged, url);
    if (!zip64) return null;
    ({ entries, directoryBytes, directoryStart } = zip64);
  } else if (tail.readUInt16LE(end + 4) !== 0 || tail.readUInt16LE(end + 6) !== 0 || entries !== tail.readUInt16LE(end + 8)) return null; // split
  if (directoryBytes > DIRECTORY_LIMIT) return null;
  if (directoryStart + directoryBytes > tailStart + end) throw new Error(`${url} places its directory past its own end.`);
  const directory = directoryStart >= tailStart ? tail.subarray(directoryStart - tailStart, directoryStart - tailStart + directoryBytes) : await rangeBytes(ranged, directoryStart, directoryStart + directoryBytes - 1, url);
  for (let at = 0, entry = 0; entry < entries; entry++) {
    if (at + 46 > directory.length || directory.readUInt32LE(at) !== DIRECTORY_ENTRY) throw new Error(`${url} holds a directory this cannot read at entry ${entry}.`);
    const flags = directory.readUInt16LE(at + 8), method = directory.readUInt16LE(at + 10), checksum = directory.readUInt32LE(at + 16);
    const nameBytes = directory.readUInt16LE(at + 28), extraBytes = directory.readUInt16LE(at + 30), commentBytes = directory.readUInt16LE(at + 32);
    const name = directory.subarray(at + 46, at + 46 + nameBytes).toString('utf8'), extra = directory.subarray(at + 46 + nameBytes, at + 46 + nameBytes + extraBytes);
    const recorded = { unpacked: directory.readUInt32LE(at + 24), packed: directory.readUInt32LE(at + 20), local: directory.readUInt32LE(at + 42) };
    at += 46 + nameBytes + extraBytes + commentBytes;
    if (name !== member) continue;
    const { packed, unpacked, local } = Object.values(recorded).includes(WIDE) ? zip64Fields(extra, recorded, url, member) : recorded;
    if ((flags & 1) !== 0 || (method !== STORED && method !== DEFLATED) || packed > ZIP_MEMBER_LIMIT || unpacked > ZIP_MEMBER_LIMIT) return null;
    // The member's own header says how long its name and extra field are there; they need not be the directory's.
    const header = await rangeBytes(ranged, local, local + 29, url);
    if (header.readUInt32LE(0) !== LOCAL_HEADER) throw new Error(`${url} does not hold ${member} where its directory places it.`);
    const dataStart = local + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);
    const data = packed === 0 ? Buffer.alloc(0) : await rangeBytes(ranged, dataStart, dataStart + packed - 1, url);
    const bytes = method === DEFLATED ? inflateRawSync(data, { maxOutputLength: Math.max(unpacked, 1) }) : data;
    if (bytes.length !== unpacked || crc32(bytes) !== checksum) throw new Error(`${member} of ${url} does not unpack to the ${unpacked} bytes and the CRC-32 its archive records.`);
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.length);
  }
  throw new Error(`${url} lists no member ${member}.`);
}
