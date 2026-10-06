# Acubens

## Sources

Its brightness, measured band by band, gives 49 times the Sun's luminosity at 7,999 K, so 3.655 solar radii. It is also HD 76756, HR 3572, HIP 44066. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 604789257076233728, distance 58 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 44066: distance 57.737 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.056), at which the luminosity and radius hold; Gaia DR3's parallax, 18.330 ± 0.322 mas (57.0 standard errors), is not used. Radius 3.655 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 44066: radius 3.655 solar radii, implied by the fitted luminosity 49.134 solar luminosities (fractional uncertainty 0.079) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 7,999 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 44066: effective temperature 7999 +/- 243 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.047). No surface gravity of this star is published.

**Color.** Gaia DR3 XP spectrum, source 604789257076233728, cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 528: HR 3572; VizieR III/202 (6 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #c0d2ff. Routes tried in order: stis-ngsl: HD 76756 is not in the library; pulkovo: HR 3572 is not in the catalogue; kiehling: HR 3572 is not among its 60 stars; burnashev: BS 3572 is not in part2; gaia-xp: used.

**Limb.** No limb darkening is drawn: no mass is measured and no spectroscopic surface gravity is published with this radius: McDonald, Zijlstra & Watson (2017), MNRAS 471, 770 assume the gravity of their fit (table column 15).

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 6 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Alpha Cancri" (revision 1370772899) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
