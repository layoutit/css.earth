# Kenemu

## Sources

Its brightness, measured band by band, gives 30 times the Sun's luminosity at 7,508 K, so 3.253 solar radii. It is also HD 181577, HR 7340, HIP 95168. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4084474835781915392, distance 39 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 95168: distance 38.926 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.007), at which the luminosity and radius hold; Gaia DR3's parallax, 25.001 ± 0.245 mas (102.1 standard errors), is not used. Radius 3.253 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 95168: radius 3.253 solar radii, implied by the fitted luminosity 30.207 solar luminosities (fractional uncertainty 0.044) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 7,508 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 95168: effective temperature 7508 +/- 180 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.029). No surface gravity of this star is published.

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Kenemu is HR 7340., cross-checked against Burnashev (1985), Abastumani Astrophys. Obs. Bull. 59, 83; VizieR III/126, part2 record 260 (BS 7340) (2 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #d7e0ff. Routes tried in order: stis-ngsl: HD 181577 is not in the library; kiehling: HR 7340 is not among its 60 stars; kharitonov: HR 7340 is not in the catalogue; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: used.

**Limb.** No limb darkening is drawn: no mass is measured and no spectroscopic surface gravity is published with this radius: McDonald, Zijlstra & Watson (2017), MNRAS 471, 770 assume the gravity of their fit (table column 15).

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 2 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Rho1 Sagittarii" (revision 1377193152) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
