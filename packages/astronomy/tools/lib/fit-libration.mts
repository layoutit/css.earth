import type { LinearTrend } from './fit-harmonics.mts'
import { fitHarmonics } from './fit-harmonics.mts'

// Slow longitude libration, jointly fitted with its linear trend. No named
// resonance is assumed; frequencies and amplitudes come from the source rows.
export function fitLibration(days: readonly number[], values: readonly number[], line: LinearTrend, count = 3) {
  const fit = fitHarmonics(days, values, line, count)
  return { ...fit, harmonics: fit.harmonics.map(({ cosine, sine, rateRadPerDay, epochJdTt }) => ({
    rateRadPerDay, cosineRad: cosine, sineRad: sine, epochJdTt,
  })) }
}
