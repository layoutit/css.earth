# Titan

## Sources

- The first surface lens is **Near-infrared**, Cassini ISS CL1/CB3 at 937.994 nm (9.498 nm bandwidth). Source: [Weller et al., USGS 2026 release](https://doi.org/10.5066/P14FAEKS).

- The Cassini RADAR Team's mission-end MIDR S00 mosaic combines SAR and HiSAR through flyby T126. The two original gzip PDS3 hemispheres are from the [Cornell archive](https://data.astro.cornell.edu/RADAR/DATA/MIDR/S00/).

- Formal `CO-SSA-RADAR-5-GTDR-V1.0` float products through T126 add three views: measured height (`GTF`), interpolated height (`GTI`) and distance to input data (`GTD`). Heights are metres above the 2575.0 km sphere, distance is kilometres.

## Evidence

Lane change (this PR): the terrestrial solid-observation lane was retired for Titan; the same pinned inputs and the same decoders (`terrestrial-observation`, `terrestrial-mosaic`, `terrestrial-scientific` through the raster lane's `science` adapter) now feed the shared raster lane used by Mercury, Venus, Mars, the Moon and Pluto. The sphere is the shared 16 × 32 mesh (450 leaves, 230 units, 50-pixel tile, 0.005 overlap) with the 256-frame Lambert lighting bank and no atmosphere. Surfaces are painted at 4096 × 2048 (DPR 1) and 8192 × 4096 (DPR 2) — retired 8192 × 4096 atlas; native 2026 ISS mosaic 23,048 px wide. Verified with the package, source-closure, minimap and browser conformance checks listed in the pull request; the nomenclature recipe and map edge are unchanged and the labels were re-drawn against the new atlas. No new science review is claimed.

Run of 2026-09-12 (this version): `node tools/objects/dist/prepare-authored.js titan --write` prepared the package through the shared raster lane and `tools/objects/observation/interpret.mts`; `node --test tests/objects/unit/titan/*.test.mts` passes except the shared runtime-package and import-closure tests that fail identically on `main` (recorded once in the pull request).

A headless Chrome probe (`output/probe-spheres.mts`, ignored scratch) mounted the page on the dev server, selected every lens (normal, radar, topography, interpolated, coverage-distance, geology) with no console errors or failed requests, and pinned a Gazetteer feature from the sidebar search on the standard mesh (feature id 7025).

Gazetteer rims drawn over the prepared equirectangular minimap at both candidate map edges (`output/edge-markers.mjs`) agree with the declared `mapLeftEdgeLongitudeDeg` in `source/preparation/features.json`.

- **Measured height:** Independent source-cell decoding gives measured spherical area coverage 6.0000%. Source extrema and coordinate anchors are in [source/validation/b2-scalar-anchors.json](source/validation/b2-scalar-anchors.json).

- **Near-infrared:** The corresponding GeoTIFF header was checked independently and reports the same grid with ISIS float Null, -3.4028226550889045e38.

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Titan (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, converts each positive-east centre through `presentation/surface-map.json` with the map’s left edge at 0° E, and anchors it on the mesh; craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. The map edge was fixed by drawing Gazetteer rims under both edge hypotheses and keeping the one where Menrva, Xanadu and the Kraken Mare shoreline on the ISS mosaic coincide with the imagery.

- **Near-infrared:** It is not visible color. This interpretation is source-informed: the release does not supply a separate PNG validity band.

- **Radar:** Display brightness retains those byte levels; it is neither optical albedo nor elevation. Radar speckle and source swath boundaries remain.

- **Distance:** Distance is not uncertainty; the tiny negative GTD roundoff minimum −4.31e−11 km is preserved in source sampling and clamped by the visible zero endpoint.

- **GTDR qualification:** Qualification status: source intake and recipe proposal. Final mesh selection (where applicable), restored-source and prepared browser/visual gates remain pending.

[Inputs](source/manifest.json) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="titan-sources"></a>

The pinned, lossless PNG is the published display export of the controlled 23,048 × 11,524 global mosaic. The accompanying original ISIS label and release metadata describe the 702 m grid, planetocentric latitude, east-positive longitude and 2,575,000 m map radius. Center longitude is 180°; the image runs from approximately 0° to 360° east with north at the top. Grid bounds extend less than half a source pixel beyond the nominal globe. No longitude mirror or polar terrain continuation is applied.

The PNG follows the [ISIS display export convention](https://isis.astrogeology.usgs.gov/9.0.0/Application/presentation/Tabbed/isis2std/isis2std.html): Null is zero and valid dark data starts at one. Only exact zero is withheld, including a small southern gap; valid dark dunes and lakes are preserved. Coverage is resampled as alpha before the shared neutral grid is painted.

USGS already applied weighted mosaicking and a 31 × 31 high-pass filter. Its display levels and remaining haze, cloud features and patch boundaries are preserved. The 8,192 × 4,096 prepared map is about 1.98 km per equatorial texel; the 702 m source grid is not a claim of uniform native image resolution. Shared globe lighting is approximate and remains controlled by Shadows.

The scene uses the vendored JPL/IAU Titan radius (2,575.5 km), rotation and Saturn-relative orbit. That physical radius and the source map's reference sphere are distinct. The small cartographic radius difference does not scale image features relative to the rendered globe.

## Radar

Preparation decodes the attached labels, uses their west-positive longitudes to place the pixels in our east-positive map, and preserves exact `MISSING_CONSTANT = 0` coverage. Valid low-backscatter lakes remain observed. The public label documents incidence-normalized backscatter in logarithmic form: dB = DN × 0.10000012 − 20.10001. Shared globe lighting is an approximate visualization.

The selected archive level is 32 pixels/degree (1.404 km at the equator), prepared at the shared 8,192 × 4,096 size (1.98 km per equatorial texel). The archive also has 351 m grids, but those are not the delivered texel density. Original labels, source dimensions, checksums and acquisition URLs are pinned.

## Other lenses considered

The [2019 VIMS/ISS Enhanced color composite](https://data.caltech.edu/records/8q9an-yt176) was inspected as a candidate. Its [authors document](https://www.hou.usra.edu/meetings/lpsc2019/eposter/1423.pdf) filling missing VIMS color with neighboring values and manually removing seams. The published files do not include a validity mask distinguishing those fills. It is withheld until observed color coverage can be established; the ISS mask cannot establish VIMS coverage. Visible haze also needs a suitable observed map. An orange recoloring of infrared would not be visible imagery.

Facts: [NASA Science](https://science.nasa.gov/saturn/moons/titan/facts/). Exact input identities, acquisition URLs, credits and consumers are in `source/manifest.json`; preparation is authored in `object.json` and source JSON.

Delivery uses full-resolution WebP quality 90 for the surface and pole atlases, with lossless alpha. Source observations and preparation maps remain lossless; the latter are excluded from runtime installation.

## B2 quantitative GTDR views

All six original gzip IMG products and detached labels are retained. Attached labels identify little-endian PC_REAL 32-bit values and exact `FF7FFFFB` missing bits. No byte-browse quantization is used. Two 1440 × 1440 west-positive planetographic hemispheres are independently decoded from source offsets. The spherical reference makes geographic and centric latitude equivalent. Posting is 8 pixels/degree, about 5.62 km at the equator; it is not a footprint or accuracy claim.

The 2019 labels list adjusted altimetry and SARtopo. The 2017 Corlies paper also discusses stereo DTMs; its approximate 9% total coverage is not assigned to this different delivered product. Interpolated grids have small missing regions and those remain missing.

Height colors use a common −2500 to +2500 m scale across measured and interpolated views. Distance uses 0–1000 km. Terrain geometry remains the existing sphere; these maps do not invent global physical relief. The superseded Cornell cube ZIP/cubes and byte-browse products remain research evidence and are not rendered.

No readiness is claimed.

</details>

<details>
<summary>Shape, rotation and camera on the shared raster lane</summary>

The recipe declares a sphere of 2575.5 km. The retained mesh keeps its spin origin at 0°; the world frame, pole and prime meridian at the shared epoch come from `src/platform/solar-geometry.mts` as for every prepared body. The scene records a 15.9464-day prograde rotation (synchronous: the astronomy package's orbital mean motion) and 0° tilt to its orbit for the 84-second visual rotation; neither drives the physical frame. The camera is the shared solar-system camera (zoom 1.1, 40.00° initial pitch, 0.00° yaw, taken from the retired lane's camera). The heliocentric view keeps the orbit around Saturn and the parent marker now comes from the shared navigation atlas.

</details>
