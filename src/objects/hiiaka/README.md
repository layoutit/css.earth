# Hiʻiaka

Hiʻiaka is Haumea’s largest moon.

## Sources

[Investigation ledger](investigations.json): recorded source decisions, evidence and conditions for revisiting them.

Published occultation/photometric model with semiaxes 240±40, 180±30 and 143±7 km. The axes are inferred together under homogeneous surface brightness. Display orientation is illustrative. The grid marks unmapped terrain.

- [Hiʻiaka stellar occultations and shape](https://www.nature.com/articles/s41467-025-65749-1)
- [Hiʻiaka paper Source Data workbook](https://media.springernature.com/original/springer-static/esm/art%3A10.1038%2Fs41467-025-65749-1/MediaObjects/41467_2025_65749_MOESM3_ESM.xlsx)
- [Non-Keplerian Haumea satellite orbits](https://doi.org/10.3847/PSJ/ad26e9)

## Evidence

Hiʻiaka uses the retained JPL#110 system solution, not the newer 2024 interacting orbit. Its older 2005–2008 observations support limited phase accuracy; the source reports 900 km uncertainty at 2025-Jan-01, not an uncertainty bound at the 2026 scene epoch. Exact target/center IDs, time conversion, vectors, parent GM and independent heliocentric composition checks are in [epoch record](source/validation/epoch-state.json). Runtime extrapolation is not enabled.

[Source test definitions](../../../tests/objects/unit/hiiaka/source.test.mts).

## Known problems

The nominal inferred axes have correlated uncertainties; independent extremes do not form a fitted confidence region. Display orientation remains illustrative because the Haumea-aligned pole has not been correctly transformed; aspect angle is not inertial declination.

The source workbook has a 2023-04-16 label despite event/year fields saying 2021; that label is not used as the epoch. The article’s CC BY-NC-ND 4.0 terms do not permit assuming that adapted graphics are freely redistributable; this package uses numerical facts and an authored ellipsoid.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<a id="hiʻiaka-source-model"></a>
<a id="selected-geometry"></a>
<a id="assumptions"></a>
<a id="source-interpretation-limits"></a>
<a id="orbit-and-orientation"></a>
<a id="survey-and-sources"></a>
<a id="selected-fixed-epoch-position"></a>

<details>
<summary>Methods and source notes</summary>

**Selected geometry**

Directly adopt published inferred semiaxes; do not renormalize to 370 km volume-equivalent diameter.

**Orbit and orientation**

The [validation records](source/validation) identify the parent-relative state and any fit interval. The display uses meridian zero.

**Survey and sources**

Source decisions and the historical review they came from are recorded in the [investigation ledger](investigations.json).

</details>
