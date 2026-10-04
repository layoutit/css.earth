# Udkadua

## Sources

Its brightness, measured band by band, gives 24 times the Sun's luminosity at 4,667 K, so 7.552 solar radii. It is also HD 222107, HR 8961, HIP 116584. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1939115478598580352, distance 26 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 116584: distance 26.406 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.006), at which the luminosity and radius hold; Gaia DR3's parallax, 38.574 ± 0.118 mas (327.1 standard errors), is not used. Radius 7.552 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 116584: radius 7.552 solar radii, implied by the fitted luminosity 24.306 solar luminosities (fractional uncertainty 0.054) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,667 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 116584: effective temperature 4667 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.037). No surface gravity of this star is published.

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 1125: HR 8961; VizieR III/202, cross-checked against Burnashev (1985), Abastumani Astrophys. Obs. Bull. 59, 83; VizieR III/126, part2 record 520 (BS 8961) (1 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffddbb. Routes tried in order: stis-ngsl: HD 222107 is not in the library; pulkovo: HR 8961 is not in the catalogue; kiehling: HR 8961 is not among its 60 stars; gaia-xp: found, not needed after the color and its cross-check; kharitonov: used.

**Limb.** No limb darkening is drawn: no mass is measured and no spectroscopic surface gravity is published with this radius: McDonald, Zijlstra & Watson (2017), MNRAS 471, 770 assume the gravity of their fit (table column 15).

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 1 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Lambda Andromedae" (revision 1374783321) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
