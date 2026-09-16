/**
 * Observer-computed cameras for ground-based telescope photographs.
 *
 * A spacecraft archive ships its geometry beside the pixels: a label, a SUM/INFO control file or a SPICE kernel set.
 * A ground-based archive ships pixels and instrument metadata, and leaves the body geometry to be computed from an
 * ephemeris and a published spin state. This module performs that computation and returns the same controlled-shape
 * camera fields a control network states, so the existing camera route consumes both kinds of source unchanged.
 *
 * The rotation convention is the light-curve inversion convention of Durech, Sidorin and Kaasalainen (2010), equation 1:
 *
 *   r_ecliptic = Rz(longitude) . Ry(90 - latitude) . Rz(phase) . r_body
 *
 * as an active rotation carrying a body vector into ecliptic J2000. Body coordinates therefore apply the transpose.
 * At zero phase the body's +y axis lies on the ascending node of the body equator on the ecliptic and its +x axis
 * lies 90 degrees away in the pole's meridian plane; the +x axis is the prime meridian by construction, and no
 * constant offset separates it from the parameter file's zero phase.
 */
import { requireFiniteNumber } from '../../source-values.mts';

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
const cross = (a: Vector, b: Vector): Vector =>
  [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
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
  const lines = text.trim().split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
  if (lines.length !== 2) throw new TypeError('A spin parameter record holds exactly two non-empty lines.');
  const first = lines[0].split(/\s+/).map(Number), second = lines[1].split(/\s+/).map(Number);
  if (first.length !== 3 || second.length !== 2) throw new TypeError('A spin parameter record holds three values then two.');
  const [a, b, periodHours] = first.map((value, index) => requireFiniteNumber(value, `spin parameter ${index + 1}`));
  const epochJd = requireFiniteNumber(second[0], 'spin phase epoch');
  const phaseDegrees = requireFiniteNumber(second[1], 'spin phase');
  const latitudeDegrees = order === 'latitude-first' ? a : b;
  const longitudeDegrees = order === 'latitude-first' ? b : a;
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
 * Body longitudes run west-positive in the controlled-shape camera, and the inversion frame's own longitude,
 * atan2(y, x), increases in the rotation direction; those two agree, so the body longitude is used unchanged.
 * The north azimuth is the sky direction of the positive spin pole expressed in that camera's image axes.
 */
export function observerCamera(sighting: ObserverSighting, spin: SpinState): ObserverCamera {
  const epoch = requireFiniteNumber(sighting.epochJd, 'sighting epoch');
  const rangeAu = requireFiniteNumber(sighting.rangeAu, 'sighting range');
  const pixelAngleMicroradians = requireFiniteNumber(sighting.pixelAngleMicroradians, 'pixel angle');
  if (!(rangeAu > 0) || !(pixelAngleMicroradians > 0)) throw new TypeError('A sighting needs a positive range and pixel angle.');
  if (sighting.center.length !== 2 || !sighting.center.every(Number.isFinite)) throw new TypeError('A sighting needs a finite image centre.');

  const bodyEpoch = bodyEpochJd(epoch, rangeAu);
  const phaseDegrees = rotationPhaseDegrees(bodyEpoch, spin);
  const toTarget = unit(direction(sighting.targetRightAscensionDegrees, sighting.targetDeclinationDegrees));
  const toSun = unit(direction(sighting.sunRightAscensionDegrees, sighting.sunDeclinationDegrees));

  const observerBody = eclipticToBody(equatorialToEcliptic([-toTarget[0], -toTarget[1], -toTarget[2]]), spin, phaseDegrees);
  const sunBody = eclipticToBody(equatorialToEcliptic(toSun), spin, phaseDegrees);
  const subPoint = (v: Vector) => ({ latitude: Math.asin(Math.max(-1, Math.min(1, v[2]))) / DEGREE, longitude: Math.atan2(v[1], v[0]) / DEGREE });
  const observer = subPoint(observerBody), sun = subPoint(sunBody);

  // Sky axes at the target: east along increasing right ascension, north completing the pair against the line of sight.
  const skyEast = unit([-Math.sin(sighting.targetRightAscensionDegrees * DEGREE), Math.cos(sighting.targetRightAscensionDegrees * DEGREE), 0]);
  const skyNorth = cross(toTarget, skyEast);
  const poleEquatorial = eclipticToEquatorial(unit(direction(spin.longitudeDegrees, spin.latitudeDegrees)));
  const northAzimuthDegrees = wrap360(Math.atan2(-dot(poleEquatorial, skyEast), -dot(poleEquatorial, skyNorth)) / DEGREE);

  return {
    observerLatitude: observer.latitude,
    observerWestLongitude: wrap360(observer.longitude),
    sunLatitude: sun.latitude,
    sunWestLongitude: wrap360(sun.longitude),
    rangeKm: rangeAu * AU_KM,
    northAzimuthDegrees,
    pixelAngleMicroradians,
    center: [sighting.center[0], sighting.center[1]],
    phaseDegrees,
    bodyEpochJd: bodyEpoch,
  };
}
