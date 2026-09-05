// Shared helpers for the code generators in this directory. Node-only: nothing
// here is part of the published package.
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export const CACHE_DIR = new URL('../.cache/', import.meta.url).pathname

/** Download once into `tools/.cache`, which is gitignored. */
export async function cached(url, name) {
  const file = CACHE_DIR + name
  mkdirSync(dirname(file), { recursive: true })
  if (existsSync(file)) return readFileSync(file, 'latin1')
  process.stderr.write(`fetching ${url}\n`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`)
  const text = Buffer.from(await res.arrayBuffer()).toString('latin1')
  writeFileSync(file, text, 'latin1')
  return text
}

/**
 * Shortest decimal literal that reproduces `x` to within `absTol`. Generated
 * data files are big; emitting `0.99982927460` instead of the full float64
 * expansion is worth roughly a third of the file.
 */
export function shortest(x, absTol) {
  if (x === 0) return '0'
  for (let p = 1; p <= 17; p++) {
    const s = x.toPrecision(p)
    if (Math.abs(Number(s) - x) <= absTol) return String(Number(s))
  }
  return String(x)
}

export const HEADER = (source, generator) =>
  `// GENERATED FILE — do not edit by hand.
//
// Source:    ${source}
// Generator: packages/astronomy/tools/${generator}
//
// Regenerate with \`node tools/${generator}\` from packages/astronomy. The
// generator re-downloads the source series, re-derives the truncation, and
// prints the error budget it certifies; the numbers in README.md come from it.
`
