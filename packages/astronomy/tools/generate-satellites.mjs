#!/usr/bin/env node
// Regenerates src/data/satelliteElements.data.ts.
//
// WHERE THESE ELEMENTS COME FROM, and what they are not.
//
// There is no truncated analytic satellite theory in this package; the moons
// are propagated as PRECESSING KEPLERIAN ELLIPSES. The element set for each
// moon is derived here from JPL Horizons' own osculating elements, sampled
// in the ICRF frame. Most use a 30-day cadence over 1900-01-01 .. 2100-01-01;
// the fast and resonant added Saturn moons use a 5-day cadence over a
// 2020-01-01 .. 2032-01-01 current-era window. That interval is deliberately
// centred on the application's 2026 observing epoch: a single precessing
// ellipse cannot carry their long-period resonant motion over the full source
// coverage. Each generated record carries its exact fit window and cadence:
//
//   pole             the mean of the sampled orbit poles. A satellite's orbit
//                    pole does not precess about the ICRF pole, it precesses on
//                    a cone about its LOCAL LAPLACE POLE, so elements referred
//                    to ICRF cannot express nodal precession at all: fitting
//                    there silently returns node-dot = 0 and buries the whole
//                    effect in the residual — 470 000 km for Iapetus, whose
//                    orbit sits 7.6 degrees off its Laplace plane. Each moon
//                    therefore gets its own frame, and it is DERIVED here rather
//                    than taken from a published table, so no undocumented
//                    longitude convention has to be guessed. Its x-axis is the
//                    ascending node of that plane on the ICRF equator; the
//                    runtime rebuilds the same basis from the stored pole.
//   e, i             from the fitted amplitudes below, in that frame
//   node, periapsis  fitted as UNIFORMLY ROTATING VECTORS, not as unwrapped
//                    angles. Ganymede's eccentricity is 0.0014 and its
//                    inclination in its own Laplace frame is small, so its
//                    osculating periapsis and node are nearly undefined and
//                    swing by 170 degrees between consecutive samples; no
//                    unwrapping of those angles can be right. Instead the
//                    generator fits
//                      k + i h = e * exp(i * (varpi0 + varpi_dot * t))
//                      q + i p = tan(i/2) * exp(i * (node0 + node_dot * t))
//                    by maximising |sum z_j exp(-i w t_j)| over w — a
//                    periodogram, coarse-scanned then golden-section refined.
//                    That is singularity-free: a nearly circular or nearly
//                    coplanar orbit simply gives a small amplitude, and the rate
//                    is still recovered from the phase that survives.
//   mean longitude   linear least squares on lambda = node + periapsis + M,
//                    unwrapped against the prediction from the osculating mean
//                    motion. A moon completes tens to thousands of revolutions
//                    between samples, so lambda cannot be unwrapped by
//                    consecutive differences; but lambda, unlike node and
//                    periapsis, is never ill-conditioned.
//   n                lambda-dot minus varpi-dot
//   M at epoch       lambda(J2000) minus varpi(J2000)
//
// That is the textbook construction of mean elements, and it is exactly what
// JPL's own published "Planetary Satellite Mean Elements" table is, except that
// this one is not rounded to four significant figures. (The published table was
// tried first and rejected: its angles are quoted to 0.1 degree, which is 700 km
// for Io, and its longitude origin for the Saturnian and Uranian Laplace planes
// could not be reproduced from any documented convention — Io, Callisto and
// Phobos land within 1 degree with the ICRF-equator node convention, Rhea, Titan
// and Titania are 157 degrees out, and Oberon is 100 degrees out. Guessing per
// system was not an option.)
//
// CONSEQUENCE FOR THE BUDGET: the moon error reported by
// `satellite.horizons.test.ts` is a FIT RESIDUAL, not an independent accuracy
// claim. A precessing ellipse cannot represent a real satellite orbit; what the
// test proves is that the propagator reproduces JPL data to within the residual
// the fit leaves, at epochs the fit did not see.
import { writeRecordSections } from './lib/write-record-sections.mjs'
import { elementsUrl, horizons, parseElements } from './lib/horizons.mjs'
import { HEADER, shortest } from './lib/sources.mjs'

const J2000 = 2451545.0
const FROM_JD = 2415020.5
const TO_JD = 2488069.5
const CURRENT_SATURN_FROM_JD = 2458849.5
const CURRENT_SATURN_TO_JD = 2463232.5
const INNER_SATURN_FROM_JD = 2433282.5
const INNER_SATURN_TO_JD = 2469807.5
// Daphnis has no Horizons ephemeris beyond 2018-01-17. Its later position
// extrapolates this Cassini-era fit and carries that limited validity interval.
const DAPHNIS_FROM_JD = 2453371.5
const DAPHNIS_TO_JD = 2458119.5
const STEP_DAYS = 30
const DEG = Math.PI / 180
const RADIAL_FIT_IDS = new Set(['dimorphos', 'hyperion', 'phoebe', 'janus', 'epimetheus', 'telesto', 'helene', 'calypso', 'daphnis', 'atlas', 'prometheus', 'pandora', 'pan'])

// id, Horizons target code, Horizons centre, parent body id, optional fit window and cadence
const SATELLITES = [
  ['phobos', '401', '500@499', 'mars'],
  ['deimos', '402', '500@499', 'mars'],
  ['io', '501', '500@599', 'jupiter'],
  ['europa', '502', '500@599', 'jupiter'],
  ['ganymede', '503', '500@599', 'jupiter'],
  ['callisto', '504', '500@599', 'jupiter'],
  ['mimas', '601', '500@699', 'saturn'],
  ['enceladus', '602', '500@699', 'saturn'],
  ['tethys', '603', '500@699', 'saturn'],
  ['dione', '604', '500@699', 'saturn'],
  ['rhea', '605', '500@699', 'saturn'],
  ['titan', '606', '500@699', 'saturn'],
  ['hyperion', '607', '500@699', 'saturn', CURRENT_SATURN_FROM_JD, CURRENT_SATURN_TO_JD, 5],
  ['iapetus', '608', '500@699', 'saturn'],
  ['phoebe', '609', '500@699', 'saturn'],
  ['janus', '610', '500@699', 'saturn', CURRENT_SATURN_FROM_JD, CURRENT_SATURN_TO_JD, 5],
  ['epimetheus', '611', '500@699', 'saturn', CURRENT_SATURN_FROM_JD, CURRENT_SATURN_TO_JD, 5],
  ['helene', '612', '500@699', 'saturn', CURRENT_SATURN_FROM_JD, CURRENT_SATURN_TO_JD, 5],
  ['calypso', '614', '500@699', 'saturn', CURRENT_SATURN_FROM_JD, CURRENT_SATURN_TO_JD, 5],
  ['daphnis', '635', '500@699', 'saturn', DAPHNIS_FROM_JD, DAPHNIS_TO_JD, 5],
  ['telesto', '613', '500@699', 'saturn'],
  ['atlas', '615', '500@699', 'saturn', CURRENT_SATURN_FROM_JD, CURRENT_SATURN_TO_JD, 5],
  ['prometheus', '616', '500@699', 'saturn', CURRENT_SATURN_FROM_JD, CURRENT_SATURN_TO_JD, 5],
  ['pandora', '617', '500@699', 'saturn', CURRENT_SATURN_FROM_JD, CURRENT_SATURN_TO_JD, 5],
  ['pan', '618', '500@699', 'saturn', INNER_SATURN_FROM_JD, INNER_SATURN_TO_JD, 5],
  ['miranda', '705', '500@799', 'uranus'],
  ['ariel', '701', '500@799', 'uranus'],
  ['umbriel', '702', '500@799', 'uranus'],
  ['titania', '703', '500@799', 'uranus'],
  ['oberon', '704', '500@799', 'uranus'],
  ['triton', '801', '500@899', 'neptune'],
  ['proteus', '808', '500@899', 'neptune'],
  ['charon', '901', '500@999', 'pluto'],
  // DART post-impact s547, a short window around the prepared epoch.
  ['dimorphos', '120065803', '500@920065803', 'didymos', 2461256.5, 2461316.5, 1],
]

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length

/** Least squares `y = intercept + slope * x`, x already centred on J2000. */
function fitLine(xs, ys) {
  const xBar = mean(xs)
  const yBar = mean(ys)
  let sxy = 0
  let sxx = 0
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - xBar) * (ys[i] - yBar)
    sxx += (xs[i] - xBar) ** 2
  }
  const slope = sxy / sxx
  return { slope, intercept: yBar - slope * xBar }
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const normalize = (a) => {
  const n = Math.hypot(a[0], a[1], a[2])
  return [a[0] / n, a[1] / n, a[2] / n]
}

function solveKepler(meanAnomalyRad, eccentricity) {
  const normalizedMeanAnomaly = ((meanAnomalyRad + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI
  let eccentricAnomaly = normalizedMeanAnomaly + eccentricity * Math.sin(normalizedMeanAnomaly)
  for (let i = 0; i < 30; i++) {
    const residual = eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly) - normalizedMeanAnomaly
    eccentricAnomaly -= residual / (1 - eccentricity * Math.cos(eccentricAnomaly))
    if (Math.abs(residual) < 1e-14) return eccentricAnomaly
  }
  throw new Error(`Kepler solve did not converge for e=${eccentricity}`)
}

/**
 * Orthonormal basis of the plane whose pole is `pole`, x-axis along that
 * plane's ascending node on the ICRF equator. Duplicated at runtime by
 * `laplaceBasis` in src/satellites.ts — if one changes the other must.
 */
function planeBasis(pole) {
  const x = cross([0, 0, 1], pole)
  const norm = Math.hypot(x[0], x[1], x[2])
  if (norm < 1e-6) throw new Error('pole is parallel to the ICRF pole; the node convention degenerates')
  const xHat = [x[0] / norm, x[1] / norm, x[2] / norm]
  return [xHat, cross(pole, xHat), pole]
}

/**
 * Best-fit uniform rotation rate for a sequence of 2-D vectors `(x, y)`
 * sampled at times `t`.
 *
 * For a fixed rate `w`, the least-squares amplitude and phase of
 * `A * exp(i(phi + w t))` are given by `mean(z_j * exp(-i w t_j))`, and the
 * residual is smallest where `|sum z_j exp(-i w t_j)|` is largest. So the whole
 * fit reduces to maximising that one function of `w`: a periodogram.
 *
 * Sampling is uniform, so the periodogram repeats with period `2*pi/step`; the
 * scan range below is a fifth of that, which is well inside the first period and
 * comfortably wider than the fastest precession here (Mimas's apsidal line, at
 * 0.035 rad/day). The coarse step is finer than the main-lobe width `2*pi/span`,
 * so the coarse scan cannot land in the wrong lobe.
 */
function fitRotation(days, xs, ys) {
  const span = days[days.length - 1] - days[0]
  const lobeWidth = (2 * Math.PI) / span
  const power = (w) => {
    let re = 0
    let im = 0
    for (let i = 0; i < days.length; i++) {
      const phase = w * days[i]
      const c = Math.cos(phase)
      const s = Math.sin(phase)
      re += xs[i] * c + ys[i] * s
      im += ys[i] * c - xs[i] * s
    }
    return re * re + im * im
  }
  const range = 0.05
  const coarse = lobeWidth / 4
  let best = -range
  let bestPower = -Infinity
  for (let w = -range; w <= range; w += coarse) {
    const p = power(w)
    if (p > bestPower) {
      bestPower = p
      best = w
    }
  }
  // Golden-section refinement inside the winning lobe.
  const phi = (Math.sqrt(5) - 1) / 2
  let lo = best - coarse
  let hi = best + coarse
  let c = hi - phi * (hi - lo)
  let d = lo + phi * (hi - lo)
  for (let i = 0; i < 120; i++) {
    if (power(c) > power(d)) {
      hi = d
      d = c
      c = hi - phi * (hi - lo)
    } else {
      lo = c
      c = d
      d = lo + phi * (hi - lo)
    }
  }
  const rate = (lo + hi) / 2
  let re = 0
  let im = 0
  for (let i = 0; i < days.length; i++) {
    const phase = rate * days[i]
    const cos = Math.cos(phase)
    const sin = Math.sin(phase)
    re += xs[i] * cos + ys[i] * sin
    im += ys[i] * cos - xs[i] * sin
  }
  re /= days.length
  im /= days.length
  return { rate, amplitude: Math.hypot(re, im), phaseAtEpoch: Math.atan2(im, re) }
}

const results = []
for (const [id, command, center, parent, fitFromJdTdb = FROM_JD, fitToJdTdb = TO_JD, fitStepDays = STEP_DAYS] of SATELLITES) {
  const url = elementsUrl({ command, center, startJd: fitFromJdTdb, stopJd: fitToJdTdb, stepDays: fitStepDays })
  const rows = parseElements(await horizons(url, `elements-${command}`), id)
  const days = rows.map((r) => r.jd - J2000)

  let semiMajorAxisKm = mean(rows.map((r) => r.semiMajorAxisKm))

  // Orbit normal and periapsis direction in ICRF for every sample.
  const normals = []
  const periapses = []
  for (const r of rows) {
    const inclination = r.inclinationDeg * DEG
    const node = r.nodeDeg * DEG
    const periapsis = r.periapsisDeg * DEG
    const sinI = Math.sin(inclination)
    const cosI = Math.cos(inclination)
    const sinN = Math.sin(node)
    const cosN = Math.cos(node)
    const sinW = Math.sin(periapsis)
    const cosW = Math.cos(periapsis)
    normals.push([sinI * sinN, -sinI * cosN, cosI])
    periapses.push([
      cosW * cosN - sinW * sinN * cosI,
      cosW * sinN + sinW * cosN * cosI,
      sinW * sinI,
    ])
  }
  const pole = normalize([
    mean(normals.map((n) => n[0])),
    mean(normals.map((n) => n[1])),
    mean(normals.map((n) => n[2])),
  ])
  const basis = planeBasis(pole)
  const poleRightAscensionRad = Math.atan2(pole[1], pole[0])
  const poleDeclinationRad = Math.asin(pole[2])

  // Re-express every sample in that frame, then build the two rotating vectors.
  const k = []
  const h = []
  const q = []
  const p = []
  const varpiRaw = []
  const nodeRaw = []
  for (let i = 0; i < rows.length; i++) {
    const n = basis.map((axis) => dot(axis, normals[i]))
    const e = basis.map((axis) => dot(axis, periapses[i]))
    const inclination = Math.acos(Math.min(1, Math.max(-1, n[2])))
    const node = Math.atan2(n[0], -n[1])
    const cosNode = Math.cos(node)
    const sinNode = Math.sin(node)
    const nodeDirection = [cosNode, sinNode, 0]
    // sin(omega) from the component of the periapsis direction along h x n.
    const inPlane = cross(n, nodeDirection)
    const argumentOfPeriapsis = Math.atan2(dot(e, inPlane) / Math.hypot(n[0], n[1], n[2]), dot(e, nodeDirection))
    const varpi = node + argumentOfPeriapsis
    const tanHalfInclination = Math.tan(inclination / 2)
    k.push(rows[i].eccentricity * Math.cos(varpi))
    h.push(rows[i].eccentricity * Math.sin(varpi))
    q.push(tanHalfInclination * cosNode)
    p.push(tanHalfInclination * sinNode)
    varpiRaw.push(varpi)
    nodeRaw.push(node)
  }
  const apsis = fitRotation(days, k, h)
  const nodal = fitRotation(days, q, p)

  const eccentricity = apsis.amplitude
  const inclinationRad = 2 * Math.atan(nodal.amplitude)
  const ascendingNodeRad = nodal.phaseAtEpoch
  const ascendingNodeRateRadPerDay = nodal.rate
  const argumentOfPeriapsisRad = apsis.phaseAtEpoch - nodal.phaseAtEpoch
  const argumentOfPeriapsisRateRadPerDay = apsis.rate - nodal.rate

  const lambdaRaw = rows.map((r, i) => varpiRaw[i] + r.meanAnomalyDeg * DEG)
  const lambda = [lambdaRaw[0]]
  for (let i = 1; i < rows.length; i++) {
    const rate = ((rows[i - 1].meanMotionDegPerDay + rows[i].meanMotionDegPerDay) / 2) * DEG + apsis.rate
    const predicted = lambda[i - 1] + rate * (days[i] - days[i - 1])
    const placed = lambdaRaw[i] + 2 * Math.PI * Math.round((predicted - lambdaRaw[i]) / (2 * Math.PI))
    // The unwrap is what is being checked here, NOT how well a Keplerian
    // ellipse fits. The wrap is ambiguous only at pi; 1.5 rad leaves a factor
    // of two of margin while still catching a sample placed a whole revolution
    // out. Io's osculating mean motion swings enough to miss by 0.5 rad over 30
    // days, and Mimas has a real 49-degree longitude libration — neither is an
    // unwrapping failure, and both are reported as fit residual instead.
    if (Math.abs(placed - predicted) > 1.5) {
      throw new Error(`${id}: sample ${i} could not be unwrapped (off prediction by ${(placed - predicted).toFixed(3)} rad)`)
    }
    lambda.push(placed)
  }
  const lambdaFit = fitLine(days, lambda)
  const meanAnomalyAtEpochRad = lambdaFit.intercept - apsis.phaseAtEpoch
  const meanMotionRadPerDay = lambdaFit.slope - apsis.rate

  if (RADIAL_FIT_IDS.has(id)) {
    // Once mean longitude and the eccentricity vector have been reduced to a
    // single precessing ellipse, mean(osculating a) is not generally the scale
    // that best reproduces radius: phase residuals couple into `a(1-e cos E)`.
    // Fit the final model's one remaining linear parameter directly to the
    // authoritative osculating radii. The objective is relative radial error,
    // so inner and outer phases carry equal weight.
    let numerator = 0
    let denominator = 0
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const referenceEccentricAnomaly = solveKepler(row.meanAnomalyDeg * DEG, row.eccentricity)
      const referenceRadiusKm = row.semiMajorAxisKm * (1 - row.eccentricity * Math.cos(referenceEccentricAnomaly))
      const fittedMeanAnomaly = meanAnomalyAtEpochRad + meanMotionRadPerDay * days[i]
      const fittedEccentricAnomaly = solveKepler(fittedMeanAnomaly, eccentricity)
      const fittedRadiusPerKm = 1 - eccentricity * Math.cos(fittedEccentricAnomaly)
      const coefficient = fittedRadiusPerKm / referenceRadiusKm
      numerator += coefficient
      denominator += coefficient * coefficient
    }
    semiMajorAxisKm = numerator / denominator
  }
  const worstLambdaResidual = Math.max(
    ...lambda.map((value, i) => Math.abs(value - (lambdaFit.intercept + lambdaFit.slope * days[i]))),
  )

  results.push({
    id,
    parent,
    command,
    center,
    url,
    fitFromJdTdb,
    fitToJdTdb,
    fitStepDays,
    semiMajorAxisKm,
    eccentricity,
    inclinationRad,
    poleRightAscensionRad,
    poleDeclinationRad,
    ascendingNodeRad,
    ascendingNodeRateRadPerDay,
    argumentOfPeriapsisRad,
    argumentOfPeriapsisRateRadPerDay,
    meanAnomalyAtEpochRad,
    meanMotionRadPerDay,
    worstLambdaResidual,
  })
}

const entry = (r) => `  ${r.id}: {
    parent: '${r.parent}',
    horizonsCode: '${r.command}',
    fitFromJdTdb: ${r.fitFromJdTdb},
    fitToJdTdb: ${r.fitToJdTdb},
    fitStepDays: ${r.fitStepDays},
    poleRightAscensionRad: ${shortest(r.poleRightAscensionRad, 1e-12)},
    poleDeclinationRad: ${shortest(r.poleDeclinationRad, 1e-12)},
    elements: {
      epochJdTt: 2451545,
      semiMajorAxisKm: ${shortest(r.semiMajorAxisKm, 1e-3)},
      eccentricity: ${shortest(r.eccentricity, 1e-12)},
      inclinationRad: ${shortest(r.inclinationRad, 1e-12)},
      ascendingNodeRad: ${shortest(r.ascendingNodeRad, 1e-12)},
      argumentOfPeriapsisRad: ${shortest(r.argumentOfPeriapsisRad, 1e-12)},
      meanAnomalyAtEpochRad: ${shortest(r.meanAnomalyAtEpochRad, 1e-12)},
      meanMotionRadPerDay: ${shortest(r.meanMotionRadPerDay, 1e-15)},
      ascendingNodeRateRadPerDay: ${shortest(r.ascendingNodeRateRadPerDay, 1e-18)},
      argumentOfPeriapsisRateRadPerDay: ${shortest(r.argumentOfPeriapsisRateRadPerDay, 1e-18)},
    },
  },`

const out = `${HEADER(
  `JPL Horizons osculating elements, ICRF frame, sampled at the body-specific fit ranges and cadences recorded below, reduced to mean elements in each moon's own Laplace plane`,
  'generate-satellites.mjs',
)}
import type { KeplerianElements } from '../kepler.js'

export interface SatelliteRecord {
  /** Body id of the planet this moon orbits. */
  readonly parent: string
  /** Horizons target code, so a fixture can be re-fetched without guessing. */
  readonly horizonsCode: string
  /** First and last JPL Horizons epochs sampled by the element fit. */
  readonly fitFromJdTdb: number
  readonly fitToJdTdb: number
  readonly fitStepDays: number
  /**
   * Pole of this moon's own mean orbit plane (its local Laplace plane), in
   * ICRF. \`elements\` are referred to the plane with this pole, x-axis along
   * that plane's ascending node on the ICRF equator — the basis
   * \`satelliteLaplaceBasis\` rebuilds.
   */
  readonly poleRightAscensionRad: number
  readonly poleDeclinationRad: number
  /** Referred to this moon's Laplace plane, epoch J2000 TT. */
  readonly elements: KeplerianElements
}

/**
 * Mean elements for the selected moons, derived from Horizons as described in
 * \`tools/generate-satellites.mjs\`. These are a FIT, not a satellite theory:
 * see that file and README.md for the residual each one leaves.
 */
export const SATELLITE_ELEMENTS = {
${results.map(entry).join('\n')}
} as const satisfies Record<string, SatelliteRecord>

export type SatelliteId = keyof typeof SATELLITE_ELEMENTS
`
writeRecordSections(new URL('../src/data/satelliteElements.data.ts', import.meta.url), out, 'satellites')

process.stdout.write('satellite   a(km)        e      i_L(deg)   n(rad/d)     node-dot(deg/yr)  peri-dot(deg/yr)  lambda resid(rad)  pole RA/Dec(deg)\n')
for (const r of results) {
  process.stdout.write(
    `${r.id.padEnd(11)} ${r.semiMajorAxisKm.toFixed(0).padStart(9)} ${r.eccentricity.toFixed(5)} ` +
      `${(r.inclinationRad / DEG).toFixed(2).padStart(7)} ${r.meanMotionRadPerDay.toFixed(6).padStart(10)} ` +
      `${((r.ascendingNodeRateRadPerDay / DEG) * 365.25).toFixed(3).padStart(17)} ` +
      `${((r.argumentOfPeriapsisRateRadPerDay / DEG) * 365.25).toFixed(3).padStart(17)} ` +
      `${r.worstLambdaResidual.toFixed(4).padStart(18)}  ` +
      `${((r.poleRightAscensionRad / DEG + 360) % 360).toFixed(1).padStart(6)} ${(r.poleDeclinationRad / DEG).toFixed(1).padStart(6)}\n`,
  )
}
