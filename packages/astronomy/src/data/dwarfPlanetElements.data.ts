// GENERATED FILE — do not edit by hand.
//
// Source:    JPL Horizons osculating elements, heliocentric, ICRF equatorial (REF_PLANE=FRAME, REF_SYSTEM=ICRF), epoch 2461041.5 = 2026-Jan-01 TDB. Each entry's `query` reproduces it.
// Generator: packages/astronomy/tools/generate-dwarf-planets.mjs
//
// Regenerate with `node tools/generate-dwarf-planets.mjs` from packages/astronomy. The
// generator re-downloads the source series, re-derives the truncation, and
// prints the error budget it certifies; the numbers in README.md come from it.

import type { KeplerianElements } from '../kepler.js'

export interface DwarfPlanetRecord {
  /** The exact Horizons request that produced `elements`. `curl` it to reproduce the row. */
  readonly query: string
  /** Referred to ICRF equatorial axes, heliocentric, single osculating epoch — see the file header. */
  readonly elements: KeplerianElements
}

import { DWARF_PLANET_ELEMENTS } from './generated/dwarfPlanet.js'
export { DWARF_PLANET_ELEMENTS } from './generated/dwarfPlanet.js'

export type DwarfPlanetId = keyof typeof DWARF_PLANET_ELEMENTS & string
