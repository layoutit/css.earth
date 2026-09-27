# Earth: coastal water measurements and their interpretation

Proposal 78 · **Regional candidate** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

The existing Earth layers do not establish the Belize protected-area measurements behind this study.

Qualify measured turbidity and water-temperature inputs, with any published protected-area risk score clearly retained as a separate model interpretation.

Content owners: [earth](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/earth/README.md)

## Evidence

PIA25862 describes a MODIS-based study involving 24 protected areas and a published risk ranking.

## Work

Obtain original measured fields, time windows, area boundaries and the ranking method. Preserve the distinction between direct observations and aggregated conclusions.

## Limits and prior decisions

The historical ranking is not a current forecast or direct satellite measurement. Do not color whole regions from a press diagram without its underlying data.

## Acceptance

Boundary joins, native units, temporal aggregation, uncertainty and reproducibility of any retained ranking.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/map-shows-belizean-protected-areas-assessed-for-risk/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA25862](https://science.nasa.gov/photojournal/map-shows-belizean-protected-areas-assessed-for-risk/) | candidate | Belize protected-area risk ranks combine MODIS turbidity/temperature evidence and a model; recover underlying observations, boundaries and scoring assumptions, not a current risk forecast. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
