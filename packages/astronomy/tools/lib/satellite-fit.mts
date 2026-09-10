export const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

/** Least squares `y = intercept + slope * x`, x already centred on J2000. */
export function fitLine(xs: readonly number[], ys: readonly number[]) {
  const xBar = mean(xs)
  const yBar = mean(ys)
  let sxy = 0
  let sxx = 0
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - xBar) * (ys[i] - yBar)
    sxx += (xs[i] - xBar) ** 2
  }
  const slope = sxy / sxx
  return { slope, intercept: yBar - slope * xBar }
}

export const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a: readonly number[], b: readonly number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
export const normalize = (a: readonly number[]) => {
  const n = Math.hypot(a[0], a[1], a[2])
  return [a[0] / n, a[1] / n, a[2] / n]
}

export function solveKepler(meanAnomalyRad: number, eccentricity: number) {
  const normalizedMeanAnomaly = ((meanAnomalyRad + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI
  let eccentricAnomaly = normalizedMeanAnomaly + eccentricity * Math.sin(normalizedMeanAnomaly)
  for (let i = 0; i < 30; i++) {
    const residual = eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly) - normalizedMeanAnomaly
    eccentricAnomaly -= residual / (1 - eccentricity * Math.cos(eccentricAnomaly))
    if (Math.abs(residual) < 1e-14) return eccentricAnomaly
  }
  throw new Error(`Kepler solve did not converge for e=${eccentricity}`)
}

/**
 * Orthonormal basis of the plane whose pole is `pole`, x-axis along that
 * plane's ascending node on the ICRF equator. Duplicated at runtime by
 * `laplaceBasis` in src/satellites.ts — if one changes the other must.
 */
export function planeBasis(pole: readonly number[]) {
  const x = cross([0, 0, 1], pole)
  const norm = Math.hypot(x[0], x[1], x[2])
  if (norm < 1e-6) throw new Error('pole is parallel to the ICRF pole; the node convention degenerates')
  const xHat = [x[0] / norm, x[1] / norm, x[2] / norm]
  return [xHat, cross(pole, xHat), pole]
}

/**
 * Best-fit uniform rotation rate for a sequence of 2-D vectors `(x, y)`
 * sampled at times `t`.
 *
 * For a fixed rate `w`, the least-squares amplitude and phase of
 * `A * exp(i(phi + w t))` are given by `mean(z_j * exp(-i w t_j))`, and the
 * residual is smallest where `|sum z_j exp(-i w t_j)|` is largest. So the whole
 * fit reduces to maximising that one function of `w`: a periodogram.
 *
 * Sampling is uniform, so the periodogram repeats with period `2*pi/step`; the
 * scan range below is a fifth of that, which is well inside the first period and
 * comfortably wider than the fastest precession here (Mimas's apsidal line, at
 * 0.035 rad/day). The coarse step is finer than the main-lobe width `2*pi/span`,
 * so the coarse scan cannot land in the wrong lobe.
 */
export function fitRotation(days: readonly number[], xs: readonly number[], ys: readonly number[]) {
  const span = days[days.length - 1] - days[0]
  const lobeWidth = (2 * Math.PI) / span
  const power = (w: number) => {
    let re = 0
    let im = 0
    for (let i = 0; i < days.length; i++) {
      const phase = w * days[i]
      const c = Math.cos(phase)
      const s = Math.sin(phase)
      re += xs[i] * c + ys[i] * s
      im += ys[i] * c - xs[i] * s
    }
    return re * re + im * im
  }
  const range = 0.05
  const coarse = lobeWidth / 4
  let best = -range
  let bestPower = -Infinity
  for (let w = -range; w <= range; w += coarse) {
    const p = power(w)
    if (p > bestPower) {
      bestPower = p
      best = w
    }
  }
  // Golden-section refinement inside the winning lobe.
  const phi = (Math.sqrt(5) - 1) / 2
  let lo = best - coarse
  let hi = best + coarse
  let c = hi - phi * (hi - lo)
  let d = lo + phi * (hi - lo)
  for (let i = 0; i < 120; i++) {
    if (power(c) > power(d)) {
      hi = d
      d = c
      c = hi - phi * (hi - lo)
    } else {
      lo = c
      c = d
      d = lo + phi * (hi - lo)
    }
  }
  const rate = (lo + hi) / 2
  let re = 0
  let im = 0
  for (let i = 0; i < days.length; i++) {
    const phase = rate * days[i]
    const cos = Math.cos(phase)
    const sin = Math.sin(phase)
    re += xs[i] * cos + ys[i] * sin
    im += ys[i] * cos - xs[i] * sin
  }
  re /= days.length
  im /= days.length
  return { rate, amplitude: Math.hypot(re, im), phaseAtEpoch: Math.atan2(im, re) }
}
