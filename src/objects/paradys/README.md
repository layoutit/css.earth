# Paradys

## Sources

Its brightness, measured band by band, gives 869 times the Sun's luminosity at 4,202 K, so 55.698 solar radii. It is also HD 129078, HR 5470, HIP 72370. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5773473920382493440, distance 137 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 72370: distance 136.986 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.018), at which the luminosity and radius hold; Gaia DR3's parallax, 6.551 ± 0.113 mas (57.8 standard errors), is not used. Radius 55.698 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 72370: radius 55.698 solar radii, implied by the fitted luminosity 868.958 solar luminosities (fractional uncertainty 0.062) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,202 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 72370: effective temperature 4202 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.043). No surface gravity of this star is published.

**Color.** Burnashev (1985), Abastumani Astrophys. Obs. Bull. 59, 83; VizieR III/126, part2 record 192 (BS 5470), cross-checked against Gaia DR3 XP spectrum, source 5773473920382493440 (21 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffd297. Routes tried in order: stis-ngsl: HD 129078 is not in the library; pulkovo: HR 5470 is not in the catalogue; kiehling: HR 5470 is not among its 60 stars; kharitonov: HR 5470 is not in the catalogue; burnashev: used.

**Limb.** No limb darkening is drawn: no mass is measured and no spectroscopic surface gravity is published with this radius: McDonald, Zijlstra & Watson (2017), MNRAS 471, 770 assume the gravity of their fit (table column 15).

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 21 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Alpha Apodis" (revision 1370772896) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
