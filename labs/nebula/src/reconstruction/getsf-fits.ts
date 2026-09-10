/** Minimal primary-HDU FITS transport for the offline getsf benchmark, never a science calibration. */
export type FitsValue = string | number | boolean;

function decodeValue(literal: string): FitsValue {
  if (literal.startsWith("'")) {
    let value = '';
    for (let p = 1; p < literal.length; p++) {
      if (literal[p] !== "'") { value += literal[p]; continue; }
      if (literal[p + 1] === "'") { value += "'"; p++; continue; }
      return value.trimEnd();
    }
    throw new TypeError('Unterminated FITS string.');
  }
  const value = literal.split('/')[0]!.trim();
  return value === 'T' ? true : value === 'F' ? false : Number(value.replace('D', 'E'));
}

export function encodeFits(values: Float32Array, width: number, height: number,
  metadata: Record<string, FitsValue>): Buffer {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || values.length !== width * height)
    throw new TypeError('Invalid FITS dimensions.');
  const header: Record<string, FitsValue> = { SIMPLE: true, BITPIX: -32, NAXIS: 2,
    NAXIS1: width, NAXIS2: height, BZERO: 0, BSCALE: 1, ...metadata };
  const cards = Object.entries(header).map(([key, value]) => {
    if (key.length > 8) throw new TypeError('FITS keyword too long.');
    const literal = typeof value === 'string' ? `'${value.replaceAll("'", "''")}'` :
      typeof value === 'boolean' ? value ? 'T' : 'F' : String(value);
    const card = `${key.padEnd(8)}= ${literal.padStart(20)}`;
    if (card.length > 80) throw new TypeError('FITS card too long.');
    return card.padEnd(80);
  });
  cards.push('END'.padEnd(80));
  const headerBytes = Buffer.from(cards.join('').padEnd(Math.ceil(cards.length * 80 / 2880) * 2880));
  const data = Buffer.alloc(Math.ceil(values.length * 4 / 2880) * 2880);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const value = values[(height - y - 1) * width + x]!;
    if (!Number.isFinite(value)) throw new TypeError('Nonfinite FITS sample.');
    data.writeFloatBE(value, (y * width + x) * 4);
  }
  return Buffer.concat([headerBytes, data]);
}

/** Returns DOM/top-down samples; retains signed values and rejects invalid/truncated data. */
export function decodeFits(bytes: Buffer) {
  const header: Record<string, FitsValue> = {};
  let offset = 0, ended = false;
  for (; offset + 80 <= bytes.length; offset += 80) {
    const card = bytes.toString('ascii', offset, offset + 80), key = card.slice(0, 8).trim();
    if (key === 'END') { offset += 80; ended = true; break; }
    if (card[8] !== '=') continue;
    const literal = card.slice(10).trim();
    header[key] = decodeValue(literal);
  }
  const width = Number(header.NAXIS1), height = Number(header.NAXIS2), bits = Number(header.BITPIX);
  if (!ended || header.SIMPLE !== true || header.NAXIS !== 2 || ![16, 32, -32, -64].includes(bits) ||
    !Number.isSafeInteger(width * height) || width < 1 || height < 1) throw new TypeError('Unsupported FITS image.');
  offset = Math.ceil(offset / 2880) * 2880;
  const sampleBytes = Math.abs(bits) / 8;
  if (bytes.length < offset + width * height * sampleBytes) throw new TypeError('Truncated FITS pixels.');
  const scale = Number(header.BSCALE ?? 1), zero = Number(header.BZERO ?? 0);
  const values = new Float32Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const address = offset + (y * width + x) * sampleBytes;
    const raw = bits === -32 ? bytes.readFloatBE(address) : bits === -64 ? bytes.readDoubleBE(address) :
      bits === 16 ? bytes.readInt16BE(address) : bytes.readInt32BE(address);
    const value = raw * scale + zero;
    if (!Number.isFinite(value)) throw new TypeError('Nonfinite FITS pixel.');
    values[(height - y - 1) * width + x] = value;
  }
  return { width, height, header, values };
}

export function float32LittleEndian(values: Float32Array): Buffer {
  const bytes = Buffer.alloc(values.length * 4);
  for (let p = 0; p < values.length; p++) bytes.writeFloatLE(values[p]!, p * 4);
  return bytes;
}
