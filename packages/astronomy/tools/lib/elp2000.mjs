import { cached } from './sources.mjs'

export const ELP_BASE = 'https://cdsarc.cds.unistra.fr/ftp/VI/79/'

// Everything below is a direct port of ELP82B.F (Bureau des Longitudes,
// MCTJCGF9502, distributed with the series as VI/79/elp82b.f). Constant names
// follow the Fortran so the two can be diffed by eye.
const CPI = Math.PI
const RAD = 648000 / CPI
const DEG = CPI / 180
export const ATH = 384747.9806743165
export const A0 = 384747.9806448954
const AM = 0.074801329518
const ALFA = 0.002571881335
const DTASM = (2 * ALFA) / (3 * AM)

const dms = (d, m, s) => (d + m / 60 + s / 3600) * DEG

const W = [
  [dms(218, 18, 59.95571), 1732559343.73604 / RAD, -5.8883 / RAD, 0.6604e-2 / RAD, -0.3169e-4 / RAD],
  [dms(83, 21, 11.67475), 14643420.2632 / RAD, -38.2776 / RAD, -0.45047e-1 / RAD, 0.21301e-3 / RAD],
  [dms(125, 2, 40.39816), -6967919.3622 / RAD, 6.3622 / RAD, 0.7625e-2 / RAD, -0.3586e-4 / RAD],
]
const EART = [dms(100, 27, 59.22059), 129597742.2758 / RAD, -0.0202 / RAD, 0.9e-5 / RAD, 0.15e-6 / RAD]
const PERI = [dms(102, 56, 14.42753), 1161.2283 / RAD, 0.5327 / RAD, -0.138e-3 / RAD, 0]
const PRECES = 5029.0966 / RAD
const P = [
  [dms(252, 15, 3.25986), 538101628.68898 / RAD],
  [dms(181, 58, 47.28305), 210664136.43355 / RAD],
  [EART[0], EART[1]],
  [dms(355, 25, 59.78866), 68905077.59284 / RAD],
  [dms(34, 21, 5.34212), 10925660.42861 / RAD],
  [dms(50, 4, 38.89694), 4399609.65932 / RAD],
  [dms(314, 3, 18.01841), 1542481.19393 / RAD],
  [dms(304, 20, 55.19575), 786550.32074 / RAD],
]
const DELNU = 0.55604 / RAD / W[0][1]
const DELE = 0.01789 / RAD
const DELG = -0.08066 / RAD
const DELNP = -0.06424 / RAD / W[0][1]
const DELEP = -0.12879 / RAD

// Delaunay arguments D, l', l, F as polynomials in t (Julian centuries).
const DEL = [[], [], [], []]
for (let k = 0; k < 5; k++) {
  DEL[0][k] = W[0][k] - EART[k]
  DEL[3][k] = W[0][k] - W[2][k]
  DEL[2][k] = W[0][k] - W[1][k]
  DEL[1][k] = EART[k] - PERI[k]
}
DEL[0][0] += CPI
const ZETA = [W[0][0], W[0][1] + PRECES]

/** W1: the Moon's mean longitude, polynomial in Julian centuries. */
export const W1_POLY = W[0]
/** Laplace-plane precession polynomials p(t), q(t) of the final rotation. */
export const P_POLY = [0.10180391e-4, 0.47020439e-6, -0.5417367e-9, -0.2507948e-11, 0.463486e-14]
export const Q_POLY = [-0.113469002e-3, 0.12372674e-6, 0.1265417e-8, -0.1371808e-11, -0.320334e-14]

const num = (line, a, b) => Number(line.slice(a, b).trim())
const int = (line, a, b) => {
  const s = line.slice(a, b).trim()
  return s === '' ? 0 : Number(s)
}

/**
 * Flatten all 36 ELP2000-82B files into one term list:
 *   { iv, pow, amp, c: [c0..c4] }  ->  amp * t^pow * sin(c0 + c1 t + ... + c4 t^4)
 * with iv 0 = longitude (arcsec), 1 = latitude (arcsec), 2 = distance (km).
 *
 * The flattening is exact: ELP82B.F builds every argument as a linear
 * combination of arguments that are themselves polynomials in t, so the sum is
 * a polynomial in t and can be pre-summed once at generation time. The
 * distance series is a cosine series in the original; the +π/2 the Fortran adds
 * for `iv=3` is folded into c0 here, which is why everything below is a sine.
 */
export async function loadElpTerms() {
  const terms = []
  for (let ific = 1; ific <= 36; ific++) {
    const text = await cached(`${ELP_BASE}ELP${ific}`, `ELP${ific}`)
    const lines = text.split('\n').slice(1) // one header record per file
    const iv = (ific - 1) % 3
    for (const line of lines) {
      if (line.trim().length === 0) continue
      if (ific <= 3) {
        // Main problem: 4i3,2x,f13.5,6(2x,f10.2)
        const ilu = [int(line, 0, 3), int(line, 3, 6), int(line, 6, 9), int(line, 9, 12)]
        const coef = [num(line, 14, 27)]
        for (let j = 1; j <= 6; j++) coef[j] = num(line, 29 + (j - 1) * 12, 27 + j * 12)
        let amp = coef[0]
        const tgv = coef[1] + DTASM * coef[5]
        if (ific === 3) amp -= (2 * amp * DELNU) / 3
        amp += tgv * (DELNP - AM * DELNU) + coef[2] * DELG + coef[3] * DELE + coef[4] * DELEP
        const c = [0, 0, 0, 0, 0]
        for (let k = 0; k < 5; k++) for (let i = 0; i < 4; i++) c[k] += ilu[i] * DEL[i][k]
        if (iv === 2) c[0] += CPI / 2
        terms.push({ iv, pow: 0, amp, c })
      } else if (ific <= 9 || ific >= 22) {
        // Figure / tides / relativity / solar eccentricity: 5i3,1x,f9.5,1x,f9.5,1x,f9.3
        const iz = int(line, 0, 3)
        const ilu = [int(line, 3, 6), int(line, 6, 9), int(line, 9, 12), int(line, 12, 15)]
        const pha = num(line, 16, 25)
        const amp = num(line, 26, 35)
        let pow = 0
        if ((ific >= 7 && ific <= 9) || (ific >= 25 && ific <= 27)) pow = 1
        if (ific >= 34) pow = 2
        const c = [pha * DEG, 0, 0, 0, 0]
        for (let k = 0; k < 2; k++) {
          c[k] += iz * ZETA[k]
          for (let i = 0; i < 4; i++) c[k] += ilu[i] * DEL[i][k]
        }
        terms.push({ iv, pow, amp, c })
      } else {
        // Planetary perturbations: 11i3,1x,f9.5,1x,f9.5,1x,f9.3
        const ipla = []
        for (let i = 0; i < 11; i++) ipla[i] = int(line, i * 3, i * 3 + 3)
        const pha = num(line, 34, 43)
        const amp = num(line, 44, 53)
        const pow = (ific >= 13 && ific <= 15) || (ific >= 19 && ific <= 21) ? 1 : 0
        const c = [pha * DEG, 0, 0, 0, 0]
        for (let k = 0; k < 2; k++) {
          if (ific < 16) {
            c[k] += ipla[8] * DEL[0][k] + ipla[9] * DEL[2][k] + ipla[10] * DEL[3][k]
            for (let i = 0; i < 8; i++) c[k] += ipla[i] * P[i][k]
          } else {
            for (let i = 0; i < 4; i++) c[k] += ipla[i + 7] * DEL[i][k]
            for (let i = 0; i < 7; i++) c[k] += ipla[i] * P[i][k]
          }
        }
        terms.push({ iv, pow, amp, c })
      }
    }
  }
  return terms
}

/** Reference evaluator over an unflattened term list. Geocentric km, dynamical ecliptic J2000. */
export function elpPositionKm(terms, jdTt) {
  const t = (jdTt - 2451545) / 36525
  const acc = [0, 0, 0]
  for (const term of terms) {
    const c = term.c
    const y = c[0] + t * (c[1] + t * (c[2] + t * (c[3] + t * c[4])))
    acc[term.iv] += term.amp * t ** term.pow * Math.sin(y)
  }
  const lon = acc[0] / RAD + W[0][0] + t * (W[0][1] + t * (W[0][2] + t * (W[0][3] + t * W[0][4])))
  const lat = acc[1] / RAD
  const dist = acc[2] * (A0 / ATH)
  const cosLat = Math.cos(lat)
  const x1 = dist * cosLat * Math.cos(lon)
  const x2 = dist * cosLat * Math.sin(lon)
  const x3 = dist * Math.sin(lat)
  const pw = (P_POLY[0] + t * (P_POLY[1] + t * (P_POLY[2] + t * (P_POLY[3] + t * P_POLY[4])))) * t
  const qw = (Q_POLY[0] + t * (Q_POLY[1] + t * (Q_POLY[2] + t * (Q_POLY[3] + t * Q_POLY[4])))) * t
  const ra = 2 * Math.sqrt(1 - pw * pw - qw * qw)
  const pwqw = 2 * pw * qw
  const pw2 = 1 - 2 * pw * pw
  const qw2 = 1 - 2 * qw * qw
  const pwr = pw * ra
  const qwr = qw * ra
  return [
    pw2 * x1 + pwqw * x2 + pwr * x3,
    pwqw * x1 + qw2 * x2 - qwr * x3,
    -pwr * x1 + qwr * x2 + (pw2 + qw2 - 1) * x3,
  ]
}
