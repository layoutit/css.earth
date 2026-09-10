
// GENERATED FILE — do not edit by hand.
//
// Source:    JPL Horizons vector ephemerides; every entry carries the URL that produced it
// Generator: packages/astronomy/tools/fetch-fixtures.mts
//
// Regenerate with `node tools/fetch-fixtures.mjs` from packages/astronomy. The
// generator re-downloads the source series, re-derives the truncation, and
// prints the error budget it certifies; the numbers in README.md come from it.

import type { Vec3 } from '../vec3.js'

export interface HorizonsRow {
  /** Julian Date, TDB. Treated as TT by the tests: they differ by under 2 ms. */
  readonly jdTdb: number
  readonly positionKm: Vec3
  readonly velocityKmPerDay: Vec3
}

export interface HorizonsFixture {
  readonly description: string
  /** The exact request. `curl` it to reproduce the rows below. */
  readonly query: string
  readonly rows: readonly HorizonsRow[]
}

/** ICRF equatorial (`REF_PLANE='FRAME'`), geometric (`VEC_CORR='NONE'`), km and km/day. */
export { HORIZONS } from '../data/generated/horizons.js'

/**
 * The two Mars states PLAN.md's appendix pins, verbatim, in au and au/day and
 * in the ECLIPTIC of J2000 rather than ICRF equatorial. They are here in the
 * plan's own units so that the one fixture the plan supplies is checked in the
 * form the plan supplies it, exercising the ecliptic conversion as well as the
 * series. Horizons reproduces them digit for digit with
 * `REF_PLANE='ECLIPTIC'`; see `marsEclipticQuery`.
 */
export const PLAN_MARS_ECLIPTIC = {
  query:
    "https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND='4'&OBJ_DATA='NO'&MAKE_EPHEM='YES'" +
    "&EPHEM_TYPE='VECTORS'&CENTER='500@10'&TLIST=2461041.5,2461042.5&TLIST_TYPE='JD'&TIME_TYPE='TDB'" +
    "&OUT_UNITS='AU-D'&REF_PLANE='ECLIPTIC'&REF_SYSTEM='ICRF'&VEC_TABLE='2'&VEC_CORR='NONE'",
  rows: [
    {
      jdTdb: 2461041.5,
      positionAu: [3.405796768622151e-1, -1.387002015945254, -3.741722678770108e-2] as Vec3,
      velocityAuPerDay: [1.411941195403098e-2, 4.540203195240467e-3, -2.510853588872874e-4] as Vec3,
    },
    {
      jdTdb: 2461042.5,
      positionAu: [3.54681558330501e-1, -1.382391469336554, -3.7666408101236e-2] as Vec3,
      velocityAuPerDay: [1.408409944947758e-2, 4.68086273605707e-3, -2.472716573619788e-4] as Vec3,
    },
  ],
} as const
