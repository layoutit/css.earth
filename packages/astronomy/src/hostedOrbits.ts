import { HOSTED_ORBITS } from './data/hostedOrbits.data.js'
import { STAR_ASTROMETRY } from './data/starAstrometry.data.js'
import { BODIES } from './body-data.js'
import { directionFromRaDec, skyBasis } from './stars.js'
import { RAD_PER_DEG } from './angles.js'
import type { Vec3 } from './vec3.js'

/** A planet on a circular transit-fitted orbit around a placed star: the period, size and inclination a transit light curve
 * measures, the transit time that fixes its phase, and the position angle of the ascending node on the sky, which
 * photometry does not measure and each record states as a display convention. */
export interface HostedOrbit {
  readonly periodDays: number
  /** Semi-major axis in units of the host star's radius, the quantity a transit fit returns. */
  readonly semiMajorAxisStellarRadii: number
  /** Orbital inclination to the plane of the sky, degrees (90 is edge-on). */
  readonly inclinationDegrees: number
  /** Only circular orbits are modelled. */
  readonly eccentricity: 0
  /** Mid-transit time, barycentric modified Julian date in TDB. */
  readonly transitTimeBmjdTdb: number
  /** Position angle of the ascending node, degrees east of celestial north. */
  readonly ascendingNodePositionAngleDegrees: number
  readonly sources: { readonly period: string; readonly shape: string; readonly phase: string; readonly orientation: string }
}
export type HostedPlanetId = keyof typeof HOSTED_ORBITS
export const HOSTED_PLANET_IDS: readonly HostedPlanetId[] = Object.keys(HOSTED_ORBITS) as HostedPlanetId[]
export const hostedOrbit = (id: HostedPlanetId): HostedOrbit => HOSTED_ORBITS[id]

const MJD_OFFSET = 2400000.5

/** The observer's frame at a star: +Z toward the Sun (the observer), +X on the sky at the ascending node's position angle
 * (east of north), +Y = Z x X. The frame is right-handed, so cross products taken in it agree with ICRF. */
export const hostSkyFrame = (star: { rightAscensionDegrees: number; declinationDegrees: number }, nodePositionAngleDegrees: number): { x: Vec3; y: Vec3; z: Vec3 } => {
  const sight = directionFromRaDec(star.rightAscensionDegrees, star.declinationDegrees)
  const { east, north } = skyBasis(star.rightAscensionDegrees, star.declinationDegrees)
  const angle = nodePositionAngleDegrees * RAD_PER_DEG
  const x = [0, 1, 2].map(axis => Math.cos(angle) * north[axis]! + Math.sin(angle) * east[axis]!) as unknown as Vec3
  const z = sight.map(value => -value) as unknown as Vec3
  const y: Vec3 = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]]
  return { x, y, z }
}

/** Orbital phase in radians, zero at mid-transit. Scene epochs are TT Julian dates; TDB differs from TT by under 2 ms and the
 * barycentric light-time correction (under 8.3 minutes, 0.7 percent of this orbit) is not applied, as for the star placement. */
export const hostedOrbitPhase = (orbit: Pick<HostedOrbit, 'periodDays' | 'transitTimeBmjdTdb'>, epochJdTt: number): number =>
  2 * Math.PI * (epochJdTt - MJD_OFFSET - orbit.transitTimeBmjdTdb) / orbit.periodDays

/** State of the planet relative to its host star, ICRF km and km/day. At phase 0 the planet is in front of the star
 * (+Z, toward the observer), offset by -a cos i along +Y; a quarter orbit later it crosses the plane of the sky at the
 * ascending node, +a along +X, moving away from the observer. */
export const hostedOrbitStateRelativeKm = (orbit: HostedOrbit, host: { rightAscensionDegrees: number; declinationDegrees: number }, stellarRadiusKm: number, epochJdTt: number): { positionKm: Vec3; velocityKmPerDay: Vec3 } => {
  const a = orbit.semiMajorAxisStellarRadii * stellarRadiusKm, inclination = orbit.inclinationDegrees * RAD_PER_DEG
  const phase = hostedOrbitPhase(orbit, epochJdTt), rate = 2 * Math.PI / orbit.periodDays
  const { x, y, z } = hostSkyFrame(host, orbit.ascendingNodePositionAngleDegrees)
  const local = [a * Math.sin(phase), -a * Math.cos(inclination) * Math.cos(phase), a * Math.sin(inclination) * Math.cos(phase)]
  const localVelocity = [a * rate * Math.cos(phase), a * rate * Math.cos(inclination) * Math.sin(phase), -a * rate * Math.sin(inclination) * Math.sin(phase)]
  const toIcrf = (v: readonly number[]) => [0, 1, 2].map(axis => v[0]! * x[axis]! + v[1]! * y[axis]! + v[2]! * z[axis]!) as unknown as Vec3
  return { positionKm: toIcrf(local), velocityKmPerDay: toIcrf(localVelocity) }
}

/** The same state for a compiled record: the host's catalogue direction and radius come from its own records. */
export const hostedPlanetStateRelativeKm = (id: HostedPlanetId, epochJdTt: number): { positionKm: Vec3; velocityKmPerDay: Vec3; hostId: string } => {
  const hostId = BODIES[id].parent
  if (hostId === null || !Object.hasOwn(STAR_ASTROMETRY, hostId)) throw new TypeError(`A hosted orbit needs a placed star as its parent: ${id}.`)
  const host = STAR_ASTROMETRY[hostId as keyof typeof STAR_ASTROMETRY]
  return { ...hostedOrbitStateRelativeKm(hostedOrbit(id), host, BODIES[hostId as keyof typeof BODIES].meanRadiusKm, epochJdTt), hostId }
}
