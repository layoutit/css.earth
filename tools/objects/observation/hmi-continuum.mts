/** SDO/HMI continuum frames as a Carrington-rotation map. Each frame is a JSOC `hmi.Ic_noLimbDark_720s` segment (limb
 * darkening removed by JSOC) whose geometry comes from its pinned DRMS record, not from the image: the disc centre
 * (CRPIX), plate scale (CDELT), roll (CROTA2, AIPS convention: Greisen & Calabretta 2002), angular radius (RSUN_OBS) and
 * the observer's Carrington longitude and latitude (CRLN_OBS, CRLT_OBS). Carrington longitude increases in the direction the
 * Sun turns (toward the west limb on the sky, as the sub-Earth longitude falls from day to day), which is the east-positive
 * sense the mesh places every atlas in: the map runs from L = 0° at its left edge to 360° at its right, as JSOC's synoptic
 * FITS columns do. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readRiceCompressedImage } from '@cssearth/fits';
import { requireArray, requireRecord, requireString } from '@cssearth/core';

export interface HmiContinuumSource {
  readonly kind: 'hmi-continuum-mosaic';
  /** Pinned JSOC `jsoc_info` rs_list response carrying every frame's record keywords and segment path. */
  readonly keywords: string;
  readonly frames: readonly { readonly file: string; readonly record: string }[];
  /** The limb-darkened `hmi.Ic_720s` segment of one frame's instant, whose ratio to that frame is the removed darkening. */
  readonly limbDarkening: { readonly file: string; readonly keywords: string; readonly record: string };
  readonly maximumLatitudeDegrees: number;
  /** Physical intensity (disc-centre normalized) to sRGB stops, linearly interpolated. */
  readonly palette: { readonly intensities: readonly number[]; readonly colors: readonly (readonly number[])[] };
}

interface FrameGeometry { centerX: number; centerY: number; scale: number; roll: number; radius: number; longitude: number; latitude: number; }
interface Frame extends FrameGeometry { size: number; values: Float32Array; }

const DEGREE = Math.PI / 180, BIN = 2;
const wrapDegrees = (value: number) => ((value % 360) + 540) % 360 - 180;

/** One record's keywords, validated against the only layout this reader understands. */
export function hmiRecordGeometry(response: unknown, record: string): FrameGeometry {
  const body = requireRecord(response, 'JSOC keyword response');
  const keywords = new Map(requireArray(body.keywords, 'JSOC keywords').map(entry => {
    const item = requireRecord(entry, 'JSOC keyword');
    return [requireString(item.name, 'JSOC keyword name'), requireArray(item.values, 'JSOC keyword values').map(value => requireString(value, 'JSOC keyword value'))] as const;
  }));
  const records = keywords.get('T_REC');
  const index = records?.indexOf(record) ?? -1;
  if (index < 0) throw new Error(`JSOC keywords lack record ${record}.`);
  const text = (key: string) => { const value = keywords.get(key)?.[index]; if (value === undefined) throw new Error(`JSOC record ${record} lacks ${key}.`); return value; };
  const number = (key: string) => { const value = Number(text(key)); if (!Number.isFinite(value)) throw new Error(`JSOC record ${record} has an invalid ${key}.`); return value; };
  if (Number(text('QUALITY')) !== 0) throw new Error(`JSOC record ${record} is flagged (QUALITY ${text('QUALITY')}).`);
  if (text('CTYPE1') !== 'HPLN-TAN' || text('CTYPE2') !== 'HPLT-TAN' || text('CUNIT1') !== 'arcsec' || text('CUNIT2') !== 'arcsec' ||
      number('CRVAL1') !== 0 || number('CRVAL2') !== 0 || number('CDELT1') !== number('CDELT2'))
    throw new Error(`JSOC record ${record} is not a Sun-centred helioprojective image with square pixels.`);
  return { centerX: number('CRPIX1'), centerY: number('CRPIX2'), scale: number('CDELT1'), roll: number('CROTA2') * DEGREE,
    radius: number('RSUN_OBS'), longitude: number('CRLN_OBS'), latitude: number('CRLT_OBS') * DEGREE };
}

/** The 1-based image pixel that sees helioprojective (west, north) arcseconds. */
export function hmiPixel(geometry: FrameGeometry, west: number, north: number): readonly [number, number] {
  const cos = Math.cos(geometry.roll), sin = Math.sin(geometry.roll);
  return [geometry.centerX + (west * cos + north * sin) / geometry.scale, geometry.centerY + (-west * sin + north * cos) / geometry.scale];
}

/** Helioprojective arcseconds of a Carrington point, or undefined on the far side. The disc is drawn orthographically at
 * RSUN_OBS; the finite-distance correction is 0.5% of the radius at the limb and strips are sampled near disc centre. */
export function hmiProject(geometry: FrameGeometry, longitudeDegrees: number, latitude: number): readonly [number, number] | undefined {
  const delta = wrapDegrees(longitudeDegrees - geometry.longitude) * DEGREE, b0 = geometry.latitude;
  const depth = Math.sin(latitude) * Math.sin(b0) + Math.cos(latitude) * Math.cos(delta) * Math.cos(b0);
  if (depth <= 0) return undefined;
  const west = Math.cos(latitude) * Math.sin(delta), north = Math.sin(latitude) * Math.cos(b0) - Math.cos(latitude) * Math.cos(delta) * Math.sin(b0);
  return [west * geometry.radius, north * geometry.radius];
}

/** Decode a segment and average it 2×2, keeping the full-resolution geometry for projection. */
async function loadFrame(path: string, geometry: FrameGeometry): Promise<Frame> {
  const image = readRiceCompressedImage(await readFile(path));
  if (image.width !== image.height || image.width % BIN) throw new Error(`HMI segment is not a square even image: ${path}.`);
  const size = image.width / BIN, values = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let sum = 0, count = 0;
    for (let dy = 0; dy < BIN; dy++) for (let dx = 0; dx < BIN; dx++) {
      const value = image.values[(y * BIN + dy) * image.width + x * BIN + dx]!;
      if (Number.isFinite(value)) { sum += value; count++; }
    }
    values[y * size + x] = count === BIN * BIN ? sum / count : NaN;
  }
  return { ...geometry, size, values };
}

/** Bilinear intensity at a 1-based full-resolution pixel; NaN outside the observed disc. */
function sample(frame: Frame, pixelX: number, pixelY: number) {
  const x = (pixelX - 1 + 0.5) / BIN - 0.5, y = (pixelY - 1 + 0.5) / BIN - 0.5;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  if (x0 < 0 || y0 < 0 || x0 + 1 >= frame.size || y0 + 1 >= frame.size) return NaN;
  const at = (i: number, j: number) => frame.values[j * frame.size + i]!;
  const fx = x - x0, fy = y - y0;
  return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
}

function paletteColor(palette: HmiContinuumSource['palette'], intensity: number) {
  const { intensities, colors } = palette;
  if (intensity <= intensities[0]!) return colors[0]!;
  for (let i = 1; i < intensities.length; i++) if (intensity <= intensities[i]!) {
    const t = (intensity - intensities[i - 1]!) / (intensities[i]! - intensities[i - 1]!);
    return colors[i]!.map((value, channel) => colors[i - 1]![channel]! + (value - colors[i - 1]![channel]!) * t);
  }
  return colors.at(-1)!;
}

export function validateHmiPalette(palette: HmiContinuumSource['palette']) {
  const { intensities, colors } = palette;
  if (intensities.length < 2 || intensities.length !== colors.length || intensities.some((v, i) => !Number.isFinite(v) || (i > 0 && v <= intensities[i - 1]!)) ||
      colors.some(color => color.length !== 3 || color.some(v => !Number.isInteger(v) || v < 0 || v > 255)))
    throw new TypeError('An HMI continuum palette pairs increasing intensities with sRGB triples.');
}

export function createHmiContinuum(sourceDirectory: string, source: HmiContinuumSource) {
  validateHmiPalette(source.palette);
  let frames: Promise<readonly Frame[]> | undefined;
  const load = () => frames ??= (async () => {
    const response = JSON.parse(await readFile(resolve(sourceDirectory, source.keywords), 'utf8'));
    const loaded: Frame[] = [];
    // Sequential: each decoded segment is 134 MB before binning.
    for (const { file, record } of source.frames) loaded.push(await loadFrame(resolve(sourceDirectory, file), hmiRecordGeometry(response, record)));
    return loaded.sort((a, b) => b.longitude - a.longitude);
  })();

  /** The east-positive RGBA map: each column blends the two frames whose central meridians bracket its longitude. */
  async function map(width: number, height: number) {
    const ordered = await load(), output = Buffer.alloc(width * height * 4);
    const limit = source.maximumLatitudeDegrees * DEGREE;
    for (let x = 0; x < width; x++) {
      const longitude = 360 * (x + 0.5) / width;
      // Nearest central meridian on each side, measured around the circle.
      let east: Frame | undefined, west: Frame | undefined, eastGap = Infinity, westGap = Infinity;
      for (const frame of ordered) {
        const gap = wrapDegrees(longitude - frame.longitude);
        if (gap >= 0 && gap < westGap) { westGap = gap; west = frame; }
        if (gap < 0 && -gap < eastGap) { eastGap = -gap; east = frame; }
      }
      const pair = [[west, eastGap / (eastGap + westGap)], [east, westGap / (eastGap + westGap)]] as const;
      for (let y = 0; y < height; y++) {
        const latitude = Math.max(-limit, Math.min(limit, (90 - (y + 0.5) / height * 180) * DEGREE));
        let intensity = 0, weight = 0;
        for (const [frame, share] of pair) {
          if (!frame || !(share > 0)) continue;
          const seen = hmiProject(frame, longitude, latitude);
          if (!seen) continue;
          const value = sample(frame, ...hmiPixel(frame, seen[0], seen[1]));
          if (Number.isFinite(value)) { intensity += value * share; weight += share; }
        }
        if (!weight) throw new Error(`No HMI frame observes Carrington ${longitude.toFixed(2)}°, ${(latitude / DEGREE).toFixed(2)}°.`);
        const color = paletteColor(source.palette, intensity / weight), offset = (y * width + x) * 4;
        output[offset] = Math.round(color[0]!); output[offset + 1] = Math.round(color[1]!); output[offset + 2] = Math.round(color[2]!); output[offset + 3] = 255;
      }
    }
    return output;
  }

  /** The removed limb darkening: median darkened/flattened ratio in 256 radial bins, normalized to the disc centre. */
  let darkening: Promise<readonly number[]> | undefined;
  const limbProfile = () => darkening ??= (async () => {
    const response = JSON.parse(await readFile(resolve(sourceDirectory, source.limbDarkening.keywords), 'utf8'));
    const geometry = hmiRecordGeometry(response, source.limbDarkening.record);
    const flattenedEntry = source.frames.find(frame => frame.record === source.limbDarkening.record);
    if (!flattenedEntry) throw new Error('The limb-darkening record must be one of the mosaic frames.');
    const flattenedGeometry = hmiRecordGeometry(JSON.parse(await readFile(resolve(sourceDirectory, source.keywords), 'utf8')), flattenedEntry.record);
    if (Object.entries(geometry).some(([key, value]) => flattenedGeometry[key as keyof FrameGeometry] !== value))
      throw new Error('The limb-darkened and flattened segments do not share one observation geometry.');
    const darkened = readRiceCompressedImage(await readFile(resolve(sourceDirectory, source.limbDarkening.file)));
    const flattened = readRiceCompressedImage(await readFile(resolve(sourceDirectory, flattenedEntry.file)));
    const radiusPixels = geometry.radius / geometry.scale, bins: number[][] = Array.from({ length: 256 }, () => []);
    for (let y = 0; y < darkened.height; y += 2) for (let x = 0; x < darkened.width; x += 2) {
      const radial = Math.hypot(x + 1 - geometry.centerX, y + 1 - geometry.centerY) / radiusPixels;
      if (radial >= 1) continue;
      const ratio = darkened.values[y * darkened.width + x]! / flattened.values[y * flattened.width + x]!;
      if (Number.isFinite(ratio)) bins[Math.min(255, Math.floor(radial * 256))]!.push(ratio);
    }
    const medians = bins.map(values => values.length ? values.sort((a, b) => a - b)[values.length >> 1]! : NaN);
    const centre = medians.slice(0, 26).filter(Number.isFinite), reference = centre.reduce((sum, value) => sum + value, 0) / centre.length;
    let last = 1;
    return medians.map(value => (last = Number.isFinite(value) ? value / reference : last));
  })();

  return { map, limbProfile };
}
