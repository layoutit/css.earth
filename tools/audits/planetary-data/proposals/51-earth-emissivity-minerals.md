# Earth: thermal emissivity and mapped surface minerals

Proposal 51 · **Qualification first** · Priority 2 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Earth's photographic basemap does not measure infrared emission efficiency or EMIT mineral signatures.

Add separate ASTER emissivity and EMIT mineral data groups if their native coverage and quality masks support useful prepared views.

Content owners: [earth](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/earth/README.md)

## Evidence

ASTER provides an emissivity lead; EMIT's map concerns arid regions and named mineral signatures, not an everywhere-complete global composition map.

## Work

Acquire versioned bands and numeric mineral products, preserve wavelength, quality and footprint, and explain unfamiliar mineral names in ordinary language.

## Limits and prior decisions

Emissivity is not temperature. Mineral presence, spectral fit and abundance are different products. Do not treat unsurveyed areas as zero or use the press RGB mixture as numeric concentrations.

## Acceptance

Band units and scaling, independent samples, land/validity masks, declared effective resolution and a measured-coverage report for each product family.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/nasa-spacecraft-maps-earths-global-emissivity/)
- [NASA source page](https://science.nasa.gov/photojournal/nasas-emit-collects-mineral-maps-spectral-fingerprints-from-nevada/)
- [NASA source page](https://science.nasa.gov/photojournal/nasas-emit-mission-produces-maps-of-arid-region-surface-minerals/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA18833](https://science.nasa.gov/photojournal/nasa-spacecraft-maps-earths-global-emissivity/) | candidate | ASTER emissivity is a measured/model-retrieved radiation-efficiency quantity distinct from temperature; use original bands, quality and units. |
| [PIA25428](https://science.nasa.gov/photojournal/nasas-emit-collects-mineral-maps-spectral-fingerprints-from-nevada/) | candidate | EMIT Nevada spectra are compared with 2018 AVIRIS for validation; preserve different instrument epochs and retrieve original mineral/reflectance products. |
| [PIA26116](https://science.nasa.gov/photojournal/nasas-emit-mission-produces-maps-of-arid-region-surface-minerals/) | candidate | EMIT arid-region mineral map is incomplete by design and distinguishes mineral signatures; retain valid surveyed footprint and numeric products, not RGB abundance inference. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
