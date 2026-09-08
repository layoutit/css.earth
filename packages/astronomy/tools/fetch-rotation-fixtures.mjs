#!/usr/bin/env node
// Regenerates src/__fixtures__/rotation.ts — an independent check on every IAU
// WGCCRE model in src/rotation.ts.
//
// HOW: Horizons will put the ephemeris origin at a BODY-FIXED SITE
// (`CENTER='coord@<body>'` with `SITE_COORD='<east lon>,<lat>,<alt km>'`), and
// it orients that site with the same IAU rotation model the body's PCK carries.
// So for any target, (target from body centre) minus (target from the site) is
// the site's own position in ICRF — that is, a body-fixed axis rotated into
// ICRF by exactly the matrix `bodyFixedToIcrf` is supposed to produce.
//
// Two sites are enough: (0 deg E, 0 deg lat) is the body's +x axis (prime
// meridian on the equator, so W enters), and (0 deg E, 90 deg lat) is +z (the
// pole, so only alpha0 and delta0 enter). The third axis is their cross
// product. Storing the raw km differences rather than unit vectors keeps the
// fixture one subtraction away from what Horizons actually returned.
//
// This catches what nothing else can: a mistyped coefficient in a periodic term
// that leaves the model looking plausible.
import { writeFileSync } from 'node:fs'
import { horizons, parseVectors, vectorsUrl } from './lib/horizons.mjs'
import { HEADER } from './lib/sources.mjs'

const EPOCHS = [2415020.5, 2451545.0, 2488069.5]

const BODIES = [
  ['mercury', '199'],
  ['venus', '299'],
  ['earth', '399'],
  ['moon', '301'],
  ['mars', '499'],
  ['phobos', '401'],
  ['deimos', '402'],
  ['jupiter', '599'],
  ['io', '501'],
  ['europa', '502'],
  ['ganymede', '503'],
  ['callisto', '504'],
  ['amalthea', '505'],
  ['thebe', '514'],
  ['adrastea', '515'],
  ['metis', '516'],
  ['saturn', '699'],
  ['mimas', '601'],
  ['enceladus', '602'],
  ['tethys', '603'],
  ['dione', '604'],
  ['rhea', '605'],
  ['titan', '606'],
  ['iapetus', '608'],
  ['uranus', '799'],
  ['miranda', '705'],
  ['ariel', '701'],
  ['umbriel', '702'],
  ['titania', '703'],
  ['oberon', '704'],
  ['neptune', '899'],
  ['triton', '801'],
  ['proteus', '808'],
  ['larissa', '807'],
  ['naiad', '803'],
  ['thalassa', '804'],
  ['despina', '805'],
  ['galatea', '806'],
  ['charon', '901'],
  ['pluto', '999'],
  // Ceres has no major-body number, but Horizons resolves '2000001' (the
  // Dawn-mission code) for a body-fixed site — verified live; the small-body
  // branch ('1;', used for Ceres' orbital elements in
  // `dwarfPlanetElements.data.ts`) does not accept a SITE_COORD.
  ['ceres', '2000001'],
]

const siteUrl = (code, siteCoord) =>
  `${vectorsUrl({ command: '10', center: `coord@${code}`, epochsJdTdb: EPOCHS, outUnits: 'KM-D' })}` +
  `&SITE_COORD='${siteCoord}'&COORD_TYPE='GEODETIC'`

const emit = (v) => `[${v.map((x) => x.toExponential(12)).join(', ')}]`

const blocks = []
const failures = []
for (const [id, code] of BODIES) {
  try {
    const centreUrl = vectorsUrl({ command: '10', center: `500@${code}`, epochsJdTdb: EPOCHS, outUnits: 'KM-D' })
    const centre = parseVectors(await horizons(centreUrl, `rot-${id}-centre`), id)
    const equatorUrl = siteUrl(code, '0,0,0')
    const poleUrl = siteUrl(code, '0,90,0')
    const equator = parseVectors(await horizons(equatorUrl, `rot-${id}-equator`), id)
    const pole = parseVectors(await horizons(poleUrl, `rot-${id}-pole`), id)
    const rows = centre.map((c, i) => ({
      jdTdb: c.jd,
      primeMeridianSiteKm: [0, 1, 2].map((k) => c.position[k] - equator[i].position[k]),
      poleSiteKm: [0, 1, 2].map((k) => c.position[k] - pole[i].position[k]),
    }))
    blocks.push(`  ${id}: {
    centreQuery: ${JSON.stringify(centreUrl)},
    primeMeridianSiteQuery: ${JSON.stringify(equatorUrl)},
    poleSiteQuery: ${JSON.stringify(poleUrl)},
    rows: [
${rows
  .map(
    (r) =>
      `      { jdTdb: ${r.jdTdb}, primeMeridianSiteKm: ${emit(r.primeMeridianSiteKm)}, poleSiteKm: ${emit(r.poleSiteKm)} },`,
  )
  .join('\n')}
    ],
  },`)
  } catch (error) {
    failures.push(`${id}: ${error.message.split('\n')[0]}`)
  }
}

const out = `${HEADER(
  "JPL Horizons, Sun's vector from each body's centre and from two body-fixed sites on it",
  'fetch-rotation-fixtures.mjs',
)}
import type { Vec3 } from '../vec3.js'

export interface RotationFixtureRow {
  readonly jdTdb: number
  /**
   * Position, in ICRF and km, of the site at 0 deg east longitude and 0 deg
   * latitude: the body's +x axis, scaled by its equatorial radius. Recovered as
   * (Sun from body centre) - (Sun from that site).
   */
  readonly primeMeridianSiteKm: Vec3
  /** Same for the site at 90 deg latitude: the body's +z axis, scaled by its polar radius. */
  readonly poleSiteKm: Vec3
}

export interface RotationFixture {
  readonly centreQuery: string
  readonly primeMeridianSiteQuery: string
  readonly poleSiteQuery: string
  readonly rows: readonly RotationFixtureRow[]
}

export const ROTATION_FIXTURES: Record<string, RotationFixture> = {
${blocks.join('\n')}
}
`
writeFileSync(new URL('../src/__fixtures__/rotation.ts', import.meta.url), out)
process.stdout.write(`wrote ${blocks.length} rotation fixtures\n`)
if (failures.length) process.stdout.write(`SKIPPED:\n  ${failures.join('\n  ')}\n`)
