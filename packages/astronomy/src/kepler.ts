import { normalizeAngleRad } from './angles.js'
import type { Vec3 } from './vec3.js'

/**
 * Classical orbital elements for a body whose motion this package propagates
 * as a precessing ellipse or hyperbola rather than from a series.
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
  /** Positive for an ellipse, negative for a hyperbola. */
  readonly semiMajorAxisKm: number
  /** Non-negative; e = 1 (parabolic motion) is unsupported. */
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
 * Newton-Raphson from the standard `M + e sin M` starter. Near `e = 1` and
 * `M = 0`, `dM/dE` collapses to `1 - e`; if Newton does not converge, a
 * bracketed bisection fallback handles that ill-conditioned elliptic case.
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
  // Preserve every converged Newton result. Near-parabolic elliptic inputs
  // can make that iteration escape; monotonic E-e*sin(E) on [0,2pi] gives a
  // bounded bisection fallback without changing the established fast path.
  let lower = 0
  let upper = 2 * Math.PI
  for (let i = 0; i < 100; i++) {
    const middle = (lower + upper) / 2
    const residual = middle - eccentricity * Math.sin(middle) - m
    if (Math.abs(residual) <= 1e-14) return middle
    if (residual > 0) upper = middle
    else lower = middle
  }
  throw new Error(`Kepler's equation did not converge for M=${meanAnomalyRad}, e=${eccentricity}`)
}

/**
 * Solve M = e sinh H - H without wrapping M: hyperbolic motion never repeats.
 * Bryan Weber, Orbital Mechanics & Astrodynamics, equations 234–236:
 * https://orbital-mechanics.space/time-since-periapsis-and-keplers-equation/hyperbolic-trajectories.html
 * Newton steps are bracketed by bisection because the derivative can be small
 * near e = 1. The equation is strictly increasing and odd for e > 1.
 */
export const solveKeplerHyperbolicAnomalyRad = (meanAnomalyRad: number, eccentricity: number): number => {
  if (!(Number.isFinite(eccentricity) && eccentricity > 1)) {
    throw new Error(`hyperbolic eccentricity must be finite and > 1; got ${eccentricity}`)
  }
  if (!Number.isFinite(meanAnomalyRad)) throw new Error('hyperbolic mean anomaly must be finite')
  if (meanAnomalyRad === 0) return 0
  const m = Math.abs(meanAnomalyRad)
  let h = Math.asinh(m / eccentricity)
  let lower = 0
  let upper = Math.max(1, h + 1)
  while (eccentricity * Math.sinh(upper) - upper < m) upper *= 2
  for (let i = 0; i < 100; i++) {
    const residual = eccentricity * Math.sinh(h) - h - m
    // Include cancellation in e*sinh(H)-H and rounding of large H in the
    // residual budget; an absolute M tolerance loses precision near periapsis.
    const tolerance = 8 * Number.EPSILON * (m + h) * Math.max(1, h)
    if (Math.abs(residual) <= tolerance) return Math.sign(meanAnomalyRad) * h
    if (residual > 0) upper = h
    else lower = h
    const next = h - residual / (eccentricity * Math.cosh(h) - 1)
    h = next > lower && next < upper ? next : (lower + upper) / 2
  }
  throw new Error(`Hyperbolic Kepler's equation did not converge for M=${meanAnomalyRad}, e=${eccentricity}`)
}

const validateConic = ({ semiMajorAxisKm: a, eccentricity: e }: KeplerianElements): void => {
  if (!(Number.isFinite(e) && e >= 0 && e !== 1)) {
    throw new Error(`eccentricity must be finite, non-negative and not parabolic (1); got ${e}`)
  }
  if (!(Number.isFinite(a) && (e < 1 ? a > 0 : a < 0))) {
    throw new Error(`semiMajorAxisKm must be finite and ${e < 1 ? 'positive for an ellipse' : 'negative for a hyperbola'}; got ${a}`)
  }
}

/**
 * Position and velocity from elements, in the elements' own frame.
 *
 * The velocity is the exact time derivative of the position this same function
 * returns — all of it, including the two precession rates. `dE/dt` or `dH/dt`
 * gives motion along the conic; the conic itself is also turning, at
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
  validateConic(elements)

  const days = epochJdTt - elements.epochJdTt
  const nodeRate = elements.ascendingNodeRateRadPerDay ?? 0
  const periapsisRate = elements.argumentOfPeriapsisRateRadPerDay ?? 0
  const meanAnomaly = elements.meanAnomalyAtEpochRad + n * days
  const node = elements.ascendingNodeRad + nodeRate * days
  const periapsis = elements.argumentOfPeriapsisRad + periapsisRate * days

  // In the orbital plane, +x towards periapsis.
  let xOrbital: number, yOrbital: number, vxOrbital: number, vyOrbital: number
  if (e > 1) {
    const h = solveKeplerHyperbolicAnomalyRad(meanAnomaly, e)
    const coshH = Math.cosh(h)
    const sinhH = Math.sinh(h)
    const beta = Math.sqrt((e - 1) * (e + 1))
    const hyperbolicAnomalyRate = n / (e * coshH - 1)
    // With negative a, q = a(1-e) is positive and increasing H moves toward +y.
    xOrbital = a * (coshH - e)
    yOrbital = -a * beta * sinhH
    vxOrbital = a * sinhH * hyperbolicAnomalyRate - periapsisRate * yOrbital
    vyOrbital = -a * beta * coshH * hyperbolicAnomalyRate + periapsisRate * xOrbital
  } else {
    const eccentricAnomaly = solveKeplerEccentricAnomalyRad(meanAnomaly, e)
    const cosE = Math.cos(eccentricAnomaly)
    const sinE = Math.sin(eccentricAnomaly)
    const beta = Math.sqrt(1 - e * e)
    xOrbital = a * (cosE - e)
    yOrbital = a * beta * sinE
    const eccentricAnomalyRate = n / (1 - e * cosE)
    // d/dt Rz(periapsis) r = Rz(periapsis) (z x r).
    vxOrbital = -a * sinE * eccentricAnomalyRate - periapsisRate * yOrbital
    vyOrbital = a * beta * cosE * eccentricAnomalyRate + periapsisRate * xOrbital
  }

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
 * ellipse, which is what `Frame.maxOffsetInParent` needs. Node and periapsis
 * precession rotate the ellipse but do not change its size, so the bound holds
 * for the precessing form too.
 */
export const keplerApoapsisKm = (elements: KeplerianElements): number => {
  validateConic(elements)
  if (elements.eccentricity > 1) throw new Error('hyperbolic trajectories have no finite apoapsis')
  return elements.semiMajorAxisKm * (1 + elements.eccentricity)
}

/** Period applies only to ellipses; see NAIF oscltx_c, Detailed_Output.
 * https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/oscltx_c.html
 */
export const keplerPeriodDays = (elements: KeplerianElements): number => {
  validateConic(elements)
  if (elements.eccentricity > 1) throw new Error('hyperbolic trajectories have no orbital period')
  return (2 * Math.PI) / elements.meanMotionRadPerDay
}
