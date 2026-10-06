# Xuange

## Sources

Its brightness, measured band by band, gives 15 times the Sun's luminosity at 8,332 K, so 1.876 solar radii. It is also HD 125162, HR 5351, HIP 69732. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1505311446553172992, distance 30 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 69732: distance 30.358 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.005), at which the luminosity and radius hold; Gaia DR3's parallax, 32.588 ± 0.141 mas (231.2 standard errors), is not used. Radius 1.876 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 69732: radius 1.876 solar radii, implied by the fitted luminosity 15.241 solar luminosities (fractional uncertainty 0.192) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 8,332 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 69732: effective temperature 8332 +/- 857 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.061). log g 3.95 from 2021A&A...647A..49S ("Chemical analysis of early-type stars with planets.").

**Color.** Gaia DR3 XP spectrum, source 1505311446553172992, cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 686: HR 5351; VizieR III/202 (4 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #b9cdff. Routes tried in order: stis-ngsl: HD 125162 is not in the library; pulkovo: HR 5351 is not in the catalogue; kiehling: HR 5351 is not among its 60 stars; burnashev: BS 5351 is not in part2; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 8,332 K and log g 3.95 (u1 0.323, u2 0.311): a model, because no fit of this star's limb is used. Gravity: log g 3.95 from 2021A&A...647A..49S; the 5 published values span log g 3.95 to 4, across which the limb law changes by at most 0.0% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 4 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Lambda Boötis" (revision 1370781595) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
