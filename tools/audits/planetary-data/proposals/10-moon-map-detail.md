# Moon: improve existing photography and height sampling

Proposal 10 · **Qualification first** · Priority 2 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

The current Moon uses coarser LROC morphology and LOLA inputs; its surface geometry stays fixed.

Replace an existing prepared map only where finer input produces visible or numerical improvement at the existing display budget.

Content owners: [moon](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/moon/README.md)

## Evidence

The audit verified the 59 m merged DEM within ±60°, 118 m LOLA and 100 m WAC alternatives. PIA18138 supplies a separate north-pole imaging lead, not proof that the whole Moon has that detail.

## Work

Run a matched preparation at the present asset dimensions, then compare a bounded larger texture level if the existing contract supports it. Record improvement per delivered byte.

## Limits and prior decisions

No terrain displacement, mesh refinement or extra duplicate dataset row. Preserve regional coverage and the difference between source sampling and actual resolution.

## Acceptance

Matched close-up samples, poles, numeric heights, seams, source values and delivered byte counts; reject a replacement that gives no useful gain.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [USGS product record](https://astrogeology.usgs.gov/search/map/moon_lro_lola_selene_kaguya_tc_dem_merge_60n60s_59m)
- [USGS product record](https://astrogeology.usgs.gov/search/map/moon_lro_lola_dem_118m)
- [USGS product record](https://astrogeology.usgs.gov/search/map/moon_lro_lroc_wac_global_morphology_mosaic_100m)
- [NASA source page](https://science.nasa.gov/photojournal/nasa-releases-first-interactive-mosaic-of-lunar-north-pole/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA18138](https://science.nasa.gov/photojournal/nasa-releases-first-interactive-mosaic-of-lunar-north-pole/) | candidate | LROC north-pole 2 m imagery offers concrete regional detail; useful gain must be measured at current texture budgets and fixed geometry. |

USGS catalogue IDs: `moon_lro_lola_selene_kaguya_tc_dem_merge_60n60s_59m`, `moon_lro_lola_dem_118m`, `moon_lro_lroc_wac_global_morphology_mosaic_100m`.

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
