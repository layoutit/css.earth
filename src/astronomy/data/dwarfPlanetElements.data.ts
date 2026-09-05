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

export const DWARF_PLANET_ELEMENTS = {
  pluto: {
    query: "https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND=%27999%27&OBJ_DATA=NO&MAKE_EPHEM=YES&EPHEM_TYPE=ELEMENTS&CENTER=%27500%4010%27&START_TIME=%27JD2461041.5%27&STOP_TIME=%27JD2461042.5%27&STEP_SIZE=%271d%27&TIME_TYPE=TDB&OUT_UNITS=KM-D&REF_PLANE=FRAME&REF_SYSTEM=ICRF&CSV_FORMAT=YES",
    elements: {
      epochJdTt: 2461041.5,
      semiMajorAxisKm: 5926960866.43,
      eccentricity: 0.24745429437475,
      inclinationRad: 0.4090080923145,
      ascendingNodeRad: 0.7629144430262,
      argumentOfPeriapsisRad: 3.22500425212,
      meanAnomalyAtEpochRad: 0.904694321663,
      meanMotionRadPerDay: 0.000068979727017,
    },
  },
  ceres: {
    query: "https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND=%271%3B%27&OBJ_DATA=NO&MAKE_EPHEM=YES&EPHEM_TYPE=ELEMENTS&CENTER=%27500%4010%27&START_TIME=%27JD2461041.5%27&STOP_TIME=%27JD2461042.5%27&STEP_SIZE=%271d%27&TIME_TYPE=TDB&OUT_UNITS=KM-D&REF_PLANE=FRAME&REF_SYSTEM=ICRF&CSV_FORMAT=YES",
    elements: {
      epochJdTt: 2461041.5,
      semiMajorAxisKm: 413721487.1842,
      eccentricity: 0.07960223186188,
      inclinationRad: 0.4745853864175,
      ascendingNodeRad: 0.4074666523885,
      argumentOfPeriapsisRad: 2.310598475433,
      meanAnomalyAtEpochRad: 4.1943966577815,
      meanMotionRadPerDay: 0.003740308668942,
    },
  },
  eris: {
    query: "https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND=%27136199%3B%27&OBJ_DATA=NO&MAKE_EPHEM=YES&EPHEM_TYPE=ELEMENTS&CENTER=%27500%4010%27&START_TIME=%27JD2461041.5%27&STOP_TIME=%27JD2461042.5%27&STEP_SIZE=%271d%27&TIME_TYPE=TDB&OUT_UNITS=KM-D&REF_PLANE=FRAME&REF_SYSTEM=ICRF&CSV_FORMAT=YES",
    elements: {
      epochJdTt: 2461041.5,
      semiMajorAxisKm: 10170255812.903,
      eccentricity: 0.4372260575657,
      inclinationRad: 1.117071654771,
      ascendingNodeRad: 0.4707279067823,
      argumentOfPeriapsisRad: 2.8942663020785,
      meanAnomalyAtEpochRad: 3.6917180558,
      meanMotionRadPerDay: 0.000030688223202,
    },
  },
  haumea: {
    query: "https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND=%27136108%3B%27&OBJ_DATA=NO&MAKE_EPHEM=YES&EPHEM_TYPE=ELEMENTS&CENTER=%27500%4010%27&START_TIME=%27JD2461041.5%27&STOP_TIME=%27JD2461042.5%27&STEP_SIZE=%271d%27&TIME_TYPE=TDB&OUT_UNITS=KM-D&REF_PLANE=FRAME&REF_SYSTEM=ICRF&CSV_FORMAT=YES",
    elements: {
      epochJdTt: 2461041.5,
      semiMajorAxisKm: 6435136630.82,
      eccentricity: 0.1955063354406,
      inclinationRad: 0.4333139373181,
      ascendingNodeRad: 1.2758763364356,
      argumentOfPeriapsisRad: 5.139691320064,
      meanAnomalyAtEpochRad: 3.8834160115684,
      meanMotionRadPerDay: 0.000060972345394,
    },
  },
  makemake: {
    query: "https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND=%27136472%3B%27&OBJ_DATA=NO&MAKE_EPHEM=YES&EPHEM_TYPE=ELEMENTS&CENTER=%27500%4010%27&START_TIME=%27JD2461041.5%27&STOP_TIME=%27JD2461042.5%27&STEP_SIZE=%271d%27&TIME_TYPE=TDB&OUT_UNITS=KM-D&REF_PLANE=FRAME&REF_SYSTEM=ICRF&CSV_FORMAT=YES",
    elements: {
      epochJdTt: 2461041.5,
      semiMajorAxisKm: 6810141928.58,
      eccentricity: 0.1601130462351,
      inclinationRad: 0.6977738639597,
      ascendingNodeRad: 0.8362027382853,
      argumentOfPeriapsisRad: 5.838975433355,
      meanAnomalyAtEpochRad: 2.9573145951844,
      meanMotionRadPerDay: 0.000056006097871,
    },
  },
} satisfies Record<string, DwarfPlanetRecord>

export type DwarfPlanetId = keyof typeof DWARF_PLANET_ELEMENTS & string
