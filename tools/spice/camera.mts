import { cross3 as cross, dot3 as dot } from '@cssearth/core';
/**
 * A pinhole camera from SPICE kernels for one exposure: the instrument frame's
 * orientation, the observer's position and the Sun direction in the target's
 * body-fixed frame, with light time and stellar aberration as SPICE's LT+S.
 * The pixel model is read from the instrument kernel through declared variable
 * names (focal length, pixel pitch, detector centre, boresight, array size);
 * the recipe states which instrument-frame axes stored columns and rows follow,
 * because that is a property of the archived array, not of the kernels.
 */
import { has, number, numbers, string, type KernelPool } from './text-kernel.mts';
import { apply, multiply, transpose, type Matrix3 } from '@cssearth/spice';
import { stelab, type Ephemeris } from './geometry.mts';
import { frameDefinition } from './frames.mts';

/** SPICE aberration corrections: one light-time iteration (LT), converged (CN), each with or without stellar aberration (+S), or none. */
export type Aberration = 'LT+S' | 'LT' | 'CN+S' | 'CN' | 'NONE';
export interface PixelModelKeys {
  /** INS<id>_ variable suffixes: focal length, pixel pitch, detector centre (sample, line), boresight, samples, lines, frame. */
  readonly focalLength: { readonly key: string; readonly unit: 'mm' };
  readonly pixelPitch: { readonly key: string; readonly unit: 'micrometre' | 'mm' };
  readonly center: string; readonly boresight: string; readonly samples: string; readonly lines: string; readonly frame: string;
  /** Array index of the first pixel in the centre's coordinates (0 when a 1024-wide array centres at 511.5). */
  readonly origin: number;
  /** Instrument-frame axis along which stored column and row indices increase: X, -X, Y, -Y, Z or -Z. */
  readonly column: string; readonly row: string;
}
export interface SpiceCameraRequest {
  readonly pool: KernelPool; readonly ephemeris: Ephemeris; readonly rotation: (frame: string | number, et: number) => Matrix3;
  readonly observer: number; readonly target: number; readonly bodyFrame: string; readonly instrument: number;
  readonly et: number; readonly aberration: Aberration; readonly sun?: number;
  /** The kernel variables to read the pixel model from, or a model the caller resolved from an instrument kernel that names its variables another way. */
  readonly pixels: PixelModelKeys | PixelModel;
  /** Where along its path the observer is taken, when a fit separates that epoch from the pointing epoch `et`. */
  readonly ephemerisEt?: number;
}
export interface SpiceCamera {
  readonly schema: 'cssearth-archived-camera@1';
  /** Body-fixed kilometres to pixel (column, row) with a positive third coordinate in front of the camera. */
  readonly matrix: number[][];
  /** Pixel (column, row, 1) to an unnormalised ray in the body-fixed frame. */
  readonly rayMatrix: number[][];
  readonly positionKm: number[]; readonly sunDirection: number[];
  readonly width: number; readonly height: number;
  readonly report: { instrumentFrame: string; focalLengthMm: number; pixelPitchMm: number; focalLengthPixels: number; center: number[]; boresight: number[];
    rangeKm: number; lightTimeSeconds: number; emissionEt: number; aberration: Aberration; aberrationMicroradians: number; sunDistanceKm: number; phaseAngleDegrees: number };
}

const AXES: Record<string, readonly number[]> = { X: [1, 0, 0], '-X': [-1, 0, 0], Y: [0, 1, 0], '-Y': [0, -1, 0], Z: [0, 0, 1], '-Z': [0, 0, -1] };
const unit = (v: readonly number[]) => { const n = Math.hypot(v[0], v[1], v[2]); return [v[0] / n, v[1] / n, v[2] / n]; };


/** Inverse of a 3x3 matrix by adjugate; throws for a singular pixel model. */
export function invert(m: Matrix3): Matrix3 {
  const [a, b, c] = m;
  const [p, q, r] = [cross(b, c), cross(c, a), cross(a, b)], det = dot(a, p);
  if (!(Math.abs(det) > 1e-18)) throw new Error('Singular camera matrix.');
  return [[p[0] / det, q[0] / det, r[0] / det], [p[1] / det, q[1] / det, r[1] / det], [p[2] / det, q[2] / det, r[2] / det]];
}

/** The rotation that stellar aberration applies to the direction `u` for an observer moving at `velocity` (km/s). */
export function aberrationRotation(u: readonly number[], velocity: readonly number[]): Matrix3 {
  const seen = unit(stelab(u, velocity)), from = unit(u), axis = cross(from, seen), s = Math.hypot(...axis), c = dot(from, seen);
  if (s < 1e-15) return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const [x, y, z] = axis.map(v => v / s), t = 1 - c;
  return [[t * x * x + c, t * x * y - s * z, t * x * z + s * y], [t * x * y + s * z, t * y * y + c, t * y * z - s * x], [t * x * z - s * y, t * y * z + s * x, t * z * z + c]];
}

export type PixelModel = ReturnType<typeof pixelModel>;

/** Read the pixel model from the instrument kernel variables the recipe names. */
export function pixelModel(pool: KernelPool, instrument: number, keys: PixelModelKeys) {
  const key = (suffix: string) => `INS${instrument}_${suffix}`;
  const read = (suffix: string) => { if (!has(pool, key(suffix))) throw new Error(`Instrument kernel lacks ${key(suffix)}.`); return numbers(pool, key(suffix)); };
  const focalLengthMm = number(pool, key(keys.focalLength.key));
  // Some instrument kernels state a square detector's pitch as one value per axis. Accept that pair only when
  // the two agree, so a genuinely non-square detector still fails rather than silently taking one axis.
  const pitchValues = numbers(pool, key(keys.pixelPitch.key));
  if (pitchValues.length === 2 && pitchValues[0] !== pitchValues[1]) throw new Error(`Instrument ${instrument} states a non-square pixel pitch.`);
  if (pitchValues.length > 2) throw new Error(`Instrument ${instrument} states an unsupported pixel pitch.`);
  const pitch = pitchValues[0]!;
  const pixelPitchMm = keys.pixelPitch.unit === 'micrometre' ? pitch / 1000 : pitch;
  const center = read(keys.center), samples = read(keys.samples), lines = read(keys.lines);
  // Some instrument kernels state the boresight as a vector in millimetres (Dawn VIR: 0, 0, 152); only its direction matters.
  const stated = read(keys.boresight), length = Math.hypot(...stated), boresight = stated.length === 3 && length > 0 ? stated.map(v => v / length) : stated;
  const frame = string(pool, key(keys.frame));
  if (keys.focalLength.unit !== 'mm' || !(focalLengthMm > 0) || !(pixelPitchMm > 0) || center.length !== 2 || boresight.length !== 3 || Math.abs(Math.hypot(...boresight) - 1) > 1e-9 ||
      samples.length !== 1 || lines.length !== 1 || !Number.isInteger(samples[0]) || !Number.isInteger(lines[0]) || ![0, 1].includes(keys.origin) ||
      !AXES[keys.column] || !AXES[keys.row] || Math.abs(dot(AXES[keys.column], AXES[keys.row])) > 0 || Math.abs(dot(AXES[keys.column], boresight)) > 1e-9 || Math.abs(dot(AXES[keys.row], boresight)) > 1e-9) {
    throw new Error(`Unsupported pixel model for instrument ${instrument}.`);
  }
  return { focalLengthMm, pixelPitchMm, focalLengthPixels: focalLengthMm / pixelPitchMm, center: [center[0] - keys.origin, center[1] - keys.origin], boresight, width: samples[0], height: lines[0], frame,
    column: AXES[keys.column], row: AXES[keys.row] };
}

/**
 * The camera for one exposure at ET. Positions and directions are expressed in
 * the target's body-fixed frame at the light-time corrected emission epoch, as
 * SPICE's sincpt evaluates them for the reception case. Stellar aberration is
 * applied as one rotation at the target direction; across a narrow field it
 * differs from per-pixel aberration by far less than a pixel.
 */
export function spiceCamera({ pool, ephemeris, rotation, observer, target, bodyFrame, instrument, et, aberration, pixels, sun = 10, ephemerisEt = et }: SpiceCameraRequest): SpiceCamera {
  const model = 'focalLengthPixels' in pixels ? pixels : pixelModel(pool, instrument, pixels);
  const lightTime = aberration !== 'NONE', stellarAberration = aberration.endsWith('+S'), converged = aberration.startsWith('CN');
  const apparent = ephemeris.apparent(target, observer, ephemerisEt, { lightTime, stellarAberration, converged }), emissionEt = apparent.emissionEt;
  const observerState = ephemeris.state(observer, 0, ephemerisEt), targetAtEmission = ephemeris.state(target, 0, emissionEt).position;
  const bodyRotation = rotation(bodyFrame, emissionEt); // J2000 -> body
  const positionKm = apply(bodyRotation, [observerState.position[0] - targetAtEmission[0], observerState.position[1] - targetAtEmission[1], observerState.position[2] - targetAtEmission[2]]);
  // Geometric directions from the observer are aberrated before the instrument sees them: instrument <- aberration <- J2000 <- body.
  const geometricTarget = [targetAtEmission[0] - observerState.position[0], targetAtEmission[1] - observerState.position[1], targetAtEmission[2] - observerState.position[2]];
  const aberrate = stellarAberration ? aberrationRotation(geometricTarget, observerState.velocity) : [[1, 0, 0], [0, 1, 0], [0, 0, 1]] as Matrix3;
  const seen = apply(aberrate, unit(geometricTarget));
  const aberrationMicroradians = Math.acos(Math.max(-1, Math.min(1, dot(seen, unit(geometricTarget))))) * 1e6;
  const instrumentRotation = multiply(multiply(rotation(frameDefinition(pool, model.frame).id, et), aberrate), transpose(bodyRotation)); // body -> instrument
  const f = model.focalLengthPixels, [cx, cy] = model.center, b = model.boresight;
  const intrinsic: Matrix3 = [
    [f * model.column[0] + cx * b[0], f * model.column[1] + cx * b[1], f * model.column[2] + cx * b[2]],
    [f * model.row[0] + cy * b[0], f * model.row[1] + cy * b[1], f * model.row[2] + cy * b[2]],
    [b[0], b[1], b[2]]];
  const projection = multiply(intrinsic, instrumentRotation);
  const matrix = projection.map(row => [...row, -dot(row, positionKm)]);
  const rayMatrix = multiply(transpose(instrumentRotation), invert(intrinsic));
  // The Sun as the body sees it at emission (light time and the body's own aberration), for incidence and phase.
  const sunApparent = ephemeris.apparent(sun, target, emissionEt, { lightTime, stellarAberration, converged });
  const sunDirection = unit(apply(bodyRotation, sunApparent.position));
  const toObserver = unit(positionKm);
  return { schema: 'cssearth-archived-camera@1', matrix, rayMatrix: rayMatrix.map(row => [...row]), positionKm, sunDirection, width: model.width, height: model.height,
    report: { instrumentFrame: model.frame, focalLengthMm: model.focalLengthMm, pixelPitchMm: model.pixelPitchMm, focalLengthPixels: f, center: model.center, boresight: [...b],
      rangeKm: Math.hypot(...positionKm), lightTimeSeconds: apparent.lightTimeSeconds, emissionEt, aberration, aberrationMicroradians, sunDistanceKm: Math.hypot(...sunApparent.position),
      phaseAngleDegrees: Math.acos(Math.max(-1, Math.min(1, dot(toObserver, sunDirection)))) * 180 / Math.PI } };
}
