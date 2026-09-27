# Mercury: magnesium and other elemental measurements

Proposal 30 · **Qualification first** · Priority 1 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Current Mercury adds MDIS imaging, numeric height and a MASCS spectrum; XRS/GRS surface chemistry is distinct from those.

Add qualified elemental ratios and neutron-absorption data from MESSENGER as one related measurement group.

Content owners: [mercury](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/mercury/README.md)

## Evidence

PIA19242 shows Mg/Si and thermal-neutron absorption derived from XRS and GRS. It is an explanatory two-panel image, not the native numeric release.

## Work

Locate the underlying published grids and uncertainties through the source references, establish the effective footprint and longitude convention, then prepare numeric fields offline.

## Limits and prior decisions

Do not decode quantitative values from the press color palette or call a neutron-absorption signal a specific mineral abundance. Native release access and coverage are not yet verified.

## Acceptance

Check native units, scale, mask, uncertainty and published sample values. Release only if useful coverage and original numeric data are established.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/surface-chemistry-maps/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA19242](https://science.nasa.gov/photojournal/surface-chemistry-maps/) | candidate | Mercury Mg/Si and neutron-absorption maps introduce distinct XRS/GRS chemistry leads; original grids and uncertainty remain to be acquired. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
