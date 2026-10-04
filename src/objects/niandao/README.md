# Niandao

## Sources

Its brightness, measured band by band, gives 2,398 times the Sun's luminosity at 3,363 K, so 144.458 solar radii. It is also HD 175865, HR 7157, HIP 92862. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2106630885454013184, distance 91 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 92862: distance 91.408 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.011), at which the luminosity and radius hold; Gaia DR3's parallax, 10.440 ± 0.264 mas (39.6 standard errors), is not used. Radius 144.458 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 92862: radius 144.458 solar radii, implied by the fitted luminosity 2398.17 solar luminosities (fractional uncertainty 0.075) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 3,363 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 92862: effective temperature 3363 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.074). No surface gravity of this star is published.

**Color.** HST/STIS Next Generation Spectral Library v2 (Heap & Lindler; MAST high-level science product), HD 175865: 168-1020 nm, cross-checked against Burnashev (1985), Abastumani Astrophys. Obs. Bull. 59, 83; VizieR III/126, part2 record 564 (BS 7157), the widest of its 8 scans (3 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffcb84. Routes tried in order: pulkovo: HR 7157 is not in the catalogue; kiehling: HR 7157 is not among its 60 stars; kharitonov: HR 7157 is not in the catalogue; gaia-xp: found, not needed after the color and its cross-check; stis-ngsl: used.

**Limb.** No limb darkening is drawn: no mass is measured and no spectroscopic surface gravity is published with this radius: McDonald, Zijlstra & Watson (2017), MNRAS 471, 770 assume the gravity of their fit (table column 15).

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 3 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "R Lyrae" (revision 1374585554) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
