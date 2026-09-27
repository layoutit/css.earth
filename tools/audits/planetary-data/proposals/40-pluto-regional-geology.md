# Pluto: geological units around Sputnik Planitia

Proposal 40 · **Regional candidate** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Pluto already has imagery, height and three fitted ice fractions; geological terrain units are a different interpreted dataset.

Prepare the published regional geological mapping with a categorical legend and an honest footprint.

Content owners: [pluto](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/pluto/README.md)

## Evidence

The two supplied pages are versions of the same geological map and legend, covering Sputnik Planitia and surrounding terrain rather than the full globe.

## Work

Locate original polygons or a registered categorical release, preserve unit codes and source-map scale, and use the current categorical preparation lane.

## Limits and prior decisions

Do not create two datasets from the map and its legend. Units describe mapped morphology; they are not measured ages or direct ice fractions.

## Acceptance

Native boundary checks, source frame, categorical resampling, legend parity and missing-area visibility.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/putting-plutos-geology-on-the-map/)
- [NASA source page](https://science.nasa.gov/photojournal/putting-plutos-geology-on-the-map-2/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA20465](https://science.nasa.gov/photojournal/putting-plutos-geology-on-the-map/) | candidate | Pluto Sputnik-region geological units are interpreted morphology on a regional map; obtain original categorical boundaries and legend. |
| [PIA20466](https://science.nasa.gov/photojournal/putting-plutos-geology-on-the-map-2/) | duplicate-family | Companion Pluto geology page explains the same map's legend; one underlying dataset, with both source references retained. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
