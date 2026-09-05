import { normalizeAngleRad } from './angles.js'
import type { Vec3 } from './vec3.js'

/**
 * Classical orbital elements for a body whose motion this package propagates
 * as a precessing ellipse rather than from a series.
 *
 * The angles are referred to whatever frame the elements were published in;
 * everything shipped in `data/satelliteElements.data.ts` is referred to ICRF
 * equatorial axes, because that is what Horizons' `REF_PLANE='FRAME'` element
 * output uses and what the frame tree wants. There is deliberately no frame
 * field: an element set whose frame is not ICRF has to be rotated by its
 * producer, not carried around as a mode flag that some call site will forget.
 */
export interface KeplerianElements {
  /** Epoch the angles below are valid at, Julian Date TT. */
  readonly epochJdTt: number
  readonly semiMajorAxisKm: number
  /** Strictly less than 1. Hyperbolic elements are rejected — see `keplerStateKm`. */
  readonly eccentricity: number
  readonly inclinationRad: number
  readonly ascendingNodeRad: number
  readonly argumentOfPeriapsisRad: number
  readonly meanAnomalyAtEpochRad: number
  readonly meanMotionRadPerDay: number
  /** Secular regression of the node. Zero if the element set has no rate. */
  readonly ascendingNodeRateRadPerDay?: number
  /** Secular advance of periapsis. Zero if the element set has no rate. */
  readonly argumentOfPeriapsisRateRadPerDay?: number
}

/**
 * Solve `M = E - e sin E` for the eccentric anomaly, in radians.
 *
 * Newton-Raphson from a starter that is already close for every eccentricity
 * an ellipse can have. The naive `E0 = M` starter needs hundreds of iterations
 * near `e = 1` and `M = 0`, where `dM/dE` collapses to `1 - e`; the starter
 * below is the standard `M + e sin M` correction, which keeps the iteration
 * count in single digits over the whole range.
 *
 * Converges to machine precision, or throws. It does not silently return a
 * half-converged answer: a Kepler solver that quietly gives up is a position
 * error that only appears at particular phases of particular orbits.
 */
export const solveKeplerEccentricAnomalyRad = (meanAnomalyRad: number, eccentricity: number): number => {
  if (!(eccentricity >= 0 && eccentricity < 1)) {
    throw new Error(`eccentricity must be in [0, 1); got ${eccentricity}`)
  }
  const m = normalizeAngleRad(meanAnomalyRad)
  let e = m + eccentricity * Math.sin(m)
  for (let i = 0; i < 100; i++) {
    const residual = e - eccentricity * Math.sin(e) - m
    const derivative = 1 - eccentricity * Math.cos(e)
    const step = residual / derivative
    e -= step
    // The residual, not the step, is the convergence criterion: near e = 1 the
    // step can be tiny while the residual is not.
    if (Math.abs(e - eccentricity * Math.sin(e) - m) <= 1e-14) return e
  }
  throw new Error(`Kepler's equation did not converge for M=${meanAnomalyRad}, e=${eccentricity}`)
}

/**
 * Position and velocity from elements, in the elements' own frame.
 *
 * The velocity is the exact time derivative of the position this same function
 * returns — all of it, including the two precession rates. `dE/dt` gives the
 * motion along the ellipse; the ellipse itself is also turning, at
 * `argumentOfPeriapsisRateRadPerDay` about the orbit normal and at
 * `ascendingNodeRateRadPerDay` about the frame's +z, and both contribute:
 *
 *     v = R (v_orbital + periapsisRate * (z x r_orbital)) + nodeRate * (z x r)
 *
 * Leaving those out is the sort of thing that survives every plausible test —
 * the velocity stays within half a percent of right, and no position is
 * affected — until something integrates it. `satellites.test.ts` catches it by
 * differencing the position numerically: Mimas's apsidal line turns 730 degrees
 * a year, and without the correction its velocity is 0.5 percent wrong.
 */
export const keplerStateKm = (
  elements: KeplerianElements,
  epochJdTt: number,
): { readonly positionKm: Vec3; readonly velocityKmPerDay: Vec3 } => {
  const {
    semiMajorAxisKm: a,
    eccentricity: e,
    meanMotionRadPerDay: n,
    inclinationRad: inclination,
  } = elements
  if (!(a > 0)) throw new Error(`semiMajorAxisKm must be positive; got ${a}`)

  const days = epochJdTt - elements.epochJdTt
  const nodeRate = elements.ascendingNodeRateRadPerDay ?? 0
  const periapsisRate = elements.argumentOfPeriapsisRateRadPerDay ?? 0
  const meanAnomaly = elements.meanAnomalyAtEpochRad + n * days
  const node = elements.ascendingNodeRad + nodeRate * days
  const periapsis = elements.argumentOfPeriapsisRad + periapsisRate * days

  const eccentricAnomaly = solveKeplerEccentricAnomalyRad(meanAnomaly, e)
  const cosE = Math.cos(eccentricAnomaly)
  const sinE = Math.sin(eccentricAnomaly)
  const beta = Math.sqrt(1 - e * e)

  // In the orbital plane, +x towards periapsis.
  const xOrbital = a * (cosE - e)
  const yOrbital = a * beta * sinE
  const eccentricAnomalyRate = n / (1 - e * cosE)
  // Motion along the ellipse, plus the ellipse's own rotation about the orbit
  // normal at the apsidal rate: d/dt Rz(periapsis) r = Rz(periapsis) (z x r).
  const vxOrbital = -a * sinE * eccentricAnomalyRate - periapsisRate * yOrbital
  const vyOrbital = a * beta * cosE * eccentricAnomalyRate + periapsisRate * xOrbital

  // Rz(node) Rx(inclination) Rz(periapsis), written out.
  const cosNode = Math.cos(node)
  const sinNode = Math.sin(node)
  const cosPeri = Math.cos(periapsis)
  const sinPeri = Math.sin(periapsis)
  const cosInc = Math.cos(inclination)
  const sinInc = Math.sin(inclination)

  const m00 = cosPeri * cosNode - sinPeri * sinNode * cosInc
  const m01 = -sinPeri * cosNode - cosPeri * sinNode * cosInc
  const m10 = cosPeri * sinNode + sinPeri * cosNode * cosInc
  const m11 = -sinPeri * sinNode + cosPeri * cosNode * cosInc
  const m20 = sinPeri * sinInc
  const m21 = cosPeri * sinInc

  const positionKm: Vec3 = [
    m00 * xOrbital + m01 * yOrbital,
    m10 * xOrbital + m11 * yOrbital,
    m20 * xOrbital + m21 * yOrbital,
  ]
  return {
    positionKm,
    // The outermost Rz(node) turns too: d/dt Rz(node) p = nodeRate * (z x p).
    velocityKmPerDay: [
      m00 * vxOrbital + m01 * vyOrbital - nodeRate * positionKm[1],
      m10 * vxOrbital + m11 * vyOrbital + nodeRate * positionKm[0],
      m20 * vxOrbital + m21 * vyOrbital,
    ],
  }
}

export const keplerPositionKm = (elements: KeplerianElements, epochJdTt: number): Vec3 =>
  keplerStateKm(elements, epochJdTt).positionKm

/**
 * `a(1 + e)` — the exact supremum of `|r|` over all epochs for a Keplerian
 * orbit, which is what `Frame.maxOffsetInParent` needs. Node and periapsis
 * precession rotate the ellipse but do not change its size, so the bound holds
 * for the precessing form too.
 */
export const keplerApoapsisKm = (elements: KeplerianElements): number =>
  elements.semiMajorAxisKm * (1 + elements.eccentricity)

/** Orbital period in days, from the mean motion. */
export const keplerPeriodDays = (elements: KeplerianElements): number =>
  (2 * Math.PI) / elements.meanMotionRadPerDay
