# Moon: nine Kaguya reflected-light bands

Proposal 09 · **Integration candidate** · Priority 1 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Kaguya mineral, grain-size, iron and maturity products are already selected. The nine measured MI spectral bands are the remaining distinct addition.

Add a single reflected-light group with nine wavelength choices and JAXA / Kaguya MI attribution.

Content owners: [moon](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/moon/README.md)

## Evidence

The USGS audit inspected nine 16-bit spectral products. Their coverage is approximately 65°S to 65°N, wider than the derived mineral maps but not polar coverage.

## Work

Read the native scale and invalid-value rules, reduce the bands together on the same grid, and preserve their common validity mask. Keep these measured bands separate from fitted mineral products.

## Limits and prior decisions

Nine bands are nine wavelength samples, not nine minerals. Verify photometric treatment and JAXA reuse terms. Do not repeat the already shipped derived maps.

## Acceptance

Independent source-to-prepared values, common footprint, wavelength order, band switching and byte budget.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [USGS product record](https://astrogeology.usgs.gov/search/map/kaguya_lunar_multiband_imager_59mpp)
- [USGS product record](https://astrogeology.usgs.gov/search/map/lunar-kaguya-multiband-imager-mosaics)

USGS catalogue IDs: `lunar-kaguya-multiband-imager-mosaics`, `kaguya_lunar_multiband_imager_59mpp`.

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
