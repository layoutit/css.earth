# Ebla

## Sources

Its brightness, measured band by band, gives 0.404 times the Sun's luminosity at 4,543 K, so 1.027 solar radii. It is also HD 218566, HIP 114322. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2638410646295370880, distance 29 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 114322: distance 28.726 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.007), at which the luminosity and radius hold; Gaia DR3's parallax, 34.696 ± 0.029 mas (1207.7 standard errors), is not used. Radius 1.027 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 114322: radius 1.027 solar radii, implied by the fitted luminosity 0.404 solar luminosities (fractional uncertainty 0.055) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,543 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 114322: effective temperature 4543 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.106). log g 4.79 from 2024A&A...683A.125P ("Analysis of the public HARPS/ESO spectroscopic archive Ca II H&K time series for the HARPS radial velocity database.").

**Color.** A Planck spectrum at 4,543 K, because no archive holds a spectrum of this star (stis-ngsl: HD 218566 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffdebe. Routes tried in order: stis-ngsl: HD 218566 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,543 K and log g 4.79 (u1 0.755, u2 0.036): a model, because no fit of this star's limb is used. Gravity: log g 4.79 from 2024A&A...683A.125P; the 13 published values span log g 4.02 to 4.81, across which the limb law changes by at most 1.0% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HD 218566" (revision 1374438083) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
