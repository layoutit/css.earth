# Ida

## Sources

| View or property | Source and interpretation |
| --- | --- |
| SSI reflectance | Galileo green-filter [0202561278](source/observations/0202561278rcal_gre.xml) and [0202560500](source/observations/0202560500rcal_gre.xml), 28 August 1993, 111–170 m/pixel. I/F normalized to 25° incidence and phase with a published Hapke model; fixed display stretch, no fitted gain. |
| Monochrome and shape | [Thomas PDS release](https://sbnarchive.psi.edu/pds4/non_mission/ast-sat.thomas.shape-models_V1_0/data/), [Thomas et al. 1996](https://doi.org/10.1006/icar.1996.0033). The processed mosaic has broader coverage and finer contributing imagery than the I/F pair. |
| SSI false colour | One Galileo pointing on 28 August 1993: [0202561352](source/observations/0202561352rcal_ir8.xml) 0.89 µm as red, [0202561278](source/observations/0202561278rcal_gre.xml) green as green and [0202561313](source/observations/0202561313rcal_vio.xml) violet as blue, the three exposures within 43 seconds. Calibrated I/F with the original illumination, displayed 0–0.11 in every filter; no albedo recovery and no fitted gain. |
| Elevation | Shape radius minus 16 km, false color from −13 to +16 km; not gravitational height. |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/IDA/target) Ida centre-point export, snapshot 2026-09-11, public domain. IAU-adopted names with centre, diameter, extent and name origin; labels appear at the closest zoom only, and a selected feature stays labelled. |

## Evidence

The photographic atlas now samples each pinned original grid directly with a 2 × 2 texel footprint. It retains the source frame, coverage policy and fixed-epoch lighting. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) explains the sampling and encoding controls.

| View | Original grid | Both lighting images, before → current |
| --- | --- | --- |
| normal | 2520 × 1260 | 1.80 → 2.71 MB |

Each atlas remains 2048 × 6400 pixels, with 800 retained faces. The scene bytes match [the previous main version](https://github.com/layoutit/css.earth/tree/3efdf2c9ed9047c72409b2730e879123f8c3b9d2/src/planets/ida/prepared). WebP quality is 95; decoded texture size is unchanged. Sampling details and output hashes are recorded in the prepared surface metadata (`prepared/surfaces.json`). Source resolution, gaps and existing registration limitations still apply.

[The 9 September 2026 mosaic report](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/asteroids/evidence/spacecraft-mosaics/README.md) records 107 focused tests, 60 browser conformance cases, DPR 1/2 production checks and fresh remote installation for the four-body change. [Validation](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/asteroids/evidence/spacecraft-mosaics/validation.json) identifies tested commit `8ded7a5` and base `1fb76e4`; these are historical results.

The broader preparation suite was not green (1,666/1,957 passed); global platform and shell audits were stopped. A later overview/navigation change was outside the tested implementation.

### Band alignment

The false-colour lens composes three archived frames through their catalog cameras; preparation refits nothing. Each band is measured against the green reference 202561278 on separated control patches, half of them held out of the fit. Violet 202561313 lands at 0.37 px RMS over 17 held-out patches, worst 0.58 px; 0.89 µm 202561352 at 0.71 px RMS, worst 1.01 px. The 0.89 µm frame was chosen over the 0.76 µm one of the same set because it carries fewer dropped scan lines, and the archive-edge inset is 2 px, which the worst measured patch stays inside. ISIS fill and withheld values are read as missing at the SSI loader, so they neither enter the composite nor the alignment. Only the recorded strip of each frame covers Ida: equal-area samples over the retained triangles put the composed lens on 17.2% of the surface, and the grid marks the rest. The numbers are read from `prepared/surfaces.json`, not typed.

[Rendered false colour](evidence/filter-color/false-color-views.webp) at DPR 2, 2026-09-17: a close view of the covered strip, the whole body at the default distance, and a zoom into the dropped scan lines the archive left in the 0.89 µm frame. The colour it separates is mild — on the prepared minimap the red-minus-blue difference over covered pixels runs from −11 to 46 of 255 with a median of 0 — which is what these three filters record on Ida, not a display fault.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `calibrated` | 2 | 2 | 4.74° | 2.12° | 4.24° | its other 2 frames | 1 of 2 | — | 0 of 2 | — | ×1.00 | no verdict |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Ida (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table (this export ships no projection file, so the metadata datum is recorded and the authored radius scales outline sizes), drops the albedo-feature type code, folds repeated rows, and converts each positive-east centre into the body-fixed frame the radial terrain sampler uses for this mesh (longitude 0 toward the mesh +y axis, 90° E toward +x, north +z), then casts that direction through the prepared hit mesh so every anchor and outline point sits on the shape model rather than on a reference sphere. Craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. The frame was confirmed on Mimas and Phobos, where Herschel and Stickney fall at local minima of the shape radius.

Feature notes: 2 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

The same-filter survey also tested green images 0202558300 and 0202559400. Their useful projected patches did not establish four spatial checks at the retained tolerance. They are not included. Close clear-filter photographs were identified in the archive inventory but are not mixed into the green-filter reflectance view.

The September 2026 follow-up inspected clear-filter images 0202561700,
0202561745, 0202561800, 0202561945, 0202562300 and 0202562339. The first has
too little terrain in its detector footprint for the four separated checks.
The other five were tested against the Thomas mosaic using the existing
DoG/ZNCC verifier. Every candidate failed at least one check: correlations below
0.7, displacement above four pixels, or both. For example, image 0202562300
correlated at 0.949 but displaced the checked patch by (4, 2) pixels; image
0202562339 displaced it by (−1, 13). No local camera correction or larger
acceptance limit was applied. These photographs remain excluded; finer source
pixels alone do not qualify their projection onto this model.

The Thomas mosaic is processed monochrome, with photographed shadows, local stretches and seams. Its exactly-zero gaps remain a grid. A conflicting PDS4 display-direction label is overridden by the north-up registration evidence below. Elevation is radius minus 16 km, not gravitational height.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

<a id="ida-source-record"></a>
<a id="selected-release-and-interpretation"></a>
<a id="source-survey-2026-09-07"></a>
<a id="image-registration-check"></a>
<a id="coordinates-spin-and-physical-context"></a>
<a id="preparation-and-restoration"></a>
<a id="first-calibrated-image-retained-source-record"></a>
<a id="spacecraft-mosaic-update-2026-09-09"></a>

<details>
<summary>Methods and source notes</summary>

**Selected release and interpretation**

- **Shape:** `243ida.tab` gives 16,471 latitude/longitude/radius records on a 2° grid, including the duplicate 360° meridian. Units are kilometers, latitude is planetocentric, longitude increases east. Galileo stereogrammetry and limb matching constrain the radial surface; this is not an ellipsoid. Radii span 3.2963–31.0466 km, with the north and south poles at 8.4529 and 6.2869 km. Model detail/confidence vary across the body. No additional undercuts or missing terrain are invented.
- **Monochrome:** `243idam.fit` is an unsigned-byte, 2520×1260 simple-cylindrical mosaic, 7 pixels/degree, with 0° longitude at its center. The original byte rows are used north to south. The generic PDS4 display setting says bottom-to-top, but independently documented north-up Stooke crater positions show that applying a vertical flip would invert the map; see the registration check below. High-pass detailed Galileo frames overlay a low-pass coarse-image background. The best contributing source sampling is approximately 25 m/pixel; a large fraction is much coarser. Image shadows, local stretching and seams remain. This is a processed observation, not measured albedo or natural color.
- **Coverage:** exactly zero is the label-defined unprojectable surface value: 76,126 original pixels (2.3975% of the raster, not an area-weighted surface fraction). Validity is determined on original pixels before interpolation. Dark nonzero terrain remains observed; no broad darkness threshold is used. The shared gray grid marks gaps. Fine versus coarse imagery is not equivalent to observed versus missing coverage. Conservative bilinear footprints mark 244,143 of the 4096×2048 prepared map pixels (2.9104%) missing; that count includes neighbors touching source gaps and is distinct from the original 2.3975%.
- **Elevation:** the shape radius minus a 16 km reference sphere is displayed in kilometers with a −13 to +16 km color scale. This includes Ida's gross irregular shape and is not height above a gravitational equipotential. Cartographic relief uses gradients of the same radial grid. Interpolation increases display sampling, not source measurement detail.

**Source survey (2026-09-07)**

See the [investigation ledger](investigations.json) for the recorded sources, decisions and reopening conditions.

**Image registration check**

The revised Stooke map explicitly places north at the top, 0° longitude at the left and east to the right. Recenter the Thomas source by half its width: the original (unflipped) rows align its detailed craters with that map. The prominent crater near 40°E, 11°S and neighboring southern crater chains are vertically reversed by the PDS4 display-direction interpretation. At 1260×630 diagnostic resolution, the detailed crop x=30–429, y=250–419 has Pearson correlation 0.283 with unflipped Thomas and −0.003 when flipped. This is a registration diagnostic, not a claim of identical processing or pixel parity. `rowOrder: north-to-south` records the evidence-backed override. The unchanged JPEG is pinned only for registration; it contributes no runtime texels.

**Coordinates, spin and physical context**

The source shape label pins J2000 pole RA 348.76° ±7.5°, Dec +87.10° ±0.4°, and a retrograde period of 0.1930680 days. The label loses the sign between the prime-meridian constant and daily term. The pinned Galileo [`pck00007.tpc`](https://naif.jpl.nasa.gov/pub/naif/GLL/kernels/pck/pck00007.tpc) resolves it as W = 265.95° − 1864.6280070° d at JD 2451545.0. Its Dec +87.12° differs by 0.02°; this package retains +87.10° from the shape label. `source/preparation/rotation.json` records that deliberate choice. No modern pole reversal is silently applied to this legacy east-longitude texture/shape pair.

The pinned Horizons physical record reports radius 16 km, GM 0.00275 km³/s², mean orbital distance 2.861284886249381 AU and orbital period 4.84005 years. These are the scale/facts used by shared astronomy; the broad 16 km reference sphere does not replace the released irregular geometry. The common presentation epoch is 2026-09-03 TT. Shared heliocentric elements approximate TDB as TT and are not a long-term perturbation model. Flood and Shadows use prepared diffuse lighting in the source body frame. The photographic lens still contains its acquisition shading in either state.

**Preparation and restoration**

The shared `pds-radial-table` reader validates the regular grid, converts kilometers to meters and samples its radii. The existing meshoptimizer 1.2.0 path samples the full 90×180 angular grid, welds exact positions/canonical poles, compacts the source mesh, then simplifies to 800 triangles within a 600 m authored library-error allowance. `RegularizeLight` gives a library estimate, not an exhaustive maximum deviation or a statement of source accuracy. The final display has 800 faces and 402 vertices; all 1,200 edges have two oppositely wound incidents, with one closed component and Euler characteristic 2. Meshoptimizer reports 362.732 m estimated error within the authored 600 m allowance. Against 3,200 equal-area radial samples, measured mean/p95/p99/maximum deviations are 130.984/367.866/554.987/829.461 m with no missing intersections. The maximum sampled deviation exceeds the regularized library estimate; neither quantity is an exhaustive surface-distance bound. Source-fit and topology reports retain the method and worst sample.

Native PolyCSS `u` triangles use 128 px raster cells. Shared preparation owns the surface maps, triangle atlases, lighting banks, shape hits, minimaps and body marker; runtime consumes retained prepared state. No runtime source processing or scene generation is introduced.

**First calibrated image (retained source record)**

**Historical single-image record (2026-09-08):** The first calibrated-image preparation used the original Domingue/GLLSSICAL I/F FITS `0202561278rcal_gre.fit`, green (0.559 µm) filter, acquired 1993-08-28T16:37:43.324Z. It retains the observation's illumination and applies only a fixed 0–0.12 I/F display stretch with gamma 2.2. It does not recover albedo or fill the unseen hemisphere. The original high-pass mosaic remains the default view.

The Thomas shape's accompanying image catalog supplies observer and Sun coordinates, range (10,931 km), north azimuth and body-centre detector coordinates. Catalog samples/lines are treated as one-based; FITS detector rows are used in their stored order, checked directly against the original image. The pinned Galileo SSI instrument kernel supplies 1501.039 mm focal length and 0.01524 mm pixels. The individual calibrated-image labels use an earlier body frame and are not substituted for the shape's control catalog.

No local camera fitting or image warping is performed. Four spatially separated, withheld 32×32 image patches are checked against the published Thomas mosaic projected through the complete 32,040-triangle source mesh. The existing DoG/zero-mean normalized correlation method searches ±24 pixels; every correlation exceeds 0.7. RMS residual is 2.236068 source pixels and maximum is 3.605552; four pixels is the acceptance limit, approximately 444 m. These check the archived registration, not independent absolute ground truth: the mosaic uses the same mission observations. Profiles, exact input hashes and results are in `source/reference/calibrated-registration*.json`. Reproduce with `python tools/objects/terrestrial-layers/verify-catalog-camera.py src/objects/ida/source OUTPUT_DIRECTORY` (numpy, scipy, astropy and Pillow; Node on PATH).

Quality comes from the original `i1278.fit` detector data and `idabad.tab` bad-data blocks, not a brightness threshold. All recorded dropouts, saturated/low-full-well pixels, spikes and Reed–Solomon overflow are withheld, as are raw DN 255 and ISIS special values. The calibrated and raw labels must agree on observation identity, time, target and filter. Finite calibrated zero remains an eligible measurement. Bad-data rectangles use one-based inclusive line/sample coordinates; duplicate records are harmless. Archived lossy compression is retained and is not described as lossless.

Projection uses the source mesh's visibility and terrain-shadow rays, incidence/emission limits of 65°, and a five-pixel inset around detector edges and flagged gaps. These conservative margins limit uncertain limb transfer. The pinhole control is checked at source resolution; the SSI kernel's small radial distortion is not applied to the catalog's controlled image coordinates. Any remaining distortion is included in the measured residuals at the checked patches; this does not establish an exact error bound everywhere. The display mesh keeps its existing 800 native PolyCSS `u` raster faces and 128-pixel cells. Raster coverage counts refer to the cylindrical preparation grid, not physical surface area. Shadows default off.

**Spacecraft mosaic update (2026-09-09)**

Reproduce the added registration check with `python tools/objects/terrestrial-layers/verify-catalog-camera.py src/objects/ida/source OUTPUT --frame 202560500 --profile reference/registration-202560500.json`. The prepared observation report records each frame's share of the displayed surface from equal-area samples (`areaCoverage`), and the atlas observation index names the photograph behind every texel.

The original calibrated FITS/XML and raw detector FITS/label are pinned separately. Both raw quality companions are identified by target, exact time, filter and spacecraft clock, with the released `idabad.tab` block mask. The original four-pixel registration limit and five-pixel quality-boundary inset remain. Four separated 16×16 patches of image 0202560500 give 1.414 px RMS and 2.236 px maximum residual with no local camera fit. These are checks against the Thomas mosaic on the original shape, which shares mission observations; they are not absolute independent cartography.

The SSI reflectance view now combines green-filter images **0202561278** and **0202560500**. The additional 170 m/pixel frame contributes an earlier approach viewpoint; the 111 m/pixel frame still supplies finer overlapping coverage. There is one reflectance dataset row. Thomas’s processed Monochrome map remains because it has much broader coverage and finer source imagery; it cannot be replaced by this pair without losing terrain.

The checked Thomas PDS4 release supplies the shape and registered Galileo SSI mosaic: [data directory](https://sbnarchive.psi.edu/pds4/non_mission/ast-sat.thomas.shape-models_V1_0/data/). The original study is Thomas et al., *The Shape of Ida*, Icarus 120 (1996), [doi:10.1006/icar.1996.0033](https://doi.org/10.1006/icar.1996.0033). `source/manifest.json` pins each byte sequence; the original labels and image list are preserved beside the inputs.

Galileo brightness is normalized to 25° incidence, 0° emission and 25° phase with the Hapke model of [Helfenstein et al. (1996)](https://doi.org/10.1006/icar.1996.0036): single-scattering albedo 0.22, Henyey–Greenstein asymmetry −0.33, shadow-hiding amplitude 1.5 and width 0.020, and roughness 18°, fitted at 0.55 µm to Galileo images at 19.5–109.8° phase. [The model record](source/photometry/helfenstein-1996-hapke.json) transcribes the abstract; Hasselmann et al. (2016, Table 7) list the amplitude as 1.53. The photographs are green-filter frames at about 23° and 26° phase. Incidence and emission stay limited to 65°, and gains to 0.4–4; no sample needed withholding. Overlap level matching, fitted where both frames see the surface within 70° of incidence and emission, gives the second frame a gain of 0.994. The display range is 0–0.0931 I/F, the 99.5th percentile of displayed samples, shown linearly. Where the frames overlap, each point keeps the finer photograph.

</details>
