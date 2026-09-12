/** FITS observation decoding and data-defined latitude/longitude/color mapping (moved from the retired static lane). */
export type FitsColor = {kind: 'signed-asinh'; palette: readonly (readonly number[])[]; softening: number; maximum: number}
  | {kind: 'positive-log'; palette: readonly (readonly number[])[]; range: readonly [number, number]};
export interface FitsMapRecipe {bitpix: number; width: number; height: number; latitude: 'sine-latitude' | 'equirectangular'; reverseLongitude?: boolean; positiveOnly?: boolean; nearestLatitudeLimit: number; color: FitsColor;}
/** Walk the 80-byte cards of one header from `start` to END; returns the data
 * offset on the next 2880-byte record boundary. `limit` bounds the scan. */
export function scanFitsCards(bytes: Buffer, start: number, visit: (key: string, card: string) => void, limit = Infinity) {
  for (let offset = start; offset + 80 <= bytes.length && offset < start + limit; offset += 80) {
    const card = bytes.toString('ascii', offset, offset + 80), key = card.slice(0, 8).trim();
    if (key === 'END') return Math.ceil((offset + 80) / 2880) * 2880;
    if (card[8] === '=') visit(key, card);
  }
  throw new Error('FITS header has no END card.');
}

/** Typed card value: quoted strings (with '' escapes), T/F logicals, and numbers with D or E exponents. */
export function fitsCardValue(card: string) {
  const s = card.slice(10).trimStart();
  if (s[0] === "'") {
    let out = '';
    for (let i = 1; i < s.length; i++) {
      if (s[i] !== "'") { out += s[i]; continue; }
      if (s[i + 1] === "'") { out += "'"; i++; continue; }
      return out.trimEnd();
    }
    throw new Error('Unterminated FITS string.');
  }
  const value = s.split('/')[0].trim();
  if (value === 'T' || value === 'F') return value === 'T';
  const n = Number(value.replaceAll('D', 'E'));
  if (!value || !Number.isFinite(n)) throw new Error('Invalid FITS scalar.');
  return n;
}

/** One header with typed values; duplicate keys are refused. Scans at most 45 records. */
export function readFitsHeader(bytes: Buffer, start = 0) {
  const header: Record<string, string | number | boolean> = {};
  const dataOffset = scanFitsCards(bytes, start, (key, card) => {
    if (Object.hasOwn(header, key)) throw new Error(`Duplicate FITS field: ${key}`);
    header[key] = fitsCardValue(card);
  }, 131040);
  return { header, dataOffset };
}

export function readFitsPrimary(bytes: Buffer) {
  // Raw card text is retained for this reader's consumers; typed values come from readFitsHeader.
  const header: Record<string, string> = {};
  const dataOffset = scanFitsCards(bytes, 0, (key, card) => { header[key] = card.slice(10).split('/')[0].trim(); });
  const bitpix = Number(header.BITPIX), width = Number(header.NAXIS1), height = Number(header.NAXIS2);
  const bytesPerValue = Math.abs(bitpix) / 8;
  if (![8, 16, -32, -64].includes(bitpix) || Number(header.NAXIS) !== 2 || !Number.isSafeInteger(width) || width < 1 || !Number.isSafeInteger(height) || height < 1 || dataOffset + width * height * bytesPerValue > bytes.length) throw new Error('Unsupported or truncated FITS image.');
  const scale = Number(header.BSCALE ?? 1), zero = Number(header.BZERO ?? 0);
  if (!Number.isFinite(scale) || !Number.isFinite(zero)) throw new Error('Invalid FITS value scaling.');
  const values = new Float64Array(width * height);
  for (let index = 0; index < values.length; index++) {
    const value = bitpix === 8 ? bytes[dataOffset + index] : bitpix === 16 ? bytes.readInt16BE(dataOffset + index * 2) : bitpix === -32
      ? bytes.readFloatBE(dataOffset + index * bytesPerValue) : bytes.readDoubleBE(dataOffset + index * bytesPerValue);
    values[index] = value * scale + zero;
  }
  return { bitpix, width, height, values, scale, zero, header, dataOffset,
    nextOffset: Math.ceil((dataOffset + width * height * bytesPerValue) / 2880) * 2880 };
}

export function prepareFitsMap(bytes: Buffer, width: number, height: number, recipe: FitsMapRecipe) {
  const fits = readFitsPrimary(bytes);
  if (fits.bitpix !== recipe.bitpix || fits.width !== recipe.width || fits.height !== recipe.height) throw new Error('Pinned synoptic FITS geometry changed.');
  if (!['sine-latitude', 'equirectangular'].includes(recipe.latitude)) throw new TypeError('Unsupported synoptic latitude mapping.');
  const output = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const latitude = Math.PI / 2 - (y + 0.5) / height * Math.PI;
    const sourceY = recipe.latitude === 'sine-latitude'
      ? clamp(Math.round((Math.sin(latitude) + 1) / 2 * (fits.height - 1)), 0, fits.height - 1)
      : clamp(Math.round((1 - (y + 0.5) / height) * fits.height), 0, fits.height - 1);
    for (let x = 0; x < width; x++) {
      const fraction = (x + 0.5) / width;
      const sourceX = modulo(Math.round((recipe.reverseLongitude ? 1 - fraction : fraction) * fits.width), fits.width);
      const value = nearestValidValue(fits, sourceX, sourceY, recipe);
      const color = scientificFalseColor(value, recipe.color);
      const offset = (y * width + x) * 4;
      output.set(color, offset); output[offset + 3] = 255;
    }
  }
  return output;
}

export function scientificFalseColor(value: number, color: FitsColor): readonly number[] {
  if (color.kind === 'signed-asinh') {
    const [negative, neutral, positive] = color.palette;
    if (!Number.isFinite(value)) return neutral;
    const signed = clamp(Math.asinh(value / color.softening) / Math.asinh(color.maximum / color.softening), -1, 1);
    const end = signed < 0 ? negative : positive, amount = Math.abs(signed);
    return neutral.map((channel, index) => Math.round(channel + (end[index] - channel) * amount));
  }
  if (color.kind !== 'positive-log') throw new TypeError('Unsupported scientific color transform.');
  const safe = Number.isFinite(value) && value > 0 ? value : 0;
  const normalized = safe === 0 ? 0 : clamp((Math.log(safe) - Math.log(color.range[0])) / (Math.log(color.range[1]) - Math.log(color.range[0])), 0, 1);
  const scaled = normalized * (color.palette.length - 1), left = Math.min(color.palette.length - 2, Math.floor(scaled)), amount = scaled - left;
  return color.palette[left].map((channel, index) => Math.round(channel + (color.palette[left + 1][index] - channel) * amount));
}

function nearestValidValue(fits: ReturnType<typeof readFitsPrimary>, x: number, y: number, recipe: FitsMapRecipe) {
  const valid = (value: number) => Number.isFinite(value) && (!recipe.positiveOnly || value > 0);
  const direct = fits.values[y * fits.width + x];
  if (valid(direct)) return direct;
  for (let distance = 1; distance <= recipe.nearestLatitudeLimit; distance++) {
    for (const candidateY of [y - distance, y + distance]) {
      if (candidateY < 0 || candidateY >= fits.height) continue;
      const candidate = fits.values[candidateY * fits.width + x];
      if (valid(candidate)) return candidate;
    }
  }
  return 0;
}
const modulo = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor;
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
