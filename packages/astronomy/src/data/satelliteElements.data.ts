
// GENERATED FILE — do not edit by hand.
//
// Source:    JPL Horizons osculating elements, ICRF frame, sampled at the body-specific fit ranges and cadences recorded below, reduced to mean elements in each moon's own Laplace plane
// Generator: packages/astronomy/cli/generate-satellites.mts
//
// Regenerate with `node cli/generate-satellites.mts` from packages/astronomy. The
// generator re-downloads the source series, re-derives the truncation, and
// prints the error budget it certifies; the numbers in README.md come from it.

export type { SatelliteRecord } from './records.js'

/**
 * Mean elements for the selected moons, derived from Horizons as described in
 * `packages/astronomy/cli/generate-satellites.mts`. These are a FIT, not a satellite theory:
 * see that file and README.md for the residual each one leaves.
 */
import { SATELLITE_ELEMENTS } from './generated/satellite.js'
export { SATELLITE_ELEMENTS } from './generated/satellite.js'

export type SatelliteId = keyof typeof SATELLITE_ELEMENTS
