import { describe, expect, it } from 'vitest'
import { distance, magnitude } from './__fixtures__/compare.js'
import { HORIZONS } from './__fixtures__/horizons.js'
import { bodyData } from './bodies.js'
import { periodicCorrectionBoundKm } from './periodicCorrection.js'
import { keplerApoapsisKm, type KeplerianElements } from './kepler.js'
import {
  SATELLITE_IDS,
  satelliteApoapsisKm,
  satelliteLaplaceBasis,
  satellitePositionKm,
  satelliteRecord,
  satelliteStateKm,
  type SatelliteId,
} from './satellites.js'

/**
 * WHAT THIS TEST MEASURES, and what it does not.
 *
 * The moons are not a satellite theory. They are precessing Keplerian ellipses
 * whose elements were fitted to Horizons' own osculating elements over the
 * fit window recorded on each satellite (`tools/generate-satellites.mjs`).
 * So the numbers below are FIT RESIDUALS, not an independent accuracy claim,
 * and the honest reading is:
 * "this is how well a precessing ellipse can do", not "this is how well the
 * propagator works".
 *
 * The test is still worth running, for two reasons. The fixture epochs are NOT
 * the epochs the fit saw — the fit sampled every 30 days from JD 2415020.5, and
 * these are offset by a quarter and three quarters of a day — so a propagator
 * that reproduced the sample points by accident would fail here. And a
 * transcription slip in the Laplace-plane basis, a sign in the rotation, or a
 * wrong element would move these by orders of magnitude, not percent.
 *
 * Tolerance is the measured worst case plus 15 percent, per moon. README.md
 * calls out the moons whose resonant or otherwise non-Keplerian motion this
 * deliberately compact model cannot carry.
 */
const TOLERANCE_KM: Record<SatelliteId, number> = {
  paaliaq: 16890,
  tarvos: 16433,
  ijiraq: 10752,
  suttungr: 6368,
  mundilfari: 12589,
  skathi: 3606,
  erriapus: 12926,
  thrymr: 7277,
  bebhionn: 40458,
  bergelmir: 5027,
  bestla: 15232,
  fornjot: 11340,
  hati: 12443,
  hyrrokkin: 8666,
  loge: 9984,
  skoll: 8245,
  greip: 10379,
  tarqeq: 5575,
  caliban: 220,
  sycorax: 861,
  prospero: 825,
  setebos: 2873,
  kiviuq: 32368,
  albiorix: 21245,

  siarnaq: 322409,
  ymir: 185535,
  nereid: 11980,
  himalia: 63205,
  polydeuces: 1081,
  anthe: 2334,
  aegaeon: 353,
  bianca: 72,
  cressida: 36,
  desdemona: 115,
  rosalind: 105,
  phobos: 1610,
  deimos: 130,
  io: 351,
  europa: 1092,
  ganymede: 3674,
  callisto: 5093,
  amalthea: 1458,
  thebe: 610,
  adrastea: 1119,
  metis: 1089,
  mimas: 165300,
  enceladus: 2204,
  tethys: 13860,
  dione: 486,
  rhea: 481,
  titan: 2257,
  hyperion: 202000,
  iapetus: 68570,
  phoebe: 738000,
  janus: 131000,
  epimetheus: 343000,
  helene: 91937,
  calypso: 20580,
  daphnis: 1299,
  telesto: 19800,
  atlas: 8700,
  prometheus: 2000,
  pandora: 3000,
  pan: 8,
  miranda: 3810,
  ariel: 1016,
  umbriel: 667,
  titania: 2771,
  oberon: 1587,
  triton: 56642,
  proteus: 787,
  larissa: 543,
  naiad: 274,
  thalassa: 121,
  despina: 73,
  galatea: 63,
  charon: 2,
  nix: 109,
  hydra: 55,
  kerberos: 144,
  styx: 447,
  puck: 54,
  methone: 20138,
  pallene: 32,
  belinda: 33,
  juliet: 138,
  portia: 107,
  cordelia: 1,
  ophelia: 3,
  dimorphos: .06,
  // Irregular moons added 2026-09-21: ceil(measured worst case * 1.15), measured against the six out-of-sample Horizons rows.
  elara: 25135,
  pasiphae: 37471,
  sinope: 36580,
  lysithea: 19032,
  carme: 13612,
  ananke: 38438,
  leda: 24100,
  halimede: 327,
  psamathe: 3512,
  sao: 364,
  laomedeia: 875,
  neso: 9756,
  stephano: 295,
  trinculo: 393,
  francisco: 119,
  margaret: 17613,
  ferdinand: 848,
  callirrhoe: 118720,
  themisto: 95600,
  megaclite: 63672,
  taygete: 26586,
  chaldene: 31054,
  harpalyke: 15192,
  kalyke: 29635,
  iocaste: 40767,
  erinome: 26992,
  isonoe: 14925,
  praxidike: 71006,
  autonoe: 61811,
}

describe('satellite ephemerides against JPL Horizons', () => {
  it.each(SATELLITE_IDS)('places %s within its fit residual at epochs the fit never saw', (id) => {
    const fixture = HORIZONS[`${id}FromParent`]!
    expect(fixture.rows.length).toBe(6)
    let worst = 0
    for (const row of fixture.rows) {
      worst = Math.max(worst, distance(satellitePositionKm(id, row.jdTdb), row.positionKm))
    }
    expect(worst).toBeLessThan(TOLERANCE_KM[id])
  })

  it('records the current-era fit window and denser cadence for the fast and resonant added Saturn moons', () => {
    const currentEra = ['hyperion', 'janus', 'epimetheus', 'atlas', 'prometheus', 'pandora'] as const
    for (const id of currentEra) {
      const record = satelliteRecord(id)
      expect([record.fitFromJdTdb, record.fitToJdTdb, record.fitStepDays]).toEqual([2458849.5, 2463232.5, 5])
    }
    for (const id of ['phoebe', 'telesto'] as const) {
      const record = satelliteRecord(id)
      expect([record.fitFromJdTdb, record.fitToJdTdb, record.fitStepDays]).toEqual([2415020.5, 2488069.5, 30])
    }
    const pan = satelliteRecord('pan')
    expect([pan.fitFromJdTdb, pan.fitToJdTdb, pan.fitStepDays]).toEqual([2433282.5, 2469807.5, 5])
  })

  it.each(SATELLITE_IDS)('checks %s only against independent vectors inside its source fit window', (id) => {
    const record = satelliteRecord(id)
    for (const row of HORIZONS[`${id}FromParent`]!.rows) {
      expect(row.jdTdb).toBeGreaterThan(record.fitFromJdTdb)
      expect(row.jdTdb).toBeLessThan(record.fitToJdTdb)
      expect((row.jdTdb - record.fitFromJdTdb) % record.fitStepDays).not.toBe(0)
    }
  })

  it.each(SATELLITE_IDS)('gets %s to the right distance from its planet, not just the right direction', (id) => {
    // Separated out because a wrong Laplace basis moves the direction and
    // leaves the radius alone, while a wrong semi-major axis does the reverse.
    const fixture = HORIZONS[`${id}FromParent`]!
    for (const row of fixture.rows) {
      const computed = magnitude(satellitePositionKm(id, row.jdTdb))
      const reference = magnitude(row.positionKm)
      // The post-impact Dimorphos fit measures a 3.135% radial residual.
      // Himalia's corrected fit is back inside the common 2% guard.
      const radialTolerance = ({ dimorphos: 0.033 } as Partial<Record<SatelliteId, number>>)[id] ?? 0.02
      expect(Math.abs(computed - reference) / reference).toBeLessThan(radialTolerance)
    }
  })

  it.each(SATELLITE_IDS)('bounds %s relative to its physical parent over a hundred orbits', (id) => {
    const record = satelliteRecord(id)
    const elements = record.elements as KeplerianElements
    const bound = satelliteApoapsisKm(id)
    const companion = record.barycentreCompanion && bodyData(record.barycentreCompanion as SatelliteId)
    const weight = companion ? companion.gravitationalParameterKm3PerS2 /
      (companion.gravitationalParameterKm3PerS2 + bodyData(record.parent as 'pluto').gravitationalParameterKm3PerS2) : 0
    expect(bound).toBe(keplerApoapsisKm(elements) +
      (record.positionCorrection ? periodicCorrectionBoundKm(record.positionCorrection) : 0) +
      (companion ? satelliteApoapsisKm(companion.id as SatelliteId) * weight : 0))
    const period = (2 * Math.PI) / elements.meanMotionRadPerDay
    let farthest = 0
    for (let i = 0; i <= 5000; i++) {
      farthest = Math.max(farthest, magnitude(satellitePositionKm(id, 2451545 + (i * period * 100) / 5000)))
    }
    expect(farthest).toBeLessThanOrEqual(bound)
  })

  it('builds an orthonormal Laplace basis for every moon', () => {
    for (const id of SATELLITE_IDS) {
      const { nodeAxis, completingAxis, poleAxis } = satelliteLaplaceBasis(satelliteRecord(id))
      for (const axis of [nodeAxis, completingAxis, poleAxis]) expect(magnitude(axis)).toBeCloseTo(1, 12)
      const dot = (a: readonly number[], b: readonly number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!
      expect(dot(nodeAxis, completingAxis)).toBeCloseTo(0, 12)
      expect(dot(nodeAxis, poleAxis)).toBeCloseTo(0, 12)
      expect(dot(completingAxis, poleAxis)).toBeCloseTo(0, 12)
      // Right-handed: node x completing = pole.
      const cross = [
        nodeAxis[1] * completingAxis[2] - nodeAxis[2] * completingAxis[1],
        nodeAxis[2] * completingAxis[0] - nodeAxis[0] * completingAxis[2],
        nodeAxis[0] * completingAxis[1] - nodeAxis[1] * completingAxis[0],
      ]
      expect(distance(cross, poleAxis)).toBeLessThan(1e-12)
    }
  })

  it('matches its own numerical velocity', () => {
    // A thousandth of a day. Smaller and the five-point stencil is dominated by
    // its own cancellation; larger and by its O(h^4) truncation against
    // Phobos's 7.65-hour period. This is the test that caught `keplerStateKm`
    // ignoring the precession rates.
    const h = 1 / 1024
    for (const id of SATELLITE_IDS) for (const epoch of [2451545, 2461286.5]) {
      const at = (offset: number) => satellitePositionKm(id, epoch + offset)
      const numeric = [0, 1, 2].map(
        (i) => (-at(2 * h)[i]! + 8 * at(h)[i]! - 8 * at(-h)[i]! + at(-2 * h)[i]!) / (12 * h),
      )
      const analytic = satelliteStateKm(id, epoch).velocityKmPerDay
      expect(distance(numeric, analytic) / magnitude(analytic)).toBeLessThan(1e-8)
    }
  })

  it('agrees with the body table about which planet each moon orbits', () => {
    for (const id of SATELLITE_IDS) {
      expect(satelliteRecord(id).parent).toBe(bodyData(id).parent)
    }
  })

  it('rejects an unknown satellite', () => {
    expect(() => satellitePositionKm('missing' as SatelliteId, 2451545)).toThrow(/unknown satellite/)
  })
})
