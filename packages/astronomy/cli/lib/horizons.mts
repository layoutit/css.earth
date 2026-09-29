import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { CACHE_DIR } from './sources.mts'

export type Vector3 = [number, number, number]
export interface VectorRow { jd: number; position: Vector3; velocity: Vector3 }
export interface ElementRow { jd: number; eccentricity: number; inclinationDeg: number; nodeDeg: number; periapsisDeg: number; meanMotionDegPerDay: number; meanAnomalyDeg: number; semiMajorAxisKm: number }
type Command = string | number
interface VectorQuery { command: Command; center: Command; epochsJdTdb: readonly number[]; refPlane?: string; outUnits?: string }
interface ElementQuery { command: Command; center: Command; startJd: number; stopJd: number; stepDays: number }

const HORIZONS = 'https://ssd.jpl.nasa.gov/api/horizons.api'

/**
 * Build a Horizons query URL. Every fixture this repo commits records the URL
 * that produced it, so `curl` reproduces it with no other context.
 *
 * `VEC_CORR='NONE'` is not optional: the default is light-time corrected, and
 * an ephemeris is a geometric statement. `REF_PLANE='FRAME'` gives ICRF
 * equatorial, which is the frame tree's; `'ECLIPTIC'` gives the ecliptic of
 * J2000 built on the IAU 1976 obliquity (see `angles.ts`).
 */
export function vectorsUrl({ command, center, epochsJdTdb, refPlane = 'FRAME', outUnits = 'AU-D' }: VectorQuery) {
  const q = new URLSearchParams({
    format: 'text',
    COMMAND: `'${command}'`,
    OBJ_DATA: 'NO',
    MAKE_EPHEM: 'YES',
    EPHEM_TYPE: 'VECTORS',
    CENTER: `'${center}'`,
    TLIST: epochsJdTdb.join(','),
    TLIST_TYPE: 'JD',
    TIME_TYPE: 'TDB',
    OUT_UNITS: outUnits,
    REF_PLANE: refPlane,
    REF_SYSTEM: 'ICRF',
    VEC_TABLE: '2',
    VEC_CORR: 'NONE',
    CSV_FORMAT: 'YES',
  })
  return `${HORIZONS}?${q}`
}

export function elementsUrl({ command, center, startJd, stopJd, stepDays }: ElementQuery) {
  const q = new URLSearchParams({
    format: 'text',
    COMMAND: `'${command}'`,
    OBJ_DATA: 'NO',
    MAKE_EPHEM: 'YES',
    EPHEM_TYPE: 'ELEMENTS',
    CENTER: `'${center}'`,
    START_TIME: `'JD${startJd}'`,
    STOP_TIME: `'JD${stopJd}'`,
    STEP_SIZE: `'${stepDays}d'`,
    TIME_TYPE: 'TDB',
    OUT_UNITS: 'KM-D',
    REF_PLANE: 'FRAME',
    REF_SYSTEM: 'ICRF',
    CSV_FORMAT: 'YES',
  })
  return `${HORIZONS}?${q}`
}

export function physicalDataUrl(command: Command) {
  const q = new URLSearchParams({ format: 'text', COMMAND: `'${command}'`, OBJ_DATA: 'YES', MAKE_EPHEM: 'NO' })
  return `${HORIZONS}?${q}`
}

export async function horizons(url: string, cacheName: string) {
  const file = `${CACHE_DIR}horizons/${cacheName}.txt`
  mkdirSync(`${CACHE_DIR}horizons/`, { recursive: true })
  if (existsSync(file)) {
    const cached = readFileSync(file, 'utf8')
    if (cached.startsWith(`# ${url}\n`)) return cached.slice(cached.indexOf('\n') + 1)
  }
  process.stderr.write(`horizons ${cacheName}\n`)
  const res = await fetch(url)
  const text = await res.text()
  if (!res.ok) throw new Error(`Horizons ${cacheName} -> HTTP ${res.status}\n${text.slice(0, 800)}`)
  writeFileSync(file, `# ${url}\n${text}`)
  return text
}

const between = (text: string, name: string) => {
  const start = text.indexOf('$$SOE')
  const end = text.indexOf('$$EOE')
  if (start < 0 || end < 0) throw new Error(`Horizons ${name}: no ephemeris block\n${text.slice(0, 1200)}`)
  return text.slice(start + 5, end)
}

/** CSV vector rows: JDTDB, date, X, Y, Z, VX, VY, VZ. */
export function parseVectors(text: string, name = '?'): VectorRow[] {
  const rows: VectorRow[] = []
  for (const line of between(text, name).split('\n')) {
    const f = line.split(',').map((s) => s.trim())
    if (f.length < 8 || !Number.isFinite(Number(f[0]))) continue
    rows.push({
      jd: Number(f[0]),
      position: [Number(f[2]), Number(f[3]), Number(f[4])],
      velocity: [Number(f[5]), Number(f[6]), Number(f[7])],
    })
  }
  if (rows.some(row => ![row.jd, ...row.position, ...row.velocity].every(Number.isFinite))) throw new TypeError(`Horizons ${name}: non-finite vector components`)
  if (!rows.length) throw new Error(`Horizons ${name}: no vector rows`)
  return rows
}

/** CSV element rows: JDTDB, date, EC, QR, IN, OM, W, Tp, N, MA, TA, A, AD, PR. */
export function parseElements(text: string, name = '?'): ElementRow[] {
  const rows: ElementRow[] = []
  for (const line of between(text, name).split('\n')) {
    const f = line.split(',').map((s) => s.trim())
    if (f.length < 14 || !Number.isFinite(Number(f[0]))) continue
    rows.push({
      jd: Number(f[0]),
      eccentricity: Number(f[2]),
      inclinationDeg: Number(f[4]),
      nodeDeg: Number(f[5]),
      periapsisDeg: Number(f[6]),
      meanMotionDegPerDay: Number(f[8]),
      meanAnomalyDeg: Number(f[9]),
      semiMajorAxisKm: Number(f[11]),
    })
  }
  if (rows.some(row => !Object.values(row).every(Number.isFinite))) throw new TypeError(`Horizons ${name}: non-finite element components`)
  if (!rows.length) throw new Error(`Horizons ${name}: no element rows`)
  return rows
}
