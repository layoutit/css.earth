// GENERATED FILE — do not edit by hand.
//
// Source:    JPL Horizons osculating elements, ICRF frame, sampled at the body-specific fit ranges and cadences recorded below, reduced to mean elements in each moon's own Laplace plane
// Generator: packages/astronomy/tools/generate-satellites.mjs
//
// Regenerate with `node tools/generate-satellites.mjs` from packages/astronomy. The
// generator re-downloads the source series, re-derives the truncation, and
// prints the error budget it certifies; the numbers in README.md come from it.

import type { SatelliteRecord } from './satelliteElements.data.js'

export const SATELLITE_ELEMENTS_DIDYMOS = {
  dimorphos: {
    parent: 'didymos',
    horizonsCode: '120065803',
    fitFromJdTdb: 2461256.5,
    fitToJdTdb: 2461316.5,
    fitStepDays: 1,
    poleRightAscensionRad: 1.216499624325,
    poleDeclinationRad: -1.268771869881,
    elements: {
      epochJdTt: 2451545,
      semiMajorAxisKm: 1.153,
      eccentricity: 0.006173817844,
      inclinationRad: 0,
      ascendingNodeRad: 0,
      argumentOfPeriapsisRad: -1.435881882365,
      meanAnomalyAtEpochRad: -128823.59287751079,
      meanMotionRadPerDay: 13.299921505540581,
      ascendingNodeRateRadPerDay: -0.02382006122008506,
      argumentOfPeriapsisRateRadPerDay: -0.010627794970585431,
    },
  },
} as const satisfies Record<string, SatelliteRecord>
