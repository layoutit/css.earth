// Decode only the scalar EXTRACT1D table in an already calibrated JWST product.
// This does not run a JWST reduction, fit reflectance, or subtract thermal light.
export interface JwstSpectrumIdentity {
  targetName: string;
  calibrationVersion: string;
  crdsContext: string;
  observationDate: string;
}

export function readJwstSpectrum(bytes: Uint8Array, expected: JwstSpectrumIdentity) {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const hdus: { header: Record<string, string>; offset: number; size: number }[] = [];
  let offset = 0;
  while (offset < buffer.length) {
    const start = offset, header: Record<string, string> = {};
    let ended = false;
    while (offset + 80 <= buffer.length && offset - start < 2880 * 100) {
      const card = buffer.toString('ascii', offset, offset + 80);
      offset += 80;
      const key = card.slice(0, 8).trim();
      if (key === 'END') { ended = true; break; }
      if (card.slice(8, 10) !== '= ') continue;
      const value = card.slice(10).trim();
      header[key] = value.startsWith("'")
        ? (value.match(/^'((?:[^']|'')*)'/)?.[1] ?? '').replace(/''/g, "'").trim()
        : value.split('/')[0].trim();
    }
    if (!ended) throw new TypeError('FITS header is missing END.');
    offset = start + Math.ceil((offset - start) / 2880) * 2880;
    const dimensions = Number(header.NAXIS), bitpix = Number(header.BITPIX);
    if (!Number.isInteger(dimensions) || dimensions < 0 || dimensions > 3 ||
        ![8, 16, 32, 64, -32, -64].includes(bitpix)) throw new TypeError('Unsupported FITS layout.');
    let size = dimensions ? Math.abs(bitpix) / 8 : 0;
    for (let index = 1; index <= dimensions; index++) {
      const length = Number(header[`NAXIS${index}`]);
      if (!Number.isSafeInteger(length) || length < 0) throw new TypeError('Invalid FITS axis size.');
      size *= length;
    }
    size += Number(header.PCOUNT ?? 0);
    if (!Number.isSafeInteger(size) || size < 0 || offset + size > buffer.length) {
      throw new TypeError('Truncated FITS payload.');
    }
    hdus.push({ header, offset, size });
    offset += Math.ceil(size / 2880) * 2880;
  }
  const primary = hdus[0]?.header;
  if (!primary || primary.TARGNAME !== expected.targetName || primary.CAL_VER !== expected.calibrationVersion ||
      primary.CRDS_CTX !== expected.crdsContext || primary['DATE-OBS'] !== expected.observationDate ||
      primary.EXP_TYPE !== 'NRS_IFU' || primary.S_EXTR1D !== 'COMPLETE') {
    throw new TypeError('JWST target, observation or calibration identity changed.');
  }
  const tables = hdus.filter(hdu => hdu.header.EXTNAME === 'EXTRACT1D');
  if (tables.length !== 1) throw new TypeError('Expected exactly one extracted spectrum.');
  const table = tables[0], h = table.header;
  if (h.XTENSION !== 'BINTABLE' || h.SRCTYPE !== 'POINT' || h.NAXIS !== '2' || h.BITPIX !== '8') {
    throw new TypeError('Expected a point-source EXTRACT1D binary table.');
  }
  const fields = new Map<string, { offset: number; form: string; units?: string; zero: number }>();
  let width = 0;
  const fieldCount = Number(h.TFIELDS);
  if (!Number.isSafeInteger(fieldCount) || fieldCount < 4 || fieldCount > 64) throw new TypeError('Invalid FITS columns.');
  for (let index = 1; index <= fieldCount; index++) {
    const form = h[`TFORM${index}`], name = h[`TTYPE${index}`];
    const zero = Number(h[`TZERO${index}`] ?? 0);
    if (!['D', 'J'].includes(form) || !name || fields.has(name) ||
        h[`TSCAL${index}`] !== undefined || ![0, 2147483648].includes(zero) ||
        zero !== 0 && (name !== 'DQ' || form !== 'J')) {
      throw new TypeError('Unsupported or ambiguous extracted spectrum column.');
    }
    fields.set(name, { offset: width, form, units: h[`TUNIT${index}`], zero });
    width += form === 'D' ? 8 : 4;
  }
  if (width !== Number(h.NAXIS1)) throw new TypeError('FITS row width does not match its columns.');
  for (const [name, units, form] of [['WAVELENGTH', 'um', 'D'], ['FLUX', 'Jy', 'D'],
    ['FLUX_ERROR', 'Jy', 'D'], ['DQ', undefined, 'J']]) {
    const field = fields.get(name!);
    if (!field || field.form !== form || units !== undefined && field.units !== units) {
      throw new TypeError(`FITS ${name} column or units changed.`);
    }
  }
  const rows = Number(h.NAXIS2);
  if (!Number.isSafeInteger(rows) || rows < 2 || rows > 10000) throw new TypeError('Unbounded spectrum row count.');
  return Array.from({ length: rows }, (_, row) => {
    const read = (name: string) => buffer.readDoubleBE(table.offset + row * width + fields.get(name)!.offset);
    const x = read('WAVELENGTH'), y = read('FLUX'), error = read('FLUX_ERROR');
    // FITS stores unsigned DQ as a signed J column plus TZERO=2^31.
    // Reading the raw bits as uint32 would flag every good sample as bad.
    const dq = fields.get('DQ')!;
    const quality = buffer.readInt32BE(table.offset + row * width + dq.offset) + dq.zero;
    if (!Number.isInteger(quality) || quality < 0 || quality > 0xffffffff) throw new TypeError('Invalid FITS quality flags.');
    if (!Number.isFinite(x) || quality === 0 &&
        (!Number.isFinite(y) || !Number.isFinite(error) || error < 0)) {
      throw new TypeError('Unflagged JWST samples must be finite with nonnegative uncertainty.');
    }
    return { x, y, error, quality, excluded: quality !== 0 };
  });
}
