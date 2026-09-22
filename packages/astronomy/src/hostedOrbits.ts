import { HOSTED_ORBITS } from './data/hostedOrbits.data.js'
import { STAR_ASTROMETRY } from './data/starAstrometry.data.js'
import { BODIES } from './body-data.js'
import { directionFromRaDec, skyBasis } from './stars.js'
import { RAD_PER_DEG } from './angles.js'
import { keplerStateKm, type KeplerianElements } from './kepler.js'
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
  /** Argument of periapsis in the orbital plane, in the convention where the transit falls at true anomaly f = pi/2 - omega:
   * RadVel's, which reports the star's omega (a planet-centric omega differs by 180 degrees). It is not a position angle on the sky. */
  readonly argumentOfPeriapsisDegrees?: number
  /**
   * Meaning assigned to `transitTimeBmjdTdb`. Required for an eccentric orbit so its epoch is never silently
   * reinterpreted. `inferior-conjunction` uses the transit convention f = pi/2 - argumentOfPeriapsis; `periastron` is the
   * epoch of periastron passage (f = 0), the epoch an astrometric orbit of a directly imaged planet publishes.
   */
  readonly epochDefinition?: 'inferior-conjunction' | 'periastron'
  /** Barycentric modified Julian date in TDB at the stated epoch definition. */
  readonly transitTimeBmjdTdb: number
  /** Position angle of the ascending node, degrees east of celestial north. */
  readonly ascendingNodePositionAngleDegrees: number
  /**
   * The published orbit this planet is predicted from, named as the prediction tool knows it. Tools call that owner for
   * predicted positions and their uncertainty; the runtime never reads this.
   */
  readonly prediction?: {
    readonly tool: 'whereistheplanet'
    readonly planet: string
    readonly reference: string
  }
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
  if (orbit.epochDefinition !== undefined && orbit.epochDefinition !== 'inferior-conjunction' && orbit.epochDefinition !== 'periastron') throw new TypeError(`Unsupported hosted-orbit epoch definition: ${String(orbit.epochDefinition)}.`)
  if (orbit.argumentOfPeriapsisDegrees !== undefined && !(Number.isFinite(orbit.argumentOfPeriapsisDegrees) && orbit.argumentOfPeriapsisDegrees >= 0 && orbit.argumentOfPeriapsisDegrees < 360)) throw new TypeError('argumentOfPeriapsisDegrees must be finite and in [0, 360) when present.')
  if (e > 0 && (orbit.argumentOfPeriapsisDegrees === undefined || orbit.epochDefinition === undefined)) {
    throw new TypeError('An eccentric hosted orbit requires argumentOfPeriapsisDegrees and an epochDefinition ("inferior-conjunction" or "periastron").')
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
 * The published transit record as ordinary Keplerian elements about the host, in ICRF equatorial axes: the same element
 * set asteroids, comets and dwarf planets carry, propagated by the same `keplerStateKm`. The measured period is kept as the
 * mean motion (never re-derived from masses), and the epoch is the inferior conjunction, where f = pi/2 - omega.
 * The orbit's plane comes from the host's sky frame: the ascending node lies on the sky at the recorded position angle,
 * and the orbit is inclined by the recorded inclination toward the observer.
 */
export const hostedKeplerElements = (orbit: HostedOrbit, host: { rightAscensionDegrees: number; declinationDegrees: number }, stellarRadiusKm: number): KeplerianElements => {
  const { eccentricity: e, argumentOfPeriapsisRad: periapsis } = validatedEccentricParameters(orbit)
  if (!(Number.isFinite(stellarRadiusKm) && stellarRadiusKm > 0)) throw new TypeError('stellarRadiusKm must be finite and positive.')
  if (!(Number.isFinite(host.rightAscensionDegrees) && Number.isFinite(host.declinationDegrees))) throw new TypeError('Host right ascension and declination must be finite.')
  if (!(Number.isFinite(orbit.periodDays) && orbit.periodDays > 0)) throw new TypeError(`periodDays must be finite and positive; got ${orbit.periodDays}.`)
  if (!Number.isFinite(orbit.transitTimeBmjdTdb)) throw new TypeError('Hosted-orbit BMJD_TDB epochs must be finite.')
  const inclination = orbit.inclinationDegrees * RAD_PER_DEG
  const { x, y, z } = hostSkyFrame(host, orbit.ascendingNodePositionAngleDegrees)
  const toIcrf = (v: readonly number[]) => [0, 1, 2].map(axis => v[0]! * x[axis]! + v[1]! * y[axis]! + v[2]! * z[axis]!) as unknown as Vec3
  // In the sky frame the line of nodes is -X and the in-plane direction 90 degrees along the motion rises toward the observer.
  const node = toIcrf([-1, 0, 0]), across = toIcrf([0, -Math.cos(inclination), Math.sin(inclination)])
  const perifocal = [0, 1, 2].map(axis => Math.cos(periapsis) * node[axis]! + Math.sin(periapsis) * across[axis]!) as unknown as Vec3
  const normal: Vec3 = [node[1] * across[2] - node[2] * across[1], node[2] * across[0] - node[0] * across[2], node[0] * across[1] - node[1] * across[0]]
  const equatorialInclination = Math.acos(Math.max(-1, Math.min(1, normal[2])))
  const ascendingNode = Math.hypot(normal[0], normal[1]) < 1e-15 ? 0 : Math.atan2(normal[0], -normal[1])
  const equatorialNode: Vec3 = [Math.cos(ascendingNode), Math.sin(ascendingNode), 0]
  const nodeNormal: Vec3 = [normal[1] * equatorialNode[2] - normal[2] * equatorialNode[1], normal[2] * equatorialNode[0] - normal[0] * equatorialNode[2], normal[0] * equatorialNode[1] - normal[1] * equatorialNode[0]]
  const argument = Math.atan2(perifocal[0] * nodeNormal[0] + perifocal[1] * nodeNormal[1] + perifocal[2] * nodeNormal[2],
    perifocal[0] * equatorialNode[0] + perifocal[1] * equatorialNode[1] + perifocal[2] * equatorialNode[2])
  // The epoch's true anomaly: the transit convention f = pi/2 - omega, or f = 0 at a periastron epoch.
  const epochTrueAnomaly = orbit.epochDefinition === 'periastron' ? 0 : Math.PI / 2 - periapsis
  const conjunctionEccentricAnomaly = Math.atan2(Math.sqrt(1 - e * e) * Math.sin(epochTrueAnomaly), e + Math.cos(epochTrueAnomaly))
  return {
    epochJdTt: orbit.transitTimeBmjdTdb + MJD_OFFSET,
    semiMajorAxisKm: orbit.semiMajorAxisStellarRadii * stellarRadiusKm,
    eccentricity: e,
    inclinationRad: equatorialInclination,
    ascendingNodeRad: ascendingNode,
    argumentOfPeriapsisRad: argument,
    meanAnomalyAtEpochRad: conjunctionEccentricAnomaly - e * Math.sin(conjunctionEccentricAnomaly),
    meanMotionRadPerDay: 2 * Math.PI / orbit.periodDays,
  }
}

/**
 * State relative to the host in ICRF km and km/day, evaluated in the published BMJD_TDB time scale: `keplerStateKm` on
 * `hostedKeplerElements`, with the epoch kept in BMJD so no precision is spent on the Julian Date offset.
 * At the stated inferior-conjunction epoch, f = pi/2 - omega. For e > 0 and i != 90 degrees this convention is
 * generally near, but not exactly at, minimum projected separation; it must not be relabelled as exact mid-transit.
 */
export const hostedOrbitStateRelativeBmjdTdb = (orbit: HostedOrbit, host: { rightAscensionDegrees: number; declinationDegrees: number }, stellarRadiusKm: number, epochBmjdTdb: number): { positionKm: Vec3; velocityKmPerDay: Vec3 } => {
  if (!Number.isFinite(epochBmjdTdb)) throw new TypeError('Hosted-orbit BMJD_TDB epochs must be finite.')
  const elements = hostedKeplerElements(orbit, host, stellarRadiusKm)
  const state = keplerStateKm({ ...elements, epochJdTt: orbit.transitTimeBmjdTdb }, epochBmjdTdb)
  return { positionKm: state.positionKm, velocityKmPerDay: state.velocityKmPerDay }
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
