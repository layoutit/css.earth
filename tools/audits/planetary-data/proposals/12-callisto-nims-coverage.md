# Callisto: expand registered infrared coverage

Proposal 12 · **Qualification first** · Priority 1 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Two NIMS products supply the existing infrared view.

Increase measured infrared coverage and assess additional water-ice spectral information through the current surface-data controls.

Content owners: [callisto](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/callisto/README.md)

## Evidence

The USGS release lists 93 TIFF URLs. PIA00844 is a Callisto product despite its supplied Ganymede target tag; PIA01079 shows another NIMS/SSI comparison.

## Work

Identify independent observations, read native units and masks, and compare their measured footprints with the selected products before choosing additions.

## Limits and prior decisions

Separate wavelength images, browse products and processing versions do not each create a dataset. Preserve coarse spectral resolution and observation-time differences.

## Acceptance

Record net new measured area, sample original cube values independently, and inspect seams, orientation and missing areas on the fixed body.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [USGS product record](https://astrogeology.usgs.gov/search/map/callisto-galileo-nims-hyperspectral-map-products-registered-archive)
- [NASA source page](https://science.nasa.gov/photojournal/nims-callisto-global-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/callistos-southern-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/callistos-southern-hemisphere-as-viewed-by-nims-and-ssi/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA00844](https://science.nasa.gov/photojournal/nims-callisto-global-mosaic/) | candidate | Callisto NIMS mosaic from November 1996 samples roughly 100 km spatial scales; supplied Ganymede tag is wrong and must not drive the join. |
| [PIA01078](https://science.nasa.gov/photojournal/callistos-southern-hemisphere/) | candidate | Callisto G8 NIMS southern data are a distinct spectral observation, with false colors indicating relative ice signatures rather than calibrated abundance. |
| [PIA01079](https://science.nasa.gov/photojournal/callistos-southern-hemisphere-as-viewed-by-nims-and-ssi/) | duplicate-family | NIMS/SSI composite combines the same spectral and photographic observations shown separately; assess each instrument at its own spatial support. |

USGS catalogue IDs: `callisto-galileo-nims-hyperspectral-map-products-registered-archive`.

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
