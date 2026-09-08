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
    // The added main-belt fits measure 1926 km (Ida), 807 km (Gaspra),
    // and 214 km (Mathilde) at the independent endpoints; the fitted epoch
    // remains within 2 mm. These are measured short-term propagation limits.
    // New fits measured 266, 3796, 225 and 3093 km respectively for
    // Pallas, Hygiea, Juno and Psyche at the two independent endpoints.
    const maximumErrorKm = {vesta: 300, eros: 200, itokawa: 400, bennu: 200, ryugu: 200, ida: 2000, gaspra: 850, mathilde: 230, lutetia: 200, steins: 220, didymos: 140, kleopatra: 250, toutatis: 340, pallas: 285, hygiea: 4000, juno: 240, psyche: 3300,
      interamnia: 300, davida: 550, sylvia: 6300, eunomia: 350, euphrosyne: 350, bamberga: 150, fortuna: 350, themis: 300, amphitrite: 250, egeria: 250, elektra: 2350, iris: 450, hebe: 1450, eugenia: 2450, daphne: 350, eleonora: 300, nemesis: 250, kalliope: 700, nemausa: 250, parthenope: 400, melpomene: 200, julia: 900, victoria: 2000, urania: 750,
      'flora': 200, 'europa-52': 2300, 'metis-9': 250, 'camilla': 3900, 'thisbe': 450, 'doris': 300, 'hermione': 300, 'diotima': 2000, 'herculina': 350, 'nausikaa': 250, 'astraea': 300, 'irene': 250, 'nysa': 450, 'sappho': 1700,
      'betulia': 390, 'castalia': 160, 'asteroid-1998-wt24': 530, 'asteroid-1994-cc': 330,
      'fides': 260, 'penelope': 1500, 'alphonsina': 1920, 'angelina': 320, 'ganymed': 1320, 'moshup': 230}
    for (const id of ASTEROID_IDS) for (const row of [ASTEROID_FIXTURES[id].rows[0], ASTEROID_FIXTURES[id].rows[2]]) {
      const actual = asteroidPositionKm(id, row.jd)
      expect(Math.hypot(...actual.map((v, i) => v - row.position[i]!))).toBeLessThan(maximumErrorKm[id])
    }
  })
})
