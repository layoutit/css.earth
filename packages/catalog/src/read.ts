import {
  HEADER_OFFSET,
  MAGIC,
  TYPED_ARRAYS,
  VERSION,
  isNumericType,
  type CatalogHeader,
  type ColumnHeader,
  type NumericType,
  type NumericArray,
} from './format.js'

export interface Catalog {
  readonly count: number
  readonly meta: Record<string, unknown>
  readonly names: readonly string[]
  header(name: string): ColumnHeader
  /**
   * A typed-array view **over the original buffer** — no copy, so it can be
   * uploaded straight to a GPU buffer. Do not mutate it.
   */
  numeric(name: string): NumericArray
  /** Decoded once per column, then cached. */
  strings(name: string): readonly string[]
}

const decoder = new TextDecoder()

/**
 * Parse a `.gxct` buffer. Nothing is copied: numeric columns are views over
 * `buffer`, and string pools are decoded lazily on first access.
 */
export function readCatalog(buffer: ArrayBuffer): Catalog {
  if (buffer.byteLength < HEADER_OFFSET) throw new Error('gxct: buffer too short')
  const view = new DataView(buffer)
  if (view.getUint32(0, true) !== MAGIC) throw new Error('gxct: bad magic')
  const version = view.getUint32(4, true)
  if (version !== VERSION) throw new Error(`gxct: unsupported version ${version}`)
  const headerLength = view.getUint32(8, true)
  const flags = view.getUint32(12, true)
  if (flags !== 0) throw new Error(`gxct: unsupported flags ${flags}`)

  const headerBytes = new Uint8Array(buffer, HEADER_OFFSET, headerLength)
  const header = JSON.parse(decoder.decode(headerBytes)) as CatalogHeader
  const byName = new Map<string, ColumnHeader>(header.columns.map((c) => [c.name, c]))
  const stringCache = new Map<string, readonly string[]>()

  const lookup = (name: string): ColumnHeader => {
    const column = byName.get(name)
    if (!column) throw new Error(`gxct: no column ${name}`)
    return column
  }

  return {
    count: header.count,
    meta: header.meta ?? {},
    names: header.columns.map((c) => c.name),
    header: lookup,
    numeric(name) {
      const column = lookup(name)
      if (!isNumericType(column.type)) throw new Error(`gxct: column ${name} is not numeric`)
      const Ctor = TYPED_ARRAYS[column.type as NumericType]
      return new Ctor(buffer, column.offset, column.length / Ctor.BYTES_PER_ELEMENT)
    },
    strings(name) {
      const cached = stringCache.get(name)
      if (cached) return cached
      const column = lookup(name)
      if (column.type !== 'str') throw new Error(`gxct: column ${name} is not a string column`)
      const index = new Uint32Array(buffer, column.indexOffset, column.indexLength / 4)
      const pool = new Uint8Array(buffer, column.offset, column.length)
      const values = new Array<string>(header.count)
      for (let i = 0; i < header.count; i++) {
        values[i] = decoder.decode(pool.subarray(index[i]!, index[i + 1]!))
      }
      stringCache.set(name, values)
      return values
    },
  }
}
