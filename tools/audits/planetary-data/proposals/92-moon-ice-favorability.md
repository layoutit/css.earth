# Moon: qualify the published polar ice-favorability model

Proposal 92 · **Qualification first** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Existing lunar thermal, rock and illumination inputs do not themselves establish this combined favorability score.

Determine whether the published north/south polar index adds an understandable, reproducible model interpretation through an existing data view.

Content owners: [moon](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/moon/README.md)

## Evidence

The USGS catalogue exposes separate polar index products. This is a model lead, not a direct ice detection or water-abundance observation.

## Work

Read the index definition, input epochs, weighting and missing-data treatment; retrieve native values and compare with selected underlying measurements.

## Limits and prior decisions

Label the quantity as modeled favorability. Do not equate a high score with confirmed ice, probability of ice unless the model defines that, or current exploration guidance.

## Acceptance

Published formula, native value range, polar registration, uncertainty/limitations and incremental educational value beyond the measured inputs.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [USGS product record](https://astrogeology.usgs.gov/search/map/moon_ice_favorability_index_north_pole_591mp)
- [USGS product record](https://astrogeology.usgs.gov/search/map/moon_ice_favorability_index_south_pole_591mp)

USGS catalogue IDs: `moon_ice_favorability_index_north_pole_591mp`, `moon_ice_favorability_index_south_pole_591mp`.

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
