#!/usr/bin/env node
// Regenerates src/__fixtures__/horizons.ts — the reference vectors every
// ephemeris test in this package asserts against.
//
// Nothing here is derived from this package's own output. Each fixture records
// the exact Horizons URL that produced it, so any row can be re-fetched with
// curl and nothing else. `VEC_CORR='NONE'` matters: the Horizons default is
// light-time corrected, and an ephemeris is a geometric statement.
import { writeRecordSections } from './lib/write-record-sections.mjs'
import { horizons, parseVectors, vectorsUrl } from './lib/horizons.mjs'
import { HEADER } from './lib/sources.mjs'

// 1900-01-01, 1950-01-01, J2000, the two epochs PLAN.md pins, 2050-01-01,
// 2100-01-01. The window's two ends are there because a series that has been
// truncated wrongly usually still looks fine at J2000.
const EPOCHS = [2415020.5, 2433282.5, 2451545.0, 2461041.5, 2461042.5, 2469807.5, 2488069.5]

// Greatest eclipse of the total lunar eclipse of 2000-01-21 and the total solar
// eclipse of 2001-06-21, from NASA's Five Millennium Canon of Eclipses. At those
// instants the Sun, Earth and Moon are as close to collinear as they get, which
// is a geometric fact about the sky rather than about any ephemeris.
// Converted to TT with the leap-second count in force at the time
// (TAI-UTC = 32 s), NOT with `jdUtcToJdTt`, whose constant is today's 37 s.
const SYZYGY_EPOCHS = [
  2451564.697615741 + (32 + 32.184) / 86400, // 2000-01-21 04:44:34 UTC, full moon
  2452082.002569444 + (32 + 32.184) / 86400, // 2001-06-21 12:03:42 UTC, new moon
]

const targets = [
  ['sunFromSsb', 'Sun (10) relative to the solar-system barycentre', '10', '500@0', EPOCHS],
  ['mercuryBarycentreHeliocentric', 'Mercury system barycentre (1) relative to the Sun', '1', '500@10', EPOCHS],
  ['venusBarycentreHeliocentric', 'Venus system barycentre (2) relative to the Sun', '2', '500@10', EPOCHS],
  ['embHeliocentric', 'Earth-Moon barycentre (3) relative to the Sun', '3', '500@10', EPOCHS],
  ['marsBarycentreHeliocentric', 'Mars system barycentre (4) relative to the Sun', '4', '500@10', EPOCHS],
  ['jupiterBarycentreHeliocentric', 'Jupiter system barycentre (5) relative to the Sun', '5', '500@10', EPOCHS],
  ['saturnBarycentreHeliocentric', 'Saturn system barycentre (6) relative to the Sun', '6', '500@10', EPOCHS],
  ['uranusBarycentreHeliocentric', 'Uranus system barycentre (7) relative to the Sun', '7', '500@10', EPOCHS],
  ['neptuneBarycentreHeliocentric', 'Neptune system barycentre (8) relative to the Sun', '8', '500@10', EPOCHS],
  ['earthFromEmb', 'Earth (399) relative to the Earth-Moon barycentre', '399', '500@3', EPOCHS],
  ['moonGeocentric', 'Moon (301) relative to Earth', '301', '500@399', EPOCHS],
  ['moonGeocentricSyzygy', 'Moon (301) relative to Earth at two eclipse maxima', '301', '500@399', SYZYGY_EPOCHS],
  ['sunGeocentricSyzygy', 'Sun (10) relative to Earth at the same two eclipse maxima', '10', '500@399', SYZYGY_EPOCHS],
  ['jupiterFromBarycentre', 'Jupiter (599) relative to the Jupiter system barycentre', '599', '500@5', EPOCHS],
  ['saturnFromBarycentre', 'Saturn (699) relative to the Saturn system barycentre', '699', '500@6', EPOCHS],
]

const SATELLITES = [
  ['phobos', '401', '500@499'],
  ['deimos', '402', '500@499'],
  ['io', '501', '500@599'],
  ['europa', '502', '500@599'],
  ['ganymede', '503', '500@599'],
  ['callisto', '504', '500@599'],
  ['amalthea', '505', '500@599'],
  ['thebe', '514', '500@599'],
  ['adrastea', '515', '500@599', 'daily'],
  ['metis', '516', '500@599', 'daily'],
  ['methone', '632', '500@699', 'cassini-era'],
  ['pallene', '633', '500@699', 'cassini-era'],
  ['mimas', '601', '500@699'],
  ['enceladus', '602', '500@699'],
  ['tethys', '603', '500@699'],
  ['dione', '604', '500@699'],
  ['rhea', '605', '500@699'],
  ['titan', '606', '500@699'],
  ['hyperion', '607', '500@699', 'limited'],
  ['iapetus', '608', '500@699'],
  ['phoebe', '609', '500@699'],
  ['janus', '610', '500@699', 'limited'],
  ['epimetheus', '611', '500@699', 'limited'],
  ['helene', '612', '500@699', 'limited'],
  ['calypso', '614', '500@699', 'limited'],
  ['daphnis', '635', '500@699', 'cassini-era'],
  ['telesto', '613', '500@699'],
  ['atlas', '615', '500@699', 'limited'],
  ['prometheus', '616', '500@699', 'limited'],
  ['pandora', '617', '500@699', 'limited'],
  ['pan', '618', '500@699', 'source-limited'],
  ['puck', '715', '500@799', 'daily'],
  ['miranda', '705', '500@799'],
  ['ariel', '701', '500@799'],
  ['umbriel', '702', '500@799'],
  ['titania', '703', '500@799'],
  ['oberon', '704', '500@799'],
  ['triton', '801', '500@899'],
  ['proteus', '808', '500@899'],
  ['larissa', '807', '500@899'],
  ['naiad', '803', '500@899', 'daily'],
  ['thalassa', '804', '500@899', 'daily'],
  ['despina', '805', '500@899', 'daily'],
  ['galatea', '806', '500@899', 'daily'],
  ['charon', '901', '500@999'],
  ['nix', '902', '500@999', 'daily'],
  ['hydra', '903', '500@999', 'daily'],
  ['kerberos', '904', '500@999', 'daily'],
  ['styx', '905', '500@999', 'daily'],
]

// Deliberately NOT the epochs the mean elements were fitted on: the satellite
// element fit sampled every 30 days from JD 2415020.5, so every one of those
// samples is an integer number of 30-day steps from the start. These are not.
const SATELLITE_EPOCHS = [2415033.25, 2433295.75, 2451545.0, 2461041.5, 2469820.25, 2488056.25]

// Six independent epochs inside the 2020-01-01 .. 2032-01-01 current-era fit
// used for the fast and resonant added inner moons. None is on its 5-day grid.
const LIMITED_SATELLITE_EPOCHS = [2458862.25, 2460310.75, 2461041.5, 2461772.25, 2462502.75, 2463219.25]

// Pan's source supports 1949-12-27 .. 2050-01-09 and its simple fit remains
// accurate across that span, so it does not need the narrower current-era set.
const SOURCE_LIMITED_SATELLITE_EPOCHS = [2433295.75, 2442413.25, 2451545.0, 2461041.5, 2465233.25, 2469794.75]

const DWARF_PLANETS = [
  ['pluto', '999'],
  ['ceres', '1;'],
  ['eris', '136199;'],
  ['haumea', '136108;'],
  ['makemake', '136472;'],
]

// `dwarfPlanetElements.data.ts`'s epoch (2461041.5, 2026-Jan-01 TDB) is one of
// these on purpose: it is the trivial near-zero-error point, and
// `dwarfPlanets.test.ts` needs it to show the propagation error growing away
// from the epoch rather than starting from an unknown baseline. The other
// three span one year either side plus a longer baseline, which is what makes
// the error-growth claim in that test's header comment a measured one.
const DWARF_EPOCHS = [2460676.5, 2461041.5, 2461406.5, 2462771.5]

const emitVec = (v) => `[${v.map((x) => x.toExponential(15)).join(', ')}]`

async function collect(name, description, command, center, epochs) {
  const url = vectorsUrl({ command, center, epochsJdTdb: epochs, outUnits: 'KM-D' })
  const rows = parseVectors(await horizons(url, `vectors-${name}`), name)
  if (rows.length !== epochs.length) throw new Error(`${name}: asked for ${epochs.length} epochs, got ${rows.length}`)
  return `  ${name}: {
    description: ${JSON.stringify(description)},
    query: ${JSON.stringify(url)},
    rows: [
${rows
  .map(
    (r) => `      { jdTdb: ${r.jd}, positionKm: ${emitVec(r.position)}, velocityKmPerDay: ${emitVec(r.velocity)} },`,
  )
  .join('\n')}
    ],
  },`
}

const blocks = []
for (const [name, description, command, center, epochs] of targets) {
  blocks.push(await collect(name, description, command, center, epochs))
}
for (const [id, command, center, range] of SATELLITES) {
  const epochs =
    range === 'daily'
      ? [2458862.25, 2460310.75, 2461041.625, 2461772.25, 2462502.75, 2463219.25]
      : range === 'cassini-era'
      ? [2453383.25, 2454113.75, 2455197.25, 2456658.75, 2457389.25, 2458110.25]
      : range === 'limited'
      ? LIMITED_SATELLITE_EPOCHS
      : range === 'source-limited'
        ? SOURCE_LIMITED_SATELLITE_EPOCHS
        : SATELLITE_EPOCHS
  blocks.push(await collect(`${id}FromPlanet`, `${id} (${command}) relative to its planet`, command, center, epochs))
}
for (const [id, command] of DWARF_PLANETS) {
  blocks.push(await collect(`${id}Heliocentric`, `${id} (${command}) relative to the Sun`, command, '500@10', DWARF_EPOCHS))
}

const out = `${HEADER('JPL Horizons vector ephemerides; every entry carries the URL that produced it', 'fetch-fixtures.mjs')}
import type { Vec3 } from '../vec3.js'

export interface HorizonsRow {
  /** Julian Date, TDB. Treated as TT by the tests: they differ by under 2 ms. */
  readonly jdTdb: number
  readonly positionKm: Vec3
  readonly velocityKmPerDay: Vec3
}

export interface HorizonsFixture {
  readonly description: string
  /** The exact request. \`curl\` it to reproduce the rows below. */
  readonly query: string
  readonly rows: readonly HorizonsRow[]
}

/** ICRF equatorial (\`REF_PLANE='FRAME'\`), geometric (\`VEC_CORR='NONE'\`), km and km/day. */
export const HORIZONS: Record<string, HorizonsFixture> = {
${blocks.join('\n')}
}

/**
 * The two Mars states PLAN.md's appendix pins, verbatim, in au and au/day and
 * in the ECLIPTIC of J2000 rather than ICRF equatorial. They are here in the
 * plan's own units so that the one fixture the plan supplies is checked in the
 * form the plan supplies it, exercising the ecliptic conversion as well as the
 * series. Horizons reproduces them digit for digit with
 * \`REF_PLANE='ECLIPTIC'\`; see \`marsEclipticQuery\`.
 */
export const PLAN_MARS_ECLIPTIC = {
  query:
    "https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND='4'&OBJ_DATA='NO'&MAKE_EPHEM='YES'" +
    "&EPHEM_TYPE='VECTORS'&CENTER='500@10'&TLIST=2461041.5,2461042.5&TLIST_TYPE='JD'&TIME_TYPE='TDB'" +
    "&OUT_UNITS='AU-D'&REF_PLANE='ECLIPTIC'&REF_SYSTEM='ICRF'&VEC_TABLE='2'&VEC_CORR='NONE'",
  rows: [
    {
      jdTdb: 2461041.5,
      positionAu: [3.405796768622151e-1, -1.387002015945254, -3.741722678770108e-2] as Vec3,
      velocityAuPerDay: [1.411941195403098e-2, 4.540203195240467e-3, -2.510853588872874e-4] as Vec3,
    },
    {
      jdTdb: 2461042.5,
      positionAu: [3.54681558330501e-1, -1.382391469336554, -3.7666408101236e-2] as Vec3,
      velocityAuPerDay: [1.408409944947758e-2, 4.68086273605707e-3, -2.472716573619788e-4] as Vec3,
    },
  ],
} as const
`
writeRecordSections(new URL('../src/__fixtures__/horizons.ts', import.meta.url), out, 'horizons')
process.stdout.write(`wrote ${blocks.length} fixtures\n`)
