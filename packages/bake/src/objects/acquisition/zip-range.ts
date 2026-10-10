/** One member of a remote ZIP archive by byte range. A deposit of gigabytes holds a model file of a few megabytes: the
 * archive's last bytes name its central directory, the directory places the member, and only the member's own bytes are
 * asked for. The whole archive is the fallback, never the first request. */
import { crc32, inflateRawSync } from 'node:zlib';

/** The longest an end-of-archive record can be: its 22 bytes and a comment of up to 65,535. */
export const ZIP_TAIL_BYTES = 22 + 65_535;
/** A member held in memory to be checked against its checksum is at most this large, packed or unpacked: a larger one is
 * streamed out of the whole archive, as before. */
export const ZIP_MEMBER_LIMIT = 256 * 1024 * 1024;
/** A central directory larger than this is not asked for: an archive of that many entries is taken whole. */
const DIRECTORY_LIMIT = 32 * 1024 * 1024;
const END_RECORD = 0x06054b50, DIRECTORY_ENTRY = 0x02014b50, LOCAL_HEADER = 0x04034b50, STORED = 0, DEFLATED = 8;

/** The header of a request for the archive's last bytes, where its end record is. */
export const zipTailRange = `bytes=-${ZIP_TAIL_BYTES}`;

/** The bytes of one range, from first to last inclusive. Anything but a 206 of that length is refused: a server that
 * answered the first range and not this one is not sending the archive this read began on. */
async function rangeBytes(ranged: (range: string) => Promise<Response>, first: number, last: number, url: string): Promise<Buffer> {
  const response = await ranged(`bytes=${first}-${last}`), bytes = Buffer.from(await response.arrayBuffer());
  if (response.status !== 206 || bytes.length !== last - first + 1) throw new Error(`${url} answered bytes ${first} to ${last} with status ${response.status} and ${bytes.length} bytes.`);
  return bytes;
}

/** The member's bytes, from the answer to a request for the archive's tail (`zipTailRange`), which must be a 206.
 * `ranged` asks the same archive for another range. Null when this reader is not the one for the archive: ZIP64 or
 * split archives, an encrypted member, a method other than stored or deflate, a member over ZIP_MEMBER_LIMIT. The caller
 * then takes the whole archive. An archive whose directory lists no such member, or whose member does not unpack to the
 * size and CRC-32 the directory records, is refused. */
export async function zipMemberFromTail(tailResponse: Response, ranged: (range: string) => Promise<Response>, url: string, member: string): Promise<Uint8Array | null> {
  const total = Number(/\/(\d+)\s*$/u.exec(tailResponse.headers.get('content-range') ?? '')?.[1] ?? NaN), tail = Buffer.from(await tailResponse.arrayBuffer());
  if (tailResponse.status !== 206 || !Number.isSafeInteger(total) || tail.length > total) throw new Error(`${url} did not answer a range of its last bytes with their place in the archive.`);
  const tailStart = total - tail.length;
  let end = -1;
  for (let at = tail.length - 22; at >= 0; at--) if (tail.readUInt32LE(at) === END_RECORD && at + 22 + tail.readUInt16LE(at + 20) === tail.length) { end = at; break; }
  if (end < 0) throw new Error(`${url} does not end as a ZIP archive does.`);
  const entries = tail.readUInt16LE(end + 10), directoryBytes = tail.readUInt32LE(end + 12), directoryStart = tail.readUInt32LE(end + 16);
  // A split archive, or one whose counts and places need the ZIP64 records, is taken whole.
  if (tail.readUInt16LE(end + 4) !== 0 || tail.readUInt16LE(end + 6) !== 0 || entries !== tail.readUInt16LE(end + 8) || entries === 0xffff || directoryBytes === 0xffffffff || directoryStart === 0xffffffff || directoryBytes > DIRECTORY_LIMIT) return null;
  if (directoryStart + directoryBytes > tailStart + end) throw new Error(`${url} places its directory past its own end.`);
  const directory = directoryStart >= tailStart ? tail.subarray(directoryStart - tailStart, directoryStart - tailStart + directoryBytes) : await rangeBytes(ranged, directoryStart, directoryStart + directoryBytes - 1, url);
  for (let at = 0, entry = 0; entry < entries; entry++) {
    if (at + 46 > directory.length || directory.readUInt32LE(at) !== DIRECTORY_ENTRY) throw new Error(`${url} holds a directory this cannot read at entry ${entry}.`);
    const flags = directory.readUInt16LE(at + 8), method = directory.readUInt16LE(at + 10), checksum = directory.readUInt32LE(at + 16), packed = directory.readUInt32LE(at + 20), unpacked = directory.readUInt32LE(at + 24);
    const nameBytes = directory.readUInt16LE(at + 28), extraBytes = directory.readUInt16LE(at + 30), commentBytes = directory.readUInt16LE(at + 32), local = directory.readUInt32LE(at + 42);
    const name = directory.subarray(at + 46, at + 46 + nameBytes).toString('utf8');
    at += 46 + nameBytes + extraBytes + commentBytes;
    if (name !== member) continue;
    if ((flags & 1) !== 0 || (method !== STORED && method !== DEFLATED) || packed === 0xffffffff || unpacked === 0xffffffff || local === 0xffffffff || packed > ZIP_MEMBER_LIMIT || unpacked > ZIP_MEMBER_LIMIT) return null;
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
