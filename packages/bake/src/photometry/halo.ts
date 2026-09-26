/**
 * A planet's limb halo from one NASA Planetary Spectrum Generator profile: the radiance of a tangent line of sight at
 * each altitude with the Sun behind the observer, divided by the radiance of the disc centre under an overhead Sun from
 * the same model. The profile is computed once (tools/photometry/acquire-psg-limb-table.mts) and serves every lighting
 * frame: a frame draws it where the tangent point faces the Sun and leaves the night side dark. PSG computes limb paths
 * with single scattering only and needs the Sun one degree above the tangent point's horizon, so multiply scattered
 * light and the brighter forward scattering of a backlit limb are not in the profile; the body README says so.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Channels } from './limb.ts';

export const PSG_LIMB_TABLE_SCHEMA = 'cssearth-psg-limb-table@1';

export interface LimbProfile {
  readonly body: string;
  /** The model's reference radius; altitudes are above it. */
  readonly radiusKm: number;
  readonly altitudesKm: readonly number[];
  /** Radiance ÷ nadir radiance under an overhead Sun, per channel and altitude. */
  readonly ratio: Channels<Float64Array>;
}

export function parseLimbProfile(value: unknown, where: string): LimbProfile {
  const record = value as Record<string, unknown>;
  if (!record || record.schema !== PSG_LIMB_TABLE_SCHEMA) throw new TypeError(`${where}: expected schema ${PSG_LIMB_TABLE_SCHEMA}, got ${JSON.stringify(record?.schema)}.`);
  const radiusKm = record.radiusKm, altitudes = record.altitudesKm;
  if (typeof radiusKm !== 'number' || !(radiusKm > 0)) throw new TypeError(`${where}.radiusKm must be positive, got ${JSON.stringify(radiusKm)}.`);
  if (!Array.isArray(altitudes) || altitudes.length < 2 || !altitudes.every((value, index) => typeof value === 'number' && Number.isFinite(value) && (index === 0 || value > altitudes[index - 1])))
    throw new TypeError(`${where}.altitudesKm must be an increasing list of at least two altitudes, got ${JSON.stringify(altitudes)}.`);
  const nadir = record.nadirOverheadSun as Record<string, unknown>, radiance = record.radiance as Record<string, unknown>;
  const ratio = (['red', 'green', 'blue'] as const).map(channel => {
    const centre = nadir?.[channel], values = radiance?.[channel];
    if (typeof centre !== 'number' || !(centre > 0)) throw new TypeError(`${where}.nadirOverheadSun.${channel} must be positive, got ${JSON.stringify(centre)}.`);
    if (!Array.isArray(values) || values.length !== altitudes.length || !values.every(entry => typeof entry === 'number' && entry > 0))
      throw new TypeError(`${where}.radiance.${channel} must hold one positive value per altitude (${altitudes.length}), got ${JSON.stringify(values)}.`);
    return Float64Array.from(values as number[], entry => entry / centre);
  });
  return { body: String(record.body), radiusKm, altitudesKm: altitudes as number[], ratio: [ratio[0], ratio[1], ratio[2]] };
}

export async function loadLimbProfile(sourceDirectory: string, path: string) {
  return parseLimbProfile(JSON.parse(await readFile(resolve(sourceDirectory, path), 'utf8')), path);
}

/**
 * The tangent altitude, in km above the profile's reference radius, of a display radius measured in the raster frame's
 * fitted silhouette. The visible disc ends at the lane's content scale (the lit map fills that fraction of the frame), so
 * that radius is the edge altitude (Venus's cloud top, Mars's surface) and the halo's altitudes grow outward from it.
 */
export function haloAltitudeKm(profile: LimbProfile, displayRadius: number, contentScale: number, edgeAltitudeKm: number) {
  if (!(contentScale > 0)) throw new RangeError(`The halo needs a positive content scale, got ${contentScale}.`);
  return edgeAltitudeKm + (displayRadius / contentScale - 1) * (profile.radiusKm + edgeAltitudeKm);
}

/**
 * Halo brightness relative to the disc centre at a tangent altitude, per channel: log-linear between the profile's
 * altitudes (radiance falls about exponentially with height), the lowest altitude's value below it, zero above the top.
 */
export function haloRatio(profile: LimbProfile, altitudeKm: number): [number, number, number] {
  const heights = profile.altitudesKm, last = heights.length - 1;
  if (!(altitudeKm <= heights[last])) return [0, 0, 0];
  let index = 0;
  while (index < last - 1 && heights[index + 1] < altitudeKm) index++;
  const t = Math.max(0, (altitudeKm - heights[index]) / (heights[index + 1] - heights[index]));
  return [0, 1, 2].map(channel => Math.exp(Math.log(profile.ratio[channel][index]) * (1 - t) + Math.log(profile.ratio[channel][index + 1]) * t)) as [number, number, number];
}
