import { describe, expect, it } from 'vitest'
import { asteroidElements, asteroidPositionKm } from './asteroids.js'
import { ASTEROID_FIXTURES } from './__fixtures__/horizons.asteroids.js'
import { ASTEROID_IDS } from './bodies.js'

describe('asteroid positions against JPL Horizons', () => {
  it('reproduces the fitted epoch in ICRF kilometers', () => {
    for (const id of ASTEROID_IDS) {
      const epoch = asteroidElements(id).epochJdTt
      const row = ASTEROID_FIXTURES[id].rows.find(row => row.jd === epoch)!
      const actual = asteroidPositionKm(id, epoch)
      expect(Math.hypot(...actual.map((v, i) => v - row.position[i]!))).toBeLessThan(0.001)
    }
  })
  it('bounds the measured propagation error at the two independent nearby dates', () => {
    // Thirty days either side of the epoch. These source-fitted conics are
    // a fixed-date display ephemeris, not long-term perturbation theories.
    const maximumErrorKm = {vesta: 300, eros: 200, itokawa: 400, bennu: 200, ryugu: 200}
    for (const id of ASTEROID_IDS) for (const row of [ASTEROID_FIXTURES[id].rows[0], ASTEROID_FIXTURES[id].rows[2]]) {
      const actual = asteroidPositionKm(id, row.jd)
      expect(Math.hypot(...actual.map((v, i) => v - row.position[i]!))).toBeLessThan(maximumErrorKm[id])
    }
  })
})
