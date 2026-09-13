# Inspect Pleiades, Crab and Lagoon sources

These are **Alignment-only candidates**, not accepted reconstruction inputs.
Each object has six spectral views and five primary-paper records. The right
sidebar exposes source, wavelength, footprint, resolution limits, credits and
papers. Switching images retains the camera. **Fit image** frames the selected
source; **Earth view · fit all** shows every complete acquired footprint.

| Workspace | Source dossier | Current registration evidence |
| --- | --- | --- |
| [Pleiades](http://127.0.0.1:4331/alignment?subject=m45) | [M45 sources](../models/m45/README.md) | Optical, two Spitzer composites, WISE and 2MASS pass relative field-star checks. Coarse IRIS remains publisher-only. |
| [Crab](http://127.0.0.1:4331/alignment?subject=m1) | [M1 sources](../models/m1/README.md) | All six retain publisher WCS. Hubble/Webb did not supply sufficient independently matched stars; other bands are explicitly nonstellar. Epoch/expansion and provisional Webb astrometry remain unresolved. |
| [Lagoon](http://127.0.0.1:4331/alignment?subject=m8) | [M8 sources](../models/m8/README.md) | ESO optical/VISTA and Spitzer pass relative checks. Hubble close-ups lack sufficient matches; Herschel is publisher-only with visible mosaic/no-data limitations. |

Checks are relative to the configured optical image, not an independent absolute
catalogue solution. TAN and ordinary, zero-slant SIN WCS preserve each source's
native pixel conventions. The browser uses an affine approximation to the common
tangent plane; residual gates are unchanged. Unverified placements remain visible
and cannot pass the processing gate. Spectral morphology and exposure stretches
need not agree; do not fit nebular knots as stars or erase Crab expansion.

## Recreate the previews from a clean checkout

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:packages
node --experimental-strip-types labs/nebula/src/run.ts prepare-observations labs/nebula/models/m45/observations.json --alignment-only
node --experimental-strip-types labs/nebula/src/run.ts prepare-observations labs/nebula/models/m1/observations.json --alignment-only
node --experimental-strip-types labs/nebula/src/run.ts prepare-observations labs/nebula/models/m8/alignment-candidates.json --alignment-only
pnpm lab:nebula
```

Each command restores exact pinned downloads and verifies hashes/native dimensions
before preparing bounded full-footprint inspection PNGs. The original rasters,
previews and numerical registration receipts stay ignored under the local cache.
`--alignment-only` never launches NOX, compilation or a volume bake. Its completion
means previews are available; inspect each image's registration status separately.
The NOX pins retained in recipes are dormant configuration.

Lagoon's expanded `m8-alignment` catalogue is separate from the existing `m8`
observations and compiler. Selecting candidates does not change its accepted
inputs or cached reconstruction. Pleiades and Crab have no invented volume or
compiler; their Reconstruction action is disabled.

## Validation and next decision

The 2026-09-13 source-intake revision passed native source pins/dimensions, strict
lab TypeScript, 15 affected unit tests, and real-browser decoding/switching of all
18 images. Browser checks also cover source/paper display, unchanged camera,
alignment-only routing and absence of processing requests. Ordinary SIN rays
match independent Astropy 6.0.1/WCSLIB fixtures. Receipts and screenshots are local
under `.local/nebula-lab/source-candidates-browser/`.

First inspect and select sources. Before star removal or reconstruction, resolve
any selected source's registration/coverage limitations and obtain explicit
processing authorization. Scientific separate-band FITS/uncertainty masks remain
necessary for calibrated flux or physical inference; the current RGB outreach
and survey previews do not supply those measurements.
