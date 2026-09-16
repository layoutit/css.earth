import { STAR_ASTROMETRY } from './data/starAstrometry.data.js'
import { RAD_PER_DEG } from './angles.js'
import type { Vec3 } from './vec3.js'

/** Catalogue astrometry of a star beyond the Solar System: an ICRS direction and epoch, a distance, a proper
 * motion and a radial velocity. Each value names the publication it was read from. */
export interface StarAstrometry {
  readonly rightAscensionDegrees: number
  readonly declinationDegrees: number
  /** Epoch of the catalogue position, Julian years (ICRS positions are quoted at J2000.0). */
  readonly positionEpochJulianYear: number
  readonly distanceParsecs: number
  /** Proper motion in right ascension, already multiplied by cos(declination). */
  readonly properMotionRaMasPerYear: number
  readonly properMotionDecMasPerYear: number
  readonly radialVelocityKmPerS: number
  readonly sources: { readonly position: string; readonly distance: string; readonly properMotion: string; readonly radialVelocity: string }
}
export type StarId = keyof typeof STAR_ASTROMETRY
export const STAR_IDS: readonly StarId[] = Object.keys(STAR_ASTROMETRY) as StarId[]

export const PARSEC_KM = 3.085677581491367e13
const JULIAN_YEAR_DAYS = 365.25
const MAS_RAD = RAD_PER_DEG / 3.6e6
const SECONDS_PER_DAY = 86400
/** J2000.0 as a TT Julian date; the catalogue position epoch is measured from here in Julian years. */
const J2000_JD_TT = 2451545

export const starAstrometry = (id: StarId): StarAstrometry => STAR_ASTROMETRY[id]

/** Unit ICRF direction of a right ascension and declination in degrees. */
export const directionFromRaDec = (rightAscensionDegrees: number, declinationDegrees: number): Vec3 => {
  const ra = rightAscensionDegrees * RAD_PER_DEG, dec = declinationDegrees * RAD_PER_DEG
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)]
}

/** Local east and north unit vectors on the sky at a direction. */
export const skyBasis = (rightAscensionDegrees: number, declinationDegrees: number): { east: Vec3; north: Vec3 } => {
  const ra = rightAscensionDegrees * RAD_PER_DEG, dec = declinationDegrees * RAD_PER_DEG
  return { east: [-Math.sin(ra), Math.cos(ra), 0], north: [-Math.sin(dec) * Math.cos(ra), -Math.sin(dec) * Math.sin(ra), Math.cos(dec)] }
}

/** Heliocentric ICRF state of a star at an epoch: the catalogue position carried linearly by its space velocity.
 * Solar-System-barycentric and heliocentric differ by under 0.01 AU, negligible against a stellar distance.
 * Perspective acceleration and light-time are ignored; over a few decades they move Betelgeuse by metres. */
export const starStateKm = (id: StarId, epochJdTt: number): { positionKm: Vec3; velocityKmPerDay: Vec3 } => {
  const star = starAstrometry(id)
  const distanceKm = star.distanceParsecs * PARSEC_KM
  const direction = directionFromRaDec(star.rightAscensionDegrees, star.declinationDegrees)
  const { east, north } = skyBasis(star.rightAscensionDegrees, star.declinationDegrees)
  // Tangential speed: angular rate times distance. Radial speed along the line of sight.
  const eastKmPerDay = distanceKm * star.properMotionRaMasPerYear * MAS_RAD / JULIAN_YEAR_DAYS
  const northKmPerDay = distanceKm * star.properMotionDecMasPerYear * MAS_RAD / JULIAN_YEAR_DAYS
  const radialKmPerDay = star.radialVelocityKmPerS * SECONDS_PER_DAY
  const velocityKmPerDay: Vec3 = [0, 1, 2].map(axis => east[axis]! * eastKmPerDay + north[axis]! * northKmPerDay + direction[axis]! * radialKmPerDay) as unknown as Vec3
  const days = epochJdTt - (J2000_JD_TT + (star.positionEpochJulianYear - 2000) * JULIAN_YEAR_DAYS)
  const positionKm: Vec3 = [0, 1, 2].map(axis => direction[axis]! * distanceKm + velocityKmPerDay[axis]! * days) as unknown as Vec3
  return { positionKm, velocityKmPerDay }
}
