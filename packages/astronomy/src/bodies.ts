import { PLANET_IDS } from './body-types.js'
import type { BodyId, BodyData, PlanetId } from './body-types.js'
export { PLANET_IDS, DWARF_PLANET_IDS, ASTEROID_IDS, TRANS_NEPTUNIAN_IDS, SMALL_BODY_IDS, COMET_IDS, INTERSTELLAR_IDS, EXOPLANET_IDS, BLACK_HOLE_IDS } from './body-types.js'
export type { BodyData, PlanetId, DwarfPlanetId, AsteroidId, TransNeptunianId, SmallBodyId, BodyId, CometId, InterstellarId, ExoplanetId } from './body-types.js'
import { BODIES } from './body-data.js'
export { BODIES } from './body-data.js'
import { BODY_IDS } from './data/generated/bodies.js'
export { BODY_IDS }

export const bodyData = (id: BodyId): BodyData => {
  const data = BODIES[id]
  if (!data) throw new Error(`unknown body: ${id}`)
  return data
}

/**
 * Ids of the moons this package places around each planet, in declaration
 * order. Precomputed rather than filtered on demand: `solarSystem.ts` asks for
 * it once per planet per simulation tick, and a `filter` there would allocate
 * eight arrays a frame to answer a question about static data.
 */
const MOONS_OF = new Map<BodyId, readonly BodyId[]>(
  BODY_IDS.map(parent => [parent, BODY_IDS.filter(id => BODIES[id].parent === parent && parent !== 'sun')]),
)

export const moonsOf = (parent: BodyId): readonly BodyId[] => MOONS_OF.get(parent)!

/**
 * GM of a planet plus every moon this package carries for it — the mass that
 * VSOP87's "planet" actually is, since VSOP87 integrates each planetary system
 * as one body.
 *
 * It is not the true system GM: the moons left out (Jupiter's 90-odd outer
 * irregulars, and most of Saturn's small moons) are together under 1e-7 of any
 * system, which moves the Sun's barycentric offset by well under a kilometre.
 */
const SYSTEM_GM: Record<PlanetId, number> = Object.fromEntries(
  PLANET_IDS.map((planet) => [
    planet,
    moonsOf(planet).reduce(
      (sum, id) => sum + bodyData(id).gravitationalParameterKm3PerS2,
      bodyData(planet).gravitationalParameterKm3PerS2,
    ),
  ]),
) as Record<PlanetId, number>

export const systemGravitationalParameterKm3PerS2 = (planet: PlanetId): number => SYSTEM_GM[planet]
