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
    // The six radar additions measure endpoint maxima of 1944.06, 175.07,
    // 243.37, 132.46, 707.11 and 307.55 km respectively for Geographos,
    // Bacchus, Mithra, Nereus, Golevka and YORP. Bounds round upward with
    // a small regression margin; they do not establish accuracy between dates.
    // The 49 size-calibrated additions use ceil(measured endpoint maximum * 1.05) km:
    // a 5% regression margin plus less than 1 km upward rounding. These two
    // dates do not establish intervening-date accuracy. Exact errors and fixture
    // hashes are recorded in output/asteroids-wikipedia/orbit-errors.json.
    const maximumErrorKm = {vesta: 300, eros: 200, itokawa: 400, bennu: 200, ryugu: 200, ida: 2000, gaspra: 850, mathilde: 230, lutetia: 200, steins: 220, didymos: 140, kleopatra: 250, toutatis: 340, pallas: 285, hygiea: 4000, juno: 240, psyche: 3300,
      interamnia: 300, davida: 550, sylvia: 6300, eunomia: 350, euphrosyne: 350, bamberga: 150, fortuna: 350, themis: 300, amphitrite: 250, egeria: 250, elektra: 2350, iris: 450, hebe: 1450, eugenia: 2450, daphne: 350, eleonora: 300, nemesis: 250, kalliope: 700, nemausa: 250, parthenope: 400, melpomene: 200, julia: 900, victoria: 2000, urania: 750,
      'flora': 200, 'europa-52': 2300, 'metis-9': 250, 'camilla': 3900, 'thisbe': 450, 'doris': 300, 'hermione': 300, 'diotima': 2000, 'herculina': 350, 'nausikaa': 250, 'astraea': 300, 'irene': 250, 'nysa': 450, 'sappho': 1700,
      'betulia': 390, 'castalia': 160, 'asteroid-1998-wt24': 530, 'asteroid-1994-cc': 330,
      'fides': 260, 'penelope': 1500, 'alphonsina': 1920, 'angelina': 320, 'ganymed': 1320, 'moshup': 230,
      'cybele': 400, 'aurora': 3150, 'palma': 350, 'thule': 350, 'hektor': 550, 'hekate': 250, 'phaethon': 400, 'harmonia': 950, 'panopaea': 200, 'desdemona-666': 1400, 'asteroid-1950-da': 350, 'apophis': 200, 'donaldjohanson': 250,
      geographos: 2000, bacchus: 190, mithra: 260, nereus: 145, golevka: 750, yorp: 330,
      'asteroid-1996-hw1': 845, 'asteroid-2008-ev5': 230, 'ra-shalom': 265, 'asteroid-1992-sk': 495, 'asteroid-1998-ml14': 1020, 'asteroid-2002-ce26': 360,
      massalia: 243, proserpina: 218, polyhymnia: 2233, leukothea: 278, virginia: 1154, echo: 244, maja: 233,
      dike: 314, juewa: 265, bertha: 250, lucia: 1354, brucia: 231, badenia: 1801, ducrosa: 626,
      gyptis: 1115, petrina: 1503, veritas: 260, gryphia: 306, selinur: 602, achilles: 432, musa: 1682,
      auravictrix: 251, transvaalia: 241, moskva: 2173, kressmannia: 103, parysatis: 271, rosalinde: 259, susi: 222,
      hidalgo: 467, zachia: 3018, piazzia: 327, tulipa: 251, reinmuthia: 263, china: 309, crimea: 751,
      rusthawelia: 328, schorria: 272, silvretta: 263, virtanen: 568, 'mr-spock': 1297, educatio: 320, hopi: 2074,
      schaber: 2811, iau: 267, 'united-nations': 2239, tartaglia: 281, raup: 144, 'asteroid-2001-qw16': 2946, 'asteroid-1999-fr33': 236, patroclus: 8332}
    for (const id of ASTEROID_IDS) for (const row of [ASTEROID_FIXTURES[id].rows[0], ASTEROID_FIXTURES[id].rows[2]]) {
      const actual = asteroidPositionKm(id, row.jd)
      expect(Math.hypot(...actual.map((v, i) => v - row.position[i]!))).toBeLessThan(maximumErrorKm[id])
    }
  })
})
