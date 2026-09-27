/** Reading an HST product's structure when its headers repeat a keyword, which the shared reader refuses.
 *
 * Two archive conventions do repeat one. A WFC3 `_flc` science extension carries the FITS distortion records `D2IM1`, `D2IM2`,
 * `DP1` and `DP2` four times each, because that convention encodes a small structure in cards that share a keyword and put the
 * field name in the value. An ACS association table repeats `NEXTEND` in its primary header.
 *
 * A drizzled product also writes rules across its HISTORY cards (`HISTORY ====...`), which puts an equals sign in the column a
 * value card keeps it in. HISTORY and COMMENT are commentary and carry no value at all, so before the block is scanned those
 * cards are blanked from that column on, in a copy, and the scan then passes over them as the commentary they are. Nothing
 * moves: a card stays 80 bytes and every offset is the file's own.
 *
 * None of it is read here: the comparison needs an extension's name, version, shape, type and scaling, and nothing that repeats
 * carries those. So the first card of a repeated keyword is kept, the keywords that repeated are reported, and a receipt says
 * so. Cards themselves are parsed by the repository's one FITS reader (@cssearth/fits); only where each unit begins and ends is
 * worked out here, from the structural keywords the standard fixes.
 *
 * A file whose headers repeat nothing reads exactly as `readFitsFileHdus` reads it. */
import { open } from 'node:fs/promises';
import { fitsCardValue, scanFitsCards, type FitsHeader, type FitsValue } from '@cssearth/fits';
import type { FitsFileHdu } from '@cssearth/fits/node';

const RECORD = 2880;
const MAX_HEADER_RECORDS = 256;
const CARD = 80;
const padded = (size: number) => Math.ceil(size / RECORD) * RECORD;
const COMMENTARY = new Set(['HISTORY ', 'COMMENT ', '        ']);

/** A copy of the block in which every commentary card is blank from column 9 on, so a rule drawn across a HISTORY card cannot
 * be read as a value. Every other byte, and every offset, is the file's own. */
function commentaryBlanked(block: Buffer, start: number) {
  const copy = Buffer.from(block);
  for (let offset = start; offset + CARD <= copy.length; offset += CARD) {
    if (!COMMENTARY.has(copy.toString('latin1', offset, offset + 8))) continue;
    copy.fill(0x20, offset + 8, offset + CARD);
  }
  return copy;
}

export interface HstFileHdu extends FitsFileHdu { readonly repeatedCards: readonly string[] }

function integer(header: FitsHeader, key: string, fallback?: number) {
  const value = header[key] ?? fallback;
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new Error(`Invalid or absent FITS ${key}.`);
  return value;
}

/** One header block's fields, the keywords it repeated, and where its data begins. */
export function readRepeatingHeader(block: Buffer, start = 0) {
  const header: FitsHeader = {}, repeated = new Set<string>();
  const scanned = commentaryBlanked(block, start);
  const dataOffset = scanFitsCards(scanned, start, (key, card, continuation) => {
    if (Object.hasOwn(header, key)) { repeated.add(key); return; }
    header[key] = fitsCardValue(card, continuation) as FitsValue;
  });
  return { header, repeatedCards: [...repeated].sort(), dataOffset };
}

/** Every HDU of a product on disk, reading only its header blocks. Structure is checked as the standard states it: the first
 * unit is a primary, every later one an extension, and the file must hold every declared data block. */
export async function readHstFileHdus(path: string): Promise<HstFileHdu[]> {
  const file = await open(path, 'r');
  try {
    const size = (await file.stat()).size, hdus: HstFileHdu[] = [];
    for (let start = 0; start < size;) {
      const block = Buffer.alloc(Math.min(MAX_HEADER_RECORDS * RECORD, size - start));
      await file.read(block, 0, block.length, start);
      const { header, repeatedCards, dataOffset } = readRepeatingHeader(block);
      if (hdus.length ? header.XTENSION === undefined : header.SIMPLE !== true || header.XTENSION !== undefined)
        throw new Error(`${path}: invalid FITS primary/extension sequence.`);
      if (header.GROUPS === true || header.ZIMAGE === true) throw new Error(`${path}: unsupported grouped or compressed FITS data.`);
      const bitpix = integer(header, 'BITPIX'), naxis = integer(header, 'NAXIS'), dimensions: number[] = [];
      if (![8, 16, 32, 64, -32, -64].includes(bitpix) || naxis < 0 || naxis > 999) throw new Error(`${path}: unsupported FITS BITPIX or NAXIS.`);
      let count = naxis ? 1 : 0;
      for (let i = 1; i <= naxis; i++) {
        const length = integer(header, `NAXIS${i}`);
        if (length < 0) throw new Error(`${path}: invalid FITS NAXIS${i}.`);
        dimensions.push(length); count *= length;
        if (!Number.isSafeInteger(count)) throw new Error(`${path}: unbounded FITS dimensions.`);
      }
      const extension = header.XTENSION !== undefined;
      const dataBytes = (count + (extension ? integer(header, 'PCOUNT', 0) : 0)) * (extension ? integer(header, 'GCOUNT', 1) : 1) * Math.abs(bitpix) / 8;
      const next = start + padded(dataOffset + dataBytes);
      if (!Number.isSafeInteger(dataBytes) || dataBytes < 0 || next > size) throw new Error(`${path}: truncated or unbounded FITS data or padding.`);
      hdus.push({ header, cards: [], dataStart: start + dataOffset, dataBytes, bitpix, dimensions, repeatedCards });
      start = next;
      if (hdus.length > 1024) throw new Error(`${path}: too many FITS HDUs.`);
    }
    if (!hdus.length) throw new Error(`${path} is an empty FITS file.`);
    return hdus;
  } finally { await file.close(); }
}
