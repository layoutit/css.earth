import { ASTEROID_ELEMENTS } from './data/asteroidElements.data.js'
import { keplerPositionKm, type KeplerianElements } from './kepler.js'
import type { SmallBodyId } from './bodies.js'
import type { Vec3 } from './vec3.js'

/** Asteroid and trans-Neptunian minor bodies share the same element transport.
 * Single-epoch heliocentric elements; no long-term perturbation model is claimed. */
export const asteroidElements = (id: SmallBodyId): KeplerianElements => ASTEROID_ELEMENTS[id].elements
export const asteroidPositionKm = (id: SmallBodyId, epochJdTt: number): Vec3 =>
  keplerPositionKm(asteroidElements(id), epochJdTt)
