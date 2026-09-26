/**
 * Planet limbs from published photometric models. A lighting overlay multiplies a body's map by its model's radiance
 * factor relative to the flood-lit disc centre (incidence, emission and phase all zero). The map shows as published at
 * the centre of the default shadowless view, and every other pixel follows the paper's law: the limb, the terminator
 * and, where the source publishes one, the phase curve. Nothing here is authored: no floor, ambient term or terminator
 * ramp. A colour map names one record per channel; a grey map names the same record three times.
 */
import sharp from 'sharp';
import { resolve } from 'node:path';
import { radianceFactor } from './normalization.ts';
import { loadPhotometricModelRecord, type PhotometricModelRecord } from './model-record.ts';

export type Channels<T> = readonly [T, T, T];
export const CHANNEL_NAMES = ['red', 'green', 'blue'] as const;

export interface LimbLaw {
  readonly paths: Channels<string>;
  readonly records: Channels<PhotometricModelRecord>;
  /** Each record's largest fitted emission angle, in radians: the law is held there, never extrapolated toward the limb. */
  readonly maximumEmission: Channels<number>;
  /** Each record's radiance factor at the flood-lit disc centre, the value every factor is divided by. */
  readonly centre: Channels<number>;
}

export interface LimbBlock {
  /** Model records per channel, source-relative: `photometry/<id>.json`. */
  readonly models: Channels<string>;
  /** Source-relative image whose mean observed colour is the overlay's reference; absent, the caller supplies one. */
  readonly reference?: string;
}

const FLOOD_CENTRE = Object.freeze({ incidence: 0, emission: 0, phase: 0 });

export function parseLimbBlock(value: unknown, where: string): LimbBlock {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${where} must be an object, got ${JSON.stringify(value)}.`);
  const record = value as Record<string, unknown>;
  const unknown = Object.keys(record).filter(key => key !== 'models' && key !== 'reference');
  if (unknown.length) throw new TypeError(`${where} has unknown keys: ${unknown.join(', ')}.`);
  const models = record.models;
  if (!Array.isArray(models) || models.length !== 3 || !models.every(path => typeof path === 'string' && /^photometry\/[a-z][a-z0-9-]*\.json$/u.test(path)))
    throw new TypeError(`${where}.models must name three records as photometry/<id>.json (red, green, blue), got ${JSON.stringify(models)}.`);
  if (record.reference !== undefined && (typeof record.reference !== 'string' || record.reference.startsWith('/') || record.reference.includes('..')))
    throw new TypeError(`${where}.reference must be a source-relative image path, got ${JSON.stringify(record.reference)}.`);
  return { models: [models[0], models[1], models[2]], ...(record.reference === undefined ? {} : { reference: record.reference as string }) };
}

export async function loadLimbLaw(sourceDirectory: string, paths: Channels<string>): Promise<LimbLaw> {
  const records = await Promise.all(paths.map(path => loadPhotometricModelRecord(sourceDirectory, path)));
  return limbLawFromRecords(paths, [records[0], records[1], records[2]]);
}

/** A law from records already read, one per channel. */
export function limbLawFromRecords(paths: Channels<string>, records: Channels<PhotometricModelRecord>): LimbLaw {
  // A Minnaert law diverges (k < 0.5) or vanishes (k > 0.5) toward the limb, where no observation constrained it, so a
  // limb law must state how close to the limb its data reached.
  const maximumEmission = records.map((record, channel) => {
    const range = record.fit.emissionDegrees;
    if (!range) throw new TypeError(`${paths[channel]} (${CHANNEL_NAMES[channel]}): a limb law needs fit.emissionDegrees, the emission range its data covered.`);
    return range[1] * Math.PI / 180;
  });
  const centre = records.map((record, channel) => {
    const value = radianceFactor(record.model, FLOOD_CENTRE);
    if (!(value > 0)) throw new Error(`${paths[channel]} (${CHANNEL_NAMES[channel]}): the model gives no light at the flood-lit disc centre (${value}).`);
    return value;
  });
  return { paths, records: [records[0], records[1], records[2]], centre: [centre[0], centre[1], centre[2]], maximumEmission: [maximumEmission[0], maximumEmission[1], maximumEmission[2]] };
}

/**
 * Per-channel radiance factor relative to the flood-lit disc centre; 0 on the night side. Angles in radians. Beyond a
 * record's fitted emission the law is held at that emission, and under flood light (incidence equal to emission) the
 * incidence with it, so the factor stays at its value at the edge of the data.
 */
export function limbFactors(law: LimbLaw, incidence: number, emission: number, phase: number): [number, number, number] {
  return [0, 1, 2].map(channel => {
    const limit = law.maximumEmission[channel], held = Math.min(emission, limit);
    const flood = Math.abs(incidence - emission) < 1e-9 && emission > limit;
    return radianceFactor(law.records[channel].model, { incidence: flood ? held : incidence, emission: held, phase }) / law.centre[channel];
  }) as [number, number, number];
}

/**
 * Each channel's mean factor over the flood-lit disc, weighted by projected area: what the law does to a uniform map's
 * disc-integrated colour. A measured whole-disc colour includes it; a map with the law divided out does not.
 */
export function floodDiscMean(law: LimbLaw, steps = 4096): [number, number, number] {
  const sum = [0, 0, 0];
  for (let step = 0; step < steps; step++) {
    const radius = (step + 0.5) / steps, emission = Math.asin(radius), factors = limbFactors(law, emission, emission, 0);
    for (let channel = 0; channel < 3; channel++) sum[channel] += factors[channel] * 2 * radius / steps;
  }
  return [sum[0], sum[1], sum[2]];
}

/** Angles at a point of a sphere or ellipsoid, from its unit normal, the unit light direction and the unit view direction. */
export function scatteringAngles(normal: readonly number[], light: readonly number[], view: readonly number[], minimumEmissionCosine: number) {
  const mu0 = normal[0] * light[0] + normal[1] * light[1] + normal[2] * light[2];
  const mu = Math.max(minimumEmissionCosine, normal[0] * view[0] + normal[1] * view[1] + normal[2] * view[2]);
  const cosPhase = light[0] * view[0] + light[1] * view[1] + light[2] * view[2];
  return { incidence: Math.acos(Math.max(-1, Math.min(1, mu0))), emission: Math.acos(Math.min(1, mu)), phase: Math.acos(Math.max(-1, Math.min(1, cosPhase))) };
}

export const srgbToLinear = (value: number) => { const s = value / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
export const linearToSrgb = (value: number) => 255 * (value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055);

/**
 * The source-over overlay that turns `reference` into reference × factor per channel, in linear light. One alpha serves
 * three channels, so the result is exact for a pixel of the reference colour and, whatever the pixel, for the channel
 * that sets the alpha; other colours differ by (reference − pixel)·(factor − the setting channel's factor). A factor
 * above 1 brightens toward white; a channel at 255 cannot brighten. Returns sRGB 0–255 colour and alpha 0–1.
 */
export function limbOverlay(factors: readonly number[], reference: Channels<number>): [number, number, number, number] {
  const desired = [0, 1, 2].map(channel => Math.max(0, Math.min(255, linearToSrgb(Math.min(1, srgbToLinear(reference[channel]) * factors[channel])))));
  let alpha = 0;
  for (let channel = 0; channel < 3; channel++) {
    const base = reference[channel], target = desired[channel];
    if (target < base) alpha = Math.max(alpha, 1 - target / base);
    else if (target > base && base < 255) alpha = Math.max(alpha, (target - base) / (255 - base));
  }
  alpha = Math.min(1, alpha);
  // The sRGB round trip leaves ~1e-16 where a factor is exactly 1; that is no overlay.
  if (alpha <= 1e-9) return [0, 0, 0, 0];
  const colour = desired.map((target, channel) => Math.max(0, Math.min(255, (target - reference[channel] * (1 - alpha)) / alpha)));
  return [colour[0], colour[1], colour[2], alpha];
}

/**
 * The overlay beyond the body's silhouette. Overlays reach slightly past the planet to cover its mesh edge; there the
 * base is often black space, where any overlay colour would show as a coloured outline. Outside the silhouette the
 * overlay keeps its alpha and loses its colour, so it only darkens, as the black lighting frames always did.
 */
export const outsideSilhouette = ([, , , alpha]: readonly number[]): [number, number, number, number] => [0, 0, 0, alpha];

/**
 * Mean sRGB colour of an image's observed pixels: opaque, and not the pure black that archives use for missing data.
 * The overlay's one alpha is exact for this colour; the body README reports it.
 */
export async function meanObservedColour(path: string): Promise<[number, number, number]> {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const sum = [0, 0, 0]; let count = 0;
  for (let offset = 0; offset < data.length; offset += info.channels) {
    if (data[offset + 3] < 255 || (data[offset] === 0 && data[offset + 1] === 0 && data[offset + 2] === 0)) continue;
    sum[0] += data[offset]; sum[1] += data[offset + 1]; sum[2] += data[offset + 2]; count++;
  }
  if (!count) throw new Error(`${path} has no observed pixel to take a reference colour from.`);
  return [sum[0] / count, sum[1] / count, sum[2] / count].map(value => Math.round(value * 1000) / 1000) as [number, number, number];
}

export const referenceImagePath = (sourceDirectory: string, block: LimbBlock) => block.reference === undefined ? undefined : resolve(sourceDirectory, block.reference);

/**
 * How much of an overlay's colour to keep at a radius measured in the fitted silhouette's equatorial radius. The frame
 * is fitted to a circle of that radius, but a flattened body's mesh reaches only its polar radius toward the poles, and
 * a faceted mesh falls up to half a percent inside its circle. Beyond the smallest silhouette the mesh can have the
 * overlay may lie over space, so its colour is gone there, faded over the percent of radius just inside; past that
 * point the overlay only darkens.
 */
export function silhouetteColourWeight(radius: number, polarToEquatorial: number) {
  const edge = polarToEquatorial * 0.995, start = edge - 0.01;
  return radius <= start ? 1 : radius >= edge ? 0 : (edge - radius) / (edge - start);
}

/**
 * One view-aligned lighting frame of a sphere: the overlay for a light direction in view space (view is +z). The
 * geometry is the retained sphere silhouette of the raster lane: pixel centres, the frame's centre at (size - 1)/2, the
 * fitted silhouette at half the frame and the lit disc at size × radiusScale. Emission is floored at half a pixel from
 * the silhouette, where the law's own value is taken.
 */
export function limbSphereFrame(size: number, radiusScale: number, light: readonly number[], law: LimbLaw, reference: Channels<number>, polarToEquatorial: number): Uint8Array {
  const pixels = new Uint8Array(size * size * 4), center = (size - 1) / 2, radius = size * radiusScale, view = [0, 0, 1], floor = 0.5 / radius;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = (x - center) / radius, ny = (y - center) / radius, radial = nx * nx + ny * ny;
    if (radial > 1) continue;
    const normal = [nx, ny, Math.sqrt(1 - radial)];
    const { incidence, emission, phase } = scatteringAngles(normal, light, view, floor);
    const [r0, g0, b0, a] = limbOverlay(limbFactors(law, incidence, emission, phase), reference);
    const keep = silhouetteColourWeight(Math.sqrt(radial) * radiusScale / 0.5, polarToEquatorial), r = r0 * keep, g = g0 * keep, b = b0 * keep;
    const offset = (y * size + x) * 4;
    pixels[offset] = Math.round(r); pixels[offset + 1] = Math.round(g); pixels[offset + 2] = Math.round(b); pixels[offset + 3] = Math.round(a * 255);
  }
  return pixels;
}
