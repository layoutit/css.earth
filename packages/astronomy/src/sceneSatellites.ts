import { SCENE_SATELLITE_STATES } from './data/sceneSatelliteStates.data.js'
import type { SceneSatelliteRecord } from './data/records.js'
export type { SceneSatelliteRecord } from './data/records.js'

export type SceneSatelliteId = keyof typeof SCENE_SATELLITE_STATES
export const SCENE_SATELLITE_IDS = Object.keys(SCENE_SATELLITE_STATES) as readonly SceneSatelliteId[]
export const isSceneSatellite = (id: string): id is SceneSatelliteId => Object.hasOwn(SCENE_SATELLITE_STATES, id)
export function sceneSatelliteStateKm(id: SceneSatelliteId, epochJdTt: number): SceneSatelliteRecord {
  const record = SCENE_SATELLITE_STATES[id]
  if (!record || epochJdTt !== record.epochJdTt) throw new RangeError(`${id}: source state is valid only at its prepared scene epoch`)
  return record
}
