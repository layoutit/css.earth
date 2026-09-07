import { describe, expect, it } from 'vitest'
import { asteroidElements, asteroidPositionKm } from './asteroids.js'
import { ASTEROID_FIXTURES } from './__fixtures__/horizons.asteroids.js'

describe('asteroid positions against JPL Horizons', () => {
  it('reproduces the fitted epoch in ICRF kilometers', () => {
    const epoch = asteroidElements('vesta').epochJdTt
    const row = ASTEROID_FIXTURES.vesta.rows.find(row => row.jd === epoch)!
    const actual = asteroidPositionKm('vesta', epoch)
    expect(Math.hypot(...actual.map((v, i) => v - row.position[i]!))).toBeLessThan(0.001)
  })
  it('bounds the measured propagation error at the two independent nearby dates', () => {
    // Measured errors: 219.1 and 243.6 km, thirty days either side of the
    // epoch. This conic is not a long-term perturbation theory.
    for (const row of [ASTEROID_FIXTURES.vesta.rows[0], ASTEROID_FIXTURES.vesta.rows[2]]) {
      const actual = asteroidPositionKm('vesta', row.jd)
      expect(Math.hypot(...actual.map((v, i) => v - row.position[i]!))).toBeLessThan(300)
    }
  })
})
