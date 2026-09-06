import { SATELLITE_ELEMENTS, type SatelliteId, type SatelliteRecord } from './data/satelliteElements.data.js'
import { keplerApoapsisKm, keplerStateKm, type KeplerianElements } from './kepler.js'
import type { Vec3 } from './vec3.js'

export { SATELLITE_ELEMENTS }
export type { SatelliteId, SatelliteRecord }

export const SATELLITE_IDS = Object.keys(SATELLITE_ELEMENTS) as readonly SatelliteId[]

export const satelliteRecord = (id: SatelliteId): SatelliteRecord => {
  const record = SATELLITE_ELEMENTS[id]
  if (!record) throw new Error(`unknown satellite: ${id}`)
  return record
}

/**
 * Columns of the rotation from a moon's Laplace plane into ICRF: the plane's
 * ascending node on the ICRF equator, the completing axis, and the pole.
 *
 * The x-axis choice is this package's, not a published convention, and it
 * matches `planeBasis` in `tools/generate-satellites.mjs` exactly — the
 * elements and this rotation are two halves of one definition and are
 * meaningless apart. `satellites.test.ts` pins the pair by asserting a moon's
 * position against Horizons, which is the only thing that can catch them
 * drifting.
 */
export const satelliteLaplaceBasis = (
  record: SatelliteRecord,
): { readonly nodeAxis: Vec3; readonly completingAxis: Vec3; readonly poleAxis: Vec3 } => {
  const rightAscension = record.poleRightAscensionRad
  const declination = record.poleDeclinationRad
  const cosDeclination = Math.cos(declination)
  const poleAxis: Vec3 = [
    cosDeclination * Math.cos(rightAscension),
    cosDeclination * Math.sin(rightAscension),
    Math.sin(declination),
  ]
  // z x pole, normalised: (-pole_y, pole_x, 0) / |...|
  const norm = Math.hypot(poleAxis[0], poleAxis[1])
  if (norm < 1e-6) throw new Error('Laplace pole is parallel to the ICRF pole; the node convention degenerates')
  const nodeAxis: Vec3 = [-poleAxis[1] / norm, poleAxis[0] / norm, 0]
  const completingAxis: Vec3 = [
    poleAxis[1] * nodeAxis[2] - poleAxis[2] * nodeAxis[1],
    poleAxis[2] * nodeAxis[0] - poleAxis[0] * nodeAxis[2],
    poleAxis[0] * nodeAxis[1] - poleAxis[1] * nodeAxis[0],
  ]
  return { nodeAxis, completingAxis, poleAxis }
}

const toIcrf = (record: SatelliteRecord, v: Vec3): Vec3 => {
  const { nodeAxis, completingAxis, poleAxis } = satelliteLaplaceBasis(record)
  return [
    nodeAxis[0] * v[0] + completingAxis[0] * v[1] + poleAxis[0] * v[2],
    nodeAxis[1] * v[0] + completingAxis[1] * v[1] + poleAxis[1] * v[2],
    nodeAxis[2] * v[0] + completingAxis[2] * v[1] + poleAxis[2] * v[2],
  ]
}

/** Position of a moon relative to its planet's centre, in km, on ICRF axes. */
export const satellitePositionKm = (id: SatelliteId, epochJdTt: number): Vec3 => {
  const record = satelliteRecord(id)
  return toIcrf(record, keplerStateKm(record.elements as KeplerianElements, epochJdTt).positionKm)
}

/** Position and velocity of a moon relative to its planet's centre, km and km/day, on ICRF axes. */
export const satelliteStateKm = (
  id: SatelliteId,
  epochJdTt: number,
): { readonly positionKm: Vec3; readonly velocityKmPerDay: Vec3 } => {
  const record = satelliteRecord(id)
  const state = keplerStateKm(record.elements as KeplerianElements, epochJdTt)
  return { positionKm: toIcrf(record, state.positionKm), velocityKmPerDay: toIcrf(record, state.velocityKmPerDay) }
}

/** `a(1 + e)` for a moon — the exact bound its frame's `maxOffsetInParent` needs. */
export const satelliteApoapsisKm = (id: SatelliteId): number =>
  keplerApoapsisKm(satelliteRecord(id).elements as KeplerianElements)
