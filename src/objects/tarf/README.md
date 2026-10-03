# Tarf

## Sources

Its brightness, measured band by band, gives 598 times the Sun's luminosity at 4,103 K, so 48.474 solar radii. It is also HD 69267, HR 3249, HIP 40526. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3098404220680931968, distance 93 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 40526: distance 93.023 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.018), at which the luminosity and radius hold; Gaia DR3's parallax, 10.103 ± 0.314 mas (32.2 standard errors), is not used. Radius 48.474 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 40526: radius 48.474 solar radii, implied by the fitted luminosity 598.297 solar luminosities (fractional uncertainty 0.063) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,103 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 40526: effective temperature 4103 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.076). No surface gravity of this star is published.

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Tarf is HR 3249., cross-checked against Kiehling (1987), spectrophotometry of 60 bright F, G, K and M stars, 320-880 nm in 1 nm steps as normalised magnitudes: Kiehling (1987), A&AS 69, 465; VizieR III/124. * bet Cnc is HR 3249. (6 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffcd8c. Routes tried in order: stis-ngsl: HD 69267 is not in the library; kharitonov: found, not needed after the color and its cross-check; burnashev: BS 3249 is not in part2; gaia-xp: found, not needed after the color and its cross-check; pulkovo: used.

**Limb.** No limb darkening is drawn: no mass is measured and no spectroscopic surface gravity is published with this radius: McDonald, Zijlstra & Watson (2017), MNRAS 471, 770 assume the gravity of their fit (table column 15).

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 6 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Beta Cancri" (revision 1374787876) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
