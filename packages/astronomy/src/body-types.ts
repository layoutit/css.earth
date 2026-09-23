import { BODY_IDS, PLANET_IDS, DWARF_PLANET_IDS, ASTEROID_IDS, TRANS_NEPTUNIAN_IDS, INTERSTELLAR_IDS, COMET_IDS, EXOPLANET_IDS, BLACK_HOLE_IDS } from './data/generated/bodies.js'
export { PLANET_IDS, DWARF_PLANET_IDS, ASTEROID_IDS, TRANS_NEPTUNIAN_IDS, INTERSTELLAR_IDS, COMET_IDS, EXOPLANET_IDS, BLACK_HOLE_IDS }
export interface BodyData {
  readonly id: BodyId
  readonly name: string
  /** Null when no Horizons target exists; source-owned states retain their publication identity. */
  readonly horizonsCode: string | null
  /** Zero only for a star known from its hosted orbit alone, whose radius no source measures (most S-stars). */
  readonly meanRadiusKm: number
  /** GM, km^3/s^2. Zero only where Horizons publishes no GM. */
  readonly gravitationalParameterKm3PerS2: number
  /** Gravitational parent — the body this one orbits. `null` for the Sun. */
  readonly parent: BodyId | null
  /** A star's measured effective temperature, K, where a star without a package has one (the S-stars Habibi et al. 2017 fit). */
  readonly effectiveTemperatureK?: number
}
export type PlanetId = typeof PLANET_IDS[number]
export type DwarfPlanetId = typeof DWARF_PLANET_IDS[number]
export type AsteroidId = typeof ASTEROID_IDS[number]
export type TransNeptunianId = typeof TRANS_NEPTUNIAN_IDS[number]
export type InterstellarId = typeof INTERSTELLAR_IDS[number]
export type CometId = typeof COMET_IDS[number]
export type ExoplanetId = typeof EXOPLANET_IDS[number]
export type SmallBodyId = AsteroidId | TransNeptunianId | InterstellarId
export type BodyId = typeof BODY_IDS[number]
export const SMALL_BODY_IDS: readonly SmallBodyId[] = [...ASTEROID_IDS, ...TRANS_NEPTUNIAN_IDS, ...INTERSTELLAR_IDS]
