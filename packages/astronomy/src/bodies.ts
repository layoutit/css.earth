/**
 * Physical data for the bodies this package places.
 *
 * Values come from JPL Solar System Dynamics. Most are transcribed from
 * Horizons' `OBJ_DATA` block, fetched with
 * `format=text&COMMAND='<code>'&OBJ_DATA='YES'&MAKE_EPHEM='NO'`. The added
 * Saturn moons use JPL's current satellite physical-parameters table
 * (`https://ssd.jpl.nasa.gov/sats/phys_par/`), which publishes the selected
 * ephemeris GM and IAU WGCCRE mean radius together. They are transcribed rather
 * than parsed because the physical-data blocks are free text whose layout
 * differs per body — a parser for them would be a second thing to get wrong.
 *
 * `meanRadiusKm` is the volumetric mean radius where Horizons gives one, and
 * the geometric mean of the triaxial radii where it gives only those (Phobos,
 * Deimos, Miranda, Ariel). It is NOT the equatorial radius: it is used for the
 * frame-capture rule, where the right question is "how big is this body", not
 * "how wide is it at the equator". A renderer that needs the ellipsoid needs
 * three numbers and should not get them from here.
 */
export interface BodyData {
  readonly id: BodyId
  readonly name: string
  /** Null when no Horizons target exists; source-owned states retain their publication identity. */
  readonly horizonsCode: string | null
  readonly meanRadiusKm: number
  /** GM, km^3/s^2. Zero only where Horizons publishes no GM. */
  readonly gravitationalParameterKm3PerS2: number
  /** Gravitational parent — the body this one orbits. `null` for the Sun. */
  readonly parent: BodyId | null
}
import { BODY_IDS, BODIES, PLANET_IDS, DWARF_PLANET_IDS, ASTEROID_IDS, TRANS_NEPTUNIAN_IDS, INTERSTELLAR_IDS, COMET_IDS } from './data/generated/bodies.js'
export { BODY_IDS, BODIES, PLANET_IDS, DWARF_PLANET_IDS, ASTEROID_IDS, TRANS_NEPTUNIAN_IDS, INTERSTELLAR_IDS, COMET_IDS }
export type PlanetId = typeof PLANET_IDS[number]
export type DwarfPlanetId = typeof DWARF_PLANET_IDS[number]
export type AsteroidId = typeof ASTEROID_IDS[number]
export type TransNeptunianId = typeof TRANS_NEPTUNIAN_IDS[number]
export type InterstellarId = typeof INTERSTELLAR_IDS[number]
export type CometId = typeof COMET_IDS[number]
export type SmallBodyId = AsteroidId | TransNeptunianId | InterstellarId
export type BodyId = typeof BODY_IDS[number]
export const SMALL_BODY_IDS: readonly SmallBodyId[] = [...ASTEROID_IDS, ...TRANS_NEPTUNIAN_IDS, ...INTERSTELLAR_IDS]


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
