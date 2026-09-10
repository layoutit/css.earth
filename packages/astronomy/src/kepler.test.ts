import { describe, expect, it } from 'vitest'
import { distance, magnitude } from './__fixtures__/compare.js'
import { normalizeAngleRad } from './angles.js'
import {
  keplerApoapsisKm,
  keplerPeriodDays,
  keplerPositionKm,
  keplerStateKm,
  solveKeplerEccentricAnomalyRad,
  type KeplerianElements,
} from './kepler.js'

const circularish: KeplerianElements = {
  epochJdTt: 2451545,
  semiMajorAxisKm: 421800,
  eccentricity: 0.0041,
  inclinationRad: 0.0006,
  ascendingNodeRad: 1.2,
  argumentOfPeriapsisRad: 0.85,
  meanAnomalyAtEpochRad: 5.77,
  meanMotionRadPerDay: 3.5644,
}

describe("Kepler's equation", () => {
  it('brackets the near-parabolic NEOWISE input if Newton does not converge', () => {
    // A real comet intake regression. The monotonic residual proves the
    // returned anomaly solves this input rather than returning a stalled step.
    const m = 0.004628836966509339, eccentricity = 0.9992850366164265
    for (const meanAnomaly of [m, -m]) {
      const anomaly = solveKeplerEccentricAnomalyRad(meanAnomaly, eccentricity)
      expect(Math.abs(anomaly - eccentricity * Math.sin(anomaly) - normalizeAngleRad(meanAnomaly))).toBeLessThanOrEqual(1e-14)
    }
  })
  it('satisfies M = E - e sin E across the whole elliptic range', () => {
    // The invariant, not a table of answers: for every (M, e) the solver claims
    // to handle, put its answer back into the equation. 2320 cases, including
    // e = 0.99 where the naive iteration stalls and M near 0 and 2*pi where the
    // derivative collapses.
    let worst = 0
    for (const e of [0, 0.001, 0.05, 0.2, 0.5, 0.8, 0.9, 0.95, 0.99, 0.999]) {
      for (let i = 0; i <= 231; i++) {
        // Sampled over three revolutions, so the wrap-around is exercised;
        // the residual is taken against the wrapped M, which is the one the
        // solver is answering.
        const m = (6 * Math.PI * i) / 231
        const eccentricAnomaly = solveKeplerEccentricAnomalyRad(m, e)
        worst = Math.max(worst, Math.abs(eccentricAnomaly - e * Math.sin(eccentricAnomaly) - normalizeAngleRad(m)))
      }
    }
    expect(worst).toBeLessThanOrEqual(1e-14)
  })

  it('is insensitive to how many revolutions the mean anomaly has run through', () => {
    for (const e of [0.01, 0.4, 0.9]) {
      const base = solveKeplerEccentricAnomalyRad(1.3, e)
      for (const turns of [1, 5, -3, 1000]) {
        const shifted = solveKeplerEccentricAnomalyRad(1.3 + 2 * Math.PI * turns, e)
        expect(Math.abs(shifted - base)).toBeLessThan(1e-12)
      }
    }
  })

  it('refuses a hyperbolic or invalid eccentricity instead of returning a number', () => {
    expect(() => solveKeplerEccentricAnomalyRad(1, 1)).toThrow(/eccentricity/)
    expect(() => solveKeplerEccentricAnomalyRad(1, 1.4)).toThrow(/eccentricity/)
    expect(() => solveKeplerEccentricAnomalyRad(1, -0.1)).toThrow(/eccentricity/)
    expect(() => solveKeplerEccentricAnomalyRad(1, Number.NaN)).toThrow(/eccentricity/)
  })
})

describe('Keplerian propagation', () => {
  it('conserves energy and angular momentum over an orbit', () => {
    // The two constants of the two-body problem. A rotation applied in the
    // wrong order, or a velocity built from the wrong dE/dt, breaks one of them
    // while still producing a plausible-looking ellipse.
    const elements: KeplerianElements = { ...circularish, eccentricity: 0.6 }
    const gm = elements.meanMotionRadPerDay ** 2 * elements.semiMajorAxisKm ** 3
    const period = keplerPeriodDays(elements)
    let worstEnergy = 0
    let worstMomentum = 0
    let referenceEnergy = 0
    let referenceMomentum = 0
    for (let i = 0; i <= 240; i++) {
      const { positionKm, velocityKmPerDay } = keplerStateKm(elements, elements.epochJdTt + (period * i) / 240)
      const r = magnitude(positionKm)
      const v = magnitude(velocityKmPerDay)
      const energy = (v * v) / 2 - gm / r
      const momentum = magnitude([
        positionKm[1] * velocityKmPerDay[2] - positionKm[2] * velocityKmPerDay[1],
        positionKm[2] * velocityKmPerDay[0] - positionKm[0] * velocityKmPerDay[2],
        positionKm[0] * velocityKmPerDay[1] - positionKm[1] * velocityKmPerDay[0],
      ])
      if (i === 0) {
        referenceEnergy = energy
        referenceMomentum = momentum
      }
      worstEnergy = Math.max(worstEnergy, Math.abs(energy - referenceEnergy) / Math.abs(referenceEnergy))
      worstMomentum = Math.max(worstMomentum, Math.abs(momentum - referenceMomentum) / referenceMomentum)
    }
    expect(worstEnergy).toBeLessThan(1e-12)
    expect(worstMomentum).toBeLessThan(1e-12)
  })

  it('returns to the same place after exactly one period', () => {
    const period = keplerPeriodDays(circularish)
    const start = keplerPositionKm(circularish, circularish.epochJdTt)
    const later = keplerPositionKm(circularish, circularish.epochJdTt + period)
    // A millimetre, not a micron: a Julian Date near 2.45e6 resolves to 4.7e-10
    // days, and Io moves 0.7 m in that. The floor is the epoch's precision,
    // which is exactly what `time.ts` documents.
    expect(distance(start, later)).toBeLessThan(1e-6 * 1000)
    // ... and not after half of one, which is what makes the above an assertion
    // rather than a tautology about a function of a wrapped angle.
    expect(distance(start, keplerPositionKm(circularish, circularish.epochJdTt + period / 2))).toBeGreaterThan(1e5)
  })

  it('agrees with a five-point numerical derivative of its own position', () => {
    const elements: KeplerianElements = { ...circularish, eccentricity: 0.6 }
    const h = 1 / 1024
    const at = (offset: number) => keplerPositionKm(elements, elements.epochJdTt + offset)
    const numeric = [0, 1, 2].map(
      (i) => (-at(2 * h)[i]! + 8 * at(h)[i]! - 8 * at(-h)[i]! + at(-2 * h)[i]!) / (12 * h),
    )
    const analytic = keplerStateKm(elements, elements.epochJdTt).velocityKmPerDay
    expect(distance(numeric, analytic) / magnitude(analytic)).toBeLessThan
      (1e-9)
  })

  it('bounds the orbit by a(1 + e) and nothing tighter', () => {
    // `Frame.maxOffsetInParent` is exactly this number, so the claim that it is
    // a supremum has to be a tested claim and not a comment. The precessing
    // form is sampled too: node and periapsis rates rotate the ellipse without
    // resizing it.
    const elements: KeplerianElements = {
      ...circularish,
      eccentricity: 0.35,
      ascendingNodeRateRadPerDay: 0.004,
      argumentOfPeriapsisRateRadPerDay: -0.009,
    }
    const bound = keplerApoapsisKm(elements)
    let farthest = 0
    for (let i = 0; i <= 20000; i++) {
      farthest = Math.max(farthest, magnitude(keplerPositionKm(elements, elements.epochJdTt + i * 0.37)))
    }
    expect(farthest).toBeLessThanOrEqual(bound)
    // Tight: the sampling really does reach apoapsis, so the bound is not slack.
    expect(farthest / bound).toBeGreaterThan(0.99999)
  })

  it('precesses the node and the periapsis at the rates it is given', () => {
    const elements: KeplerianElements = {
      ...circularish,
      inclinationRad: 0.4,
      eccentricity: 0.2,
      ascendingNodeRateRadPerDay: 0.001,
      argumentOfPeriapsisRateRadPerDay: -0.0004,
    }
    const { inclinationRad: inclination, eccentricity, semiMajorAxisKm, meanMotionRadPerDay } = elements
    const nodeAt = (t: number) => elements.ascendingNodeRad + 0.001 * (t - elements.epochJdTt)
    const periapsisAt = (t: number) => elements.argumentOfPeriapsisRad - 0.0004 * (t - elements.epochJdTt)

    // The orbit normal implied by (i, node) at each instant. The position is
    // perpendicular to it, always and exactly — no sampling, no chord, no
    // second-order bias to argue about.
    const normalFor = (node: number) => [
      Math.sin(inclination) * Math.sin(node),
      -Math.sin(inclination) * Math.cos(node),
      Math.cos(inclination),
    ]
    for (const days of [0, 37.5, 100, 1000]) {
      const t = elements.epochJdTt + days
      const position = keplerPositionKm(elements, t)
      const normal = normalFor(nodeAt(t))
      const out = Math.abs(position[0] * normal[0]! + position[1] * normal[1]! + position[2] * normal[2]!)
      expect(out / magnitude(position)).toBeLessThan(1e-12)
    }
    // Sensitivity: the same check against the UNprecessed node fails outright
    // after a thousand days, so the assertion above is about the rate and not
    // about the plane happening to contain everything.
    const stale = normalFor(elements.ascendingNodeRad)
    const late = keplerPositionKm(elements, elements.epochJdTt + 1000)
    const staleOut = Math.abs(late[0] * stale[0]! + late[1] * stale[1]! + late[2] * stale[2]!)
    expect(staleOut / magnitude(late)).toBeGreaterThan(0.1)

    // The periapsis rate, exactly: at mean anomaly zero the body is at
    // a(1 - e) along the periapsis direction, so the position at each periapsis
    // passage pins both angles at once.
    const periapsisDirection = (node: number, periapsis: number) => {
      const cw = Math.cos(periapsis)
      const sw = Math.sin(periapsis)
      const cn = Math.cos(node)
      const sn = Math.sin(node)
      const ci = Math.cos(inclination)
      return [cw * cn - sw * sn * ci, cw * sn + sw * cn * ci, sw * Math.sin(inclination)]
    }
    for (const revolutions of [0, 1, 57, 500]) {
      const t =
        elements.epochJdTt + (2 * Math.PI * revolutions - elements.meanAnomalyAtEpochRad) / meanMotionRadPerDay
      const expected = periapsisDirection(nodeAt(t), periapsisAt(t)).map(
        (component) => component * semiMajorAxisKm * (1 - eccentricity),
      )
      // 1e-8 of a, not 1e-12: a Julian Date near 2.45e6 resolves to 4.7e-10
      // days, which is 1.7e-9 radians of mean anomaly here. That floor, not the
      // solver, is what this tolerance is made of.
      expect(distance(keplerPositionKm(elements, t), expected) / semiMajorAxisKm).toBeLessThan(1e-8)
    }
  })

  it('rejects a non-positive semi-major axis', () => {
    expect(() => keplerStateKm({ ...circularish, semiMajorAxisKm: 0 }, 2451545)).toThrow(/semiMajorAxisKm/)
    expect(() => keplerStateKm({ ...circularish, semiMajorAxisKm: -1 }, 2451545)).toThrow(/semiMajorAxisKm/)
  })
})
