/** Preparation-only FITS subset. No projection, calibration, display orientation,
 * table-column interpretation or compression is inferred here. Bytes arrive as a `Uint8Array` and are read through a
 * big-endian `DataView`, so this module needs no host built-ins. */
export type FitsValue = string | number | boolean | undefined;
export type FitsHeader = Record<string, FitsValue>;
export const RECORD = 2880;
const CARD = 80;
export const padded = (size: number) => Math.ceil(size / RECORD) * RECORD;
/** One byte per character, as the `latin1` decoding of an archive's header records. */
const latin1 = (bytes: Uint8Array, start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

/** HIERARCH names retain their namespace and have at least two words, so they never replace ordinary structural keys. ESO pipelines
 * write namespaces other than ESO (MATISSE's `PRO DISP COEF0`) and lower-case letters after the first word (GRAVITY's `MET OFFVOLT FC1FTx`). */
export function esoHierarchy(card: string) {
  const equals = card.indexOf('=', 9), name = card.slice(9, equals).trim();
  if (card[8] !== ' ' || equals < 10 || !/^[A-Z][A-Z0-9_-]*(?: +[A-Za-z0-9_-]+)+$/u.test(name))
    throw new Error('Unsupported or malformed FITS HIERARCH name.');
  return { key: name.replace(/ +/gu, ' '), valueStart: equals + 1 };
}

/** Scan value cards, leaving repeatable COMMENT/HISTORY cards alone. A string value
 * ending in `&` may continue on the CONTINUE cards that immediately follow it
 * (FITS 4.0, section 4.2.1.2); those records reach the visitor with their value card. */
/** ESO raw primaries reach 2,480 cards (MATISSE, GRAVITY), so the bound is 256 records (9,216 cards), not the 64 a product header needs. */
export const MAX_HEADER_RECORDS = 256;
export function scanFitsCards(bytes: Uint8Array, start: number, visit: (key: string, card: string, continuation: readonly string[]) => void, limit = MAX_HEADER_RECORDS * RECORD) {
  if (!Number.isSafeInteger(start) || start < 0 || start % RECORD || start >= bytes.length)
    throw new Error('Invalid FITS header offset.');
  const stop = Math.min(bytes.length, start + Math.min(limit, MAX_HEADER_RECORDS * RECORD));
  let pending: [string, string, string[]] | undefined;
  const flush = () => { if (pending) visit(...pending); pending = undefined; };
  for (let offset = start; offset + CARD <= stop; offset += CARD) {
    const card = latin1(bytes, offset, offset + CARD), key = card.slice(0, 8).trim();
    if (!/^[\x20-\x7e]{80}$/u.test(card)) throw new Error('Invalid FITS header characters.');
    if (key === 'CONTINUE') {
      if (!pending || card.slice(8, 10) !== '  ') throw new Error('Unsupported FITS CONTINUE convention.');
      pending[2].push(card); continue;
    }
    flush();
    if (key === 'END') {
      if (card.slice(8).trim()) throw new Error('Invalid FITS END card.');
      const end = padded(offset + CARD);
      if (end > bytes.length) throw new Error('Truncated FITS header padding.');
      return end;
    }
    if (key === 'HIERARCH') { pending = [esoHierarchy(card).key, card, []]; continue; }
    // COMMENT and HISTORY are commentary whatever follows them (FITS 4.0, section 4.4.2.4): drizzlepac writes rules of `=`.
    if (card[8] === '=' && key !== 'COMMENT' && key !== 'HISTORY') {
      // Released SDO synoptic ORIGIN/TELESCOP cards put the opening quote in
      // column 10. Preserve this bounded archive exception without losing it.
      if (!/^[A-Z0-9_-]{1,8}$/u.test(key) || (card[9] !== ' ' && card[9] !== "'")) throw new Error('Invalid FITS value card.');
      pending = [key, card, []];
    }
  }
  throw new Error('FITS header has no END card within the bounded scan.');
}

/** Quoted slashes are data; doubled quotes are escapes; an empty value is undefined.
 * Each CONTINUE record replaces the final `&` of the string so far with its own string. */
export function fitsCardValue(card: string, continuation: readonly string[] = []): FitsValue {
  let value = fitsLiteral(card.slice(card.startsWith('HIERARCH') ? esoHierarchy(card).valueStart : 9), card);
  for (const next of continuation) {
    if (typeof value !== 'string' || !value.endsWith('&')) throw new Error('Unsupported FITS CONTINUE convention.');
    const part = fitsLiteral(next.slice(10), next);
    if (typeof part !== 'string') throw new Error('Unsupported FITS CONTINUE convention.');
    value = value.slice(0, -1) + part;
  }
  return value;
}

function fitsLiteral(field: string, card: string): FitsValue {
  const text = field.trimStart();
  if (text[0] === "'") {
    let value = '';
    for (let i = 1; i < text.length; i++) {
      if (text[i] !== "'") { value += text[i]; continue; }
      if (text[i + 1] === "'") { value += "'"; i++; continue; }
      if (text.slice(i + 1).trimStart() && !text.slice(i + 1).trimStart().startsWith('/'))
        throw new Error('Invalid FITS string suffix.');
      return value.trimEnd();
    }
    throw new Error('Unterminated FITS string.');
  }
  const value = text.split('/')[0].trim();
  if (!value) return undefined;
  if (value === 'T' || value === 'F') return value === 'T';
  // SDO's released synoptic headers also contain unquoted JSOC TAI times.
  // Preserve their literal text; this is not time-system interpretation.
  if (['T_OBS', 'T_START', 'T_STOP'].includes(card.slice(0, 8).trim()) &&
      /^\d{4}\.\d{1,2}\.\d{1,2}_\d{1,2}:\d{1,2}:\d{1,2}(?:\.\d+)?_TAI$/u.test(value)) return value;
  // ESO instruments write lower-case exponents (AMBER's `3.000e-05`); Astropy reads them as the standard's E and D.
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[DEde][+-]?\d+)?$/u.test(value)) throw new Error('Invalid or unsupported FITS scalar.');
  const number = Number(value.replace(/[Dd]/u, 'E'));
  if (!Number.isFinite(number) || (/^[+-]?\d+$/u.test(value) && !Number.isSafeInteger(number)))
    throw new Error('FITS scalar exceeds numeric precision.');
  return number;
}

export function readFitsHeader(bytes: Uint8Array, start = 0) {
  const header: FitsHeader = {};
  const dataOffset = scanFitsCards(bytes, start, (key, card, continuation) => {
    if (Object.hasOwn(header, key)) throw new Error(`Duplicate FITS field: ${key}`);
    header[key] = fitsCardValue(card, continuation);
  });
  // Preserve original 80-byte records, including commentary and END, separately
  // from parsed values. Do not rewrite or strip the archived header.
  const cards: string[] = [];
  for (let offset = start; offset < dataOffset; offset += CARD) {
    const card = latin1(bytes, offset, offset + CARD); cards.push(card);
    if (card.slice(0, 8).trim() === 'END') break;
  }
  return { header, cards, dataOffset };
}

export function integer(header: FitsHeader, key: string, minimum: number, maximum = Number.MAX_SAFE_INTEGER) {
  const value = header[key];
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum)
    throw new Error(`Invalid FITS ${key}.`);
  return value;
}
export function optionalNumber(header: FitsHeader, key: string, fallback: number) {
  if (!Object.hasOwn(header, key)) return fallback;
  const value = header[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Invalid FITS ${key} scaling.`);
  return value;
}

/** Validate one complete HDU, including its padded extent. Tables remain opaque. */
export function readFitsHdu(bytes: Uint8Array, start = 0) {
  const { header, cards, dataOffset } = readFitsHeader(bytes, start);
  const kind = header.XTENSION;
  if (kind === undefined ? header.SIMPLE !== true : !['IMAGE', 'BINTABLE'].includes(String(kind)))
    throw new Error('Unsupported FITS HDU identity.');
  if (header.GROUPS === true || header.ZIMAGE === true) throw new Error('Unsupported grouped or compressed FITS data.');
  const bitpix = integer(header, 'BITPIX', -64, 64);
  if (![8, 16, 32, 64, -32, -64].includes(bitpix)) throw new Error('Unsupported FITS BITPIX.');
  const naxis = integer(header, 'NAXIS', 0, 999), dimensions: number[] = [];
  let count = naxis ? 1 : 0;
  for (let i = 1; i <= naxis; i++) {
    const size = integer(header, `NAXIS${i}`, 0);
    dimensions.push(size); count *= size;
    if (!Number.isSafeInteger(count)) throw new Error('Unbounded FITS dimensions.');
  }
  const pcount = kind !== undefined ? integer(header, 'PCOUNT', 0) : 0;
  const gcount = kind !== undefined ? integer(header, 'GCOUNT', 1) : 1;
  if (kind === 'IMAGE' && (pcount !== 0 || gcount !== 1)) throw new Error('Unsupported FITS image groups.');
  if (kind === 'BINTABLE' && (bitpix !== 8 || naxis !== 2 || gcount !== 1)) throw new Error('Invalid FITS binary table layout.');
  const dataBytes = (count + pcount) * gcount * Math.abs(bitpix) / 8;
  const nextOffset = padded(dataOffset + dataBytes);
  if (!Number.isSafeInteger(dataBytes) || !Number.isSafeInteger(nextOffset) || nextOffset > bytes.length)
    throw new Error('Truncated or unbounded FITS data or padding.');
  const scale = optionalNumber(header, 'BSCALE', 1), zero = optionalNumber(header, 'BZERO', 0);
  let blank: number | undefined;
  const warnings: string[] = [];
  if (Object.hasOwn(header, 'BLANK')) {
    if (kind === 'BINTABLE') throw new Error('Invalid FITS BLANK for binary table.');
    if (bitpix < 0) {
      integer(header, 'BLANK', Number.MIN_SAFE_INTEGER);
      // SDO float64 maps contain this invalid card. Like Astropy, do not turn
      // matching finite floats into holes: floating-point missing data is NaN.
      warnings.push('BLANK ignored on floating-point image; only NaN denotes undefined samples.');
    } else {
      const min = bitpix === 8 ? 0 : -(2 ** (bitpix - 1));
      const max = bitpix === 8 ? 255 : 2 ** (bitpix - 1) - 1;
      blank = integer(header, 'BLANK', min, max);
    }
  }
  return { header, cards, dataOffset, nextOffset, dataBytes, bitpix, dimensions, count, scale, zero, blank, warnings };
}

export function readFitsHdus(bytes: Uint8Array) {
  const hdus: ReturnType<typeof readFitsHdu>[] = [];
  for (let start = 0; start < bytes.length;) {
    const hdu = readFitsHdu(bytes, start);
    if (hdus.length ? hdu.header.XTENSION === undefined : hdu.header.SIMPLE !== true || hdu.header.XTENSION !== undefined)
      throw new Error('Invalid FITS primary/extension sequence.');
    hdus.push(hdu); start = hdu.nextOffset;
    if (hdus.length > 1024) throw new Error('Too many FITS HDUs.');
  }
  if (!hdus.length) throw new Error('Empty FITS file.');
  return hdus;
}

/** The sky axes of an image whose extra axes are degenerate, or undefined when an axis past the third holds more than one sample. */
export function imageExtent(dimensions: readonly number[]) {
  const extent = dimensions.length > 3 && dimensions.slice(3).every(length => length === 1) ? dimensions.slice(0, 3) : [...dimensions];
  return extent.length === 2 || extent.length === 3 ? extent : undefined;
}

/** Bounded, zero-copy sample access, retaining native axis order and NaN missingness. */
export function fitsImageAccessor(bytes: Uint8Array, hdu = readFitsHdu(bytes)) {
  // An image may keep degenerate trailing axes: every ALMA product is NAXIS = 4, one frequency and one Stokes plane over the
  // sky axes. Those axes hold one sample each, so the sample order is the 2D/3D order and only the declared rank differs.
  if (hdu.header.XTENSION === 'BINTABLE' || ![8, 16, 32, -32, -64].includes(hdu.bitpix) ||
      !imageExtent(hdu.dimensions) || hdu.dimensions.some(n => n < 1))
    throw new Error('Unsupported FITS image (requires 2D/3D numeric image, not int64).');
  const stride = Math.abs(hdu.bitpix) / 8, data = view(bytes);
  return (index: number) => {
    if (!Number.isSafeInteger(index) || index < 0 || index >= hdu.count) throw new RangeError('FITS sample outside image.');
    const offset = hdu.dataOffset + index * stride;
    const raw = hdu.bitpix === 8 ? bytes[offset] : hdu.bitpix === 16 ? data.getInt16(offset) :
      hdu.bitpix === 32 ? data.getInt32(offset) : hdu.bitpix === -32 ? data.getFloat32(offset) : data.getFloat64(offset);
    return raw === hdu.blank ? NaN : hdu.scale === 1 && hdu.zero === 0 ? raw : raw * hdu.scale + hdu.zero;
  };
}

/** A 1-based plane, with an explicit 512 MiB decoded-allocation ceiling. */
export function readFitsImage(bytes: Uint8Array, options: { start?: number; plane?: number; maxDecodedBytes?: number } = {}) {
  const hdu = readFitsHdu(bytes, options.start ?? 0), at = fitsImageAccessor(bytes, hdu);
  const [width, height] = hdu.dimensions, planes = hdu.dimensions[2] ?? 1, plane = options.plane ?? 1;
  const size = width * height, budget = options.maxDecodedBytes ?? 512 * 1024 * 1024;
  if (!Number.isSafeInteger(budget) || budget < 0 || size * 8 > budget) throw new Error('FITS decoded allocation exceeds budget.');
  if (!Number.isSafeInteger(plane) || plane < 1 || plane > planes) throw new Error('Invalid FITS plane selection.');
  const values = new Float64Array(size), start = (plane - 1) * size;
  for (let i = 0; i < size; i++) values[i] = at(start + i);
  return { ...hdu, width, height, planes, values };
}

/** Compatibility for older product adapters that consume quoted card literals. */
export function fitsHeaderLiterals(header: FitsHeader): Record<string, string> {
  return Object.fromEntries(Object.entries(header).filter(([, value]) => value !== undefined).map(([key, value]) => [key,
    typeof value === 'string' ? `'${value.replaceAll("'", "''")}'` : typeof value === 'boolean' ? value ? 'T' : 'F' : String(value)]));
}

/** Historical name: accepts one 2D primary OR IMAGE-extension HDU. The header comes back as quoted card literals
 * (`fitsHeaderLiterals`) for the product adapters that read them. */
export function readFitsPrimary(bytes: Uint8Array) {
  const image = readFitsImage(bytes);
  if (image.dimensions.length !== 2) throw new Error('Unsupported FITS image: expected two dimensions.');
  return { ...image, header: fitsHeaderLiterals(image.header) };
}

/** One 1-based primary-array plane; native FITS row order is preserved. The header comes back as quoted card literals. */
export function readFitsPlane(bytes: Uint8Array, plane = 1) {
  const image = readFitsImage(bytes, { plane });
  if (image.header.SIMPLE !== true || image.header.XTENSION !== undefined) throw new Error('Expected FITS primary array.');
  return { ...image, header: fitsHeaderLiterals(image.header) };
}

/** Our fixed facet-table profiles do not implement column calibration or nulls. */
export function assertUnscaledFitsTable(header: FitsHeader) {
  if (Object.keys(header).some(key => /^(?:TSCAL|TZERO|TNULL)\d+$/u.test(key)))
    throw new Error('Unsupported FITS table column scaling or null convention.');
}
