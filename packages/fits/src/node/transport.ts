/** The writing half of the float32 transport image: a top-down Float32Array becomes one primary float32 HDU, bottom row
 * first as FITS stores it. It returns a Node `Buffer`, so it lives in the node entry; `decodeFits` in `../transport.ts`
 * reads it back. */
export type FitsTransportValue = string | number | boolean;

export function encodeFits(values: Float32Array, width: number, height: number,
  metadata: Record<string, FitsTransportValue>): Buffer {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || values.length !== width * height)
    throw new TypeError('Invalid FITS dimensions.');
  for (const key of Object.keys(metadata)) {
    if (/^(?:SIMPLE|BITPIX|NAXIS\d*|BZERO|BSCALE|BLANK|XTENSION|PCOUNT|GCOUNT|END|GROUPS|ZIMAGE|CONTINUE|HIERARCH)$/u.test(key))
      throw new TypeError('FITS metadata cannot override the transport layout.');
  }
  const header: Record<string, FitsTransportValue> = { SIMPLE: true, BITPIX: -32, NAXIS: 2,
    NAXIS1: width, NAXIS2: height, BZERO: 0, BSCALE: 1, ...metadata };
  const cards = Object.entries(header).map(([key, value]) => {
    if (!/^[A-Z0-9_-]{1,8}$/u.test(key)) throw new TypeError('Invalid FITS keyword.');
    if (typeof value === 'number' && !Number.isFinite(value)) throw new TypeError('Nonfinite FITS metadata.');
    const literal = typeof value === 'string' ? `'${value.replaceAll("'", "''")}'` :
      typeof value === 'boolean' ? value ? 'T' : 'F' : String(value).replace('e', 'E');
    const card = `${key.padEnd(8)}= ${literal.padStart(20)}`;
    if (card.length > 80 || !/^[\x20-\x7e]+$/u.test(card)) throw new TypeError('Invalid or oversized FITS card.');
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
