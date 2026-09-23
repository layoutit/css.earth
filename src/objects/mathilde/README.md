# Mathilde

## Sources

| View or property | Source and interpretation |
| --- | --- |
| Visible shape | [Stooke 5° visualization model](https://sbnarchive.psi.edu/pds4/non_mission/small_bodies.stooke.shape-models/data/253mathilde.xml): 2016 model migrated to PDS4 in 2025. Smoothed unseen areas and modified shadowed crater floors are aesthetic modeling. |
| Elevation | [Thomas 3° radii](https://sbnarchive.psi.edu/pds4/non_mission/ast-sat.thomas.shape-models_V1_0/data/253mathilde.xml), minus 26.4 km; false-color scale −11 to +10 km. The [legacy label](https://sbnarchive.psi.edu/pds3/near/NEAR_A_5_COLLECTED_MODELS_V1_0/data/msi/253mathilde.lbl) identifies 26.5 km as missing, never measured height. |
| Monochrome | [Stooke/Pfau photomosaic](https://sbnarchive.psi.edu/pds3/multi_mission/MULTI_SA_MULTI_6_STOOKEMAPS_V3_0/document/253mathilde/matcyl1.jpg), partial NEAR MSI observations from 27 June 1997. Processed visualization, not calibrated albedo or natural color. |
| NEAR close-ups | Two native calibrated broadband MSI photographs, MET 42826360 and 42826370, from 27 June 1997. [PDS image metadata](https://sbnarchive.psi.edu/pds4/near/near.msi_v1.0/data_calibrated/mathilde/1997/178/iof/m0042826360f0_2p_iof.xml), paired raw detector frames and [Thomas reconstructed image geometry](https://sbnarchive.psi.edu/pds4/non_mission/ast-sat.thomas.shape-models_V1_0/data/253mathimg.xml). Partial observations with original illumination, not recovered albedo. |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/MATHILDE/target) Mathilde centre-point export, snapshot 2026-09-11, public domain. IAU-adopted names with centre, diameter, extent and name origin; labels appear at the closest zoom only, and a selected feature stays labelled. |

## Evidence

The **NEAR close-ups** lens uses the shared observation pipeline and an 800-face
simplification of the Stooke shape in its native frame. Its two 537 × 244 detector
frames qualify over an estimated **14.2% of that display mesh’s area**, sampled at
16 points per triangle. This is selected close-up coverage, not a coverage increase
over Monochrome. Both lighting atlases together are 570,322 bytes. Original
photograph shadows remain when the application’s Shadows setting is off.

Camera corrections are 0.039° and 0.068°. Disjoint limb holdouts retain 31/32 and
74/76 controls, with RMS residuals of 1.24 and 1.69 native pixels; maximum residuals
are 3.98 and 4.64 pixels. These validate silhouette alignment, not interior terrain
accuracy. The prepared report (`prepared/surfaces.json`) records cameras, source
hashes, masking, overlap gains and area sampling. Decoder tests check native FITS
signed storage, raw/calibrated identity and rejection of missing, saturated or
invalid samples while retaining finite negative radiance.

[Source projection](evidence/near-msi/registration.webp) ·
[Mounted view](evidence/near-msi/view.webp) ·
[Capture identity and interaction results](evidence/near-msi/capture.json).
Headless Chrome on the existing server verified drag, lighting, mobile framing
and DPR 2 with retained triangle identity and Shadows off by default. The three
lenses and both closed 800-face model banks pass the focused package checks;
all 39 runtime files match their local inventory. Preparation TypeScript passes.
The shared recipe and profile checks pass after integrating the observation
recipe migration from `2f2752abb` (#175), which also fixes the previously recorded
Dimorphos cube/SPICE test failures. Full application and aggregate browser suites
were not run.

The full Mathilde preparation was replayed after that migration. All 39 runtime
assets (9,361,957 bytes), both native camera files, surface reports, lens controls
and prepared scene match the previous PR outputs exactly. The existing captures
therefore remain evidence for those pixels and geometry. A fresh browser run is
not claimed: the local application is missing the Helix prepared lens bank newly
required by `main`.

The photographic atlas now samples each pinned original grid directly with a 2 × 2 texel footprint. It retains the source frame, coverage policy and fixed-epoch lighting. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) explains the sampling and encoding controls.

| View | Original grid | Both lighting images, before → current |
| --- | --- | --- |
| normal | 3600 × 1800 | 0.69 → 1.06 MB |

The existing Monochrome and Elevation atlases remain 2048 × 6400 pixels on their
800-face display mesh. Their geometry and photographic sampling are retained
from [the previous main version](https://github.com/layoutit/css.earth/tree/3efdf2c9ed9047c72409b2730e879123f8c3b9d2/src/planets/mathilde/prepared).
The new lens adds a second prepared model; only the selected model is visible.
Sampling details and output hashes are in the surface metadata (`prepared/surfaces.json`).

The retained notes report a successful 35-asset bake, eight downloads restored, a verified 35-file source closure and three focused source tests. Original report paths are `output/asteroids-optical/mathilde/delivery.json` and `source-restoration.json`; those reports are not checked in. The generic body test, browser checks, fresh runtime installation and aggregate checks were still pending in that record.

[Source test definitions](https://github.com/layoutit/css.earth/blob/943c34c8bac83509725d55ab91b48832fd65a4e8/tests/objects/unit/mathilde/source.test.mts).

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `near-msi` | 2 | 0 | — | — | — | its other 2 frames | 0 of 2 | — | 0 of 2 | — | ×1.00 | no verdict |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

NEAR close-ups have substantial gaps, including areas photographed too obliquely
or not supported by the image-to-shape checks. Stooke aesthetically modified
shadowed crater floors and unseen areas, so limb alignment cannot prove interior
crater registration. Native shadows, noise, readout smear and scattered light
remain. PDS warns that the archive quality index is not fully understood:
`20000000` stays unresolved, not a good-quality verdict. There is no authoritative
per-pixel quality plane. The view exposes those native-image limitations rather
than reproducing the extensively processed Stooke map.

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Mathilde (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, and converts each positive-east centre into the body-fixed frame the radial terrain sampler uses for this mesh (longitude 0 toward the mesh +y axis, 90° E toward +x, north +z), then casts that direction through the prepared hit mesh so every anchor and outline point sits on the shape model rather than on a reference sphere. Craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. The frame was confirmed on Mimas and Phobos, where Herschel and Stickney fall at local minima of the shape radius.

Feature notes: 4 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

The visible Stooke shape differs from the Thomas radii used for Elevation, especially in unseen areas and shadowed craters. Neither product establishes global measured terrain. The JPEG has no authoritative validity mask: a narrow edge-connected gray test estimates exterior fill, so ambiguous pixels can remain. Pole, phase and added directional lighting are illustrative.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<a id="mathilde-sources-and-interpretation"></a>
<a id="selected-products"></a>
<a id="coverage-elevation-and-lighting"></a>
<a id="source-survey-and-alternatives"></a>
<a id="preparation-and-qualification"></a>

<details>
<summary>Methods and source notes</summary>

**Selected products**

The map is north-up, with west longitude 360 at its left edge, 180 at center and 0 at right; equivalently east longitude increases from 0 at left to 360 at right. The independently pinned Thomas `253mathm.fit` contains the same recognizable terrain **and printed latitude/longitude axes**: the plot spans x=55 to 775 and y=41 to 401 in its 795 × 464 raster. Inspection of that image establishes longitude sense and registration; a comparison preview is under `output/asteroids-optical/mathilde/thomas-fits-source.png`. No coordinates are inferred from the FITS header alone. Stooke's modern shape reverses the historical west longitude sign, leaving physical positions unchanged. Tests bind independent source radius anchors to both conventions.

**Coverage, elevation and lighting**

JPL Horizons physical header, retrieved 2026-09-07 and pinned in `source/reference/horizons-physical.txt`, reports radius 26.4 km, GM 0.00689 km³/s² and period 417.7 hours. Its heliocentric orbital elements have A=2.646575720427923 AU and period 4.30561 years. Mean orbital distance is not current distance. Physical radius is a normalization/context quantity and does not scale the published source radii to match a sphere.

**Source survey and alternatives**

See the [investigation ledger](investigations.json) for the recorded sources, decisions and reopening conditions.

**Preparation and qualification**

The [NEAR camera recipe](source/preparation/near-msi.json) selects two observations
and the already-archived `253mathimg.tab`. That table’s reconstructed geometry
supersedes preliminary FITS pointing. [Murchie et al. (1999), section 4.1](https://doi.org/10.1006/icar.1999.6118)
supplies a 166.85 mm focal length and 16 × 27 µm pixels. We interpret the table
centres as square-pixel coordinates, convert lines by 16/27, and interpret north
azimuth clockwise in row-down coordinates. The table-to-detector convention is
an inference, checked by native image projection and the withheld limb residuals
above. FITS pixels stay in file order; display flips affect only a complete
diagnostic image and its overlay together.

`node tools/objects/near-msi/prepare-cameras.mts` reproduces the camera inputs.
It uses the shared PDS4 label reader for the native filename and acquisition time.
The lens follows the common surface-observation recipe with `display.percentiles`;
the format requires raw companions and camera refinement, retains the photograph's
illumination and rejects compressed frames in its decoder.
`node tools/objects/near-msi/capture-registration.mts` reproduces the source
projection after preparation; the browser capture is
`node tests/objects/browser/asteroid-photographic-coverage.mts mathilde after`.
The shared `near-msi-camera` adapter binds them to the native Stooke mesh, refines
pointing with the existing limb fitter, checks source-mesh ray visibility, and
transfers supported samples to its 800-face alternative. Monochrome and Elevation
retain their old raster-based mesh. No geometry or camera is derived at runtime.

Raw DN uses the FITS BZERO offset: 0 marks missing telemetry and 4095 marks
saturation. Both selected raw frames have zero pixels of either kind. Nonfinite
and PDS unknown/not-applicable calibrated values are rejected; finite negative
I/F remains eligible. A relative overlap gain of 0.9142 for the second frame uses
735 matched samples; it is a display adjustment, not photometric calibration.
Selection follows authored frame order, never brightness. Unavailable samples
stay on the shared grid.

Authored recipes live under `source/preparation/`. Shared preparation owns source parsing, validity reconstruction, mesh simplification, texture sampling, lighting, context snapshots, titles and minimaps. Runtime consumes retained native PolyCSS `u` triangles with 128 px raster cells.

The Stooke grid yields 5,040 sampled triangles, welded to 2,522 vertices before official meshoptimizer 1.2.0 simplification with `ErrorAbsolute` and `RegularizeLight`. The authored target is 800 faces with a 600 m library-error allowance. Trial result: 800 faces, library estimate 596.629 m. Independent 8,192 Fibonacci equal-area rays against the triangle mesh have 0 misses: mean absolute radial error 153.987 m, p95 397.435 m, p99 592.175 m, maximum 1,245.038 m. The regularized library estimate is not a maximum radial-error bound. Closed mesh topology is 402 vertices / 1,200 edges / 800 faces, one component, Euler characteristic 2, positive signed volume. These figures measure fit to the **published visualization model**, not observational truth. Evidence and reproducible measurement script are in `output/asteroids-optical/mathilde/source-fit.json` and `measure-source.mjs`.

- [Stooke 2025 PDS4 Mathilde shape label](https://sbnarchive.psi.edu/pds4/non_mission/small_bodies.stooke.shape-models/data/253mathilde.xml), local `source/shape/stooke-253mathilde.tab`: 2,701 longitude/latitude/radius records, 5-degree grid, kilometers, planetocentric latitude, east longitude. This is the archived 2016 visualization product migrated to PDS4 in 2025. Its label explains that Thomas supplied the nominal/least-extreme model, then Stooke resampled it from 3 to 5 degrees, smoothed unobserved areas, and modified shadowed crater floors for appearance. Those changes are aesthetic, not additional observations. The package preserves that published interpretation; its unseen side and some crater floors are modeled. Source-model fit does not establish measurement accuracy.
- [Thomas PDS4 radial table](https://sbnarchive.psi.edu/pds4/non_mission/ast-sat.thomas.shape-models_V1_0/data/253mathilde.xml), local `source/shape/253mathilde.tab`: 7,381 latitude/longitude/radius rows, 3-degree grid, kilometers, planetocentric latitude, west longitude. The more informative [legacy NEAR label](https://sbnarchive.psi.edu/pds3/near/NEAR_A_5_COLLECTED_MODELS_V1_0/data/msi/253mathilde.lbl), pinned as `source/reference/253mathilde-legacy.lbl`, identifies **26.5 km as the unobserved placeholder** and warns that the resulting jagged edges are nonphysical. Exactly 3,688 rows carry that value. It is never used as measured Elevation. Any interpolation footprint touching that value is withheld, including valid boundary cells whose footprint is incomplete. The current PDS4 label omits this critical caveat; the legacy label is therefore retained.
- [Stooke/Pfau photomosaic](https://sbnarchive.psi.edu/pds3/multi_mission/MULTI_SA_MULTI_6_STOOKEMAPS_V3_0/document/253mathilde/matcyl1.jpg), local `source/maps/matcyl1.jpg`: 3,600 × 1,800 grayscale pixels, simple cylindrical, 10 pixels per degree. This is a partial NEAR MSI mosaic with positional control from Thomas. Its nominal pixel spacing is not the source's independent spatial resolution. The [map guide](https://sbnarchive.psi.edu/pds3/multi_mission/MULTI_SA_MULTI_6_STOOKEMAPS_V3_0/document/00_map_guide.html) describes extensive display processing and explicitly excludes photometric analysis. Photograph shading, deep shadows, blurred patches and compositing seams remain. It is Monochrome observation, not calibrated albedo or natural color.

Elevation encodes Thomas radius minus the **26.4 km JPL reference sphere**, in kilometers. The displayed palette spans −11 to +10 km. It is radial height including broad shape, not gravitational elevation. The 26.5 km placeholder is rejected in original source units before interpolation. Cartographic relief derives only from valid neighboring source values and uses no vertical exaggeration. The shape beneath that map is the separately published Stooke visualization; in shadowed craters and the unseen region it can differ from the measured-region model. Gray grid identifies missing elevation rather than coloring Stooke's aesthetic values as measurements.

The Stooke JPEG supplies no authoritative alpha or numeric missing-data mask. Its exterior is approximately sRGB gray 78 after decoding, with JPEG variations. Preparation identifies only north-edge-connected pixels in the narrow authored interval [75,81] as exterior fill. It preserves isolated pixels of the same brightness and rejects incomplete resampling footprints. This is an explicitly uncertain coverage reconstruction, not a scientific validity product; subtle exterior remnants or ambiguous dark observation pixels can remain. The shared gray-grid gap display distinguishes known exterior from photographs. There is no brightness threshold across the whole map and no photographic fill or invented backside imagery.

Thomas selected mapping axes parallel to J2000, an equator parallel to Earth's, and an arbitrary prime meridian because the spin pole was not solved. `source/preparation/rotation.json` uses the existing **display-orientation** contract, has no measured spin rate, and makes no phase claim. The source geometry table gives the encounter Sun at latitude −1.03°, west longitude 176.52°, but the mosaic retains that photographed illumination. The shared Shadows control adds **illustrative** directional lighting, not an accurately timed Mathilde Sun solution. Flood lighting remains available. Camera rotation never changes the source geometry or selected asset bank.

The historical two-lens bake completed successfully. Its runtime inventory contained 35 raster assets totaling 8,409,146 bytes, excluding JSON and common shell transfer. Each native triangle atlas is 2,048 × 6,400 pixels (800 cells of 128 × 128 px); uncompressed RGBA storage is 52,428,800 bytes per atlas, a calculation rather than measured GPU residency. Package file/runtime-asset/source closure passes. All eight authored downloads (five input assets plus three ignored reference companions) were restored into an empty input tree and the complete 35-file source closure verified; package documents and the generated context were supplied as checked-in companions. Three focused numerical/rotation source tests pass. The generic body test awaits integrated Sun/world-context finalization, and browser, fresh runtime installation, aggregate gates and remote persistence remain not established by these source checks. See `output/asteroids-optical/mathilde/delivery.json` and `source-restoration.json` for evidence.

</details>
