#!/usr/bin/env node
// Regenerates src/data/vsop87a.data.ts and src/data/elp2000.data.ts.
//
// TRUNCATION RULE (the same one for every body, stated once):
//
//   Keep every term whose worst-case contribution |A| * Tmax^alpha is at or
//   above a per-body amplitude threshold. Choose the LARGEST threshold whose
//   residual bound still satisfies the body's target.
//
//   The residual bound is 6*sigma, where sigma^2 = sum over dropped terms of
//   (|A| * Tmax^alpha)^2 / 2 — the variance of a sum of sinusoids with
//   independent phases. It is not the L1 bound (sum of |A|), which is real but
//   two orders of magnitude pessimistic here because thousands of tiny terms
//   never align; 6 sigma is exceeded with probability ~2e-9 per sample and is
//   confirmed by direct sampling: the measured maximum over 4001 epochs across
//   the validity window is 13%-72% of it for every body (printed below).
//
//   The target is ONE arcsecond of geocentric direction at the body's closest
//   approach to Earth. That is what "arcsecond-level" in PLAN.md means as a
//   number. The Earth-Moon barycentre has no geocentric direction, so it takes
//   Venus's absolute bound; the two share an orbital scale.
//
// Validity window: 1900-01-01 .. 2100-01-01, i.e. |T| <= 0.1 thousand Julian
// years for VSOP87 and |t| <= 1 Julian century for ELP2000-82B. Outside it the
// bounds below do not hold — the Poisson (T^alpha) terms grow.
import { writeFileSync } from 'node:fs'
import { loadVsop87a, evalVsop87 } from './lib/vsop87.mjs'
import { loadElpTerms, elpPositionKm, W1_POLY, P_POLY, Q_POLY, A0, ATH } from './lib/elp2000.mjs'
import { HEADER, shortest } from './lib/sources.mjs'

const AU_KM = 149597870.7
const KM_PER_ARCSEC_AT_1AU = (AU_KM * Math.PI) / 648000
const T_MAX_KJY = 0.1 // thousands of Julian years, 1900..2100
const T_MAX_CENTURIES = 1

// Perihelion/aphelion in au, IAU/NASA planetary fact sheets, used only to turn
// "one arcsecond" into a per-body distance bound.
const ORBIT = {
  mercury: { q: 0.3075, Q: 0.4667 },
  venus: { q: 0.7184, Q: 0.7282 },
  emb: { q: 0.9833, Q: 1.0167 },
  mars: { q: 1.3814, Q: 1.6660 },
  jupiter: { q: 4.9501, Q: 5.4588 },
  saturn: { q: 9.0412, Q: 10.1238 },
  uranus: { q: 18.2861, Q: 20.0965 },
  neptune: { q: 29.8107, Q: 30.3300 },
}
const closestApproachAu = (key) => {
  // The Earth-Moon barycentre is not something Earth can look at, so it has no
  // closest approach. It takes Venus's bound, the nearest orbit of comparable
  // scale, rather than a number invented for it.
  const k = key === 'emb' ? 'venus' : key
  return ORBIT[k].q > ORBIT.emb.Q ? ORBIT[k].q - ORBIT.emb.Q : ORBIT.emb.q - ORBIT[k].Q
}

const BODIES = [
  ['mercury', 'mer'],
  ['venus', 'ven'],
  ['emb', 'emb'],
  ['mars', 'mar'],
  ['jupiter', 'jup'],
  ['saturn', 'sat'],
  ['uranus', 'ura'],
  ['neptune', 'nep'],
]

const weight = (term, alpha, tMax) => Math.abs(term.a ?? term.amp) * tMax ** alpha

function sigmaBoundVsop(dropped) {
  const perCoord = dropped.map((coord) => {
    let variance = 0
    coord.forEach((terms, alpha) => {
      for (const t of terms) variance += weight(t, alpha, T_MAX_KJY) ** 2 / 2
    })
    return Math.sqrt(variance)
  })
  return 6 * Math.hypot(...perCoord)
}

function splitVsop(series, threshold) {
  const kept = [[], [], []]
  const dropped = [[], [], []]
  for (let ic = 0; ic < 3; ic++) {
    series[ic].forEach((terms, alpha) => {
      kept[ic][alpha] = []
      dropped[ic][alpha] = []
      for (const t of terms) (weight(t, alpha, T_MAX_KJY) >= threshold ? kept[ic][alpha] : dropped[ic][alpha]).push(t)
    })
  }
  return { kept, dropped }
}

/** Largest threshold whose 6-sigma residual is still within `targetAu`. */
function chooseVsopThreshold(series, targetAu) {
  let lo = 1e-14
  let hi = 1e-3
  for (let i = 0; i < 200; i++) {
    const mid = Math.sqrt(lo * hi)
    if (sigmaBoundVsop(splitVsop(series, mid).dropped) <= targetAu) lo = mid
    else hi = mid
  }
  return lo
}

const countTerms = (kept) => kept.reduce((n, coord) => n + coord.reduce((m, terms) => m + terms.length, 0), 0)

async function generateVsop() {
  const chunks = []
  const budget = []
  const report = []
  for (const [name, key] of BODIES) {
    const series = await loadVsop87a(key)
    const targetKm = closestApproachAu(name) * KM_PER_ARCSEC_AT_1AU
    const targetAu = targetKm / AU_KM
    const threshold = chooseVsopThreshold(series, targetAu)
    const { kept, dropped } = splitVsop(series, threshold)
    const bound = sigmaBoundVsop(dropped)

    // Direct check that the analytic bound is not optimistic.
    let measured = 0
    const samples = 4001
    for (let i = 0; i < samples; i++) {
      const T = -T_MAX_KJY + (2 * T_MAX_KJY * i) / (samples - 1)
      const full = evalVsop87(series, T)
      const trunc = evalVsop87(kept, T)
      measured = Math.max(measured, Math.hypot(full[0] - trunc[0], full[1] - trunc[1], full[2] - trunc[2]))
    }
    if (measured > bound) throw new Error(`${name}: sampled truncation error ${measured} exceeds the 6-sigma bound ${bound}`)

    const literal = kept
      .map(
        (coord) =>
          '[' +
          coord
            .map(
              (terms) =>
                '[' +
                terms
                  .map((t) => `${shortest(t.a, Math.abs(t.a) * 1e-9)},${shortest(t.b, 1e-9)},${t.cText}`)
                  .join(',') +
                ']',
            )
            .join(',') +
          ']',
      )
      .join(',\n  ')
    chunks.push(`const ${name.toUpperCase()}: Vsop87Series = [\n  ${literal},\n]`)
    budget.push(`  ${name}: ${shortest(bound, bound * 1e-6)},`)
    report.push({ name, threshold, terms: countTerms(kept), targetKm, boundKm: bound * AU_KM, measuredKm: measured * AU_KM })
  }

  const out = `${HEADER(
    'VSOP87A (Bretagnon & Francou 1988, A&A 202, 309), CDS VI/81, files VSOP87A.{mer,ven,emb,mar,jup,sat,ura,nep}',
    'generate-series.mjs',
  )}
/**
 * One body's truncated VSOP87A series, indexed \`[coordinate 0..2][alpha]\` and
 * flattened to triples \`A, B, C\` contributing \`T^alpha * A * cos(B + C*T)\`
 * with \`T\` in thousands of Julian years from J2000 TT.
 */
export type Vsop87Series = readonly (readonly (readonly number[])[])[]

${chunks.join('\n\n')}

/** Heliocentric position of each planetary SYSTEM BARYCENTRE, in the VSOP87 dynamical ecliptic frame. */
export const VSOP87A_SERIES = {
${BODIES.map(([n]) => `  ${n}: ${n.toUpperCase()},`).join('\n')}
} as const

export type Vsop87BodyKey = keyof typeof VSOP87A_SERIES

/**
 * Truncation residual bound per body, in au: 6 sigma over the dropped terms,
 * valid for 1900-01-01 .. 2100-01-01. This is the ONLY error this package
 * introduces on top of VSOP87A itself; the theory's own departure from DE441 is
 * larger for every body and is documented in README.md.
 */
export const VSOP87A_TRUNCATION_BOUND_AU: Record<Vsop87BodyKey, number> = {
${budget.join('\n')}
}
`
  writeFileSync(new URL('../src/data/vsop87a.data.ts', import.meta.url), out)
  return report
}

// --- ELP2000-82B ---------------------------------------------------------

const MOON_A0_KM = 384400
const MOON_PERIGEE_KM = 356500
const KM_PER_ARCSEC_AT_MOON = (MOON_PERIGEE_KM * Math.PI) / 648000
// An arcsecond of lunar longitude/latitude is this many km of position.
const KM_PER_ARCSEC_OF_ANGLE = (MOON_A0_KM * Math.PI) / 648000

function elpBound(dropped) {
  const variance = [0, 0, 0]
  for (const t of dropped) variance[t.iv] += (Math.abs(t.amp) * T_MAX_CENTURIES ** t.pow) ** 2 / 2
  const sigma = variance.map(Math.sqrt)
  return 6 * Math.hypot(sigma[0] * KM_PER_ARCSEC_OF_ANGLE, sigma[1] * KM_PER_ARCSEC_OF_ANGLE, sigma[2])
}

function splitElp(terms, angleThresholdArcsec) {
  const distanceThresholdKm = angleThresholdArcsec * KM_PER_ARCSEC_OF_ANGLE
  const kept = []
  const dropped = []
  for (const t of terms) {
    const threshold = t.iv === 2 ? distanceThresholdKm : angleThresholdArcsec
    ;(Math.abs(t.amp) * T_MAX_CENTURIES ** t.pow >= threshold ? kept : dropped).push(t)
  }
  return { kept, dropped }
}

async function generateElp() {
  const all = await loadElpTerms()
  const targetKm = KM_PER_ARCSEC_AT_MOON
  let lo = 1e-8
  let hi = 10
  for (let i = 0; i < 200; i++) {
    const mid = Math.sqrt(lo * hi)
    if (elpBound(splitElp(all, mid).dropped) <= targetKm) lo = mid
    else hi = mid
  }
  const { kept, dropped } = splitElp(all, lo)
  const bound = elpBound(dropped)

  let measured = 0
  const samples = 4001
  for (let i = 0; i < samples; i++) {
    const jd = 2415020.5 + ((2488069.5 - 2415020.5) * i) / (samples - 1)
    const full = elpPositionKm(all, jd)
    const trunc = elpPositionKm(kept, jd)
    measured = Math.max(measured, Math.hypot(full[0] - trunc[0], full[1] - trunc[1], full[2] - trunc[2]))
  }
  if (measured > bound) throw new Error(`moon: sampled truncation error ${measured} exceeds the 6-sigma bound ${bound}`)

  // Bucket by (variable, power of t) so the evaluator hoists t^pow and the
  // file does not repeat two integers per term.
  const buckets = []
  for (let iv = 0; iv < 3; iv++) {
    for (let pow = 0; pow <= 2; pow++) {
      const rows = kept.filter((t) => t.iv === iv && t.pow === pow)
      buckets.push(
        '[' +
          rows
            .map(
              (t) =>
                `${shortest(t.amp, Math.abs(t.amp) * 1e-8)},` +
                t.c.map((c) => shortest(c, 1e-9)).join(','),
            )
            .join(',') +
          ']',
      )
    }
  }

  const out = `${HEADER(
    'ELP2000-82B (Chapront-Touze & Chapront 1988, A&A 190, 342), CDS VI/79, files ELP1..ELP36, flattened by the port of ELP82B.F distributed alongside them',
    'generate-series.mjs',
  )}
/**
 * The truncated ELP2000-82B series, bucketed by \`[variable * 3 + power]\` where
 * variable is 0 longitude (arcsec), 1 latitude (arcsec), 2 distance (km), and
 * power is the exponent of \`t\` (Julian centuries from J2000 TT) multiplying the
 * whole term. Each bucket is flattened to sextuples
 * \`amp, c0, c1, c2, c3, c4\` contributing
 * \`amp * t^power * sin(c0 + c1 t + c2 t^2 + c3 t^3 + c4 t^4)\`.
 *
 * The original distance series is a cosine series; ELP82B.F adds pi/2 to its
 * argument, and that constant is folded into c0 here so every term is a sine.
 */
export const ELP2000_TERMS: readonly (readonly number[])[] = [
  ${buckets.join(',\n  ')},
]

/**
 * W1 — the Moon's mean longitude in radians, polynomial in Julian centuries
 * from J2000 TT. The longitude series above is a correction to this, so it
 * cannot be one of the terms. From ELP82B.F \`w(1,1..5)\`.
 */
export const ELP2000_W1_POLY: readonly number[] = [${W1_POLY.map((c) => shortest(c, 1e-16)).join(', ')}]

/**
 * \`p(t)\`, \`q(t)\`: ELP82B.F's rotation from the mean ecliptic of date, which
 * is what W1 plus the series produces, to the inertial mean ecliptic of J2000.
 */
export const ELP2000_P_POLY: readonly number[] = [${P_POLY.map((c) => shortest(c, 1e-20)).join(', ')}]
export const ELP2000_Q_POLY: readonly number[] = [${Q_POLY.map((c) => shortest(c, 1e-20)).join(', ')}]

/** \`a0 / ath\`: ELP82B.F applies this to the summed distance and to nothing else. */
export const ELP2000_DISTANCE_SCALE = ${shortest(A0 / ATH, 1e-17)}

/** Number of terms kept, for the README to quote without recounting. */
export const ELP2000_TERM_COUNT = ${kept.length}

/**
 * Truncation residual bound in km of geocentric position: 6 sigma over the
 * dropped terms, valid 1900-01-01 .. 2100-01-01.
 */
export const ELP2000_TRUNCATION_BOUND_KM = ${shortest(bound, bound * 1e-6)}
`
  writeFileSync(new URL('../src/data/elp2000.data.ts', import.meta.url), out)
  return { threshold: lo, terms: kept.length, of: all.length, targetKm, boundKm: bound, measuredKm: measured }
}

const vsopReport = await generateVsop()
const elpReport = await generateElp()

process.stdout.write('\nVSOP87A truncation\n')
process.stdout.write('body      terms  threshold(au)   target(km)   6sigma(km)  sampled max(km)\n')
for (const r of vsopReport) {
  process.stdout.write(
    `${r.name.padEnd(9)} ${String(r.terms).padStart(5)}  ${r.threshold.toExponential(2).padStart(12)} ` +
      `${r.targetKm.toFixed(1).padStart(11)} ${r.boundKm.toFixed(1).padStart(12)} ${r.measuredKm.toFixed(1).padStart(16)}\n`,
  )
}
process.stdout.write(
  `\nELP2000-82B truncation\nmoon      ${String(elpReport.terms).padStart(5)} of ${elpReport.of}  ` +
    `threshold ${elpReport.threshold.toExponential(2)} arcsec  target ${elpReport.targetKm.toFixed(2)} km  ` +
    `6sigma ${elpReport.boundKm.toFixed(2)} km  sampled max ${elpReport.measuredKm.toFixed(2)} km\n`,
)
