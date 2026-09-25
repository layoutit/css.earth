import { pds3Keyword } from '@cssearth/telescope';
import { readFitsPlane } from '@cssearth/fits';
import type { KernelSet } from '../../spice/kernel-set.mts';
import { encodeClock, clockToEt } from '../../spice/sclk.mts';
import { etToUtc, utcToEt } from '../../spice/lsk.mts';
import { spiceCamera, type Aberration, type PixelModelKeys } from '../../spice/camera.mts';
import type { SpiceCameraDeclaration } from './source-records.mts';
import { decodeCalibratedCamera } from './shape-camera-mosaic.mts';
import { relative, resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '../../..');
/** The kernel bank and the oracle fixtures both load kernels from an absolute, machine-specific path (the worktree
 * root, or a checkout under a different home directory). Recorded evidence must be reproducible across machines and
 * checkouts, so it names each kernel relative to the project root rather than embedding that absolute path. */
function kernelEvidence(set: KernelSet) {
  return set.kernels.map(kernel => {
    const path = relative(projectRoot, kernel.path);
    if (path.startsWith('..')) throw new Error(`Kernel evidence path escapes the project root: ${kernel.path}`);
    return { path, bytes: kernel.bytes, sha256: kernel.sha256, kind: kernel.kind };
  });
}

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
/** The same camera where the archive ships its bands as further planes of one array. */
export const SPICE_CAMERA_COLOR_FORMAT = 'spice-camera-color';
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

/** A PDS3 label keyword's value without quotes; a list such as ("CL1","GRN") reads as CL1,GRN. */
/**
 * A VICAR calibrated image with a detached PDS3 label, as the PDS Ring-Moon
 * Systems Node publishes CISSCAL-calibrated Cassini ISS frames. The camera is
 * evaluated at mid-exposure, halfway between the label's start and stop clock
 * counts. Only full-resolution frames are accepted, because a summed frame
 * does not match the instrument kernel's detector.
 */
function decodeVicarSpiceFrame(bytes: Buffer, label: string | undefined, set: KernelSet, spice: SpiceCameraDeclaration, filter: string) {
  if (label === undefined) throw new Error('A VICAR SPICE camera frame needs its PDS3 label.');
  for (const [key, expected] of Object.entries(spice.image.header ?? {})) {
    if (pds3Keyword(label, key) !== expected) throw new Error(`PDS3 label ${key} is ${pds3Keyword(label, key) ?? 'absent'}, expected ${expected}.`);
  }
  const labelFilter = pds3Keyword(label, 'FILTER_NAME');
  if (labelFilter !== undefined && labelFilter !== filter) throw new Error(`PDS3 label filter is ${labelFilter}, expected ${filter}.`);
  const startKey = spice.clock.start ?? '', stopKey = spice.clock.stop ?? '', start = pds3Keyword(label, startKey), stop = pds3Keyword(label, stopKey);
  if (!start || !stop) throw new Error(`PDS3 label lacks the clock keywords ${startKey} and ${stopKey}.`);
  const clock = set.clock(spice.clock.spacecraft), startTicks = encodeClock(clock, start), stopTicks = encodeClock(clock, stop);
  if (!(stopTicks >= startTicks)) throw new Error('The exposure clock runs backwards.');
  const ticks = (startTicks + stopTicks) / 2, et = clockToEt(clock, set.leapSeconds, ticks), startTime = etToUtc(set.leapSeconds, et);
  const image = decodeCalibratedCamera(bytes);
  const camera = spiceCamera({ pool: set.pool, ephemeris: set.ephemeris, rotation: set.rotation, observer: spice.observer, target: spice.target, bodyFrame: spice.bodyFrame,
    instrument: spice.instrument, et, aberration: aberrationOf(spice), pixels: pixelModelKeys(spice) });
  if (camera.width !== image.width || camera.height !== image.height) throw new Error(`Image is ${image.width} x ${image.height}; the instrument kernel describes ${camera.width} x ${camera.height}.`);
  const count = image.width * image.height, values = new Float32Array(count);
  let flagged = 0;
  for (let i = 0; i < count; i++) { const value = image.data[i]; values[i] = value; if (!Number.isFinite(value)) flagged++; }
  const { schema, matrix, rayMatrix, positionKm, sunDirection, report } = camera;
  // A VICAR frame carries one band; the colour field exists so both decoders share one shape.
  return { width: image.width, height: image.height, planes: { IMAGE: values }, camera: { schema, matrix, rayMatrix, positionKm, sunDirection }, startTime, filter,
    colorPlanes: undefined as readonly Float32Array[] | undefined,
    acceptPixel: (i: number) => Number.isFinite(values[i]),
    qualityReport: { units: `calibrated ${spice.image.quantity}`, plane: 1, saturatedPixels: 0, flaggedPixels: flagged,
      flagDefinition: 'VICAR calibrated samples with no archived flag plane; nonfinite pixels rejected.',
      geometry: 'Per-pixel full-source mesh intersections from the SPICE-derived camera; prepared geometry, not archive-supplied backplanes.',
      exposure: { clockCard: `${startKey} and ${stopKey}`, clock: `${start} to ${stop}`, ticks, et, utc: startTime },
      camera: report, kernels: kernelEvidence(set) } };
}

/** Decode the image plane, read the exposure epoch from its header and derive the camera from the loaded kernel set. */
export function decodeSpiceCameraFrame(bytes: Buffer, set: KernelSet, spice: SpiceCameraDeclaration, filter: string, label?: string) {
  if (spice.image.format === 'vicar-pds3') return decodeVicarSpiceFrame(bytes, label, set, spice, filter);
  const image = readFitsPlane(bytes, spice.image.plane ?? 1), header = image.header;
  for (const [key, expected] of Object.entries(spice.image.header ?? {})) {
    if (unquoteCard(header[key]) !== expected) throw new Error(`FITS header ${key} is ${header[key] ?? 'absent'}, expected ${expected}.`);
  }
  const flagValue = (key: string) => { const value = Number(unquoteCard(header[key])); if (!Number.isFinite(value)) throw new Error(`FITS header lacks a numeric ${key}.`); return value; };
  const missing = (spice.image.missingValueKeys ?? []).map(flagValue), saturation = spice.image.saturationKey === undefined ? null : flagValue(spice.image.saturationKey);
  // An archive that states the exposure epoch as UTC rather than a spacecraft clock count: read that card
  // directly. The clock path stays exactly as it was for archives that carry a count.
  const utcCard = spice.clock.utcHeader;
  let clockCard: string, clockText: string, ticks: number | null, et: number;
  if (utcCard !== undefined) {
    const stated = unquoteCard(header[utcCard]);
    if (stated === undefined) throw new Error(`FITS header lacks the epoch card ${utcCard}.`);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?$/u.test(stated)) throw new Error(`FITS header ${utcCard} is not an ISO 8601 UTC instant: ${stated}.`);
    clockCard = utcCard; clockText = stated; ticks = null;
    et = utcToEt(set.leapSeconds, stated.endsWith('Z') ? stated : `${stated}Z`);
  } else {
    clockCard = spice.clock.header ?? '';
    const stated = unquoteCard(header[clockCard]);
    if (stated === undefined) throw new Error(`FITS header lacks the clock card ${clockCard}.`);
    const clock = set.clock(spice.clock.spacecraft);
    clockText = stated; ticks = encodeClock(clock, stated); et = clockToEt(clock, set.leapSeconds, ticks);
  }
  const startTime = etToUtc(set.leapSeconds, et);
  const camera = spiceCamera({ pool: set.pool, ephemeris: set.ephemeris, rotation: set.rotation, observer: spice.observer, target: spice.target, bodyFrame: spice.bodyFrame,
    instrument: spice.instrument, et, aberration: aberrationOf(spice), pixels: pixelModelKeys(spice) });
  if (camera.width !== image.width || camera.height !== image.height) throw new Error(`Image is ${image.width} x ${image.height}; the instrument kernel describes ${camera.width} x ${camera.height}.`);
  const count = image.width * image.height, values = new Float32Array(count);
  let saturated = 0, flagged = 0;
  for (let i = 0; i < count; i++) {
    const value = image.values[i]; values[i] = value;
    if (value === saturation) saturated++; else if (!Number.isFinite(value) || missing.includes(value)) flagged++;
  }
  // A colour product carries its bands as further planes of the same array. Each is read through the same
  // reader and held to the same flag values, and a pixel is only accepted where every band is valid.
  const declaredColorPlanes = spice.image.colorPlanes ?? [];
  const colorPlanes = declaredColorPlanes.map(plane => {
    const band = readFitsPlane(bytes, plane);
    if (band.width !== image.width || band.height !== image.height) throw new Error(`FITS plane ${plane} is ${band.width} x ${band.height}; plane ${spice.image.plane ?? 1} is ${image.width} x ${image.height}.`);
    const out = new Float32Array(count);
    for (let i = 0; i < count; i++) out[i] = band.values[i]!;
    return out;
  });
  const valid = (v: number | undefined) => v !== undefined && Number.isFinite(v) && v !== saturation && !missing.includes(v);
  const { schema, matrix, rayMatrix, positionKm, sunDirection, report } = camera;
  return { width: image.width, height: image.height, planes: { IMAGE: values }, camera: { schema, matrix, rayMatrix, positionKm, sunDirection }, startTime, filter,
    colorPlanes: colorPlanes.length ? colorPlanes as readonly Float32Array[] : undefined,
    acceptPixel: (i: number) => valid(values[i]) && colorPlanes.every(band => valid(band[i])),
    qualityReport: { units: `calibrated ${spice.image.quantity}`, plane: spice.image.plane ?? 1, saturatedPixels: saturated, flaggedPixels: flagged,
      flagDefinition: missing.length || saturation !== null ? `Header flag values rejected: ${[...missing, ...(saturation === null ? [] : [saturation])].join(', ')}.` : 'No archive flag values declared; nonfinite pixels rejected.',
      geometry: 'Per-pixel full-source mesh intersections from the SPICE-derived camera; prepared geometry, not archive-supplied backplanes.',
      exposure: { clockCard, clock: clockText, ticks, et, utc: startTime },
      camera: report, kernels: kernelEvidence(set) } };
}
