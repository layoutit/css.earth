# Enceladus: published geyser source locations

Proposal 38 · **Qualification first** · Priority 2 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Existing named features do not establish this research catalogue. Enceladus VIMS imagery is already being worked on elsewhere.

Add the published jet-source catalogue through the existing feature contract, retaining uncertainty and research identifiers.

Content owners: [enceladus](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/enceladus/README.md)

## Evidence

The source page describes 100 plotted geyser sources, circles showing position uncertainty, and additional qualifications for poorly constrained tilts or single-image detections. It points to the 2014 papers.

## Work

Acquire the original coordinate table, resolve source counts/definitions and projection, and compare with existing IAU features. Record uncertainty even if the current feature UI cannot draw error circles.

## Limits and prior decisions

Locations are not a current activity forecast, animated plume or IAU naming catalogue. No new feature panel or invented jet geometry.

## Acceptance

Match published IDs and coordinates, verify south-polar registration and account for ambiguous detections without merging them silently.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/surveyors-map-of-enceladus-geyser-basin/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA17188](https://science.nasa.gov/photojournal/surveyors-map-of-enceladus-geyser-basin/) | candidate | Enceladus source-location survey provides 100 plotted geysers with position/tilt qualifications; original coordinate table can feed existing research-feature content. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
