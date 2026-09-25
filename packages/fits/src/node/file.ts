/** FITS files on disk: HDU headers located without reading data, image regions read row by row, and a data-block digest.
 * Structure is validated as the byte reader in `../fits.ts` validates it. */
import { createHash } from 'node:crypto';
import { open, type FileHandle } from 'node:fs/promises';
import { integer, MAX_HEADER_RECORDS, optionalNumber, padded, readFitsHeader, RECORD, type FitsHeader } from '../fits.js';

/** One HDU of a FITS file on disk, located without reading its data. */
export interface FitsFileHdu {
  readonly header: FitsHeader; readonly cards: readonly string[];
  readonly dataStart: number; readonly dataBytes: number; readonly bitpix: number; readonly dimensions: readonly number[];
}

/** Every HDU header of a file, reading only header blocks: a level-3 archive mosaic of hundreds of megabytes is located, not
 * loaded. Structure is validated as readFitsHdu does, and the file must hold every declared data block. */
export async function readFitsFileHdus(path: string): Promise<FitsFileHdu[]> {
  const file = await open(path, 'r');
  try {
    const size = (await file.stat()).size, hdus: FitsFileHdu[] = [];
    for (let start = 0; start < size;) {
      const block = Buffer.alloc(Math.min(MAX_HEADER_RECORDS * RECORD, size - start));
      await file.read(block, 0, block.length, start);
      const { header, cards, dataOffset } = readFitsHeader(block);
      if (hdus.length ? header.XTENSION === undefined : header.SIMPLE !== true || header.XTENSION !== undefined)
        throw new Error('Invalid FITS primary/extension sequence.');
      if (header.GROUPS === true || header.ZIMAGE === true) throw new Error('Unsupported grouped or compressed FITS data.');
      const bitpix = integer(header, 'BITPIX', -64, 64), naxis = integer(header, 'NAXIS', 0, 999), dimensions: number[] = [];
      let count = naxis ? 1 : 0;
      for (let i = 1; i <= naxis; i++) { const n = integer(header, `NAXIS${i}`, 0); dimensions.push(n); count *= n; }
      const pcount = header.XTENSION !== undefined ? integer(header, 'PCOUNT', 0) : 0, gcount = header.XTENSION !== undefined ? integer(header, 'GCOUNT', 1) : 1;
      const dataBytes = (count + pcount) * gcount * Math.abs(bitpix) / 8, next = start + padded(dataOffset + dataBytes);
      if (!Number.isSafeInteger(dataBytes) || next > size) throw new Error('Truncated or unbounded FITS data or padding.');
      hdus.push({ header, cards, dataStart: start + dataOffset, dataBytes, bitpix, dimensions });
      start = next;
      if (hdus.length > 1024) throw new Error('Too many FITS HDUs.');
    }
    if (!hdus.length) throw new Error('Empty FITS file.');
    return hdus;
  } finally { await file.close(); }
}

/** One rectangle of a two-axis image HDU, read row by row from disk with BSCALE/BZERO applied and BLANK as NaN.
 * x0/y0 are zero-based FITS column and row (the first stored row is row 0).
 *
 * `handle` may be a file the caller already holds open, and that handle is then left open rather than closed here. A caller
 * reading many regions of one file, a cube plane by plane, opens it once instead of once per region: comparing two
 * 2,595-plane cubes over three passes and four extensions is 124,000 opens and closes otherwise. */
export async function readFitsFileRegion(path: string, hdu: FitsFileHdu,
  region: { x0: number; y0: number; width: number; height: number }, maxDecodedBytes = 512 * 1024 * 1024,
  handle?: FileHandle) {
  const { x0, y0, width, height } = region, [fullWidth, fullHeight] = hdu.dimensions;
  // A radio image carries frequency and Stokes axes of length one after its two sky axes: its data are still one plane.
  if (hdu.header.XTENSION === 'BINTABLE' || hdu.dimensions.length < 2 || hdu.dimensions.slice(2).some(length => length !== 1) || ![8, 16, 32, -32, -64].includes(hdu.bitpix))
    throw new Error('Unsupported FITS image region (requires a 2D numeric image, or one whose further axes have length 1).');
  if (![x0, y0, width, height].every(Number.isSafeInteger) || x0 < 0 || y0 < 0 || width < 1 || height < 1 ||
      x0 + width > fullWidth! || y0 + height > fullHeight!) throw new RangeError('FITS region outside image.');
  if (width * height * 8 > maxDecodedBytes) throw new Error('FITS decoded allocation exceeds budget.');
  const scale = optionalNumber(hdu.header, 'BSCALE', 1), zero = optionalNumber(hdu.header, 'BZERO', 0);
  const blank = hdu.bitpix > 0 && Object.hasOwn(hdu.header, 'BLANK') ? integer(hdu.header, 'BLANK', Number.MIN_SAFE_INTEGER) : undefined;
  const stride = Math.abs(hdu.bitpix) / 8, values = new Float64Array(width * height), row = Buffer.alloc(width * stride);
  const file = handle ?? await open(path, 'r');
  try {
    for (let y = 0; y < height; y++) {
      await file.read(row, 0, row.length, hdu.dataStart + ((y0 + y) * fullWidth! + x0) * stride);
      for (let x = 0; x < width; x++) {
        const o = x * stride, raw = hdu.bitpix === 8 ? row[o]! : hdu.bitpix === 16 ? row.readInt16BE(o) : hdu.bitpix === 32 ? row.readInt32BE(o) :
          hdu.bitpix === -32 ? row.readFloatBE(o) : row.readDoubleBE(o);
        values[y * width + x] = raw === blank ? NaN : scale === 1 && zero === 0 ? raw : raw * scale + zero;
      }
    }
  } finally { if (!handle) await file.close(); }
  return { ...region, values };
}

/** sha256 of one HDU's data block as stored (big-endian, before scaling), read in chunks: a pin for products whose headers
 * carry run dates and paths, so the file digest changes while the measurement does not. */
export async function sha256FitsData(path: string, hdu: FitsFileHdu): Promise<string> {
  const hash = createHash('sha256'), file = await open(path, 'r'), chunk = Buffer.alloc(8 << 20);
  try {
    for (let offset = 0; offset < hdu.dataBytes; offset += chunk.length) {
      const length = Math.min(chunk.length, hdu.dataBytes - offset);
      await file.read(chunk, 0, length, hdu.dataStart + offset);
      hash.update(chunk.subarray(0, length));
    }
  } finally { await file.close(); }
  return hash.digest('hex');
}
