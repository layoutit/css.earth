# Tonglingxing

## Sources

Its brightness, measured band by band, gives 75 times the Sun's luminosity at 4,245 K, so 15.983 solar radii. It is also HD 49878, HR 2527, HIP 33694. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1139835946142603008, distance 56 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 33694: distance 56.338 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.012), at which the luminosity and radius hold; Gaia DR3's parallax, 17.075 ± 0.109 mas (156.2 standard errors), is not used. Radius 15.983 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 33694: radius 15.983 solar radii, implied by the fitted luminosity 74.526 solar luminosities (fractional uncertainty 0.06) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,245 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 33694: effective temperature 4245 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.073). log g 2.11 from 1990ApJS...74.1075M ("High-resolution spectroscopic survey of 671 GK giants. I. Stellar atmosphere parameters and abundances.").

**Color.** Gaia DR3 XP spectrum, source 1139835946142603008, cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 452: HR 2527; VizieR III/202 (5 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffd09f. Routes tried in order: stis-ngsl: HD 49878 is not in the library; pulkovo: HR 2527 is not in the catalogue; kiehling: HR 2527 is not among its 60 stars; burnashev: BS 2527 is not in part2; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,245 K and log g 2.11 (u1 0.856, u2 -0.029): a model, because no fit of this star's limb is used. Gravity: log g 2.11 from 1990ApJS...74.1075M, the median of its 3 spectra; the 4 published values span log g 2.11 to 2.11, across which the limb law changes by at most 0.0% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 5 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HD 49878" (revision 1374550369) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
