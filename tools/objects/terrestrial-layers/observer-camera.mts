import { cross3 as cross } from '../../../src/platform/vector3.mts';
/**
 * Observer-computed cameras for ground-based telescope photographs.
 *
 * A spacecraft archive ships its geometry beside the pixels: a label, a SUM/INFO control file or a SPICE kernel set.
 * A ground-based archive ships pixels and instrument metadata, and leaves the body geometry to be computed from an
 * ephemeris and a published rotation model. This module performs that computation and returns the same controlled-shape
 * camera fields a control network states, so the existing camera route consumes both kinds of source unchanged.
 *
 * Two rotation models feed it. A light-curve inversion spin state, as the asteroid shape surveys distribute it, and an
 * IAU pole model read from a text PCK, as the planets, their satellites and the spacecraft-visited small bodies are
 * described. Both are reduced to one `BodyOrientation` and the camera assumes nothing else about them.
 *
 * The spin-state convention is the light-curve inversion convention of Durech, Sidorin and Kaasalainen (2010), equation 1:
 *
 *   r_ecliptic = Rz(longitude) . Ry(90 - latitude) . Rz(phase) . r_body
 *
 * as an active rotation carrying a body vector into ecliptic J2000. Body coordinates therefore apply the transpose.
 * At zero phase the body's +y axis lies on the ascending node of the body equator on the ecliptic and its +x axis
 * lies 90 degrees away in the pole's meridian plane; the +x axis is the prime meridian by construction, and no
 * constant offset separates it from the parameter file's zero phase.
 */
import { requireFiniteNumber } from '../../sources/source-values.mts';
import type { Matrix3 } from '../../spice/ck.mts';
import { pckAngles, pckRotation } from '../../spice/frames.mts';
import { utcSecondsToEt, type LeapSeconds } from '../../spice/lsk.mts';
import type { KernelPool } from '../../spice/text-kernel.mts';

const DEGREE = Math.PI / 180;
/** Light travel time for one astronomical unit, in seconds (IAU 2009). */
const LIGHT_SECONDS_PER_AU = 499.004784;
const AU_KM = 1.495978707e8;

export type Vector = readonly [number, number, number];
export interface SpinState {
  /** Ecliptic J2000 latitude of the positive spin pole, in degrees. */
  latitudeDegrees: number;
  /** Ecliptic J2000 longitude of the positive spin pole, in degrees. */
  longitudeDegrees: number;
  /** Sidereal rotation period, in hours. */
  periodHours: number;
  /** Julian date at which the rotation phase equals phaseDegrees. */
  epochJd: number;
  /** Rotation phase at epochJd, in degrees. */
  phaseDegrees: number;
}

const rotateZ = (radians: number, v: Vector): Vector =>
  [v[0] * Math.cos(radians) - v[1] * Math.sin(radians), v[0] * Math.sin(radians) + v[1] * Math.cos(radians), v[2]];
const rotateY = (radians: number, v: Vector): Vector =>
  [v[0] * Math.cos(radians) + v[2] * Math.sin(radians), v[1], -v[0] * Math.sin(radians) + v[2] * Math.cos(radians)];
const unit = (v: Vector): Vector => {
  const m = Math.hypot(v[0], v[1], v[2]);
  if (!(m > 0)) throw new Error('Cannot normalise a zero-length direction.');
  return [v[0] / m, v[1] / m, v[2] / m];
};

const dot = (a: Vector, b: Vector) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const wrap360 = (degrees: number) => ((degrees % 360) + 360) % 360;

/**
 * The obliquity of the ecliptic at J2000.0, in degrees: IAU 2006 precession, 84381.406 arcseconds.
 * Equatorial and ecliptic J2000 differ by this single rotation about the shared +x axis.
 */
export const OBLIQUITY_J2000_DEGREES = 84381.406 / 3600;
const OBLIQUITY = OBLIQUITY_J2000_DEGREES * DEGREE;

export const equatorialToEcliptic = (v: Vector): Vector =>
  [v[0], v[1] * Math.cos(OBLIQUITY) + v[2] * Math.sin(OBLIQUITY), -v[1] * Math.sin(OBLIQUITY) + v[2] * Math.cos(OBLIQUITY)];
export const eclipticToEquatorial = (v: Vector): Vector =>
  [v[0], v[1] * Math.cos(OBLIQUITY) - v[2] * Math.sin(OBLIQUITY), v[1] * Math.sin(OBLIQUITY) + v[2] * Math.cos(OBLIQUITY)];

/** Carry an ecliptic J2000 direction into the body frame: the transpose of the inversion convention above. */
export function eclipticToBody(v: Vector, spin: SpinState, phaseDegrees: number): Vector {
  return rotateZ(-phaseDegrees * DEGREE, rotateY(-(90 - spin.latitudeDegrees) * DEGREE, rotateZ(-spin.longitudeDegrees * DEGREE, v)));
}

/** The rotation phase at an epoch already corrected to the time light left the body. */
export function rotationPhaseDegrees(bodyEpochJd: number, spin: SpinState) {
  return wrap360(spin.phaseDegrees + 360 * (bodyEpochJd - spin.epochJd) / (spin.periodHours / 24));
}

/** The epoch at the body for light received at observerEpochJd from rangeAu away. */
export function bodyEpochJd(observerEpochJd: number, rangeAu: number) {
  return observerEpochJd - rangeAu * LIGHT_SECONDS_PER_AU / 86400;
}

/**
 * How a body is oriented at a body epoch: the rotation carrying an equatorial J2000 direction into the body frame, and
 * the angle the provider itself calls the rotation phase, retained for evidence. Every provider places +z on the
 * positive spin pole with longitude increasing in the rotation direction; that is all the camera relies on.
 */
export interface BodyOrientation {
  rotation(bodyEpochJd: number): Matrix3;
  phaseDegrees(bodyEpochJd: number): number;
}

const rotateBy = (m: Matrix3, v: Vector): Vector => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];

/** The inversion spin state as a body orientation. */
export function spinOrientation(spin: SpinState): BodyOrientation {
  return {
    rotation(bodyEpochJd) {
      const phase = rotationPhaseDegrees(bodyEpochJd, spin);
      const image = (v: Vector) => eclipticToBody(equatorialToEcliptic(v), spin, phase);
      const x = image([1, 0, 0]), y = image([0, 1, 0]), z = image([0, 0, 1]);
      return [[x[0], y[0], z[0]], [x[1], y[1], z[1]], [x[2], y[2], z[2]]];
    },
    phaseDegrees: bodyEpochJd => rotationPhaseDegrees(bodyEpochJd, spin),
  };
}

/** Julian date of the ephemeris-time origin, 2000-01-01T12:00:00. */
const J2000_JD = 2451545;

/**
 * The IAU pole model a text PCK states for a body (BODYnnn_POLE_RA, _POLE_DEC and _PM), as a body orientation.
 *
 * The model's argument is ephemeris time, so the leap-second kernel converts the camera's UTC Julian dates; for a body
 * turning a thousand degrees a day the 69 seconds between the two scales are most of a degree of longitude. W is
 * measured from the ascending node of the body equator on the ICRF equator, which differs from the inversion
 * convention's zero phase by a pole-dependent constant: the two providers are compared through the camera they give,
 * never through their angles.
 */
export function pckOrientation(pool: KernelPool, body: number, leapSeconds: LeapSeconds): BodyOrientation {
  const et = (bodyEpochJd: number) => utcSecondsToEt(leapSeconds, (requireFiniteNumber(bodyEpochJd, 'body epoch') - J2000_JD) * 86400);
  pckAngles(pool, body, 0); // A body the kernel does not describe is refused here, not at the first frame.
  return {
    rotation: bodyEpochJd => pckRotation(pool, body, et(bodyEpochJd)),
    phaseDegrees: bodyEpochJd => wrap360(pckAngles(pool, body, et(bodyEpochJd)).w),
  };
}

const direction = (rightAscensionDegrees: number, declinationDegrees: number): Vector => [
  Math.cos(declinationDegrees * DEGREE) * Math.cos(rightAscensionDegrees * DEGREE),
  Math.cos(declinationDegrees * DEGREE) * Math.sin(rightAscensionDegrees * DEGREE),
  Math.sin(declinationDegrees * DEGREE)];

/**
 * A parameter record as the light-curve inversion releases distribute it: pole latitude, pole longitude and period on
 * the first line, then the phase epoch and the phase at that epoch. The column order is NOT consistent across the
 * VLT/SPHERE survey's files, so the caller states which order this file uses after checking it against a published
 * pole; this parser only enforces that the values are numbers in range for the stated order.
 */
export function parseSpinState(text: string, order: 'latitude-first' | 'longitude-first'): SpinState {
  // DAMIT's spin.txt is the same two lines followed by its photometric parameters, numbers only; nothing else may follow.
  const lines = text.trim().split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
  if (lines.length < 2 || lines.slice(2).some(line => !/^[-+0-9.eE]+(\s+[-+0-9.eE]+)*$/u.test(line))) throw new TypeError('A spin parameter record holds exactly two non-empty lines, then at most DAMIT’s photometric parameters.');
  const first = lines[0].split(/\s+/).map(Number), second = lines[1].split(/\s+/).map(Number);
  if (first.length !== 3 || second.length !== 2) throw new TypeError('A spin parameter record holds three values then two.');
  const [a, b, periodHours] = first.map((value, index) => requireFiniteNumber(value, `spin parameter ${index + 1}`));
  const epochJd = requireFiniteNumber(second[0], 'spin phase epoch');
  let phaseDegrees = requireFiniteNumber(second[1], 'spin phase');
  let latitudeDegrees = order === 'latitude-first' ? a : b;
  let longitudeDegrees = order === 'latitude-first' ? b : a;
  // Some records state a pole a little past the pole rather than normalising it: 130 Elektra's is -92.2669, which is
  // 2.27 degrees beyond the south pole. That is the same axis as (latitude -87.7331, longitude + 180), but the
  // record's rotation convention builds a body frame turned half a turn about that axis, so folding the pole adds
  // 180 degrees of phase as well. Reading it as an error loses the record. A value far outside the range is not an
  // unnormalised pole, though; it means the caller has the column order wrong, and that stays an error.
  if (Math.abs(latitudeDegrees) > 90 && Math.abs(latitudeDegrees) <= 95) {
    latitudeDegrees = Math.sign(latitudeDegrees) * 180 - latitudeDegrees;
    longitudeDegrees += 180;
    phaseDegrees = wrap360(phaseDegrees + 180);
  }
  if (!(Math.abs(latitudeDegrees) <= 90)) throw new TypeError(`Spin pole latitude ${latitudeDegrees} is out of range for a ${order} record.`);
  if (!(periodHours > 0) || !(periodHours < 24 * 365)) throw new TypeError('Spin period is out of range.');
  if (!(epochJd > 2_000_000) || !(epochJd < 3_000_000)) throw new TypeError('Spin phase epoch is not a Julian date.');
  return { latitudeDegrees, longitudeDegrees: wrap360(longitudeDegrees), periodHours, epochJd, phaseDegrees };
}

export interface ObserverSighting {
  /** Julian date of the exposure, at the observer. */
  epochJd: number;
  /** Astrometric right ascension and declination of the body from the observer, equatorial J2000, in degrees. */
  targetRightAscensionDegrees: number;
  targetDeclinationDegrees: number;
  /** Direction from the body to the Sun, equatorial J2000, in degrees. */
  sunRightAscensionDegrees: number;
  sunDeclinationDegrees: number;
  /** Observer-to-body distance, in astronomical units. */
  rangeAu: number;
  /** Angular size of one detector pixel, in microradians. */
  pixelAngleMicroradians: number;
  /** Body centre in the image, in zero-based pixels. */
  center: readonly [number, number];
}

export interface ObserverCamera {
  observerLatitude: number;
  observerWestLongitude: number;
  sunLatitude: number;
  sunWestLongitude: number;
  rangeKm: number;
  northAzimuthDegrees: number;
  pixelAngleMicroradians: number;
  center: [number, number];
  /** Retained for evidence: the rotation phase used, and the body epoch it was evaluated at. */
  phaseDegrees: number;
  bodyEpochJd: number;
}

/**
 * The controlled-shape camera a telescope sighting implies.
 *
 * The inversion frame is right-handed with +z on the spin pole, so atan2(y, x) increases in the rotation direction:
 * that is an EAST longitude. The controlled-shape camera states west longitudes and builds its observer vector as
 * east = -west, so the two are opposite and the body longitude is negated here. Writing it through unchanged
 * reflects the body through its own xz-plane, which no silhouette, disc size or phase-angle check can detect.
 * The north azimuth is the celestial position angle of the positive spin pole, negated for the same camera's axes.
 */
export function observerCamera(sighting: ObserverSighting, orientation: BodyOrientation | SpinState): ObserverCamera {
  const model = 'rotation' in orientation ? orientation : spinOrientation(orientation);
  const epoch = requireFiniteNumber(sighting.epochJd, 'sighting epoch');
  const rangeAu = requireFiniteNumber(sighting.rangeAu, 'sighting range');
  const pixelAngleMicroradians = requireFiniteNumber(sighting.pixelAngleMicroradians, 'pixel angle');
  if (!(rangeAu > 0) || !(pixelAngleMicroradians > 0)) throw new TypeError('A sighting needs a positive range and pixel angle.');
  if (sighting.center.length !== 2 || !sighting.center.every(Number.isFinite)) throw new TypeError('A sighting needs a finite image centre.');

  const bodyEpoch = bodyEpochJd(epoch, rangeAu);
  const phaseDegrees = model.phaseDegrees(bodyEpoch);
  const matrix = model.rotation(bodyEpoch);
  const toTarget = unit(direction(sighting.targetRightAscensionDegrees, sighting.targetDeclinationDegrees));
  const toSun = unit(direction(sighting.sunRightAscensionDegrees, sighting.sunDeclinationDegrees));

  const observerBody = rotateBy(matrix, [-toTarget[0], -toTarget[1], -toTarget[2]]);
  const sunBody = rotateBy(matrix, toSun);
  // atan2(y, x) is the east longitude in this frame; the camera states west, so it is negated.
  const subPoint = (v: Vector) => ({ latitude: Math.asin(Math.max(-1, Math.min(1, v[2]))) / DEGREE, westLongitude: -Math.atan2(v[1], v[0]) / DEGREE });
  const observer = subPoint(observerBody), sun = subPoint(sunBody);

  // Sky axes at the target: east along increasing right ascension, north completing the pair against the line of sight.
  const skyEast = unit([-Math.sin(sighting.targetRightAscensionDegrees * DEGREE), Math.cos(sighting.targetRightAscensionDegrees * DEGREE), 0]);
  const skyNorth = cross(toTarget, skyEast);
  // The body +z axis expressed in J2000 is the third row of the J2000-to-body rotation.
  const poleEquatorial = unit([matrix[2][0], matrix[2][1], matrix[2][2]]);
  const northAzimuthDegrees = wrap360(-Math.atan2(dot(poleEquatorial, skyEast), dot(poleEquatorial, skyNorth)) / DEGREE);

  return {
    observerLatitude: observer.latitude,
    observerWestLongitude: wrap360(observer.westLongitude),
    sunLatitude: sun.latitude,
    sunWestLongitude: wrap360(sun.westLongitude),
    rangeKm: rangeAu * AU_KM,
    northAzimuthDegrees,
    pixelAngleMicroradians,
    center: [sighting.center[0], sighting.center[1]],
    phaseDegrees,
    bodyEpochJd: bodyEpoch,
  };
}
