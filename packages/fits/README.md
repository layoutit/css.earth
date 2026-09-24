# @cssearth/fits

The repository's one FITS reader, for the preparation tools and the nebula lab. It reads header cards and values,
HDU layout, image samples, Rice tile-compressed images and the sky orientation and projection stated by a WCS, and it
writes and reads the float32 transport image the nebula lab exchanges with external programs. It interprets no
calibration, units, quality masks or display policy: product adapters in `tools/` own those.

The main entry parses bytes (a `Uint8Array`, which a Node `Buffer` is) with no Node built-ins, so a browser bundle could
import it. Reading files, and writing the transport image as a `Buffer`, need Node and live behind the separate
`@cssearth/fits/node` entry. Nothing in the browser runtime reads FITS today.

| entry | what it holds | failure |
|---|---|---|
| `@cssearth/fits` | cards and headers: `scanFitsCards`, `fitsCardValue`, `esoHierarchy`, `readFitsHeader`, `MAX_HEADER_RECORDS`, `fitsHeaderLiterals` | `Error` naming the FITS rule, such as `Unsupported FITS CONTINUE convention.` |
| | HDUs and images: `readFitsHdu`, `readFitsHdus`, `imageExtent`, `fitsImageAccessor`, `readFitsImage`, `assertUnscaledFitsTable` | `Truncated or unbounded FITS data or padding.`, `Invalid FITS plane selection.` … |
| | quoted-literal headers for older product adapters: `readFitsPrimary` (one 2D primary or IMAGE extension), `readFitsPlane` (one primary-array plane) | as `readFitsImage`, plus the dimension or primary check |
| | `readRiceCompressedImage`, `riceDecompress`: lossless RICE_1 tile-compressed integer images | `Unsupported FITS tile compression.` … |
| | `skyImageAxes`, `skyDisplayRaster`, `skyProjection`: which way an axis-aligned sky image faces, its display raster, and TAN or SIN pixel ↔ ICRS | `TypeError` naming the refused WCS |
| | `decodeFits`: a 2D primary float image as top-down (DOM row order) Float32 samples | `TypeError`: `Unsupported FITS transport image.`, `Nonfinite FITS pixel.` |
| | `sampleStatistics`: two sample runs compared (counts, bit identity, relative differences above the median) | no throw |
| `@cssearth/fits/node` | `readFitsFileHdus` (headers located on disk without reading data), `readFitsFileRegion` (one image rectangle, optionally through an open handle), `sha256FitsData` | as the byte reader, plus `FITS region outside image.` |
| | `encodeFits`: top-down Float32 samples to a primary float32 FITS `Buffer`, the inverse of `decodeFits` | `TypeError`: `FITS metadata cannot override the transport layout.` … |

Samples keep native FITS order (the first stored row first) except in the transport image, BSCALE and BZERO are applied,
integer BLANK becomes NaN, and a floating-point image's BLANK card is ignored with a warning, as Astropy does. Decoded
allocations are bounded (512 MiB by default), and headers are scanned for at most 256 records.

```text
packages/fits/
├── src/           fits.ts (cards, headers, HDUs, images), rice.ts, sky.ts, transport.ts, sample-statistics.ts and tests
│   ├── node/      file.ts (file access), transport.ts (encodeFits): the Node-only entry
│   └── test-support/  authored FITS bytes for the tests; not built
├── AGENTS.md      Package rules
└── CLAUDE.md      Symlink to AGENTS.md
```

## Evidence

The package's tests are self-contained. The comparisons with Astropy live beside the scripts that write their fixtures
in [`tools/oracles/fits/`](../../tools/oracles/README.md), and
[`tests/fits/repository-inputs.test.mts`](../../tests/fits/repository-inputs.test.mts) reads every FITS file the
repository tracks through this package and checks one digest per reading against those recorded from the three readers
it replaced (`tools/fits/fits.mts` with its rice and sky modules, `tools/objects/observation/fits.mts` and
`tools/nebula/application/fits.ts` at 7e47cf4489). `node tools/oracles/test-fits.mts --unit` runs all of them offline.

ESM, CommonJS and declarations are built with tsup, like the other packages. From the repository root:

```sh
pnpm build:fits
pnpm --filter @cssearth/fits typecheck
pnpm --filter @cssearth/fits test
```
