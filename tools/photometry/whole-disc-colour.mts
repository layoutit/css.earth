/**
 * A planet's whole-disc colour, computed once from a published disc-integrated spectrum and recorded in
 * `source/photometry/<id>.json`; the body's manifest `documents` cite the archive product by URL. A colour map whose
 * archive scaling is arbitrary is tied to it with the band-ratio tie of the observation lanes
 * ([tieBandRatios](../objects/terrestrial-layers/photometric-observations.mts)): green and blue are scaled so their
 * cosine-weighted map means, divided by red's, meet the record's once the map's limb law is put back. The tie keeps red, so
 * keepLuminance then gives the map back its own mean luminance, with a soft shoulder instead of clipping. Spatial colour stays the
 * map's own. Every key is checked; unknown keys are refused.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import type { BandRatioPolicy } from '../objects/terrestrial-layers/contracts.mts';
import { CHANNEL_NAMES } from './limb.mts';

export const WHOLE_DISC_COLOUR_SCHEMA = 'cssearth-whole-disc-colour@1';

export interface WholeDiscColour {
  readonly id: string;
  /** Linear sRGB (D65) of the disc in the light the record names; only the channel ratios are used. */
  readonly linearSrgb: readonly [number, number, number];
}

const KEYS = ['schema', 'id', 'quantity', 'spectrum', 'illuminant', 'observer', 'linearSrgb'] as const;

export function parseWholeDiscColour(value: unknown, where = 'whole-disc colour record'): WholeDiscColour {
  const record = requireRecord(value, where);
  const unknown = Object.keys(record).filter(key => !KEYS.some(known => known === key));
  if (unknown.length) throw new TypeError(`${where} has unknown keys: ${unknown.join(', ')}.`);
  if (record.schema !== WHOLE_DISC_COLOUR_SCHEMA) throw new TypeError(`${where} must use ${WHOLE_DISC_COLOUR_SCHEMA}, got ${JSON.stringify(record.schema)}.`);
  const id = requireString(record.id, `${where}.id`);
  if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError(`${where}.id must be a lowercase identifier, got ${JSON.stringify(id)}.`);
  for (const key of ['quantity', 'observer'] as const) requireString(record[key], `${where}.${key}`);
  requireRecord(record.spectrum, `${where}.spectrum`); requireRecord(record.illuminant, `${where}.illuminant`);
  const linear = requireArray(record.linearSrgb, `${where}.linearSrgb`).map((channel, index) => requireFiniteNumber(channel, `${where}.linearSrgb[${index}]`));
  if (linear.length !== 3 || !linear.every(channel => channel > 0)) throw new TypeError(`${where}.linearSrgb must be three positive linear sRGB channels, got ${JSON.stringify(record.linearSrgb)}.`);
  return { id, linearSrgb: [linear[0]!, linear[1]!, linear[2]!] };
}

export async function loadWholeDiscColour(sourceDirectory: string, path: string): Promise<WholeDiscColour> {
  if (!/^photometry\/[a-z][a-z0-9-]*\.json$/u.test(path)) throw new TypeError(`A whole-disc colour record is named as photometry/<id>.json, got ${JSON.stringify(path)}.`);
  return parseWholeDiscColour(JSON.parse(await readFile(resolve(sourceDirectory, path), 'utf8')), path);
}

/**
 * The band-ratio policy over the display channels (red, green, blue), red the reference. A map whose limb darkening was
 * divided out, and is put back per channel by a limb law, is tied to the colour divided by each channel's disc mean of that
 * law (floodDiscMean in limb.mts), so the lit disc integrates to the record's colour.
 */
export function displayBandRatios(colour: WholeDiscColour, limbDiscMean: readonly [number, number, number] = [1, 1, 1]): BandRatioPolicy {
  if (!limbDiscMean.every(mean => Number.isFinite(mean) && mean > 0)) throw new TypeError(`${colour.id}: a limb law's disc means must be positive, got ${JSON.stringify(limbDiscMean)}.`);
  const [red, green, blue] = colour.linearSrgb.map((channel, index) => channel / limbDiscMean[index]!) as [number, number, number];
  return { reference: CHANNEL_NAMES[0], ratios: { [CHANNEL_NAMES[1]]: +(green / red).toFixed(4), [CHANNEL_NAMES[2]]: +(blue / red).toFixed(4) }, source: colour.id };
}

/** Linear-sRGB luminance (IEC 61966-2-1 Y row) averaged over an equirectangular map, weighted by the cosine of latitude. */
export function latitudeWeightedLuminance(rgb: ArrayLike<number>, width: number, height: number): number {
  let sum = 0, weightSum = 0;
  for (let y = 0; y < height; y++) {
    const weight = Math.cos((90 - (y + 0.5) * 180 / height) * Math.PI / 180);
    for (let x = 0; x < width; x++) { const i = (y * width + x) * 3; weightSum += weight; sum += weight * (0.2126729 * rgb[i]! + 0.7151522 * rgb[i + 1]! + 0.072175 * rgb[i + 2]!); }
  }
  if (!(weightSum > 0 && sum > 0)) throw new TypeError(`A ${width} x ${height} map has no luminance to keep.`);
  return sum / weightSum;
}

/** Where the soft shoulder starts, as a fraction of full scale: chosen on the Saturn preview of 2026-09-25 (README). */
export const SHOULDER_KNEE = 0.8;
/** Identity up to the knee, then k + (1 - k)(1 - exp(-(m - k)/(1 - k))): continuous in value and slope, below 1 for any finite value a map reaches. */
export const softShoulder = (value: number, knee = SHOULDER_KNEE) => value <= knee ? value : knee + (1 - knee) * (1 - Math.exp(-(value - knee) / (1 - knee)));

/**
 * After a band-ratio tie, which keeps red and lowers the other channels, give the map back the luminance it had before: one factor on
 * all three channels, so the tie's ratios stay. A texel whose brightest channel then passes the knee is compressed by the soft shoulder,
 * all three channels by the same factor, so no channel clips and each texel keeps its own ratios. Linear values, in place.
 */
export function keepLuminance(rgb: Float32Array, width: number, height: number, luminance: number, knee = SHOULDER_KNEE) {
  if (!(luminance > 0 && Number.isFinite(luminance))) throw new TypeError(`The luminance to keep must be positive, got ${luminance}.`);
  if (!(knee > 0 && knee < 1)) throw new TypeError(`The shoulder knee must lie between 0 and 1, got ${knee}.`);
  const factor = luminance / latitudeWeightedLuminance(rgb, width, height);
  let shouldered = 0;
  for (let i = 0; i < rgb.length; i += 3) {
    const peak = Math.max(rgb[i]!, rgb[i + 1]!, rgb[i + 2]!) * factor;
    const scale = peak > knee ? (shouldered++, factor * softShoulder(peak, knee) / peak) : factor;
    for (let channel = 0; channel < 3; channel++) rgb[i + channel] = rgb[i + channel]! * scale;
  }
  return { factor: +factor.toFixed(4), knee, shoulderedTexels: shouldered, shoulderedShare: +(shouldered / (rgb.length / 3)).toFixed(4) };
}
