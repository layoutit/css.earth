/**
 * The prepared solar geometry the host passes in: the unit direction to the Sun, the J2000 ecliptic north pole and the
 * body-fixed to ICRF rotation of each body at one pinned epoch. `packages/bake/cli/prepare-solar-geometry.mts` generates it
 * into the checkout (`src/platform/solar-geometry.mts`) after the packages build, from the built astronomy and bake
 * packages, so no package can import it; a caller imports that module and hands it to the frame preparers here, which
 * read nothing else. The generated module satisfies this interface as it is.
 */
export interface SolarGeometry {
  /** The epoch every direction is taken at, as its prepared label (`2026-09-03T00:00:00 TT`). */
  readonly SOLAR_GEOMETRY_EPOCH_LABEL: string;
  /** Unit direction from the body to the Sun in its body-fixed frame (+Z north pole, +X prime meridian). */
  requireBodyFixedSunDirection(bodyId: string): readonly number[];
  /** The J2000 ecliptic north pole in the body-fixed frame. */
  requireBodyFixedEclipticNorth(bodyId: string): readonly number[];
  /** The body-fixed to ICRF rotation, row-major. */
  requireBodyFixedToIcrf(bodyId: string): readonly number[];
  /** The epoch as a Julian date (TT). */
  readonly SOLAR_GEOMETRY_EPOCH_JD_TT: number;
  /** The astronomical unit in kilometres the prepared distances use. */
  readonly ASTRONOMICAL_UNIT_KILOMETERS: number;
  /** For a planet of another star, the body-fixed direction to its own star; `null` for a body the Sun lights. */
  bodyFixedStarDirection(bodyId: string): readonly number[] | null;
  /** The body's prepared orbit at the epoch; the scene reads its heliocentric distance. */
  requireBodyOrbit(bodyId: string): { readonly heliocentricDistanceAu: number };
}
