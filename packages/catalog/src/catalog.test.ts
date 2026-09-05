import { describe, expect, it } from 'vitest'
import { ALIGN, HEADER_OFFSET, MAGIC } from './format.js'
import { readCatalog } from './read.js'
import { writeCatalog } from './write.js'

const sample = () =>
  writeCatalog({
    count: 3,
    columns: {
      posPc: { type: 'f32', components: 3, data: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
      hip: { type: 'i32', data: [71683, 32349, 91262] },
      absMag: { type: 'f64', data: [4.38, 1.42, 0.58] },
      name: { type: 'str', data: ['Rigil Kentaurus', 'Sirius', 'Vega'] },
    },
    meta: { source: 'test', epoch: 'J2000' },
  })

describe('gxct round trip', () => {
  it('writes a recognisable container', () => {
    const bytes = sample()
    expect(new DataView(bytes.buffer).getUint32(0, true)).toBe(MAGIC)
    expect(bytes.byteLength % ALIGN).toBe(0)
  })

  it('reads numeric columns back', () => {
    const catalog = readCatalog(sample().buffer as ArrayBuffer)
    expect(catalog.count).toBe(3)
    expect([...catalog.numeric('posPc') as Float32Array]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect([...catalog.numeric('hip') as Int32Array]).toEqual([71683, 32349, 91262])
    expect([...catalog.numeric('absMag') as Float64Array]).toEqual([4.38, 1.42, 0.58])
  })

  it('reads strings back, including non-ascii', () => {
    const bytes = writeCatalog({
      count: 2,
      columns: { name: { type: 'str', data: ['β Cygni', ''] } },
    })
    const catalog = readCatalog(bytes.buffer as ArrayBuffer)
    expect(catalog.strings('name')).toEqual(['β Cygni', ''])
  })

  it('carries metadata and column names', () => {
    const catalog = readCatalog(sample().buffer as ArrayBuffer)
    expect(catalog.meta).toEqual({ source: 'test', epoch: 'J2000' })
    expect(catalog.names).toEqual(['posPc', 'hip', 'absMag', 'name'])
  })

  it('aligns every blob so views can be constructed in place', () => {
    const catalog = readCatalog(sample().buffer as ArrayBuffer)
    for (const name of catalog.names) {
      const header = catalog.header(name)
      expect(header.offset % ALIGN).toBe(0)
      if (header.type === 'str') expect(header.indexOffset % ALIGN).toBe(0)
    }
  })

  it('does not copy numeric data', () => {
    const bytes = sample()
    const catalog = readCatalog(bytes.buffer as ArrayBuffer)
    expect((catalog.numeric('hip') as Int32Array).buffer).toBe(bytes.buffer)
  })

  it('rejects a row-count mismatch', () => {
    expect(() =>
      writeCatalog({ count: 2, columns: { x: { type: 'f32', components: 3, data: [1, 2, 3] } } }),
    ).toThrow(/components/)
  })

  it('rejects a foreign buffer', () => {
    const junk = new Uint8Array(HEADER_OFFSET)
    expect(() => readCatalog(junk.buffer)).toThrow(/bad magic/)
  })
})
