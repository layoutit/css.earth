# Formosa

## Sources

Its brightness, measured band by band, gives 45 times the Sun's luminosity at 4,803 K, so 9.726 solar radii. It is also HD 100655, HR 4459, HIP 56508. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3979226627820659072, distance 136 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 56508: distance 135.938 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.082), at which the luminosity and radius hold; Gaia DR3's parallax, 7.235 ± 0.029 mas (245.7 standard errors), is not used. Radius 9.726 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 56508: radius 9.726 solar radii, implied by the fitted luminosity 45.227 solar luminosities (fractional uncertainty 0.097) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,803 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 56508: effective temperature 4803 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.132). log g 2.86 from 2024A&A...683A.125P ("Analysis of the public HARPS/ESO spectroscopic archive Ca II H&K time series for the HARPS radial velocity database.").

**Color.** A Planck spectrum at 4,803 K, because no archive holds a spectrum of this star (stis-ngsl: HD 100655 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: HR 4459 is not in the catalogue; kiehling: HR 4459 is not among its 60 stars; kharitonov: HR 4459 is not in the catalogue; burnashev: BS 4459 is not in part2), through the CIE 1931 2° observer: #ffe3c8. Routes tried in order: stis-ngsl: HD 100655 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: HR 4459 is not in the catalogue; kiehling: HR 4459 is not among its 60 stars; kharitonov: HR 4459 is not in the catalogue; burnashev: BS 4459 is not in part2; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,803 K and log g 2.86 (u1 0.689, u2 0.103): a model, because no fit of this star's limb is used. Gravity: log g 2.86 from 2024A&A...683A.125P; the 7 published values span log g 2.39 to 2.858, across which the limb law changes by at most 0.2% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HD 100655" (revision 1374593008) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
