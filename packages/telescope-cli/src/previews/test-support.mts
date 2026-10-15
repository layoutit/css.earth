/** Tiny FITS fixtures are constructed in memory, never downloaded by tests. */
export type Card = readonly [string, string | number | boolean];
export function header(cards: readonly Card[]): Buffer {
  const text = [...cards.map(([key, value]) => `${key.padEnd(8)}= ${typeof value === 'string' ? `'${value}'` : typeof value === 'boolean' ? value ? 'T' : 'F' : value}`.padEnd(80)), 'END'.padEnd(80)].join('');
  return Buffer.from(text.padEnd(Math.ceil(text.length / 2880) * 2880));
}
function padded(bytes: Buffer): Buffer { const block = Buffer.alloc(Math.ceil(bytes.length / 2880) * 2880); bytes.copy(block); return block; }
export function image(dimensions: readonly number[], values: readonly number[], extra: readonly Card[] = [], bitpix: -32 | 16 = -32): Buffer {
  const stride = Math.abs(bitpix) / 8, bytes = Buffer.alloc(values.length * stride);
  values.forEach((value, i) => { if (bitpix === 16) bytes.writeInt16BE(value, i * stride); else bytes.writeFloatBE(value, i * stride); });
  return Buffer.concat([header([['SIMPLE', true], ['BITPIX', bitpix], ['NAXIS', dimensions.length], ...dimensions.map((size, i): Card => [`NAXIS${i + 1}`, size]), ...extra]), padded(bytes)]);
}
interface FixtureColumn { readonly name: string; readonly form: string; readonly unit?: string }
export function spectrumTable(columns: readonly FixtureColumn[], rows: readonly (readonly (readonly number[])[])[], extra: readonly Card[] = [], primary: readonly Card[] = []): Buffer {
  const specs = columns.map(column => {
    const match = /^(\d+)([DEIJB])$/u.exec(column.form);
    if (!match) throw new Error('Invalid test table column.');
    return { ...column, repeat: Number(match[1]), type: match[2], stride: match[2] === 'D' ? 8 : match[2] === 'I' ? 2 : match[2] === 'B' ? 1 : 4 };
  });
  const rowBytes = specs.reduce((sum, column) => sum + column.repeat * column.stride, 0), bytes = Buffer.alloc(rowBytes * rows.length);
  rows.forEach((row, r) => {
    let at = r * rowBytes;
    specs.forEach((column, c) => {
      if (row[c]?.length !== column.repeat) throw new Error('Invalid test table row.');
      for (const value of row[c]) {
        if (column.type === 'D') bytes.writeDoubleBE(value, at); else if (column.type === 'E') bytes.writeFloatBE(value, at);
        else if (column.type === 'I') bytes.writeInt16BE(value, at); else if (column.type === 'J') bytes.writeInt32BE(value, at); else bytes.writeUInt8(value, at);
        at += column.stride;
      }
    });
  });
  return Buffer.concat([header([['SIMPLE', true], ['BITPIX', 8], ['NAXIS', 0], ...primary]),
    header([['XTENSION', 'BINTABLE'], ['BITPIX', 8], ['NAXIS', 2], ['NAXIS1', rowBytes], ['NAXIS2', rows.length], ['PCOUNT', 0], ['GCOUNT', 1], ['TFIELDS', columns.length],
      ...specs.flatMap((column, i): Card[] => [[`TTYPE${i + 1}`, column.name], [`TFORM${i + 1}`, column.form], [`TUNIT${i + 1}`, column.unit ?? '']]), ...extra]), padded(bytes)]);
}
export const esoSpectrum = () => spectrumTable([{ name: 'WAVE', form: '4D', unit: 'angstrom' }, { name: 'FLUX_REDUCED', form: '4E', unit: 'adu' }], [[[3000, 3100, 3200, 3300], [4, -2, 6, 3]]], [], [['PRODCATG', 'SCIENCE.SPECTRUM']]);
export const hstSpectrum = () => spectrumTable([{ name: 'NELEM', form: '1I' }, { name: 'WAVELENGTH', form: '4D', unit: 'Angstroms' }, { name: 'FLUX', form: '4E', unit: 'erg/s/cm**2/Angstrom' }], [[[3], [2000, 2100, 2200, 0], [1e-11, 2e-11, -1e-11, 0]]]);
export const cube = () => image([2, 2, 3, 1], [1, 2, 3, 4, 4, NaN, 2, 1, -1, -2, -3, -4], [['CTYPE3', 'FREQ'], ['CUNIT3', 'Hz'], ['CRVAL3', 211e9], ['CDELT3', 1e9], ['CRPIX3', 2], ['BUNIT', 'Jy/beam']]);
export const continuum = () => image([3, 3, 1, 1], [0, 0, 0, 0, 1, 0, 0, 0, 16]);
