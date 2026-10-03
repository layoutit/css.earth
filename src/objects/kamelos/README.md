# Kamelos

## Sources

Its brightness, measured band by band, gives 416 times the Sun's luminosity at 4,058 K, so 41.323 solar radii. It is also HD 45866, HR 2363, HIP 31940. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1140693565213532416, distance 214 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 31940: distance 214.133 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.064), at which the luminosity and radius hold; Gaia DR3's parallax, 4.495 ± 0.046 mas (98.8 standard errors), is not used. Radius 41.323 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 31940: radius 41.323 solar radii, implied by the fitted luminosity 416.02 solar luminosities (fractional uncertainty 0.089) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,058 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 31940: effective temperature 4058 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.045). No surface gravity of this star is published.

**Color.** Gaia DR3 XP spectrum, source 1140693565213532416, cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 435: HR 2363; VizieR III/202 (2 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffcb92. Routes tried in order: stis-ngsl: HD 45866 is not in the library; pulkovo: HR 2363 is not in the catalogue; kiehling: HR 2363 is not among its 60 stars; burnashev: BS 2363 is not in part2; gaia-xp: used.

**Limb.** No limb darkening is drawn: no mass is measured and no spectroscopic surface gravity is published with this radius: McDonald, Zijlstra & Watson (2017), MNRAS 471, 770 assume the gravity of their fit (table column 15).

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 2 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HD 45866" (revision 1374551272) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
