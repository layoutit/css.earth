# Nembus

## Sources

Its brightness, measured band by band, gives 154 times the Sun's luminosity at 4,411 K, so 21.264 solar radii. It is also HD 9927, HR 464, HIP 7607. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 399402894487590144, distance 54 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 7607: distance 54.318 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.01), at which the luminosity and radius hold; Gaia DR3's parallax, 18.549 ± 0.200 mas (92.8 standard errors), is not used. Radius 21.264 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 7607: radius 21.264 solar radii, implied by the fitted luminosity 153.791 solar luminosities (fractional uncertainty 0.058) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,411 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 7607: effective temperature 4411 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.099). log g 1.99 from 2024A&A...682A.145S ("{\em Gaia} FGK benchmark stars: Fundamental {\em T}_eff_ and log {\em g} of the third version.").

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 81: HR 464; VizieR III/202, cross-checked against Gaia DR3 XP spectrum, source 399402894487590144 (27 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffddac. Routes tried in order: stis-ngsl: HD 9927 is not in the library; pulkovo: HR 464 is not in the catalogue; kiehling: HR 464 is not among its 60 stars; burnashev: BS 464 is not in part2; kharitonov: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,411 K and log g 1.99 (u1 0.800, u2 0.018): a model, because no fit of this star's limb is used. Gravity: log g 1.99 from 2024A&A...682A.145S; the 16 published values span log g 1.66 to 2.34, across which the limb law changes by at most 0.1% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 27 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
