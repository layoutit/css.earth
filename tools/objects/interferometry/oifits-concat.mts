/** Concatenate several calibrated OIFITS files of one target into one file, byte for byte: every OI_ARRAY, OI_WAVELENGTH,
 * OI_VIS2 and OI_T3 table is copied as it is, with its INSNAME and ARRNAME suffixed by the file's index so tables from
 * different files never share a name, and one OI_TARGET is kept. Nothing is averaged, rescaled or re-weighted; flags travel
 * with their rows. This is the input an image-reconstruction code reads when the observations span several nights and
 * configurations but the authors published no merged file. */
import { readFitsHdus, type FitsHdu } from './fits-table.mts';

const BLOCK = 2880, CARD = 80;

function cardValue(bytes: Buffer, hdu: FitsHdu, key: string): { start: number; text: string } | null {
  // Header cards run from the HDU's header start to its END card; the header start is the previous data end.
  const headerStart = hdu.dataOffset - Math.ceil(headerLength(bytes, hdu) / BLOCK) * BLOCK;
  for (let at = headerStart; at < hdu.dataOffset; at += CARD) {
    const card = bytes.toString('latin1', at, at + CARD);
    if (card.slice(0, 8).trim() === key && card[8] === '=') return { start: at, text: card };
    if (card.slice(0, 8).trim() === 'END') break;
  }
  return null;
}

function headerLength(bytes: Buffer, hdu: FitsHdu): number {
  // Walk back from the data offset in blocks until a block that contains the header's first card (SIMPLE or XTENSION).
  let blocks = 1;
  for (;;) {
    const start = hdu.dataOffset - blocks * BLOCK;
    const first = bytes.toString('latin1', start, start + 8).trim();
    if (first === 'SIMPLE' || first === 'XTENSION') return blocks * BLOCK;
    if (start <= 0 || blocks > 64) throw new Error('Could not find the header start.');
    blocks++;
  }
}

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
      const length = headerLength(bytes, hdu), headerStart = hdu.dataOffset - length;
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
