// GENERATED FILE — do not edit by hand.
//
// Source:    JPL Horizons osculating elements, ICRF frame, sampled at the body-specific fit ranges and cadences recorded below, reduced to mean elements in each moon's own Laplace plane
// Generator: packages/astronomy/tools/generate-satellites.mjs
//
// Regenerate with `node tools/generate-satellites.mjs` from packages/astronomy. The
// generator re-downloads the source series, re-derives the truncation, and
// prints the error budget it certifies; the numbers in README.md come from it.

import type { SatelliteRecord } from './satelliteElements.data.js'

export const SATELLITE_ELEMENTS_NEPTUNE = {
  triton: {
    parent: 'neptune',
    horizonsCode: '801',
    fitFromJdTdb: 2415020.5,
    fitToJdTdb: 2488069.5,
    fitStepDays: 30,
    poleRightAscensionRad: 2.069115629886,
    poleDeclinationRad: -0.403836066472,
    elements: {
      epochJdTt: 2451545,
      semiMajorAxisKm: 354766.37,
      eccentricity: 0.00012649457,
      inclinationRad: 0.169055545896,
      ascendingNodeRad: -3.110982092429,
      argumentOfPeriapsisRad: 4.48647391263,
      meanAnomalyAtEpochRad: 39049.6732648243,
      meanMotionRadPerDay: 1.069121416414284,
      ascendingNodeRateRadPerDay: -0.000061857841289449,
      argumentOfPeriapsisRateRadPerDay: 0.000082969215712834,
    },
  },
  proteus: {
    parent: 'neptune',
    horizonsCode: '808',
    fitFromJdTdb: 2415020.5,
    fitToJdTdb: 2488069.5,
    fitStepDays: 30,
    poleRightAscensionRad: -1.05820769451,
    poleDeclinationRad: 0.74254591001,
    elements: {
      epochJdTt: 2451545,
      semiMajorAxisKm: 117674.337,
      eccentricity: 0.000490080813,
      inclinationRad: 0.00708737725,
      ascendingNodeRad: -0.039871878732,
      argumentOfPeriapsisRad: 0.340644097451,
      meanAnomalyAtEpochRad: 204484.46592692108,
      meanMotionRadPerDay: 5.597071815959368,
      ascendingNodeRateRadPerDay: 0.000062201467882188,
      argumentOfPeriapsisRateRadPerDay: 0.001282429835467035,
    },
  },
  larissa: {
    parent: 'neptune',
    horizonsCode: '807',
    fitFromJdTdb: 2415020.5,
    fitToJdTdb: 2488069.5,
    fitStepDays: 30,
    poleRightAscensionRad: -1.057794334699,
    poleDeclinationRad: 0.750122799263,
    elements: {
      epochJdTt: 2451545,
      semiMajorAxisKm: 73592.512,
      eccentricity: 0.001210044392,
      inclinationRad: 0.00388722875,
      ascendingNodeRad: -0.882180742832,
      argumentOfPeriapsisRad: -1.98143263983,
      meanAnomalyAtEpochRad: 413756.9343589834,
      meanMotionRadPerDay: 11.321284524766257,
      ascendingNodeRateRadPerDay: -0.006842867653753758,
      argumentOfPeriapsisRateRadPerDay: 0.013689432828309488,
    },
  },
} as const satisfies Record<string, SatelliteRecord>
