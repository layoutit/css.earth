import { cached } from './sources.mjs'

export const VSOP87A_BASE = 'https://cdsarc.cds.unistra.fr/ftp/VI/81/'

/**
 * VSOP87A term record, `1x,4i1,i5,12i3,f15.11,2f18.11,f14.11,f20.11`
 * (vsop87.txt, "TERM RECORD"): A in columns 80-97, B in 98-111, C in 112-131.
 * Header record: `17x,i1,4x,a7,12x,i1,17x,i1,i7` — coordinate index in column
 * 42, degree alpha in column 60.
 *
 * Returns `series[coordinate 0..2][alpha] = [{ a, b, c }]` for
 * `T**alpha * A * cos(B + C*T)`, T in thousands of Julian years from J2000.
 */
export function parseVsop87(text) {
  const series = [[], [], []]
  let current = null
  for (const line of text.split('\n')) {
    if (line.length < 20) continue
    if (line.includes('VSOP87 VERSION')) {
      const ic = Number(line.slice(41, 42))
      const alpha = Number(line.slice(59, 60))
      if (!(ic >= 1 && ic <= 3) || !(alpha >= 0 && alpha <= 5)) throw new Error(`bad header: ${line}`)
      if (series[ic - 1][alpha]) throw new Error(`duplicate series ic=${ic} alpha=${alpha}`)
      series[ic - 1][alpha] = []
      current = { terms: series[ic - 1][alpha], declared: Number(line.slice(60, 67)) }
      continue
    }
    if (!current) throw new Error('term record before any header record')
    const a = Number(line.slice(79, 97))
    const b = Number(line.slice(97, 111))
    const cText = line.slice(111, 131).trim()
    const c = Number(cText)
    if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) {
      throw new Error(`bad term record: ${JSON.stringify(line)}`)
    }
    current.terms.push({ a, b, c, cText })
  }
  for (const coord of series) {
    for (let alpha = 0; alpha < coord.length; alpha++) if (!coord[alpha]) coord[alpha] = []
  }
  return series
}

export async function loadVsop87a(bodyKey) {
  return parseVsop87(await cached(`${VSOP87A_BASE}VSOP87A.${bodyKey}`, `VSOP87A.${bodyKey}`))
}

/** Position, in au, in the VSOP87 dynamical ecliptic frame. */
export function evalVsop87(series, T) {
  const out = [0, 0, 0]
  for (let ic = 0; ic < 3; ic++) {
    let sum = 0
    for (let alpha = series[ic].length - 1; alpha >= 0; alpha--) {
      let s = 0
      for (const t of series[ic][alpha]) s += t.a * Math.cos(t.b + t.c * T)
      sum = sum * T + s
    }
    out[ic] = sum
  }
  return out
}

/** d/dT of the above, au per thousand Julian years. */
export function evalVsop87Rate(series, T) {
  const out = [0, 0, 0]
  for (let ic = 0; ic < 3; ic++) {
    let sum = 0
    for (let alpha = 0; alpha < series[ic].length; alpha++) {
      let s = 0
      let ds = 0
      for (const t of series[ic][alpha]) {
        const phase = t.b + t.c * T
        s += t.a * Math.cos(phase)
        ds -= t.a * t.c * Math.sin(phase)
      }
      sum += (alpha === 0 ? 0 : alpha * T ** (alpha - 1) * s) + T ** alpha * ds
    }
    out[ic] = sum
  }
  return out
}
