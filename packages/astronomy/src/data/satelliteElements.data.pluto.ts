// GENERATED FILE — do not edit by hand.
//
// Source:    JPL Horizons osculating elements, ICRF frame, sampled at the body-specific fit ranges and cadences recorded below, reduced to mean elements in each moon's own Laplace plane
// Generator: packages/astronomy/tools/generate-satellites.mjs
//
// Regenerate with `node tools/generate-satellites.mjs` from packages/astronomy. The
// generator re-downloads the source series, re-derives the truncation, and
// prints the error budget it certifies; the numbers in README.md come from it.

import type { SatelliteRecord } from './satelliteElements.data.js'

export const SATELLITE_ELEMENTS_PLUTO = {
  charon: {
    parent: 'pluto',
    horizonsCode: '901',
    fitFromJdTdb: 2415020.5,
    fitToJdTdb: 2488069.5,
    fitStepDays: 30,
    poleRightAscensionRad: 2.321416274488,
    poleDeclinationRad: -0.108991190224,
    elements: {
      epochJdTt: 2451545,
      semiMajorAxisKm: 19595.763,
      eccentricity: 0.000160874376,
      inclinationRad: 0.000040087778,
      ascendingNodeRad: -0.002466557778,
      argumentOfPeriapsisRad: 2.713762719916,
      meanAnomalyAtEpochRad: 35923.5670913476,
      meanMotionRadPerDay: 0.983711685883009,
      ascendingNodeRateRadPerDay: 0.000058771469110018,
      argumentOfPeriapsisRateRadPerDay: -0.000058727414898345,
    },
  },
} as const satisfies Record<string, SatelliteRecord>
