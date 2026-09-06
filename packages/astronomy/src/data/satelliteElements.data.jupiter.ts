// GENERATED FILE — do not edit by hand.
//
// Source:    JPL Horizons osculating elements, ICRF frame, sampled at the body-specific fit ranges and cadences recorded below, reduced to mean elements in each moon's own Laplace plane
// Generator: packages/astronomy/tools/generate-satellites.mjs
//
// Regenerate with `node tools/generate-satellites.mjs` from packages/astronomy. The
// generator re-downloads the source series, re-derives the truncation, and
// prints the error budget it certifies; the numbers in README.md come from it.

import type { SatelliteRecord } from './satelliteElements.data.js'

export const SATELLITE_ELEMENTS_JUPITER = {
  io: {
    parent: 'jupiter',
    horizonsCode: '501',
    fitFromJdTdb: 2415020.5,
    fitToJdTdb: 2488069.5,
    fitStepDays: 30,
    poleRightAscensionRad: -1.604667787948,
    poleDeclinationRad: 1.125694645695,
    elements: {
      epochJdTt: 2451545,
      semiMajorAxisKm: 422029.892,
      eccentricity: 0.004152226926,
      inclinationRad: 0.000626969703,
      ascendingNodeRad: -1.737256688494,
      argumentOfPeriapsisRad: 2.592709743215,
      meanAnomalyAtEpochRad: 129722.13649535262,
      meanMotionRadPerDay: 3.564459181402647,
      ascendingNodeRateRadPerDay: -0.002317907122702596,
      argumentOfPeriapsisRateRadPerDay: -0.010588960287302888,
    },
  },
  europa: {
    parent: 'jupiter',
    horizonsCode: '502',
    fitFromJdTdb: 2415020.5,
    fitToJdTdb: 2488069.5,
    fitStepDays: 30,
    poleRightAscensionRad: -1.60461136609,
    poleDeclinationRad: 1.126259773868,
    elements: {
      epochJdTt: 2451545,
      semiMajorAxisKm: 671261.137,
      eccentricity: 0.00935808505,
      inclinationRad: 0.008106300732,
      ascendingNodeRad: -3.068935495327,
      argumentOfPeriapsisRad: 0.78369773702,
      meanAnomalyAtEpochRad: 64628.589872673125,
      meanMotionRadPerDay: 1.782229597364694,
      ascendingNodeRateRadPerDay: -0.000569769444393349,
      argumentOfPeriapsisRateRadPerDay: -0.012337110697745693,
    },
  },
  ganymede: {
    parent: 'jupiter',
    horizonsCode: '503',
    fitFromJdTdb: 2415020.5,
    fitToJdTdb: 2488069.5,
    fitStepDays: 30,
    poleRightAscensionRad: -1.604496933455,
    poleDeclinationRad: 1.126923600918,
    elements: {
      epochJdTt: 2451545,
      semiMajorAxisKm: 1070621,
      eccentricity: 0.001430313015,
      inclinationRad: 0.003074053522,
      ascendingNodeRad: 1.032376593886,
      argumentOfPeriapsisRad: -2.938714969678,
      meanAnomalyAtEpochRad: 32081.438036807114,
      meanMotionRadPerDay: 0.878078414341597,
      ascendingNodeRateRadPerDay: -0.00012757854675751,
      argumentOfPeriapsisRateRadPerDay: 0.000257083022476756,
    },
  },
  callisto: {
    parent: 'jupiter',
    horizonsCode: '504',
    fitFromJdTdb: 2415020.5,
    fitToJdTdb: 2488069.5,
    fitStepDays: 30,
    poleRightAscensionRad: -1.59902251982,
    poleDeclinationRad: 1.129086807164,
    elements: {
      epochJdTt: 2451545,
      semiMajorAxisKm: 1883133.712,
      eccentricity: 0.00735479474,
      inclinationRad: 0.002401267906,
      ascendingNodeRad: -0.962304492975,
      argumentOfPeriapsisRad: 0.841392419758,
      meanAnomalyAtEpochRad: 13755.421577207697,
      meanMotionRadPerDay: 0.376454026193807,
      ascendingNodeRateRadPerDay: -0.000065333292608316,
      argumentOfPeriapsisRateRadPerDay: 0.000097548472289442,
    },
  },
} as const satisfies Record<string, SatelliteRecord>
