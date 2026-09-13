# Inspect Pleiades, Crab and Lagoon sources

These are **Alignment-only candidates**, not accepted reconstruction inputs.
Each object retains six source records and five primary-paper records. The right
sidebar exposes source, wavelength, footprint, resolution limits, credits and
papers. Switching images retains the camera. **Fit image** frames the selected
source; **Earth view · fit all** shows every complete selected footprint.
The source dossier's selection limits the dropdown and image requests. Selection
reflects usefulness for inspection, not processing eligibility.
Publisher-only comparisons remain inspectable with their status visible;
curation never changes the source transform or upgrades registration evidence.

| Workspace | Source dossier | Current registration evidence |
| --- | --- | --- |
| [Pleiades](http://127.0.0.1:4331/alignment?subject=m45) | [M45 sources](../models/m45/README.md) | Four selected: optical, two Spitzer composites and WISE, all relatively star-verified. 2MASS is mostly stars; coarse IRIS supplies little usable cloud detail. Both are hidden. |
| [Crab](http://127.0.0.1:4331/alignment?subject=m1) | [M1 sources](../models/m1/README.md) | All six views: Hubble, two Webb treatments, Spitzer, VLA and Chandra. Publisher coordinates provide the starting placement; independent registration is unresolved. Keep epoch/expansion and provisional Webb astrometry explicit. |
| [Lagoon](http://127.0.0.1:4331/alignment?subject=m8) | [M8 sources](../models/m8/README.md) | Three selected: ESO optical/VISTA and Spitzer, with held-out RMS approximately 0.76″ and 1.00″ respectively. Hubble close-ups remain hidden; Herschel is zero-filled over the central nebula and is rejected for this comparison. |

Checks are relative to the configured optical image, not an independent absolute
catalogue solution. TAN and ordinary, zero-slant SIN WCS preserve each source's
native pixel conventions. The browser uses an affine approximation to the common
tangent plane; residual gates are unchanged. Unverified comparisons can be
inspected but cannot pass the existing processing gate. Spectral morphology and exposure stretches
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

The original source-intake revision `47c459707` passed native source pins/dimensions, strict
lab TypeScript, 15 affected unit tests, and real-browser decoding/switching of all
18 images. Browser checks also cover source/paper display, unchanged camera,
alignment-only routing and absence of processing requests. Ordinary SIN rays
match independent Astropy 6.0.1/WCSLIB fixtures. The curation follow-up changes no
source bytes or accepted transform, so those numerical checks still apply.
The historical curation revision `6096f65da` checked a 4/1/3 selection.
The current correction restores all six Crab views (4/6/3 overall). Strict lab
TypeScript, six affected unit tests and the source-candidate browser flow passed:
registration evidence and per-image status are preserved, excluded images are
not fetched, camera switching is stable and no processing starts. Receipts and screenshots are local
under `.local/nebula-lab/source-candidates-browser/`.

Higher-resolution (4096px) detection was also tried for the unresolved comparisons:
Crab Hubble/Webb supplied 14 pattern-confirmed matches against the unchanged
45-match gate; the tiny Lagoon core did not supply a trustworthy shared stellar
pattern against the wide-field inputs. These failed attempts do not change the
publisher placements or justify fitting nebular structure. For stellar images,
compare suitable local high-resolution astrometric fields.
For nonstellar maps, qualify publisher registration against calibrated source
products and their astrometric uncertainties; do not force spectral structures
to coincide. Failed stellar matching alone does not prove misalignment.

First inspect and select sources. Before star removal or reconstruction, resolve
any selected source's registration/coverage limitations and obtain explicit
processing authorization. Scientific separate-band FITS/uncertainty masks remain
necessary for calibrated flux or physical inference; the current RGB outreach
and survey previews do not supply those measurements.
