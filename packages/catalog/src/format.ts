/**
 * The `.gxct` container. See FORMAT.md for the byte-level spec — this file is
 * the machine-readable half of it and the two must not drift.
 *
 * Layout:
 *   0   magic 'GXCT'
 *   4   uint32 version
 *   8   uint32 header length, in bytes
 *   12   uint32 flags (reserved, must be 0)
 *   16   JSON header, space-padded to ALIGN
 *   ...  column blobs, each ALIGN-aligned, offsets absolute from file start
 */
export const MAGIC = 0x54435847 // 'GXCT' little-endian
export const VERSION = 1
export const HEADER_OFFSET = 16

/**
 * Blobs are 8-byte aligned so every typed-array view can be constructed
 * directly over the file buffer. Dropping below 8 breaks `Float64Array`.
 */
export const ALIGN = 8

export type NumericType = 'f64' | 'f32' | 'i32' | 'u32' | 'i16' | 'u16' | 'i8' | 'u8'
export type ColumnType = NumericType | 'str'

/**
 * One structural constructor type covering all eight typed arrays. A union of
 * the concrete constructors is not callable in TypeScript, and every call site
 * here uses only these three overloads.
 */
export type NumericArray = Float64Array | Float32Array | Int32Array | Uint32Array | Int16Array | Uint16Array | Int8Array | Uint8Array

export interface TypedArrayCtor {
  new (values: ArrayLike<number>): NumericArray
  new (buffer: ArrayBufferLike, byteOffset: number, length: number): NumericArray
  readonly BYTES_PER_ELEMENT: number
}

export const TYPED_ARRAYS: Record<NumericType, TypedArrayCtor> = {
  f64: Float64Array,
  f32: Float32Array,
  i32: Int32Array,
  u32: Uint32Array,
  i16: Int16Array,
  u16: Uint16Array,
  i8: Int8Array,
  u8: Uint8Array,
}

export const isNumericType = (type: string): type is NumericType =>
  Object.prototype.hasOwnProperty.call(TYPED_ARRAYS, type)

/** Header entry for a column of numbers, `components` values per row. */
export interface NumericColumnHeader {
  name: string
  type: NumericType
  components: number
  offset: number
  length: number
}

/**
 * Header entry for a column of strings: a utf8 byte pool plus a uint32 index
 * of `count + 1` boundaries into it.
 */
export interface StringColumnHeader {
  name: string
  type: 'str'
  offset: number
  length: number
  indexOffset: number
  indexLength: number
}

export type ColumnHeader = NumericColumnHeader | StringColumnHeader

export interface CatalogHeader {
  count: number
  columns: ColumnHeader[]
  meta: Record<string, unknown>
}

export const alignUp = (value: number, align: number = ALIGN): number =>
  Math.ceil(value / align) * align
