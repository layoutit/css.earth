# Moon: qualify regional terrain and photometric products

Proposal 28 · **Regional candidate** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

The Moon already has global imagery, elevation, thermal, mineral and geology views.

Prepare only local products whose numeric terrain or photometric information adds a measured improvement over those views.

Content owners: [moon](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/moon/README.md)

## Evidence

The linked regional collection lists 15 TIFFs. Separate USGS records identify the Apollo 17 orthomosaic, south-polar DEM/slope and Haworth photoclinometry. PIA00090 adds an Aristarchus multispectral lead. Each remains a regional product with its own method and quality limits.

## Work

Match source quantity, map projection, scale, footprint and quality for each location. Group related variants through existing controls if a regional addition is warranted.

## Limits and prior decisions

Keep the mesh fixed. No global fill, duplicate mineral claims or separate photographs panel.

## Acceptance

Source-to-output values, regional bounds, landmark registration and visible benefit at the selected texture size.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [USGS product record](https://astrogeology.usgs.gov/search/map/moon_apollo_17_lroc_nac_landing_site_orthomosaic_50cm)
- [USGS product record](https://astrogeology.usgs.gov/search/map/moon_lro_south_pole_dem)
- [USGS product record](https://astrogeology.usgs.gov/search/map/lunar_lro_nac_haworth_photoclinometry_dem_1m)
- [USGS product record](https://astrogeology.usgs.gov/search/map/regional_topography_and_photometric_cube_data_for_lunar_locations)
- [USGS product record](https://astrogeology.usgs.gov/search/map/moon_lro_south_pole_dem_slope_map)
- [NASA source page](https://science.nasa.gov/photojournal/multispectral-mosaic-of-the-aristarchus-crater-and-plateau/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA00090](https://science.nasa.gov/photojournal/multispectral-mosaic-of-the-aristarchus-crater-and-plateau/) | candidate | Aristarchus Clementine three-filter ratios are a regional spectral lead; recover calibrated bands and compare with current Kaguya coverage, not the decorated RGB alone. |

USGS catalogue IDs: `regional_topography_and_photometric_cube_data_for_lunar_locations`, `moon_apollo_17_lroc_nac_landing_site_orthomosaic_50cm`, `moon_lro_south_pole_dem`, `lunar_lro_nac_haworth_photoclinometry_dem_1m`, `moon_lro_south_pole_dem_slope_map`.

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
