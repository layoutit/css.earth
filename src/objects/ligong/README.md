# Ligong

## Sources

Its brightness, measured band by band, gives 380 times the Sun's luminosity at 4,820 K, so 27.978 solar radii. It is also HD 215665, HR 8667, HIP 112440. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1876331990259358976, distance 112 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 112440: distance 111.982 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.027), at which the luminosity and radius hold; Gaia DR3's parallax, 8.599 ± 0.316 mas (27.2 standard errors), is not used. Radius 27.978 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 112440: radius 27.978 solar radii, implied by the fitted luminosity 379.591 solar luminosities (fractional uncertainty 0.058) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,820 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 112440: effective temperature 4820 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.102). log g 2.12 from 2024A&A...682A.145S ("{\em Gaia} FGK benchmark stars: Fundamental {\em T}_eff_ and log {\em g} of the third version.").

**Color.** HST/STIS Next Generation Spectral Library v2 (Heap & Lindler; MAST high-level science product), HD 215665: 168-1020 nm, cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 1080: HR 8667; VizieR III/202 (7 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffe4c0. Routes tried in order: pulkovo: HR 8667 is not in the catalogue; kiehling: HR 8667 is not among its 60 stars; burnashev: BS 8667 is not in part2; gaia-xp: found, not needed after the color and its cross-check; stis-ngsl: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,820 K and log g 2.12 (u1 0.673, u2 0.115): a model, because no fit of this star's limb is used. Gravity: log g 2.12 from 2024A&A...682A.145S; the 16 published values span log g 1.75 to 3.2, across which the limb law changes by at most 0.4% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 7 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Lambda Pegasi" (revision 1374618401) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
