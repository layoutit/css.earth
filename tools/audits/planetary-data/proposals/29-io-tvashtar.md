# Io: resolve the limits of the Tvashtar stereo product

Proposal 29 · **Blocked by existing evidence** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

The existing Io package does not have a qualified global height field from this source.

Determine whether the regional product supports any defensible relative-height display, and record the result in Io's investigation ledger.

Content owners: [io](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/io/README.md)

## Evidence

The source explicitly calls the DEM uncontrolled, with an arbitrary elevation zero and possible long-baseline tilt.

## Work

Inspect the stereo solution, vertical reference and external control. Quantify residual tilt and local uncertainty before preparing any relative-height view.

## Limits and prior decisions

No absolute elevation, no global elevation layer and no geometry changes. Without new independent control this remains excluded from delivery.

## Acceptance

A reproducible control comparison and an explicit acceptance or rejection; visual plausibility is not sufficient.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [USGS product record](https://astrogeology.usgs.gov/search/map/io_galileo_ssi_tvashtar_paterae_dem_and_orthoimages_900m)

USGS catalogue IDs: `io_galileo_ssi_tvashtar_paterae_dem_and_orthoimages_900m`.

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
