# Venus: qualify regional Magellan radar detail

Proposal 61 · **Regional candidate** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Venus already has global radar, height, emissivity, reflectivity and roughness products.

Use finer native radar mosaics only where they improve useful regional detail at the existing asset budget.

Content owners: [venus](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/venus/README.md)

## Evidence

PIA00086 identifies a Lavinia Planitia F-MIDR region; PIA00461 supplies a separate Bahet/Onatah lead.

## Work

Locate original F-MIDR products, preserve radar geometry and calibration, and run a matched comparison against the selected global radar map.

## Limits and prior decisions

Radar brightness is not optical color. Pixel sampling is not terrain resolution, and a small regional patch does not solve poor global coverage.

## Acceptance

Native footprint and calibration, look-direction differences, source/prepared comparison and improvement per byte.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/mosaic-of-large-impact-craters/)
- [NASA source page](https://science.nasa.gov/photojournal/venus-mosaic-of-bahet-and-onatah-coronae/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA00086](https://science.nasa.gov/photojournal/mosaic-of-large-impact-craters/) | candidate | Magellan F-MIDR resolves a roughly 500 km Lavinia region; compare original radar pixels with current global preparation before adding regional detail. |
| [PIA00461](https://science.nasa.gov/photojournal/venus-mosaic-of-bahet-and-onatah-coronae/) | candidate | Bahet/Onatah Magellan mosaic is a regional 120 m radar lead; compare original F-MIDR coverage and sampling with current Venus assets. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
