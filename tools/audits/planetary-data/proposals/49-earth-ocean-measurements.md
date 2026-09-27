# Earth: ocean salinity and sea-level anomalies

Proposal 49 · **Qualification first** · Priority 2 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

The selected Earth ocean views include bathymetry and a temperature anomaly, not these two quantities.

Prepare versioned salinity and sea-surface-height anomalies as separate measured quantities under existing dataset/date controls.

Content owners: [earth](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/earth/README.md)

## Evidence

Aquarius and Jason Photojournal pages identify the source instruments and dated examples. Those rendered images are leads to the original gridded measurements.

## Work

Retrieve documented numeric products with land/coast masks, averaging windows, uncertainty and reference climatology. Select a small matched set of intervals rather than an unbounded time archive.

## Limits and prior decisions

Salinity, sea level and ocean temperature cannot share units or a common quantitative scale. Sea-level anomaly is relative to a stated reference, not ocean depth.

## Acceptance

Native values, units, anomaly reference, coastal masking, temporal coverage and separate color scales.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/first-jason-1-and-ostmjason-2-tandem-global-view/)
- [NASA source page](https://science.nasa.gov/photojournal/nasas-salt-of-the-earth-aquarius-reveals-first-map/)
- [NASA source page](https://science.nasa.gov/photojournal/nasas-aquarius-maps-ocean-salinity-structure/)
- [NASA source page](https://science.nasa.gov/photojournal/jason-3-produces-first-global-map-of-sea-surface-height/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA11859](https://science.nasa.gov/photojournal/first-jason-1-and-ostmjason-2-tandem-global-view/) | candidate | Jason-1/Jason-2 interleaved sea-surface topography has a defined repeat/averaging cycle; recover numeric heights and reference surface. |
| [PIA14786](https://science.nasa.gov/photojournal/nasas-salt-of-the-earth-aquarius-reveals-first-map/) | candidate | First Aquarius salinity map is a real ocean retrieval lead; commissioning/version and averaging interval must be checked before selecting a representative product. |
| [PIA15799](https://science.nasa.gov/photojournal/nasas-aquarius-maps-ocean-salinity-structure/) | candidate | Aquarius tropical salinity structure is a dated regional measurement analysis; native salinity grids and reference conditions are the input, not the plotted wave annotations. |
| [PIA20532](https://science.nasa.gov/photojournal/jason-3-produces-first-global-map-of-sea-surface-height/) | candidate | Jason-3 sea-surface-height anomaly is relative to a reference, not ocean depth; native grid and calibration continuity with Jason-2 are required. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
