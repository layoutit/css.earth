#!/usr/bin/env node
// Regenerates src/data/dwarfPlanetElements.data.ts.
//
// WHERE THESE ELEMENTS COME FROM, and what they are not.
//
// Unlike the eight planets (VSOP87) and the Moon (ELP2000-82B), no truncated
// analytic theory ships in this package for Pluto, Ceres, Eris, Haumea or
// Makemake. Each is placed as a single-epoch OSCULATING Keplerian ellipse —
// the same two-body propagation `kepler.ts` already gives every moon, but
// with no fitted node/periapsis precession rate, because a single Horizons
// element set carries none.
//
// This is a materially weaker claim than the moons' fit (`satelliteElements
// .data.ts`), which is fitted across two centuries of samples and states a fit
// residual. Here there is exactly one sample: real perturbations from the
// giant planets (Neptune's 3:2 resonance with Pluto above all) make the
// osculating ellipse diverge from Horizons' own perturbed solution within
// about a year, at a rate `dwarfPlanets.test.ts` measures and documents rather
// than assumes. DO NOT propagate these elements far from their epoch and
// expect planetary accuracy.
//
// Fetched directly from JPL Horizons: ELEMENTS, ICRF equatorial
// (REF_PLANE=FRAME, REF_SYSTEM=ICRF — the frame tree's own axes, so no
// ecliptic-obliquity rotation is needed downstream), heliocentric
// (CENTER='500@10'), geometric (no light-time correction), at epoch
// 2461041.5 = 2026-Jan-01 00:00 TDB — chosen near "today" rather than J2000,
// since these are single-epoch elements and "today" is the epoch this app's
// default view actually renders.
import { readBodyRecords, writeBodyRecord, prepareBodyRecords } from './body-records.mts'
import { literalRecords } from './lib/write-record-sections.mts'
import { elementsUrl, horizons, parseElements } from './lib/horizons.mts'
import { HEADER, shortest } from './lib/sources.mts'

const EPOCH_JD = 2461041.5
const DEG = Math.PI / 180

// id, Horizons small-body command (quoted verbatim in the query — the
// trailing ';' forces the small-body branch instead of a numbered-major-body
// lookup), centre
const bodyRecords = await readBodyRecords()
const DWARF_PLANETS = bodyRecords.filter(record => record.classification === 'dwarf-planet').map(record => {
  const target = record.acquisition?.heliocentric?.target;
  if (!target) throw new TypeError(`Missing dwarf planet target: ${record.id}.`);
  return [record.id, target, '500@10'] as const;
})

const results = []
for (const [id, command, center] of DWARF_PLANETS) {
  const url = elementsUrl({ command, center, startJd: EPOCH_JD, stopJd: EPOCH_JD + 1, stepDays: 1 })
  const rows = parseElements(await horizons(url, `dwarf-elements-${id}`), id)
  const row = rows[0]
  results.push({
    id,
    url,
    elements: {
      epochJdTt: EPOCH_JD,
      semiMajorAxisKm: row.semiMajorAxisKm,
      eccentricity: row.eccentricity,
      inclinationRad: row.inclinationDeg * DEG,
      ascendingNodeRad: row.nodeDeg * DEG,
      argumentOfPeriapsisRad: row.periapsisDeg * DEG,
      meanAnomalyAtEpochRad: row.meanAnomalyDeg * DEG,
      meanMotionRadPerDay: row.meanMotionDegPerDay * DEG,
    },
  })
}

const fmt = (x: number) => shortest(x, Math.abs(x) * 1e-13 + 1e-15)

let out = HEADER(
  "JPL Horizons osculating elements, heliocentric, ICRF equatorial (REF_PLANE=FRAME, REF_SYSTEM=ICRF), epoch 2461041.5 = 2026-Jan-01 TDB. Each entry's `query` reproduces it.",
  'generate-dwarf-planets.mts',
)
out += `
import type { KeplerianElements } from '../kepler.js'

export interface DwarfPlanetRecord {
  /** The exact Horizons request that produced \`elements\`. \`curl\` it to reproduce the row. */
  readonly query: string
  /** Referred to ICRF equatorial axes, heliocentric, single osculating epoch — see the file header. */
  readonly elements: KeplerianElements
}

export const DWARF_PLANET_ELEMENTS = {
`
for (const r of results) {
  out += `  ${r.id}: {\n`
  out += `    query: ${JSON.stringify(r.url)},\n`
  out += `    elements: {\n`
  out += `      epochJdTt: ${r.elements.epochJdTt},\n`
  out += `      semiMajorAxisKm: ${fmt(r.elements.semiMajorAxisKm)},\n`
  out += `      eccentricity: ${fmt(r.elements.eccentricity)},\n`
  out += `      inclinationRad: ${fmt(r.elements.inclinationRad)},\n`
  out += `      ascendingNodeRad: ${fmt(r.elements.ascendingNodeRad)},\n`
  out += `      argumentOfPeriapsisRad: ${fmt(r.elements.argumentOfPeriapsisRad)},\n`
  out += `      meanAnomalyAtEpochRad: ${fmt(r.elements.meanAnomalyAtEpochRad)},\n`
  out += `      meanMotionRadPerDay: ${fmt(r.elements.meanMotionRadPerDay)},\n`
  out += `    },\n`
  out += `  },\n`
}
out += `} satisfies Record<string, DwarfPlanetRecord>

export type DwarfPlanetId = keyof typeof DWARF_PLANET_ELEMENTS & string
`

for (const [id, dwarfPlanet] of Object.entries(literalRecords(out, 'DWARF_PLANET_ELEMENTS'))) {
  await writeBodyRecord({ ...bodyRecords.find(record => record.id === id), dwarfPlanet })
}
await prepareBodyRecords()
process.stderr.write(`wrote src/data/dwarfPlanetElements.data.ts (${results.length} bodies)\n`)
