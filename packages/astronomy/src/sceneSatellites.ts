import { SCENE_SATELLITE_STATES } from './data/sceneSatelliteStates.data.js'
import type { Vec3 } from './vec3.js'

/** Source-derived states available only at the prepared scene instant. */
export interface SceneSatelliteRecord {
  readonly systemGmKm3PerS2?: number
  readonly epochJdTt: number
  readonly centerBodyId: string
  readonly positionKm: Vec3
  readonly velocityKmPerDay: Vec3
  readonly gravitationalParametersKm3PerS2: { readonly combined: number; readonly body?: number; readonly parent?: number }
  readonly parentHeliocentricState?: { readonly positionKm: Vec3; readonly velocityKmPerDay: Vec3; readonly provenance?: unknown }
  readonly provenance: { readonly model: string; readonly source?: string; readonly sourcePath?: string; readonly limitations?: readonly string[]; readonly [key: string]: unknown }
}
export type SceneSatelliteId = keyof typeof SCENE_SATELLITE_STATES
export const SCENE_SATELLITE_IDS = Object.keys(SCENE_SATELLITE_STATES) as readonly SceneSatelliteId[]
export const isSceneSatellite = (id: string): id is SceneSatelliteId => Object.hasOwn(SCENE_SATELLITE_STATES, id)
export function sceneSatelliteStateKm(id: SceneSatelliteId, epochJdTt: number): SceneSatelliteRecord {
  const record = SCENE_SATELLITE_STATES[id]
  if (!record || epochJdTt !== record.epochJdTt) throw new RangeError(`${id}: source state is valid only at its prepared scene epoch`)
  return record
}
