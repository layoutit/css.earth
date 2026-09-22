/** Tiled-image FITS compressed with RICE_1 (Pence et al. 2010; FITS 4.0 section 10), as JSOC stores SDO/HMI and AIA
 * segments: a BINTABLE whose `COMPRESSED_DATA` column holds one variable-length byte array per tile. Only lossless
 * integer images are read (no ZQUANTIZ, ZSCALE or ZZERO columns); BSCALE, BZERO and BLANK apply to the decompressed
 * samples. The Rice bit layout follows CFITSIO's `fits_rdecomp` routines. */
import { readFitsHdu, readFitsHeader, type FitsHeader } from './fits.mts';

const PARAMETERS: Record<number, { readonly fsBits: number; readonly fsMax: number; readonly bBits: number }> = {
  1: { fsBits: 3, fsMax: 6, bBits: 8 }, 2: { fsBits: 4, fsMax: 14, bBits: 16 }, 4: { fsBits: 5, fsMax: 25, bBits: 32 },
};

/** Decode one Rice-coded tile of `count` integers of `bytePix` bytes: unsigned for one byte (FITS BITPIX 8), signed otherwise. */
export function riceDecompress(input: Uint8Array, count: number, blockSize: number, bytePix: number): Int32Array {
  const parameters = PARAMETERS[bytePix];
  if (!parameters) throw new Error('Unsupported FITS Rice BYTEPIX.');
  if (!Number.isSafeInteger(blockSize) || blockSize < 1) throw new Error('Invalid FITS Rice BLOCKSIZE.');
  const { fsBits, fsMax, bBits } = parameters, wrap = 2 ** bBits, half = wrap / 2;
  const output = new Int32Array(count);
  let at = 0;
  const next = () => { if (at >= input.length) throw new Error('Truncated FITS Rice tile.'); return input[at++]!; };
  const signed = (value: number) => { const v = ((value % wrap) + wrap) % wrap; return bytePix > 1 && v >= half ? v - wrap : v; };
  let last = 0;
  for (let k = 0; k < bytePix; k++) last = last * 256 + next();
  last = signed(last);
  // `b` holds the unread low `nbits` bits of the stream; it never exceeds 2^40, so plain arithmetic stays exact.
  let b = next(), nbits = 8;
  const take = (bits: number) => { const p = 2 ** bits, v = Math.floor(b / p); b -= v * p; return v; };
  const unmap = (diff: number) => diff % 2 === 0 ? diff / 2 : -(diff + 1) / 2;
  for (let i = 0; i < count;) {
    nbits -= fsBits;
    while (nbits < 0) { b = b * 256 + next(); nbits += 8; }
    const fs = take(nbits) - 1, end = Math.min(i + blockSize, count);
    if (fs < 0) {
      for (; i < end; i++) output[i] = last;
    } else if (fs === fsMax) {
      for (; i < end; i++) {
        let need = bBits - nbits, diff = b * 2 ** need;
        for (need -= 8; need >= 0; need -= 8) diff += next() * 2 ** need;
        if (nbits > 0) { const byte = next(); diff += Math.floor(byte / 2 ** -need); b = byte % 2 ** nbits; } else b = 0;
        last = signed(unmap(diff) + last); output[i] = last;
      }
    } else {
      for (; i < end; i++) {
        while (b === 0) { nbits += 8; b = next(); }
        const zeros = nbits - (Math.floor(Math.log2(b)) + 1);
        nbits -= zeros + 1; b -= 2 ** nbits;
        nbits -= fs;
        while (nbits < 0) { b = b * 256 + next(); nbits += 8; }
        const diff = zeros * 2 ** fs + take(nbits);
        last = signed(unmap(diff) + last); output[i] = last;
      }
    }
  }
  return output;
}

function whole(header: FitsHeader, key: string, minimum = 1) {
  const value = header[key];
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) throw new Error(`Invalid FITS ${key}.`);
  return value;
}
function finite(header: FitsHeader, key: string, fallback: number) {
  if (!Object.hasOwn(header, key)) return fallback;
  const value = header[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Invalid FITS ${key}.`);
  return value;
}
function parameter(header: FitsHeader, name: string, fallback: number) {
  for (let n = 1; n < 100 && Object.hasOwn(header, `ZNAME${n}`); n++)
    if (String(header[`ZNAME${n}`]).trim() === name) return whole(header, `ZVAL${n}`);
  return fallback;
}

/** The first RICE_1 tile-compressed image in a file, decompressed to physical values with NaN for BLANK samples. */
export function readRiceCompressedImage(bytes: Buffer, options: { maxDecodedBytes?: number } = {}) {
  // JSOC writes BLANK on the compressed table itself, which the plain HDU reader rightly refuses for a table, so the
  // extension header is read directly after a validated empty primary.
  const primary = readFitsHdu(bytes);
  if (primary.count !== 0) throw new Error('Unsupported FITS compressed file: primary HDU holds data.');
  const { header, dataOffset } = readFitsHeader(bytes, primary.nextOffset);
  if (header.XTENSION !== 'BINTABLE' || header.ZIMAGE !== true || header.BITPIX !== 8 || header.NAXIS !== 2 || header.GCOUNT !== 1)
    throw new Error('No tile-compressed FITS image.');
  if (String(header.ZCMPTYPE).trim() !== 'RICE_1') throw new Error('Unsupported FITS tile compression.');
  if (['ZQUANTIZ', 'ZSCALE', 'ZZERO', 'ZBLANK'].some(key => Object.hasOwn(header, key)) || header.TFIELDS !== 1 ||
      String(header.TTYPE1).trim() !== 'COMPRESSED_DATA') throw new Error('Unsupported FITS compressed-image layout.');
  const bitpix = whole(header, 'ZBITPIX', -64);
  if (![8, 16, 32].includes(bitpix)) throw new Error('Unsupported FITS compressed ZBITPIX.');
  if (whole(header, 'ZNAXIS') !== 2) throw new Error('Unsupported FITS compressed rank.');
  const width = whole(header, 'ZNAXIS1'), height = whole(header, 'ZNAXIS2');
  const tileWidth = finite(header, 'ZTILE1', width), tileHeight = finite(header, 'ZTILE2', 1);
  if (tileWidth !== width || height % tileHeight) throw new Error('Unsupported FITS compressed tile shape.');
  const descriptor = /^1?([PQ])B\(\d+\)$/u.exec(String(header.TFORM1).trim());
  if (!descriptor) throw new Error('Unsupported FITS compressed column format.');
  const rowBytes = whole(header, 'NAXIS1'), rows = whole(header, 'NAXIS2');
  if (rowBytes !== (descriptor[1] === 'P' ? 8 : 16) || rows !== height / tileHeight) throw new Error('Invalid FITS compressed table.');
  const tableBytes = rowBytes * rows, heapGap = finite(header, 'THEAP', tableBytes) - tableBytes;
  const heap = dataOffset + tableBytes + heapGap, heapEnd = dataOffset + tableBytes + whole(header, 'PCOUNT', 0);
  if (heapGap < 0 || heapEnd > bytes.length) throw new Error('Truncated FITS compressed heap.');
  const budget = options.maxDecodedBytes ?? 512 * 1024 * 1024;
  if (width * height * 8 > budget) throw new Error('FITS decoded allocation exceeds budget.');
  const bytePix = parameter(header, 'BYTEPIX', bitpix / 8), blockSize = parameter(header, 'BLOCKSIZE', 32);
  if (bytePix !== bitpix / 8) throw new Error('Unsupported FITS Rice BYTEPIX for this ZBITPIX.');
  const scale = finite(header, 'BSCALE', 1), zero = finite(header, 'BZERO', 0);
  const blank = Object.hasOwn(header, 'BLANK') ? whole(header, 'BLANK', Number.MIN_SAFE_INTEGER) : undefined;
  const values = new Float64Array(width * height), tileCount = tileWidth * tileHeight;
  for (let row = 0; row < rows; row++) {
    const at = dataOffset + row * rowBytes;
    const length = descriptor[1] === 'P' ? bytes.readUInt32BE(at) : Number(bytes.readBigUInt64BE(at));
    const offset = descriptor[1] === 'P' ? bytes.readUInt32BE(at + 4) : Number(bytes.readBigUInt64BE(at + 8));
    if (heap + offset + length > heapEnd) throw new Error('FITS compressed tile outside heap.');
    const tile = riceDecompress(bytes.subarray(heap + offset, heap + offset + length), tileCount, blockSize, bytePix);
    for (let i = 0; i < tileCount; i++) {
      const raw = tile[i]!;
      values[row * tileCount + i] = raw === blank ? NaN : raw * scale + zero;
    }
  }
  return { header, width, height, values };
}
