import { vsop87ToIcrf } from './angles.js'
import { VSOP87A_SERIES, VSOP87A_TRUNCATION_BOUND_AU, type Vsop87BodyKey, type Vsop87Series } from './data/vsop87a.data.js'
import { J2000_JD } from './time.js'
import type { Vec3 } from './vec3.js'

export type { Vsop87BodyKey }
export { VSOP87A_TRUNCATION_BOUND_AU }

/**
 * Days per thousand Julian years — the time unit VSOP87's series argument `T`
 * is measured in. Not `DAYS_PER_JULIAN_CENTURY * 10`: a Julian century is
 * 36525 days, so a thousand Julian years is 365250.
 */
export const DAYS_PER_THOUSAND_JULIAN_YEARS = 365250

/**
 * First and last epoch, as Julian Date TT, for which
 * `VSOP87A_TRUNCATION_BOUND_AU` holds. The truncation kept every term whose
 * worst-case size over this window survived the threshold, and the Poisson
 * (`T^alpha`) terms grow outside it, so the bound is a statement about this
 * window and nothing else. Evaluation still works outside — it just is not
 * bounded by the documented number.
 */
export const VSOP87A_VALID_FROM_JD = 2415020.5 // 1900-01-01
export const VSOP87A_VALID_TO_JD = 2488069.5 // 2100-01-01

/**
 * Every VSOP87A body this package carries. These are the barycentres of each
 * planetary SYSTEM, not the planet centres: VSOP87 integrates planet-plus-moons
 * as one mass, so `jupiter` here is the Jupiter system barycentre, up to 227 km
 * from Jupiter's own centre. `emb` is the Earth-Moon barycentre, 4671 km from
 * Earth's centre; `solarSystem.ts` splits that one with ELP2000-82B because for
 * Earth the difference is two thirds of a planetary radius.
 */
export const VSOP87A_BODY_KEYS = Object.keys(VSOP87A_SERIES) as readonly Vsop87BodyKey[]

const seriesOf = (key: Vsop87BodyKey): Vsop87Series => {
  const series = VSOP87A_SERIES[key]
  if (!series) throw new Error(`unknown VSOP87A body: ${key}`)
  return series
}

/** `T`, VSOP87's time argument: thousands of Julian years from J2000 TT. */
export const thousandJulianYearsSinceJ2000 = (epochJdTt: number): number =>
  (epochJdTt - J2000_JD) / DAYS_PER_THOUSAND_JULIAN_YEARS

const evaluate = (series: Vsop87Series, T: number): Vec3 => {
  const out: [number, number, number] = [0, 0, 0]
  for (let ic = 0; ic < 3; ic++) {
    const byAlpha = series[ic]!
    // Horner in T over the Poisson degrees, so `T**alpha` is never formed.
    let sum = 0
    for (let alpha = byAlpha.length - 1; alpha >= 0; alpha--) {
      const flat = byAlpha[alpha]!
      let s = 0
      for (let i = 0; i < flat.length; i += 3) s += flat[i]! * Math.cos(flat[i + 1]! + flat[i + 2]! * T)
      sum = sum * T + s
    }
    out[ic] = sum
  }
  return out
}

/**
 * Exact derivative of the truncated series with respect to `T`, in au per
 * thousand Julian years.
 *
 * VSOP87A ships velocity series (variables 4-6) as well, but differentiating
 * the position series analytically costs no data and is exact for the series we
 * actually evaluate. Checked against the authors' own `vsop87.chk` velocities,
 * which agree to 5e-11 au/day — the rounding of the printed check values.
 */
const evaluateRate = (series: Vsop87Series, T: number): Vec3 => {
  const out: [number, number, number] = [0, 0, 0]
  for (let ic = 0; ic < 3; ic++) {
    const byAlpha = series[ic]!
    let total = 0
    let tAlpha = 1 // T^alpha
    let tAlphaMinusOne = 0 // T^(alpha-1); unused at alpha 0, where the factor is alpha itself
    for (let alpha = 0; alpha < byAlpha.length; alpha++) {
      const flat = byAlpha[alpha]!
      let s = 0
      let ds = 0
      for (let i = 0; i < flat.length; i += 3) {
        const phase = flat[i + 1]! + flat[i + 2]! * T
        s += flat[i]! * Math.cos(phase)
        ds -= flat[i]! * flat[i + 2]! * Math.sin(phase)
      }
      // d/dT [T^alpha * s(T)] = alpha*T^(alpha-1)*s + T^alpha*s'
      total += alpha * tAlphaMinusOne * s + tAlpha * ds
      tAlphaMinusOne = tAlpha
      tAlpha *= T
    }
    out[ic] = total
  }
  return out
}

/**
 * Heliocentric position of a planetary system barycentre, in au, on ICRF axes.
 *
 * VSOP87A is published in the dynamical ecliptic and inertial equinox of J2000;
 * the rotation to ICRF (`VSOP87_TO_ICRF`) is applied here so that everything
 * this package returns is already on the axes the frame tree assumes.
 */
export const systemBarycentreHeliocentricAu = (key: Vsop87BodyKey, epochJdTt: number): Vec3 =>
  vsop87ToIcrf(evaluate(seriesOf(key), thousandJulianYearsSinceJ2000(epochJdTt)))

/** Heliocentric velocity of the same, in au per day, on ICRF axes. */
export const systemBarycentreVelocityAuPerDay = (key: Vsop87BodyKey, epochJdTt: number): Vec3 => {
  const rate = evaluateRate(seriesOf(key), thousandJulianYearsSinceJ2000(epochJdTt))
  return vsop87ToIcrf([
    rate[0] / DAYS_PER_THOUSAND_JULIAN_YEARS,
    rate[1] / DAYS_PER_THOUSAND_JULIAN_YEARS,
    rate[2] / DAYS_PER_THOUSAND_JULIAN_YEARS,
  ])
}
