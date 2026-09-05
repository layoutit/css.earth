import {
  ALIGN,
  HEADER_OFFSET,
  MAGIC,
  TYPED_ARRAYS,
  VERSION,
  alignUp,
  isNumericType,
  type CatalogHeader,
  type ColumnHeader,
  type NumericType,
} from './format.js'

export interface NumericColumnInput {
  type: NumericType
  /** Values per row. 3 for a position, 1 for a scalar. Defaults to 1. */
  components?: number
  data: ArrayLike<number>
}

export interface StringColumnInput {
  type: 'str'
  data: readonly string[]
}

export type ColumnInput = NumericColumnInput | StringColumnInput

export interface CatalogInput {
  count: number
  columns: Record<string, ColumnInput>
  meta?: Record<string, unknown>
}

/**
 * Serialise columns into a `.gxct` buffer.
 *
 * The reference implementation is the Python writer in `pipeline/` — that is
 * what builds the shipped data. This one exists for tests, fixtures and
 * anything the browser needs to round-trip; `pnpm check:parity` proves they
 * agree.
 */
export function writeCatalog(input: CatalogInput): Uint8Array {
  const { count, columns, meta = {} } = input
  const encoder = new TextEncoder()

  const blobs: Uint8Array[] = []
  const headers: ColumnHeader[] = []
  // Placeholder offsets: the header is serialised twice because its own length
  // shifts where the blobs land. Second pass uses the real numbers.
  for (const [name, column] of Object.entries(columns)) {
    if (column.type === 'str') {
      if (column.data.length !== count) {
        throw new Error(`column ${name}: ${column.data.length} strings for count ${count}`)
      }
      const bytes = column.data.map((value) => encoder.encode(value))
      const index = new Uint32Array(count + 1)
      let cursor = 0
      for (let i = 0; i < count; i++) {
        index[i] = cursor
        cursor += bytes[i]!.length
      }
      index[count] = cursor
      const pool = new Uint8Array(cursor)
      for (let i = 0; i < count; i++) pool.set(bytes[i]!, index[i]!)
      headers.push({ name, type: 'str', offset: 0, length: pool.byteLength, indexOffset: 0, indexLength: index.byteLength })
      blobs.push(new Uint8Array(index.buffer), pool)
    } else {
      if (!isNumericType(column.type)) throw new Error(`column ${name}: unknown type ${column.type}`)
      const components = column.components ?? 1
      if (column.data.length !== count * components) {
        throw new Error(
          `column ${name}: ${column.data.length} values for count ${count} × ${components} components`,
        )
      }
      const array = new TYPED_ARRAYS[column.type](column.data)
      const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength)
      headers.push({ name, type: column.type, components, offset: 0, length: bytes.byteLength })
      blobs.push(bytes)
    }
  }

  const layout = (headerLength: number): number => {
    let cursor = alignUp(HEADER_OFFSET + headerLength)
    let blob = 0
    for (const header of headers) {
      if (header.type === 'str') {
        header.indexOffset = cursor
        cursor = alignUp(cursor + blobs[blob++]!.byteLength)
        header.offset = cursor
        cursor = alignUp(cursor + blobs[blob++]!.byteLength)
      } else {
        header.offset = cursor
        cursor = alignUp(cursor + blobs[blob++]!.byteLength)
      }
    }
    return cursor
  }

  const serialise = (): Uint8Array =>
    encoder.encode(JSON.stringify({ count, columns: headers, meta } satisfies CatalogHeader))

  // The header records absolute blob offsets, so its own length depends on the
  // offsets it contains. Rather than iterate to a fixed point, reserve slack:
  // 20 bytes per column is more than any offset can grow by (a byte offset in a
  // file this side of 2^53 is at most 16 digits), and the slack is space-padded.
  // JSON.parse ignores trailing whitespace, so the reader needs no special case.
  const reservedHeaderLength = alignUp(serialise().byteLength + 20 * headers.length)
  const total = layout(reservedHeaderLength)
  const headerBytes = serialise()
  if (headerBytes.byteLength > reservedHeaderLength) {
    throw new Error('internal: header slack exhausted')
  }

  const out = new Uint8Array(total)
  const view = new DataView(out.buffer)
  view.setUint32(0, MAGIC, true)
  view.setUint32(4, VERSION, true)
  view.setUint32(8, reservedHeaderLength, true)
  view.setUint32(12, 0, true)
  out.set(headerBytes, HEADER_OFFSET)
  out.fill(0x20, HEADER_OFFSET + headerBytes.byteLength, HEADER_OFFSET + reservedHeaderLength)

  let blob = 0
  for (const header of headers) {
    if (header.type === 'str') {
      out.set(blobs[blob++]!, header.indexOffset)
      out.set(blobs[blob++]!, header.offset)
    } else {
      out.set(blobs[blob++]!, header.offset)
    }
  }
  if (blob !== blobs.length) throw new Error('internal: blob count mismatch')
  if (out.byteLength % ALIGN !== 0) throw new Error('internal: unaligned total length')
  return out
}
