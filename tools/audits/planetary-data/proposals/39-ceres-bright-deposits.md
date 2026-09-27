# Ceres: catalogue of bright deposits

Proposal 39 · **Qualification first** · Priority 2 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Ceres has named features and composition maps; the more-than-300 bright-area classification has not been joined to those features.

Add source-backed deposit locations and their geological setting through existing feature content.

Content owners: [ceres](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/ceres/README.md)

## Evidence

The NASA page groups bright areas by crater floor, rim/wall, ejecta and Ahuna Mons setting.

## Work

Retrieve the research table behind the plot, match coordinates and IDs, and preserve category definitions and survey completeness.

## Limits and prior decisions

Do not infer chemical composition from brightness alone or digitize plotted dots as exact coordinates. Avoid duplicating existing named faculae.

## Acceptance

Row count, deduplication, coordinate frame, cross-match to named features and uncertainty. Release only with a reusable source catalogue.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/map-of-ceres-bright-spots/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA21914](https://science.nasa.gov/photojournal/map-of-ceres-bright-spots/) | candidate | More than 300 Ceres bright areas classified by geological setting could add feature content if original coordinates/catalogue can be recovered. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
