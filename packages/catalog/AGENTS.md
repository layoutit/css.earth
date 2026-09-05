# @cssearth/catalog — operator notes

The `.gxct` container: reader, writer, spec.

## This format is a two-language contract

The **Python writer** in `formats/catalog.py` of the external catalogue pipeline (not part of this repository) builds
every shipped catalogue. The **TypeScript reader** here is what the browser
runs. They are separate implementations of one spec, and unit tests on each side
prove only that each is self-consistent.

**Any change to the layout touches four things, in this order:**

1. `FORMAT.md` — the spec is the source of truth, not either implementation
2. `src/format.ts` + `src/read.ts` + `src/write.ts`
3. `formats/catalog.py` of the external catalogue pipeline (not part of this repository)
4. `pnpm check:parity` — must pass before the change is done

Skipping (3) produces data the browser reads as garbage with no error, because
every field still parses. That is the failure mode this package exists to
prevent.

## Invariants

| Rule | Why |
|---|---|
| Blobs are 8-byte aligned | Below 8, `new Float64Array(buffer, offset, n)` throws — and only for *some* catalogues, so it ships |
| Little-endian everywhere | Every target is LE; a BE branch would be untested code |
| Header is space-padded, not exact | Its length depends on the offsets it contains; padding avoids an iterate-to-fixed-point writer |
| No nulls | `NaN` for missing floats, documented sentinels otherwise. A validity bitmap costs a branch per point in the hot loop |
| Views are never mutated | `numeric()` hands out a window onto the fetched buffer, not a copy |

## Reading is on the hot path

A catalogue is read once and uploaded to the GPU. Nothing in `read.ts` may
allocate per row — the string column is the one exception, and it is lazy and
cached because labels are only ever needed for the handful of objects on screen.

If you are tempted to add a convenience that builds an array of row objects:
don't. That turns 4 MB into 200 MB of heap and is exactly what the columnar
layout is avoiding.

## Version bumps

`VERSION` is a wire format version, not a package version. Bump it only for a
layout change, and either keep the previous reader working or rebuild all of
`data/` in the same change — a browser with a cached app shell will fetch new
data files against an old reader.
