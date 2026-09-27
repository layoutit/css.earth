# Moon: GRAIL gravity anomalies

Proposal 46 · **Qualification first** · Priority 2 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

The Moon already has crustal thickness and topography; a gravitational anomaly is a distinct modeled quantity.

Add a qualified GRAIL Bouguer anomaly map and retain local Orientale/dike illustrations as supporting leads only.

Content owners: [moon](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/moon/README.md)

## Evidence

PIA16623 describes gravity after removal of topographic attraction. The supplied movie is not the original coefficient or grid release.

## Work

Obtain published coefficients or numeric grids and model assumptions, evaluate them offline if needed, and record degree, density and reference-radius choices.

## Limits and prior decisions

An anomaly does not uniquely identify a buried rock type or cavity. Keep the existing crustal-thickness product distinct and the mesh unchanged.

## Acceptance

Independent published check values, model truncation, units, orientation and uncertainty; avoid interpreting grid spacing as resolving power.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/moon-dike-map/)
- [NASA source page](https://science.nasa.gov/photojournal/grails-bouguer-gravity-moon-map/)
- [NASA source page](https://science.nasa.gov/photojournal/grail-gravity-map-of-orientale-basin/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA16584](https://science.nasa.gov/photojournal/moon-dike-map/) | candidate | GRAIL-inferred lunar dike locations are a model interpretation, potentially feature content after recovery of the published catalogue and uncertainty. |
| [PIA16623](https://science.nasa.gov/photojournal/grails-bouguer-gravity-moon-map/) | candidate | Lunar Bouguer gravity is distinct from crustal thickness and height; original grid/coefficients and reference-density assumptions are required. |
| [PIA21050](https://science.nasa.gov/photojournal/grail-gravity-map-of-orientale-basin/) | candidate | GRAIL Orientale regional surface gravity is distinct from Bouguer anomaly; original field definition, degree and units must remain separate. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
