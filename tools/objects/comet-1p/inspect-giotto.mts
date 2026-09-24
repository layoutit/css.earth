import { sha256 } from '@cssearth/core/node';
import {hasErrorCode,requireRecord,shape,text,number,array} from '@cssearth/core';
export interface PinnedIntakeFile {file:string;url:string;bytes:number;sha256:string;}
export const parsePinnedIntakeFile=shape({file:text,url:text,bytes:number,sha256:text});
const parseManifest=shape({shape:shape({path:text,absoluteUncertaintyKm:array(number)}),guide:parsePinnedIntakeFile,
  frames:array(shape({id:text,imageId:number,sensor:text,filter:text,header:parsePinnedIntakeFile,image:parsePinnedIntakeFile,label:parsePinnedIntakeFile}))});
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '../../..');
const sourceRoot = resolve(root, 'src/objects/comet-1p/source');
const manifestPath = resolve(sourceRoot, 'reference/giotto-hmc-intake.json');

// The IHW release separates its FITS header and raster. This is deliberately
// a narrow intake decoder, not a runtime format or a qualified camera model.
export function decodeGiottoFrame(headerBytes:Buffer, imageBytes:Buffer, labelBytes:Buffer) {
  if (headerBytes.length % 2880 !== 0) throw new Error('Incomplete FITS header block.');
  const header:Record<string,string> = {};
  let ended = false;
  for (let offset = 0; offset < headerBytes.length; offset += 80) {
    const card = headerBytes.subarray(offset, offset + 80).toString('ascii');
    const key = card.slice(0, 8).trim();
    if (key === 'END') { ended = true; break; }
    if (card.slice(8, 10) !== '= ') continue;
    if (Object.hasOwn(header, key)) throw new Error(`Duplicate FITS keyword: ${key}`);
    header[key] = card.slice(10).split('/')[0].trim().replace(/^'(.*)'$/, '$1').trim();
  }
  const n = (key:string) => Number(header[key]);
  const width = n('NAXIS1'), height = n('NAXIS2');
  if (!ended || header.SIMPLE !== 'T' || n('BITPIX') !== 16 || n('NAXIS') !== 2 ||
      ![width, height].every(v => Number.isSafeInteger(v) && v > 0 && v <= 4096) ||
      (header.BZERO !== undefined && n('BZERO') !== 0) ||
      (header.BSCALE !== undefined && n('BSCALE') !== 1) || header.FILTER !== 'CLEAR') {
    throw new Error('Unsupported IHW clear-filter raster.');
  }
  const label = labelBytes.toString('ascii');
  const field = (key:string) => label.match(new RegExp(`^\\s*${key}\\s*=\\s*([^\\r\\n]+)`, 'm'))?.[1].trim();
  if (Number(field('LINES')) !== height || Number(field('LINE_SAMPLES')) !== width ||
      Number(field('RECORD_BYTES')) !== width * 2 || Number(field('SAMPLE_BITS')) !== 16 ||
      field('SAMPLE_TYPE') !== 'MSB_INTEGER') throw new Error('PDS/FITS raster layout disagreement.');
  const rasterBytes = width * height * 2;
  // Original data retain a zero-filled final FITS block. Do not turn it into
  // extra rows or interpret padding as valid dark observations.
  if (imageBytes.length !== Math.ceil(rasterBytes / 2880) * 2880 ||
      imageBytes.subarray(rasterBytes).some(v => v !== 0)) throw new Error('Invalid FITS raster padding.');
  const stored = new Int16Array(width * height), radiance = new Float64Array(stored.length);
  const valid = new Uint8Array(stored.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const output = y * width + x;
    const value = imageBytes.readInt16BE(((height - 1 - y) * width + x) * 2);
    stored[output] = value;
    valid[output] = value !== -32768 ? 1 : 0;
    // HMCGUIDE Table III supplies the factor, not PDS SCALING_FACTOR=1.
    // Negative/zero measurements remain valid; missing is a separate mask.
    radiance[output] = valid[output] ? value / 10 : NaN;
  }
  return { header, width, height, stored, radiance, valid, rasterBytes,
    paddingBytes: imageBytes.length - rasterBytes };
}

export async function loadPinned(directory:string, entry:PinnedIntakeFile, download = false) {
  const path = resolve(directory, entry.file);
  let bytes;
  try { bytes = await readFile(path); } catch (error) {
    if (!hasErrorCode(error,'ENOENT') || !download) throw error;
    const response = await fetch(entry.url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`${entry.url}: HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== entry.bytes || sha256(bytes) !== entry.sha256) throw new Error(`Source pin mismatch: ${entry.file}`);
    await mkdir(directory, { recursive: true });
    await writeFile(path, bytes);
  }
  if (bytes.length !== entry.bytes || sha256(bytes) !== entry.sha256) throw new Error(`Source pin mismatch: ${entry.file}`);
  return bytes;
}

const percentile = (sorted:readonly number[], p:number) => {
  const index = (sorted.length - 1) * p, lo = Math.floor(index), hi = Math.ceil(index);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
};
const xml = (value:unknown) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

async function main() {
  const args = process.argv.slice(2);
  if (args.some(a => a !== '--download' && !a.startsWith('--output='))) {
    throw new Error('Usage: node tools/objects/comet-1p/inspect-giotto.mts [--download] [--output=directory]');
  }
  const output = resolve(args.find(a => a.startsWith('--output='))?.slice(9) ?? resolve(root, 'output/comet-intake/halley-giotto/repro'));
  const input = resolve(output, 'source');
  const manifestBytes = await readFile(manifestPath),raw:unknown=JSON.parse(manifestBytes.toString("utf8"));
  const manifest=Object.assign({},requireRecord(raw),parseManifest(raw));
  const shapeBytes = await readFile(resolve(sourceRoot, manifest.shape.path));
  await mkdir(output, { recursive: true });
  await loadPinned(input, manifest.guide, args.includes('--download'));
  const { default: sharp } = await import('sharp');
  const frames = [], layers = [];
  for (let i = 0; i < manifest.frames.length; i++) {
    const source = manifest.frames[i];
    const bytes = await Promise.all((['header', 'image', 'label'] as const).map(k => loadPinned(input, source[k], args.includes('--download'))));
    const frame = decodeGiottoFrame(bytes[0],bytes[1],bytes[2]), h = frame.header;
    if (Number(h['IMAGE-ID']) !== source.imageId || h.SENSOR !== source.sensor || h.FILTER !== source.filter) {
      throw new Error(`Source identity disagreement: ${source.id}`);
    }
    const scale = Number(h.SCALE), seconds = Number(h['TIME-ENC']);
    const superpixels = h.SUPERPIX.split(/\s+/).map(Number);
    const sensorIndex = 'BCDE'.indexOf(h.SENSOR);
    if (!(scale > 0) || !Number.isFinite(seconds) || superpixels.length !== 4 || sensorIndex < 0 ||
        superpixels.some(v => !Number.isInteger(v) || v < 0 || v > 5)) throw new Error('Incomplete frame geometry.');
    const samples = Array.from(frame.radiance).filter(Number.isFinite).sort((a,b) => a-b);
    if (samples.length === 0) throw new Error('Frame has no valid samples.');
    const low = percentile(samples, .01), high = percentile(samples, .99);
    if (!(high > low)) throw new Error('Frame has no display contrast.');
    const rgb = Buffer.alloc(frame.width * frame.height * 3);
    for (let j = 0; j < frame.valid.length; j++) {
      const level = Math.round(Math.max(0, Math.min(1, (frame.radiance[j] - low) / (high - low))) * 255);
      const color = frame.valid[j] ? [level, level, level] : [48, 64, 83];
      for (let c = 0; c < 3; c++) rgb[j * 3 + c] = color[c];
    }
    const png = await sharp(rgb, { raw: { width: frame.width, height: frame.height, channels: 3 } }).png().toBuffer();
    await writeFile(resolve(output, `${source.id}.png`), png);
    const x = 24 + i % 4 * 340, y = 85 + Math.floor(i / 4) * 410;
    layers.push({ input: await sharp(png).resize(frame.width * 4, frame.height * 4, { kernel: 'nearest' }).toBuffer(), left: x, top: y });
    const label = `<svg width="324" height="72"><g font-family="Arial,sans-serif" font-size="17" fill="#e5eaf1"><text x="0" y="19">${xml(source.id)} / C ${source.imageId}</text><text x="0" y="42">${(scale * 1000).toFixed(2)} m/pixel; ${(-seconds).toFixed(2)} s before CA</text><text x="0" y="65">${frame.width} × ${frame.height}; valid raster ${samples.length} pixels</text></g></svg>`;
    layers.push({ input: Buffer.from(label), left: x, top: y + 322 });
    frames.push({ id: source.id, imageId: source.imageId, sensor: h.SENSOR, filter: h.FILTER,
      width: frame.width, height: frame.height, kmPerPixel: scale, timeToEncounterSeconds: seconds,
      nativeSuperpixelFormat: superpixels[sensorIndex],
      validRasterPixels: samples.length, invalidRasterPixels: frame.valid.length - samples.length,
      calibratedRadianceRange: [samples[0], samples.at(-1)], radianceUnits: 'mW m^-2 sr^-1',
      displayStretch: { kind: 'per-frame-linear-percentiles', percentiles: [1, 99], range: [low, high] },
      imageFieldKm: [frame.width * scale, frame.height * scale],
      shapeUncertaintyInImagePixels: manifest.shape.absoluteUncertaintyKm.map(v => v / scale),
      rasterBytes: frame.rasterBytes, paddingBytes: frame.paddingBytes, header: h,
      sourceFiles: (['header', 'image', 'label'] as const).map(k => source[k]),
      preview: { file: `${source.id}.png`, bytes: png.length, sha256: sha256(png) } });
  }
  const title = '<svg width="1360" height="65"><g font-family="Arial,sans-serif" fill="#e5eaf1"><text x="0" y="25" font-size="25">Halley / Giotto encounter frames</text><text x="0" y="53" font-size="17">Native pixels enlarged 4×; per-frame contrast stretch. Blue marks invalid raster samples. No surface registration.</text></g></svg>';
  layers.push({ input: Buffer.from(title), left: 24, top: 12 });
  const footnote = '<svg width="1360" height="65"><g font-family="Arial,sans-serif" font-size="17" fill="#b5c2d3"><text x="0" y="22">Valid raster ≠ observed nucleus surface: dust, illumination and optical blur remain in these frames.</text><text x="0" y="49">Giotto HMC / Keller, Thomas, Curdt, Schwarz / IHW / NASA PDS. Local scientific inspection only.</text></g></svg>';
  layers.push({ input: Buffer.from(footnote), left: 24, top: 911 });
  const sheet = await sharp({ create: { width: 1400, height: 988, channels: 3, background: '#141823' } }).composite(layers).png().toBuffer();
  await writeFile(resolve(output, 'contact-sheet.png'), sheet);
  const report = {
    schema: 'cssearth-halley-giotto-intake-report@1', manifest: { path: 'src/objects/comet-1p/source/reference/giotto-hmc-intake.json', sha256: sha256(manifestBytes) },
    shape: manifest.shape, dataset: manifest.dataset, guide: manifest.guide, frames,
    result: { status: 'UNQUALIFIED_SURFACE_LENS', projectedSurfacePixels: null,
      missingEvidence: ['Source-controlled mapping from Stooke body coordinates to the encounter camera.',
        'Validated surface coverage excluding foreground dust and unresolved limb/terminator pixels.',
        'Registration residuals and validation in an independent frame.'],
      meaning: 'Raster decoding is verified. Surface registration has not been established or attempted with a guessed attitude.' },
    distribution: manifest.distribution,
    localContactSheet: { file: 'contact-sheet.png', bytes: sheet.length, sha256: sha256(sheet) },
  };
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Decoded ${frames.length} pinned frames; ${report.result.status}.\n${output}/contact-sheet.png\n${output}/report.json`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
