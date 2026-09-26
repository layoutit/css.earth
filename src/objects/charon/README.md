# Charon

Charon combines New Horizons photographs, elevation, modeled Bond albedo and two infrared views: water-ice absorption and an ammonia-related absorption. Search for **Organa** to compare its ejecta with the surrounding terrain.

## Sources

[Investigation ledger](investigations.json): recorded source decisions, evidence and conditions for revisiting them.

| View or quantity | Source |
| --- | --- |
| Monochrome and elevation | [USGS LORRI/MVIC mosaic](https://astrogeology.usgs.gov/search/map/charon_new_horizons_lorri_mvic_global_mosaic_300m) and [terrain model](https://astrogeology.usgs.gov/search/map/charon_new_horizons_lorri_mvic_global_dem_300m) |
| Enhanced color | [PDS nh_charon_color_mosaic::1.0](https://pds-smallbodies.astro.umd.edu/holdings/pds4-nh_derived-v4.0/plutosystem_composition/mosaic/nh_charon_color_mosaic.lblx) |
| Bond albedo | [PDS nh_charon_bond::1.0](https://pds-smallbodies.astro.umd.edu/holdings/pds4-nh_derived-v4.0/plutosystem_geophysics/albedo/nh_charon_bond.lblx) |
| Opening view | The side New Horizons approached: its reverse inbound velocity in the IAU body frame at closest approach, 35.3°W, 43.1°N, computed from the [NAIF New Horizons SPICE archive](https://naif.jpl.nasa.gov/pub/naif/pds/data/nh-j_p_ss-spice-6-v1.0/nhsp_1000/) (`nh_recon_pluto_od122_v01`, `nh_plu047_od122`, `pck00011`) by [the approach recipe](source/preparation/approach.json) and checked against SpiceyPy ([`tools/oracles/spice/new-horizons-approach.oracle.test.mts`](../../../tools/oracles/spice/new-horizons-approach.oracle.test.mts)). |
| Physical placement | JPL Horizons PLU060 and NAIF pck00011 |
| Lighting | The lunar-Lambert law of [Buratti et al. (2017)](https://doi.org/10.1016/j.icarus.2016.11.012), A = 0.70 for LORRI; its limb limit is derived here. See [Lighting law](#lighting-law). |
| Water ice and ammonia | [C_LEISA_HIRES](https://pdssbn.astro.umd.edu/holdings/pds4-nh_derived-v4.0/plutosystem_composition/spec/charon/0299175509_charon_cube.lblx) and [C_LEISA_LORRI_1](https://pdssbn.astro.umd.edu/holdings/pds4-nh_derived-v4.0/plutosystem_composition/spec/charon/0299171308_charon_cube.lblx), spectra and per-pixel wavelengths/coordinates; [Grundy et al. (2016), supplementary method](https://boulder.swri.edu/~buie/biblio/pub106.SOM.pdf), p. 3 and Fig. S6 |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/CHARON/target) Charon centre-point export, snapshot 2026-09-11, public domain. IAU-adopted names with centre, diameter, extent and name origin. Organa is an additional informal mission landmark from Grundy et al. |

## Evidence

The [LEISA capture record](evidence/leisa-ice/capture.json) binds the tested inputs, prepared assets and browser views. It checks both datasets at DPR 1 and 2, the mobile selector, dragging, Shadows off/on/off, and the Organa search result. The browser verifies the downloaded texture hashes and keeps the same 450 surface leaves while switching datasets.

[Water ice](evidence/leisa-ice/water-ice.png) · [Ammonia](evidence/leisa-ice/ammonia.png) · [Organa](evidence/leisa-ice/organa.png) · [DPR 2](evidence/leisa-ice/ammonia-dpr2.png) · [Mobile](evidence/leisa-ice/mobile.png)

The current raster textures start at 0° east. Features and minimaps now use that same frame; the retired 180° feature offset put labels on the opposite hemisphere. The Organa regression checks its published coordinate against the sphere axes, and the browser checks the minimap centre after flying there. Original photographs, elevation, albedo, geometry and lighting assets are byte-identical to the main baseline.

The [source restoration check](evidence/leisa-ice/restoration.json) downloaded the original observations into an empty source directory and reproduced the two numeric maps and processing record. The only bootstrap was the checked-in band recipe. Node could not verify the SwRI PDF certificate chain in this environment, so that exact method PDF was retrieved with system curl and normal certificate validation. The [delivery check](evidence/leisa-ice/delivery.json) independently installed and hashed every Charon runtime asset from its immutable URL.

Browser scope: installed Chrome on application base `ebd16155a`, with the final Charon runtime and texture bytes. The subsequent main merges changed other bodies and preparation, not the application runtime used in these captures. Two preview-only filters omit unavailable Helix/Cat’s Eye volume banks; their local restoration requires a missing NOX model. This is Charon interaction evidence, not an unmodified whole-application build pass. The capture record lists the exact preview differences and the unrelated baseline test failures.

Earlier [color-encoding evidence](evidence/color-encoding/capture.json) still applies to the unchanged photographic bytes. Its [delivery record](evidence/color-encoding/delivery.json), [color method](../../../docs/color-preparation.md) and [independent source inspection](source/validation/color-source-inspection.json) retain the earlier decoding and display qualifications. The older captures do not verify the corrected feature frame.

## Lighting law

The globe is lit with the lunar-Lambert law of [Buratti et al. (2017)](https://doi.org/10.1016/j.icarus.2016.11.012), fitted to New Horizons LORRI approach images: I/F = f(α) [A μ0/(μ0 + μ) + (1 − A) μ0] with A = 0.70, found by minimizing offsets between the overlapping images of their Table 1 at 15.08° to 16.85° phase. The record [`source/photometry/buratti-2017-lunar-lambert-lorri.json`](source/photometry/buratti-2017-lunar-lambert-lorri.json) writes it as a weight of A/(2 − A) = 0.5385 on 2 μ0/(μ0 + μ); the two forms differ only by a constant. Each lighting frame is the law relative to the flood-lit disc centre, so the centre of the default view shows the map as published. See [planet limbs](../../../docs/surface-preparation.md#planet-limbs-from-published-laws).

- The paper states no emission range. The limit the law is held at toward the limb, 86.5°, is derived here and is second class: the emission angle at the outermost pixel centre of the finest Charon image in Table 1, LOR_0299147641 at 2.31 km per pixel, on a 606 km sphere. Beyond it the law is held.
- With the Sun behind the viewer the law darkens the limb to 0.56 of the centre at 86.5° emission.
- The paper computes the surface phase function f(α) from the disc-integrated phase curve and prints no values, so the frames with Shadows on carry no phase term: only the disk function changes with the Sun.
- The PDS colour mosaic was normalized with its own lunar-Lambert value (see below); this law is the paper's global fit to the LORRI approach images.
- The bank was redrawn on 2026-09-25 with `node tools/objects/dist/prepare-authored.js charon --write --reuse-images --accept-changed=raster`. Outside `lighting`, the only difference between the published recipe and this one is main's removal of `"polesCombined": false` in d090ce637d. That changes no image: `false` already meant each lens writes its own poles, now the only path. The shadowless overlay's alpha along its centre row, main then this version: 0.000 then 0.000 at the centre, 0.086 then 0.027 at half the radius, 0.353 then 0.129 at 0.9 and 0.490 then 0.184 at 0.98. The redraw also rebuilt `runtime.json` with texture placements that differ by rounding (0.01 to 0.05 units); it was restored to the published bytes, so only the lighting changed.

## Known problems

Named features: preparation reads the pinned IAU Gazetteer centre-point archive, drops historic albedo names, folds repeated rows and converts positive-east coordinates through `presentation/surface-map.json` with a 0° map edge. Craters and faculae use diameter circles; other types use published extent boxes. These outlines are approximations, not official boundaries. Organa has only its published centre, with no invented rim. The minimap also starts at 0° east, so the observed hemisphere crosses its left/right seam.

Feature notes: 7 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

- Monochrome values are relative brightness. Enhanced color is false color, with mixed resolution and no per-pixel uncertainty array.
- Terrain post spacing of 300 m is not a 300 m accuracy claim. Missing areas remain gridded.
- The ice views show absorption strength, not ice abundance. Grain size, illumination and instrument noise affect the values. Ammonia is a weak feature: fine variations should not be read as confirmed deposits. Organa is an informal mission name; the roughly 5 km crater is smaller than the averaged infrared footprint.
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
- [PDS processing description](https://pds-smallbodies.astro.umd.edu/holdings/nh-p_psa-lorri_mvic-5-geophys-v1.0/catalog/dataset.cat).

Both GeoTIFFs have origin (−1,903,950, 952,200) m, 300/−300 m pixels and a
0° central meridian. The preparer samples those coordinates; it does not assume
that rounded image dimensions are an exact longitude/latitude rectangle.
Longitude wraps into the source's −180°…180° domain. The dedicated 640 × 320
minimaps share the globe's 0° east map edge; encounter coverage crosses that seam.

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
ends before the south pole and retains unobserved sectors. Values run
0.02–0.53 (1st–99th percentile 0.15–0.44); display endpoints 0.1–0.5 saturate
both tails. The migrated label's summary mentions Pluto in error; its title,
target, LIDVID and data object identify Charon. The source label is retained.

Exact bytes, coordinates and validity rules are in the intake plans and receipts.
See the [mapped-science conversion method](../../../tools/objects/acquisition/MAPPED-SCIENCE.md).

</details>

<details>
<summary>Shape, rotation and camera on the shared raster lane</summary>

The recipe declares a sphere of 606 km. The retained mesh keeps its spin origin at 0°; the world frame, pole and prime meridian at the shared epoch come from `src/platform/solar-geometry.mts` as for every prepared body. The scene records a 6.3872-day prograde rotation (synchronous: the astronomy package's orbital mean motion) and 0° tilt to its orbit for the 84-second visual rotation; neither drives the physical frame. The camera is the shared solar-system camera (zoom 1.1, 47.87° initial pitch, -171.78° yaw, taken from the retired lane's camera).

</details>

<details>
<summary>LEISA ice absorption: source selection, method and limits</summary>

The two closest Charon scans have native sampling of approximately 5.0 and 8.6 km,
from the archive's mid-scan distances and LEISA's 62 microradian pixels. Their
640 × 640 and 320 × 320 arrays are resampled observations, not finer measurements.
Each has a per-pixel wavelength cube and five geometry backplanes: phase,
emission, incidence, latitude and longitude. We use those surface coordinates
with positive-east longitude on the existing 606 km reference sphere.

| Display | Calculation, wavelengths in micrometres | Display scale |
| --- | --- | --- |
| Water ice | `1 − band / continuum`; mean band 1.980–2.025, linear continuum between means at 1.760–1.810 and 2.240–2.270 | 45–75% band depth |
| Ammonia | Pooled mean of 2.10–2.17 and 2.26–2.29 divided by mean at 2.20–2.24, following Grundy's supplementary method | 0.75–0.95 continuum/band ratio |

Water depth is an authored diagnostic of the broad 2 micrometre ice feature,
not a reproduction of a published mixture model. The ammonia quantity follows
the published ratio. Values below 1 do not mean negative ammonia: the surrounding
water-ice spectrum is curved. Neither quantity measures ice abundance.

Only zero-based channels 0–196 of the ordinary-resolution spectral segment are
used. The archive warns of uncertain scattered-light calibration in the
high-resolution segment, particularly channels 199–207. Wavelength selection
is per pixel. The recipe sets minimum channel counts for each band. NaNs and
finite special values above 1e30 in magnitude are missing. Every contributing
pixel and all four interpolated footprint corners must pass the 70-degree
incidence and emission limits. Gaps are not filled.

Water spectra are pooled over 3 × 3 archived pixels. Ammonia uses 6 × 6 in the
closest scan and 3 × 3 in the earlier scan, about 12 km near the disk centre;
footprints broaden toward the limb. Ratios are formed after pooling spectra.
No uncertainty reduction from independent resampled pixels is claimed.
Each accepted footprint paints only covered centres on a 720 × 360 map. Overlap
chooses the smaller ground footprint, bounded below by native instrument
resolution, independently of absorption strength. No gain matching is applied.
The [preparation record](source/science/leisa/preparation.json) gives per-scan
contributions and area-weighted coverage, about 24% of the globe per quantity.

The six earlier scans in the archive overview have roughly 30–132 km native
sampling. Their metadata were surveyed; their spectra were not processed or
qualified here. They remain candidates for coarse-scale work, but cannot add
crater-scale detail. Pluto's ready-made absorption maps are not Charon data.

Three archive inconsistencies remain explicit. The migrated PDS4 label says
little-endian for spectra/wavelengths, but native FITS bytes are big-endian;
astropy independently verifies their physical values. The label retains
radiance units, while the collection overview describes these products as I/F.
The overview mistypes the missing-value exponent; native bytes contain about
−3.4028235e38. These ratios use the overview's I/F interpretation.

The [astropy fixture](../../../tests/oracles/fits/charon-leisa.json) and
[comparing test](../../../tools/objects/observation/spectral-band-maps.test.mts)
check both scans' native values and independently calculated cells around
Organa's published coordinate (310.9° E, 54.3° N). This proves decoding and
arithmetic, not a new mineralogical detection. The published map supplies the
spatial interpretation; LEISA is coarser and noisier than the visible mosaic.

The new views use 2048 × 1024 and 4096 × 2048 maps before latitude-band packing.
Numeric bilinear interpolation softens display transitions only where all four
neighbouring cells are valid; it does not add measurements. A less-averaged visual comparison showed stronger scan-pattern variation; it did
not establish finer surface features, so the original spectral pooling is retained.
The existing per-surface size declaration keeps broad signals out of
photograph-sized atlases. Geometry, lighting, camera and the previous four
textures are retained; Shadows starts off. The source manifest and acquisition
recipe restore the original FITS and reproduce the numerical GeoTIFFs before
the normal body bake. The runtime inventory records the ten added image sizes.

</details>
