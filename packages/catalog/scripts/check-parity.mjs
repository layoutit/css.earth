#!/usr/bin/env node
/**
 * Cross-language parity for the .gxct format.
 *
 * The Python writer builds every shipped catalogue; the TypeScript reader is
 * what the browser runs. Unit tests on each side prove each is self-consistent
 * and prove nothing about the pair, which is the only thing that matters.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

let readCatalog
try {
  ;({ readCatalog } = await import(join(here, '../dist/index.js')))
} catch {
  console.error('check:parity needs the built package — run `pnpm build:packages` first.')
  process.exit(1)
}

const work = mkdtempSync(join(tmpdir(), 'gxct-parity-'))
const file = join(work, 'fixture.gxct')
try {
  execFileSync('python3', [join(here, 'gen_fixture.py'), file], { stdio: 'inherit' })
  const bytes = readFileSync(file)
  const catalog = readCatalog(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))

  const failures = []
  const check = (label, actual, expected) => {
    const a = JSON.stringify(actual)
    const b = JSON.stringify(expected)
    if (a !== b) failures.push(`${label}: got ${a}, expected ${b}`)
  }

  check('count', catalog.count, 3)
  check('names', catalog.names, ['posPc', 'hip', 'absMag', 'name'])
  check('posPc', [...catalog.numeric('posPc')], [1, 2, 3, 4, 5, 6, 7, 8, 9])
  check('hip', [...catalog.numeric('hip')], [71683, 32349, 91262])
  check('absMag', [...catalog.numeric('absMag')], [4.38, 1.42, 0.58])
  check('name', catalog.strings('name'), ['Rigil Kentaurus', 'Sirius', 'β Cygni'])
  check('meta.source', catalog.meta.source, 'parity-fixture')

  if (failures.length > 0) {
    console.error('gxct parity FAILED:')
    for (const failure of failures) console.error(`  - ${failure}`)
    process.exit(1)
  }
  console.log('gxct parity ok — Python writer, TypeScript reader, 4 columns, 3 rows')
} finally {
  rmSync(work, { recursive: true, force: true })
}
