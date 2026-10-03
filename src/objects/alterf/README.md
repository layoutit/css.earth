# Alterf

## Sources

Its brightness, measured band by band, gives 454 times the Sun's luminosity at 3,917 K, so 46.34 solar radii. It is also HD 82308, HR 3773, HIP 46750. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 644306911864817152, distance 101 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 46750: distance 100.908 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.018), at which the luminosity and radius hold; Gaia DR3's parallax, 8.755 ± 0.189 mas (46.3 standard errors), is not used. Radius 46.34 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 46750: radius 46.34 solar radii, implied by the fitted luminosity 454.175 solar luminosities (fractional uncertainty 0.066) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 3,917 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 46750: effective temperature 3917 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.113). No surface gravity of this star is published.

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 542: HR 3773; VizieR III/202, cross-checked against Gaia DR3 XP spectrum, source 644306911864817152 (8 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffc889. Routes tried in order: stis-ngsl: HD 82308 is not in the library; pulkovo: HR 3773 is not in the catalogue; kiehling: HR 3773 is not among its 60 stars; burnashev: BS 3773 is not in part2; kharitonov: used.

**Limb.** No limb darkening is drawn: no mass is measured and no spectroscopic surface gravity is published with this radius: McDonald, Zijlstra & Watson (2017), MNRAS 471, 770 assume the gravity of their fit (table column 15).

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 8 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Lambda Leonis" (revision 1377348892) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
