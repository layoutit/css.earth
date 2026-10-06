# Gudja

## Sources

Its brightness, measured band by band, gives 868 times the Sun's luminosity at 3,803 K, so 67.945 solar radii. It is also HD 141477, HR 5879, HIP 77450. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1197588859547184640, distance 117 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 77450: distance 117.096 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.027), at which the luminosity and radius hold; Gaia DR3's parallax, 8.523 ± 0.166 mas (51.4 standard errors), is not used. Radius 67.945 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 77450: radius 67.945 solar radii, implied by the fitted luminosity 867.579 solar luminosities (fractional uncertainty 0.071) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 3,803 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 77450: effective temperature 3803 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.084). No surface gravity of this star is published.

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 729: HR 5879; VizieR III/202, cross-checked against Gaia DR3 XP spectrum, source 1197588859547184640 (12 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffc984. Routes tried in order: stis-ngsl: HD 141477 is not in the library; pulkovo: HR 5879 is not in the catalogue; kiehling: HR 5879 is not among its 60 stars; burnashev: BS 5879 is not in part2; kharitonov: used.

**Limb.** No limb darkening is drawn: no mass is measured and no spectroscopic surface gravity is published with this radius: McDonald, Zijlstra & Watson (2017), MNRAS 471, 770 assume the gravity of their fit (table column 15).

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 12 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Kappa Serpentis" (revision 1370780950) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
