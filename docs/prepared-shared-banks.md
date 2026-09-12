# Prepared shared banks

Three prepared values are identical for almost every body: the point photometry
tables of the eight planets and five dwarf planets as seen from that body, the
retained star catalogue behind the cubic sky, and the heliocentric label set.
Together they were 5.5 MB of the 7.4 MB in each body's `prepared/runtime.json`,
repeated in `scene.json` and `sky.json`, and downloaded again on every object
navigation. Shared banks store each of them once.

## Files

| Path | What it holds |
| --- | --- |
| `src/planets/sun/prepared/shared/planet-points/<sha256>.json` | One planet point photometry table per body and epoch. The `label` names the body. |
| `src/planets/sun/prepared/shared/heliocentric-labels/<sha256>.json` | One heliocentric label set per epoch. |
| `src/objects/milky-way/prepared/shared/catalogue-stars/<sha256>.json` | The retained star catalogue. |
| `src/planets/<id>/prepared/runtime.refs.json`, `scene.refs.json`, `sky.refs.json` | The checked-in twins. Each shared value is replaced by `{ "$shared": { "kind", "sha256" } }`. |
| `src/planets/<id>/prepared/runtime.json`, `scene.json`, `sky.json` | The full files, restored from the twins and banks. Git-ignored, like `object.json`. |

A bank file is `{ "schema": "cssearth-shared-bank@1", "kind", "label"?, "value" }`
followed by a newline. Its name is the SHA-256 of those bytes, so a reference
identifies exact content and a changed table is a new file.

## Preparation

`tools/prepare-object-json.mts` writes the full files as before, then
`syncPreparedShared` in `src/platform/prepared-shared-banks.mts` derives the
twins and banks from them and pins `object.json` to the referenced runtime.
`node tools/prepare-shared-banks.mts sync` repeats that for every registered
object and removes banks nothing references any more; `--repin` also rewrites
the descriptor and page pins without preparing anything.

`pnpm prepare:object-json` runs `node tools/prepare-shared-banks.mts restore`
first. It inlines the banks into the twins and writes the full files, then the
existing transport restoration reproduces `object.json` from the runtime twin.
Restoration writes nothing when the bytes already match. Every reader of the
full files, in tools and tests, is unchanged.

## Transport

`object.json` carries the references. The renderer's decoder collects them
after the payload's SHA-256 check, reads each bank once, verifies the bank bytes
against the reference, and inlines the value before the existing validation
runs. In the browser the decode worker fetches
`/shared/<kind>/<sha256>.json`, an immutable static endpoint, and keeps each
decoded bank for later navigations. In Node a transport supplies `readShared`.
The transport format is `cssearth-css-object@5`; a payload with references and
no bank reader fails instead of validating.

For Dione the gzipped navigation payload drops from 2.2 MB to 0.4 MB, and the
1.8 MB of banks is fetched once per session. The checked-in prepared output
drops from 6.3 GB to about 1.4 GB.

## Checks

- `node tools/prepare-shared-banks.mts restore` reports `written: 0` when the
  twins and banks reproduce every full file byte for byte.
- `node --test tools/restore-object-json.test.mts` proves the runtime twin
  reproduces the pinned transport.
- `src/renderers/css/loader.test.ts` decodes Mercury and Venus through the banks.
