# B9 implementation review

Reviewed the uncommitted B9 implementation on `80e19c51349f713c9a9a64b8ef1cbb78917f0fc7`.
This was a read-only code, JSON, source-claim and diff review. No numerical
conversion, tests, browser, download or material preparation was run during
this pass. Previously accepted source qualification is referenced rather than
repeated. The reviewer authored `cassini-fixed-mesh.py` and some independent
source-audit scripts earlier; this pass is not a second independent authorship
review of that component.

## Outcome and gate status

No blocking implementation, scientific interpretation or geometry-contract
defect remains in the reviewed state. The one concrete qualification issue was
corrected during review:

- **Resolved P2 — stale default comparison base:** `verify-packages.mjs` previously
  defaulted to `bd265cf3a091c4ef17e9be76dfeb23410364884f`. Current HEAD includes subsequent
  merged work, so the script's shared-code diff detects unrelated existing
  changes in `site`, `src/platform`, `src/renderers` and `packages`. The owner
  updated both package verification and delivery defaults to the integrated
  `80e19c51349f713c9a9a64b8ef1cbb78917f0fc7` baseline; the refreshed files were
  inspected. A current working-diff check finds no changes under those shared
  paths. Merged upstream changes are not counted as B9 architectural drift.
  Historical three-body source/scene/image comparison remains useful because
  those particular baseline identities are unchanged.

The owner's fresh-directory source replay receipt
`output/b9-source-reproduction/run-i36lllk4/receipt.json` was inspected read-only:
all 21 TIFFs match, original packages remain unchanged, status is `PASS`, and
wall time is 20.70 seconds. This reviewer did not rerun that job. Current-base
package tests, mounted visual review, delivery/fresh installation and final
staged-diff review remain separate gates; this document does not claim they passed.

## Approved scope and fixed contracts

`selected-views.json` contains exactly `infrared` and `ice-absorption` for Tethys,
Iapetus and Phoebe. Each descriptor adds those two surfaces through its existing
`content` source and `lighting` material. The descriptor shape declarations
are unchanged. Existing prepared scenes and terrain were hash-checked against
the recorded baseline in the preceding integration review; current tracked
changes still contain no scene/terrain file edits.

No B9 diff changes the shared renderer, runtime camera, navigation owner,
application shell, registry, geometry implementation or runtime preparation
policy. The new Python camera, aperture and mesh code operates only in offline
source preparation. In particular, the mesh helper intersects the existing
Phoebe faces; it never generates or substitutes geometry.

All pre-existing lens-control objects in `prepared/controls.json` and
`prepared/lenses.json` still equal HEAD's corresponding controls. Existing
runtime-image manifest entries are unchanged for each body; each adds seven
new image entries. These are manifest/metadata comparisons, not a new byte
installation or screenshot claim.

## Production source implementation

| Component | Reviewed behavior and limits |
| --- | --- |
| `cassini-ice-surfaces.py` | Validates original layout, C/N identity, IR band ordering, RC19 I/F units, exact wavelengths and original pins. Computes the continuum in float64, retains valid negative/zero signals, rejects missing/invalid continua, then writes float32 quantities. RGB channels share one source owner. Deterministic selection uses resolution/emission rather than spectral values. Exact camera frusta determine support; center-to-center scan cells are not invented. |
| `cassini-vims-navigation.py` | Uses source-qualified clock, exposure, position and rotation caches with explicit source frames/radii. Cache extrapolation is rejected. NORMAL sampling pitch is distinguished from its two physical half-apertures; uncertain half-step order is treated conservatively. HI-RES uses the narrow physical aperture. Source-center residual and interior-support checks are required. The result explicitly describes sampled support, not continuous exposure or an integrated PSF. |
| `cassini-vims-detector-quality.py` | Binds raw QUB/C identities and byte layout, reconstructs ADC counts from signed core plus original background, excludes original specials/clipping and conservative spatial-filter dependencies. Unsupported history/layout fails. Background-fit contamination is handled separately from the known missing-background sentinel. It does not use a calibrated-brightness cutoff or claim to undo filtering. |
| `cassini-fixed-mesh.py` | Bounded BVH/leaf batches and closest strictly positive two-sided intersections; no implicit ray normalization, geometry mutation or hidden origin offsets. Exact computed-distance ties use original face order. Its primitive tests and independently formulated all-face oracle are part of existing qualification. |
| `cassini-phoebe-surfaces.py` | Pins fixed terrain, source frame/origin transfer, fit and regional mask. Reproduces the recorded accepted-pixel anchors before mapping. Requires the qualified HI-RES recipe and samples nine exposure poses. Applies actual closest visibility, illumination/self-shadow and inward-radial ambiguity withholding. It tests the complete modest grid rather than a heuristic mesh footprint bounding box. Final 1440 × 720 dimensions preserve the existing atlas-band contract. |

The final Phoebe source proof covers all 13,325 published radial directions,
all 41 contributing native pixels, four withheld ambiguous grid cells and
19,866 selected point/pose checks. Its precise scope and pinned results are in
[the final mesh review](source-review/iapetus/phoebe-fixed-map-review.md).
The Tethys/Iapetus spherical-cap accelerator retains the earlier independent
dense/full-grid probe evidence; no new universal mathematical completeness
claim is made for that accelerator.

## Maps, claims and reuse

The actual scientific TIFFs use east-positive, planetocentric coordinates with
central longitude 0; the separately encoded RGBA display maps roll by half
their width to central longitude 180. Recipes, manifests and existing readers
agree on the distinction, sizes, origins and grid spacing. Float maps use
`-9999` as nodata. RGBA uses zero for missing cells and code one plus opaque
alpha for valid display black, preserving valid dark measurements.

RGB uses native channels 70/44/25. Absorption uses 58/70/81 with each cube's
actual wavelength centers. The content describes continuum-relative absorption,
not ice abundance, and retains viewing-angle, grain-size, filtering, illumination
and noise limits. Tethys correctly describes seven contributing RGB observations
and nine absorption observations; Iapetus uses three; Phoebe uses one qualified
41-pixel region and withholds the failed second fit.

Scalar display sampling remains nearest. Infrared follows the unchanged
photographic preparation: missing pixels are painted with the grid before
bilinear image/pole or material sampling, followed by terminal WebP encoding.
This can soften display boundaries within a small texture neighborhood; it
does not alter source ownership TIFFs. Exact RGB display-mask edge parity is
explicitly not claimed. The suggested nearest-resampling recipe option was
rejected during review because the existing parser does not support it for
`geotiff-rgb-bands`; no shared-parser workaround was introduced.

All original C/N/QUB acquisition URLs are Nantes archive URLs. The retained
about-page policy explicitly applies CC BY 4.0 to data distributed there;
credits, the policy snapshot and attribution links are present in the body
packages and notices. No paper-only license inference is used.

## Preparation and reproduction

`prepare-selected.mjs` invokes the existing raster, material, pole, content,
minimap, provenance and runtime-manifest preparers. It verifies original assets,
reuses saved scene/terrain layout, and restores terrain serialization after
material work. Selected views have compatible dimensions, including Phoebe's
1440 × 720 map at texture scale 0.5. No geometry generation is invoked.
`finalize-one.mjs` performs normal transport finalization in a separate process.

`finalize-source-manifests.py` refreshes body source/document pins and the
descriptor's recipe references, then registers the two lenses with the existing
material. It should only run after explained authored changes, not as acceptance
of unexplained input drift. That distinction is stated in the README.

`reproduce-sources.py` seeds a fresh directory with pinned originals, recipes,
registration evidence and the fixed Phoebe terrain dependency. It expressly
excludes generated TIFFs/receipts from seeds, launches each converter serially,
and compares all 21 regenerated TIFFs against manifest pins and original bytes.
Code and original package hashes are checked again afterward. This is a
meaningful reproduction procedure; the separate root-run result is recorded above.

Historical trial/staging scripts depend on ignored intake paths. The README
correctly distinguishes those from final packaged source reproduction.
`stage-body-source.py` now writes final Phoebe dimensions and scale rather than
reintroducing the historical incompatible 720 × 360 configuration.

## Staging and delivery boundaries

The index was empty at this review. Stage explicit B9 paths. Unrelated
`ganymede-composition.py` / `test_ganymede_composition.py`, package `node_modules`
links and acquisition `__pycache__` entries were present and must not enter B9.
Preserve them locally; this review did not remove or modify them.

The root owner's final review must confirm the committed payload includes the
promised originals/derived TIFFs and required evidence despite repository ignore
rules, plus the six new tracked minimaps. The published image inventory and
fresh installation must match the final prepared descriptors. The delivery
script separates read-only inventory from explicit publication and verifies a
fresh installation; reviewing its implementation does not establish publication.

## Reviewed production identities

| File | SHA256 |
| --- | --- |
| `cassini-ice-surfaces.py` | `b67682f3ea069c0e371bcedc8f440836dc591f95f9b202d39510ef89efabbf3a` |
| `cassini-phoebe-surfaces.py` | `47588d2471bcd76c895847ce8c549736cfe459ca21f3511c364de816a316faf1` |
| `cassini-vims-navigation.py` | `c4a8f2d534b1252cb847b90beff8c8d4a5daac009912fd40cf5e50f4027b1b04` |
| `cassini-vims-detector-quality.py` | `e02acd15b1af115d3482a6272ba78d79071db2757d45854fb0d0527681dc314e` |
| `cassini-fixed-mesh.py` | `aae28318139cd4a3cc46838e905c46ae11cfb003def06acccbfd454241cf0020` |
| `prepare-selected.mjs` | `dfea73e5782286458045c7e68306f64ec2df7e91ec69c1f0807f9fc0f6bb890a` |
| `reproduce-sources.py` | `186e869514b99e687997b3f3873d021425205e3e37d2aa2b3a3585282ab8b155` |
