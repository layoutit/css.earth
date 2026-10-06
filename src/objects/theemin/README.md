# Theemin

## Sources

Its brightness, measured band by band, gives 129 times the Sun's luminosity at 4,989 K, so 15.195 solar radii. It is also HD 29291, HR 1464, HIP 21393. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4878631812268014464, distance 66 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 21393: distance 65.574 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.012), at which the luminosity and radius hold; Gaia DR3's parallax, 15.450 ± 0.108 mas (142.9 standard errors), is not used. Radius 15.195 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 21393: radius 15.195 solar radii, implied by the fitted luminosity 128.509 solar luminosities (fractional uncertainty 0.052) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,989 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 21393: effective temperature 4989 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.041). log g 2.79 from 2024A&A...683A.125P ("Analysis of the public HARPS/ESO spectroscopic archive Ca II H&K time series for the HARPS radial velocity database.").

**Color.** Burnashev (1985), Abastumani Astrophys. Obs. Bull. 59, 83; VizieR III/126, part2 record 45 (BS 1464), cross-checked against Gaia DR3 XP spectrum, source 4878631812268014464 (24 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffe9ca. Routes tried in order: stis-ngsl: HD 29291 is not in the library; pulkovo: HR 1464 is not in the catalogue; kiehling: HR 1464 is not among its 60 stars; kharitonov: HR 1464 is not in the catalogue; burnashev: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,989 K and log g 2.79 (u1 0.631, u2 0.145): a model, because no fit of this star's limb is used. Gravity: log g 2.79 from 2024A&A...683A.125P; the 11 published values span log g 2.57 to 2.92, across which the limb law changes by at most 0.1% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 24 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Upsilon2 Eridani" (revision 1374592710) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
