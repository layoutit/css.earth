# Alchiba

## Sources

Its brightness, measured band by band, gives 4.137 times the Sun's luminosity at 7,039 K, so 1.37 solar radii. It is also HD 105452, HR 4623, HIP 59199. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3489338019475637760, distance 15 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 59199: distance 14.937 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.002), at which the luminosity and radius hold; Gaia DR3's parallax, 66.770 ± 0.180 mas (370.1 standard errors), is not used. Radius 1.37 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 59199: radius 1.37 solar radii, implied by the fitted luminosity 4.137 solar luminosities (fractional uncertainty 0.063) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 7,039 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 59199: effective temperature 7039 +/- 248 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.066). No surface gravity of this star is published.

**Color.** HST/STIS Next Generation Spectral Library v2 (Heap & Lindler; MAST high-level science product), HD 105452: 168-1020 nm, cross-checked against Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Alchiba is HR 4623. (5 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #dee5ff. Routes tried in order: kiehling: HR 4623 is not among its 60 stars; kharitonov: HR 4623 is not in the catalogue; burnashev: BS 4623 is not in part2; gaia-xp: found, not needed after the color and its cross-check; stis-ngsl: used.

**Limb.** No limb darkening is drawn: no mass is measured and no spectroscopic surface gravity is published with this radius: McDonald, Zijlstra & Watson (2017), MNRAS 471, 770 assume the gravity of their fit (table column 15).

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 5 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Alpha Corvi" (revision 1374802356) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
