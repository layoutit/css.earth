import { ASTEROID_ELEMENTS } from './data/asteroidElements.data.js'
import { keplerPositionKm, type KeplerianElements } from './kepler.js'
import type { AsteroidId } from './bodies.js'
import type { Vec3 } from './vec3.js'

/** Single-epoch heliocentric elements; no long-term perturbation model is claimed. */
export const asteroidElements = (id: AsteroidId): KeplerianElements => ASTEROID_ELEMENTS[id].elements
export const asteroidPositionKm = (id: AsteroidId, epochJdTt: number): Vec3 =>
  keplerPositionKm(asteroidElements(id), epochJdTt)
