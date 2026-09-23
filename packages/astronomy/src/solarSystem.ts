import { isSceneSatellite, sceneSatelliteStateKm } from './sceneSatellites.js'
import { SCENE_SATELLITE_STATES } from './data/sceneSatelliteStates.data.js'
import {
  BODIES,
  PLANET_IDS,
  bodyData,
  moonsOf,
  systemGravitationalParameterKm3PerS2,
  type BodyId,
  type PlanetId,
} from './bodies.js'
import { moonGeocentricKm } from './elp2000.js'
import {
  FRAME_CAPTURE_RADIUS_MULTIPLIER,
  FRAME_EXIT_BALL_UNITS,
  type Frame,
} from './frames.js'
import { satelliteApoapsisKm, satellitePositionKm, type SatelliteId } from './satellites.js'
import { M_PER_AU, M_PER_KM, M_PER_PC } from './units.js'
import { systemBarycentreHeliocentricAu, type Vsop87BodyKey } from './vsop87.js'
import { ZERO, type Vec3 } from './vec3.js'

/**
 * The unit ladder every solar-system frame draws from. Decades of a thousand up
 * to the astronomical unit, then the parsec so the tree can be grafted under a
 * galactic frame later.
 *
 * A ladder rather than a per-body choice, because `FrameTree.add` requires each
 * child's unit to be strictly finer than its parent's: with free choice, two
 * sibling bodies of similar size land on units that differ by a factor of 1.4
 * and the next level up has nowhere to go. Rungs a thousand apart give every
 * nesting level room, and make `child.unitM / parent.unitM` exactly 1e-3 or
 * 1e-6, which is what the exit-ball budget below is spent on.
 */
export const FRAME_UNIT_LADDER_M: readonly number[] = [1, 1e3, 1e6, 1e9, M_PER_AU, M_PER_PC]

/**
 * How much bigger a frame's eviction ball must be than its capture ball.
 *
 * `FrameTree.add` only demands a ratio above 1, and Phase 1's lesson was that
 * a body-centred frame in metres is rejected outright. But a frame that merely
 * scrapes past `add` is worse than useless: with `R_out / R_in` near 1 the
 * camera sits in a band where a metre of motion flips the anchor, and the
 * anchoring rule's keep-what-you-have tie-break has nothing to keep. Twenty is
 * the smallest round number that leaves a real band — for Mimas, the tightest
 * body here, it is capture at 398 km and eviction at 1000 Mm.
 */
export const FRAME_EVICTION_TO_CAPTURE_RATIO = 20

/**
 * THE UNIT RULE, applied bottom-up and to every frame without exception.
 *
 * `unitM` is the smallest rung of `FRAME_UNIT_LADDER_M` that satisfies all of:
 *
 *   (a) `FRAME_EVICTION_TO_CAPTURE_RATIO * C * radiusM <= FRAME_EXIT_BALL_UNITS * u`
 *       — the body is capturable from its own surface with room to spare. This
 *       is the constraint that rejects Earth-in-metres, and the reason the
 *       ratio is not left at the 1 that `add` would accept.
 *   (b) `2 * maxChildOffsetM <= FRAME_EXIT_BALL_UNITS * u`
 *       — every child's apoapsis is inside half this frame's eviction ball, so
 *       the exit-ball containment `add` checks passes with margin rather than
 *       by a hair.
 *   (c) strictly coarser than every child's unit, which `add` requires.
 *
 * Applied to the solar system it gives: metres for Phobos and Deimos,
 * kilometres for every other moon and for Mercury, Venus and Mars, megametres
 * for Earth and the giants, gigametres for the outer planets' system
 * barycentres, the astronomical unit for the Sun, and the parsec for the SSB.
 * Nothing about that list is hand-chosen.
 */
export const chooseFrameUnitM = (
  radiusM: number,
  maxChildOffsetM: number,
  childUnitsM: readonly number[],
): number => {
  const fromRadius = (FRAME_EVICTION_TO_CAPTURE_RATIO * FRAME_CAPTURE_RADIUS_MULTIPLIER * radiusM) / FRAME_EXIT_BALL_UNITS
  const fromChildren = (2 * maxChildOffsetM) / FRAME_EXIT_BALL_UNITS
  const finestChild = childUnitsM.length ? Math.max(...childUnitsM) : 0
  const minimum = Math.max(fromRadius, fromChildren)
  for (const rung of FRAME_UNIT_LADDER_M) {
    if (rung >= minimum && rung > finestChild) return rung
  }
  throw new Error(
    `no unit on the ladder satisfies radiusM=${radiusM}, maxChildOffsetM=${maxChildOffsetM}, childUnitsM=[${childUnitsM}]`,
  )
}

/**
 * Aphelion of each planetary system barycentre, in au, rounded UP from the NASA
 * planetary fact sheets. `maxOffsetInParent` has to be a supremum over all
 * epochs rather than a sample, so these are the published aphelion distances
 * with a one-percent margin — which covers the fact sheets' own rounding, the
 * truncation of the series, and the drift of the orbital elements over the
 * validity window with a factor of several to spare.
 *
 * `solarSystem.test.ts` samples the series across 1900-2100 and asserts every
 * declared bound really is a bound. That test is the reason the margin can be
 * small enough to still be a useful number.
 */
const APHELION_AU: Record<Vsop87BodyKey, number> = {
  mercury: 0.4667,
  venus: 0.7282,
  emb: 1.0167,
  mars: 1.666,
  jupiter: 5.4588,
  saturn: 10.1238,
  uranus: 20.0965,
  neptune: 30.33,
}
const APHELION_MARGIN = 1.01

/**
 * Supremum of the Moon's geocentric distance, in km. The largest lunar apogee
 * in the 1900-2100 window is about 406 720 km; 410 000 km covers it, the
 * truncation bound, and any drift, and is asserted by sampling in
 * `solarSystem.test.ts`.
 */
export const MOON_MAX_GEOCENTRIC_KM = 410000

const PLANET_TO_VSOP: Record<PlanetId, Vsop87BodyKey> = {
  mercury: 'mercury',
  venus: 'venus',
  earth: 'emb',
  mars: 'mars',
  jupiter: 'jupiter',
  saturn: 'saturn',
  uranus: 'uranus',
  neptune: 'neptune',
}

/** Frame id of a planet's system-barycentre frame. */
export const systemBarycentreFrameId = (planet: PlanetId): string => `${planet}Barycentre`

export const SSB_FRAME_ID = 'ssb'
export const SUN_FRAME_ID = 'sun'

/**
 * Position of a planet's centre relative to its system barycentre, in km, ICRF.
 *
 * VSOP87 places the barycentre of each planet-plus-moons system, not the planet
 * — that is what the theory integrates. Subtracting the moons' mass-weighted
 * offsets recovers the planet. For Earth this is 4671 km, two thirds of a
 * planetary radius and utterly not optional; for Jupiter it is at most 227 km
 * and well under the series' own truncation bound, but it costs nothing and it
 * means "planet" means the same thing everywhere in this package.
 */
export const planetOffsetFromSystemBarycentreKm = (planet: PlanetId, epochJdTt: number): Vec3 => {
  const moons = moonsOf(planet)
  if (moons.length === 0) return ZERO
  const systemGm = systemGravitationalParameterKm3PerS2(planet)
  let x = 0
  let y = 0
  let z = 0
  for (const moon of moons) {
    const weight = bodyData(moon).gravitationalParameterKm3PerS2 / systemGm
    const position = moonPositionRelativeToParentKm(moon, epochJdTt)
    x -= weight * position[0]
    y -= weight * position[1]
    z -= weight * position[2]
  }
  return [x, y, z]
}

/** Position of a moon relative to its parent's centre, km, ICRF. */
export const moonPositionRelativeToParentKm = (moon: BodyId, epochJdTt: number): Vec3 =>
  moon === 'moon' ? moonGeocentricKm(epochJdTt) : isSceneSatellite(moon)
    ? sceneSatelliteStateKm(moon, epochJdTt).positionKm : satellitePositionKm(moon as SatelliteId, epochJdTt)

/** Bound on `|moonPositionRelativeToParentKm|`, km. Exact for the Kepler moons; declared for the Moon. */
export const moonApoapsisKm = (moon: BodyId): number =>
  moon === 'moon' ? MOON_MAX_GEOCENTRIC_KM : isSceneSatellite(moon)
    ? Math.hypot(...SCENE_SATELLITE_STATES[moon].positionKm) : satelliteApoapsisKm(moon as SatelliteId)

/** Bound on `|planetOffsetFromSystemBarycentreKm|`, km, by the triangle inequality. */
export const planetOffsetBoundKm = (planet: PlanetId): number => {
  const systemGm = systemGravitationalParameterKm3PerS2(planet)
  return moonsOf(planet).reduce(
    (sum, moon) => sum + (bodyData(moon).gravitationalParameterKm3PerS2 / systemGm) * moonApoapsisKm(moon),
    0,
  )
}

const SOLAR_SYSTEM_GM = PLANET_IDS.reduce(
  (sum, planet) => sum + systemGravitationalParameterKm3PerS2(planet),
  BODIES.sun.gravitationalParameterKm3PerS2,
)

/**
 * Position of the Sun relative to the solar-system barycentre, in au, ICRF.
 *
 * Derived from the planets rather than from a separate series: the barycentre
 * is by definition the mass-weighted mean, so `r_sun = -sum(m_i/M) r_i` with the
 * `r_i` the heliocentric system barycentres VSOP87A already gives. VSOP87E
 * publishes a barycentric Sun series, but it is another 885 KB of coefficients
 * to say something the masses already say.
 *
 * What it leaves out is everything not among the eight planets: Pluto, Ceres
 * and the rest of the asteroid belt together move the barycentre by well under
 * 100 km, against a Sun-to-barycentre distance that reaches 1.5 million.
 */
export const sunBarycentricAu = (epochJdTt: number): Vec3 => {
  let x = 0
  let y = 0
  let z = 0
  for (const planet of PLANET_IDS) {
    const weight = systemGravitationalParameterKm3PerS2(planet) / SOLAR_SYSTEM_GM
    const position = systemBarycentreHeliocentricAu(PLANET_TO_VSOP[planet], epochJdTt)
    x -= weight * position[0]
    y -= weight * position[1]
    z -= weight * position[2]
  }
  return [x, y, z]
}

/** Bound on `|sunBarycentricAu|`, au, by the triangle inequality over the same sum. */
export const sunBarycentricBoundAu = PLANET_IDS.reduce(
  (sum, planet) =>
    sum +
    (systemGravitationalParameterKm3PerS2(planet) / SOLAR_SYSTEM_GM) * APHELION_AU[PLANET_TO_VSOP[planet]] * APHELION_MARGIN,
  0,
)

export interface SolarSystemFrameSpec {
  readonly frame: Frame
  /** Body this frame is centred on, or `null` for a barycentre. */
  readonly body: BodyId | null
}

/**
 * Every solar-system frame, in an order `FrameTree.add` accepts (parents first).
 *
 *   ssb -> sun -> <planet>Barycentre -> <planet> -> <moon>
 *
 * The barycentre level is not decoration. VSOP87 gives system barycentres; the
 * planet sits a few hundred kilometres away from its own, and 4671 km in
 * Earth's case. Collapsing the two would either put Earth in the wrong place or
 * make "planet" mean "barycentre" for Earth and "planet" everywhere else.
 *
 * Pass `parentFrameId` to graft the whole thing under a coarser frame — a
 * galactic frame in Phase 4. The SSB's unit is the parsec, so the parent must
 * be coarser than that.
 */
export const solarSystemFrameSpecs = (parentFrameId: string | null = null): readonly SolarSystemFrameSpec[] => {
  const specs: SolarSystemFrameSpec[] = []

  const moonUnits = new Map<BodyId, number>()
  const planetUnits = new Map<PlanetId, number>()
  const barycentreUnits = new Map<PlanetId, number>()

  for (const planet of PLANET_IDS) {
    const moons = moonsOf(planet)
    for (const moon of moons) moonUnits.set(moon, chooseFrameUnitM(bodyData(moon).meanRadiusKm * M_PER_KM, 0, []))
    const maxMoonOffsetM = moons.reduce((max, moon) => Math.max(max, moonApoapsisKm(moon) * M_PER_KM), 0)
    const planetUnit = chooseFrameUnitM(
      bodyData(planet).meanRadiusKm * M_PER_KM,
      maxMoonOffsetM,
      moons.map((moon) => moonUnits.get(moon)!),
    )
    planetUnits.set(planet, planetUnit)
    barycentreUnits.set(planet, chooseFrameUnitM(0, planetOffsetBoundKm(planet) * M_PER_KM, [planetUnit]))
  }

  const maxBarycentreOffsetM = PLANET_IDS.reduce(
    (max, planet) => Math.max(max, APHELION_AU[PLANET_TO_VSOP[planet]] * APHELION_MARGIN * M_PER_AU),
    0,
  )
  const sunUnit = chooseFrameUnitM(BODIES.sun.meanRadiusKm * M_PER_KM, maxBarycentreOffsetM, [...barycentreUnits.values()])
  const ssbUnit = chooseFrameUnitM(0, sunBarycentricBoundAu * M_PER_AU, [sunUnit])

  specs.push({
    body: null,
    frame: {
      id: SSB_FRAME_ID,
      parent: parentFrameId,
      unitM: ssbUnit,
      radiusM: 0,
      maxOffsetInParent: 0,
      originInParent: () => ZERO,
    },
  })

  const auPerSsbUnit = M_PER_AU / ssbUnit
  specs.push({
    body: 'sun',
    frame: {
      id: SUN_FRAME_ID,
      parent: SSB_FRAME_ID,
      unitM: sunUnit,
      radiusM: BODIES.sun.meanRadiusKm * M_PER_KM,
      maxOffsetInParent: sunBarycentricBoundAu * auPerSsbUnit,
      originInParent: (epochJdTt) => {
        const au = sunBarycentricAu(epochJdTt)
        return [au[0] * auPerSsbUnit, au[1] * auPerSsbUnit, au[2] * auPerSsbUnit]
      },
    },
  })

  for (const planet of PLANET_IDS) {
    const vsopKey = PLANET_TO_VSOP[planet]
    const barycentreId = systemBarycentreFrameId(planet)
    const barycentreUnit = barycentreUnits.get(planet)!
    const planetUnit = planetUnits.get(planet)!

    // The Sun's unit is the au, so a heliocentric position in au needs no scaling.
    specs.push({
      body: null,
      frame: {
        id: barycentreId,
        parent: SUN_FRAME_ID,
        unitM: barycentreUnit,
        radiusM: 0,
        maxOffsetInParent: APHELION_AU[vsopKey] * APHELION_MARGIN,
        originInParent: (epochJdTt) => systemBarycentreHeliocentricAu(vsopKey, epochJdTt),
      },
    })

    const kmPerBarycentreUnit = M_PER_KM / barycentreUnit
    specs.push({
      body: planet,
      frame: {
        id: planet,
        parent: barycentreId,
        unitM: planetUnit,
        radiusM: bodyData(planet).meanRadiusKm * M_PER_KM,
        maxOffsetInParent: planetOffsetBoundKm(planet) * kmPerBarycentreUnit,
        originInParent: (epochJdTt) => {
          const km = planetOffsetFromSystemBarycentreKm(planet, epochJdTt)
          return [km[0] * kmPerBarycentreUnit, km[1] * kmPerBarycentreUnit, km[2] * kmPerBarycentreUnit]
        },
      },
    })

    const kmPerPlanetUnit = M_PER_KM / planetUnit
    for (const moon of moonsOf(planet)) {
      specs.push({
        body: moon,
        frame: {
          id: moon,
          parent: planet,
          unitM: moonUnits.get(moon)!,
          radiusM: bodyData(moon).meanRadiusKm * M_PER_KM,
          maxOffsetInParent: moonApoapsisKm(moon) * kmPerPlanetUnit,
          originInParent: (epochJdTt) => {
            const km = moonPositionRelativeToParentKm(moon, epochJdTt)
            return [km[0] * kmPerPlanetUnit, km[1] * kmPerPlanetUnit, km[2] * kmPerPlanetUnit]
          },
        },
      })
    }
  }

  return specs
}

/** The frames alone, ready to hand to `FrameTree.add` in order. */
export const solarSystemFrames = (parentFrameId: string | null = null): readonly Frame[] =>
  solarSystemFrameSpecs(parentFrameId).map((spec) => spec.frame)
