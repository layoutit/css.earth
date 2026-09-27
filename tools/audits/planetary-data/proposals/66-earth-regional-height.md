# Earth: regional elevation and bathymetry improvements

Proposal 66 · **Regional candidate** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Earth already uses GEBCO 2026 for global terrain and bathymetry.

Replace or supplement regional numeric height data only where SRTM, AIRSAR or ocean surveys demonstrably improve it.

Content owners: [earth](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/earth/README.md)

## Evidence

The supplied entries include California and Eurasian SRTM, Umnak AIRSAR and OMG coastal Greenland bathymetry.

## Work

Recover original numeric grids and vertical datums; compare measured detail, gaps and uncertainty against the exact GEBCO samples.

## Limits and prior decisions

No mesh change, height inferred from shaded relief or extra row for a coarser historical map. Coastal bathymetry is distinct from ice-flow velocity.

## Acceptance

Independent elevations/depths, vertical datum, shoreline, masks, source resolution and visible improvement within existing zoom and byte budgets.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/shaded-relief-with-color-as-height-california-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/shaded-relief-with-color-as-height-california-mosaic-with-insets/)
- [NASA source page](https://science.nasa.gov/photojournal/srtm-data-release-for-eurasia-index-map-and-colored-height/)
- [NASA source page](https://science.nasa.gov/photojournal/shaded-relief-mosaic-of-umnak-island-aleutian-islands-alaska/)
- [NASA source page](https://science.nasa.gov/photojournal/nasas-omg-mission-maps-sea-floor-depth-off-greenlands-coast/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA03333](https://science.nasa.gov/photojournal/shaded-relief-with-color-as-height-california-mosaic/) | candidate | California SRTM colored relief points to native terrain; compare quantitative regional detail with current GEBCO, without importing the shaded RGB as heights. |
| [PIA03347](https://science.nasa.gov/photojournal/shaded-relief-with-color-as-height-california-mosaic-with-insets/) | duplicate-family | California relief with insets repackages the terrain behind PIA03333; the insets do not create an independent elevation dataset. |
| [PIA03398](https://science.nasa.gov/photojournal/srtm-data-release-for-eurasia-index-map-and-colored-height/) | candidate | Eurasia SRTM release index is a route to original elevation tiles, not a height grid itself; assess native regional benefit over current terrain. |
| [PIA03509](https://science.nasa.gov/photojournal/shaded-relief-mosaic-of-umnak-island-aleutian-islands-alaska/) | candidate | Umnak AIRSAR shaded relief leads to a regional elevation product; inspect native accuracy, date and detail relative to GEBCO before selecting. |
| [PIA20476](https://science.nasa.gov/photojournal/nasas-omg-mission-maps-sea-floor-depth-off-greenlands-coast/) | candidate | OMG Greenland coastal bathymetry could improve a bounded region, conditional on comparison with current GEBCO and verified vertical datum/coverage. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
