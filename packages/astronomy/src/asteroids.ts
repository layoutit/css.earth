import { ASTEROID_ELEMENTS } from './data/asteroidElements.data.js'
import { keplerPositionKm, type KeplerianElements } from './kepler.js'
import type { SmallBodyId } from './bodies.js'
import { TRANS_NEPTUNIAN_IDS } from './body-types.js'
import { M_PER_AU, M_PER_KM } from './units.js'
import type { Vec3 } from './vec3.js'

/** Asteroid and trans-Neptunian minor bodies share the same element transport.
 * Single-epoch heliocentric elements; no long-term perturbation model is claimed. */
export const asteroidElements = (id: SmallBodyId): KeplerianElements => ASTEROID_ELEMENTS[id].elements
export const asteroidPositionKm = (id: SmallBodyId, epochJdTt: number): Vec3 =>
  keplerPositionKm(asteroidElements(id), epochJdTt)

/** An extreme trans-Neptunian object: semimajor axis over 150 au and perihelion beyond 30 au, the definition de la Fuente Marcos &
 * de la Fuente Marcos (2018, RNAAS 2, 167, https://arxiv.org/abs/1809.02571) state, applied to its Horizons elements. */
export const isExtremeTransNeptunian = (id: string): boolean => {
  if (!(TRANS_NEPTUNIAN_IDS as readonly string[]).includes(id)) return false
  const { semiMajorAxisKm, eccentricity } = asteroidElements(id as SmallBodyId)
  const semiMajorAxisAu = semiMajorAxisKm * M_PER_KM / M_PER_AU
  return semiMajorAxisAu > 150 && semiMajorAxisAu * (1 - eccentricity) > 30
}
