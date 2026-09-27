# Enceladus and Titan: published fracture and terrain maps

Proposal 70 · **Regional candidate** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Titan already has a global geological map. Regional boundaries and Enceladus fracture traces need their own original coordinate source.

Qualify source-published Enceladus fracture traces and Titan local geological units through the existing feature or categorical-map contract.

Content owners: [enceladus](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/enceladus/README.md), [titan](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/titan/README.md)

## Evidence

The reviewed entries include Enceladus north/south fracture maps and interpreted Titan terrain near proposed volcanic features.

## Work

Locate original linework or registered categorical files, preserve map scale and unit definitions, and cross-match current named features and Titan geological units.

## Limits and prior decisions

A proposed volcanic interpretation is not a confirmed eruption. Do not digitize press annotations as exact surveyed coordinates or add plume geometry.

## Acceptance

Original coordinate access, frame, line/region topology, scale, legend and distinct value over current maps. Keep separate source decisions per body.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/enceladus-global-patterns-of-fracture-northern-polar-projection/)
- [NASA source page](https://science.nasa.gov/photojournal/enceladus-global-patterns-of-fracture-southern-polar-projection/)
- [NASA source page](https://science.nasa.gov/photojournal/geologic-map-of-titan-volcano/)
- [NASA source page](https://science.nasa.gov/photojournal/global-view-of-sotra-facula-titan/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA07721](https://science.nasa.gov/photojournal/enceladus-global-patterns-of-fracture-northern-polar-projection/) | candidate | Northern Enceladus fracture interpretation is a potential mapped-structure dataset; obtain original traces and their definitions instead of treating annotations as exact vectors. |
| [PIA07722](https://science.nasa.gov/photojournal/enceladus-global-patterns-of-fracture-southern-polar-projection/) | candidate | Southern fracture interpretation complements the northern map and could share one categorical/feature release, with independent polar registration. |
| [PIA07964](https://science.nasa.gov/photojournal/geologic-map-of-titan-volcano/) | candidate | Titan circular-feature geology is an interpreted regional unit map; a volcano interpretation remains conditional and needs original map data, not press labels. |
| [PIA13696](https://science.nasa.gov/photojournal/global-view-of-sotra-facula-titan/) | candidate | Sotra Facula plate combines SAR footprints with VIMS context and a volcanic interpretation; qualify each data source and keep the interpretation conditional. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
