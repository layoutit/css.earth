# Timir

## Sources

Its brightness, measured band by band, gives 8.501 times the Sun's luminosity at 4,940 K, so 3.986 solar radii. It is also HD 148427, HIP 80687. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4330532859324207360, distance 71 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 80687: distance 70.558 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.03), at which the luminosity and radius hold; Gaia DR3's parallax, 14.206 ± 0.021 mas (690.2 standard errors), is not used. Radius 3.986 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 80687: radius 3.986 solar radii, implied by the fitted luminosity 8.501 solar luminosities (fractional uncertainty 0.059) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,940 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 80687: effective temperature 4940 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.045). log g 3.48 from 2024A&A...683A.125P ("Analysis of the public HARPS/ESO spectroscopic archive Ca II H&K time series for the HARPS radial velocity database.").

**Color.** Gaia DR3 XP spectrum, source 4330532859324207360, through the CIE 1931 2° observer: #ffe6cf. Routes tried in order: stis-ngsl: HD 148427 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,940 K and log g 3.48 (u1 0.658, u2 0.123): a model, because no fit of this star's limb is used. Gravity: log g 3.48 from 2024A&A...683A.125P; the 14 published values span log g 3.3 to 3.61, across which the limb law changes by at most 0.1% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HD 148427" (revision 1358448648) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
