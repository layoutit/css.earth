// GENERATED FILE — do not edit by hand.
//
// Source:    JPL Horizons osculating elements, ICRF frame, sampled at the body-specific fit ranges and cadences recorded below, reduced to mean elements in each moon's own Laplace plane
// Generator: packages/astronomy/tools/generate-satellites.mjs
//
// Regenerate with `node tools/generate-satellites.mjs` from packages/astronomy. The
// generator re-downloads the source series, re-derives the truncation, and
// prints the error budget it certifies; the numbers in README.md come from it.

import type { SatelliteRecord } from './satelliteElements.data.js'

export const SATELLITE_ELEMENTS_MARS = {
  phobos: {
    parent: 'mars',
    horizonsCode: '401',
    fitFromJdTdb: 2415020.5,
    fitToJdTdb: 2488069.5,
    fitStepDays: 30,
    poleRightAscensionRad: -0.73877494192,
    poleDeclinationRad: 0.92322265695,
    elements: {
      epochJdTt: 2451545,
      semiMajorAxisKm: 9378.543,
      eccentricity: 0.015116081915,
      inclinationRad: 0.018762600204,
      ascendingNodeRad: 2.952462905821,
      argumentOfPeriapsisRad: -2.505220131269,
      meanAnomalyAtEpochRad: 719610.3118473366,
      meanMotionRadPerDay: 19.694462346366564,
      ascendingNodeRateRadPerDay: -0.0076059555006532,
      argumentOfPeriapsisRateRadPerDay: 0.015201343571906438,
    },
  },
  deimos: {
    parent: 'mars',
    horizonsCode: '402',
    fitFromJdTdb: 2415020.5,
    fitToJdTdb: 2488069.5,
    fitStepDays: 30,
    poleRightAscensionRad: -0.759707587014,
    poleDeclinationRad: 0.9356158137,
    elements: {
      epochJdTt: 2451545,
      semiMajorAxisKm: 23458.951,
      eccentricity: 0.000265104896,
      inclinationRad: 0.031100262609,
      ascendingNodeRad: 0.952974652061,
      argumentOfPeriapsisRad: -2.879962218891,
      meanAnomalyAtEpochRad: 181785.29124555681,
      meanMotionRadPerDay: 4.976700842543846,
      ascendingNodeRateRadPerDay: -0.000315572163224008,
      argumentOfPeriapsisRateRadPerDay: 0.000628542221087917,
    },
  },
} as const satisfies Record<string, SatelliteRecord>
