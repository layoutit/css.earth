import {parseEncounterPolicy} from './source-records.mts';
// Preparation-only decoding of calibrated Stardust and Deep Impact/EPOXI
// observations. Detector quality is independent of brightness and display tone.
const integer = (n: unknown, min: number, max: number): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= min && n <= max;
export function cardValue(card: string) {
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

export function readEncounterHdus(bytes: Buffer) {
  if (!Buffer.isBuffer(bytes) || bytes.length % 2880) throw new Error('Truncated FITS records.');
  const hdus: {name:string;header:Record<string,string|number|boolean>;width:number;height:number;bitpix:number;values:Uint8Array|Float32Array;offset:number}[] = []; let start = 0;
  while (start < bytes.length) {
    const header: Record<string,string|number|boolean> = {}; let end = -1;
    for (let offset = start; offset + 80 <= bytes.length && offset < start + 131040; offset += 80) {
      const card = bytes.toString('ascii', offset, offset + 80), key = card.slice(0, 8).trim();
      if (key === 'END') { end = offset + 80; break; }
      if (card[8] !== '=') continue;
      if (Object.hasOwn(header, key)) throw new Error(`Duplicate FITS field: ${key}`);
      header[key] = cardValue(card);
    }
    const width = header.NAXIS1, height = header.NAXIS2, bitpix = header.BITPIX;
    if (end < 0 || header.NAXIS !== 2 || !integer(width, 1, 4096) || !integer(height, 1, 4096) ||
        typeof bitpix !== "number" || ![8, -32].includes(bitpix) || (hdus.length ? header.XTENSION !== 'IMAGE' || header.PCOUNT !== 0 || header.GCOUNT !== 1 : header.SIMPLE !== true)) {
      throw new Error('Unsupported encounter FITS layout.');
    }
    const offset = Math.ceil(end / 2880) * 2880, stride = Math.abs(bitpix) / 8, size = width * height * stride;
    if (offset + size > bytes.length || (header.BSCALE ?? 1) !== 1 || (header.BZERO ?? 0) !== 0) throw new Error('Truncated or scaled encounter FITS plane.');
    const name = hdus.length ? header.EXTNAME : 'PRIMARY';
    if (typeof name !== 'string' || hdus.some(hdu => hdu.name === name)) throw new Error('Invalid encounter FITS plane identity.');
    const values = bitpix === 8 ? new Uint8Array(bytes.subarray(offset, offset + size)) : new Float32Array(width * height);
    if (bitpix === -32) for (let i = 0; i < values.length; i++) values[i] = bytes.readFloatBE(offset + i * 4);
    hdus.push({ name, header, width, height, bitpix, values, offset });
    start = offset + Math.ceil(size / 2880) * 2880;
  }
  if (!hdus.length) throw new Error('Empty encounter FITS.');
  return hdus;
}

export function decodeEncounterFits(bytes: Buffer, value: unknown) {
  const policy=parseEncounterPolicy(value);
  const hdus = readEncounterHdus(bytes), primary = hdus[0], { header, width, height, values } = primary;
  const kinds: Record<string, {identity:string;planes:string[];quality:string;good:number;units:string}> = {
    'stardust-navcam': { identity: 'NAVCAM', planes: ['PRIMARY', 'QUALITY_MAP', 'UNCERTAINTY_MAP', 'SNR_MAP'], quality: 'QUALITY_MAP', good: 0, units: 'W/(cm^2*nm*sr)' },
    'deep-impact-its': { identity: 'ITSVIS', planes: ['PRIMARY', 'FLAGS', 'SNR', 'DESTRIPE'], quality: 'FLAGS', good: 0, units: 'W/(m^2*sr*um)' },
    'deep-impact-mri': { identity: 'MRIVIS', planes: ['PRIMARY', 'FLAGS', 'SNR', 'DESTRIPE'], quality: 'FLAGS', good: 0, units: 'W/(m^2*sr*um)' },
    'epoxi-hri-deconvolved': { identity: 'HRIVIS', planes: ['PRIMARY', 'RESIDUAL', 'MASK'], quality: 'MASK', good: 1, units: 'W/(m^2*sr*um)' },
  };
  const kind = kinds[policy.instrument];
  if (!kind || header.INSTRUME !== kind.identity || primary.bitpix !== -32 || header.BUNIT !== kind.units || width !== policy.width || height !== policy.height ||
      JSON.stringify(hdus.map(hdu => hdu.name)) !== JSON.stringify(kind.planes)) throw new Error('Encounter product identity or layout changed.');
  const planes = Object.fromEntries(hdus.map(hdu => [hdu.name, hdu]));
  for (const hdu of hdus.slice(1)) {
    const destripe = hdu.name === 'DESTRIPE';
    if (hdu.width !== (destripe ? 2 : width) || hdu.height !== height || hdu.bitpix !== (hdu.name === kind.quality ? 8 : -32)) throw new Error('Misregistered encounter quality plane.');
  }
  const date = header.OBSDATE ?? header['DATE-OBS'];
  const filter = header.FILTER ?? header.FILTNAME;
  if (date !== policy.startTime || filter !== policy.filter || header.OBJECT !== policy.target) throw new Error('Encounter observation metadata changed.');
  const quality = planes[kind.quality].values;
  const residual = planes.RESIDUAL?.values;
  if (residual && policy.residualPolicy !== 'record-only') throw new Error('HRI residuals are convergence diagnostics, not a detector mask.');
  let residualCount = 0, residualSumSquares = 0, residualMaximumAbsolute = 0;
  if (residual) for (let i = 0; i < residual.length; i++) {
    if (quality[i] !== kind.good || !Number.isFinite(residual[i])) continue;
    residualCount++; residualSumSquares += residual[i] ** 2;
    residualMaximumAbsolute = Math.max(residualMaximumAbsolute, Math.abs(residual[i]));
  }
  const border = policy.detectorBorderPixels ?? 0;
  if (!integer(border, 0, Math.min(width,height)/4)) throw new Error('Invalid active detector border.');
  const reason = (i: number) => {
    if (!integer(i, 0, values.length - 1)) return 'outside-detector';
    if (i % width < border || i % width >= width-border || Math.floor(i/width) < border || Math.floor(i/width) >= height-border) return 'detector-overclock';
    if (quality[i] !== kind.good) return 'detector-quality';
    if (!Number.isFinite(values[i])) return 'nonfinite-radiance';
    return null;
  };
  return { header, width, height, values, quality, planes, reason, startTime: date, filter, units: kind.units,
    rowOrder: 'bottom-to-top', report: { instrument: policy.instrument, qualityPlane: kind.quality, acceptedQuality: kind.good, detectorBorderPixels: border, ...(residual ? {residualPolicy: 'record-only', residualStatistics: {count: residualCount, rms: residualCount ? Math.sqrt(residualSumSquares/residualCount) : null, maximumAbsolute: residualMaximumAbsolute}} : {}) } };
}
