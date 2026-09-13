# Charon

Charon combines New Horizons monochrome and enhanced-color mosaics, a terrain model, and modeled Bond albedo.

## Sources

| View or quantity | Source |
| --- | --- |
| Monochrome and elevation | [USGS LORRI/MVIC mosaic](https://astrogeology.usgs.gov/search/map/charon_new_horizons_lorri_mvic_global_mosaic_300m) and [terrain model](https://astrogeology.usgs.gov/search/map/charon_new_horizons_lorri_mvic_global_dem_300m) |
| Enhanced color | [PDS nh_charon_color_mosaic::1.0](https://pds-smallbodies.astro.umd.edu/holdings/pds4-nh_derived-v4.0/plutosystem_composition/mosaic/nh_charon_color_mosaic.lblx) |
| Bond albedo | [PDS nh_charon_bond::1.0](https://pds-smallbodies.astro.umd.edu/holdings/pds4-nh_derived-v4.0/plutosystem_geophysics/albedo/nh_charon_bond.lblx) |
| Physical placement | JPL Horizons PLU060 and NAIF pck00011 |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/CHARON/target) Charon centre-point export, snapshot 2026-09-11, public domain. IAU-adopted names with centre, diameter, extent and name origin; labels appear at the closest zoom only, and a selected feature stays labelled. |

## Evidence

The 2026-09-13 [color-encoding capture](evidence/color-encoding/capture.json) checks the revised surface at DPR 1 and 2, dragging, Shadows, and the mobile selector. Its source/asset hashes identify the tested uncommitted changes above `8cc1a2fae`; retained geometry is identical to that baseline. [Image delivery](evidence/color-encoding/delivery.json) verifies the current immutable URLs by byte count and SHA-256. The [shared color method](../../../docs/color-preparation.md) explains the scientific display and its limits.

[Displayed surface](evidence/color-encoding/color-dpr1.png) · [DPR 2](evidence/color-encoding/color-dpr2.png) · [Shadows](evidence/color-encoding/oblique-shadows-dpr1.png) · [Mobile](evidence/color-encoding/mobile.png). The capture uses installed Chrome 152. The bundled headless Chromium rejected both the old and new 13,000 × 9,600 atlases in an isolated image decode; Chrome decoded both. Twelve missing baseline assets were [reproduced exactly and restored](evidence/color-encoding/restored-delivery.json), preserving all existing inventory hashes.

Polar sprites now sample the pinned original photographs directly, preserving the declared coordinates and source gaps. Existing monochrome fallback is retained where a color view already uses it. Each sprite remains 512 × 256 pixels at density 1 and 1024 × 512 at density 2; latitude-band images, geometry and lighting remain unchanged. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) describes the method and its limits.

| View | Both prepared levels, before → current |
| --- | --- |
| normal | 145.6 → 159.1 kB |

These download sizes refer only to the polar sprites. Decoded dimensions are unchanged. The scene matches [the previous main version](https://github.com/layoutit/css.earth/tree/3efdf2c9ed9047c72409b2730e879123f8c3b9d2/src/planets/charon/prepared); [the raster recipe](source/preparation/raster.json) and [asset inventory](runtime-assets.json) bind the current preparation. Existing source-resolution and registration limits still apply.

Lane change (this PR): the terrestrial solid-observation lane was retired for Charon; the same pinned inputs and the same decoders (`terrestrial-observation`, `terrestrial-scientific` through the raster lane's `science` adapter) now feed the shared raster lane used by Mercury, Venus, Mars, the Moon and Pluto. The sphere is the shared 16 × 32 mesh (450 leaves, 230 units, 50-pixel tile, 0.005 overlap) with the 256-frame Lambert lighting bank and no atmosphere. Surfaces are painted at 6400 × 3200 (DPR 1) and 12800 × 6400 (DPR 2) — retired 12800 × 6400 atlas; native 300 m mosaic 12,693 px wide. Verified with the package, source-closure, minimap and browser conformance checks listed in the pull request; the nomenclature recipe and map edge are unchanged and the labels were re-drawn against the new atlas. No new science review is claimed.

Run of 2026-09-12 (this version): `node tools/objects/dist/prepare-authored.js charon --write` prepared the package through the shared raster lane and `tools/objects/observation/interpret.mts`; `node --test tests/objects/unit/charon/*.test.mts` passes except the shared runtime-package and import-closure tests that fail identically on `main` (recorded once in the pull request).

A headless Chrome probe (`output/probe-spheres.mts`, ignored scratch) mounted the page on the dev server, selected every lens (normal, enhanced-color, elevation, albedo) with no console errors or failed requests, and pinned a Gazetteer feature from the sidebar search on the standard mesh (feature id 15738).

Gazetteer rims drawn over the prepared equirectangular minimap at both candidate map edges (`output/edge-markers.mjs`) agree with the declared `mapLeftEdgeLongitudeDeg` in `source/preparation/features.json`.

[Independent color-source inspection](source/validation/color-source-inspection.json) records numeric and missing-value anchors. It found about 60% area-weighted RGB coverage before interpolation. No dated test or browser run is cited.

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Charon (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, converts each positive-east centre through `presentation/surface-map.json` with the map’s left edge at 180° E, and anchors it on the mesh; craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. The map edge was fixed by drawing Gazetteer rims under both edge hypotheses and keeping the one where Dorothy, Nasreddin and the Mandjet/Argo chasmata rims on the New Horizons mosaic coincide with the imagery.

Feature notes: 7 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

- Monochrome values are relative brightness. Enhanced color is false color, with mixed resolution and no per-pixel uncertainty array.
- Terrain post spacing of 300 m is not a 300 m accuracy claim. Missing areas remain gridded.
- Bond albedo depends on scattering assumptions and omits unobserved regions. Its label summary mistakenly names Pluto; the target, title, LIDVID and data identify Charon.

[Inputs](source/manifest.json) · [Recipe](object.json) · [Credits](NOTICE.md) · [Contributor guide](../README.md)

<details>
<summary>Monochrome observations, coordinates and terrain processing</summary>

## Observations and coordinates

NASA/JHUAPL/SwRI New Horizons LORRI/MVIC monochrome mosaic, mapped by Paul
Schenk and the New Horizons team, distributed by USGS. The 2017 GeoTIFF is
12,693 × 6,347 at 300 m grid spacing, equirectangular, east-positive longitude,
606,000 m reference sphere. Actual image resolution varies substantially.

- [Mosaic](https://astrogeology.usgs.gov/search/map/charon_new_horizons_lorri_mvic_global_mosaic_300m)
- [Terrain model](https://astrogeology.usgs.gov/search/map/charon_new_horizons_lorri_mvic_global_dem_300m)
- [PDS processing description](https://pds-smallbodies.astro.umd.edu/holdings/nh-p_psa-lorri_mvic-5-geophys-v1.0/catalog/dataset.cat), retained in source/observations/dataset.cat.

Both GeoTIFFs have origin (−1,903,950, 952,200) m, 300/−300 m pixels and a
0° central meridian. The preparer samples those coordinates; it does not assume
that rounded image dimensions are an exact longitude/latitude rectangle.
Longitude wraps into the source's −180°…180° domain. The dedicated 640 × 320
minimaps are centred at 0°, keeping the encounter hemisphere together.

## Preparation and interpretation

Monochrome uses the source's existing Lunar-Lambert photometric correction,
normalized to 15° approach phase, as documented in the PDS description. These
8-bit values are relative brightness, not calibrated I/F or measured albedo.
No second gain correction is applied. Local cast shadows and mixed-resolution
boundaries remain observations; the app's shared flood and directional lighting
are both retained. Exact source zero is documented no-data; dark nonzero terrain
is preserved. Bilinear samples touching no-data are withheld.

Elevation uses the signed 16-bit USGS terrain model in metres above the 606 km
sphere. −32768 is no-data. The numeric palette spans −15 to +15 km with neutral
zero and an unshaded legend. Fixed northwest lighting is calculated from actual
height gradients, spherical pixel spacing and unit vertical scale; ambient is
0.25. The stereo/shape-from-shading source contains variable resolution and
mapping artifacts; 300 m post spacing is not a claim of 300 m terrain accuracy.
Gaps remain the shared neutral grid, with no invented neighboring heights.

The shared solid-body recipe retains its 12,800 × 6,400 latitude-band layout and
1,024 px polar tiles. The normal photographic polar sprites sample the pinned
source grid directly at their final coordinates with a 2 × 2 footprint and lossless WebP
encoding; the latitude bands retain their existing preparation. Lossless maps
are preparation inputs, not globe downloads. One generic object adapter owns runtime behavior.
The resolved context billboard has a dedicated 512 px image from the same
observed navigation crop, rather than enlarging the 32 px UI icon. Prepared
35% ambient / 65% diffuse full-phase shading rounds its circular silhouette;
this is a navigation illustration, not a new terrain or illumination dataset.
No atmosphere shell is supplied: New Horizons found no detectable atmosphere.

</details>

<details>
<summary>Enhanced color, coverage and source checks</summary>

## New Horizons MVIC enhanced color

The additional Enhanced color lens uses the PDS product
[nh_charon_color_mosaic::1.0](https://pds-smallbodies.astro.umd.edu/holdings/pds4-nh_derived-v4.0/plutosystem_composition/mosaic/nh_charon_color_mosaic.lblx),
retained as the original 116,006,912-byte four-band float32 array. SHA-256:
`dd23352035996d670b9c278a1466461623556acc88d66aabd3bc2da1dd15fc5a`.
The bands are CH4 895 nm, NIR 870 nm, red 625 nm and blue 475 nm;
Display RGB assigns the derived NIR/red/blue values to linear channels over one
common 0–0.6 range, then applies the [shared IEC sRGB output
transfer](../../../docs/color-preparation.md). The source remains floating point
through interpolation; clipping and 8-bit quantization happen at output.
This is enhanced false color, not natural color or quantitative albedo.

The PDS4 label declares 3,808 × 1,904, band-sequential little-endian float32,
1,000 m grid spacing, equirectangular planetocentric/east-positive coordinates,
606,000 m sphere, 0° central meridian, and upper-left corner
(−1,904,000, 952,000) m. These coordinates differ from the existing USGS map.
The preparer maps metric pixel centers rather than treating rounded extents as
an exact 360° rectangle. Missing pixels use finite bit pattern `0xFF7FFFFB`;
all selected channels and the complete bilinear footprint must be valid.
Finite negative data remain observations and are clamped only for display.

Independent NumPy decoding found 4,105,311 RGB-valid source pixels, about
60.0019% of surface area after latitude weighting, before conservative
interpolation. Unknown color coverage remains the neutral grid. A raw anchor
at 0°E,80°N has NIR/red/blue values 0.2344332486/0.1650196165/0.1310233623,
before any display transfer. These infrared/visible ratios do not independently
establish the pole's natural color.
The southern cap and unobserved longitudes retain missing values. Numeric and
bit-pattern anchors are in source/validation/color-source-inspection.json.

The source combines lower-resolution MVIC color with panchromatic detail;
1 km post spacing is not uniform native color resolution. The archive applied
lunar-Lambert normalization near L=0.65 at 15° phase, but explicitly warns that
mosaicking means values are no longer strictly I/F. No additional photometric
normalization is applied. The archive refers calibration uncertainties to
Howett et al. (2017); there is no accompanying per-pixel uncertainty array.
Retain NASA/JHUAPL/SwRI, Paul Schenk/LPI, New Horizons team and PDS attribution.
The neighboring absorption-map files inspected in this archive target Pluto,
so none is presented as a Charon composition map.

</details>

<details>
<summary>Physical placement and preparation records</summary>

## Physical placement

606 km radius and GM 106.10 km³/s²: JPL Horizons target 901, PLU060 physical
block, retrieved 2026-09-07. The existing satellite generator fits target 901
relative to Pluto (500@999), using the same ICRF mean-element recipe as the
other moons. Source queries and independent vector fixtures live in the
astronomy package. NAIF pck00011 BODY901 supplies pole RA 132.993°, DEC −6.163°,
and W = 122.695° + 56.3625225°/day since J2000. Charon is a standalone route and
a child of Pluto in the shared frame tree, including navigation and orbit view.

[NASA overview](https://science.nasa.gov/dwarf-planets/pluto/moons/charon/)
provides the mutual tidal locking, discovery and geological introduction.

## Reproduction

The [source manifest](source/manifest.json) pins the original inputs and authored
recipes. See the [contributor guide](../README.md) for shared commands.

</details>

<details>
<summary>Modeled Bond albedo and label discrepancy</summary>

## B6 mapped science

The Bond-albedo view uses [New Horizons derived PDS4 product nh_charon_bond](https://pds-smallbodies.astro.umd.edu/holdings/pds4-nh_derived-v4.0/plutosystem_geophysics/albedo/nh_charon_bond.lblx),
LIDVID `urn:nasa:pds:nh_derived:plutosystem_geophysics:nh_charon_bond::1.0`.
It is a modeled approximation to Bond albedo from LORRI photometry and scattering
assumptions, not a direct bolometric measurement. The wrapper retains every
original byte without resampling. The lens applies the label's scale
0.00392156862745; DN zero remains missing. The 1518×700 map uses a 606 km sphere,
east-positive planetocentric coordinates and 2508.307177965 m pixels. Coverage
ends before the south pole and retains unobserved sectors. Display endpoints
are 0.1–0.5. The migrated label's summary mentions Pluto in error; its title,
target, LIDVID and data object identify Charon. The source label is retained.

Exact bytes, coordinates and validity rules are in the intake plans and receipts.
See the [mapped-science conversion method](../../../tools/objects/acquisition/MAPPED-SCIENCE.md).

</details>

<details>
<summary>Shape, rotation and camera on the shared raster lane</summary>

The recipe declares a sphere of 606 km. The retained mesh keeps its spin origin at 0°; the world frame, pole and prime meridian at the shared epoch come from `src/platform/solar-geometry.mts` as for every prepared body. The scene records a 6.3872-day prograde rotation (synchronous: the astronomy package's orbital mean motion) and 0° tilt to its orbit for the 84-second visual rotation; neither drives the physical frame. The camera is the shared solar-system camera (zoom 1.1, 47.87° initial pitch, -171.78° yaw, taken from the retired lane's camera). The heliocentric view keeps the orbit around Pluto and the parent marker now comes from the shared navigation atlas.

</details>
