# Charon

Charon combines New Horizons photographs, elevation, modeled Bond albedo and two infrared views: water-ice absorption and an ammonia-related absorption. Search for **Organa** to compare its ejecta with the surrounding terrain.

## Sources

[Investigation ledger](investigations.json): recorded source decisions, evidence and conditions for revisiting them.

| View or quantity | Source |
| --- | --- |
| Monochrome and elevation | [USGS LORRI/MVIC mosaic](https://astrogeology.usgs.gov/search/map/charon_new_horizons_lorri_mvic_global_mosaic_300m) and [terrain model](https://astrogeology.usgs.gov/search/map/charon_new_horizons_lorri_mvic_global_dem_300m) |
| Enhanced color | [PDS nh_charon_color_mosaic::1.0](https://pds-smallbodies.astro.umd.edu/holdings/pds4-nh_derived-v4.0/plutosystem_composition/mosaic/nh_charon_color_mosaic.lblx) |
| Bond albedo | [PDS nh_charon_bond::1.0](https://pds-smallbodies.astro.umd.edu/holdings/pds4-nh_derived-v4.0/plutosystem_geophysics/albedo/nh_charon_bond.lblx) |
| Opening view | The side New Horizons approached: its reverse inbound velocity in the IAU body frame at closest approach, 35.3°W, 43.1°N, computed from the [NAIF New Horizons SPICE archive](https://naif.jpl.nasa.gov/pub/naif/pds/data/nh-j_p_ss-spice-6-v1.0/nhsp_1000/) (`nh_recon_pluto_od122_v01`, `nh_plu047_od122`, `pck00011`) by [the approach recipe](source/preparation/approach.json) and checked against SpiceyPy ([`packages/bake/src/objects/default-view/fixtures/new-horizons-approach.oracle.test.mts`](../../../packages/bake/src/objects/default-view/fixtures/new-horizons-approach.oracle.test.mts)). |
| Physical placement | JPL Horizons PLU060 and NAIF pck00011 |
| Lighting | The lunar-Lambert law of [Buratti et al. (2017)](https://doi.org/10.1016/j.icarus.2016.11.012), A = 0.70 for LORRI; its limb limit is derived here. See [Lighting law](#lighting-law). |
| Water ice and ammonia | [C_LEISA_HIRES](https://pdssbn.astro.umd.edu/holdings/pds4-nh_derived-v4.0/plutosystem_composition/spec/charon/0299175509_charon_cube.lblx) and [C_LEISA_LORRI_1](https://pdssbn.astro.umd.edu/holdings/pds4-nh_derived-v4.0/plutosystem_composition/spec/charon/0299171308_charon_cube.lblx), spectra and per-pixel wavelengths/coordinates; [Grundy et al. (2016), supplementary method](https://boulder.swri.edu/~buie/biblio/pub106.SOM.pdf), p. 3 and Fig. S6 |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/CHARON/target) Charon centre-point export, snapshot 2026-09-11, public domain. IAU-adopted names with centre, diameter, extent and name origin. Organa is an additional informal mission landmark from Grundy et al. |

Feature notes for 7 names are the lead summary of their English Wikipedia article (CC BY-SA 4.0), recorded in `source/features/notes.json` and credited in the caption. The [NASA overview](https://science.nasa.gov/dwarf-planets/pluto/moons/charon/) provides the introduction. Retain NASA/JHUAPL/SwRI, Paul Schenk/LPI, New Horizons team and PDS attribution.

[Inputs](source/manifest.json) · [Recipe](object.json) · [Credits](NOTICE.md) · [Contributor guide](../README.md)

## Photographs and elevation

The NASA/JHUAPL/SwRI New Horizons LORRI/MVIC monochrome mosaic was mapped by
Paul Schenk and the New Horizons team and distributed by USGS: a 12,693 × 6,347
GeoTIFF at 300 m grid spacing on a 606 km sphere
([PDS processing description](https://pds-smallbodies.astro.umd.edu/holdings/nh-p_psa-lorri_mvic-5-geophys-v1.0/catalog/dataset.cat)).
Actual image resolution varies substantially. Monochrome keeps the source's
lunar-Lambert correction to 15° phase. Elevation uses the signed 16-bit terrain model,
shown from −15 to +15 km. Gaps remain the shared neutral grid, with no invented
neighbouring heights.

## Enhanced color

The Enhanced color dataset is the PDS four-band float32 mosaic (CH4 895 nm, NIR
870 nm, red 625 nm and blue 475 nm) at 1,000 m grid spacing. Display RGB assigns
NIR, red and blue to linear channels over a common 0–0.6 range, then applies
the [shared sRGB output transfer](../../../docs/color-preparation.md). It is
enhanced false color, not natural color or quantitative albedo. About 60.0019%
of the surface is covered
([source inspection](source/validation/color-source-inspection.json)).

## Bond albedo

The Bond-albedo view is a modeled approximation from LORRI photometry and
scattering assumptions, not a direct bolometric measurement. Values run
0.02–0.53, displayed from 0.1 to 0.5. See the
[mapped-science conversion method](../../../packages/bake/src/objects/acquisition/MAPPED-SCIENCE.md).

## Ice absorption

The two closest LEISA scans have native sampling of about 5.0 and 8.6 km, with
per-pixel wavelengths and surface coordinates.

| Display | Calculation, wavelengths in micrometres | Display scale |
| --- | --- | --- |
| Water ice | `1 − band / continuum`; mean band 1.980–2.025, linear continuum between means at 1.760–1.810 and 2.240–2.270 | 45–75% band depth |
| Ammonia | Pooled mean of 2.10–2.17 and 2.26–2.29 divided by mean at 2.20–2.24, following Grundy's supplementary method | 0.75–0.95 continuum/band ratio |

Water depth is an authored diagnostic, not a published mixture model; the
ammonia quantity follows the published ratio. Gaps are not filled. Each quantity covers about 24% of the globe
([preparation record](source/science/leisa/preparation.json)). The
[astropy fixture](../../../packages/bake/src/objects/layers/terrestrial/missions/charon-leisa.json) and
[comparing test](../../../packages/bake/src/objects/layers/observation/spectral-band-maps.test.mts)
check both scans' values around Organa (310.9° E, 54.3° N). This proves
decoding and arithmetic, not a new mineralogical detection.

## Lighting law

The globe is lit with the lunar-Lambert law of [Buratti et al. (2017)](https://doi.org/10.1016/j.icarus.2016.11.012), fitted to New Horizons LORRI approach images: I/F = f(α) [A μ0/(μ0 + μ) + (1 − A) μ0] with A = 0.70. It is recorded in [`source/photometry/buratti-2017-lunar-lambert-lorri.json`](source/photometry/buratti-2017-lunar-lambert-lorri.json). Each lighting frame is the law relative to the flood-lit disc centre, so the centre of the default view shows the map as published; with the Sun behind the viewer the limb darkens to 0.56 of the centre. See [planet limbs](../../../docs/surface-preparation.md#planet-limbs-from-published-laws).

## Evidence

Browser checks covered both ice datasets at DPR 1 and 2, the mobile selector, dragging, Shadows off and on, and the Organa search result. The Organa check places its published coordinate on the sphere and the minimap centre after flying there. A restoration check reproduced the two numeric maps from the original observations.

## Known problems

- Monochrome values are relative brightness. Enhanced color is false color, with mixed resolution and no per-pixel uncertainty array.
- Terrain post spacing of 300 m is not a 300 m accuracy claim. Missing areas remain gridded.
- The ice views show absorption strength, not ice abundance. Grain size, illumination and instrument noise affect the values. Ammonia is a weak feature: fine variations should not be read as confirmed deposits. Organa is an informal mission name; the roughly 5 km crater is smaller than the averaged infrared footprint.
- Bond albedo depends on scattering assumptions and omits unobserved regions. Its label summary mistakenly names Pluto; the target, title, LIDVID and data identify Charon.
- Feature outlines are approximations, not official boundaries. Organa has only its published centre. The minimap starts at 0° east, so the observed hemisphere crosses its left/right seam.
- The lighting law's limb limit, 86.5°, is derived here, not stated by the paper. The paper prints no phase-function values, so frames with Shadows on carry no phase term.
- The LEISA archive label says little-endian and radiance units, but the FITS bytes are big-endian and the overview describes I/F; these ratios use the I/F reading.
