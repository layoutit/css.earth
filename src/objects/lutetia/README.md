# Lutetia

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

| View or property | Source and interpretation |
| --- | --- |
| OSIRIS reflectance | Three NAC orange-filter close-ups from 10 July 2010, 15:41:06.632–15:43:00.199 UTC, at approximately 88, 78 and 68 m per pixel. [ESA's original STR-REFL products](https://archives.esac.esa.int/psa/ftp/INTERNATIONAL-ROSETTA-MISSION/OSINAC/RO-A-OSINAC-4-AST2-LUTETIA-STR-REFL-V1.0/DATA/IMG/) supply resampled I/F with separate sigma, quality and camera records. |
| Shape and Elevation | [Jorda et al. PDS release](https://doi.org/10.26007/aajh-r451), `lutetia_025k_cart.wrl`. Elevation is radius minus 49 km, false color from −16 to +16 km, not gravitational height. |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/LUTETIA/target) Lutetia centre-point export, snapshot 2026-09-11, public domain. IAU-adopted names with centre, diameter, extent and name origin; labels appear at the closest zoom only, and a selected feature stays labelled. |

## Evidence

The final expansion is also qualified through main's shared surface-observation pipeline. [Current browser comparison and evidence](evidence/photographic-expansion/evidence.json) preserve the same camera, tree and hit mesh. The observation-only refresh took 228.4 s, compared with 417 s for the previous full preparation; it replaced three runtime files and retained 36. Photographic coverage remains 29.66% at the same 64 area-weighted samples per triangle. The older capture record below describes the initial bake; its source-camera checks remain applicable because those inputs and solutions are unchanged.

[Before](evidence/photographic-coverage/before.webp) ·
[After](evidence/photographic-coverage/after.webp) ·
[Pixelmatch diff](evidence/photographic-coverage/diff.webp) ·
[Measured evidence](evidence/photographic-coverage/evidence.json)

The matched Chrome 152 captures use 1440×1000, DPR 1, OSIRIS, motion paused
and Shadows off. Before is `d4330c6c1`; after is `0ff39d3bc` plus this change,
with exact input/output pins in the evidence. Camera, retained tree and hit mesh
are byte-equivalent. Pixelmatch 7.2.0 at threshold 0.1 reports 29,007 changed
pixels out of 1,440,000; independent unchanged captures differ by zero pixels.
The visible detail change is modest and localized; changed-pixel counts do not
measure scientific accuracy or sharpness.

The 19 focused source/photometry checks and nine source catalogue checks pass;
one catalogue test is skipped for an unrelated missing reference PDF. Package
closure verifies 39 delivered files, and the new image restores from ESA into
an empty directory with exact byte/hash agreement. The existing default camera
also reproduces its original hash after the helper-path repair. Headless checks
cover four poses, DPR 1/2, mobile, lighting and retained-DOM dragging; Shadows
defaults off. Strict TypeScript checking of the changed capture/test roots
passes. Full repository suites were not run. Inspected screenshots include
[DPR 2](evidence/photographic-coverage/dpr2.webp),
[mobile](evidence/photographic-coverage/mobile.webp) and
[directional lighting](evidence/photographic-coverage/shadows.webp).

The September 2026 expansion adds `N20100710T154241240ID4DF22`. It supplies
the selected photograph over **8.19% of the display mesh**, mainly replacing
coarser views. Area-weighted coverage on the same 64 stratified samples per
triangle changes from **29.51% to 29.66%**. This is primarily a detail upgrade;
it does not establish global photographic coverage. The 800 display faces,
source mesh and transfer limits are unchanged.

The original camera reproduces the archived boresight within 0.00000368° and
surface-intercept point within 0.01069 pixels. Registration uses the existing
two-fit/two-holdout image/model correlation method. This later photograph needs
a larger search window, ±256 pixels instead of ±128, to find its translation
of [−36, +183.5] pixels. The withheld residual is 8.14 pixels and all four
correlations exceed 0.70; the 12-pixel residual limit is unchanged. This large
pointing adjustment registers the photograph to the selected source shape,
not to independent absolute ground truth. No roll, scale or local warp is fitted.

The same published Hasselmann Hapke model handles the new 50.91° phase angle.
The selected phase interval becomes 25–55°, inside the paper's fitted
0.15–144.15° range. Incidence/emission limits, gain limits and quality flags
remain unchanged. Overlap display gains are 1, 0.9851 and 0.9688.
The adjacent 15:43:06.482 candidate is excluded: its northeast holdout
correlation is 0.6949, below the unchanged 0.70 acceptance limit.

Camera preparation also repairs two stale `.mjs` helper paths left by the
TypeScript migration. The selected image, profile, camera and their byte pins
are in [the source manifest](source/manifest.json).

[The 9 September 2026 mosaic report](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/asteroids/evidence/spacecraft-mosaics/README.md) records 107 focused tests, 60 browser conformance cases, DPR 1/2 production checks and fresh remote installation for the four-body change. [Validation](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/asteroids/evidence/spacecraft-mosaics/validation.json) identifies tested commit `8ded7a5` and base `1fb76e4`; these are historical results.

The broader preparation suite was not green (1,666/1,957 passed); global platform and shell audits were stopped. A later overview/navigation change was outside the tested implementation.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `osiris` | 3 | 0 | — | — | — | its other 3 frames | 0 of 3 | — | 3 of 3, 0.00° | — | ×1.00 | registered |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Lutetia (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, and converts each positive-east centre into the body-fixed frame the radial terrain sampler uses for this mesh (longitude 0 toward the mesh +y axis, 90° E toward +x, north +z), then casts that direction through the prepared hit mesh so every anchor and outline point sits on the shape model rather than on a reference sphere. Craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. The frame was confirmed on Mimas and Phobos, where Herschel and Stickney fall at local minima of the shape radius.

Feature notes: 2 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

The shape joins detailed northern OSIRIS reconstruction to coarser lightcurve/outline modeling; the published join discontinuity and local defects remain. Photographic coverage is partial and gaps remain a grid.

`N20100710T154047674ID4DF22` explicitly records skipped in-field and out-of-field stray-light correction despite its STR-REFL collection name. The regional Hapke model and bounded relative display gains do not recover global albedo or cast shadows.

The 15:43:54 candidate failed image/model registration; the 15:45:28 candidate failed the independent archived-intercept check. Neither is included. The dated one- and two-image accounts below describe earlier versions; the three-image expansion is reported above.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

<a id="lutetia-source-record"></a>
<a id="views-and-source-interpretation"></a>
<a id="bounded-source-survey-2026-09-07"></a>
<a id="frame-spin-and-physical-scale"></a>
<a id="mesh-and-preparation"></a>
<a id="controlled-osiris-reflectance-2026-09-08"></a>
<a id="reproduction-and-source-closure"></a>
<a id="spacecraft-mosaic-update-2026-09-09"></a>

<details>
<summary>Methods and source notes</summary>

**Views and source interpretation**

**Shape** uses the shared neutral-gray material over the released geometry. It is not a photographic texture, measured albedo, natural color or a claim about small-scale surface brightness. Prepared directional lighting exposes the model's relief. Shadows defaults off; switching it on applies the prepared directional lighting.

**Bounded source survey (2026-09-07)**

See the [investigation ledger](investigations.json) for the recorded sources, decisions and reopening conditions.

**Frame, spin and physical scale**

The original VRML wrapper retains zero-based triangular indices and XYZ positions in kilometers. Positive Z is the north spin pole, positive X passes through Lauriacum, and positive Y completes the right-handed frame. Longitude increases east. The origin is the released model center; the archive notes a small center-of-gravity offset within surface-position uncertainty. No offset or axis rotation is invented.

Use Table 1 of the pinned Jorda–Vincent rotation document: J2000 pole RA **51.80°**, Dec **+10.83°**, W = **289.50° + 1057.751519° × (JD − 2451545.0)**, period **8.168270 ±0.000001 h**. The catalog rounds Dec to 10.8°. Generic NAIF PCK and Horizons physical summaries contain different/older pole, phase or period values; these are not silently applied to the released shape. The package uses the shape-specific solution. The reference epoch is transported as TT; the underlying fixed-epoch orbital fit approximates TDB as TT.

The pinned Horizons physical block supplies the 49 km reference radius and GM 0.1134 km³/s². The numerical mesh's volume is 498,512.49 km³, consistent with the archive's 5.0×10⁵ km³ nominal volume. The published radius range is 33.4–64.7 km. At the shared preparation epoch, the pinned heliocentric elements have semimajor axis 2.4345822333960907 AU. This fixed-date two-body approximation is not a long-term precision ephemeris. Directional lighting is diffuse fixed-epoch lighting in the source frame; it does not create terrain-cast shadows or add observational texture.

**Mesh and preparation**

The shared strict `vrml-mesh` reader consumes the original IndexedFaceSet directly. The existing `source-meshoptimizer` path welds exact positions, compacts indices and simplifies source connectivity before UV/material baking. No radial resampling replaces the released connectivity. Source and result are each one consistently wound closed component, Euler characteristic 2, with positive volume. The source has 12,265 vertices, 36,789 edges and 24,526 faces; the result has 402 vertices, 1,200 edges and 800 faces. No opposite face pairs were removed.

Meshoptimizer 1.2.0 uses ErrorAbsolute and RegularizeLight, with an authored 1,200 m allowance and a 968.252 m library estimate. Independent source/result ray intersections in 8,192 Fibonacci equal-area directions had zero misses; mean/p95/p99/maximum radial deviations were **255.658/650.965/869.988/1453.051 m**. The sampled maximum is larger than the regularized library estimate. Neither is an exhaustive surface-distance bound or a statement of source measurement accuracy. Detailed source topology and fit results are retained in the local qualification output.

Every displayed face is a native PolyCSS `u` raster triangle with a 128 px cell. Existing preparation owns sampling, atlases, lighting, stable leaves, shape targeting, title outlines and marker imagery. The runtime consumes prepared state. Context/navigation use the same 800-face mesh and shared grid at 0°E, 35°N, full-phase ambient 0.45 plus diffuse 0.55; these are display choices, not a flyby observation.

**Controlled OSIRIS reflectance (2026-09-08)**

**Historical single-image record (2026-09-08):** The first controlled OSIRIS image was original `N20100710T154047674ID4DF22.IMG`, UTC 2010-07-10T15:41:06.632, FFP-Vis/Orange. This Level-4 product contains distortion-corrected I/F, sigma and a quality-bit array in one 2048×2048 PDS file.

The released ROS_V33 frame and OSIRIS V15 corrected focal length bind the camera to the exact observation. The SC quaternion is scalar-first despite inconsistent label prose: this reproduces independent archived boresight RA/Dec to 0.00000145 degrees and the archived center-ray surface intercept to 0.0069 pixels. The ROS_LUTETIA frame is explicitly transformed from LUTETIA_FIXED using its released 164.7-degree offset, preserving Lauriacum and the mesh’s prime meridian. The source intercept is 47.04 m from the selected 25k source mesh.

These metadata checks do **not** prove photographic registration. The image is displaced from the nominal projected shape. Following the image/model correlation approach documented in the pinned OSIRIS boresight technical note, preparation estimates a two-parameter image translation using two disjoint relief windows and reserves two other windows as holdouts. Standard zero-mean normalized cross correlation uses a 2/30 px difference of Gaussian scales and a bounded ±128 px search. The accepted translation is −30.5 px in samples and +92 px in lines. Independent window residuals are at most 7.44 px, with correlation above 0.77; the source-scale acceptance limit is 12 px (about 1 km, comparable to the source facet scale). This is registration to this source model, not absolute ground truth. Both original and controlled pointing evidence remain in the camera record.

Photometry uses the Hapke (1993) model that [Hasselmann et al. (2016)](https://doi.org/10.1016/j.icarus.2015.11.023) fitted to NAC F82+F22 images of the Baetica and Etruria regions. Their Table 5 gives single-scattering albedo 0.238, Henyey–Greenstein asymmetry −0.271, shadow-hiding amplitude 1.69 and width 0.047, and roughness 29.2°. The same study supplied the Minnaert law this view used before. [The model record](source/photometry/hasselmann-2016-hapke-1993.json) transcribes the values, and the manifest cites the paper. Each pixel is carried to 35° incidence, 0° emission and 35° phase. Incidence and emission are limited to 70°, phase to 25–45° inside the fitted 0.15–144.15°, and gain to 0.4–2.5; pixels outside these limits are withheld. This regional fit is not a global albedo solution, and cast shadows are not recovered. A common 1st–99th percentile stretch displays linear, normalized relative I/F.

All interpolation contributors must have accepted quality, finite nonnegative sigma and source geometry within 600 m of the same original surface point. Closest source correspondence uses the existing 1,200 m display allowance; the full-source BVH checks camera visibility to 0.5 m. These are acceptance tolerances, not source accuracy claims. Unqualified coverage remains the ordinary grid. The 800 raster triangles, 128 px atlas cells and prepared lighting route are unchanged.

**Reproduction and source closure**

`source/preparation/camera.json` selects the exact image, original kernels and control evidence. `source/observations/*-camera.json` is a checked-in preparation input bound by image, mesh and provenance hashes. Reproduce it with `python tools/objects/terrestrial-layers/prepare-archived-camera.py src/objects/lutetia/source` (NumPy, SciPy, Astropy and SpiceyPy), then run the existing authored preparation command. No camera fitting, source mesh queries, photometric correction or atlas construction runs in the application. All atlases, coverage, thumbnails and surface minimaps consume the same qualified sampler. The camera/source tests use original-file samples, rejected quality cases and independent geometric anchors; the PR records separate browser and source-restoration results.

**Spacecraft mosaic update (2026-09-09)**

Reproduce the added camera with `python tools/objects/terrestrial-layers/prepare-archived-camera.py src/objects/lutetia/source --profile preparation/n20100710t154135529id4df22-camera.json`, then run `node tools/objects/dist/prepare-authored.js lutetia --write`.

The added camera reproduces archived boresight RA/Dec to 0.0000043 degrees and the archived surface-intercept point to 0.00535 pixels before adjustment. The same bounded image/model correlation method and disjoint two-fit/two-holdout windows as the first image give a translation of [−31.5,+125] pixels. The maximum withheld residual is 5.408 pixels, below the unchanged 12-pixel limit. These are source-shape registration checks, not absolute cartographic precision. No roll, scale, mesh or local warp is fitted.

The existing OSIRIS view now combines NAC orange-filter images **N20100710T154047674ID4DF22** and **N20100710T154135529ID4DF22**, acquired at 15:41:06.632 and 15:41:54.488 UTC on 10 July 2010. Their nominal scales are 88 and 78 m/pixel. Each original resampled I/F image retains its sigma and quality arrays and has a separately pinned camera profile.

The selected [PDS Rosetta Lutetia shape release](https://pdssbn.astro.umd.edu/holdings/ro-a-osinac_osiwac-5-lutetia-shape-v1.0/dataset.shtml), DOI [10.26007/aajh-r451](https://doi.org/10.26007/aajh-r451), supplies the geometry. Source authors are Laurent Jorda, Robert Gaskell, Mikko Kaasalainen and Benoît Carry; Tony Farnham edited the PDS archive. The checked `source/manifest.json` pins original files and authored inputs.

**Elevation** colors source radius minus a 49 km reference sphere, in kilometers, from −16 to +16 km. This includes the body's broad irregular shape; it is not height above a gravitational equipotential. The original mesh is sampled on a 721×361 angular grid for this display; that interpolation does not add source measurements. Cartographic relief uses this same scalar field, with a 49,000 m reference radius. Mesh geometry and the scalar map use the same published body frame.

The published Hapke model replaced the Minnaert approximation; the incidence/emission and source-mesh transfer limits remain. Over the same 5,410 qualified overlap samples, the two photographs now need a 0.98497 relative display gain, where the Minnaert approximation needed 1.09501. The transfer still accepts all 1,735,478 samples. Lowest emission selects the source. The prepared lossless observation-index raster records each contributing original image, including atlas bleed, outside runtime delivery.

The model combines stereophotoclinometry from 60 Rosetta OSIRIS images of illuminated, visible terrain with lightcurve inversion and adaptive-optics outlines for the remainder. Image coverage exceeded half the surface, predominantly northern terrain. The archive specifically documents a discontinuity at the join of the two reconstruction methods and local shape defects. These remain source limitations; no terrain is filled or cosmetically repaired by this package. The selected 25k mesh itself is closed, despite the archive's illustrative description of some defects as “holes.” The unvisited side is a coarser observationally constrained model, not an equally detailed Rosetta reconstruction.

The same-filter encounter inventory was surveyed. The 15:43:54 close-up failed the existing image/model correlation checks, and the 15:45:28 image failed the independent archived surface-intercept check. Later high-phase frames remain candidates, not included observations. No tolerance was relaxed to increase coverage and no extra dataset row was added.

The collection is named STR-REFL, but this frame’s HISTORY says in-field and out-of-field stray-light corrections were **skipped**. No stray-light restoration is claimed. Original terrain shadows remain. Shape and Elevation remain selectable; Shadows defaults off.

The Hapke model is a regional fit applied to the whole view, with a small relative display gain between photographs. It does not recover global albedo or cast shadows, and baked Shadows lighting stays Lambert.

</details>
