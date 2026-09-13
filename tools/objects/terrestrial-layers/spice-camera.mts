import { readFitsPlane } from '../observation/fits.mts';
import type { KernelSet } from '../../spice/kernel-set.mts';
import { encodeClock, clockToEt } from '../../spice/sclk.mts';
import { etToUtc } from '../../spice/lsk.mts';
import { spiceCamera, type Aberration, type PixelModelKeys } from '../../spice/camera.mts';
import type { SpiceCameraDeclaration } from './source-records.mts';

/**
 * Images whose archive ships no geometry: the camera comes from the mission's
 * SPICE kernels instead of from archived intercepts or label pointing. The
 * recipe's `spice` block names the kernel set (pinned inputs, in load order),
 * the observer and target SPK ids, the body-fixed frame, the instrument whose
 * kernel variables define the pixel model, the header card that carries the
 * exposure's spacecraft clock, the aberration correction, and the
 * instrument-frame axes that stored columns and rows follow. Everything else
 * is read from the kernels; per-pixel geometry is then derived on the retained
 * mesh exactly as for the archived-camera formats.
 */
export const SPICE_CAMERA_FORMAT = 'spice-camera';
export const ABERRATIONS: readonly Aberration[] = ['LT+S', 'LT', 'CN+S', 'CN', 'NONE'];

/** Header card values as the FITS reader keeps them: quoted strings lose their quotes and padding. */
export const unquoteCard = (value: string | undefined) => value === undefined ? undefined : /^'.*'$/su.test(value) ? value.slice(1, -1).trim() : value.trim();

export function pixelModelKeys(spice: SpiceCameraDeclaration): PixelModelKeys {
  const { pixels } = spice;
  if (pixels.focalLength.unit !== 'mm' || !['micrometre', 'mm'].includes(pixels.pixelPitch.unit)) throw new Error('Unsupported pixel model units.');
  return { ...pixels, focalLength: { key: pixels.focalLength.key, unit: 'mm' }, pixelPitch: { key: pixels.pixelPitch.key, unit: pixels.pixelPitch.unit === 'mm' ? 'mm' : 'micrometre' } };
}

export function aberrationOf(spice: SpiceCameraDeclaration): Aberration {
  const value = ABERRATIONS.find(a => a === spice.aberration);
  if (!value) throw new Error(`Unsupported aberration correction: ${spice.aberration}`);
  return value;
}

/** Decode the image plane, read the exposure epoch from its header and derive the camera from the loaded kernel set. */
export function decodeSpiceCameraFrame(bytes: Buffer, set: KernelSet, spice: SpiceCameraDeclaration, filter: string) {
  const image = readFitsPlane(bytes, spice.image.plane ?? 1), header = image.header;
  for (const [key, expected] of Object.entries(spice.image.header ?? {})) {
    if (unquoteCard(header[key]) !== expected) throw new Error(`FITS header ${key} is ${header[key] ?? 'absent'}, expected ${expected}.`);
  }
  const flagValue = (key: string) => { const value = Number(unquoteCard(header[key])); if (!Number.isFinite(value)) throw new Error(`FITS header lacks a numeric ${key}.`); return value; };
  const missing = (spice.image.missingValueKeys ?? []).map(flagValue), saturation = spice.image.saturationKey === undefined ? null : flagValue(spice.image.saturationKey);
  const clockText = unquoteCard(header[spice.clock.header]);
  if (clockText === undefined) throw new Error(`FITS header lacks the clock card ${spice.clock.header}.`);
  const clock = set.clock(spice.clock.spacecraft), ticks = encodeClock(clock, clockText), et = clockToEt(clock, set.leapSeconds, ticks), startTime = etToUtc(set.leapSeconds, et);
  const camera = spiceCamera({ pool: set.pool, ephemeris: set.ephemeris, rotation: set.rotation, observer: spice.observer, target: spice.target, bodyFrame: spice.bodyFrame,
    instrument: spice.instrument, et, aberration: aberrationOf(spice), pixels: pixelModelKeys(spice) });
  if (camera.width !== image.width || camera.height !== image.height) throw new Error(`Image is ${image.width} x ${image.height}; the instrument kernel describes ${camera.width} x ${camera.height}.`);
  const count = image.width * image.height, values = new Float32Array(count);
  let saturated = 0, flagged = 0;
  for (let i = 0; i < count; i++) {
    const value = image.values[i]; values[i] = value;
    if (value === saturation) saturated++; else if (!Number.isFinite(value) || missing.includes(value)) flagged++;
  }
  const { schema, matrix, rayMatrix, positionKm, sunDirection, report } = camera;
  return { width: image.width, height: image.height, planes: { IMAGE: values }, camera: { schema, matrix, rayMatrix, positionKm, sunDirection }, startTime, filter,
    acceptPixel: (i: number) => Number.isFinite(values[i]) && values[i] !== saturation && !missing.includes(values[i]),
    qualityReport: { units: `calibrated ${spice.image.quantity}`, plane: spice.image.plane ?? 1, saturatedPixels: saturated, flaggedPixels: flagged,
      flagDefinition: missing.length || saturation !== null ? `Header flag values rejected: ${[...missing, ...(saturation === null ? [] : [saturation])].join(', ')}.` : 'No archive flag values declared; nonfinite pixels rejected.',
      geometry: 'Per-pixel full-source mesh intersections from the SPICE-derived camera; prepared geometry, not archive-supplied backplanes.',
      exposure: { clockCard: spice.clock.header, clock: clockText, ticks, et, utc: startTime },
      camera: report, kernels: set.kernels.map(kernel => ({ path: kernel.path, bytes: kernel.bytes, sha256: kernel.sha256, kind: kernel.kind })) } };
}
