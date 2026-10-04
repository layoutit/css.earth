# Yunü

## Sources

Its brightness, measured band by band, gives 261 times the Sun's luminosity at 4,121 K, so 31.71 solar radii. It is also HD 87837, HR 3980, HIP 49637. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3879879704937353984, distance 91 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 49637: distance 90.58 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.022), at which the luminosity and radius hold; Gaia DR3's parallax, 11.021 ± 0.166 mas (66.4 standard errors), is not used. Radius 31.71 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 49637: radius 31.71 solar radii, implied by the fitted luminosity 260.547 solar luminosities (fractional uncertainty 0.064) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,121 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 49637: effective temperature 4121 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.079). log g 1.59 from 2024A&A...682A.145S ("{\em Gaia} FGK benchmark stars: Fundamental {\em T}_eff_ and log {\em g} of the third version.").

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 564: HR 3980; VizieR III/202, through the CIE 1931 2° observer: #ffcc93. Routes tried in order: stis-ngsl: HD 87837 is not in the library; pulkovo: HR 3980 is not in the catalogue; kiehling: HR 3980 is not among its 60 stars; burnashev: BS 3980 is not in part2; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; kharitonov: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,121 K and log g 1.59 (u1 0.894, u2 -0.061): a model, because no fit of this star's limb is used. Gravity: log g 1.59 from 2024A&A...682A.145S; the 6 published values span log g 1.5 to 1.81, across which the limb law changes by at most 0.1% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "31 Leonis" (revision 1350656718) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
