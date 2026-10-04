# Ping

## Sources

Its brightness, measured band by band, gives 406 times the Sun's luminosity at 4,089 K, so 40.184 solar radii. It is also HD 32887, HR 1654, HIP 23685. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2962546605447869184, distance 65 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 23685: distance 65.402 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.012), at which the luminosity and radius hold; Gaia DR3's parallax, 15.600 ± 0.107 mas (145.3 standard errors), is not used. Radius 40.184 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 23685: radius 40.184 solar radii, implied by the fitted luminosity 405.563 solar luminosities (fractional uncertainty 0.062) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,089 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 23685: effective temperature 4089 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.052). No surface gravity of this star is published.

**Color.** Kiehling (1987), spectrophotometry of 60 bright F, G, K and M stars, 320-880 nm in 1 nm steps as normalised magnitudes: Kiehling (1987), A&AS 69, 465; VizieR III/124. * eps Lep is HR 1654., cross-checked against Gaia DR3 XP spectrum, source 2962546605447869184 (66 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffce93. Routes tried in order: stis-ngsl: HD 32887 is not in the library; pulkovo: the spectrum was found but gives no color (Pulkovo flux must be finite.); kharitonov: HR 1654 is not in the catalogue; burnashev: the spectrum was found but gives no color (The spectrum has no sample near 756 nm and no declared gap there.); kiehling: used.

**Limb.** No limb darkening is drawn: no mass is measured and no spectroscopic surface gravity is published with this radius: McDonald, Zijlstra & Watson (2017), MNRAS 471, 770 assume the gravity of their fit (table column 15).

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 66 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Epsilon Leporis" (revision 1374550507) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
