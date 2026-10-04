# Nekkar

## Sources

Its brightness, measured band by band, gives 199 times the Sun's luminosity at 5,018 K, so 18.673 solar radii. It is also HD 133208, HR 5602, HIP 73555. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1296713990316692096, distance 69 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 73555: distance 69.061 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.01), at which the luminosity and radius hold; Gaia DR3's parallax, 13.878 ± 0.131 mas (105.9 standard errors), is not used. Radius 18.673 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 73555: radius 18.673 solar radii, implied by the fitted luminosity 198.63 solar luminosities (fractional uncertainty 0.051) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 5,018 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 73555: effective temperature 5018 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.077). No surface gravity of this star is published.

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 709: HR 5602; VizieR III/202, cross-checked against Gaia DR3 XP spectrum, source 1296713990316692096 (45 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffeacc. Routes tried in order: stis-ngsl: HD 133208 is not in the library; pulkovo: HR 5602 is not in the catalogue; kiehling: HR 5602 is not among its 60 stars; burnashev: BS 5602 is not in part2; kharitonov: used.

**Limb.** No limb darkening is drawn: no mass is measured and no spectroscopic surface gravity is published with this radius: McDonald, Zijlstra & Watson (2017), MNRAS 471, 770 assume the gravity of their fit (table column 15).

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 45 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Beta Boötis" (revision 1377037300) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
