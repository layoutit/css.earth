/** Decode the noninterlaced 8-bit RGB/RGBA PNGs emitted by the two browser engines, using Node only. */
import { inflateSync } from 'node:zlib';
export interface Pixels { width: number; height: number; data: Uint8Array }
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export function decodePng(input: Uint8Array): Pixels {
  const bytes = Buffer.from(input);
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('Invalid PNG signature');
  let width = 0, height = 0, channels = 0, ended = false, offset = 8;
  const compressed: Buffer[] = [];
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new Error('Truncated PNG chunk');
    const length = bytes.readUInt32BE(offset), end = offset + 12 + length;
    if (end > bytes.length) throw new Error('Truncated PNG payload');
    const type = bytes.toString('ascii', offset + 4, offset + 8), data = bytes.subarray(offset + 8, end - 4);
    if (crc32(bytes.subarray(offset + 4, end - 4)) !== bytes.readUInt32BE(end - 4)) throw new Error('Invalid PNG chunk checksum');
    if (type === 'IHDR') {
      if (offset !== 8 || length !== 13 || width) throw new Error('Invalid PNG header');
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      if (!width || !height || width * height > 64000000) throw new Error('Invalid or excessive PNG dimensions');
      if (data[8] !== 8 || ![2, 6].includes(data[9] ?? -1) || data[10] !== 0 || data[11] !== 0 || data[12] !== 0)
        throw new Error('Unsupported PNG: expected noninterlaced 8-bit RGB/RGBA browser screenshot');
      channels = data[9] === 2 ? 3 : 4;
    } else if (type === 'IDAT') {
      if (!width) throw new Error('PNG data before header');
      compressed.push(data);
    } else if (type === 'IEND') {
      if (length !== 0 || end !== bytes.length) throw new Error('Invalid PNG end');
      ended = true;
    } else if (type === 'tRNS' || type === 'acTL' || /^[A-Z]/u.test(type)) throw new Error(`Unsupported PNG chunk ${type}`);
    offset = end;
  }
  if (!width || !ended || !compressed.length) throw new Error('Incomplete PNG');
  const stride = width * channels, expected = (stride + 1) * height;
  const filtered = inflateSync(Buffer.concat(compressed), { maxOutputLength: expected });
  if (filtered.length !== expected) throw new Error('Invalid PNG scanline length');
  const raw = new Uint8Array(stride * height);
  const paeth = (left: number, up: number, corner: number) => {
    const p = left + up - corner, a = Math.abs(p - left), b = Math.abs(p - up), c = Math.abs(p - corner);
    return a <= b && a <= c ? left : b <= c ? up : corner;
  };
  for (let y = 0; y < height; y++) {
    const filter = filtered[y * (stride + 1)];
    if (filter === undefined || filter > 4) throw new Error('Invalid PNG row filter');
    for (let x = 0; x < stride; x++) {
      const index = y * stride + x, left = x >= channels ? raw[index - channels]! : 0;
      const up = y ? raw[index - stride]! : 0, corner = y && x >= channels ? raw[index - stride - channels]! : 0;
      const prediction = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up : filter === 3 ? Math.floor((left + up) / 2) : paeth(left, up, corner);
      raw[index] = (filtered[y * (stride + 1) + 1 + x]! + prediction) & 255;
    }
  }
  const data = new Uint8Array(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel++) {
    data[pixel * 4] = raw[pixel * channels]!; data[pixel * 4 + 1] = raw[pixel * channels + 1]!;
    data[pixel * 4 + 2] = raw[pixel * channels + 2]!; data[pixel * 4 + 3] = channels === 4 ? raw[pixel * channels + 3]! : 255;
  }
  return { width, height, data };
}
