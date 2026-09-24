/** Authored malformed and edge-case FITS bytes for this package's tests; independent valid files come from Astropy and
 * are compared in tools/oracles/fits/. Test-only: excluded from the build and the browser-safe entry checks. */
export const card = (key: string, literal: string) => `${key.padEnd(8)}= ${literal}`.padEnd(80);

export function imageFixture(bitpix = 16, values: readonly number[] = [-2, 0, 1, 3], extra: readonly string[] = []) {
  const header = Buffer.from([card('SIMPLE', 'T'), card('BITPIX', String(bitpix)), card('NAXIS', '2'),
    card('NAXIS1', '2'), card('NAXIS2', String(values.length / 2)), ...extra, 'END'.padEnd(80)].join('').padEnd(2880));
  const data = Buffer.alloc(Math.ceil(values.length * Math.abs(bitpix) / 8 / 2880) * 2880);
  values.forEach((v, i) => {
    if (bitpix === 8) data.writeUInt8(v, i);
    else if (bitpix === 16) data.writeInt16BE(v, i * 2);
    else if (bitpix === 32) data.writeInt32BE(v, i * 4);
    else if (bitpix === -32) data.writeFloatBE(v, i * 4);
    else if (bitpix === -64) data.writeDoubleBE(v, i * 8);
  });
  return Buffer.concat([header, data]);
}
