# Moon and Mercury: observed polar illumination

Proposal 47 · **Regional candidate** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Current temperature and elevation views do not themselves show an observed illumination-frequency survey.

Prepare published polar illumination fractions with explicit observation windows and polar footprints.

Content owners: [moon](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/moon/README.md), [mercury](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/mercury/README.md)

## Evidence

The lunar page describes a six-month WAC stack over 88°S–90°S. The Mercury page is a separate polar-illumination source lead and needs its own method check.

## Work

Locate original fractional rasters, observation counts and coverage, keeping observed time sampling separate from a long-term lighting simulation.

## Limits and prior decisions

Six months of images do not prove permanent darkness or annual sunlight percentage. This is a prepared data view, not changes to runtime sunlight or shadows.

## Acceptance

Native fractions and denominator, exact time window, polar projection, missing cells and independent source-map comparison.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/south-pole-illumination-map/)
- [NASA source page](https://science.nasa.gov/photojournal/illumination-map-of-mercurys-south-pole/)
- [NASA source page](https://science.nasa.gov/photojournal/orbital-mosaic-of-mercurys-north-pole/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA13720](https://science.nasa.gov/photojournal/south-pole-illumination-map/) | candidate | Lunar 88–90°S illumination stack is a finite observation-window fraction; preserve denominator and interval rather than assert eternal sunlight/shadow. |
| [PIA15527](https://science.nasa.gov/photojournal/illumination-map-of-mercurys-south-pole/) | candidate | Mercury south-polar illumination derives from 89 WAC images; preserve their time sampling and test shadow classification against native records. |
| [PIA16950](https://science.nasa.gov/photojournal/orbital-mosaic-of-mercurys-north-pole/) | candidate | Mercury polar imaging could support illumination-source validation; a multi-image north-pole mosaic is not itself a measured sunlight-frequency raster. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
