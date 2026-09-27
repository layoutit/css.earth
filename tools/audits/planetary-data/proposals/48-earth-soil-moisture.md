# Earth: measured soil moisture and freeze/thaw

Proposal 48 · **Qualification first** · Priority 2 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Earth has imagery, terrain, night lights and a temperature-anomaly view. SMAP moisture and freeze/thaw are distinct proposed quantities.

Add one compact SMAP soil-moisture observation set; include freeze/thaw only from its own valid product and categorical definition.

Content owners: [earth](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/earth/README.md)

## Evidence

The supplied pages include commissioning-era radiometer/radar products and later surface-moisture maps. They have different spatial resolutions and gaps.

## Work

Select a versioned numeric product, retain acquisition interval, quality flags, land/ice mask and uncertainty, and prepare a bounded date set offline.

## Limits and prior decisions

Do not confuse brightness temperature with soil moisture or commissioning maps with uninterrupted operational coverage. Original-data access has not been verified by this Photojournal audit.

## Acceptance

Official-unit samples, invalid-value handling, measured footprint, date averaging and incremental source value over existing Earth layers.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/nasa-smap-images-show-progression-of-spring-thaw-in-northern-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/nasa-soil-moisture-mission-produces-first-global-radiometer-map/)
- [NASA source page](https://science.nasa.gov/photojournal/nasa-soil-moisture-mission-produces-first-global-radar-map/)
- [NASA source page](https://science.nasa.gov/photojournal/high-resolution-global-soil-moisture-map/)
- [NASA source page](https://science.nasa.gov/photojournal/southern-us-soil-moisture-map/)
- [NASA source page](https://science.nasa.gov/photojournal/smap-global-map-of-surface-soil-moisture-aug-25-27-2015/)
- [NASA source page](https://science.nasa.gov/photojournal/new-nasa-maps-show-flooding-changes-in-aftermath-of-hurricane-harvey/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA11399](https://science.nasa.gov/photojournal/nasa-smap-images-show-progression-of-spring-thaw-in-northern-hemisphere/) | candidate | SMAP freeze/thaw sequence is a categorical radar retrieval, distinct from soil-moisture concentration; retain quality and observation dates. |
| [PIA18057](https://science.nasa.gov/photojournal/nasa-soil-moisture-mission-produces-first-global-radiometer-map/) | candidate | First SMAP radiometer map is an instrument commissioning observation; establish whether it is brightness temperature or a retrieved moisture product before labeling. |
| [PIA18058](https://science.nasa.gov/photojournal/nasa-soil-moisture-mission-produces-first-global-radar-map/) | candidate | SMAP radar commissioning map is distinct from radiometer brightness and combined moisture retrievals; preserve quantity and instrument-specific quality flags. |
| [PIA19337](https://science.nasa.gov/photojournal/high-resolution-global-soil-moisture-map/) | candidate | Combined SMAP radar/radiometer moisture covers May 4–11 2015 with commissioning gaps; preserve interval, resolution and validity. |
| [PIA19338](https://science.nasa.gov/photojournal/southern-us-soil-moisture-map/) | candidate | Southern-US SMAP comparison contrasts radiometer-only and combined retrievals on April 27 2015; processing versions are not independent soil states. |
| [PIA19877](https://science.nasa.gov/photojournal/smap-global-map-of-surface-soil-moisture-aug-25-27-2015/) | candidate | SMAP radiometer-only three-day August 2015 moisture product is distinct from early combined radar retrievals; preserve frozen/snow flags and averaging period. |
| [PIA21951](https://science.nasa.gov/photojournal/new-nasa-maps-show-flooding-changes-in-aftermath-of-hurricane-harvey/) | candidate | SMAP Harvey sequence measures fractional surface-water cover over coarse footprints, distinct from SAR binary-looking flood proxies and soil moisture. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
