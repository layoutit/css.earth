# Dinkinesh

Dinkinesh was Lucy’s first asteroid encounter. Its equatorial ridge and trough accompany a remarkable moon: the contact binary Selam.

## Representation

Celestia contributors’ reconstruction inspired by Lucy images, uniformly scaled to the published 738 m volume-equivalent diameter. This is an authored approximation, not the mission photogrammetric shape model. The grid marks missing qualified surface imagery.

JPL supplies the heliocentric orbit. The reconstruction has an illustrative meridian; its detailed geometry and unseen hemisphere are not measured terrain.

The shared missing-imagery grid covers the surface. The body uses the existing generic object adapter, one shared world camera and retained PolyCSS geometry. The selector detail is **Model**.

## Scientific sources

- [Levison et al. (2024)](https://doi.org/10.1038/s41586-024-07378-0): Lucy discovery, ridge and contact-binary satellite.
- [Bierhaus et al. (2025)](https://doi.org/10.3847/PSJ/ae1968): Revised shape, geology and 738 m equivalent diameter.
- [Jackson et al. (2025)](https://doi.org/10.3847/PSJ/ade23c): Rotation pole and thermal constraints.

[Measurements and source selection](source/measurements.json) · [Exact source pins](source/manifest.json) · [Reuse terms](NOTICE.md).

The original Celestia reconstruction is CC BY 4.0, credited to ItzImcool and domi9. It is centered, rotated from Y-up to Z-up and uniformly scaled to 738 m volume-equivalent diameter. Its resulting extents are 846.2 × 846.3 × 708.5 m, which differ from the later mission model’s published 910 × 870 × 716 m extents. Detailed relief and the unseen hemisphere remain authored approximations. The conversion omits 136 exactly zero-area source triangles; their indices are recorded in [the conversion receipt](source/shape/model.json). All other source triangles retain winding and UVs before the shared source-mesh simplifier reduces them. The contributed texture has no qualified observed/fill mask and is excluded.

The JPL heliocentric state is retained in [elements](source/reference/horizons-elements.txt) and [independent vectors](source/reference/horizons-vectors.txt). The 2023 WISE geometric-albedo estimate in [photometry](source/preparation/photometry.json) affects only context-point brightness, not surface color.

## Evidence

The [browser conformance report](evidence/dinkinesh-conformance.json) passed desktop/mobile input, picking, wheel/pinch zoom, lighting, single-scene lifecycle and retained identity at DPR 1/2. Its [DPR 1 video](evidence/dinkinesh-dpr-1.webm) and [DPR 2 video](evidence/dinkinesh-dpr-2.webm) retain the input sequences. These were captured at `514f6b497`; body geometry, asset banks and input/lifecycle code remain unchanged in the final renderer at `66448c17d`. The production check below repeats the navigation and presentation affected by later changes.

![Dinkinesh with Shadows off](evidence/dinkinesh-shadows-false.png)

The [Shadows-on view](evidence/dinkinesh-shadows-true.png) was also inspected. These production captures use Chrome 152.0.7977.84, 1440 × 1000 at DPR 1, renderer commit `66448c17d` and browser-review commit `437ecb0b2`. Documentation-only moves preserve the original report and image bytes. They show the adopted shape with the missing-imagery grid; they do not establish photographic registration or mission-model parity.

## Known problems

### Lucy photographic source check, 13 September 2026

An initial archive survey missed a downloadable mesh in the public history of
the TEMPEST thermal-model repository. The photographic upgrade now has a
numerical source candidate; its frame and image registration remain unqualified.
The current Celestia reconstruction is still the displayed model. Its
illustrative meridian and different dimensions prevent treating archived camera
geometry as a qualified mapping onto that surface.

- [TEMPEST's `dinkinesh.stl` at commit `7df4c88`](https://github.com/duncanLyster/TEMPEST/blob/7df4c88063ebe811cbdd25b97c19f85559607459/data/shape_models/dinkinesh.stl)
  was retrieved and parsed: 237,239 bytes, 635 distinct vertices, 1,266 triangles,
  no zero-area faces, and two incident triangles per edge. Its SHA-256 is
  `3c38e04484e42a90e8b284302111325f0519a61ab22772f73d541e2715e11622`.
  The repository documents SI units. Interpreting coordinates as metres gives
  extents of 840.493 × 888.591 × 718.490 m and a signed-volume equivalent
  diameter of 737.508 m, without rescaling. The file was removed from the current
  tree in a June 2026 cleanup; the public commit still contains its numeric data.
- [Lyster et al. (2025)](https://doi.org/10.5194/epsc-dps2025-546)
  describe reducing the mission photogrammetric model to 1,266 facets for
  TEMPEST/TESBY. The author repository and matching facet count support that
  source association, but do not independently establish the exact upstream
  model version, prime meridian, observed/fill partition or camera solution.
  [Jackson et al. (2025)](https://doi.org/10.3847/PSJ/ade23c) independently
  describe a vertex-and-triangle model, version 2.02, reduced from 126,627 to
  5,186 facets. That is a separate derivative, not the retrieved STL.

- [Bierhaus et al. (2025), Sections 2.2 and 3.1](https://doi.org/10.3847/PSJ/ae1968)
  describe an improved mission model and co-registered images in SBMT. The model
  has 910 × 870 × 716 m extents, a 738 m equivalent diameter, and a median
  stereo-intersection error of 1.7 m on reconstructed terrain. The paper refers
  the full model description to Preusker et al. (2026, in preparation); those
  measurements do not supply mesh connectivity or per-image registration.
- The [2024 shape-method abstract](https://doi.org/10.5194/epsc2024-963)
  describes stereo reconstruction plus limb measurements and a prospective
  monochrome basemap/albedo release. The abstract does not provide those files.
  The accessible supplementary item for [Levison et al. (2024)](https://doi.org/10.1038/s41586-024-07378-0)
  is a peer-review PDF, not a mesh or camera/control-point bundle.
- The PDS catalogue query returned 21 Dinkinesh-related target, instrument and
  SPICE entries, with no separate shape collection. Both the
  [archived Lucy DSK directory](https://naif.jpl.nasa.gov/pub/naif/pds/pds4/lucy/lucy_spice/spice_kernels/dsk/)
  and the [current mission directory](https://naif.jpl.nasa.gov/pub/naif/LUCY/kernels/dsk/)
  listed only Donaldjohanson's DSK. The SBMT Dinkinesh data endpoint requested
  authentication. These are bounded access findings, not evidence that no
  scientific model exists or will be released.
- [Native L'LORRI observations](https://pds-smallbodies.astro.umd.edu/holdings/pds4-lucy.llorri:data_dinkinesh_partially_processed-v1.0/SUPPORT/dataset.shtml)
  are available. Their [archive timing note](https://pds-smallbodies.astro.umd.edu/holdings/pds4-lucy.llorri:data_dinkinesh_partially_processed-v1.0/SUPPORT/NOTES/liens.txt)
  explains an SPK/SCLK timing mismatch affecting geometric headers near closest
  approach and identifies the corrected
  `lcy_230815_240201_240101_dinkinesh_reconstruction_final_v2.bsp`.
  A future reader must verify the selected product version and its geometry;
  the existence of TAN-SIP header fields alone is not a camera qualification.
- The public [`dinkinesh_v10.tpc`](https://naif.jpl.nasa.gov/pub/naif/LUCY/kernels/pck/dinkinesh_v10.tpc)
  explicitly uses a placeholder pole and retains the pre-encounter 52.67-hour
  period. It is unsuitable for orienting this mesh. Jackson et al.'s published
  ecliptic pole (95.53°, −87.05°) and 3.737-hour period do not supply the recovered
  STL's rotational phase or prove that it uses the same prime meridian.

The native-pixel diagnostic used
[`lor_0752129617_03613_00001_1x1_sci_03.fit`](https://pds-smallbodies.astro.umd.edu/holdings/pds4-lucy.llorri:data_dinkinesh_partially_processed-v1.0/lor_0752129617_03613_00001_1x1_sci_03.fit)
and its [label](https://pds-smallbodies.astro.umd.edu/holdings/pds4-lucy.llorri:data_dinkinesh_partially_processed-v1.0/lor_0752129617_03613_00001_1x1_sci_03.xml),
the recovered STL and the corrected trajectory. The 10,526,400-byte FITS has
SHA-256 `d2c86f7ed98c4f026c5cd52ed4d4dc7eed54d66b1a4ba95af171ccaaba9373d9`.
It resolves Dinkinesh's relief and part of Selam. The corrected trajectory
substantially changes the projected position relative to the old header vector,
but does not align the model automatically.

Exploratory phase and limb-pointing trials did not qualify a photographic
surface. An outline-fit candidate passed a limited limb residual check while
its visible relief disagreed with the photograph. That check used the existing
pinhole limb helper, not a distortion-aware native-pixel fit; its residual is
not a photographic accuracy measurement. Both the body orientation and
independent internal-feature agreement remain unresolved. This diagnostic
does not replace the existing product evidence or justify a texture bake.

The follow-up checked TEMPEST's public `main`/`dev` inventories and relevant
commit history. Its historical
[`analyze_flyby_temperatures.py`](https://github.com/duncanLyster/TEMPEST/blob/b52891180d9e7771a7c2d01ff9937cff7827c944/scripts/analyze_flyby_temperatures.py)
uses a simplified planar trajectory and references a private configuration
absent from that public tree. It does not release a matched Lucy camera or an
epoch-bound Dinkinesh orientation. This narrows the missing input; it is not a
claim that the author's full TESBY setup lacks those data.

The next diagnostic applied native TAN-SIP distortion within the shared limb
fit, retained the paired FITS quality/sigma checks, and examined observations
`lor_0752129545_03599`, `lor_0752129617_03613` and
`lor_0752129722_03634`. The trial pole stayed fixed at the Jackson et al. value;
18 phases at 20° intervals were screened on the first two frames with a common
epoch and the published 3.737-hour period. Four phases passed the middle
image's limited outline check. All four failed the same check on the later
view, where their trial rotation phases were propagated rather than refitted.
Small pointing corrections remained independently fitted per image. No
candidate qualified across the views, and no internal terrain control network
was established. This coarse search does not rule out a valid orientation or
a usable mesh.

A subsequent audit found a sampling defect in that check: limiting the
raster-ordered edge list to 300 points removed its lower end. On image `9617`,
the retained boundary ended at row 809 while detected edges extended to row
949; 94 lower points were omitted. Sampling across the entire list instead
changes the phase-0 trial from a 2.161-pixel holdout RMS pass to a 5.506-pixel
failure under the unchanged 3-pixel budget. The earlier passes are therefore
not evidence of agreement around the full outline.

The corrected helper passes all five limb-refinement tests, including
nonlinear detector distortion and coverage of all four boundary sides in both
fit and holdout samples; the preparation TypeScript check passes.
These checks validate the helper, not a Dinkinesh surface. The STL export
transform, epoch-bound rotation and agreement with independent terrain features
remain under investigation using the public model, mission products and papers.

Continue by establishing the retrieved candidate's upstream attribution,
body-frame and observed/model-filled coverage, and the matching reconstructed
cameras or control network. Inspect a native-pixel image/model projection with
independent holdouts before baking.
No photographic surface, new geometry, or new landmark registration was
prepared by this check; the existing browser evidence concerns the
approximation only.

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Dinkinesh (retrieved 2026-09-12, public domain as USGS-produced data; the export ships no FGDC record, so the pin cites the USGS Copyrights and Credits statement) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table (no projection file or metadata: the authored radius scales outline sizes), drops the albedo-feature type code, folds repeated rows, and converts each positive-east centre into the body-fixed frame the radial terrain sampler uses for this mesh (longitude 0 toward the mesh +y axis, 90° E toward +x, north +z), then casts that direction through the prepared hit mesh so every anchor and outline point sits on the shape model rather than on a reference sphere. Craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. Names the Gazetteer has not positioned (centre 0°, 0° with an empty extent) are not placed and are tallied in the prepared descriptor.

Named features run of 2026-09-12 (this version): the catalogue labels 4 IAU names on the hit mesh (1 DO without a published centre); `tests/objects/unit/surface-features.test.mts` verifies the pinned bytes, the body-frame anchors and the hit-mesh radius band, and a headless Chrome probe (`output/probe-spheres.mts`, ignored scratch) mounted the page, selected every lens and pinned Bella Dorsum from the sidebar search with no console errors or failed requests.

## Integrated validation

After main’s independent-body registration change at `f596d99c9`, each addition owns its catalogue metadata in `object.json`, its physical/orbit/fixture record in `packages/astronomy/data/bodies/`, and its 16/32 px navigation marker images. The [migration comparison](evidence/galileo-lucy/isolation-migration.json) preserves the previous physical values, retained orbit states and independent vector samples exactly. Only the three new runtime transports receive stable body marker URLs; existing bodies’ descriptors and runtime/page transports match main. The source-state `provenance.placement` supplies the **(approx)** cues when the shared Sun context is generated. Earlier atlas-refresh reports below describe the pre-migration implementation. The [post-migration checks](evidence/galileo-lucy/isolation-checks.json) pass all 533 universe-preparation tests, all 440 renderer tests, the astronomy suite, three-body source and delivery closure, body-registration checks and every strict type/ownership check. [Local transport restoration](evidence/galileo-lucy/isolation-restored-transports.json) reproduces all 473 pinned JSON payloads from the checked-in runtime definitions. These reports are committed with the source changes they tested.

The [final checks](evidence/galileo-lucy/checks.json) cover Dactyl, Dinkinesh and Selam after incorporating main’s six distant worlds at `16774548b`: 684 astronomy tests, 532 universe-preparation tests, 559 selected shared shell/router/navigation checks, focused source/closure checks, strict typechecks, the complete 948-page static site build and runtime asset assembly for the three additions, Ida and the Sun. Other bodies’ remote runtime imagery was not downloaded or assembled locally.

The [earlier checks](evidence/galileo-lucy/checks-before-main-update.json) include 440 shared renderer tests and remaining ownership/preparation/browser-owner checks. The relevant renderer code was preserved through that catalog merge. All 88 world-context tests passed after the **(approx)** wording change; the [label build](evidence/galileo-lucy/label-build.json) and [stroke build](evidence/galileo-lucy/stroke-build.json) repeat the renderer/static-site build and scoped asset assembly. The final [production browser receipt](evidence/galileo-lucy/production-review.json) verifies both lighting states, actual wheel input, visible approximate labels, transparent orbit gaps, standard 1 px strokes and Dactyl → Ida / Selam → Dinkinesh navigation. The [browser check](../../../tests/objects/browser/galileo-lucy.mts) uses production readiness rather than developer diagnostic globals.

[Transport refresh](evidence/galileo-lucy/transports.json) proves all 473 packages share the combined marker atlas while preserving every non-marker runtime field. [Navigation pixels](evidence/galileo-lucy/navigation.json) preserves existing visible marker pixels at both densities against main; only the three new marker recipes are rendered. [Orbit preservation](evidence/galileo-lucy/merge-orbit-preservation.json) retains all 327 pre-existing asteroid element records and independent vector fixtures.

The [delivery receipt](evidence/galileo-lucy/delivery.json) records 93 published runtime assets, 21,219,882 bytes. A fresh download of every file passed byte-count and SHA-256 verification. The [independent Horizons comparison](evidence/galileo-lucy/orbit-errors.json) agrees with Dinkinesh’s display conic within 0.001 km at its fitted epoch; the ±30-day endpoint errors are about 991.49 and 902.83 km. This display orbit is not a long-term ephemeris.

The [earlier production run](evidence/galileo-lucy/production-before-main-update.json) and [earlier navigation review](evidence/galileo-lucy/visual-navigation.json) retain the pre-merge evidence for comparison; the final production receipt above supersedes them for the current orbit cues. [Dactyl](../dactyl/README.md#evidence) and [Selam](../selam/README.md#evidence) own their conformance videos and inspected views. The six videos total about 13 MB.

Main’s Arrokoth default-surface change at `6cf08ae06` was incorporated afterward. The [merge comparison](evidence/galileo-lucy/merge-arrokoth.json) verifies all 147 tracked files in the three moon packages were unchanged at that merge and retains every non-marker Arrokoth runtime field from main; its three conflicted transport files were refreshed with the existing serializer. The [transport/minimap checks](evidence/galileo-lucy/arrokoth-transport-check.txt) pass. An [attempt to repeat Arrokoth’s source tests](evidence/galileo-lucy/arrokoth-integration-check.txt) could not run its two scientific cases because that unrelated body’s OBJ and FITS inputs are not installed locally; the original Arrokoth evidence remains in its own README. The [documentation check](evidence/galileo-lucy/documentation-tracked-check.json) passes for the tracked tree; unrelated untracked Cassini source files were excluded from that local check only.

## Preparation

[Reproduction instructions](../../../tools/objects/source-authoring/galileo-lucy/README.md). The canonical prepared mesh contains 1200 triangles, independent of device DPR. Sources, conversion and reduction happen before runtime.
