# Steins

## Sources

| View or property | Source and interpretation |
| --- | --- |
| OSIRIS reflectance | WAC OI-filter `W20080905T183606461ID4DF17` and `W20080905T183630497ID4DF17`, 5 September 2008 at 18:36:22.008 and 18:36:46.044 UTC; 129/113 m per pixel. Acquisition illumination retained, with 1.29646 relative display gain. |
| Monochrome | [Stooke V3 map](https://sbnarchive.psi.edu/pds3/multi_mission/MULTI_SA_MULTI_6_STOOKEMAPS_V3_0/document/00_map_guide.html), a processed photographic visualization with broader coverage; not natural color or albedo. |
| Shape and Elevation | [Jorda et al. PDS 2013 shape](https://pdssbn.astro.umd.edu/holdings/ro-a-osinac_osiwac-5-steins-shape-v1.0/dataset.shtml). Elevation is radius minus 2.58 km, false color over −0.7 to +1.1 km; not gravitational height. |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/STEINS/target) Steins centre-point export, snapshot 2026-09-11, public domain. IAU-adopted names with centre, diameter, extent and name origin; labels appear at the closest zoom only, and a selected feature stays labelled. |

## Evidence

The photographic atlas now samples each pinned original grid directly with a 2 × 2 texel footprint. It retains the source frame, coverage policy and fixed-epoch lighting. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) explains the sampling and encoding controls.

| View | Original grid | Both lighting images, before → current |
| --- | --- | --- |
| normal | 3600 × 1800 | 0.57 → 0.84 MB |

Each atlas remains 2048 × 6400 pixels, with 800 retained faces. The scene bytes match [the previous main version](https://github.com/layoutit/css.earth/tree/3efdf2c9ed9047c72409b2730e879123f8c3b9d2/src/planets/steins/prepared). WebP quality is 95; decoded texture size is unchanged. Sampling details and output hashes are recorded in the prepared surface metadata (`prepared/surfaces.json`). Source resolution, gaps and existing registration limitations still apply.

[The 9 September 2026 mosaic report](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/asteroids/evidence/spacecraft-mosaics/README.md) records 107 focused tests, 60 browser conformance cases, DPR 1/2 production checks and fresh remote installation for the four-body change. [Validation](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/asteroids/evidence/spacecraft-mosaics/validation.json) identifies tested commit `8ded7a5` and base `1fb76e4`; these are historical results.

The broader preparation suite was not green (1,666/1,957 passed); global platform and shell audits were stopped. A later overview/navigation change was outside the tested implementation.

- **Reader oracle, 2026-09-12:** `tools/oracles/pds3/osiris-reflectance.py` reads the pinned WAC reflectance product `w20080905t183606461id4df17.img` with pvl and numpy. `tools/objects/terrestrial-layers/archived-camera.oracle.test.mts` requires the decoder to reproduce 48 sampled I/F values exactly and the accept or reject decision for 48 sampled quality flags.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `osiris` | 2 | 2 | 4.30° | 4.95° | 0.00° | its other 2 frames | 0 of 2 | — | 0 of 2 | — | ×1.00 | no verdict |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Steins (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table (this export ships no projection file, so the metadata datum is recorded and the authored radius scales outline sizes), drops the albedo-feature type code, folds repeated rows, and converts each positive-east centre into the body-fixed frame the radial terrain sampler uses for this mesh (longitude 0 toward the mesh +y axis, 90° E toward +x, north +z), then casts that direction through the prepared hit mesh so every anchor and outline point sits on the shape model rather than on a reference sphere. Craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. The frame was confirmed on Mimas and Phobos, where Herschel and Stickney fall at local minima of the shape radius.

Rosetta imaged about 60% of the body; unseen terrain is less certain. The published shape’s artificial jump between image-derived and lightcurve-derived terrain remains. The two selected photographs span only tens of original pixels and keep gaps as a grid.

The 18:37:16 candidate needed a 1.56 gain, above the 1.35 limit; later frames had poorer footprint agreement and are excluded. Neither selected image has a surface-intercept anchor or fitted image-to-shape registration. The former near-opposition Minnaert correction is superseded; no global albedo is inferred.

**Faithfulness status:** The OSIRIS photographic lens is deferred. The separate Stooke Monochrome map remains source material with its own published control; it does not promote the OSIRIS frames to a registered surface.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<a id="steins-source-record"></a>
<a id="selected-data-and-bounded-survey"></a>
<a id="geometry-and-accuracy"></a>
<a id="appearance-and-processing"></a>
<a id="reproduction"></a>
<a id="near-opposition-osiris-observation-2026-09-08-source-record"></a>
<a id="reproduction-and-source-closure"></a>
<a id="spacecraft-mosaic-update-2026-09-09"></a>

<details>
<summary>Methods and source notes</summary>

**Selected data and bounded survey**

See the [investigation ledger](investigations.json) for the recorded sources, decisions and reopening conditions.

**Geometry and accuracy**

The source catalog reports mean radius 2.70±0.2 km and volume-equivalent radius 2.63±0.2 km. The app's physical reference uses the pinned Horizons 2.58 km radius. This reference does not rescale the source vertices. Elevation is source radius minus **2.58 km**, not geoid/gravitational elevation. GM is unavailable in the pinned Horizons physical block; the astronomy package's unavailable-value convention is used rather than inferring a mass.

Shared `source-meshoptimizer`, version 1.2.0, uses `ErrorAbsolute` and `RegularizeLight`, target 800 triangles, authored error allowance 100 m. The result is 800 faces, 402 used vertices, 1,200 edges, one closed component and Euler characteristic 2; no opposite face pairs were removed. The library estimate is 48.4695 m. A separate 3,200 equal-area ray comparison gives mean 11.6846 m, p95 27.9911 m, p99 39.6013 m and maximum 53.8148 m, with no misses. These samples are a simplification diagnostic, not an exhaustive Hausdorff bound or scientific source accuracy.

**Appearance and processing**

The 800 native `u` leaves use 128 px cells in 2048×6400 triangle atlases. Atlas RGBA pixel storage is about 50 MiB per atlas; that is not measured GPU residency. The context and navigation silhouette are prepared from the same final mesh and gap-aware Monochrome at 20°E,10°N.

The pinned IAU PCK00011 pole is RA91°,DEC−62°, W321.76+1428.09917d at J2000. A superseded PCK rotation is deliberately not copied. Astro epoch, heliocentric position and shared solar context are owned by the astronomy preparation.

**Near-opposition OSIRIS observation (2026-09-08 source record)**

**Historical single-image record (2026-09-08):** The original single-image OSIRIS preparation used original WAC image `W20080905T183606461ID4DF17.IMG`, UTC 2008-09-05T18:36:22.008, Empty/OI filter (about 632 nm). This corrected reflectance product retains co-registered sigma and quality arrays. It is a small 256×256 CCD subframe beginning at source line 809 and sample 897; the asteroid occupies only tens of original pixels. Its enlarged atlas does not add resolved detail. The existing Monochrome map and Elevation remain available.

ROS_V33, OSIRIS V15 and the released Steins V05 PCK give the source camera and body frame. The WAC sample direction differs from NAC; the source boresight document supplies the CCD convention. The archived scalar-first SC quaternion and released camera frame reproduce independent boresight RA/Dec within 0.000004 degrees. No surface-intercept anchor exists for this frame, so that is not claimed as a second check. Source/model footprint comparison is retained with the PR evidence.

The original frame is the near-opposition OI observation identified in the pinned Schröder et al. study. The label gives 0.66689° phase; the study reports a representative near-opposition phase of 0.36°. Preparation uses the study’s k(0)=0.54 Minnaert approximation, not a 32° NAC photometric fit. D=cos(i)^0.54 cos(e)^−0.46, at reference D(0,0)=1, is applied to linear I/F before interpolation. Incidence and emission are limited to 70°, gain to 2.5. No absolute albedo, phase correction, fine regolith texture or natural color is inferred.

The normal quality policy requires VALID bit 0, explicitly permits LOSSY bit 3, rejects all other flags, and requires finite nonnegative sigma. Original darkness remains eligible. Interpolation contributors must lie within 450 m of the same source surface point; this reflects the approximately 125 m source pixel scale and rejects neck/limb mixtures. Closest-point transfer keeps the existing 100 m display allowance; full-source camera visibility uses 0.5 m tolerance. These are acceptance bounds, not measurement precision. Unsupported areas retain the ordinary grid. Shadows defaults off; the existing 800-face raster geometry is unchanged.

**Reproduction and source closure**

`source/preparation/camera.json` selects the exact image, original kernels and control evidence. `source/observations/*-camera.json` is a checked-in preparation input bound by image, mesh and provenance hashes. Reproduce it with `python tools/objects/terrestrial-layers/prepare-archived-camera.py src/objects/steins/source` (NumPy, SciPy, Astropy and SpiceyPy), then run the existing authored preparation command. No camera fitting, source mesh queries, photometric correction or atlas construction runs in the application. All atlases, coverage, thumbnails and surface minimaps consume the same qualified sampler. The camera/source tests use original-file samples, rejected quality cases and independent geometric anchors; the PR records separate browser and source-restoration results.

**Spacecraft mosaic update (2026-09-09)**

Reproduce the added camera with `python tools/objects/terrestrial-layers/prepare-archived-camera.py src/objects/steins/source --profile preparation/w20080905t183630497id4df17-camera.json`, then run `node tools/objects/dist/prepare-authored.js steins --write`.

Both original resampled reflectance files retain their sigma and quality arrays, and each now has its own pinned camera profile and camera JSON. The released camera frame, optical scale and body orientation reproduce the added image’s independent archived RA/Dec to 0.000004 degrees. Neither image supplies a surface-intercept anchor. No image-to-shape fit is claimed. The source/model footprint diagnostic gives a symmetric 95th-percentile limb distance of 2.83 and 3.0 source pixels; this thresholded diagnostic includes optical blur and shape differences and is not a detector quality mask or absolute registration accuracy.

The existing OSIRIS view now combines WAC OI-filter images **W20080905T183606461ID4DF17** and **W20080905T183630497ID4DF17**, acquired at 18:36:22.008 and 18:36:46.044 UTC on 5 September 2008. Their nominal scales are 129 and 113 m/pixel. The asteroid still spans only tens of detector pixels; enlarging the prepared atlas does not add measured detail. The processed Stooke Monochrome map remains because it has broader coverage.

This package presents asteroid 2867 Šteins with the published Rosetta OSIRIS shape, a photographic visualization mosaic, and shape-derived Elevation. All static data interpretation runs in the shared preparers. Runtime consumes retained PolyCSS native `u` triangles in raster mode.

See [registration and coverage](source/reference/registration.md) for coordinate proofs, exact mask interpretation and limitations. Monochrome retains source-compiled observations and their shadows; it is not natural color or albedo. Enlarging to the prepared 4096×2048 map does not add camera detail. The shape-derived Elevation palette spans −0.7 to +1.1 km about the explicit reference sphere, with shared cartographic relief. Added Sun lighting is a separate approximate fixed-epoch shared capability.

The previous near-opposition-only Minnaert treatment is superseded for this mosaic. The paper’s k(0)=0.54 estimate is not extrapolated to later phases. Both images retain acquisition illumination, with one relative display gain of 1.29646 fitted from qualified overlaps. The existing 1.35 gain limit and all geometric/quality limits remain. Lowest emission selects the source, with deterministic source-order ties. Per-atlas-texel observation indices are retained in preparation, including bleed, outside runtime delivery.

The source combines illuminated OSIRIS stereophotoclinometry, stereo/limb constraints and lightcurve inversion for unseen terrain. Rosetta imaged about 60% of the body, at best approximately 80 m/pixel. PDS reports roughly 20 m mean control-point positional error over illuminated regions; that is not global accuracy. Unseen terrain is less certain.

**The original shape contains a documented artificial elevation jump where SPC terrain meets lightcurve-derived terrain.** We retain the published surface and label this limitation rather than smoothing or synthesizing new terrain. The source center differs slightly from center of gravity, within its positional uncertainty. The X/Y axes are not its principal inertia axes.

The source survey downloaded OI frames at 18:37:16, 18:37:56, 18:38:36 and 18:39:43. The 18:37:16 frame required a 1.56 gain relative to the opposition image, exceeding the existing limit; it is excluded. The later higher-phase views have progressively poorer source/model footprint agreement and are not included. There is no new dataset row or inferred global albedo map.

The two-image mosaic keeps acquisition illumination. It supersedes the former Minnaert correction; no global albedo or natural-color interpretation is claimed.

</details>
