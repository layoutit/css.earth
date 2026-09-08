import { fitHarmonics } from './fit-harmonics.mjs'

const DEG = Math.PI / 180
const J2000 = 2451545

// Position from one osculating element sample, or the reduced mean ellipse.
// The source values are geometric KM-D, ICRF, TDB and planet-centred. TT differs
// from TDB by <2 ms here, far below the sampled orbit-fit error.
function position(elements, days = 0, phase = 0) {
  const { semiMajorAxisKm: a, eccentricity: e, inclinationRad: inc } = elements
  const mean = elements.meanAnomalyAtEpochRad + days * elements.meanMotionRadPerDay + phase
  const m = ((mean + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI
  if (!(a > 0 && e >= 0 && e < 1)) throw new Error('Residual fit requires elliptic source elements')
  let E = m + e * Math.sin(m), converged = false
  for (let i = 0; i < 20; i++) {
    const step = (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E))
    E -= step
    if (Math.abs(step) < 1e-14) { converged = true; break }
  }
  if (!converged) throw new Error('Residual-fit Kepler solve did not converge')
  const node = elements.ascendingNodeRad + days * (elements.ascendingNodeRateRadPerDay ?? 0)
  const peri = elements.argumentOfPeriapsisRad + days * (elements.argumentOfPeriapsisRateRadPerDay ?? 0)
  const x = a * (Math.cos(E) - e), y = a * Math.sqrt(1 - e * e) * Math.sin(E)
  const xp = x * Math.cos(peri) - y * Math.sin(peri), yp = x * Math.sin(peri) + y * Math.cos(peri)
  return [xp * Math.cos(node) - yp * Math.cos(inc) * Math.sin(node),
    xp * Math.sin(node) + yp * Math.cos(inc) * Math.cos(node), yp * Math.sin(inc)]
}

/** Bounded ICRF residual series; no interpolation table, drift term or runtime fit. */
export function fitPositionCorrection(rows, meanElements, basis, count = 10) {
  const days = rows.map(r => r.jd - J2000)
  const residual = rows.map((r, i) => {
    const source = position({ semiMajorAxisKm: r.semiMajorAxisKm, eccentricity: r.eccentricity,
      inclinationRad: r.inclinationDeg * DEG, ascendingNodeRad: r.nodeDeg * DEG,
      argumentOfPeriapsisRad: r.periapsisDeg * DEG, meanAnomalyAtEpochRad: r.meanAnomalyDeg * DEG,
      meanMotionRadPerDay: r.meanMotionDegPerDay * DEG })
    const phase = (meanElements.longitudeHarmonics ?? []).reduce((sum, h) => {
      const angle = h.rateRadPerDay * (r.jd - h.epochJdTt)
      return sum + h.cosineRad * Math.cos(angle) + h.sineRad * Math.sin(angle)
    }, 0)
    const local = position(meanElements, days[i], phase)
    return source.map((v, axis) => v - basis.reduce((sum, vector, j) => sum + vector[axis] * local[j], 0))
  })
  const epochJdTt = (rows[0].jd + rows.at(-1).jd) / 2
  const separation = 2 * Math.PI / (days.at(-1) - days[0]) / 4
  const axes = [0, 1, 2].map(axis => {
    const fit = fitHarmonics(days, residual.map(r => r[axis]), { intercept: 0, slope: 0 }, count, { trend: false, separation })
    return { constantKm: fit.intercept, harmonics: fit.harmonics.map(h => ({
      rateRadPerDay: h.rateRadPerDay, cosineKm: h.cosine, sineKm: h.sine,
    })) }
  })
  return { epochJdTt, axes }
}
