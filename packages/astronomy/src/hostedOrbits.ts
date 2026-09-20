import { HOSTED_ORBITS } from './data/hostedOrbits.data.js'
import { STAR_ASTROMETRY } from './data/starAstrometry.data.js'
import { BODIES } from './body-data.js'
import { directionFromRaDec, skyBasis } from './stars.js'
import { RAD_PER_DEG } from './angles.js'
import { solveKeplerEccentricAnomalyRad } from './kepler.js'
import type { Vec3 } from './vec3.js'

/** A planet on a transit-fitted bound orbit around a placed star. */
export interface HostedOrbit {
  readonly periodDays: number
  /** Semi-major axis in units of the host star's radius, the quantity a transit fit returns. */
  readonly semiMajorAxisStellarRadii: number
  /** Orbital inclination to the plane of the sky, degrees (90 is edge-on). */
  readonly inclinationDegrees: number
  /** Elliptic eccentricity in [0, 1). */
  readonly eccentricity: number
  /** Planet-centric argument of periapsis in the orbital plane. It is not a position angle on the sky. */
  readonly argumentOfPeriapsisDegrees?: number
  /**
   * Meaning assigned to `transitTimeBmjdTdb`. Required for an eccentric orbit so its epoch is never silently
   * reinterpreted. `inferior-conjunction` uses the transit convention f = pi/2 - argumentOfPeriapsis.
   */
  readonly epochDefinition?: 'inferior-conjunction'
  /** Barycentric modified Julian date in TDB at the stated epoch definition. */
  readonly transitTimeBmjdTdb: number
  /** Position angle of the ascending node, degrees east of celestial north. */
  readonly ascendingNodePositionAngleDegrees: number
  readonly sources: {
    readonly period: string
    readonly shape: string
    readonly phase: string
    readonly orientation: string
    readonly eccentricity?: string
    readonly argumentOfPeriapsis?: string
  }
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

/** Mean phase elapsed from the hosted-orbit epoch, evaluated natively in BMJD_TDB. */
export const hostedOrbitPhaseBmjdTdb = (orbit: Pick<HostedOrbit, 'periodDays' | 'transitTimeBmjdTdb'>, epochBmjdTdb: number): number => {
  if (!(Number.isFinite(orbit.periodDays) && orbit.periodDays > 0)) throw new TypeError(`periodDays must be finite and positive; got ${orbit.periodDays}.`)
  if (!(Number.isFinite(orbit.transitTimeBmjdTdb) && Number.isFinite(epochBmjdTdb))) throw new TypeError('Hosted-orbit BMJD_TDB epochs must be finite.')
  return 2 * Math.PI * (epochBmjdTdb - orbit.transitTimeBmjdTdb) / orbit.periodDays
}

/**
 * Display-time compatibility path for callers whose scene epoch is JD_TT. It treats JD_TT - 2400000.5 as BMJD_TDB;
 * callers doing transit science must use `hostedOrbitPhaseBmjdTdb` and retain the published BMJD_TDB time scale.
 */
export const hostedOrbitPhase = (orbit: Pick<HostedOrbit, 'periodDays' | 'transitTimeBmjdTdb'>, epochJdTt: number): number =>
  hostedOrbitPhaseBmjdTdb(orbit, epochJdTt - MJD_OFFSET)

const validatedEccentricParameters = (orbit: HostedOrbit): { eccentricity: number; argumentOfPeriapsisRad: number } => {
  const e = orbit.eccentricity
  if (!(Number.isFinite(e) && e >= 0 && e < 1)) throw new TypeError(`eccentricity must be finite and in [0, 1); got ${e}.`)
  if (!(Number.isFinite(orbit.semiMajorAxisStellarRadii) && orbit.semiMajorAxisStellarRadii > 0)) throw new TypeError('semiMajorAxisStellarRadii must be finite and positive.')
  if (!(Number.isFinite(orbit.inclinationDegrees) && orbit.inclinationDegrees >= 0 && orbit.inclinationDegrees <= 180)) throw new TypeError('inclinationDegrees must be finite and in [0, 180].')
  if (!(Number.isFinite(orbit.ascendingNodePositionAngleDegrees) && orbit.ascendingNodePositionAngleDegrees >= 0 && orbit.ascendingNodePositionAngleDegrees < 360)) throw new TypeError('ascendingNodePositionAngleDegrees must be finite and in [0, 360).')
  if (orbit.epochDefinition !== undefined && orbit.epochDefinition !== 'inferior-conjunction') throw new TypeError(`Unsupported hosted-orbit epoch definition: ${String(orbit.epochDefinition)}.`)
  if (orbit.argumentOfPeriapsisDegrees !== undefined && !(Number.isFinite(orbit.argumentOfPeriapsisDegrees) && orbit.argumentOfPeriapsisDegrees >= 0 && orbit.argumentOfPeriapsisDegrees < 360)) throw new TypeError('argumentOfPeriapsisDegrees must be finite and in [0, 360) when present.')
  if (e > 0 && (orbit.argumentOfPeriapsisDegrees === undefined || orbit.epochDefinition !== 'inferior-conjunction')) {
    throw new TypeError('An eccentric hosted orbit requires argumentOfPeriapsisDegrees and epochDefinition "inferior-conjunction".')
  }
  if (orbit.semiMajorAxisStellarRadii * (1 - e) <= 1) throw new TypeError('Hosted orbit must remain outside the stellar surface: a/R* (1 - e) must be greater than 1.')
  return { eccentricity: e, argumentOfPeriapsisRad: (orbit.argumentOfPeriapsisDegrees ?? 0) * RAD_PER_DEG }
}

/** Exact maximum star-centre distance of the bound ellipse. */
export const hostedOrbitApoapsisKm = (orbit: HostedOrbit, stellarRadiusKm: number): number => {
  const { eccentricity } = validatedEccentricParameters(orbit)
  if (!(Number.isFinite(stellarRadiusKm) && stellarRadiusKm > 0)) throw new TypeError('stellarRadiusKm must be finite and positive.')
  return orbit.semiMajorAxisStellarRadii * stellarRadiusKm * (1 + eccentricity)
}

/**
 * State relative to the host in ICRF km and km/day, evaluated in the published BMJD_TDB time scale.
 * At the stated inferior-conjunction epoch, f = pi/2 - omega. For e > 0 and i != 90 degrees this convention is
 * generally near, but not exactly at, minimum projected separation; it must not be relabelled as exact mid-transit.
 */
export const hostedOrbitStateRelativeBmjdTdb = (orbit: HostedOrbit, host: { rightAscensionDegrees: number; declinationDegrees: number }, stellarRadiusKm: number, epochBmjdTdb: number): { positionKm: Vec3; velocityKmPerDay: Vec3 } => {
  const { eccentricity: e, argumentOfPeriapsisRad: periapsis } = validatedEccentricParameters(orbit)
  if (!(Number.isFinite(stellarRadiusKm) && stellarRadiusKm > 0)) throw new TypeError('stellarRadiusKm must be finite and positive.')
  if (!(Number.isFinite(host.rightAscensionDegrees) && Number.isFinite(host.declinationDegrees))) throw new TypeError('Host right ascension and declination must be finite.')
  const a = orbit.semiMajorAxisStellarRadii * stellarRadiusKm
  const inclination = orbit.inclinationDegrees * RAD_PER_DEG
  const rate = 2 * Math.PI / orbit.periodDays
  const { x, y, z } = hostSkyFrame(host, orbit.ascendingNodePositionAngleDegrees)
  const toIcrf = (v: readonly number[]) => [0, 1, 2].map(axis => v[0]! * x[axis]! + v[1]! * y[axis]! + v[2]! * z[axis]!) as unknown as Vec3
  // Preserve the original circular propagator exactly. Besides avoiding needless Kepler work, this keeps source-pinned
  // prepared coordinates (including signed zero) stable when eccentric-orbit support is added.
  if (e === 0) {
    const phase = hostedOrbitPhaseBmjdTdb(orbit, epochBmjdTdb)
    const local = [a * Math.sin(phase), -a * Math.cos(inclination) * Math.cos(phase), a * Math.sin(inclination) * Math.cos(phase)]
    const localVelocity = [a * rate * Math.cos(phase), a * rate * Math.cos(inclination) * Math.sin(phase), -a * rate * Math.sin(inclination) * Math.sin(phase)]
    return { positionKm: toIcrf(local), velocityKmPerDay: toIcrf(localVelocity) }
  }
  const beta = Math.sqrt(1 - e * e)
  const conjunctionTrueAnomaly = Math.PI / 2 - periapsis
  const conjunctionEccentricAnomaly = Math.atan2(beta * Math.sin(conjunctionTrueAnomaly), e + Math.cos(conjunctionTrueAnomaly))
  const conjunctionMeanAnomaly = conjunctionEccentricAnomaly - e * Math.sin(conjunctionEccentricAnomaly)
  const meanAnomaly = conjunctionMeanAnomaly + hostedOrbitPhaseBmjdTdb(orbit, epochBmjdTdb)
  const eccentricAnomaly = solveKeplerEccentricAnomalyRad(meanAnomaly, e)
  const cosE = Math.cos(eccentricAnomaly), sinE = Math.sin(eccentricAnomaly)
  const xOrbital = a * (cosE - e), yOrbital = a * beta * sinE
  const eccentricAnomalyRate = rate / (1 - e * cosE)
  const vxOrbital = -a * sinE * eccentricAnomalyRate, vyOrbital = a * beta * cosE * eccentricAnomalyRate
  const cosPeriapsis = Math.cos(periapsis), sinPeriapsis = Math.sin(periapsis)
  const alongNode = xOrbital * cosPeriapsis - yOrbital * sinPeriapsis
  const acrossNode = xOrbital * sinPeriapsis + yOrbital * cosPeriapsis
  const alongNodeVelocity = vxOrbital * cosPeriapsis - vyOrbital * sinPeriapsis
  const acrossNodeVelocity = vxOrbital * sinPeriapsis + vyOrbital * cosPeriapsis
  const local = [-alongNode, -acrossNode * Math.cos(inclination), acrossNode * Math.sin(inclination)]
  const localVelocity = [-alongNodeVelocity, -acrossNodeVelocity * Math.cos(inclination), acrossNodeVelocity * Math.sin(inclination)]
  return { positionKm: toIcrf(local), velocityKmPerDay: toIcrf(localVelocity) }
}

/** Display-time compatibility path; transit-science callers must use `hostedOrbitStateRelativeBmjdTdb`. */
export const hostedOrbitStateRelativeKm = (orbit: HostedOrbit, host: { rightAscensionDegrees: number; declinationDegrees: number }, stellarRadiusKm: number, epochJdTt: number): { positionKm: Vec3; velocityKmPerDay: Vec3 } => {
  if (!Number.isFinite(epochJdTt)) throw new TypeError('Hosted-orbit JD_TT epoch must be finite.')
  return hostedOrbitStateRelativeBmjdTdb(orbit, host, stellarRadiusKm, epochJdTt - MJD_OFFSET)
}

/** The same state for a compiled record: the host's catalogue direction and radius come from its own records. */
export const hostedPlanetStateRelativeKm = (id: HostedPlanetId, epochJdTt: number): { positionKm: Vec3; velocityKmPerDay: Vec3; hostId: string } => {
  const hostId = BODIES[id].parent
  if (hostId === null || !Object.hasOwn(STAR_ASTROMETRY, hostId)) throw new TypeError(`A hosted orbit needs a placed star as its parent: ${id}.`)
  const host = STAR_ASTROMETRY[hostId as keyof typeof STAR_ASTROMETRY]
  return { ...hostedOrbitStateRelativeKm(hostedOrbit(id), host, BODIES[hostId as keyof typeof BODIES].meanRadiusKm, epochJdTt), hostId }
}
