/** Minimal, strict offline reader for single-part OpenEXR RGB HALF scanlines (ZIP/none).
 * Layout: https://openexr.com/en/latest/OpenEXRFileLayout.html
 * ZIP predictor and byte shuffle follow OpenEXR ImfZip.cpp; no runtime decoder.
 */
import { inflateSync } from 'node:zlib';
export interface LinearHalfImage { width: number; height: number; rgb16f: Buffer; }
export function decodeExrRgbHalf(bytes: Buffer): LinearHalfImage {
  if (bytes.length < 16 || bytes.readUInt32LE(0) !== 20000630 || bytes.readUInt32LE(4) !== 2) throw new TypeError('Expected single-part scanline OpenEXR version 2.');
  let cursor = 8;
  const string = (): string => {
    const end = bytes.indexOf(0, cursor); if (end < cursor || end - cursor > 255) throw new TypeError('Invalid EXR string.');
    const result = bytes.toString('ascii', cursor, end); cursor = end + 1; return result;
  };
  const attributes = new Map<string, { type: string; value: Buffer }>();
  while (bytes[cursor]) {
    const name = string(), type = string();
    if (cursor + 4 > bytes.length) throw new TypeError('Truncated EXR attribute.');
    const length = bytes.readUInt32LE(cursor); cursor += 4;
    if (cursor + length > bytes.length || attributes.has(name)) throw new TypeError('Invalid EXR attribute bounds.');
    attributes.set(name, { type, value: bytes.subarray(cursor, cursor + length) }); cursor += length;
  }
  cursor++;
  const attribute = (name: string, type: string): Buffer => {
    const found = attributes.get(name); if (!found || found.type !== type) throw new TypeError(`Missing EXR ${name}.`); return found.value;
  };
  const window = attribute('dataWindow', 'box2i');
  if (window.length !== 16 || window.readInt32LE(0) !== 0 || window.readInt32LE(4) !== 0) throw new TypeError('EXR data window must start at zero.');
  const width = window.readInt32LE(8) + 1, height = window.readInt32LE(12) + 1;
  if (width < 1 || height < 1 || !Number.isSafeInteger(width * height * 6) || width * height > 268435456) throw new TypeError('Invalid EXR dimensions.');
  const channelBytes = attribute('channels', 'chlist'), channels: string[] = [];
  for (let at = 0; channelBytes[at];) {
    const end = channelBytes.indexOf(0, at); if (end < at || end + 17 > channelBytes.length) throw new TypeError('Invalid EXR channels.');
    const name = channelBytes.toString('ascii', at, end); at = end + 1;
    if (!['R', 'G', 'B'].includes(name) || channels.includes(name) || channelBytes.readInt32LE(at) !== 1 ||
      channelBytes.readInt32LE(at + 8) !== 1 || channelBytes.readInt32LE(at + 12) !== 1) throw new TypeError('EXR requires full-resolution RGB HALF channels.');
    channels.push(name); at += 16;
  }
  if (channels.length !== 3) throw new TypeError('EXR requires exactly RGB channels.');
  const compression = attribute('compression', 'compression')[0];
  if (compression !== 0 && compression !== 3) throw new TypeError('EXR supports uncompressed or ZIP16 scanlines only.');
  if (attribute('lineOrder', 'lineOrder')[0] !== 0) throw new TypeError('EXR requires increasing scanline order.');
  const linesPerBlock = compression === 3 ? 16 : 1, blocks = Math.ceil(height / linesPerBlock);
  if (cursor + blocks * 8 > bytes.length) throw new TypeError('Truncated EXR offset table.');
  const rgb16f = Buffer.alloc(width * height * 6), seen = new Set<number>();
  for (let block = 0; block < blocks; block++) {
    const offset = Number(bytes.readBigUInt64LE(cursor + block * 8));
    if (!Number.isSafeInteger(offset) || offset < cursor + blocks * 8 || offset + 8 > bytes.length) throw new TypeError('Invalid EXR block offset.');
    const y = bytes.readInt32LE(offset), packedLength = bytes.readUInt32LE(offset + 4);
    if (y < 0 || y >= height || y % linesPerBlock || seen.has(y) || offset + 8 + packedLength > bytes.length) throw new TypeError('Invalid EXR scanline block.');
    seen.add(y);
    const lines = Math.min(linesPerBlock, height - y), length = width * lines * 6;
    const packed = bytes.subarray(offset + 8, offset + 8 + packedLength);
    let unpacked: Buffer;
    if (packedLength === length) unpacked = packed;
    else {
      if (compression !== 3 || packedLength > length) throw new TypeError('Invalid EXR compressed block length.');
      const predicted = inflateSync(packed, { maxOutputLength: length });
      if (predicted.length !== length) throw new TypeError('EXR ZIP decoded length mismatch.');
      for (let i = 1; i < length; i++) predicted[i] = (predicted[i - 1]! + predicted[i]! - 128) & 255;
      unpacked = Buffer.allocUnsafe(length); const split = Math.ceil(length / 2);
      for (let i = 0; i < split; i++) { unpacked[2 * i] = predicted[i]!; if (2 * i + 1 < length) unpacked[2 * i + 1] = predicted[split + i]!; }
    }
    for (let row = 0; row < lines; row++) for (let channel = 0; channel < 3; channel++) {
      const targetChannel = channels[channel] === 'R' ? 0 : channels[channel] === 'G' ? 1 : 2;
      for (let x = 0; x < width; x++) {
        const from = ((row * 3 + channel) * width + x) * 2, to = (((y + row) * width + x) * 3 + targetChannel) * 2;
        rgb16f[to] = unpacked[from]!; rgb16f[to + 1] = unpacked[from + 1]!;
      }
    }
  }
  return { width, height, rgb16f };
}
export function halfToFloat(bits: number): number {
  const sign = bits & 0x8000 ? -1 : 1, exponent = (bits >>> 10) & 31, fraction = bits & 1023;
  if (exponent === 31) return fraction ? NaN : sign * Infinity;
  return sign * (exponent === 0 ? fraction * 2 ** -24 : (1 + fraction / 1024) * 2 ** (exponent - 15));
}
