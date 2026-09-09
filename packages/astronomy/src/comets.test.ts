import { describe, expect, it } from 'vitest'
import { cometElements, cometPositionKm } from './comets.js'
import { COMET_FIXTURES } from './__fixtures__/horizons.comets.js'
import { COMET_IDS } from './bodies.js'

describe('comet positions against independent JPL Horizons vectors', () => {
  it('reproduces the prepared epoch in heliocentric ICRF kilometers', () => {
    for (const id of COMET_IDS) {
      const epoch = cometElements(id).epochJdTt
      const row = COMET_FIXTURES[id].rows.find(row => row.jd === epoch)!
      const actual = cometPositionKm(id, epoch)
      expect(Math.hypot(...actual.map((v, i) => v - row.position[i]!))).toBeLessThan(0.001)
    }
  })
  // +/-30-day conics are only a placement approximation: 10,000 km accuracy budget.
  // Observed maxima: 67P 329.06 km; 103P 390.29 km; 9P 5181.10 km;
  // 81P 480.81 km; 1P 557.99 km; 8P 437.44 km.
  // The per-body regression guards add approximately 15% headroom.
  const regressionGuardKm = { 'comet-67p': 380, 'comet-103p': 450, 'comet-9p': 6000, 'comet-81p': 555, 'comet-1p': 642, 'comet-8p': 505 }
  it('bounds nearby conic error without claiming a perturbation or outgassing model', () => {
    for (const id of COMET_IDS) for (const row of [COMET_FIXTURES[id].rows[0], COMET_FIXTURES[id].rows[2]]) {
      const actual = cometPositionKm(id, row.jd)
      const errorKm = Math.hypot(...actual.map((v, i) => v - row.position[i]!))
      expect(errorKm).toBeLessThan(10000)
      expect(errorKm).toBeLessThan(regressionGuardKm[id])
    }
  })
})
