# Mathilde

## Sources

| View or property | Source and interpretation |
| --- | --- |
| Visible shape | [Stooke 5° visualization model](https://sbnarchive.psi.edu/pds4/non_mission/small_bodies.stooke.shape-models/data/253mathilde.xml): 2016 model migrated to PDS4 in 2025. Smoothed unseen areas and modified shadowed crater floors are aesthetic modeling. |
| Elevation | [Thomas 3° radii](https://sbnarchive.psi.edu/pds4/non_mission/ast-sat.thomas.shape-models_V1_0/data/253mathilde.xml), minus 26.4 km; false-color scale −11 to +10 km. The [legacy label](https://sbnarchive.psi.edu/pds3/near/NEAR_A_5_COLLECTED_MODELS_V1_0/data/msi/253mathilde.lbl) identifies 26.5 km as missing, never measured height. |
| Monochrome | [Stooke/Pfau photomosaic](https://sbnarchive.psi.edu/pds3/multi_mission/MULTI_SA_MULTI_6_STOOKEMAPS_V3_0/document/253mathilde/matcyl1.jpg), partial NEAR MSI observations from 27 June 1997. Processed visualization, not calibrated albedo or natural color. |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/MATHILDE/target) Mathilde centre-point export, snapshot 2026-09-11, public domain. IAU-adopted names with centre, diameter, extent and name origin; labels appear at the closest zoom only, and a selected feature stays labelled. |

## Evidence

The photographic atlas now samples each pinned original grid directly with a 2 × 2 texel footprint. It retains the source frame, coverage policy and fixed-epoch lighting. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) explains the sampling and encoding controls.

| View | Original grid | Both lighting images, before → current |
| --- | --- | --- |
| normal | 3600 × 1800 | 0.69 → 1.06 MB |

Each atlas remains 2048 × 6400 pixels, with 800 retained faces. The scene bytes match [the previous main version](https://github.com/layoutit/css.earth/tree/3efdf2c9ed9047c72409b2730e879123f8c3b9d2/src/planets/mathilde/prepared). WebP quality is 95; decoded texture size is unchanged. Sampling details and output hashes are recorded in [the prepared surface metadata](prepared/surfaces.json). Source resolution, gaps and existing registration limitations still apply.

The retained notes report a successful 35-asset bake, eight downloads restored, a verified 35-file source closure and three focused source tests. Original report paths are `output/asteroids-optical/mathilde/delivery.json` and `source-restoration.json`; those reports are not checked in. The generic body test, browser checks, fresh runtime installation and aggregate checks were still pending in that record.

[Source test definitions](../../../tests/objects/unit/mathilde/source.test.mts).

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Mathilde (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, and converts each positive-east centre into the body-fixed frame the radial terrain sampler uses for this mesh (longitude 0 toward the mesh +y axis, 90° E toward +x, north +z), then casts that direction through the prepared hit mesh so every anchor and outline point sits on the shape model rather than on a reference sphere. Craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. The frame was confirmed on Mimas and Phobos, where Herschel and Stickney fall at local minima of the shape radius.

Feature notes: 4 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

The visible Stooke shape differs from the Thomas radii used for Elevation, especially in unseen areas and shadowed craters. Neither product establishes global measured terrain. The JPEG has no authoritative validity mask: a narrow edge-connected gray test estimates exterior fill, so ambiguous pixels can remain. Pole, phase and added directional lighting are illustrative.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

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

| Candidate | Disposition | Reason |
| --- | --- | --- |
| Thomas 3° radial model / NEAR collected-model duplicate | Included for partial Elevation; excluded as display geometry | Legacy label explicitly identifies the missing-radius sentinel and nonphysical jagged edges. Rendering or smoothing that sentinel boundary would misrepresent the source. |
| Stooke 5° PDS visualization model | Included as explicitly labeled visualization shape | Published remedy for the incomplete model. It is reusable source-authored modeling, including aesthetic unobserved surfaces, never a claim of measured global topography. |
| Thomas `253mathm.fit` mosaic | Included as reference evidence only | 795 × 464 byte FITS includes axes and labels, so it cannot be wrapped as a global texture. Higher-resolution Stooke photomosaic preserves the useful mapped observations. |
| Stooke 3,600 × 1,800 monochrome mosaic | Included | Known simple cylindrical mapping and shared Thomas positional control. Better display sampling than the annotated FITS; partial coverage and photographed illumination remain explicit. |
| Stooke four 25 m/pixel morphographic quadrangles | Excluded as a separate lens | Same photomosaic in a different projection; 4 of 14 possible sheets reflect partial coverage. They add no independent scientific view and do not repair source resolution or missing terrain. |
| Stooke shaded-relief drawings | Excluded | Drawn visualization, not measured elevation. The valid Thomas numerical radii support a better-defined scientific lens. |
| [Weirich, Palmer & Domingue 2019 SPC model](https://www.hou.usra.edu/meetings/lpsc2019/pdf/2681.pdf) and [PSI object page](https://spc.psi.edu/index.php/2019/03/) | Unresolved for reusable source release | Paper describes a later model from 120 NEAR images and only one illumination angle; 6 m grid spacing oversamples imagery no better than 148 m/pixel. It acknowledges remaining image/model differences. The paper and linked object page expose no downloadable model release or redistribution terms; the access page concerns licensed SPC software. This is not evidence that the model does not exist. No contact or acquisition requiring submission was made. |
| Original NEAR MSI flyby images and geometry list | Reference candidate; no new composite | Potential input for a later photometric/geometry reconstruction. Existing registered source supplies useful imagery, while one encounter illumination cannot recover deep shadows or the unseen hemisphere. |

The survey follows the source papers to actual PDS data rather than treating press images as map products. The journal article [Thomas et al. 1999, *Mathilde: Size, Shape, and Geology*](https://doi.org/10.1006/icar.1999.6121) explains the arbitrary frame and minimum/nominal/maximum hidden-volume interpretations. Copyrighted paper PDFs used for local research are not package inputs.

**Preparation and qualification**

Authored recipes live under `source/preparation/`. Shared preparation owns source parsing, validity reconstruction, mesh simplification, texture sampling, lighting, context snapshots, titles and minimaps. Runtime consumes retained native PolyCSS `u` triangles with 128 px raster cells.

The Stooke grid yields 5,040 sampled triangles, welded to 2,522 vertices before official meshoptimizer 1.2.0 simplification with `ErrorAbsolute` and `RegularizeLight`. The authored target is 800 faces with a 600 m library-error allowance. Trial result: 800 faces, library estimate 596.629 m. Independent 8,192 Fibonacci equal-area rays against the triangle mesh have 0 misses: mean absolute radial error 153.987 m, p95 397.435 m, p99 592.175 m, maximum 1,245.038 m. The regularized library estimate is not a maximum radial-error bound. Closed mesh topology is 402 vertices / 1,200 edges / 800 faces, one component, Euler characteristic 2, positive signed volume. These figures measure fit to the **published visualization model**, not observational truth. Evidence and reproducible measurement script are in `output/asteroids-optical/mathilde/source-fit.json` and `measure-source.mjs`.

- [Stooke 2025 PDS4 Mathilde shape label](https://sbnarchive.psi.edu/pds4/non_mission/small_bodies.stooke.shape-models/data/253mathilde.xml), local `source/shape/stooke-253mathilde.tab`: 2,701 longitude/latitude/radius records, 5-degree grid, kilometers, planetocentric latitude, east longitude. This is the archived 2016 visualization product migrated to PDS4 in 2025. Its label explains that Thomas supplied the nominal/least-extreme model, then Stooke resampled it from 3 to 5 degrees, smoothed unobserved areas, and modified shadowed crater floors for appearance. Those changes are aesthetic, not additional observations. The package preserves that published interpretation; its unseen side and some crater floors are modeled. Source-model fit does not establish measurement accuracy.
- [Thomas PDS4 radial table](https://sbnarchive.psi.edu/pds4/non_mission/ast-sat.thomas.shape-models_V1_0/data/253mathilde.xml), local `source/shape/253mathilde.tab`: 7,381 latitude/longitude/radius rows, 3-degree grid, kilometers, planetocentric latitude, west longitude. The more informative [legacy NEAR label](https://sbnarchive.psi.edu/pds3/near/NEAR_A_5_COLLECTED_MODELS_V1_0/data/msi/253mathilde.lbl), pinned as `source/reference/253mathilde-legacy.lbl`, identifies **26.5 km as the unobserved placeholder** and warns that the resulting jagged edges are nonphysical. Exactly 3,688 rows carry that value. It is never used as measured Elevation. Any interpolation footprint touching that value is withheld, including valid boundary cells whose footprint is incomplete. The current PDS4 label omits this critical caveat; the legacy label is therefore retained.
- [Stooke/Pfau photomosaic](https://sbnarchive.psi.edu/pds3/multi_mission/MULTI_SA_MULTI_6_STOOKEMAPS_V3_0/document/253mathilde/matcyl1.jpg), local `source/maps/matcyl1.jpg`: 3,600 × 1,800 grayscale pixels, simple cylindrical, 10 pixels per degree. This is a partial NEAR MSI mosaic with positional control from Thomas. Its nominal pixel spacing is not the source's independent spatial resolution. The [map guide](https://sbnarchive.psi.edu/pds3/multi_mission/MULTI_SA_MULTI_6_STOOKEMAPS_V3_0/document/00_map_guide.html) describes extensive display processing and explicitly excludes photometric analysis. Photograph shading, deep shadows, blurred patches and compositing seams remain. It is Monochrome observation, not calibrated albedo or natural color.

Elevation encodes Thomas radius minus the **26.4 km JPL reference sphere**, in kilometers. The displayed palette spans −11 to +10 km. It is radial height including broad shape, not gravitational elevation. The 26.5 km placeholder is rejected in original source units before interpolation. Cartographic relief derives only from valid neighboring source values and uses no vertical exaggeration. The shape beneath that map is the separately published Stooke visualization; in shadowed craters and the unseen region it can differ from the measured-region model. Gray grid identifies missing elevation rather than coloring Stooke's aesthetic values as measurements.

The Stooke JPEG supplies no authoritative alpha or numeric missing-data mask. Its exterior is approximately sRGB gray 78 after decoding, with JPEG variations. Preparation identifies only north-edge-connected pixels in the narrow authored interval [75,81] as exterior fill. It preserves isolated pixels of the same brightness and rejects incomplete resampling footprints. This is an explicitly uncertain coverage reconstruction, not a scientific validity product; subtle exterior remnants or ambiguous dark observation pixels can remain. The shared gray-grid gap display distinguishes known exterior from photographs. There is no brightness threshold across the whole map and no photographic fill or invented backside imagery.

Thomas selected mapping axes parallel to J2000, an equator parallel to Earth's, and an arbitrary prime meridian because the spin pole was not solved. `source/preparation/rotation.json` uses the existing **display-orientation** contract, has no measured spin rate, and makes no phase claim. The source geometry table gives the encounter Sun at latitude −1.03°, west longitude 176.52°, but the mosaic retains that photographed illumination. The shared Shadows control adds **illustrative** directional lighting, not an accurately timed Mathilde Sun solution. Flood lighting remains available. Camera rotation never changes the source geometry or selected asset bank.

The body-local full bake completed successfully. Its runtime inventory contains 35 raster assets totaling 8,409,146 bytes, excluding JSON and common shell transfer. Each native triangle atlas is 2,048 × 6,400 pixels (800 cells of 128 × 128 px); uncompressed RGBA storage is 52,428,800 bytes per atlas, a calculation rather than measured GPU residency. Package file/runtime-asset/source closure passes. All eight authored downloads (five input assets plus three ignored reference companions) were restored into an empty input tree and the complete 35-file source closure verified; package documents and the generated context were supplied as checked-in companions. Three focused numerical/rotation source tests pass. The generic body test awaits integrated Sun/world-context finalization, and browser, fresh runtime installation, aggregate gates and remote persistence remain not established by these source checks. See `output/asteroids-optical/mathilde/delivery.json` and `source-restoration.json` for evidence.

</details>
