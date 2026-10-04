# Angetenar

## Sources

Its brightness, measured band by band, gives 41 times the Sun's luminosity at 5,038 K, so 8.385 solar radii. It is also HD 17824, HR 850, HIP 13288. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5127513656557144576, distance 57 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 13288: distance 57.307 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.011), at which the luminosity and radius hold; Gaia DR3's parallax, 16.793 ± 0.217 mas (77.5 standard errors), is not used. Radius 8.385 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 13288: radius 8.385 solar radii, implied by the fitted luminosity 40.696 solar luminosities (fractional uncertainty 0.051) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 5,038 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 13288: effective temperature 5038 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.047). log g 2.89 from 2024A&A...682A.145S ("{\em Gaia} FGK benchmark stars: Fundamental {\em T}_eff_ and log {\em g} of the third version.").

**Color.** A Planck spectrum at 5,038 K, because no archive holds a spectrum of this star (stis-ngsl: HD 17824 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: HR 850 is not in the catalogue; kiehling: HR 850 is not among its 60 stars; kharitonov: HR 850 is not in the catalogue; burnashev: BS 850 is not in part2), through the CIE 1931 2° observer: #ffe7d1. Routes tried in order: stis-ngsl: HD 17824 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: HR 850 is not in the catalogue; kiehling: HR 850 is not among its 60 stars; kharitonov: HR 850 is not in the catalogue; burnashev: BS 850 is not in part2; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,038 K and log g 2.89 (u1 0.619, u2 0.154): a model, because no fit of this star's limb is used. Gravity: log g 2.89 from 2024A&A...682A.145S; the 11 published values span log g 2.82 to 3.33, across which the limb law changes by at most 0.2% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Tau2 Eridani" (revision 1374546800) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
