# Mercury: qualify regional stereo maps

Proposal 27 · **Regional candidate** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Native global BDR, LOI, enhanced color and numeric elevation are already shipped.

Add only regional stereo height or orthophoto products that demonstrably improve a useful close-up on the current body.

Content owners: [mercury](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/mercury/README.md)

## Evidence

The USGS audit found 192 TIFF files in the Fassett release, including paired DEMs and orthophotos, plus a separate volatile-loss terrain product. PIA17385 identifies a north-polar MLA elevation lead; its datum and value over the selected global DEM need checking.

## Work

Pair DEMs and orthophotos, read frames and vertical datums, and compare the MLA polar grid and local volatile-loss DTM with current elevation. Rank measured footprint and detail gain before preparing a bounded subset.

## Limits and prior decisions

Regional coverage, fixed geometry and no duplicate global basemap rows. Keep output sampling separate from stereo accuracy.

## Acceptance

Independent elevations, overlap residuals, regional boundary masks and matched camera comparisons against the current global maps.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [USGS product record](https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_dtms_fassett_2016)
- [USGS product record](https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_volatile_loss_dtm)
- [NASA source page](https://science.nasa.gov/photojournal/digital-elevation-model-of-mercurys-northern-hemisphere/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA17385](https://science.nasa.gov/photojournal/digital-elevation-model-of-mercurys-northern-hemisphere/) | candidate | Northern Mercury MLA DEM offers independent altimetry relative to the current global stereo DEM; compare numeric support and datum before a regional addition. |

USGS catalogue IDs: `mercury_messenger_mdis_dtms_fassett_2016`, `mercury_messenger_mdis_volatile_loss_dtm`.

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
