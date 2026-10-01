import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
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
    assert.equal(new DataView(bytes.buffer).getUint32(0, true), MAGIC)
    assert.equal((bytes.byteLength % ALIGN), 0)
  })

  it('reads numeric columns back', () => {
    const catalog = readCatalog(sample().buffer as ArrayBuffer)
    assert.equal(catalog.count, 3)
    assert.deepEqual(([...catalog.numeric('posPc') as Float32Array]), [1, 2, 3, 4, 5, 6, 7, 8, 9])
    assert.deepEqual(([...catalog.numeric('hip') as Int32Array]), [71683, 32349, 91262])
    assert.deepEqual(([...catalog.numeric('absMag') as Float64Array]), [4.38, 1.42, 0.58])
  })

  it('reads strings back, including non-ascii', () => {
    const bytes = writeCatalog({
      count: 2,
      columns: { name: { type: 'str', data: ['β Cygni', ''] } },
    })
    const catalog = readCatalog(bytes.buffer as ArrayBuffer)
    assert.deepEqual(catalog.strings('name'), ['β Cygni', ''])
  })

  it('carries metadata and column names', () => {
    const catalog = readCatalog(sample().buffer as ArrayBuffer)
    assert.deepEqual(catalog.meta, { source: 'test', epoch: 'J2000' })
    assert.deepEqual(catalog.names, ['posPc', 'hip', 'absMag', 'name'])
  })

  it('aligns every blob so views can be constructed in place', () => {
    const catalog = readCatalog(sample().buffer as ArrayBuffer)
    for (const name of catalog.names) {
      const header = catalog.header(name)
      assert.equal((header.offset % ALIGN), 0)
      if (header.type === 'str') assert.equal((header.indexOffset % ALIGN), 0)
    }
  })

  it('does not copy numeric data', () => {
    const bytes = sample()
    const catalog = readCatalog(bytes.buffer as ArrayBuffer)
    assert.equal((catalog.numeric('hip') as Int32Array).buffer, bytes.buffer)
  })

  it('rejects a row-count mismatch', () => {
    assert.throws(() =>
      writeCatalog({ count: 2, columns: { x: { type: 'f32', components: 3, data: [1, 2, 3] } } }), /components/)
  })

  it('rejects a foreign buffer', () => {
    const junk = new Uint8Array(HEADER_OFFSET)
    assert.throws(() => readCatalog(junk.buffer), /bad magic/)
  })
})
