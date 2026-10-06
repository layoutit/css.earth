# Sadalbari

## Sources

Its brightness, measured band by band, gives 45 times the Sun's luminosity at 5,005 K, so 8.892 solar radii. It is also HD 216131, HR 8684, HIP 112748. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1876510592179455744, distance 33 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 112748: distance 32.531 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.009), at which the luminosity and radius hold; Gaia DR3's parallax, 28.934 ± 0.189 mas (153.3 standard errors), is not used. Radius 8.892 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 112748: radius 8.892 solar radii, implied by the fitted luminosity 44.58 solar luminosities (fractional uncertainty 0.051) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 5,005 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 112748: effective temperature 5005 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.083). log g 2.85 from 2024A&A...682A.145S ("{\em Gaia} FGK benchmark stars: Fundamental {\em T}_eff_ and log {\em g} of the third version.").

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Sadalbari is HR 8684., cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 1082: HR 8684; VizieR III/202 (3 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffe8c9. Routes tried in order: stis-ngsl: HD 216131 is not in the library; kiehling: HR 8684 is not among its 60 stars; burnashev: BS 8684 is not in part2; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,005 K and log g 2.85 (u1 0.628, u2 0.148): a model, because no fit of this star's limb is used. Gravity: log g 2.85 from 2024A&A...682A.145S; the 25 published values span log g 2.5 to 3.05, across which the limb law changes by at most 0.1% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 3 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Mu Pegasi" (revision 1374592828) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
