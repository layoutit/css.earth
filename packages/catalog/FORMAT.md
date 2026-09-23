# The `.gxct` container

A packed-column binary format for point catalogues. One file per catalogue, a
few MB each, served static and read once.

It exists because the alternatives don't fit: Arrow IPC needs a ~200 KB reader
in the browser to buy interop we never use, and JSON costs a parse pass and 3×
the bytes for data that is 95 % `Float32Array`. A `.gxct` column becomes a GPU
buffer with no copy and no decode.

**Two implementations must agree**: the TypeScript reader/writer in this
package, and the Python writer in `formats/catalog.py` of the external catalogue pipeline (not part of this repository)
that builds the shipped data. Changing this document without changing both is a
bug. The retained `scripts/check-parity.mts` runner currently references a missing
Python fixture generator; it is not usable parity evidence. Follow the
[operator notes](AGENTS.md) when changing the format.

## Layout

```
offset  size  contents
0       4     magic, 'GXCT' as little-endian uint32 (0x54435847)
4       4     uint32 version (currently 1)
8       4     uint32 header length in bytes, 8-aligned
12      4     uint32 flags, reserved, must be 0
16      N     JSON header, UTF-8, space-padded to the declared length
...           column blobs, each 8-byte aligned
```

All integers are little-endian. Every blob offset is absolute from the start of
the file, and 8-byte aligned so `Float64Array` views can be constructed over the
file buffer in place. The header is space-padded rather than sized exactly,
because its own byte length depends on the offsets it contains; `JSON.parse` and
`json.loads` both ignore trailing whitespace.

## Header

```json
{
  "count": 117955,
  "columns": [
    { "name": "posPc", "type": "f32", "components": 3, "offset": 512, "length": 1415460 },
    { "name": "hip",   "type": "i32", "components": 1, "offset": 1415976, "length": 471820 },
    { "name": "name",  "type": "str", "offset": 1887800, "length": 24310,
      "indexOffset": 1887800, "indexLength": 471824 }
  ],
  "meta": { "source": "XHIP", "epoch": "J2000", "built": "2026-08-30" }
}
```

- `count` is rows, not values. A `components: 3` column holds `3 × count` values.
- Numeric `type` is one of `f64 f32 i32 u32 i16 u16 i8 u8`.
- A `str` column is two blobs: a `uint32` index of `count + 1` byte boundaries,
  then the UTF-8 pool. Empty strings are a zero-length span, not a null.
- `meta` is free-form, but every shipped catalogue carries `source`, `epoch` and
  `built`, because the attribution page is generated from it.

## Rules

- **No nulls.** A missing measurement is `NaN` in a float column, or a sentinel
  documented in `meta`. Catalogues with genuinely optional fields split into two
  columns rather than growing a validity bitmap.
- **Columns are immutable once shipped.** Renaming or retyping one means a new
  `v<N>` directory under `data/`, never an edit in place — the CDN caches these
  forever.
- **Version bumps stay readable by the previous reader**, or the whole `data/`
  tree is rebuilt in the same change. A browser holding a cached app shell will
  fetch new data files.
