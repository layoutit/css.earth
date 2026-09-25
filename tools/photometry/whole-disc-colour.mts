/**
 * A planet's whole-disc colour, computed once from a published disc-integrated spectrum and recorded in
 * `source/photometry/<id>.json`; the body's manifest `documents` cite the archive product by URL. A colour map whose
 * archive scaling is arbitrary is tied to it with the band-ratio tie of the observation lanes
 * ([tieBandRatios](../objects/terrestrial-layers/photometric-observations.mts)): green and blue are scaled so their
 * cosine-weighted map means, divided by red's, meet the record's once the map's limb law is put back. Spatial colour
 * stays the map's own. Every key is checked; unknown keys are refused.
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
