import { bodyData, moonsOf, DWARF_PLANET_IDS, type DwarfPlanetId } from './bodies.js'
import { DWARF_PLANET_ELEMENTS } from './data/dwarfPlanetElements.data.js'
import type { Frame } from './frames.js'
import { keplerApoapsisKm, keplerPositionKm, type KeplerianElements } from './kepler.js'
import { chooseFrameUnitM, moonApoapsisKm, moonPositionRelativeToParentKm, SUN_FRAME_ID, type SolarSystemFrameSpec } from './solarSystem.js'
import { isSceneSatellite } from './sceneSatellites.js'
import { M_PER_AU, M_PER_KM } from './units.js'
import type { Vec3 } from './vec3.js'

/**
 * Osculating elements for the five dwarf planets, ICRF equatorial, single
 * epoch — see `data/dwarfPlanetElements.data.ts`'s header for the source, the
 * epoch, and why there is no fitted precession rate the way there is for the
 * moons in `satellites.ts`.
 */
export const dwarfPlanetElements = (id: DwarfPlanetId): KeplerianElements => DWARF_PLANET_ELEMENTS[id].elements

/**
 * Heliocentric position, km, ICRF — no rotation to ICRF is needed here, unlike
 * `satellites.ts`'s `satellitePositionKm`, because the elements were fetched
 * with `REF_PLANE='FRAME'` and are ICRF-referred already.
 */
export const dwarfPlanetPositionKm = (id: DwarfPlanetId, epochJdTt: number): Vec3 =>
  keplerPositionKm(dwarfPlanetElements(id), epochJdTt)

/** `a(1 + e)` — the exact bound the body's frame `maxOffsetInParent` needs. */
export const dwarfPlanetApoapsisKm = (id: DwarfPlanetId): number => keplerApoapsisKm(dwarfPlanetElements(id))

/** Dwarf-planet centre elements are heliocentric (not system barycentres).
 * Their satellites use parent-relative fitted ellipses, with frame units
 * derived from the same containment rule as every other satellite system.
 * Scene-only satellites are excluded: they have neither a propagated state
 * nor necessarily the same parent ephemeris as this time-domain frame tree.
 * Their explicit scene-state API retains the matching primary state instead.
 */
export const dwarfPlanetFrameSpecs = (): readonly SolarSystemFrameSpec[] =>
  DWARF_PLANET_IDS.flatMap((id) => {
    const radiusM = bodyData(id).meanRadiusKm * M_PER_KM
    const moons = moonsOf(id).filter(moon => !isSceneSatellite(moon))
    const childUnits = moons.map(moon => chooseFrameUnitM(bodyData(moon).meanRadiusKm * M_PER_KM, 0, []))
    const maxChildOffsetM = Math.max(0, ...moons.map(moon => moonApoapsisKm(moon) * M_PER_KM))
    const unitM = chooseFrameUnitM(radiusM, maxChildOffsetM, childUnits)
    const kmPerAu = M_PER_AU / M_PER_KM
    const frame: Frame = {
      id,
      parent: SUN_FRAME_ID,
      unitM,
      radiusM,
      maxOffsetInParent: dwarfPlanetApoapsisKm(id) / kmPerAu,
      originInParent: (epochJdTt) => {
        const km = dwarfPlanetPositionKm(id, epochJdTt)
        return [km[0] / kmPerAu, km[1] / kmPerAu, km[2] / kmPerAu]
      },
    }
    return [{ body: id, frame }, ...moons.map((moon, index): SolarSystemFrameSpec => ({
      body: moon,
      frame: {
        id: moon, parent: id, unitM: childUnits[index]!,
        radiusM: bodyData(moon).meanRadiusKm * M_PER_KM,
        maxOffsetInParent: moonApoapsisKm(moon) * M_PER_KM / unitM,
        originInParent: epochJdTt => {
          const km = moonPositionRelativeToParentKm(moon, epochJdTt)
          return [km[0] * M_PER_KM / unitM, km[1] * M_PER_KM / unitM, km[2] * M_PER_KM / unitM]
        },
      },
    }))]
  })
