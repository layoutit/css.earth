/** One polarimetric ESPaDOnS product as the Canadian Astronomy Data Centre serves it: the spectrum CFHT's Upena pipeline
 * reduced with Libre-ESpRIT (Donati et al. 1997) from a sequence of four sub-exposures.
 *
 * The file `<odometer>p.fits` is one float image of 24 rows by one column for each pixel of every spectral order, 20.6 MB.
 * Its header names the rows (COL1 to COL24); the first six are what is read here, the normalised spectrum with the
 * pipeline's automatic wavelength correction:
 *
 *   row 0  wavelength in nm (orders follow one another and overlap)
 *   row 1  intensity over the continuum
 *   row 2  Stokes V over the continuum
 *   row 3  the first null check (the sub-exposures combined so that a real signal cancels)
 *   row 4  the second null check
 *   row 5  the error bar of a pixel
 *
 * DATE1 to DATE4 are when each sub-exposure was written, at its end, and EXPTIME1 to EXPTIME4 how long each lasted. The
 * mid-exposure times this gives agree to the second with the ones Fares et al. (2010, MNRAS 406, 409) print for fourteen
 * of these files (espadons.test.mts holds three). */
export const NORMALISED_ROWS = 6;

export interface PolarisedSpectrum {
  /** Mid-exposure, as a Modified Julian Date in UTC. */
  readonly mjd: number; readonly exposureSeconds: number; readonly object: string;
  readonly wavelengthNm: Float32Array; readonly intensity: Float32Array; readonly stokesV: Float32Array; readonly check: Float32Array; readonly error: Float32Array;
}

/** The header's cards up to END, and where the data start, from the first bytes of the file. Undefined when END is not in them. */
export function headerOf(bytes: Uint8Array): { readonly cards: readonly string[]; readonly dataOffset: number } | undefined {
  const text = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('latin1'), cards: string[] = [];
  for (let i = 0; i + 80 <= text.length; i += 80) { const card = text.slice(i, i + 80); if (card.startsWith('END') && !card.slice(3).trim()) return { cards, dataOffset: Math.ceil((i + 80) / 2880) * 2880 }; cards.push(card.trimEnd()); }
  return undefined;
}
const cardValue = (cards: readonly string[], key: string) => { const card = cards.find(one => one.startsWith(`${key.padEnd(8)}=`)); if (!card) return undefined;
  const value = card.slice(10), quoted = /^\s*'((?:[^']|'')*)'/u.exec(value); return (quoted ? quoted[1]!.replaceAll("''", "'") : value.split('/')[0]!).trim(); };

/** What a product's header says of its layout and its time. A file that is not a polarimetric product is refused by what it lacks. */
export function describeProduct(cards: readonly string[]) {
  const number = (key: string) => { const found = Number(cardValue(cards, key)); if (!Number.isFinite(found)) throw new TypeError(`The header has no numeric ${key}.`); return found; };
  const pixels = number('NAXIS1'), rows = number('NAXIS2');
  if (number('BITPIX') !== -32 || number('NAXIS') !== 2) throw new TypeError('A polarimetric product is one image of 32-bit floats.');
  const named = ['Wavelength', 'Intensity', 'Stokes', 'CheckN1', 'CheckN2', 'ErrorBar'];
  named.forEach((name, i) => { if (cardValue(cards, `COL${i + 1}`) !== name) throw new TypeError(`Row ${i + 1} is ${cardValue(cards, `COL${i + 1}`) ?? 'unnamed'}, not ${name}: not a polarimetric product with normalised rows first.`); });
  if (rows < NORMALISED_ROWS) throw new TypeError(`The product has ${rows} rows.`);
  const ends: number[] = [], lengths: number[] = [];
  for (let k = 1; k <= 4; k++) { const written = cardValue(cards, `DATE${k}`), length = Number(cardValue(cards, `EXPTIME${k}`)); if (written === undefined || !Number.isFinite(length)) break;
    const end = Date.parse(`${written}Z`); if (!Number.isFinite(end)) throw new TypeError(`DATE${k} ${written} is not a date.`); ends.push(end / 86400000 + 40587); lengths.push(length); }
  if (ends.length !== 4) throw new TypeError(`The header times ${ends.length} sub-exposures; a polarimetric sequence has four.`);
  return { pixels, rows, object: cardValue(cards, 'OBJECT') ?? '', exposureSeconds: lengths.reduce((s, v) => s + v, 0), mjd: ends.reduce((s, end, k) => s + end - lengths[k]! / 2 / 86400, 0) / 4 };
}

/** The spectrum from a product's header cards and the bytes of its first six rows. */
export function readPolarisedSpectrum(cards: readonly string[], rows: Uint8Array): PolarisedSpectrum {
  const { pixels, object, exposureSeconds, mjd } = describeProduct(cards);
  if (rows.byteLength !== NORMALISED_ROWS * pixels * 4) throw new RangeError(`${rows.byteLength} bytes for six rows of ${pixels} pixels.`);
  const view = new DataView(rows.buffer, rows.byteOffset, rows.byteLength), row = (r: number) => { const out = new Float32Array(pixels); for (let i = 0; i < pixels; i++) out[i] = view.getFloat32((r * pixels + i) * 4); return out; };
  return { mjd, exposureSeconds, object, wavelengthNm: row(0), intensity: row(1), stokesV: row(2), check: row(3), error: row(5) };
}
