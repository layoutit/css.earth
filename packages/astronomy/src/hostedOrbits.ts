import { HOSTED_ORBITS } from './data/hostedOrbits.data.js'
import { STAR_ASTROMETRY } from './data/starAstrometry.data.js'
import { BODIES } from './body-data.js'
import { directionFromRaDec, skyBasis } from './stars.js'
import { RAD_PER_DEG } from './angles.js'
import { keplerStateKm, type KeplerianElements } from './kepler.js'
import type { Vec3 } from './vec3.js'
import type { HostedOrbit } from './data/records.js'
export type { HostedOrbit } from './data/records.js'

export type HostedPlanetId = keyof typeof HOSTED_ORBITS
export const HOSTED_PLANET_IDS: readonly HostedPlanetId[] = Object.keys(HOSTED_ORBITS) as HostedPlanetId[]
export const hostedOrbit = (id: HostedPlanetId): HostedOrbit => HOSTED_ORBITS[id]

const MJD_OFFSET = 2400000.5
const EPOCH_DEFINITIONS: readonly unknown[] = ['inferior-conjunction', 'superior-conjunction', 'periastron']

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
  if (orbit.epochDefinition !== undefined && !EPOCH_DEFINITIONS.includes(orbit.epochDefinition)) throw new TypeError(`Unsupported hosted-orbit epoch definition: ${String(orbit.epochDefinition)}.`)
  if (orbit.argumentOfPeriapsisDegrees !== undefined && !(Number.isFinite(orbit.argumentOfPeriapsisDegrees) && orbit.argumentOfPeriapsisDegrees >= 0 && orbit.argumentOfPeriapsisDegrees < 360)) throw new TypeError('argumentOfPeriapsisDegrees must be finite and in [0, 360) when present.')
  if (e > 0 && (orbit.argumentOfPeriapsisDegrees === undefined || orbit.epochDefinition === undefined)) {
    throw new TypeError('An eccentric hosted orbit requires argumentOfPeriapsisDegrees and an epochDefinition ("inferior-conjunction", "superior-conjunction" or "periastron").')
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
  // The epoch's true anomaly: the transit convention f = pi/2 - omega, half an orbit on from it behind the host, or f = 0 at periastron.
  const epochTrueAnomaly = orbit.epochDefinition === 'periastron' ? 0 : orbit.epochDefinition === 'superior-conjunction' ? 3 * Math.PI / 2 - periapsis : Math.PI / 2 - periapsis
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

const hostedParent = (id: HostedPlanetId): string => {
  const hostId = BODIES[id].parent
  if (hostId === null || !Object.hasOwn(STAR_ASTROMETRY, hostId)) throw new TypeError(`A hosted orbit needs a placed star as its parent: ${id}.`)
  return hostId
}

/** A compiled record's own orbit about its centre: the host itself, or for a circumbinary orbit the centre of mass of the host and
 * its `barycentreCompanion`. ICRF km and km/day; the host's catalogue direction and radius come from its own records. */
export const hostedPlanetStateAboutCentreKm = (id: HostedPlanetId, epochJdTt: number): { positionKm: Vec3; velocityKmPerDay: Vec3; hostId: string } => {
  const hostId = hostedParent(id)
  const host = STAR_ASTROMETRY[hostId as keyof typeof STAR_ASTROMETRY]
  return { ...hostedOrbitStateRelativeKm(hostedOrbit(id), host, BODIES[hostId as keyof typeof BODIES].meanRadiusKm, epochJdTt), hostId }
}

/** The companion whose mass shares the centre of a circumbinary orbit, with its weight m_companion / (m_host + m_companion). */
export const hostedBarycentreCompanion = (id: HostedPlanetId): { id: HostedPlanetId; weight: number } | null => {
  const companionId = hostedOrbit(id).barycentreCompanion
  if (companionId === undefined) return null
  if (!Object.hasOwn(HOSTED_ORBITS, companionId)) throw new TypeError(`${id}: barycentreCompanion ${companionId} has no hosted orbit.`)
  const host = BODIES[hostedParent(id) as keyof typeof BODIES], companion = BODIES[companionId as keyof typeof BODIES]
  const weight = companion.gravitationalParameterKm3PerS2 / (host.gravitationalParameterKm3PerS2 + companion.gravitationalParameterKm3PerS2)
  if (!(weight > 0 && weight < 1)) throw new TypeError(`${id}: the barycentre weight of ${companionId} must lie in (0, 1); got ${weight}.`)
  return { id: companionId as HostedPlanetId, weight }
}

/** The id of the point a hosted orbit is drawn around: its host, or `<host>-<companion>-barycentre` for a circumbinary orbit. */
export const hostedOrbitCentreId = (id: HostedPlanetId): string => {
  const companion = hostedBarycentreCompanion(id), hostId = hostedParent(id)
  return companion ? `${hostId}-${companion.id}-barycentre` : hostId
}

/** The centre a hosted orbit is fitted about, relative to the host: zero for a plain hosted orbit, the host-companion centre of
 * mass for a circumbinary one. */
export const hostedOrbitCentreStateKm = (id: HostedPlanetId, epochJdTt: number): { positionKm: Vec3; velocityKmPerDay: Vec3 } => {
  const companion = hostedBarycentreCompanion(id)
  if (!companion) return { positionKm: [0, 0, 0], velocityKmPerDay: [0, 0, 0] }
  const state = hostedPlanetStateAboutCentreKm(companion.id, epochJdTt)
  return { positionKm: state.positionKm.map(value => value * companion.weight) as unknown as Vec3,
    velocityKmPerDay: state.velocityKmPerDay.map(value => value * companion.weight) as unknown as Vec3 }
}

/** The same state for a compiled record, relative to its host's centre; a circumbinary orbit adds its centre's offset. */
export const hostedPlanetStateRelativeKm = (id: HostedPlanetId, epochJdTt: number): { positionKm: Vec3; velocityKmPerDay: Vec3; hostId: string } => {
  const own = hostedPlanetStateAboutCentreKm(id, epochJdTt), centre = hostedOrbitCentreStateKm(id, epochJdTt)
  return { positionKm: own.positionKm.map((value, axis) => value + centre.positionKm[axis]!) as unknown as Vec3,
    velocityKmPerDay: own.velocityKmPerDay.map((value, axis) => value + centre.velocityKmPerDay[axis]!) as unknown as Vec3, hostId: own.hostId }
}
