# Botein

## Sources

Its brightness, measured band by band, gives 50 times the Sun's luminosity at 4,921 K, so 9.745 solar radii. It is also HD 19787, HR 951, HIP 14838. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 60248877811546112, distance 52 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 14838: distance 52.029 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.01), at which the luminosity and radius hold; Gaia DR3's parallax, 19.773 ± 0.159 mas (124.2 standard errors), is not used. Radius 9.745 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 14838: radius 9.745 solar radii, implied by the fitted luminosity 50.038 solar luminosities (fractional uncertainty 0.052) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,921 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 14838: effective temperature 4921 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.056). log g 2.36 from 2024A&A...682A.145S ("{\em Gaia} FGK benchmark stars: Fundamental {\em T}_eff_ and log {\em g} of the third version.").

**Color.** HST/STIS Next Generation Spectral Library v2 (Heap & Lindler; MAST high-level science product), HD 19787: 168-1020 nm, cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 166: HR 951; VizieR III/202 (5 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffe4c3. Routes tried in order: gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: HR 951 is not in the catalogue; kiehling: HR 951 is not among its 60 stars; burnashev: BS 951 is not in part2; stis-ngsl: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,921 K and log g 2.36 (u1 0.646, u2 0.135): a model, because no fit of this star's limb is used. Gravity: log g 2.36 from 2024A&A...682A.145S; the 21 published values span log g 2.36 to 3.05, across which the limb law changes by at most 0.3% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 5 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Delta Arietis" (revision 1375700532) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
