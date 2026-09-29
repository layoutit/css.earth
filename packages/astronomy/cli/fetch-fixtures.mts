#!/usr/bin/env node
import { readBodyRecords, prepareBodyRecords } from './body-records.mts'
// Regenerates src/__fixtures__/horizons.ts — the reference vectors every
// ephemeris test in this package asserts against.
//
// Nothing here is derived from this package's own output. Each fixture records
// the exact Horizons URL that produced it, so any row can be re-fetched with
// curl and nothing else. `VEC_CORR='NONE'` matters: the Horizons default is
// light-time corrected, and an ephemeris is a geometric statement.
import { readRecordSections, writeRecordSections, literalRecords } from './lib/write-record-sections.mts'
import { horizons, parseVectors, vectorsUrl } from './lib/horizons.mts'
import { HEADER } from './lib/sources.mts'

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

const targets: [string, string, string, string, number[]][] = [
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

const bodyRecords = await readBodyRecords()
const SATELLITES = bodyRecords.flatMap(record => {
  const f = record.acquisition?.fixture;
  return f ? [[record.id, f.target, f.center, f.range] as const] : [];
})

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

const DWARF_PLANETS = bodyRecords.filter(record => record.classification === 'dwarf-planet').map(record => {
  const target = record.acquisition?.heliocentric?.target;
  if (!target) throw new TypeError(`Missing dwarf planet target: ${record.id}.`);
  return [record.id, target] as const;
})

// `dwarfPlanetElements.data.ts`'s epoch (2461041.5, 2026-Jan-01 TDB) is one of
// these on purpose: it is the trivial near-zero-error point, and
// `dwarfPlanets.test.ts` needs it to show the propagation error growing away
// from the epoch rather than starting from an unknown baseline. The other
// three span one year either side plus a longer baseline, which is what makes
// the error-growth claim in that test's header comment a measured one.
const DWARF_EPOCHS = [2460676.5, 2461041.5, 2461406.5, 2462771.5]

const emitVec = (v: readonly number[]) => `[${v.map((x) => x.toExponential(15)).join(', ')}]`

async function collect(name: string, description: string, command: string, center: string, epochs: readonly number[]) {
  const url = vectorsUrl({ command, center, epochsJdTdb: epochs, outUnits: 'KM-D' })
  const rows = parseVectors(await horizons(url, `vectors-${name}`), name)
  if (rows.length !== epochs.length) throw new Error(`${name}: asked for ${epochs.length} epochs, got ${rows.length}`)
  return `  ${JSON.stringify(name)}: {
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

// Selected satellite regeneration preserves every unrelated checked fixture.
const requested = process.argv.slice(2)
if (requested.some(arg => !/^--object=[a-z][a-z0-9-]*(?:,[a-z][a-z0-9-]*)*$/.test(arg))) throw new Error('Use --object=id[,id]')
const selected = new Set(requested.flatMap(arg => arg.slice('--object='.length).split(',')))
for (const id of selected) if (!SATELLITES.some(row => row[0] === id)) throw new Error(`Unknown satellite ${id}`)
const destination = new URL('../src/__fixtures__/horizons.ts', import.meta.url)
const records = selected.size ? readRecordSections(destination, 'HORIZONS') : new Map()
const blocks = []
for (const [name, description, command, center, epochs] of selected.size ? [] : targets) {
  blocks.push(await collect(name, description, command, center, epochs))
}
for (const [id, command, center, range] of SATELLITES.filter(([id]) => !selected.size || selected.has(id))) {
  const epochs =
    range === 'daily'
      ? [2458862.25, 2460310.75, 2461041.625, 2461772.25, 2462502.75, 2463219.25]
      : range === 'cassini-era'
      ? [2453383.25, 2454113.75, 2455197.25, 2456658.75, 2457389.25, 2458110.25]
      : range === 'dart'
      ? [2461258.75, 2461267.25, 2461276.75, 2461286.75, 2461302.25, 2461314.75]
      : range === 'limited'
      ? LIMITED_SATELLITE_EPOCHS
      : range === 'source-limited'
        ? SOURCE_LIMITED_SATELLITE_EPOCHS
        : SATELLITE_EPOCHS
  blocks.push(await collect(`${id}FromParent`, `${id} (${command}) relative to its parent`, command, center, epochs))
}
for (const [id, command] of selected.size ? [] : DWARF_PLANETS) {
  blocks.push(await collect(`${id}Heliocentric`, `${id} (${command}) relative to the Sun`, command, '500@10', DWARF_EPOCHS))
}

for (const block of blocks) {
  const [id] = Object.keys(literalRecords(`export const HORIZONS = {${block}}`, 'HORIZONS'))
  records.set(id, block)
}
const out = `${HEADER('JPL Horizons vector ephemerides; every entry carries the URL that produced it', 'fetch-fixtures.mts')}
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
${[...records.values()].join('\n')}
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
writeRecordSections(destination, out, 'horizons')
process.stdout.write(`wrote ${blocks.length} fixtures\n`)

await prepareBodyRecords()
