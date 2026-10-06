# Enduri Senggu

## Sources

Its brightness, measured band by band, gives 11 times the Sun's luminosity at 6,214 K, so 2.821 solar radii. It is also HD 202444, HR 8130, HIP 104887. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1964791583368233088, distance 20 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 104887: distance 20.342 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.008), at which the luminosity and radius hold; Gaia DR3 gives it no parallax. Radius 2.821 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 104887: radius 2.821 solar radii, implied by the fitted luminosity 10.659 solar luminosities (fractional uncertainty 0.092) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 6,214 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 104887: effective temperature 6214 +/- 286 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.256). No surface gravity of this star is published.

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 984: HR 8130; VizieR III/202, cross-checked against Gaia DR3 XP spectrum, source 1964791583368233088 (22 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #edecff. Routes tried in order: stis-ngsl: HD 202444 is not in the library; pulkovo: HR 8130 is not in the catalogue; kiehling: HR 8130 is not among its 60 stars; burnashev: BS 8130 is not in part2; kharitonov: used.

**Limb.** No limb darkening is drawn: no mass is measured and no spectroscopic surface gravity is published with this radius: McDonald, Zijlstra & Watson (2017), MNRAS 471, 770 assume the gravity of their fit (table column 15).

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 22 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
