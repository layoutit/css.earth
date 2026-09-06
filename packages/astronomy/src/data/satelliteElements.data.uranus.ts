// GENERATED FILE — do not edit by hand.
//
// Source:    JPL Horizons osculating elements, ICRF frame, sampled at the body-specific fit ranges and cadences recorded below, reduced to mean elements in each moon's own Laplace plane
// Generator: packages/astronomy/tools/generate-satellites.mjs
//
// Regenerate with `node tools/generate-satellites.mjs` from packages/astronomy. The
// generator re-downloads the source series, re-derives the truncation, and
// prints the error budget it certifies; the numbers in README.md come from it.

import type { SatelliteRecord } from './satelliteElements.data.js'

export const SATELLITE_ELEMENTS_URANUS = {
  miranda: {
    parent: 'uranus',
    horizonsCode: '705',
    fitFromJdTdb: 2415020.5,
    fitToJdTdb: 2488069.5,
    fitStepDays: 30,
    poleRightAscensionRad: 1.347803801721,
    poleDeclinationRad: 0.26446554695,
    elements: {
      epochJdTt: 2451545,
      semiMajorAxisKm: 129873.507,
      eccentricity: 0.00136019724,
      inclinationRad: 0.077242781272,
      ascendingNodeRad: 1.760701075703,
      argumentOfPeriapsisRad: -3.582086533582,
      meanAnomalyAtEpochRad: 162365.0654847093,
      meanMotionRadPerDay: 4.44423335394157,
      ascendingNodeRateRadPerDay: -0.00096711094469689,
      argumentOfPeriapsisRateRadPerDay: 0.001924353203779812,
    },
  },
  ariel: {
    parent: 'uranus',
    horizonsCode: '701',
    fitFromJdTdb: 2415020.5,
    fitToJdTdb: 2488069.5,
    fitStepDays: 30,
    poleRightAscensionRad: 1.349399044248,
    poleDeclinationRad: 0.264585667823,
    elements: {
      epochJdTt: 2451545,
      semiMajorAxisKm: 190945.918,
      eccentricity: 0.001248512894,
      inclinationRad: 0.000362753833,
      ascendingNodeRad: -2.946831684234,
      argumentOfPeriapsisRad: 4.4418169781,
      meanAnomalyAtEpochRad: 91057.96982771791,
      meanMotionRadPerDay: 2.492655142605988,
      ascendingNodeRateRadPerDay: -0.000132075578509618,
      argumentOfPeriapsisRateRadPerDay: 0.000429356372661364,
    },
  },
  umbriel: {
    parent: 'uranus',
    horizonsCode: '702',
    fitFromJdTdb: 2415020.5,
    fitToJdTdb: 2488069.5,
    fitStepDays: 30,
    poleRightAscensionRad: 1.349575345339,
    poleDeclinationRad: 0.264032000337,
    elements: {
      epochJdTt: 2451545,
      semiMajorAxisKm: 265998.781,
      eccentricity: 0.003941724992,
      inclinationRad: 0.001422310432,
      ascendingNodeRad: -2.96034011418,
      argumentOfPeriapsisRad: 2.839439845093,
      meanAnomalyAtEpochRad: 55378.217965475764,
      meanMotionRadPerDay: 1.516012337922619,
      ascendingNodeRateRadPerDay: -0.000128058275534743,
      argumentOfPeriapsisRateRadPerDay: 0.000263588565914256,
    },
  },
  titania: {
    parent: 'uranus',
    horizonsCode: '703',
    fitFromJdTdb: 2415020.5,
    fitToJdTdb: 2488069.5,
    fitStepDays: 30,
    poleRightAscensionRad: 1.350286637637,
    poleDeclinationRad: 0.26307653798,
    elements: {
      epochJdTt: 2451545,
      semiMajorAxisKm: 436297.956,
      eccentricity: 0.001155253314,
      inclinationRad: 0.001144860942,
      ascendingNodeRad: -1.61228881062,
      argumentOfPeriapsisRad: -0.696152612791,
      meanAnomalyAtEpochRad: 26371.467964713745,
      meanMotionRadPerDay: 0.721669712520299,
      ascendingNodeRateRadPerDay: -0.000094604129755784,
      argumentOfPeriapsisRateRadPerDay: 0.000143231709953439,
    },
  },
  oberon: {
    parent: 'uranus',
    horizonsCode: '704',
    fitFromJdTdb: 2415020.5,
    fitToJdTdb: 2488069.5,
    fitStepDays: 30,
    poleRightAscensionRad: 1.350399141556,
    poleDeclinationRad: 0.262677687397,
    elements: {
      epochJdTt: 2451545,
      semiMajorAxisKm: 583517.062,
      eccentricity: 0.00133718838,
      inclinationRad: 0.001255324044,
      ascendingNodeRad: 1.151968042773,
      argumentOfPeriapsisRad: -3.742760467056,
      meanAnomalyAtEpochRad: 17048.742438985868,
      meanMotionRadPerDay: 0.466678594138228,
      ascendingNodeRateRadPerDay: -0.000078190075658011,
      argumentOfPeriapsisRateRadPerDay: 0.000091602042967503,
    },
  },
} as const satisfies Record<string, SatelliteRecord>
