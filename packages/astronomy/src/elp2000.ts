import { ARCSEC_PER_RAD, vsop87ToIcrf } from './angles.js'
import {
  ELP2000_DISTANCE_SCALE,
  ELP2000_P_POLY,
  ELP2000_Q_POLY,
  ELP2000_TERMS,
  ELP2000_TERM_COUNT,
  ELP2000_TRUNCATION_BOUND_KM,
  ELP2000_W1_POLY,
} from './data/elp2000.data.js'
import { DAYS_PER_JULIAN_CENTURY, J2000_JD } from './time.js'
import type { Vec3 } from './vec3.js'

export { ELP2000_TERM_COUNT, ELP2000_TRUNCATION_BOUND_KM }

/** Window over which `ELP2000_TRUNCATION_BOUND_KM` holds. See `vsop87.ts` for why a series has one. */
export const ELP2000_VALID_FROM_JD = 2415020.5 // 1900-01-01
export const ELP2000_VALID_TO_JD = 2488069.5 // 2100-01-01

const polynomial = (coefficients: readonly number[], t: number): number => {
  let value = 0
  for (let i = coefficients.length - 1; i >= 0; i--) value = value * t + coefficients[i]!
  return value
}

/**
 * Geocentric position of the Moon, in kilometres, on ICRF axes.
 *
 * ELP2000-82B produces spherical coordinates in the mean dynamical ecliptic and
 * inertial equinox of J2000; both the ecliptic-to-equatorial rotation and the
 * ~0.1" dynamical-to-FK5 equinox offset are folded into `vsop87ToIcrf`, the
 * same matrix VSOP87A needs, because the two theories share that frame.
 */
export const moonGeocentricKm = (epochJdTt: number): Vec3 => {
  const t = (epochJdTt - J2000_JD) / DAYS_PER_JULIAN_CENTURY

  // Buckets are [variable * 3 + power]; hoisting t^power out of the inner loop
  // is the whole reason they are bucketed.
  let longitudeArcsec = 0
  let latitudeArcsec = 0
  let distanceKm = 0
  for (let variable = 0; variable < 3; variable++) {
    let sum = 0
    for (let power = 0; power <= 2; power++) {
      const flat = ELP2000_TERMS[variable * 3 + power]!
      let bucket = 0
      for (let i = 0; i < flat.length; i += 6) {
        const argument =
          flat[i + 1]! + t * (flat[i + 2]! + t * (flat[i + 3]! + t * (flat[i + 4]! + t * flat[i + 5]!)))
        bucket += flat[i]! * Math.sin(argument)
      }
      sum += bucket * (power === 0 ? 1 : power === 1 ? t : t * t)
    }
    if (variable === 0) longitudeArcsec = sum
    else if (variable === 1) latitudeArcsec = sum
    else distanceKm = sum
  }

  const longitudeRad = longitudeArcsec / ARCSEC_PER_RAD + polynomial(ELP2000_W1_POLY, t)
  const latitudeRad = latitudeArcsec / ARCSEC_PER_RAD
  const radiusKm = distanceKm * ELP2000_DISTANCE_SCALE

  const cosLatitude = Math.cos(latitudeRad)
  const x1 = radiusKm * cosLatitude * Math.cos(longitudeRad)
  const x2 = radiusKm * cosLatitude * Math.sin(longitudeRad)
  const x3 = radiusKm * Math.sin(latitudeRad)

  const p = polynomial(ELP2000_P_POLY, t) * t
  const q = polynomial(ELP2000_Q_POLY, t) * t
  const scale = 2 * Math.sqrt(1 - p * p - q * q)
  const pq2 = 2 * p * q
  const p2 = 1 - 2 * p * p
  const q2 = 1 - 2 * q * q
  const ps = p * scale
  const qs = q * scale

  return vsop87ToIcrf([
    p2 * x1 + pq2 * x2 + ps * x3,
    pq2 * x1 + q2 * x2 - qs * x3,
    -ps * x1 + qs * x2 + (p2 + q2 - 1) * x3,
  ])
}
