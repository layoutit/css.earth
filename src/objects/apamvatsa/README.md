# Apamvatsa

## Sources

Its brightness, measured band by band, gives 686 times the Sun's luminosity at 3,725 K, so 62.982 solar radii. It is also HD 117675, HR 5095, HIP 66006. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3631753877970312576, distance 123 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 66006: distance 122.549 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.023), at which the luminosity and radius hold; Gaia DR3's parallax, 6.950 ± 0.202 mas (34.4 standard errors), is not used. Radius 62.982 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 66006: radius 62.982 solar radii, implied by the fitted luminosity 686.173 solar luminosities (fractional uncertainty 0.071) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 3,725 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 66006: effective temperature 3725 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.143). No surface gravity of this star is published.

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 657: HR 5095; VizieR III/202, cross-checked against Gaia DR3 XP spectrum, source 3631753877970312576 (8 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffcf8b. Routes tried in order: stis-ngsl: HD 117675 is not in the library; pulkovo: HR 5095 is not in the catalogue; kiehling: HR 5095 is not among its 60 stars; burnashev: BS 5095 is not in part2; kharitonov: used.

**Limb.** No limb darkening is drawn: no mass is measured and no spectroscopic surface gravity is published with this radius: McDonald, Zijlstra & Watson (2017), MNRAS 471, 770 assume the gravity of their fit (table column 15).

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 8 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
