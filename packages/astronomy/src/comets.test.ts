import { describe, expect, it } from 'vitest'
import { cometElements, cometPositionKm } from './comets.js'
import { COMET_FIXTURES } from './__fixtures__/horizons.comets.js'
import { COMET_IDS } from './bodies.js'

describe('comet positions against independent JPL Horizons vectors', () => {
  // Near-parabolic printed elements amplify their source rounding. Evaluating
  // those same decimal fields at 70-digit precision still leaves Siding Spring
  // 262 m from the vector. Keep explicit source-specific bounds, not a relaxed
  // blanket tolerance or a fitted replacement orbit.
  const roundedElementEpochGuardKm: Partial<Record<(typeof COMET_IDS)[number], number>> = {
    'comet-c1956-r1': 0.007, 'comet-c1973-e1': 0.006,
    'comet-c1996-b2': 0.002, 'comet-c2013-a1': 0.3, 'comet-c2023-a3': 0.002,
  }
  it('reproduces the prepared epoch in heliocentric ICRF kilometers', () => {
    for (const id of COMET_IDS) {
      const epoch = cometElements(id).epochJdTt
      const row = COMET_FIXTURES[id].rows.find(row => row.jd === epoch)!
      const actual = cometPositionKm(id, epoch)
      expect(Math.hypot(...actual.map((v, i) => v - row.position[i]!)), id).toBeLessThan(roundedElementEpochGuardKm[id] ?? 0.001)
    }
  })
  // +/-30-day conics are only a placement approximation: 10,000 km accuracy budget.
  // Observed maxima: 67P 329.06 km; 103P 390.29 km; 9P 5181.10 km;
  // 81P 480.81 km; 1P 557.99 km; 8P 437.44 km; 19P 356.11 km.
  // New maxima: comet-137p: 344.50 km; comet-143p: 1489.08 km; comet-162p: 695.09 km.
  // Encke: 238.63 km; LINEAR: 455.30 km.
  // The per-body regression guards add approximately 15% headroom.
  const regressionGuardKm = {
    'comet-67p': 380, 'comet-103p': 450, 'comet-9p': 6000, 'comet-81p': 555,
    'comet-1p': 642, 'comet-8p': 505, 'comet-19p': 410, 'comet-137p': 397,
    'comet-143p': 1713, 'comet-162p': 800, 'comet-2p': 275, 'comet-209p': 524,
    'comet-17p': 338, 'comet-21p': 1639, 'comet-26p': 537, 'comet-29p': 813,
    'comet-46p': 391, 'comet-55p': 562, 'comet-96p': 413, 'comet-109p': 626,
    'comet-167p': 688, 'comet-153p': 600, 'comet-c1983-h1': 617,
    'comet-c1956-r1': 616, 'comet-c1973-e1': 620, 'comet-c1995-o1': 609,
    'comet-c1996-b2': 612, 'comet-c2006-p1': 604, 'comet-c2013-a1': 658,
    'comet-c2014-un271': 587, 'comet-c2020-f3': 590, 'comet-c2023-a3': 490,
  }
  it('bounds nearby conic error without claiming a perturbation or outgassing model', () => {
    for (const id of COMET_IDS) for (const row of [COMET_FIXTURES[id].rows[0], COMET_FIXTURES[id].rows[2]]) {
      const actual = cometPositionKm(id, row.jd)
      const errorKm = Math.hypot(...actual.map((v, i) => v - row.position[i]!))
      expect(errorKm).toBeLessThan(10000)
      expect(errorKm, id).toBeLessThan(regressionGuardKm[id])
    }
  })
})
