# Earth: measured ice motion

Proposal 53 · **Regional candidate** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Earth has static terrain and imagery. Measured ice flow and regional cryosphere products require separate source qualification.

Prepare a measured Antarctic ice-speed field, with separate qualification of Iceland ice motion and source snow-water products.

Content owners: [earth](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/earth/README.md)

## Evidence

The Antarctic page identifies a radar-interferometry velocity map with 300 m sampling. Other supplied pages concern local ice speed, snow and coastal bathymetry.

## Work

Retrieve original grids, observation dates and uncertainties. Use a scalar speed view if supported; retain direction in the data without inventing motion arrows or animation.

## Limits and prior decisions

Sampling is not accuracy and an old survey is not current ice motion. Snow water content is a different quantity from speed. Coastal Greenland bathymetry belongs in proposal 66.

## Acceptance

Velocity components and units, speed calculation, polar projection, missing areas, epoch and comparison with the source map.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/global-view-of-the-arctic-ocean/)
- [NASA source page](https://science.nasa.gov/photojournal/nasa-research-leads-to-first-complete-map-of-antarctic-ice-flows/)
- [NASA source page](https://science.nasa.gov/photojournal/spatial-distribution-of-tuolumne-river-basin-mapped-by-airborne-snow-observatory/)
- [NASA source page](https://science.nasa.gov/photojournal/nasa-radar-maps-the-winter-pace-of-icelands-glaciers/)
- [NASA source page](https://science.nasa.gov/photojournal/nasas-omg-mission-maps-sea-floor-depth-off-greenlands-coast/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA02970](https://science.nasa.gov/photojournal/global-view-of-the-arctic-ocean/) | candidate | Radarsat Arctic sea-ice mosaic adds a broad radar/cryosphere lead; distinguish dated backscatter imagery from inferred motion or thickness. |
| [PIA14556](https://science.nasa.gov/photojournal/nasa-research-leads-to-first-complete-map-of-antarctic-ice-flows/) | candidate | Antarctic radar-interferometric flow gives velocity vectors with a stated 300 m sampling; native grid, epoch and uncertainty are required. |
| [PIA17775](https://science.nasa.gov/photojournal/spatial-distribution-of-tuolumne-river-basin-mapped-by-airborne-snow-observatory/) | candidate | Tuolumne snow-water equivalent combines measured snow depth with density assumptions; preserve that inference and the April–June 2013 intervals. |
| [PIA17924](https://science.nasa.gov/photojournal/nasa-radar-maps-the-winter-pace-of-icelands-glaciers/) | candidate | Iceland winter radar ice-motion campaign is a regional velocity lead; identify actual measured products and acquisition interval, not just the campaign announcement. |
| [PIA20476](https://science.nasa.gov/photojournal/nasas-omg-mission-maps-sea-floor-depth-off-greenlands-coast/) | candidate | OMG Greenland coastal bathymetry could improve a bounded region, conditional on comparison with current GEBCO and verified vertical datum/coverage. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
