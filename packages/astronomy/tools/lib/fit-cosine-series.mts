/** Truncated DCT-I of uniformly sampled scalar residuals. The even periodic
 * extension is a bounded approximation, not a dynamical theory. There is no
 * extrapolation or velocity-accuracy claim at the fit-window boundaries. */
export function fitCosineSeries(days: readonly number[], values: readonly number[], count: number) {
  const n = days.length - 1, span = days[n] - days[0], step = span / n
  if (values.length !== days.length || !(span > 0) || !Number.isInteger(count) || count < 1 || count >= n ||
      days.some((d, i) => !Number.isFinite(d) || Math.abs(d - days[0] - i * step) > 1e-7) ||
      values.some(v => !Number.isFinite(v))) throw new TypeError('Cosine fit requires finite, uniform samples and fewer terms than intervals')
  const coefficient = (k: number) => {
    let sum = .5 * (values[0] + (k % 2 ? -1 : 1) * values[n])
    for (let j = 1; j < n; j++) sum += values[j] * Math.cos(Math.PI * k * j / n)
    return 2 * sum / n
  }
  const epochJdTt = 2451545 + (days[0] + days[n]) / 2
  return { intercept: coefficient(0) / 2, slope: 0,
    harmonics: Array.from({ length: count }, (_, index) => {
      const k = index + 1, amplitude = coefficient(k)
      // Shift the DCT's start-of-window cosine to the common midpoint epoch.
      const phase = k * Math.PI / 2
      return { rateRadPerDay: k * Math.PI / span, cosine: amplitude * Math.cos(phase),
        sine: -amplitude * Math.sin(phase), epochJdTt }
    }) }
}
