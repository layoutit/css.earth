# Beid

## Sources

Its brightness, measured band by band, gives 26 times the Sun's luminosity at 7,019 K, so 3.422 solar radii. It is also HD 26574, HR 1298, HIP 19587. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3196359642878570368, distance 37 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 19587: distance 37.313 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.012), at which the luminosity and radius hold; Gaia DR3's parallax, 26.110 ± 0.178 mas (146.9 standard errors), is not used. Radius 3.422 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 19587: radius 3.422 solar radii, implied by the fitted luminosity 25.536 solar luminosities (fractional uncertainty 0.036) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 7,019 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 19587: effective temperature 7019 +/- 133 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.03). No surface gravity of this star is published.

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 263: HR 1298; VizieR III/202, cross-checked against Gaia DR3 XP spectrum, source 3196359642878570368 (0 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #d9e1ff. Routes tried in order: stis-ngsl: HD 26574 is not in the library; pulkovo: HR 1298 is not in the catalogue; kiehling: HR 1298 is not among its 60 stars; burnashev: BS 1298 is not in part2; kharitonov: used.

**Limb.** No limb darkening is drawn: no mass is measured and no spectroscopic surface gravity is published with this radius: McDonald, Zijlstra & Watson (2017), MNRAS 471, 770 assume the gravity of their fit (table column 15).

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 0 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Omicron1 Eridani" (revision 1374594708) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
