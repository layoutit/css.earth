// The shape of the Horizons vector fixtures (data/fixtures/, compiled to data/generated/horizons.ts).
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
