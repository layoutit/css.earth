# Moon: Clementine spectral bands and calibration comparison

Proposal 91 · **Qualification first** · Priority 2 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

The Moon already has derived mineral signatures and Kaguya products. A Clementine measured-band set is a distinct instrument source, but its calibration variants are not independent observations.

Qualify a compact Clementine UVVIS/NIR band group if it adds useful wavelength or historical coverage beyond the selected products.

Content owners: [moon](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/moon/README.md)

## Evidence

The USGS audit identifies five-band warped UVVIS and two NIR calibration releases. Their native scale and cross-instrument consistency need qualification.

## Work

Compare the two NIR calibration methods, preserve per-band validity and wavelength, and check the warped grid against Kaguya on common footprints.

## Limits and prior decisions

No mineral abundance inferred from a ratio press image, duplicated standard/empirical rows or assumption that all bands are quantitatively comparable.

## Acceptance

Native scaling and masks, published calibration limits, wavelength order, numeric samples and measured benefit over existing datasets.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [USGS product record](https://astrogeology.usgs.gov/search/map/moon_clementine_uvvis_global_mosaic_118m)
- [USGS product record](https://astrogeology.usgs.gov/search/map/moon_clementine_uvvis_5_band_warped_image_mosaic_200m)
- [USGS product record](https://astrogeology.usgs.gov/search/map/moon_clementine_nir_empirical_calibration_500m)
- [USGS product record](https://astrogeology.usgs.gov/search/map/moon_clementine_nir_standard_calibration_500m)

USGS catalogue IDs: `moon_clementine_uvvis_global_mosaic_118m`, `moon_clementine_uvvis_5_band_warped_image_mosaic_200m`, `moon_clementine_nir_empirical_calibration_500m`, `moon_clementine_nir_standard_calibration_500m`.

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
