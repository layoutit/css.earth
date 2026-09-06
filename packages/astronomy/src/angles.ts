import type { Vec3 } from './vec3.js'

/** Radians per degree. Degrees exist at the UI edge and in published constants; nowhere else. */
export const RAD_PER_DEG = Math.PI / 180
/** Radians per arcsecond. */
export const RAD_PER_ARCSEC = Math.PI / 648000
export const ARCSEC_PER_RAD = 648000 / Math.PI

export const degToRad = (deg: number): number => deg * RAD_PER_DEG
export const radToDeg = (rad: number): number => rad / RAD_PER_DEG
export const arcsecToRad = (arcsec: number): number => arcsec * RAD_PER_ARCSEC

/** Wrap to `[0, 2π)`. */
export const normalizeAngleRad = (rad: number): number => {
  const wrapped = rad % (2 * Math.PI)
  return wrapped < 0 ? wrapped + 2 * Math.PI : wrapped
}

/**
 * Obliquity of the ecliptic at J2000.0, in radians: 84381.448 arcseconds.
 *
 * This is the IAU 1976 value, NOT the IAU 2006 value (84381.406). The choice is
 * not cosmetic and not free: it is the number JPL Horizons uses to define its
 * `REF_PLANE='ECLIPTIC'` output, verified by rotating Horizons' equatorial
 * (`REF_PLANE='FRAME'`) vectors onto its ecliptic vectors for the same body and
 * epoch — the recovered angle is 84381.4480" at every epoch tested, to the four
 * decimals the printed vectors support (see `icrf.test.ts`). Using 84381.406
 * here would put every ecliptic conversion 0.042" off Horizons, which is 4 km at
 * 1 au: below this package's error budget, but a systematic bias with no
 * symptom, and exactly the kind of thing that is impossible to find later.
 */
export const OBLIQUITY_J2000_RAD = 84381.448 * RAD_PER_ARCSEC

const COS_OBLIQUITY = Math.cos(OBLIQUITY_J2000_RAD)
const SIN_OBLIQUITY = Math.sin(OBLIQUITY_J2000_RAD)

/**
 * Ecliptic-of-J2000 rectangular coordinates to ICRF equatorial. A rotation
 * about the shared +X axis by the obliquity above.
 *
 * Every position this package hands to a `Frame` is ICRF equatorial, because
 * frames share ICRF axes (`frames.ts`). This conversion exists for the edge:
 * published tables, Horizons fixtures and the ecliptic longitude a UI wants.
 */
export const eclipticJ2000ToIcrf = (v: Vec3): Vec3 => [
  v[0],
  v[1] * COS_OBLIQUITY - v[2] * SIN_OBLIQUITY,
  v[1] * SIN_OBLIQUITY + v[2] * COS_OBLIQUITY,
]

export const icrfToEclipticJ2000 = (v: Vec3): Vec3 => [
  v[0],
  v[1] * COS_OBLIQUITY + v[2] * SIN_OBLIQUITY,
  -v[1] * SIN_OBLIQUITY + v[2] * COS_OBLIQUITY,
]

/**
 * VSOP87 / ELP2000-82B dynamical ecliptic and inertial equinox of J2000, to the
 * equatorial FK5 (≈ ICRF) frame. Published in the VSOP87 notice `vsop87.txt`
 * (Bureau des Longitudes, BDL-9502) and reproduced verbatim.
 *
 * It is NOT the obliquity rotation above: it also carries the ~0.1" offset
 * between the DE200 dynamical equinox the two theories were fitted to and the
 * FK5/ICRF equinox. Rotating by the obliquity alone leaves that offset in, as a
 * fixed 0.09" swing in ecliptic longitude for every body at once.
 *
 * Row-major 3×3.
 */
export const VSOP87_TO_ICRF: readonly number[] = [
  1.0, 0.00000044036, -0.000000190919,
  -0.000000479966, 0.917482137087, -0.397776982902,
  0.0, 0.397776982902, 0.917482137087,
]

/** Apply a row-major 3×3 matrix to a vector. */
export const applyMatrix3 = (m: readonly number[], v: Vec3): Vec3 => [
  m[0]! * v[0] + m[1]! * v[1] + m[2]! * v[2],
  m[3]! * v[0] + m[4]! * v[1] + m[5]! * v[2],
  m[6]! * v[0] + m[7]! * v[1] + m[8]! * v[2],
]

/** Dynamical-frame rectangular coordinates (VSOP87A, ELP2000-82B) to ICRF. */
export const vsop87ToIcrf = (v: Vec3): Vec3 => applyMatrix3(VSOP87_TO_ICRF, v)
