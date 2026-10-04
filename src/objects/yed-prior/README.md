# Yed Prior

## Sources

Its brightness, measured band by band, gives 558 times the Sun's luminosity at 3,811 K, so 54.27 solar radii. It is also HD 146051, HR 6056, HIP 79593. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4357027756659697664, distance 52 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 79593: distance 52.466 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.008), at which the luminosity and radius hold; Gaia DR3's parallax, 20.411 ± 0.540 mas (37.8 standard errors), is not used. Radius 54.27 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 79593: radius 54.27 solar radii, implied by the fitted luminosity 558.166 solar luminosities (fractional uncertainty 0.066) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 3,811 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 79593: effective temperature 3811 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.037). No surface gravity of this star is published.

**Color.** HST/STIS Next Generation Spectral Library v2 (Heap & Lindler; MAST high-level science product), HD 146051: 168-1020 nm, cross-checked against Kiehling (1987), spectrophotometry of 60 bright F, G, K and M stars, 320-880 nm in 1 nm steps as normalised magnitudes: Kiehling (1987), A&AS 69, 465; VizieR III/124. * del Oph is HR 6056. (2 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffcc88. Routes tried in order: pulkovo: the spectrum was found but gives no color (Pulkovo flux must be finite.); kharitonov: found, not needed after the color and its cross-check; burnashev: found, not needed after the color and its cross-check; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; stis-ngsl: used.

**Limb.** No limb darkening is drawn: no mass is measured and no spectroscopic surface gravity is published with this radius: McDonald, Zijlstra & Watson (2017), MNRAS 471, 770 assume the gravity of their fit (table column 15).

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 2 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Delta Ophiuchi" (revision 1377512875) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
