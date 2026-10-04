# Lilii Borea

## Sources

Its brightness, measured band by band, gives 47 times the Sun's luminosity at 4,724 K, so 10.224 solar radii. It is also HD 17361, HR 824, HIP 13061. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 128855517166594048, distance 53 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 13061: distance 52.604 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.011), at which the luminosity and radius hold; Gaia DR3's parallax, 19.039 ± 0.126 mas (150.9 standard errors), is not used. Radius 10.224 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 13061: radius 10.224 solar radii, implied by the fitted luminosity 46.769 solar luminosities (fractional uncertainty 0.054) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,724 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 13061: effective temperature 4724 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.08). No surface gravity of this star is published.

**Color.** HST/STIS Next Generation Spectral Library v2 (Heap & Lindler; MAST high-level science product), HD 17361: 168-1020 nm, cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 140: HR 824; VizieR III/202 (5 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffe0b9. Routes tried in order: gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: HR 824 is not in the catalogue; kiehling: HR 824 is not among its 60 stars; burnashev: BS 824 is not in part2; stis-ngsl: used.

**Limb.** No limb darkening is drawn: no mass is measured and no spectroscopic surface gravity is published with this radius: McDonald, Zijlstra & Watson (2017), MNRAS 471, 770 assume the gravity of their fit (table column 15).

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 5 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "39 Arietis" (revision 1334126839) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
