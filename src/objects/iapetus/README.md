# Iapetus

## Sources

| View | Source and quantity |
| --- | --- |
| Monochrome | [USGS Cassini/Voyager mosaic](https://astrogeology.usgs.gov/search/map/iapetus_cassini_voyager_global_mosaic_803m), May 2008; about 803 m per source pixel. |
| Enhanced color | [JPL PIA18436](https://www.jpl.nasa.gov/images/pia18436-color-maps-of-iapetus-2014/), 2014; calibrated and photometrically corrected Cassini ultraviolet/infrared imagery. |
| Infrared and Ice absorption | [Nantes Cassini VIMS archive](https://vims.univ-nantes.fr/), three observations from 10 September 2007. Infrared maps near-2.02/1.59/1.28 µm channels to false color; Ice absorption measures the near-2.02 µm feature relative to its continuum. |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/IAPETUS/target) Iapetus centre-point export, snapshot 2026-09-11, public domain. IAU-adopted names with centre, diameter, extent and name origin; labels appear at the closest zoom only, and a selected feature stays labelled. |

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

## Evidence

Polar sprites now sample the pinned original photographs directly, preserving the declared coordinates and source gaps. Existing monochrome fallback is retained where a color view already uses it. Each sprite is 1024 × 512 pixels, the one prepared density; latitude-band images, geometry and lighting remain unchanged. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) describes the method and its limits.

| View | Both prepared levels, before → current |
| --- | --- |
| enhanced | 350.9 → 348.6 kB |
| normal | 161.3 → 160.5 kB |

These download sizes refer only to the polar sprites. Decoded dimensions are unchanged. The scene matches [the previous main version](https://github.com/layoutit/css.earth/tree/3efdf2c9ed9047c72409b2730e879123f8c3b9d2/src/planets/iapetus/prepared); [the raster recipe](source/preparation/raster.json) and [asset inventory](runtime-assets.json) bind the current preparation. Existing source-resolution and registration limits still apply.

Lane change (this PR): the terrestrial solid-observation lane was retired for Iapetus; the same pinned inputs and the same decoders (`terrestrial-observation`, `terrestrial-scientific` through the raster lane's `science` adapter) now feed the shared raster lane used by Mercury, Venus, Mars, the Moon and Pluto. The sphere is the shared 16 × 32 mesh (450 leaves, 230 units, 50-pixel tile, 0.005 overlap) with the 256-frame Lambert lighting bank and no atmosphere. Surfaces are painted at 4096 × 2048 (DPR 1) and 8192 × 4096 (DPR 2) — retired 8192 × 4096 atlas. Verified with the package, source-closure, minimap and browser conformance checks listed in the pull request; the nomenclature recipe and map edge are unchanged and the labels were re-drawn against the new atlas. No new science review is claimed.

Run of 2026-09-12 (this version): `node tools/objects/dist/prepare-authored.js iapetus --write` prepared the package through the shared raster lane and `tools/objects/observation/interpret.mts`; `node --test tests/objects/unit/iapetus/*.test.mts` passes except the shared runtime-package and import-closure tests that fail identically on `main` (recorded once in the pull request).

A headless Chrome probe (`output/probe-spheres.mts`, ignored scratch) mounted the page on the dev server, selected every lens (normal, enhanced, infrared, ice-absorption) with no console errors or failed requests, and pinned a Gazetteer feature from the sidebar search on the standard mesh (feature id 14463).

Gazetteer rims drawn over the prepared equirectangular minimap at both candidate map edges (`output/edge-markers.mjs`) agree with the declared `mapLeftEdgeLongitudeDeg` in `source/preparation/features.json`.

The [B9 qualification report](https://github.com/layoutit/cssEarth/blob/8666462797772dc50bbebecd8618014f5e7bd16c/docs/moons/b9-cassini-ice-surfaces/QUALIFICATION.md) records exact source-map replay and selected package and interaction checks.

The [Iapetus visual review](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/moons/b9-cassini-ice-surfaces/VISUAL-REVIEW-IAPETUS.md#final-main-integration-review) covers six serial captures of the normal, infrared and ice views at DPR 1 and 2, reviewed on 2026-09-10. [Reports and images](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/moons/b9-cassini-ice-surfaces/evidence/README.md) identify capture base `80e19c51349f713c9a9a64b8ef1cbb78917f0fc7` plus the then-modified source, prepared and served-file pins. The same qualification report records failed broader suites and an incomplete full build.

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Iapetus (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, converts each positive-east centre through `presentation/surface-map.json` with the map’s left edge at 180° E, and anchors it on the mesh; craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. The map edge was fixed by drawing Gazetteer rims under both edge hypotheses and keeping the one where Turgis and Engelier rims on the Cassini/Voyager mosaic coincide with the imagery.

Feature notes: 11 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

- Both VIMS maps cover about 23.4% of reference-sphere solid angle, not measured physical surface area. Native scan gaps stay missing. Infrared bilinear/WebP sampling can soften mask edges.
- The independent USGS comparison supports gross VIMS framing; precise local absolute registration remains unqualified.
- VIMS has no photometric correction or cross-observation level matching. Illumination, viewing angle, grain size, noise and archive filtering remain in the signal; neither view measures ice abundance.
- The enhanced-color mosaic has no independent validity mask. Real dark terrain is retained, along with coarse polar imagery, seams and residual photographed shading.
- Geometry is a 734.3 km mean-radius sphere, without the oblate figure or equatorial ridge. No qualified downloadable height raster was found in the 2026-09-06 source search; this does not establish that terrain models do not exist.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

<a id="iapetus-sources"></a>
<a id="monochrome"></a>
<a id="enhanced-color"></a>
<a id="presentation-and-limits"></a>

<details>
<summary>Methods and source notes</summary>

**Monochrome**

[USGS Cassini/Voyager global mosaic, May 2008](https://astrogeology.usgs.gov/search/map/iapetus_cassini_voyager_global_mosaic_803m), 5760 × 2880. The upstream filename says 783m; the catalog and actual GeoTIFF geotransform establish 802.85145591739 m per pixel on a 736 km cartographic sphere. The map contains Cassini images, Voyager polar images and some Saturnshine observations. Exactly zero is the encoded no-data value. Nonzero dark terrain is preserved.

The file is north up, centered on 0 longitude, with raster X increasing eastward. Preparation rolls its 180 E left edge by half a width to the shared 0–360 E texture layout. The source already incorporates the documented 4.5-degree westward IAU longitude correction. Do not shift it again.

**Enhanced color**

[JPL PIA18436, 2014-11-04](https://www.jpl.nasa.gov/images/pia18436-color-maps-of-iapetus-2014/), 11741 × 5871, nominal 400 m per source pixel. Paul Schenk selected, calibrated, registered and photometrically corrected the Cassini imagery. Enhanced colors extend beyond human vision into ultraviolet and infrared. The rectangular map starts at 0 E and is north up; it is not mirrored or rolled.

All supplied pixels are preserved because there is no independent validity mask. The dark leading hemisphere is actual surface albedo and is not treated as illumination to normalize away. The bright trailing hemisphere, dark terrain, equatorial ridge and crater patterns agree geographically with the rolled monochrome source. Coarse polar regions, mosaic seams and residual photographed shading remain.

**Presentation and limits**

No qualified downloadable height raster was found: the [current PDS SPC archive](https://sbnarchive.psi.edu/pds4/cassini/) has no Iapetus bundle, the [2025 author abstract](https://meetingorganizer.copernicus.org/EPSC-DPS2025/EPSC-DPS2025-115.html) says Iapetus is forthcoming, and the [USGS inventory](https://fdp.astrogeology.usgs.gov/fdp/saturn/) lists older stereo topography as unreleased. These are acquisition findings on 2026-09-06, not a claim that terrain models do not exist.

The shared 8192 × 4096 latitude-band layout remains fixed and adds no detail to the 5760 × 2880 monochrome mosaic. The normal and enhanced photographic polar sprites instead sample their pinned source grids directly with a 2 × 2 footprint and retain lossless WebP encoding. Shared curvature lighting and the Shadows control apply to both lenses. No atmosphere, fake elevation, synthetic gap filling or displaced ridge geometry is introduced.

Iapetus is NAIF 608. Physical facts are from [NASA](https://science.nasa.gov/saturn/moons/iapetus/); the astronomy package supplies the Iapetus orbit and IAU rotation. NASA rounds the mean radius to 736 km; the recipe sphere and the astronomy package use the [JPL satellite table](https://ssd.jpl.nasa.gov/sats/phys_par/sep.html) mean radius of 734.30 km. The Inter title font retains its pinned provenance.

</details>

<details>
<summary>Methods: Cassini VIMS calibration, masking and registration</summary>

## Cassini VIMS infrared and water-ice maps (B9)

The original calibrated RC19 C cubes, matched navigation N cubes and original PDS QUB detector/background data are retained beside the body. The [recipe](source/cassini-ice/prepare.json) and [manifest](source/manifest.json) pin exact wavelengths, source masks, calibration arithmetic, observer timing and prepared source maps.

Infrared assigns native channels near 2.02, 1.59 and 1.28 µm to red, green and blue, with a common per-body stretch and gamma 2.2. Ice absorption is `1 - R(near 2.02 µm) / continuum(near 1.82 µm, near 2.20 µm)` using a linear continuum at the exact per-cube wavelengths. Calibrated float32 I/F and derived depth values retain valid negative measurements; only display colors saturate at the authored legend/stretch limits.

Native detector apertures and sampled exposure geometry define support. Original saturation, special values, missing background and their archive-filter dependencies are excluded per band; finite calibrated values alone do not establish detector validity. Numerical maps do not interpolate gaps into measured coverage. The 1024 × 512 output grid adds no native resolution. Exact observation/source-pixel companion TIFFs preserve ownership. Infrared uses the existing photographic bilinear/WebP packing; ice absorption uses nearest scalar sampling. The maps use the existing preparation and unchanged mesh and retained scene.

Native source-camera reconstruction and dense independent aperture checks test detector support and between-pose boundary motion. A missing original background row and its local filtering dependencies are withheld without discarding the usable observation. These sampled support checks do not establish an integrated detector PSF or exact absolute pointing.

The [body registration record](source/cassini-ice/evidence/registration.md), [preparation receipt](source/cassini-ice/preparation-receipt.json) and [B9 source review](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/moons/b9-cassini-ice-surfaces/source-review/iapetus.md) contain source-selection and independent-check evidence. The [B9 report](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/moons/b9-cassini-ice-surfaces/README.md) gives reproduction commands and the shared measurement definitions.

</details>

<details>
<summary>Shape, rotation and camera on the shared raster lane</summary>

The recipe declares a sphere of 734.3 km. The retained mesh keeps its spin origin at 0°; the world frame, pole and prime meridian at the shared epoch come from `src/platform/solar-geometry.mts` as for every prepared body. The scene records a 79.3359-day prograde rotation (synchronous: the astronomy package's orbital mean motion) and 0° tilt to its orbit for the 84-second visual rotation; neither drives the physical frame. The camera is the shared solar-system camera (zoom 1.1, 40.00° initial pitch, 0.00° yaw, taken from the retired lane's camera).

</details>
