import { SATELLITE_ELEMENTS_SATURN } from './satelliteElements.data.saturn.js'
import { SATELLITE_ELEMENTS_MARS } from './satelliteElements.data.mars.js'
import { SATELLITE_ELEMENTS_JUPITER } from './satelliteElements.data.jupiter.js'
import { SATELLITE_ELEMENTS_URANUS } from './satelliteElements.data.uranus.js'
import { SATELLITE_ELEMENTS_NEPTUNE } from './satelliteElements.data.neptune.js'
import { SATELLITE_ELEMENTS_PLUTO } from './satelliteElements.data.pluto.js'
import { SATELLITE_ELEMENTS_DIDYMOS } from './satelliteElements.data.didymos.js'

// GENERATED FILE — do not edit by hand.
//
// Source:    JPL Horizons osculating elements, ICRF frame, sampled at the body-specific fit ranges and cadences recorded below, reduced to mean elements in each moon's own Laplace plane
// Generator: packages/astronomy/tools/generate-satellites.mjs
//
// Regenerate with `node tools/generate-satellites.mjs` from packages/astronomy. The
// generator re-downloads the source series, re-derives the truncation, and
// prints the error budget it certifies; the numbers in README.md come from it.

import type { KeplerianElements } from '../kepler.js'

export interface SatelliteRecord {
  /** Prepared slow libration in mean longitude; fitted inside the stated interval. */
  readonly longitudeHarmonics?: readonly { readonly rateRadPerDay: number; readonly cosineRad: number; readonly sineRad: number; readonly epochJdTt: number }[]
  /** Body id of the planet this moon orbits. */
  readonly parent: string
  /** Horizons target code, so a fixture can be re-fetched without guessing. */
  readonly horizonsCode: string
  /** Companion defining a binary barycentre; output remains parent-centred. */
  readonly barycentreCompanion?: string
  /** First and last JPL Horizons epochs sampled by the element fit. */
  readonly fitFromJdTdb: number
  readonly fitToJdTdb: number
  readonly fitStepDays: number
  /**
   * Pole of this moon's own mean orbit plane (its local Laplace plane), in
   * ICRF. `elements` are referred to the plane with this pole, x-axis along
   * that plane's ascending node on the ICRF equator — the basis
   * `satelliteLaplaceBasis` rebuilds.
   */
  readonly poleRightAscensionRad: number
  readonly poleDeclinationRad: number
  /** Referred to this moon's Laplace plane, epoch J2000 TT. */
  readonly elements: KeplerianElements
}

/**
 * Mean elements for the selected moons, derived from Horizons as described in
 * `tools/generate-satellites.mjs`. These are a FIT, not a satellite theory:
 * see that file and README.md for the residual each one leaves.
 */
export const SATELLITE_ELEMENTS = {
  ...SATELLITE_ELEMENTS_SATURN,
  ...SATELLITE_ELEMENTS_MARS,
  ...SATELLITE_ELEMENTS_JUPITER,
  ...SATELLITE_ELEMENTS_URANUS,
  ...SATELLITE_ELEMENTS_NEPTUNE,
  ...SATELLITE_ELEMENTS_PLUTO,
  ...SATELLITE_ELEMENTS_DIDYMOS,
} as const satisfies Record<string, SatelliteRecord>

export type SatelliteId = keyof typeof SATELLITE_ELEMENTS
