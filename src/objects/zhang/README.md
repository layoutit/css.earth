# Zhang

## Sources

Its brightness, measured band by band, gives 141 times the Sun's luminosity at 5,079 K, so 15.333 solar radii. It is also HD 85444, HR 3903, HIP 48356. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5687035813759862272, distance 81 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 48356: distance 80.906 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.021), at which the luminosity and radius hold; Gaia DR3 gives it no parallax. Radius 15.333 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 48356: radius 15.333 solar radii, implied by the fitted luminosity 140.555 solar luminosities (fractional uncertainty 0.054) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 5,079 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 48356: effective temperature 5079 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.04). log g 2.87 from 2024A&A...683A.125P ("Analysis of the public HARPS/ESO spectroscopic archive Ca II H&K time series for the HARPS radial velocity database.").

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 556: HR 3903; VizieR III/202, cross-checked against Gaia DR3 XP spectrum, source 5687035813759862272 (9 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffead2. Routes tried in order: stis-ngsl: HD 85444 is not in the library; pulkovo: HR 3903 is not in the catalogue; kiehling: HR 3903 is not among its 60 stars; burnashev: BS 3903 is not in part2; kharitonov: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,079 K and log g 2.87 (u1 0.607, u2 0.162): a model, because no fit of this star's limb is used. Gravity: log g 2.87 from 2024A&A...683A.125P; the 11 published values span log g 2.56 to 3.05, across which the limb law changes by at most 0.1% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 9 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Upsilon1 Hydrae" (revision 1353195476) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
